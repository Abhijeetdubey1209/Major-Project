"""Serves the trained track-forecasting model (see scripts/train_track_forecast_model.py).

Given a storm's current position, speed, direction, and intensity, predicts its actual
position at 12/24/48 hours using models trained on real historical storm transitions.
"""
from __future__ import annotations

import json
import math
from datetime import datetime

import joblib
import numpy as np
import pandas as pd

from app.config import DATA_ROOT
from app.utils.geo import bearing_diff_deg, destination_point

MODEL_PATH = DATA_ROOT / "models" / "track_forecast_model.joblib"
METADATA_PATH = DATA_ROOT / "models" / "track_forecast_metadata.json"

LAT_BUFFER = 3.0
LON_BUFFER = 3.0


class TrackForecastService:
    def __init__(self) -> None:
        self._bundle: dict | None = None
        self._metadata: dict | None = None

    @property
    def available(self) -> bool:
        return MODEL_PATH.exists() and METADATA_PATH.exists()

    def load(self) -> None:
        if not self.available or self._bundle is not None:
            return
        self._bundle = joblib.load(MODEL_PATH)
        self._metadata = json.loads(METADATA_PATH.read_text())

    def metadata(self) -> dict:
        if not self.available:
            return {"available": False}
        self.load()
        return {"available": True, **self._metadata}

    def _in_coverage(self, lat: float, lon: float) -> bool:
        lat_min, lat_max = self._metadata["latitude_range"]
        lon_min, lon_max = self._metadata["longitude_range"]
        return (lat_min - LAT_BUFFER <= lat <= lat_max + LAT_BUFFER) and (
            lon_min - LON_BUFFER <= lon <= lon_max + LON_BUFFER
        )

    def forecast(
        self,
        latitude: float,
        longitude: float,
        storm_speed: float,
        storm_direction: float,
        wind_speed: float,
        pressure: float | None = None,
        prev_storm_speed: float | None = None,
        prev_storm_direction: float | None = None,
        when: datetime | None = None,
    ) -> dict:
        if not self.available:
            return {
                "available": False,
                "reason": "Track forecasting model not trained yet. Run backend/scripts/train_track_forecast_model.py.",
            }

        self.load()

        if not self._in_coverage(latitude, longitude):
            return {
                "available": False,
                "reason": "This location is outside the region the model was trained on (North Indian Ocean).",
            }

        when = when or datetime.utcnow()
        month = when.month

        has_recent_trend = 0
        recent_bearing_change = 0.0
        recent_speed_change = 0.0
        if prev_storm_speed is not None and prev_storm_direction is not None:
            has_recent_trend = 1
            recent_bearing_change = bearing_diff_deg(storm_direction, prev_storm_direction)
            recent_speed_change = storm_speed - prev_storm_speed

        row = pd.DataFrame(
            [
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "storm_speed": storm_speed,
                    "sin_direction": math.sin(math.radians(storm_direction)),
                    "cos_direction": math.cos(math.radians(storm_direction)),
                    "wind_speed": wind_speed,
                    "pressure": pressure,
                    "sin_month": math.sin(2 * math.pi * month / 12),
                    "cos_month": math.cos(2 * math.pi * month / 12),
                    "recent_bearing_change": recent_bearing_change,
                    "recent_speed_change": recent_speed_change,
                    "has_recent_trend": has_recent_trend,
                }
            ]
        )
        features = row[self._metadata["feature_columns"]]

        points = []
        for horizon_str, models in self._bundle.items():
            horizon = int(horizon_str)
            pred_sin = float(models["target_sin"].predict(features)[0])
            pred_cos = float(models["target_cos"].predict(features)[0])
            pred_distance = max(0.0, float(models["target_distance_km"].predict(features)[0]))
            bearing = math.degrees(math.atan2(pred_sin, pred_cos)) % 360.0

            pred_lat, pred_lon = destination_point(latitude, longitude, bearing, pred_distance)
            metrics = self._metadata["metrics_by_horizon"].get(str(horizon), {})

            points.append(
                {
                    "hours_ahead": horizon,
                    "latitude": round(pred_lat, 3),
                    "longitude": round(pred_lon, 3),
                    "bearing_deg": round(bearing, 1),
                    "distance_km": round(pred_distance, 1),
                    "expected_error_km": metrics.get("median_error_km"),
                    "p90_error_km": metrics.get("p90_error_km"),
                }
            )

        points.sort(key=lambda p: p["hours_ahead"])
        return {"available": True, "points": points}


track_forecast_service = TrackForecastService()
