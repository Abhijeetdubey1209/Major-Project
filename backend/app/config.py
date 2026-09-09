"""Project paths and dataset discovery.

Resolves PROJECT_ROOT relative to this file (not a hardcoded absolute path),
so the project keeps working even if the folder is moved or renamed.
"""
from __future__ import annotations

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_ROOT = PROJECT_ROOT / "data"
DATABASE_DIR = PROJECT_ROOT / "database"
DATABASE_PATH = DATABASE_DIR / "cyclone.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH.as_posix()}"

CACHE_DIR = DATA_ROOT / "processed" / "tcir_png_cache"

TCIR_FILENAME = "TCIR-CPAC_IO_SH.h5"
IBTRACS_FILENAME = "ibtracs.NI.list.v04r01.csv"
ERA5_FILENAME = "data_stream-oper_stepType-instant.nc"

_EXPECTED_LOCATIONS = {
    "tcir": DATA_ROOT / "tcir" / TCIR_FILENAME,
    "ibtracs": DATA_ROOT / "ibtracs" / IBTRACS_FILENAME,
    "era5": DATA_ROOT / "era5" / ERA5_FILENAME,
}

_FILENAMES = {
    "tcir": TCIR_FILENAME,
    "ibtracs": IBTRACS_FILENAME,
    "era5": ERA5_FILENAME,
}


def _search_for(filename: str) -> Path | None:
    """Recursively search PROJECT_ROOT for a file by name (fallback path)."""
    for path in PROJECT_ROOT.rglob(filename):
        if path.is_file():
            return path
    return None


def locate_dataset(key: str) -> Path | None:
    """Return the path to a named dataset ('tcir', 'ibtracs', 'era5'), or None if missing."""
    expected = _EXPECTED_LOCATIONS[key]
    if expected.exists():
        return expected
    return _search_for(_FILENAMES[key])


def locate_all_datasets() -> dict[str, Path | None]:
    return {key: locate_dataset(key) for key in _EXPECTED_LOCATIONS}


if __name__ == "__main__":
    print("PROJECT_ROOT:", PROJECT_ROOT)
    print("FOUND DATASETS")
    for key, path in locate_all_datasets().items():
        status = str(path) if path else "NOT FOUND"
        print(f"  {key}: {status}")
