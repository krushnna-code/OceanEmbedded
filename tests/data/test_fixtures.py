"""
Data and Dev Fixture Schema Tests for OceanEmbed.
Verifies Section 7A real product schemas against all 5 NetCDF development fixtures
without depending on temporal alignment or full preprocessing pipeline.
"""

import os
import glob
import pytest

from oceanembed.data.dev_fixture_inspector import inspect_dev_fixture, EXPECTED_FIXTURE_SCHEMAS
from oceanembed.data.synthetic import SyntheticOceanDataset, create_north_indian_ocean_mask
from oceanembed.data.interfaces import (
    GRID_H,
    GRID_W,
    TEMPORAL_WINDOW_T,
    NUM_DEPTHS,
    NUM_SURFACE_CHANNELS
)


def get_fixture_files():
    # Look in data/dev_fixtures and dataset/training
    paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "dev_fixtures"),
        os.path.join(os.path.dirname(__file__), "..", "..", "dataset", "training")
    ]
    for p in paths:
        files = glob.glob(os.path.join(p, "*.nc"))
        if len(files) >= 5:
            return sorted(files)
    return []


def test_synthetic_dataset_shapes():
    """Verifies synthetic dataset shapes and mask compliance."""
    dataset = SyntheticOceanDataset(num_samples=2, seed=42)
    assert len(dataset) == 2
    
    sample = dataset[0]
    assert "surface" in sample
    assert "temperature" in sample
    assert "anomaly" in sample
    assert "mask" in sample
    
    # Surface shape: [T, C, H, W]
    assert sample["surface"].shape == (TEMPORAL_WINDOW_T, NUM_SURFACE_CHANNELS, GRID_H, GRID_W)
    # Target shape: [15, H, W]
    assert sample["temperature"].shape == (NUM_DEPTHS, GRID_H, GRID_W)
    assert sample["anomaly"].shape == (NUM_DEPTHS, GRID_H, GRID_W)
    # Mask shape: [H, W]
    assert sample["mask"].shape == (GRID_H, GRID_W)


def test_north_indian_ocean_mask():
    """Verifies the mask has both ocean (>0) and land (==0) cells."""
    mask = create_north_indian_ocean_mask(GRID_H, GRID_W)
    assert mask.shape == (GRID_H, GRID_W)
    ocean_count = (mask > 0).sum()
    land_count = (mask == 0).sum()
    assert ocean_count > 0, "Mask must contain ocean cells"
    assert land_count > 0, "Mask must contain land cells"


@pytest.mark.parametrize("schema_key,info", EXPECTED_FIXTURE_SCHEMAS.items())
def test_each_dev_fixture_schema(schema_key, info):
    """
    Asserts each of the 5 Section 7A NetCDF fixtures:
    1. Exists
    2. Contains declared variables
    3. Matches declared units
    4. Covers North Indian Ocean bounding box (5-30N, 45-105E)
    """
    files = get_fixture_files()
    assert len(files) >= 5, f"Expected 5 fixture files, found {len(files)}"
    
    pattern = info["pattern"]
    matching_files = [f for f in files if pattern in os.path.basename(f)]
    assert len(matching_files) >= 1, f"No fixture matched pattern {pattern}"
    
    fixture_path = matching_files[0]
    summary = inspect_dev_fixture(fixture_path)
    
    # 1. Variables exist
    for var in info["variables"]:
        assert var in summary["variables"], f"Variable {var} missing from {summary['filename']}"
        
    # 2. Units check
    for var, expected_unit in info["units"].items():
        actual_unit = summary["variables"][var]["units"].strip().lower()
        if isinstance(expected_unit, list):
            valid_units = [u.strip().lower() for u in expected_unit]
            assert actual_unit in valid_units, f"Unit '{actual_unit}' for {var} not in {valid_units}"
        else:
            assert actual_unit == expected_unit.strip().lower(), f"Unit '{actual_unit}' does not match expected '{expected_unit}'"
            
    # 3. Spatial bounding box coverage check
    assert summary["covers_north_indian_ocean"], f"Fixture {summary['filename']} does not cover 5-30N, 45-105E"
