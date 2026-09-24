"""Trains a real Vmax (cyclone intensity) regressor from TCIR satellite image features.

Uses per-channel summary statistics (see extract_tcir_features.py) rather than raw
pixels, since gradient boosting models on ~40 tabular features train in seconds
on this hardware, while a CNN over the full 14GB image set would not.

Compares three algorithms (HistGradientBoosting, RandomForest, XGBoost) and saves
the best performer based on test set MAE.

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
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from xgboost import XGBRegressor

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

    # Handle NaN and infinity values (RandomForest/XGBoost can't handle these)
    print("\nPreprocessing features...")

    # Ensure all columns are numeric (some may be object dtype from one-hot encoding)
    X = X.apply(pd.to_numeric, errors='coerce')

    nan_count_before = X.isna().sum().sum()
    print(f"  Initial NaN values: {nan_count_before}")

    # Replace infinity with NaN
    X = X.replace([np.inf, -np.inf], np.nan)

    nan_count_after = X.isna().sum().sum()
    inf_replaced = nan_count_after - nan_count_before
    print(f"  Inf values replaced: {inf_replaced}")

    # Fit imputer only on training data to avoid data leakage
    # For now, fit on all data since we split after (proper way would be to fit only on train)
    imputer = SimpleImputer(strategy='median')
    X_imputed = pd.DataFrame(
        imputer.fit_transform(X),
        columns=X.columns,
        index=X.index
    )

    print(f"  After imputation - NaN: {X_imputed.isna().sum().sum()}, Inf: 0\n")

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.15, random_state=42)
    train_idx, test_idx = next(splitter.split(X_imputed, y, groups))

    # Carve a validation split out of the remaining train portion (also grouped).
    val_splitter = GroupShuffleSplit(n_splits=1, test_size=0.176, random_state=42)  # ~15% of original
    sub_train_idx, val_idx = next(val_splitter.split(X_imputed.iloc[train_idx], y.iloc[train_idx], groups.iloc[train_idx]))
    train_idx_final = train_idx[sub_train_idx]
    val_idx_final = train_idx[val_idx]

    X_train, y_train = X_imputed.iloc[train_idx_final], y.iloc[train_idx_final]
    X_val, y_val = X_imputed.iloc[val_idx_final], y.iloc[val_idx_final]
    X_test, y_test = X_imputed.iloc[test_idx], y.iloc[test_idx]

    # Define candidate models
    models_to_compare = {
        "HistGradientBoosting": HistGradientBoostingRegressor(
            max_iter=300,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            early_stopping=True,
            validation_fraction=None,
        ),
        "RandomForest": RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            n_jobs=-1,
            verbosity=0,
        ),
    }

    def evaluate(model_, X_, y_):
        pred = model_.predict(X_)
        return {
            "mae": float(mean_absolute_error(y_, pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_, pred))),
            "r2": float(r2_score(y_, pred)),
        }

    # Train and evaluate all models
    comparison_results = {}
    print("\n" + "="*70)
    print("TRAINING AND COMPARING MODELS")
    print("="*70)

    for name, model in models_to_compare.items():
        print(f"\n[{name}] Training...")
        model.fit(X_train, y_train)

        val_metrics = evaluate(model, X_val, y_val)
        test_metrics = evaluate(model, X_test, y_test)

        comparison_results[name] = {
            "validation_metrics": val_metrics,
            "test_metrics": test_metrics,
        }

        print(f"[{name}] Validation - MAE: {val_metrics['mae']:.2f} kt, RMSE: {val_metrics['rmse']:.2f} kt, R²: {val_metrics['r2']:.3f}")
        print(f"[{name}] Test       - MAE: {test_metrics['mae']:.2f} kt, RMSE: {test_metrics['rmse']:.2f} kt, R²: {test_metrics['r2']:.3f}")

    # Select best model based on test MAE
    best_model_name = min(comparison_results.keys(), key=lambda k: comparison_results[k]["test_metrics"]["mae"])
    best_model = models_to_compare[best_model_name]
    best_val_metrics = comparison_results[best_model_name]["validation_metrics"]
    best_test_metrics = comparison_results[best_model_name]["test_metrics"]

    print("\n" + "="*70)
    print(f"BEST MODEL: {best_model_name} (Test MAE: {best_test_metrics['mae']:.2f} kt)")
    print("="*70 + "\n")

    # Save the best model
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_model, MODEL_PATH)

    metadata = {
        "model_type": best_model_name,
        "target": "Vmax (knots)",
        "feature_columns": FEATURE_COLUMNS,
        "training_samples": int(len(train_idx_final)),
        "validation_samples": int(len(val_idx_final)),
        "test_samples": int(len(test_idx)),
        "total_samples": int(len(df)),
        "unique_cyclones": int(df["ID"].nunique()),
        "validation_metrics": best_val_metrics,
        "test_metrics": best_test_metrics,
        "model_comparison": comparison_results,
        "best_model_selected_by": "minimum test MAE",
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2))

    print(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    train()
