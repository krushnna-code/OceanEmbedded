"""
Unit tests for AnomalyDetectionService, Hobday MHW classification, UncertaintyService, and ARGOValidationService.
"""

import pytest
import numpy as np
from oceanembed.services.anomaly import (
    AnomalyDetectionService,
    UncertaintyService,
    ARGOValidationService
)
from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


def test_compute_climatological_anomaly_2d():
    service = AnomalyDetectionService()
    temp = np.ones((GRID_H, GRID_W), dtype=np.float32) * 28.5
    clim = np.ones((GRID_H, GRID_W), dtype=np.float32) * 27.0
    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)
    mask[0, 0] = 0.0  # land point

    anomaly = service.compute_climatological_anomaly(temp, clim, mask=mask)
    assert anomaly.shape == (GRID_H, GRID_W)
    assert np.isnan(anomaly[0, 0]), "Land cell should be NaN"
    assert np.isclose(anomaly[1, 1], 1.5), "Ocean anomaly should be 1.5°C"


def test_compute_climatological_anomaly_3d():
    service = AnomalyDetectionService()
    temp = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 25.0
    clim = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 24.0
    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)

    anomaly = service.compute_climatological_anomaly(temp, clim, mask=mask)
    assert anomaly.shape == (15, GRID_H, GRID_W)
    assert np.allclose(anomaly, 1.0)


def test_detect_marine_heatwaves_hobday_categories():
    service = AnomalyDetectionService()
    # Create synthetic series [T=7, D=15, H=101, W=241]
    T = 7
    series = np.ones((T, 15, GRID_H, GRID_W), dtype=np.float32) * 28.0
    # Simulate baseline climatology with 0.5°C threshold difference
    baseline = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 26.0
    
    # Moderate cell: anomaly = 0.6°C (ratio = 1.2 -> Cat 1)
    series[-1, :, 10, 10] = 27.2
    # Strong cell: anomaly = 1.25°C (ratio = 2.5 -> Cat 2)
    series[-1, :, 20, 20] = 28.5
    # Severe cell: anomaly = 1.75°C (ratio = 3.5 -> Cat 3)
    series[-1, :, 30, 30] = 29.5
    # Extreme cell: anomaly = 2.5°C (ratio = 5.0 -> Cat 4)
    series[-1, :, 40, 40] = 31.0

    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)

    res = service.detect_marine_heatwaves(
        temperature_series=series,
        threshold_percentile=90.0,
        baseline_climatology=baseline,
        min_duration_days=5,
        mask=mask
    )

    assert res["status"] == "success"
    assert "active_mhw_area_km2" in res
    assert "categories" in res
    assert "sub_basin_stats" in res
    assert res["max_penetration_depth_m"] >= 0.0


def test_detect_mhw_snapshot():
    service = AnomalyDetectionService()
    current = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 29.0
    clim_mean = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 27.0
    clim_std = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 0.5
    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)

    res = service.detect_mhw_snapshot(current, clim_mean, clim_std, mask=mask)
    assert res["status"] == "success"
    assert res["active_mhw_percentage"] > 0
    assert res["max_intensity_c"] > 0


def test_uncertainty_service():
    uq = UncertaintyService()
    latent = np.random.randn(128, GRID_H, GRID_W).astype(np.float32)
    sigma = uq.estimate_depth_uncertainty(latent, depth=100.0)
    assert sigma.shape == (GRID_H, GRID_W)
    assert np.all(sigma >= 0.1)

    preds = np.random.randn(15, GRID_H, GRID_W).astype(np.float32) * 5 + 20
    targets = preds + np.random.randn(15, GRID_H, GRID_W).astype(np.float32) * 0.5
    sigmas = np.ones_like(preds) * 0.8
    metrics = uq.compute_uq_metrics(preds, targets, sigmas)
    assert "coverage_1_sigma_pct" in metrics
    assert "coverage_2_sigma_pct" in metrics


def test_argo_validation_service():
    argo = ARGOValidationService()
    model_prof = np.array([28.5, 28.3, 28.0, 27.5, 26.0, 22.0, 18.0, 15.0, 13.0, 11.0, 9.0, 6.0, 4.5, 3.8, 3.5])
    float_prof = model_prof + 0.2

    res = argo.compare_with_float(model_prof, float_prof, float_wmo_id="WMO_2901542")
    assert np.isclose(res["overall_rmse_c"], 0.2, atol=1e-2)
    assert np.isclose(res["mean_bias_c"], -0.2, atol=1e-2)
    assert "layers" in res
    assert "mixed_layer_0_50m_rmse" in res["layers"]
    assert "thermocline_50_200m_rmse" in res["layers"]
