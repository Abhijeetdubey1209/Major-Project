from __future__ import annotations

from datetime import datetime

import numpy as np
import xarray as xr

from app.config import locate_dataset
from app.utils.geo import wind_direction_met


class Era5Service:
    def __init__(self) -> None:
        self._ds: xr.Dataset | None = None
        self._path = locate_dataset("era5")

    @property
    def available(self) -> bool:
        return self._path is not None

    def load(self) -> None:
        if self._path is not None and self._ds is None:
            # xarray keeps this lazy (no full-array load) until specific values are indexed.
            self._ds = xr.open_dataset(self._path)

    def close(self) -> None:
        if self._ds is not None:
            self._ds.close()
            self._ds = None

    def coverage(self) -> dict:
        if not self.available or self._ds is None:
            return {"available": False}
        ds = self._ds
        lat = ds["latitude"].values
        lon = ds["longitude"].values
        time = ds["valid_time"].values
        return {
            "available": True,
            "start_time": str(time.min()),
            "end_time": str(time.max()),
            "latitude_min": float(lat.min()),
            "latitude_max": float(lat.max()),
            "longitude_min": float(lon.min()),
            "longitude_max": float(lon.max()),
            "variables": list(ds.data_vars),
        }

    def _in_bounds(self, latitude: float, longitude: float, timestamp: datetime) -> bool:
        ds = self._ds
        lat_vals = ds["latitude"].values
        lon_vals = ds["longitude"].values
        time_vals = ds["valid_time"].values
        ts64 = np.datetime64(timestamp)
        return (
            lat_vals.min() <= latitude <= lat_vals.max()
            and lon_vals.min() <= longitude <= lon_vals.max()
            and time_vals.min() <= ts64 <= time_vals.max()
        )

    def get_environment(self, latitude: float, longitude: float, timestamp: datetime) -> dict:
        if not self.available:
            return {"available": False, "reason": "ERA5 dataset is not available on this system."}

        self.load()

        if not self._in_bounds(latitude, longitude, timestamp):
            return {
                "available": False,
                "reason": "Requested location or time is outside available ERA5 coverage.",
            }

        point = self._ds.sel(
            latitude=latitude,
            longitude=longitude,
            valid_time=np.datetime64(timestamp),
            method="nearest",
        )

        u10 = float(point["u10"].values)
        v10 = float(point["v10"].values)
        msl = float(point["msl"].values)
        sst = float(point["sst"].values)

        wind_speed = float(np.hypot(u10, v10))
        wind_direction = wind_direction_met(u10, v10)

        return {
            "available": True,
            "matched_timestamp": str(point["valid_time"].values),
            "matched_latitude": float(point["latitude"].values),
            "matched_longitude": float(point["longitude"].values),
            "u10": u10,
            "v10": v10,
            "wind_speed": round(wind_speed, 2),
            "wind_direction": round(wind_direction, 1),
            "pressure_hpa": round(msl / 100.0, 1),
            "sst_celsius": round(sst - 273.15, 2),
        }


era5_service = Era5Service()
