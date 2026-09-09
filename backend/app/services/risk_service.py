"""Transparent, rule-based cyclone risk scoring.

This is intentionally NOT a trained ML model: the datasets available (TCIR imagery,
IBTrACS tracks, ERA5 May-Dec 2010 over a limited box) do not overlap enough to train
a reliable supervised model relating environmental conditions to cyclone intensity.
Instead this applies well-known meteorological rules of thumb, documented below, and
reports which specific factors drove the score. Inputs are assumed to be:
  wind_speed  - sustained wind speed in knots (IBTrACS convention)
  pressure    - sea-level pressure in hPa
  sst         - sea surface temperature in Celsius
"""
from __future__ import annotations


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def assess_risk(latitude: float, longitude: float, wind_speed: float, pressure: float, sst: float) -> dict:
    explanation: list[str] = []

    # Sea surface temperature: ~26.5C is the classical cyclogenesis threshold.
    sst_score = _clamp((sst - 24.0) / (31.0 - 24.0) * 100)
    if sst >= 26.5:
        explanation.append(
            f"Sea surface temperature ({sst:.1f}°C) is above the ~26.5°C cyclogenesis threshold."
        )

    # Pressure: lower sea-level pressure indicates a more developed low-pressure system.
    pressure_score = _clamp((1013.0 - pressure) / (1013.0 - 900.0) * 100)
    if pressure < 1000.0:
        explanation.append(
            f"Atmospheric pressure ({pressure:.1f} hPa) is notably low, consistent with an intensifying system."
        )

    # Wind: scaled against the Saffir-Simpson range (~137kt = Category 5).
    wind_score = _clamp(wind_speed / 137.0 * 100)
    if wind_speed >= 34.0:
        explanation.append(
            f"Sustained wind speed ({wind_speed:.1f} kt) meets tropical storm strength or greater."
        )

    overall = 0.35 * sst_score + 0.35 * pressure_score + 0.30 * wind_score

    if overall < 25:
        level = "Low"
    elif overall < 50:
        level = "Moderate"
    elif overall < 75:
        level = "High"
    else:
        level = "Extreme"

    if not explanation:
        explanation.append(
            "Conditions do not show strong indicators for cyclone risk based on the provided inputs."
        )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "risk_score": round(overall, 1),
        "risk_level": level,
        "explanation": explanation,
        "factors": {
            "sst_score": round(sst_score, 1),
            "pressure_score": round(pressure_score, 1),
            "wind_score": round(wind_score, 1),
        },
    }
