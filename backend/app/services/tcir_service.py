"""Lazy access to the TCIR HDF5 dataset.

The /matrix dataset is ~14GB (23118, 201, 201, 4) float32 and must NEVER be loaded
whole into memory. Every read here is a single-row h5py index (`matrix[index]`),
confirmed fast (~1.7ms avg) even though the dataset has no chunk layout.

Channels were empirically identified (no bundled documentation ships with the file)
by inspecting per-channel value ranges and NaN patterns on real samples:
  0: IR1 - infrared window brightness temperature (Kelvin, ~184-298K)
  1: WV  - water vapor brightness temperature (Kelvin, ~183-253K)
  2: VIS - visible reflectance (0-1), NaN at night
  3: PMW - passive microwave rain-rate proxy (mm/hr, ~0-18)
"""
from __future__ import annotations

import io
from datetime import datetime
from functools import lru_cache

import h5py
import numpy as np
import pandas as pd
from PIL import Image

from app.config import CACHE_DIR, locate_dataset

CACHE_VERSION = "v1"

CHANNEL_NAMES = ["IR1", "WV", "VIS", "PMW"]


class TcirService:
    def __init__(self) -> None:
        self._path = locate_dataset("tcir")
        self._h5: h5py.File | None = None
        self._info: pd.DataFrame | None = None

    @property
    def available(self) -> bool:
        return self._path is not None

    def load(self) -> None:
        if not self.available or self._h5 is not None:
            return
        self._h5 = h5py.File(self._path, "r")
        self._info = pd.read_hdf(self._path, key="info")
        self._info["parsed_time"] = pd.to_datetime(
            self._info["time"].astype(str), format="%Y%m%d%H", errors="coerce"
        )

    def close(self) -> None:
        if self._h5 is not None:
            self._h5.close()
            self._h5 = None
            self._info = None

    def overview(self) -> dict:
        if not self.available:
            return {"available": False}
        self.load()
        info = self._info
        return {
            "available": True,
            "total_samples": int(len(info)),
            "unique_cyclones": int(info["ID"].nunique()),
            "dataset_distribution": info["data_set"].value_counts().to_dict(),
            "time_range": [
                str(info["parsed_time"].min()),
                str(info["parsed_time"].max()),
            ],
            "vmax_stats": {
                "min": float(info["Vmax"].min()),
                "max": float(info["Vmax"].max()),
                "mean": round(float(info["Vmax"].mean()), 1),
            },
            "mslp_stats": {
                "min": float(info["MSLP"].min()),
                "max": float(info["MSLP"].max()),
                "mean": round(float(info["MSLP"].mean()), 1),
            },
            "channels": CHANNEL_NAMES,
        }

    def list_samples(
        self,
        page: int = 1,
        limit: int = 25,
        dataset: str | None = None,
        cyclone_id: str | None = None,
    ) -> tuple[list[dict], int]:
        self.load()
        df = self._info
        if dataset:
            df = df[df["data_set"] == dataset]
        if cyclone_id:
            df = df[df["ID"] == cyclone_id]

        total = len(df)
        page_df = df.iloc[(page - 1) * limit : (page - 1) * limit + limit]

        items = []
        for idx, row in page_df.iterrows():
            items.append(
                {
                    "index": int(idx),
                    "id": row["ID"],
                    "dataset": row["data_set"],
                    "lat": float(row["lat"]),
                    "lon": float(row["lon"]),
                    "time": str(row.get("parsed_time")),
                    "vmax": float(row["Vmax"]),
                    "mslp": float(row["MSLP"]),
                    "r35_4qavg": float(row["R35_4qAVG"]),
                }
            )
        return items, total

    def get_sample_metadata(self, index: int) -> dict:
        self.load()
        if index < 0 or index >= len(self._info):
            raise IndexError(f"Sample index {index} out of range")
        row = self._info.iloc[index]
        return {
            "index": index,
            "id": row["ID"],
            "dataset": row["data_set"],
            "lat": float(row["lat"]),
            "lon": float(row["lon"]),
            "time": str(row.get("parsed_time")),
            "vmax": float(row["Vmax"]),
            "mslp": float(row["MSLP"]),
            "r35_4qavg": float(row["R35_4qAVG"]),
            "channels": CHANNEL_NAMES,
        }

    def get_raw_sample(self, index: int) -> np.ndarray:
        """Full (201, 201, 4) array for one sample, read lazily from disk."""
        self.load()
        if index < 0 or index >= self._h5["matrix"].shape[0]:
            raise IndexError(f"Sample index {index} out of range")
        return self._h5["matrix"][index]

    def _read_raw_channel(self, index: int, channel: int) -> np.ndarray:
        self.load()
        if index < 0 or index >= self._h5["matrix"].shape[0]:
            raise IndexError(f"Sample index {index} out of range")
        return self._h5["matrix"][index, :, :, channel]

    def render_channel_png(self, index: int, channel: int) -> bytes:
        cache_path = CACHE_DIR / f"{index}_{channel}_{CACHE_VERSION}.png"
        if cache_path.exists():
            return cache_path.read_bytes()

        raw = self._read_raw_channel(index, channel)
        img = _normalize_channel(raw, channel)

        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        cache_path.write_bytes(data)
        return data


def _clip_scale(arr: np.ndarray, lo: float, hi: float, invert: bool = False) -> np.ndarray:
    scaled = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
    if invert:
        scaled = 1.0 - scaled
    return (scaled * 255).astype(np.uint8)


def _normalize_channel(raw: np.ndarray, channel: int) -> Image.Image:
    nan_mask = np.isnan(raw)

    if channel == 0:  # IR1: Kelvin, cold cloud tops rendered bright
        filled = np.nan_to_num(raw, nan=300.0)
        gray = _clip_scale(filled, 180.0, 300.0, invert=True)
    elif channel == 1:  # WV: Kelvin
        filled = np.nan_to_num(raw, nan=260.0)
        gray = _clip_scale(filled, 180.0, 260.0, invert=True)
    elif channel == 2:  # VIS: reflectance 0-1, NaN = nighttime
        filled = np.nan_to_num(raw, nan=0.0)
        gray = _clip_scale(filled, 0.0, 1.0)
        gray = np.where(nan_mask, np.uint8(40), gray)  # dark flat tone for "no data / night"
    else:  # PMW: rain-rate proxy mm/hr
        filled = np.nan_to_num(raw, nan=0.0)
        gray = _clip_scale(filled, 0.0, 18.0)

    return Image.fromarray(gray, mode="L")


tcir_service = TcirService()
