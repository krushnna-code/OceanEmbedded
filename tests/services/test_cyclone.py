"""
Unit tests for CycloneHeatService, 26°C isotherm depth (D26),
and Tropical Cyclone Heat Content (TCHC) integration.
"""

import pytest
import numpy as np
from oceanembed.services.cyclone import CycloneHeatService
from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


def test_compute_d26_linear_interpolation():
    service = CycloneHeatService()
    # Create single column where 26°C crosses between 50m and 75m
    vol = np.zeros((15, 3, 3), dtype=np.float32)
    # Depths: 0, 5, 10, 20, 30, 50, 75, 100, ...
    # Let T at 50m = 27.0°C, at 75m = 25.0°C
    # Exactly halfway (26.0°C) should be 50 + 0.5 * 25 = 62.5m
    vol[0:6, 1, 1] = 29.0
    vol[5, 1, 1] = 27.0
    vol[6, 1, 1] = 25.0
    vol[7:, 1, 1] = 20.0

    mask = np.ones((3, 3), dtype=np.float32)
    d26 = service.compute_d26(vol, mask=mask)
    assert np.isclose(d26[1, 1], 62.5, atol=1e-1), f"Expected 62.5m, got {d26[1, 1]}"


def test_compute_d26_cold_surface():
    service = CycloneHeatService()
    vol = np.ones((15, 2, 2), dtype=np.float32) * 24.0  # Cold surface < 26°C
    mask = np.ones((2, 2), dtype=np.float32)
    d26 = service.compute_d26(vol, mask=mask)
    assert np.all(d26 == 0.0), "Cold surface must have D26 = 0"


def test_compute_tchc_integration():
    service = CycloneHeatService()
    vol = np.zeros((15, 3, 3), dtype=np.float32)
    # Profile: 28°C from 0 to 50m, exactly 26°C at 50m, cold below
    vol[0:6, 1, 1] = 28.0  # 2°C above 26°C across 50 meters
    vol[6:, 1, 1] = 20.0
    mask = np.ones((3, 3), dtype=np.float32)

    tchc_grid, d26_grid = service.compute_tchc(vol, mask=mask)
    # Integral of (28 - 26) = 2°C over 50m = 100 °C·m
    # TCHC = 100 * 0.409 ~ 40.9 kJ/cm²
    assert tchc_grid[1, 1] > 35.0 and tchc_grid[1, 1] < 45.0


def test_analyze_cyclone_heat_risk_classification():
    service = CycloneHeatService()
    # High thermal energy volume: 30°C surface decaying to 26°C at 80m
    vol = np.ones((15, GRID_H, GRID_W), dtype=np.float32) * 20.0
    for i, d in enumerate(STANDARD_DEPTHS):
        if d <= 50:
            vol[i] = 30.0
        elif d <= 100:
            vol[i] = 27.0
        else:
            vol[i] = 15.0

    mask = np.ones((GRID_H, GRID_W), dtype=np.float32)
    mask[0, 0] = 0.0  # land

    res = service.analyze_cyclone_heat(vol, mask=mask)
    assert res["status"] == "success"
    assert res["max_tchc_kj_cm2"] > 50.0
    assert res["mean_d26_m"] > 30.0
    assert "sub_basin_stats" in res
    assert "Bay of Bengal" in res["sub_basin_stats"]
    assert "Arabian Sea" in res["sub_basin_stats"]
    assert "risk_categories" in res
