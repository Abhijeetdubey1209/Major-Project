"""Prints the resolved location of each expected dataset (Phase 1 requirement)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import locate_all_datasets  # noqa: E402

if __name__ == "__main__":
    print("FOUND DATASETS")
    print()
    for key, path in locate_all_datasets().items():
        if path:
            size_gb = path.stat().st_size / (1024**3)
            print(f"{key.upper()}:")
            print(f"  path: {path}")
            print(f"  size: {size_gb:.2f} GB")
        else:
            print(f"{key.upper()}: NOT FOUND")
        print()
