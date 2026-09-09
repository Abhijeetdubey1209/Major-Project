"""Creates the SQLite schema and populates it from the cleaned IBTrACS data."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import engine  # noqa: E402
from app.models import Base, Cyclone, TrackPoint  # noqa: E402
from preprocess_ibtracs import load_clean_ibtracs  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402


def build() -> None:
    print("Creating tables...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    print("Loading and cleaning IBTrACS...")
    cyclones_df, track_points_df = load_clean_ibtracs()

    with Session(engine) as session:
        print(f"Inserting {len(cyclones_df)} cyclones...")
        session.bulk_insert_mappings(Cyclone, cyclones_df.to_dict(orient="records"))
        session.commit()

        print(f"Inserting {len(track_points_df)} track points...")
        records = track_points_df.to_dict(orient="records")
        batch_size = 5000
        for i in range(0, len(records), batch_size):
            session.bulk_insert_mappings(TrackPoint, records[i : i + batch_size])
            session.commit()

    print()
    print("DATABASE BUILD COMPLETE")
    print(f"  cyclones: {len(cyclones_df)}")
    print(f"  track_points: {len(track_points_df)}")
    print(f"  seasons: {int(cyclones_df['season'].min())}-{int(cyclones_df['season'].max())}")
    print(f"  max_wind observed: {cyclones_df['max_wind'].max()}")
    print(f"  min_pressure observed: {cyclones_df['min_pressure'].min()}")


if __name__ == "__main__":
    build()
