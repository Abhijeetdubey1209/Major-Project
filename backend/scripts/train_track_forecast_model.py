"""Trains a real track-forecasting model: given a storm's current position, speed,
direction, and intensity, predict where it will actually be 12/24/48 hours later.

This replaces the historical-analog "average nearby motion" approach with genuine
supervised learning: one model per lead time, trained on real (current_state -> actual
future_position) pairs mined from every historical storm's track, evaluated on storms
never seen during training, with a real measured error in kilometers.

Predicts bearing (as sin/cos, to handle the 0/360 wraparound correctly for a plain
regressor) and distance separately, then reconstructs the destination point with the
same great-circle math used elsewhere in the app (app.utils.geo.destination_point).
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupShuffleSplit

from app.config import DATA_ROOT
from app.database import engine
from app.utils.geo import bearing_diff_deg, destination_point, haversine_km

HORIZONS_HOURS = [12, 24, 48]
# Accept a future point as a training target if its actual elapsed time is within
# this fraction of the target horizon (historical cadence isn't always exactly 3-hourly).
TOLERANCE_FRACTION = 0.25

MODEL_DIR = DATA_ROOT / "models"
MODEL_PATH = MODEL_DIR / "track_forecast_model.joblib"
METADATA_PATH = MODEL_DIR / "track_forecast_metadata.json"

FEATURE_COLUMNS = [
    "latitude",
    "longitude",
    "storm_speed",
    "sin_direction",
    "cos_direction",
    "wind_speed",
    "pressure",
    "sin_month",
    "cos_month",
    "recent_bearing_change",
    "recent_speed_change",
    "has_recent_trend",
]


def load_track_points() -> pd.DataFrame:
    df = pd.read_sql(
        "SELECT sid, timestamp, latitude, longitude, wind_speed, pressure, "
        "storm_speed, storm_direction FROM track_points ORDER BY sid, timestamp",
        engine,
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def build_horizon_dataset(df: pd.DataFrame, horizon_hours: int) -> pd.DataFrame:
    """One row per (current point, matching future point) pair for this horizon."""
    tolerance_h = horizon_hours * TOLERANCE_FRACTION
    rows = []

    for sid, group in df.groupby("sid", sort=False):
        group = group.reset_index(drop=True)
        n = len(group)
        times = group["timestamp"].to_numpy()

        for i in range(n):
            current = group.iloc[i]
            if pd.isna(current.storm_speed) or pd.isna(current.storm_direction):
                continue

            # How the storm's own motion has changed since the previous observation --
            # the model otherwise has no way to tell an actively-recurving storm apart
            # from one holding a steady course, since it only ever sees a single snapshot.
            recent_bearing_change = 0.0
            recent_speed_change = 0.0
            has_recent_trend = 0
            if i > 0:
                prev = group.iloc[i - 1]
                if pd.notna(prev.storm_speed) and pd.notna(prev.storm_direction):
                    recent_bearing_change = bearing_diff_deg(current.storm_direction, prev.storm_direction)
                    recent_speed_change = current.storm_speed - prev.storm_speed
                    has_recent_trend = 1

            target_time = current.timestamp + pd.Timedelta(hours=horizon_hours)
            # nearest subsequent point in time, within tolerance
            deltas_h = (times[i + 1 :] - np.datetime64(target_time)) / np.timedelta64(1, "h")
            if len(deltas_h) == 0:
                continue
            abs_deltas = np.abs(deltas_h)
            best_j_offset = int(np.argmin(abs_deltas))
            if abs_deltas[best_j_offset] > tolerance_h:
                continue

            future = group.iloc[i + 1 + best_j_offset]

            distance_km = haversine_km(current.latitude, current.longitude, future.latitude, future.longitude)
            bearing = math.degrees(
                math.atan2(
                    math.sin(math.radians(future.longitude - current.longitude))
                    * math.cos(math.radians(future.latitude)),
                    math.cos(math.radians(current.latitude)) * math.sin(math.radians(future.latitude))
                    - math.sin(math.radians(current.latitude))
                    * math.cos(math.radians(future.latitude))
                    * math.cos(math.radians(future.longitude - current.longitude)),
                )
            ) % 360.0

            month = current.timestamp.month
            rows.append(
                {
                    "sid": sid,
                    "latitude": current.latitude,
                    "longitude": current.longitude,
                    "storm_speed": current.storm_speed,
                    "sin_direction": math.sin(math.radians(current.storm_direction)),
                    "cos_direction": math.cos(math.radians(current.storm_direction)),
                    "wind_speed": current.wind_speed,
                    "pressure": current.pressure,
                    "sin_month": math.sin(2 * math.pi * month / 12),
                    "cos_month": math.cos(2 * math.pi * month / 12),
                    "recent_bearing_change": recent_bearing_change,
                    "recent_speed_change": recent_speed_change,
                    "has_recent_trend": has_recent_trend,
                    "target_sin": math.sin(math.radians(bearing)),
                    "target_cos": math.cos(math.radians(bearing)),
                    "target_distance_km": distance_km,
                    "actual_future_lat": future.latitude,
                    "actual_future_lon": future.longitude,
                }
            )

    return pd.DataFrame(rows)


def train_horizon(dataset: pd.DataFrame, horizon_hours: int) -> tuple[dict, dict]:
    X = dataset[FEATURE_COLUMNS]
    groups = dataset["sid"]

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, groups=groups))

    models = {}
    for target in ("target_sin", "target_cos", "target_distance_km"):
        model = HistGradientBoostingRegressor(max_iter=200, learning_rate=0.08, max_depth=6, random_state=42)
        model.fit(X.iloc[train_idx], dataset[target].iloc[train_idx])
        models[target] = model

    # Evaluate: reconstruct predicted lat/lon, measure real haversine error in km.
    test = dataset.iloc[test_idx]
    pred_sin = models["target_sin"].predict(X.iloc[test_idx])
    pred_cos = models["target_cos"].predict(X.iloc[test_idx])
    pred_distance = np.clip(models["target_distance_km"].predict(X.iloc[test_idx]), 0, None)
    pred_bearing = (np.degrees(np.arctan2(pred_sin, pred_cos))) % 360.0

    errors_km = []
    for k, (_, row) in enumerate(test.iterrows()):
        pred_lat, pred_lon = destination_point(row.latitude, row.longitude, pred_bearing[k], pred_distance[k])
        errors_km.append(haversine_km(pred_lat, pred_lon, row.actual_future_lat, row.actual_future_lon))
    errors_km = np.array(errors_km)

    metrics = {
        "training_samples": int(len(train_idx)),
        "test_samples": int(len(test_idx)),
        "mean_error_km": round(float(errors_km.mean()), 1),
        "median_error_km": round(float(np.median(errors_km)), 1),
        "p90_error_km": round(float(np.percentile(errors_km, 90)), 1),
    }
    return models, metrics


def train() -> dict:
    df = load_track_points()
    print(f"Loaded {len(df)} track points across {df['sid'].nunique()} storms.")

    bundle = {}
    all_metrics = {}

    for horizon in HORIZONS_HOURS:
        print(f"\nBuilding dataset for {horizon}h horizon...")
        dataset = build_horizon_dataset(df, horizon)
        print(f"  {len(dataset)} training pairs from {dataset['sid'].nunique()} storms")

        models, metrics = train_horizon(dataset, horizon)
        bundle[horizon] = models
        all_metrics[str(horizon)] = metrics
        print(f"  Mean error: {metrics['mean_error_km']} km, median: {metrics['median_error_km']} km")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH)

    metadata = {
        "model_type": "HistGradientBoostingRegressor (bearing sin/cos + distance, per horizon)",
        "horizons_hours": HORIZONS_HOURS,
        "feature_columns": FEATURE_COLUMNS,
        "latitude_range": [float(df["latitude"].min()), float(df["latitude"].max())],
        "longitude_range": [float(df["longitude"].min()), float(df["longitude"].max())],
        "metrics_by_horizon": all_metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))
    print(f"\nSaved model to {MODEL_PATH}")
    print(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    train()
