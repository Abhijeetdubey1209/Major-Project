"""Trains a real Vmax (cyclone intensity) regressor from TCIR satellite image features.

Uses per-channel summary statistics (see extract_tcir_features.py) rather than raw
pixels, since HistGradientBoostingRegressor on ~40 tabular features trains in seconds
on this hardware, while a CNN over the full 14GB image set would not.

Splits by cyclone ID (GroupShuffleSplit), not by row, so consecutive frames of the same
storm never leak between train and test.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit

from app.config import DATA_ROOT

FEATURES_PATH = DATA_ROOT / "processed" / "tcir_features.parquet"
MODEL_DIR = DATA_ROOT / "models"
MODEL_PATH = MODEL_DIR / "vmax_model.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

FEATURE_COLUMNS = [
    "lat",
    "lon",
    "dataset_CPAC",
    "dataset_IO",
    "dataset_SH",
] + [
    f"{ch}_{stat}"
    for ch in ("ir1", "wv", "vis", "pmw")
    for stat in (
        "mean",
        "std",
        "min",
        "max",
        "p10",
        "p50",
        "p90",
        "center_mean",
        "center_min",
        "center_max",
        "center_minus_outer",
        "gradient_mean",
        "available",
    )
]


def train() -> dict:
    df = pd.read_parquet(FEATURES_PATH)

    X = df[FEATURE_COLUMNS]
    y = df["Vmax"]
    groups = df["ID"]

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups))

    # Carve a validation split out of the remaining train portion (also grouped).
    val_splitter = GroupShuffleSplit(n_splits=1, test_size=0.176, random_state=42)  # ~15% of original
    sub_train_idx, val_idx = next(val_splitter.split(X.iloc[train_idx], y.iloc[train_idx], groups.iloc[train_idx]))
    train_idx_final = train_idx[sub_train_idx]
    val_idx_final = train_idx[val_idx]

    model = HistGradientBoostingRegressor(
        max_iter=300,
        learning_rate=0.05,
        max_depth=6,
        random_state=42,
        early_stopping=True,
        validation_fraction=None,
    )

    X_train, y_train = X.iloc[train_idx_final], y.iloc[train_idx_final]
    X_val, y_val = X.iloc[val_idx_final], y.iloc[val_idx_final]
    X_test, y_test = X.iloc[test_idx], y.iloc[test_idx]

    model.fit(X_train, y_train)

    def evaluate(X_, y_):
        pred = model.predict(X_)
        return {
            "mae": float(mean_absolute_error(y_, pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_, pred))),
            "r2": float(r2_score(y_, pred)),
        }

    val_metrics = evaluate(X_val, y_val)
    test_metrics = evaluate(X_test, y_test)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metadata = {
        "model_type": "HistGradientBoostingRegressor",
        "target": "Vmax (knots)",
        "feature_columns": FEATURE_COLUMNS,
        "training_samples": int(len(train_idx_final)),
        "validation_samples": int(len(val_idx_final)),
        "test_samples": int(len(test_idx)),
        "total_samples": int(len(df)),
        "unique_cyclones": int(df["ID"].nunique()),
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))

    print(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    train()
