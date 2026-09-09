"""Loads the trained TCIR Vmax regressor and serves live predictions.

Computes features for a single sample on demand using the exact same
`app.utils.tcir_features` functions used at training time, so inference never drifts
from training.
"""
from __future__ import annotations

import json

import joblib
import pandas as pd

from app.config import DATA_ROOT
from app.services.tcir_service import tcir_service
from app.utils.tcir_features import sample_features

MODEL_PATH = DATA_ROOT / "models" / "vmax_model.joblib"
METADATA_PATH = DATA_ROOT / "models" / "model_metadata.json"


class IntensityService:
    def __init__(self) -> None:
        self._model = None
        self._metadata: dict | None = None

    @property
    def available(self) -> bool:
        return MODEL_PATH.exists() and METADATA_PATH.exists()

    def load(self) -> None:
        if not self.available or self._model is not None:
            return
        self._model = joblib.load(MODEL_PATH)
        self._metadata = json.loads(METADATA_PATH.read_text())

    def metadata(self) -> dict:
        if not self.available:
            return {"available": False}
        self.load()
        return {"available": True, **self._metadata}

    def predict(self, index: int) -> dict:
        if not self.available:
            return {
                "available": False,
                "reason": "Model not trained yet. Run backend/scripts/train_intensity_model.py.",
            }
        self.load()

        tcir_service.load()
        meta = tcir_service.get_sample_metadata(index)
        sample = tcir_service.get_raw_sample(index)

        features = sample_features(sample)
        row = pd.DataFrame([{col: features.get(col) for col in self._metadata["feature_columns"]}])
        # lat/lon/dataset one-hots come from metadata, not image stats
        row["lat"] = meta["lat"]
        row["lon"] = meta["lon"]
        for ds in ("CPAC", "IO", "SH"):
            row[f"dataset_{ds}"] = 1 if meta["dataset"] == ds else 0

        predicted_vmax = float(self._model.predict(row[self._metadata["feature_columns"]])[0])
        actual_vmax = meta["vmax"]

        return {
            "available": True,
            "index": index,
            "predicted_vmax": round(predicted_vmax, 1),
            "actual_vmax": actual_vmax,
            "error": round(abs(predicted_vmax - actual_vmax), 1),
            "model_type": self._metadata["model_type"],
            "test_mae": self._metadata["test_metrics"]["mae"],
            "test_r2": self._metadata["test_metrics"]["r2"],
            "trained_at": self._metadata["trained_at"],
        }


intensity_service = IntensityService()
