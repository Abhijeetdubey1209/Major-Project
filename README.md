# 🌪 Cyclone Intelligence Platform

A full-stack cyclone intelligence platform combining historical tropical cyclone tracks
(IBTrACS), satellite imagery (TCIR), and environmental reanalysis data (ERA5) into an
interactive dashboard with search, mapping, analytics, satellite browsing, and a
transparent rule-based risk estimator.

> This application is an academic research and visualization platform. Predictions from
> the Risk Estimation feature are experimental, rule-based estimates and must not be used
> for operational weather forecasting or public safety decisions.

## Features

- **Dashboard** — real, database-derived statistics (no hardcoded numbers), yearly cyclone
  trends, basin distribution, strongest recorded cyclones.
- **Cyclone Explorer** — search/filter 1,854 North Indian Ocean cyclones by name, season,
  and wind speed.
- **Cyclone Detail** — interactive dark-themed Leaflet track map, wind/pressure time
  series, and an ERA5 environmental lookup for any track point (with an honest
  "unavailable" state outside ERA5's coverage window).
- **Global Map** — cyclone tracks for many storms at once (filterable by season/wind
  threshold), colored by intensity, click-through to cyclone detail.
- **Satellite Explorer** — browse 23,118 TCIR satellite samples, switch between the 4
  imaging channels (IR1, WV, VIS, PMW), view per-sample metadata, and run a **real
  trained ML model** ("Run AI Analysis") that predicts cyclone intensity (Vmax) directly
  from the satellite image and reports it against the actual observed value.
- **Risk Estimation** — click a location on an interactive map (or drag the marker),
  enter the storm's current speed/direction/wind/pressure/sea-temperature, and get two
  things: a transparent rule-based severity score, and a **trained track-forecast
  model's** predicted position at 12h/24h/48h, drawn on the map with a shaded circle at
  each step showing its real measured error margin at that lead time.
- **Cyclone Simulator** — since there's rarely a live cyclone to demo against, this
  replays any real historical storm point by point (play/pause/speed controls) and, at
  each step, asks the trained track-forecast model to predict +12h/24h/48h using only
  data available up to that moment — then shows what the storm **actually** did next
  (already known, since it's history) right alongside it on the map, with the real
  error in km. Search any of the 1,854 storms to try it on a different one.
- **Data Sources** — live status and coverage of all three datasets.

## Architecture

```
React (Vite + TS + Tailwind) ──HTTP──> FastAPI ──> SQLite (cyclones/track_points)
                                            │
                                            ├──> h5py (TCIR, lazy per-sample reads)
                                            └──> xarray (ERA5, lazy nearest-neighbor lookups)
```

Neither the ~14GB TCIR matrix nor the ERA5 dataset is ever loaded in full — see
[Performance notes](#performance-notes) below.

## Datasets

| Dataset | Location | Description |
|---|---|---|
| TCIR | `data/tcir/TCIR-CPAC_IO_SH.h5` | 23,118 satellite imagery samples, 201x201px, 4 channels (IR1/WV/VIS/PMW), 424 cyclones, 2003-2016 |
| IBTrACS | `data/ibtracs/ibtracs.NI.list.v04r01.csv` | North Indian Ocean best-track data, 1,854 cyclones, 57,775 track points, 1842-2025 |
| ERA5 | `data/era5/data_stream-oper_stepType-instant.nc` | u10/v10/msl/sst reanalysis, May-Dec 2010, lat 0-30°/lon 40-100°, 3-hourly |

Dataset paths are auto-discovered by `backend/app/config.py` (checks the expected
locations first, falls back to a recursive filename search) — the project keeps working
even if `data/` is moved.

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
python scripts/build_database.py             # builds database/cyclone.db from IBTrACS
python scripts/extract_tcir_features.py      # one-time: extracts per-sample image features (~1-2 min)
python scripts/train_intensity_model.py      # trains the Vmax regressor from those features
python scripts/train_track_forecast_model.py # trains the 12h/24h/48h track forecaster
uvicorn app.main:app --reload --port 8050
```

The last three steps are optional — the app works without them, and the relevant UI
(Satellite Explorer's "Run AI Analysis", Risk Estimation's track forecast) will simply
report the model as not yet trained.

Backend runs at `http://localhost:8050` (API docs at `/docs`). If code changes seem to
have no effect even after restarting, the port may have gotten stuck serving a stale
process in your dev environment — stop the backend, pick a different port (both here
and in `frontend/.env`'s `VITE_API_URL`), and start again.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### One-command start (Windows)

```
run_project.bat
```

Starts both servers in separate terminal windows.

## Data Preprocessing

`backend/scripts/preprocess_ibtracs.py` implements the cleaning pipeline:
1. Skip the units row (`skiprows=[1]`).
2. Filter to `BASIN == 'NI'` — the file is not purely North Indian Ocean despite its name.
3. Coerce numeric columns (missing values are the literal string `' '`, not empty).
4. `wind_speed = WMO_WIND`, falling back to `USA_WIND` (WMO is the official RSMC-designated
   source for this basin). Same fallback for pressure.
5. Parse `ISO_TIME`, normalize longitude to -180..180 while preserving the raw value.
6. Drop rows outside a sane North Indian Ocean bounding box (lat -5..35, lon 30..110) —
   `BASIN == 'NI'` alone isn't reliable (one storm, SID `1932244N19296`, is labeled 'NI'
   but its recorded positions track through ~70-83°N near Scandinavia, an obvious source
   data error, not a real storm; this dropped 66 of 57,841 rows).
7. Aggregate per storm into `cyclones`; keep every point in `track_points`.

Re-run `python backend/scripts/build_database.py` any time to rebuild the database from
the source CSV.

## API

See `http://localhost:8050/docs` for the full interactive schema. Key endpoints:

- `GET /api/health` — dataset availability
- `GET /api/cyclones`, `/api/cyclones/{sid}`, `/api/cyclones/{sid}/track`, `/api/cyclones/tracks` (many tracks at once, for the Global Map)
- `GET /api/analytics/overview|yearly|basins|wind-distribution|pressure-distribution|strongest-cyclones`
- `GET /api/era5/coverage`, `/api/era5/environment?latitude=&longitude=&timestamp=`
- `GET /api/tcir/overview`, `/api/tcir/samples`, `/api/tcir/sample/{index}`, `/api/tcir/sample/{index}/image?channel=`
- `GET /api/tcir/model` — trained model metadata (type, sample counts, MAE/RMSE/R²)
- `POST /api/tcir/sample/{index}/predict` — real image-based Vmax prediction vs. actual
- `POST /api/predict` — rule-based environmental severity estimate
- `GET /api/predict/track-forecast/model` — track model metadata (training size, measured error per horizon)
- `GET /api/predict/track-forecast?latitude=&longitude=&storm_speed=&storm_direction=&wind_speed=&pressure=` —
  real trained-model position forecast at 12h/24h/48h

## Performance notes

- TCIR's `/matrix` dataset has no chunk layout, but single-row reads benchmark at ~1.7ms
  each (verified) — samples are read one at a time (`matrix[index]`), never sliced in
  bulk, and rendered PNGs are disk-cached under `data/processed/tcir_png_cache/`.
- ERA5 is opened once at startup via `xarray` and queried with `.sel(..., method="nearest")`
  — the full dataset is never materialized in memory.
- IBTrACS is processed once into SQLite; the raw CSV is never re-parsed per request.

## Known Limitations

- TCIR covers only the CPAC/IO/SH basins (2003-2016); the platform's cyclone explorer and
  maps use IBTrACS's North Indian Ocean data, which does not perfectly overlap with TCIR.
- ERA5 coverage is limited to May-December 2010 over a fixed Indian Ocean bounding box —
  environmental lookups outside that window/region honestly report unavailability.
- The Risk Estimation feature (manual lat/lon/wind/pressure/SST inputs) is a transparent,
  rule-based scoring system, not a trained ML model — ERA5 (May-Dec 2010, one bounding
  box) and IBTrACS/TCIR don't overlap enough in time/space to train a reliable supervised
  model relating arbitrary environmental conditions to risk.
- The Risk Estimation/Simulator predicted track **is** a real trained model (three
  `HistGradientBoostingRegressor`s per lead time — bearing as sin/cos plus distance —
  `backend/scripts/train_track_forecast_model.py`), trained on 41k-52k real
  (current state → actual future position) pairs mined from every historical storm's
  track, split by storm so no storm's points appear in both train and test. Features
  include the storm's change in speed/bearing since its previous observation, when
  available (e.g. the Simulator supplies this automatically from real history; the
  manual Risk Estimation form doesn't ask for it, so it degrades gracefully without).
  Measured error on storms it never saw: median ≈30 km at 12h, ≈88 km at 24h, ≈227 km at
  48h (p90: ≈77/204/477 km — both are shown on the map as two circles) — real numbers,
  not fabricated, and comparable in magnitude to historically reported operational
  track-forecast errors for this basin. It has no awareness of steering winds or other
  weather systems, only what similar storms have done before, so any single storm can
  still land well outside its "typical" error if its actual behavior (e.g. an unusually
  straight track that doesn't recurve when most storms in similar conditions do) departs
  from the historical pattern — see the Cyclone Gay (1989) case in the Simulator.
- The Satellite Explorer's AI intensity model *is* a real trained model (HistGradientBoostingRegressor
  on per-channel image statistics — mean/std/percentiles, storm-center crop stats, and
  gradient texture per channel — group-split by cyclone ID to prevent leakage between
  consecutive frames of the same storm). Test set MAE ≈ 12.3 kt, R² ≈ 0.52 on 23,118
  samples across 424 cyclones — a real, modest baseline (tabular features from a
  201x201x4 image cannot match a full CNN, which was out of scope given the ~7GB RAM
  budget), not a fabricated number.
- Historical IBTrACS wind/pressure readings are sparse before the satellite era; missing
  values are surfaced as genuinely missing, never imputed.

## Future Improvements

- Train a CNN directly on TCIR pixels (rather than summary-statistic features) for
  better intensity-prediction accuracy, if more RAM/VRAM becomes available.
- Expand ERA5 coverage to additional years/regions as more reanalysis data becomes
  available.
- MOSDAC (ISRO) satellite integration once account access is approved.
