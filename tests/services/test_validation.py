"""
Unit tests for MetricsService, GLORYSValidationService, and depth-stratified evaluation.
"""

import pytest
import numpy as np
from oceanembed.services.validation import (
    MetricsService,
    GLORYSValidationService,
    ARGOValidationService
)
from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


def test_compute_metrics_overall_and_depth_breakdown():
    # Synthetic target volume [15, 101, 241]
    target = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 20.0
    # Add depth profile: warmer surface (28°C) to colder deep (4°C)
    for i, d in enumerate(STANDARD_DEPTHS):
        target[i] = 28.0 - (24.0 * (d / 1000.0) ** 0.5)

    # Prediction with known offset +0.5°C
    predicted = target + 0.5
    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)
    mask[:10, :10] = 0.0  # land region

    metrics = MetricsService.compute_metrics(
        predicted=predicted,
        target=target,
        mask=mask,
        depths=STANDARD_DEPTHS
    )

    assert metrics["status"] == "validated"
    assert "overall" in metrics
    overall = metrics["overall"]
    assert np.isclose(overall["mae_c"], 0.5, atol=1e-3)
    assert np.isclose(overall["rmse_c"], 0.5, atol=1e-3)
    assert np.isclose(overall["bias_c"], 0.5, atol=1e-3)
    assert overall["accuracy_pct"] > 90.0

    # Check 15 depth breakdown
    assert len(metrics["depth_breakdown"]) == 15
    for row in metrics["depth_breakdown"]:
        assert "depth_m" in row
        assert "mae_c" in row
        assert "rmse_c" in row
        assert "accuracy_pct" in row
        assert np.isclose(row["mae_c"], 0.5, atol=1e-3)

    # Check sub-basins
    assert "Arabian Sea" in metrics["sub_basins"]
    assert "Bay of Bengal" in metrics["sub_basins"]
    assert "Equatorial Indian Ocean" in metrics["sub_basins"]


def test_glorys_validation_service():
    service = GLORYSValidationService()
    target = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 22.0
    pred = target + 0.3
    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)

    res = service.validate_reconstruction(pred, target, mask=mask)
    assert res["status"] == "validated"
    assert res["target_type"] == "GLORYS12V1 Global Reanalysis (Dense Target)"
    assert np.isclose(res["overall"]["rmse_c"], 0.3, atol=1e-3)


def test_argo_validation_service():
    service = ARGOValidationService()
    profiles = [
        {
            "wmo_id": "FLOAT_123",
            "lat": 12.5,
            "lon": 82.25,
            "temperature": [28.0] * 15,
            "model_profile": [28.2] * 15
        }
    ]
    res = service.validate_against_argo_profiles(np.zeros((15, 10, 10)), profiles)
    assert res["status"] == "validated"
    assert res["total_argo_floats"] == 1
    assert np.isclose(res["overall_rmse_c"], 0.2, atol=1e-3)
