"""
Unit tests for NetCDFOceanDataset loader.
"""

import os
import pytest
import torch
from oceanembed.data.netcdf_dataset import NetCDFOceanDataset
from oceanembed.data.interfaces import (
    GRID_H,
    GRID_W,
    TEMPORAL_WINDOW_T,
    NUM_DEPTHS,
    NUM_SURFACE_CHANNELS
)

TRAINING_DIR = "training"


@pytest.mark.skipif(not os.path.exists(TRAINING_DIR), reason="training/ directory not present")
def test_netcdf_ocean_dataset_loading():
    dataset = NetCDFOceanDataset(
        data_dir=TRAINING_DIR,
        temporal_window=TEMPORAL_WINDOW_T,
        target_h=GRID_H,
        target_w=GRID_W
    )
    assert len(dataset) > 0, "Dataset should contain at least 1 temporal sample sequence"
    
    sample = dataset[0]
    assert "surface" in sample
    assert "temperature" in sample
    assert "mask" in sample

    # Surface shape: [T, C, H, W] = [7, 7, 101, 241]
    surface = sample["surface"]
    assert surface.shape == (TEMPORAL_WINDOW_T, NUM_SURFACE_CHANNELS, GRID_H, GRID_W)
    assert surface.dtype == torch.float32

    # Temperature target shape: [15, H, W] = [15, 101, 241]
    target = sample["temperature"]
    assert target.shape == (NUM_DEPTHS, GRID_H, GRID_W)
    assert target.dtype == torch.float32

    # Mask shape: [H, W] = [101, 241]
    mask = sample["mask"]
    assert mask.shape == (GRID_H, GRID_W)
