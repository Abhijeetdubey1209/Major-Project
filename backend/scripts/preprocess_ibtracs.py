"""Clean the IBTrACS CSV and load it into the cyclones / track_points tables.

Pipeline (see plan for rationale):
1. Read CSV, skipping the units row.
2. Filter to BASIN == 'NI' (the file is not purely North Indian Ocean despite its name).
3. Coerce numeric columns (missing values are the literal string ' ', not empty).
4. wind_speed = WMO_WIND, falling back to USA_WIND. Same for pressure.
5. Parse ISO_TIME to a real timestamp.
6. Preserve raw longitude, add a normalized -180..180 display longitude.
7. Drop rows outside a sane North Indian Ocean bounding box -- the BASIN=='NI' label
   alone isn't reliable (e.g. SID 1932244N19296 is labeled 'NI' but its recorded
   positions track through the high-40s-to-80s latitude range near Scandinavia, an
   obvious historical data error, not a real North Indian Ocean cyclone).
8. Drop rows with an invalid SID/timestamp/lat/lon.
9. Aggregate per SID into `cyclones`; keep every point in `track_points`.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from app.config import locate_dataset
from app.utils.geo import normalize_longitude, track_distance_km

NUMERIC_COLUMNS = [
    "LAT",
    "LON",
    "WMO_WIND",
    "WMO_PRES",
    "USA_WIND",
    "USA_PRES",
    "STORM_SPEED",
    "STORM_DIR",
]

# Generous North Indian Ocean envelope (Bay of Bengal + Arabian Sea, with margin).
# Rows outside this box are data errors, not real NI-basin storms -- see module docstring.
NI_LAT_RANGE = (-5.0, 35.0)
NI_LON_RANGE = (30.0, 110.0)


def load_clean_ibtracs() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (cyclones_df, track_points_df)."""
    path = locate_dataset("ibtracs")
    if path is None:
        raise FileNotFoundError("IBTrACS CSV not found under data/ibtracs/")

    df = pd.read_csv(path, skiprows=[1], low_memory=False)

    df = df[df["BASIN"] == "NI"].copy()

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["wind_speed"] = df["WMO_WIND"].fillna(df["USA_WIND"])
    df["wind_source"] = df["WMO_WIND"].notna().map({True: "WMO", False: None})
    df.loc[df["wind_source"].isna() & df["USA_WIND"].notna(), "wind_source"] = "USA"

    df["pressure"] = df["WMO_PRES"].fillna(df["USA_PRES"])

    df["timestamp"] = pd.to_datetime(df["ISO_TIME"], errors="coerce")

    df["longitude_raw"] = df["LON"]
    df["longitude"] = df["LON"].apply(
        lambda lon: normalize_longitude(lon) if pd.notna(lon) else lon
    )
    df["latitude"] = df["LAT"]

    in_bounds = df["latitude"].between(*NI_LAT_RANGE) & df["longitude"].between(*NI_LON_RANGE)
    dropped = len(df) - int(in_bounds.sum())
    if dropped:
        print(f"Dropping {dropped} row(s) outside the North Indian Ocean bounding box (likely data errors).")
    df = df[in_bounds]

    df = df.dropna(subset=["SID", "timestamp", "latitude", "longitude"])
    df = df.sort_values(["SID", "timestamp"])

    track_points = df[
        [
            "SID",
            "timestamp",
            "latitude",
            "longitude",
            "longitude_raw",
            "wind_speed",
            "wind_source",
            "pressure",
            "STORM_SPEED",
            "STORM_DIR",
        ]
    ].rename(
        columns={
            "SID": "sid",
            "STORM_SPEED": "storm_speed",
            "STORM_DIR": "storm_direction",
        }
    )

    cyclone_rows = []
    for sid, group in df.groupby("SID", sort=False):
        group = group.sort_values("timestamp")
        points = list(zip(group["latitude"], group["longitude"]))
        name = group["NAME"].dropna().iloc[0] if group["NAME"].notna().any() else None
        cyclone_rows.append(
            {
                "sid": sid,
                "name": None if name in (None, "NOT_NAMED") else name,
                "season": (
                    int(group["SEASON"].iloc[0])
                    if pd.notna(group["SEASON"].iloc[0])
                    else None
                ),
                "basin": group["BASIN"].iloc[0],
                "subbasin": group["SUBBASIN"].iloc[0] if "SUBBASIN" in group else None,
                "start_time": group["timestamp"].min(),
                "end_time": group["timestamp"].max(),
                "max_wind": group["wind_speed"].max(),
                "min_pressure": group["pressure"].min(),
                "track_points_count": len(group),
                "track_length_km": track_distance_km(points) if len(points) > 1 else 0.0,
            }
        )

    cyclones = pd.DataFrame(cyclone_rows)
    return cyclones, track_points


if __name__ == "__main__":
    cyclones_df, track_points_df = load_clean_ibtracs()
    print(f"Cyclones: {len(cyclones_df)}")
    print(f"Track points: {len(track_points_df)}")
    print(f"Seasons: {cyclones_df['season'].min()} - {cyclones_df['season'].max()}")
    print(f"Max wind observed: {cyclones_df['max_wind'].max()}")
    print(f"Min pressure observed: {cyclones_df['min_pressure'].min()}")
