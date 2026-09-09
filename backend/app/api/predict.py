from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.risk_service import assess_risk
from app.services.track_forecast_service import track_forecast_service

router = APIRouter(prefix="/predict", tags=["predict"])


class RiskInput(BaseModel):
    latitude: float
    longitude: float
    wind_speed: float
    pressure: float
    sst: float


@router.post("")
def predict(payload: RiskInput):
    return assess_risk(
        payload.latitude,
        payload.longitude,
        payload.wind_speed,
        payload.pressure,
        payload.sst,
    )


@router.get("/track-forecast/model")
def track_forecast_model():
    return track_forecast_service.metadata()


@router.get("/track-forecast")
def track_forecast(
    latitude: float = Query(...),
    longitude: float = Query(...),
    storm_speed: float = Query(..., description="Current forward speed of the storm, in knots"),
    storm_direction: float = Query(..., description="Current compass bearing of motion, 0-360"),
    wind_speed: float = Query(..., description="Current sustained wind speed, in knots"),
    pressure: float | None = Query(None, description="Current central pressure, in hPa"),
    prev_storm_speed: float | None = Query(None, description="Forward speed one observation earlier, if known"),
    prev_storm_direction: float | None = Query(None, description="Compass bearing one observation earlier, if known"),
):
    return track_forecast_service.forecast(
        latitude,
        longitude,
        storm_speed,
        storm_direction,
        wind_speed,
        pressure,
        prev_storm_speed,
        prev_storm_direction,
    )
