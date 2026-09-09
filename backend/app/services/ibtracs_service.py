from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Cyclone, TrackPoint


def list_cyclones(
    db: Session,
    page: int = 1,
    limit: int = 25,
    search: str | None = None,
    season: int | None = None,
    basin: str | None = None,
    min_wind: float | None = None,
    max_wind: float | None = None,
) -> tuple[list[Cyclone], int]:
    query = db.query(Cyclone)

    if search:
        like = f"%{search}%"
        query = query.filter((Cyclone.name.ilike(like)) | (Cyclone.sid.ilike(like)))
    if season is not None:
        query = query.filter(Cyclone.season == season)
    if basin is not None:
        query = query.filter(Cyclone.basin == basin)
    if min_wind is not None:
        query = query.filter(Cyclone.max_wind >= min_wind)
    if max_wind is not None:
        query = query.filter(Cyclone.max_wind <= max_wind)

    total = query.count()
    items = (
        query.order_by(Cyclone.start_time.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return items, total


def get_cyclone(db: Session, sid: str) -> Cyclone | None:
    return db.query(Cyclone).filter(Cyclone.sid == sid).first()


def get_track(db: Session, sid: str) -> list[TrackPoint]:
    return (
        db.query(TrackPoint)
        .filter(TrackPoint.sid == sid)
        .order_by(TrackPoint.timestamp)
        .all()
    )


def analytics_overview(db: Session) -> dict:
    total_cyclones = db.query(func.count(Cyclone.id)).scalar()
    total_points = db.query(func.count(TrackPoint.id)).scalar()
    max_wind = db.query(func.max(Cyclone.max_wind)).scalar()
    min_pressure = db.query(func.min(Cyclone.min_pressure)).scalar()
    avg_wind = db.query(func.avg(Cyclone.max_wind)).scalar()
    year_min = db.query(func.min(Cyclone.season)).scalar()
    year_max = db.query(func.max(Cyclone.season)).scalar()

    basins = (
        db.query(Cyclone.basin, func.count(Cyclone.id))
        .group_by(Cyclone.basin)
        .all()
    )

    return {
        "total_cyclones": total_cyclones,
        "total_track_points": total_points,
        "max_wind_recorded": max_wind,
        "min_pressure_recorded": min_pressure,
        "average_max_wind": round(avg_wind, 1) if avg_wind else None,
        "season_range": [year_min, year_max],
        "basins": {b: c for b, c in basins},
    }


def analytics_yearly(db: Session) -> list[dict]:
    rows = (
        db.query(Cyclone.season, func.count(Cyclone.id))
        .group_by(Cyclone.season)
        .order_by(Cyclone.season)
        .all()
    )
    return [{"season": s, "count": c} for s, c in rows if s is not None]


def analytics_basins(db: Session) -> list[dict]:
    rows = (
        db.query(Cyclone.basin, func.count(Cyclone.id))
        .group_by(Cyclone.basin)
        .all()
    )
    return [{"basin": b, "count": c} for b, c in rows]


def analytics_wind_distribution(db: Session, bucket_size: float = 10.0) -> list[dict]:
    rows = db.query(Cyclone.max_wind).filter(Cyclone.max_wind.isnot(None)).all()
    buckets: dict[int, int] = {}
    for (wind,) in rows:
        bucket = int(wind // bucket_size) * int(bucket_size)
        buckets[bucket] = buckets.get(bucket, 0) + 1
    return [
        {"bucket_start": k, "count": v} for k, v in sorted(buckets.items())
    ]


def analytics_pressure_distribution(db: Session, bucket_size: float = 10.0) -> list[dict]:
    rows = db.query(Cyclone.min_pressure).filter(Cyclone.min_pressure.isnot(None)).all()
    buckets: dict[int, int] = {}
    for (pressure,) in rows:
        bucket = int(pressure // bucket_size) * int(bucket_size)
        buckets[bucket] = buckets.get(bucket, 0) + 1
    return [
        {"bucket_start": k, "count": v} for k, v in sorted(buckets.items())
    ]


def list_tracks(
    db: Session,
    season: int | None = None,
    basin: str | None = None,
    min_wind: float | None = None,
    limit: int = 200,
    max_points_per_track: int = 40,
) -> list[dict]:
    """Lightweight, decimated tracks for rendering many cyclones on one map at once."""
    query = db.query(Cyclone)
    if season is not None:
        query = query.filter(Cyclone.season == season)
    if basin is not None:
        query = query.filter(Cyclone.basin == basin)
    if min_wind is not None:
        query = query.filter(Cyclone.max_wind >= min_wind)

    cyclones = query.order_by(Cyclone.max_wind.desc().nullslast()).limit(limit).all()

    results = []
    for cyclone in cyclones:
        points = (
            db.query(TrackPoint.latitude, TrackPoint.longitude)
            .filter(TrackPoint.sid == cyclone.sid)
            .order_by(TrackPoint.timestamp)
            .all()
        )
        if not points:
            continue
        step = max(1, len(points) // max_points_per_track)
        decimated = points[::step]
        results.append(
            {
                "sid": cyclone.sid,
                "name": cyclone.name,
                "season": cyclone.season,
                "max_wind": cyclone.max_wind,
                "points": [[p.latitude, p.longitude] for p in decimated],
            }
        )
    return results


def strongest_cyclones(db: Session, limit: int = 10) -> list[Cyclone]:
    return (
        db.query(Cyclone)
        .filter(Cyclone.max_wind.isnot(None))
        .order_by(Cyclone.max_wind.desc())
        .limit(limit)
        .all()
    )
