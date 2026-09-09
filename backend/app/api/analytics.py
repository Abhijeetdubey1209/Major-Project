from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import ibtracs_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return ibtracs_service.analytics_overview(db)


@router.get("/yearly")
def yearly(db: Session = Depends(get_db)):
    return ibtracs_service.analytics_yearly(db)


@router.get("/basins")
def basins(db: Session = Depends(get_db)):
    return ibtracs_service.analytics_basins(db)


@router.get("/wind-distribution")
def wind_distribution(db: Session = Depends(get_db)):
    return ibtracs_service.analytics_wind_distribution(db)


@router.get("/pressure-distribution")
def pressure_distribution(db: Session = Depends(get_db)):
    return ibtracs_service.analytics_pressure_distribution(db)


@router.get("/strongest-cyclones")
def strongest_cyclones(limit: int = 10, db: Session = Depends(get_db)):
    rows = ibtracs_service.strongest_cyclones(db, limit)
    return [
        {
            "sid": c.sid,
            "name": c.name,
            "season": c.season,
            "max_wind": c.max_wind,
            "min_pressure": c.min_pressure,
        }
        for c in rows
    ]
