from datetime import datetime

from fastapi import APIRouter, Query

from app.services.era5_service import era5_service

router = APIRouter(prefix="/era5", tags=["era5"])


@router.get("/coverage")
def coverage():
    era5_service.load()
    return era5_service.coverage()


@router.get("/environment")
def environment(
    latitude: float = Query(...),
    longitude: float = Query(...),
    timestamp: datetime = Query(...),
):
    return era5_service.get_environment(latitude, longitude, timestamp)
