from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Cyclone(Base):
    __tablename__ = "cyclones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sid: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    season: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    basin: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    subbasin: Mapped[str | None] = mapped_column(String, nullable=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_wind: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    track_points_count: Mapped[int] = mapped_column(Integer, default=0)
    track_length_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    track_points: Mapped[list["TrackPoint"]] = relationship(
        back_populates="cyclone", cascade="all, delete-orphan"
    )


class TrackPoint(Base):
    __tablename__ = "track_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sid: Mapped[str] = mapped_column(String, ForeignKey("cyclones.sid"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    longitude_raw: Mapped[float] = mapped_column(Float)
    wind_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_source: Mapped[str | None] = mapped_column(String, nullable=True)
    pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    storm_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    storm_direction: Mapped[float | None] = mapped_column(Float, nullable=True)

    cyclone: Mapped["Cyclone"] = relationship(back_populates="track_points")


Index("ix_track_points_sid_timestamp", TrackPoint.sid, TrackPoint.timestamp)
