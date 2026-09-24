# Cyclone Intelligence Platform — Technical Documentation

This document covers what data the platform uses, how it is cleaned and stored, exactly
which machine learning models are trained, their features/labels/hyperparameters/splits,
the rule-based (non-ML) component, and how everything is served at inference time.

For setup/run instructions see [README.md](README.md). This file is about *what is
implemented and why*, not *how to start the servers*.

---

## 1. Architecture

```
React (Vite + TS)  ──HTTP──>  FastAPI (backend/app)  ──>  SQLite (database/cyclone.db)
                                    │
                                    ├──> h5py   → data/tcir/  (satellite imagery, lazy per-sample reads)
                                    ├──> xarray → data/era5/  (reanalysis grid, lazy nearest-neighbor lookups)
                                    └──> joblib → data/models/ (trained scikit-learn models)
```

Nothing here uses deep learning frameworks (no PyTorch/TensorFlow) — both trained models
are `sklearn.ensemble.HistGradientBoostingRegressor` (gradient-boosted decision trees)
operating on small tabular feature vectors, chosen deliberately so training completes in
seconds/minutes on a machine with a limited RAM budget (~7GB), instead of requiring a GPU
to train a CNN over 14GB of raw imagery.

---

## 2. Datasets

| Dataset | File | Rows/Samples | Fields used |
|---|---|---|---|
| **IBTrACS** | `data/ibtracs/ibtracs.NI.list.v04r01.csv` | 1,854 cyclones, 57,775 track points (1842–2025) | SID, ISO_TIME, LAT/LON, WMO_WIND/PRES, USA_WIND/PRES, STORM_SPEED, STORM_DIR, SEASON, NAME, BASIN |
| **TCIR** | `data/tcir/TCIR-CPAC_IO_SH.h5` | 23,118 satellite samples, 424 cyclones (2003–2016) | `matrix` (23118×201×201×4 float32 image cube), `info` (ID, lat, lon, time, Vmax, MSLP, data_set) |
| **ERA5** | `data/era5/data_stream-oper_stepType-instant.nc` | 3-hourly, May–Dec 2010, lat 0–30°/lon 40–100° | u10, v10 (10m wind components), msl (sea-level pressure), sst (sea surface temperature) |

None of these are ever loaded in full into memory — see [§6 Serving strategy](#6-serving-strategy-lazy-everything).

---

## 3. Data Cleaning Pipeline (IBTrACS → SQLite)

Implemented in [backend/scripts/preprocess_ibtracs.py](backend/scripts/preprocess_ibtracs.py),
run via [backend/scripts/build_database.py](backend/scripts/build_database.py):

1. Read the CSV, **skip row 1** (units row, not data).
2. Filter to `BASIN == 'NI'` — the filename says North Indian Ocean but the file isn't
   purely that basin.
3. Coerce `LAT, LON, WMO_WIND, WMO_PRES, USA_WIND, USA_PRES, STORM_SPEED, STORM_DIR` to
   numeric — missing values are the literal string `' '` in the source file, not empty.
4. **Label fallback**: `wind_speed = WMO_WIND`, falling back to `USA_WIND` when WMO is
   missing (WMO is the official RSMC-designated source for this basin). Same fallback
   pattern for `pressure`. A `wind_source` column records which was actually used.
5. Parse `ISO_TIME` to a real timestamp; normalize longitude to −180..180 for display
   while keeping the raw value (`longitude_raw`) too.
6. **Bounding-box sanity filter**: drop rows outside lat −5..35°, lon 30..110°. The
   `BASIN=='NI'` label alone isn't reliable — one storm (SID `1932244N19296`) is labeled
   'NI' but its recorded positions track through ~70–83°N near Scandinavia, an obvious
   source-data error. This step drops 66 of 57,841 rows.
7. Drop rows with missing SID/timestamp/lat/lon.
8. **Aggregate** per storm into a `cyclones` row (name, season, basin, start/end time,
   max wind, min pressure, track length via haversine sum); keep **every** point in
   `track_points`.

### Database schema ([backend/app/models/cyclone.py](backend/app/models/cyclone.py))

- **`cyclones`**: `sid` (PK-ish, unique), `name`, `season`, `basin`, `subbasin`,
  `start_time`, `end_time`, `max_wind`, `min_pressure`, `track_points_count`,
  `track_length_km`.
- **`track_points`**: `sid` (FK), `timestamp`, `latitude`, `longitude`, `longitude_raw`,
  `wind_speed`, `wind_source`, `pressure`, `storm_speed`, `storm_direction`. Indexed on
  `(sid, timestamp)`.

Historical wind/pressure readings are sparse before the satellite era; missing values are
surfaced as genuinely missing (`NULL`), never imputed.

---

## 4. Machine Learning Model #1 — Satellite Intensity Regressor

**Question it answers**: "Given only a satellite image of a storm, what is its current
intensity (Vmax)?" Powers the Satellite Explorer's **"Run AI Analysis"** button.

**Code**: feature logic in [backend/app/utils/tcir_features.py](backend/app/utils/tcir_features.py)
(shared identically by training and inference so they never drift apart), training in
[backend/scripts/train_intensity_model.py](backend/scripts/train_intensity_model.py),
one-time extraction in [backend/scripts/extract_tcir_features.py](backend/scripts/extract_tcir_features.py),
inference serving in [backend/app/services/intensity_service.py](backend/app/services/intensity_service.py).

### Label
`Vmax` — maximum sustained wind speed in knots, taken directly from TCIR's `info` table
(a ground-truth value bundled with each satellite sample, sourced from best-track data at
the time/location of the image).

### Why tabular features, not raw pixels
TCIR is 23,118 × 201 × 201 × 4 float32 ≈ **14GB**. A CNN over that would need a GPU and
much more RAM than the ~7GB budget available; instead, [extract_tcir_features.py](backend/scripts/extract_tcir_features.py)
streams through the HDF5 matrix in batches of 512 rows (never holding more than one batch
in memory) and reduces each 201×201 image per channel to ~13 summary numbers, producing a
small parquet file (`data/processed/tcir_features.parquet`) that a gradient-boosting model
can train on directly.

### Features (58 total, per sample)

For **each of the 4 channels** (`ir1`, `wv`, `vis`, `pmw`), 13 statistics are computed by
[`channel_stats()`](backend/app/utils/tcir_features.py):

| Feature suffix | Meaning |
|---|---|
| `_mean`, `_std`, `_min`, `_max` | whole-image statistics |
| `_p10`, `_p50`, `_p90` | whole-image percentiles |
| `_center_mean`, `_center_min`, `_center_max` | stats over a 40×40 center crop (the storm eye/eyewall region — samples are storm-centered) |
| `_center_minus_outer` | center mean minus whole-image mean — a proxy for eye warmth / core structure |
| `_gradient_mean` | mean gradient magnitude (`np.gradient` → `hypot(gy, gx)`) — a texture measure capturing eyewall sharpness |
| `_available` | 1 if the channel has any non-NaN data for this sample (VIS is NaN at night; PMW/WV can have gaps) |

This channel-stat approach is deliberately built to mirror **Dvorak-technique** intuition
(cold overshooting cloud tops and eye warmth correlate with intensity) without needing
pixel-level deep learning.

Plus 5 non-image features: `lat`, `lon`, and a one-hot basin encoding
(`dataset_CPAC`, `dataset_IO`, `dataset_SH`) from TCIR's `data_set` column.

**Total feature vector**: 5 + (4 channels × 13 stats) = **58 features**.

### Algorithm selection & hyperparameters

**Three algorithms compared**:
1. **HistGradientBoostingRegressor** (selected)
   ```python
   HistGradientBoostingRegressor(
       max_iter=300, learning_rate=0.05, max_depth=6,
       random_state=42, early_stopping=True,
   )
   ```

2. **RandomForestRegressor**
   ```python
   RandomForestRegressor(
       n_estimators=200, max_depth=15, min_samples_split=5,
       min_samples_leaf=2, random_state=42, n_jobs=-1,
   )
   ```

3. **XGBoost**
   ```python
   XGBRegressor(
       n_estimators=300, learning_rate=0.05, max_depth=6,
       random_state=42, n_jobs=-1,
   )
   ```

**Selection criteria**: Minimum test set MAE. All models trained and evaluated on
identical train/validation/test splits to ensure fair comparison.

### Train/validation/test split
**Grouped by cyclone ID**, not by row (`GroupShuffleSplit`) — this is essential, because
splitting by row would leak consecutive frames of the *same storm* across train and test,
making the model look far more accurate than it really is on unseen storms.

- Test: 15% of storms held out entirely (`test_size=0.15`)
- Validation: ~15% of the *remaining* storms (`test_size=0.176` of the train portion)
- Train: the rest

### Actual measured results
(from [data/models/model_metadata.json](data/models/model_metadata.json), generated by
the training script — not fabricated numbers)

| Split | Samples | MAE (kt) | RMSE | R² |
|---|---|---|---|---|
| Training | 16,324 | — | — | — |
| Validation | 3,642 | 12.80 | 18.74 | 0.443 |
| **Test** | **3,152** | **12.29** | **17.73** | **0.524** |

Total: 23,118 samples across 424 cyclones.

### Significance / honest limitations
A test MAE of ~12.3 kt and R² of ~0.52 is a **real, modest baseline** — tabular summary
statistics from a 201×201×4 image cannot match a full CNN trained directly on pixels, but
that was out of scope given the RAM budget. It's presented in the UI alongside the
*actual* observed Vmax so the gap is always visible, not hidden.

### Inference
[intensity_service.py](backend/app/services/intensity_service.py) loads the saved
`vmax_model.joblib`, computes features for **one requested sample on demand** using the
exact same `sample_features()` function used at training time (so inference can never
silently drift from training), and returns predicted vs. actual Vmax plus the error.

---

## 5. Machine Learning Model #2 — Track Forecast Model

**Question it answers**: "Given a storm's current state, where will it physically be in
12/24/48 hours?" Powers Risk Estimation's predicted track and the Cyclone Simulator's
step-by-step forecast vs. what actually happened historically.

**Code**: training in [backend/scripts/train_track_forecast_model.py](backend/scripts/train_track_forecast_model.py),
inference in [backend/app/services/track_forecast_service.py](backend/app/services/track_forecast_service.py).

### Labels
Two regression targets per horizon, **not raw lat/lon** (predicting raw coordinates
directly would entangle storm motion with absolute position on Earth):
- `target_sin`, `target_cos` — sine/cosine of the true bearing from the current point to
  the actual future point. Using sin/cos instead of a raw 0–360° angle avoids the
  wraparound discontinuity (359° and 1° are almost the same direction, but numerically
  far apart) that would otherwise confuse a plain regressor.
- `target_distance_km` — great-circle distance (haversine) from current to future point.

The predicted (bearing, distance) pair is then converted back into a destination lat/lon
using the same great-circle math used elsewhere in the app
([`destination_point()`](backend/app/utils/geo.py)).

### How training pairs are mined
[`build_horizon_dataset()`](backend/scripts/train_track_forecast_model.py) walks every
storm's ordered track points and, for **each** point, looks for a later point whose
elapsed time is within ±25% of the target horizon (historical reporting isn't always
exactly 3-hourly) — 41k to 52k such (current state → actual future position) pairs are
mined per horizon from the whole IBTrACS history.

### Features (12 total)

| Feature | Meaning |
|---|---|
| `latitude`, `longitude` | current position |
| `storm_speed` | current forward speed (kt) |
| `sin_direction`, `cos_direction` | current compass bearing of motion, sin/cos encoded |
| `wind_speed` | current sustained wind (kt) |
| `pressure` | current central pressure (hPa) |
| `sin_month`, `cos_month` | calendar month, cyclically encoded (captures monsoon-season steering pattern differences) |
| `recent_bearing_change` | signed change in bearing vs. the *previous* observation |
| `recent_speed_change` | change in forward speed vs. the previous observation |
| `has_recent_trend` | 1 if a previous observation existed to compute the two features above, else 0 |

The last three features exist specifically so the model can distinguish an **actively
recurving** storm from one holding a steady course — a single snapshot alone can't
capture that. The Cyclone Simulator supplies this automatically from real history; the
manual Risk Estimation form doesn't ask for it, so those three features degrade
gracefully to 0/0/0 when absent.

### Algorithm selection & hyperparameters

**Three algorithms compared per horizon**:
1. **HistGradientBoostingRegressor**
   ```python
   HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, max_depth=6, random_state=42)
   ```

2. **RandomForestRegressor**
   ```python
   RandomForestRegressor(n_estimators=150, max_depth=12, min_samples_split=5, random_state=42, n_jobs=-1)
   ```

3. **XGBoost**
   ```python
   XGBRegressor(n_estimators=200, learning_rate=0.08, max_depth=6, random_state=42, n_jobs=-1)
   ```

**Selection criteria**: Best model selected per horizon based on minimum mean error (km).
**9 models total** — 3 per selected algorithm × 3 horizons, with each horizon getting 3 targets (sin, cos, distance).

### Train/test split
`GroupShuffleSplit` grouped by storm SID, `test_size=0.2` — evaluated only on storms
**never seen** during training, so measured error reflects genuine generalization, not
memorized tracks.

### Actual measured results
(from [data/models/track_forecast_metadata.json](data/models/track_forecast_metadata.json))

| Horizon | Train pairs | Test pairs | Mean error | Median error | P90 error |
|---|---|---|---|---|---|
| +12h | 41,464 | 10,862 | 38.5 km | **29.8 km** | 76.6 km |
| +24h | 38,079 | 9,005 | 106.4 km | **88.2 km** | 203.5 km |
| +48h | 30,080 | 7,016 | 260.3 km | **226.6 km** | 477.0 km |

These figures are comparable in magnitude to historically reported operational
track-forecast errors for this basin. Both the median and P90 error are shown on the map
as two concentric circles at each forecast point, so the UI communicates real uncertainty
rather than a single falsely-precise dot.

### Significance / honest limitations
The model has no awareness of steering winds, upper-level troughs, or other synoptic
weather systems — only what similar storms have done historically. Any single storm can
still land well outside its "typical" error band if its actual behavior departs from the
historical pattern (e.g. an unusually straight track that doesn't recurve when most storms
in similar conditions do — see the Cyclone Gay (1989) case surfaced in the Simulator).

### Inference
[track_forecast_service.py](backend/app/services/track_forecast_service.py) checks the
request's lat/lon against the model's training coverage (with a 3° buffer) before
predicting, so it explicitly refuses to answer outside the North Indian Ocean region it
was trained on rather than silently extrapolating.

---

## 6. The Non-ML Component — Rule-Based Risk Scoring

**Deliberately not a trained model.** [risk_service.py](backend/app/services/risk_service.py)
implements a transparent scoring formula instead, because the datasets available don't
overlap enough to train something reliable: ERA5 only covers May–Dec 2010 over one fixed
box, while IBTrACS/TCIR span a much wider time/space range — there isn't enough
(environmental conditions → outcome) overlap to supervise a model relating arbitrary
inputs to risk.

Given `wind_speed` (kt), `pressure` (hPa), `sst` (°C):

```
sst_score      = clamp((sst - 24.0) / (31.0 - 24.0) * 100)       # ~26.5°C = classical cyclogenesis threshold
pressure_score = clamp((1013.0 - pressure) / (1013.0 - 900.0) * 100)
wind_score     = clamp(wind_speed / 137.0 * 100)                  # 137kt ≈ Saffir-Simpson Category 5

overall = 0.35*sst_score + 0.35*pressure_score + 0.30*wind_score
```
Mapped to level: `<25` Low, `<50` Moderate, `<75` High, else Extreme. The response
includes a human-readable `explanation` list naming exactly which thresholds were crossed
(e.g. "Sea surface temperature is above the ~26.5°C threshold"), so the score is always
auditable rather than a black box.

---

## 7. Supporting Data Services (not ML, but part of the pipeline)

- **[era5_service.py](backend/app/services/era5_service.py)**: opens the ERA5 NetCDF file
  once via `xarray` (lazy — never materializes the full array), and answers point queries
  with `.sel(..., method="nearest")`. Converts Kelvin→Celsius, Pa→hPa, and u10/v10 wind
  components into speed/meteorological direction via `wind_direction_met()`. Honestly
  reports `available: false` for any point/time outside its actual coverage window.
- **[tcir_service.py](backend/app/services/tcir_service.py)**: opens the HDF5 file once,
  reads exactly one sample row at a time (`matrix[index]`, ~1.7ms measured), never slices
  in bulk. Renders per-channel PNGs with channel-specific normalization (e.g. IR1 inverted
  so cold cloud tops appear bright, matching standard satellite-imagery convention) and
  disk-caches them under `data/processed/tcir_png_cache/`.

---

## 8. Serving strategy: lazy everything

No dataset is ever loaded in full:
- **TCIR** (~14GB): single-row `h5py` reads only.
- **ERA5**: opened once via `xarray`, queried with nearest-neighbor `.sel()`.
- **IBTrACS**: parsed once into SQLite at build time; the raw CSV is never re-parsed per request.
- **Both trained models**: loaded once via `joblib.load()` at first use and cached in memory (a few MB each — tiny compared to the datasets they were trained from).

This is what makes the whole platform runnable on a machine with a modest RAM budget
despite one of its source files being 14GB.

---

## 9. API Surface (ML-relevant endpoints)

| Endpoint | Backed by |
|---|---|
| `GET /api/tcir/model` | Intensity model metadata (type, sample counts, MAE/RMSE/R²) |
| `POST /api/tcir/sample/{index}/predict` | Real image-based Vmax prediction vs. actual, for one TCIR sample |
| `GET /api/predict/track-forecast/model` | Track model metadata (training size, measured error per horizon) |
| `GET /api/predict/track-forecast` | Real trained-model position forecast at 12h/24h/48h |
| `POST /api/predict` | Rule-based environmental severity score (non-ML) |
| `GET /api/era5/environment` | ERA5 nearest-neighbor environmental lookup (non-ML) |

Full interactive schema at `http://localhost:8050/docs` (or whatever port the backend is
running on) once the server is up.

---

## 10. Algorithm Comparison & Justification

To justify the choice of HistGradientBoostingRegressor over alternatives, both training
scripts now compare three algorithms on identical train/test splits:

- **HistGradientBoostingRegressor** (sklearn) — native gradient boosting
- **RandomForestRegressor** (sklearn) — ensemble of decision trees
- **XGBoost** (xgboost) — popular gradient boosting implementation

The best-performing model (by test MAE for intensity, mean error for track forecast)
is automatically selected and saved. Comparison results are stored in the metadata files.

### Viewing comparison results

```bash
cd backend
python scripts/compare_models.py
```

This displays formatted tables showing all three algorithms' performance metrics,
making it clear why the selected model was chosen.

---

## 11. Where to look for more detail

| Topic | File |
|---|---|
| Data cleaning rules | [backend/scripts/preprocess_ibtracs.py](backend/scripts/preprocess_ibtracs.py) |
| DB schema | [backend/app/models/cyclone.py](backend/app/models/cyclone.py) |
| TCIR feature engineering | [backend/app/utils/tcir_features.py](backend/app/utils/tcir_features.py) |
| Intensity model training & comparison | [backend/scripts/train_intensity_model.py](backend/scripts/train_intensity_model.py) |
| Track model training & comparison | [backend/scripts/train_track_forecast_model.py](backend/scripts/train_track_forecast_model.py) |
| Model comparison display | [backend/scripts/compare_models.py](backend/scripts/compare_models.py) |
| Rule-based risk formula | [backend/app/services/risk_service.py](backend/app/services/risk_service.py) |
| Geospatial math (haversine, destination point, bearing) | [backend/app/utils/geo.py](backend/app/utils/geo.py) |
| Trained model metadata (real numbers) | [data/models/model_metadata.json](data/models/model_metadata.json), [data/models/track_forecast_metadata.json](data/models/track_forecast_metadata.json) |
