from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.cyclone import CycloneDetail, CycloneList
from app.services import ibtracs_service

router = APIRouter(prefix="/cyclones", tags=["cyclones"])


@router.get("", response_model=CycloneList)
def list_cyclones(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    search: str | None = None,
    season: int | None = None,
    basin: str | None = None,
    min_wind: float | None = None,
    max_wind: float | None = None,
    db: Session = Depends(get_db),
):
    items, total = ibtracs_service.list_cyclones(
        db, page, limit, search, season, basin, min_wind, max_wind
    )
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/tracks")
def list_tracks(
    season: int | None = None,
    basin: str | None = None,
    min_wind: float | None = None,
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return ibtracs_service.list_tracks(db, season, basin, min_wind, limit)


@router.get("/{sid}", response_model=CycloneDetail)
def get_cyclone(sid: str, db: Session = Depends(get_db)):
    cyclone = ibtracs_service.get_cyclone(db, sid)
    if cyclone is None:
        raise HTTPException(status_code=404, detail="Cyclone not found")
    track = ibtracs_service.get_track(db, sid)
    data = {**cyclone.__dict__, "track": track}
    return data


@router.get("/{sid}/track")
def get_track(sid: str, db: Session = Depends(get_db)):
    cyclone = ibtracs_service.get_cyclone(db, sid)
    if cyclone is None:
        raise HTTPException(status_code=404, detail="Cyclone not found")
    track = ibtracs_service.get_track(db, sid)
    return [
        {
            "timestamp": t.timestamp,
            "latitude": t.latitude,
            "longitude": t.longitude,
            "wind_speed": t.wind_speed,
            "pressure": t.pressure,
        }
        for t in track
    ]
