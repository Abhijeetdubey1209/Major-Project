"""Geospatial helper functions."""
from __future__ import annotations

import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometers."""
    r = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def normalize_longitude(lon: float) -> float:
    """Map any longitude convention (e.g. 0-360) to the -180..180 display range."""
    return ((lon + 180.0) % 360.0) - 180.0


def track_distance_km(points: list[tuple[float, float]]) -> float:
    """Total distance along an ordered list of (lat, lon) points."""
    total = 0.0
    for (lat1, lon1), (lat2, lon2) in zip(points, points[1:]):
        total += haversine_km(lat1, lon1, lat2, lon2)
    return total


def wind_direction_met(u: float, v: float) -> float:
    """Meteorological wind direction (degrees the wind is blowing FROM), 0-360."""
    return (math.degrees(math.atan2(-u, -v))) % 360.0


def destination_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> tuple[float, float]:
    """Given a start point, a bearing (degrees clockwise from north), and a distance,
    returns the destination (lat, lon) along the great circle."""
    r = 6371.0088
    delta = distance_km / r
    theta = math.radians(bearing_deg)
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)

    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )
    return math.degrees(phi2), normalize_longitude(math.degrees(lambda2))


def bearing_diff_deg(a: float, b: float) -> float:
    """Smallest signed difference a-b between two compass bearings, in (-180, 180]."""
    return ((a - b + 180.0) % 360.0) - 180.0
