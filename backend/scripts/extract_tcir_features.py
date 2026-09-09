"""Streams through the TCIR HDF5 matrix in batches and extracts per-channel summary
statistics for each sample, saving the result as a small parquet feature table.

This is the only way to make TCIR (23118 x 201 x 201 x 4 float32, ~14GB) usable for
model training on a machine with limited RAM: only one batch (a few hundred rows) is
ever held in memory at a time, never the full matrix.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import h5py
import pandas as pd

from app.config import DATA_ROOT, locate_dataset
from app.utils.tcir_features import CHANNEL_NAMES, channel_stats as _channel_stats

BATCH_SIZE = 512
OUTPUT_PATH = DATA_ROOT / "processed" / "tcir_features.parquet"


def extract() -> pd.DataFrame:
    path = locate_dataset("tcir")
    if path is None:
        raise FileNotFoundError("TCIR dataset not found under data/tcir/")

    info = pd.read_hdf(path, key="info")
    n = len(info)
    print(f"Extracting features for {n} samples in batches of {BATCH_SIZE}...")

    rows: list[dict] = []
    with h5py.File(path, "r") as f:
        matrix = f["matrix"]
        for start in range(0, n, BATCH_SIZE):
            end = min(start + BATCH_SIZE, n)
            batch = matrix[start:end]  # (b, 201, 201, 4)

            batch_stats = {}
            for c, name in enumerate(CHANNEL_NAMES):
                batch_stats.update(_channel_stats(batch[:, :, :, c], name))

            for i in range(end - start):
                row = {key: values[i] for key, values in batch_stats.items()}
                row["index"] = start + i
                rows.append(row)

            if (start // BATCH_SIZE) % 10 == 0:
                print(f"  {end}/{n}")

    features = pd.DataFrame(rows).set_index("index")
    result = info.join(features)
    result = pd.concat([result, pd.get_dummies(result["data_set"], prefix="dataset")], axis=1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result.to_parquet(OUTPUT_PATH)
    print(f"\nSaved {len(result)} rows x {len(result.columns)} columns to {OUTPUT_PATH}")
    return result


if __name__ == "__main__":
    extract()
