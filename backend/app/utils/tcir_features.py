"""Shared TCIR feature computation, used identically by the offline feature-extraction
script and the live prediction service so training and inference features never drift
apart. Operates on a batch dimension (batch, 201, 201) -- a single sample is just a
batch of size 1.
"""
from __future__ import annotations

import warnings

import numpy as np

CENTER_RADIUS = 20  # samples are storm-centered 201x201; a 40x40 core around the eye/eyewall
CHANNEL_NAMES = ["ir1", "wv", "vis", "pmw"]


def channel_stats(channel_data: np.ndarray, prefix: str) -> dict[str, np.ndarray]:
    """channel_data shape: (batch, 201, 201). Returns dict of per-sample stat arrays.

    Includes whole-image stats, a center-crop (the storm core/eye region, since TCIR
    samples are storm-centered), and a gradient-magnitude texture measure -- these carry
    Dvorak-technique-style intensity signal (cold overshooting cloud tops / eye warmth
    near the center) that plain whole-image means/percentiles wash out.
    """
    valid_counts = np.sum(~np.isnan(channel_data), axis=(1, 2))
    c = channel_data.shape[1] // 2
    center = channel_data[:, c - CENTER_RADIUS : c + CENTER_RADIUS, c - CENTER_RADIUS : c + CENTER_RADIUS]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        mean = np.nanmean(channel_data, axis=(1, 2))
        std = np.nanstd(channel_data, axis=(1, 2))
        mn = np.nanmin(channel_data, axis=(1, 2))
        mx = np.nanmax(channel_data, axis=(1, 2))
        p10 = np.nanpercentile(channel_data, 10, axis=(1, 2))
        p50 = np.nanpercentile(channel_data, 50, axis=(1, 2))
        p90 = np.nanpercentile(channel_data, 90, axis=(1, 2))

        center_mean = np.nanmean(center, axis=(1, 2))
        center_min = np.nanmin(center, axis=(1, 2))
        center_max = np.nanmax(center, axis=(1, 2))

        gy, gx = np.gradient(np.nan_to_num(channel_data, nan=np.nanmean(channel_data)), axis=(1, 2))
        gradient_mean = np.nanmean(np.hypot(gy, gx), axis=(1, 2))

    return {
        f"{prefix}_mean": mean,
        f"{prefix}_std": std,
        f"{prefix}_min": mn,
        f"{prefix}_max": mx,
        f"{prefix}_p10": p10,
        f"{prefix}_p50": p50,
        f"{prefix}_p90": p90,
        f"{prefix}_center_mean": center_mean,
        f"{prefix}_center_min": center_min,
        f"{prefix}_center_max": center_max,
        f"{prefix}_center_minus_outer": center_mean - mean,
        f"{prefix}_gradient_mean": gradient_mean,
        f"{prefix}_available": (valid_counts > 0).astype(int),
    }


def sample_features(sample: np.ndarray) -> dict[str, float]:
    """sample: (201, 201, 4) single TCIR sample. Returns a flat scalar feature dict."""
    features: dict[str, float] = {}
    for c, name in enumerate(CHANNEL_NAMES):
        batch = sample[np.newaxis, :, :, c]  # (1, 201, 201)
        for key, arr in channel_stats(batch, name).items():
            features[key] = float(arr[0])
    return features
