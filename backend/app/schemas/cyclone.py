from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CycloneSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sid: str
    name: str | None
    season: int | None
    basin: str | None
    subbasin: str | None
    start_time: datetime | None
    end_time: datetime | None
    max_wind: float | None
    min_pressure: float | None
    track_points_count: int
    track_length_km: float | None


class CycloneList(BaseModel):
    items: list[CycloneSummary]
    total: int
    page: int
    limit: int


class TrackPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    latitude: float
    longitude: float
    longitude_raw: float
    wind_speed: float | None
    wind_source: str | None
    pressure: float | None
    storm_speed: float | None
    storm_direction: float | None


class CycloneDetail(CycloneSummary):
    track: list[TrackPoint]
