"""
Synthetic dataset generator for development and testing.
Creates physically grounded mock surface sequences and subsurface temperature fields
over the North Indian Ocean domain (5°N - 30°N, 45°E - 105°E) at 0.25° resolution.

IMPORTANT:
Synthetic data is ONLY for software and model development.
It must NEVER be presented as scientific validation.
"""

from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import torch
from torch.utils.data import Dataset

from oceanembed.data.interfaces import (
    SurfaceOceanDataset,
    TemperatureTargetDataset,
    STANDARD_DEPTHS,
    GRID_H,
    GRID_W,
    TEMPORAL_WINDOW_T,
    NUM_DEPTHS,
    NUM_SURFACE_CHANNELS,
    SURFACE_VARIABLES
)


def create_north_indian_ocean_mask(h: int = GRID_H, w: int = GRID_W) -> np.ndarray:
    """
    Generates an approximate land-sea mask for North Indian Ocean:
    5°N to 30°N, 45°E to 105°E.
    1.0 = Ocean, 0.0 = Land (Indian subcontinent, Arabia, SE Asia landmasses).
    """
    lats = np.linspace(5.0, 30.0, h)
    lons = np.linspace(45.0, 105.0, w)
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    
    mask = np.ones((h, w), dtype=np.float32)
    
    # Approximate Indian Subcontinent triangle: roughly lat > 8, lon 68 to 88
    # Triangular boundary: apex near 8N, 77E widening to 24N, 68E and 22N, 89E
    for i in range(h):
        for j in range(w):
            lat = lat_grid[i, j]
            lon = lon_grid[i, j]
            
            # Arabian peninsula / Middle East (top-west)
            if lon < 60.0 and lat > 15.0:
                # Persian Gulf / Arabian land
                if lat > 20.0 or (lat > 15.0 and lon < 55.0):
                    mask[i, j] = 0.0
            
            # Indian subcontinent
            if 8.0 <= lat <= 26.0:
                # Left border: line from (8, 77.5) to (24, 68)
                left_lon = 77.5 - (lat - 8.0) * (9.5 / 16.0)
                # Right border: line from (8, 77.5) to (22, 89)
                right_lon = 77.5 + (lat - 8.0) * (11.5 / 14.0)
                if left_lon <= lon <= right_lon:
                    mask[i, j] = 0.0
            
            # Northern Eurasian / Himalayan landmass (lat > 25 for longitudes > 65)
            if lat > 26.0:
                mask[i, j] = 0.0
                
            # Southeast Asia / Indochina (lon > 98, lat > 10)
            if lon > 98.0 and lat > 8.0:
                mask[i, j] = 0.0
                
    return mask


def generate_synthetic_profile(depths: List[float], surface_sst: float) -> np.ndarray:
    """
    Generates a realistic ocean temperature profile (°C) based on depths and surface SST:
    - Mixed layer (0-30m): near surface SST
    - Thermocline (50-200m): exponential transition
    - Deep ocean (300-1000m): asymptotic decay toward ~4-5°C
    """
    d = np.array(depths, dtype=np.float32)
    # Physical decay formulation for tropical ocean
    deep_t = 4.5
    delta_t = surface_sst - deep_t
    thermocline_depth = 120.0
    scale = 160.0
    
    profile = deep_t + delta_t / (1.0 + np.exp((d - thermocline_depth) / scale))
    return profile


class SyntheticOceanDataset(SurfaceOceanDataset, TemperatureTargetDataset):
    """
    Combined synthetic dataset supplying both surface sequence inputs [T, C, H, W]
    and subsurface temperature targets [15, H, W].
    """
    def __init__(
        self,
        num_samples: int = 16,
        t_window: int = TEMPORAL_WINDOW_T,
        channels: int = NUM_SURFACE_CHANNELS,
        h: int = GRID_H,
        w: int = GRID_W,
        seed: int = 42
    ):
        self.num_samples = num_samples
        self.t_window = t_window
        self.channels = channels
        self.h = h
        self.w = w
        self.seed = seed
        self.mask = torch.from_numpy(create_north_indian_ocean_mask(h, w))
        self.depths = torch.tensor(STANDARD_DEPTHS, dtype=torch.float32)
        
        rng = np.random.RandomState(seed)
        self.data_cache: List[Dict[str, Any]] = []
        
        lats = np.linspace(5.0, 30.0, h)
        lons = np.linspace(45.0, 105.0, w)
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        
        for idx in range(num_samples):
            sample_rng = np.random.RandomState(seed + idx * 100)
            
            # Base spatial gradient: warmer south (5°N) ~30°C, cooler north ~26°C
            base_sst = 30.0 - (lat_grid - 5.0) * (4.0 / 25.0)
            
            # Add synthetic eddy features using sinusoids
            eddy = 0.8 * np.sin(lon_grid * 0.15 + sample_rng.rand() * 2) * np.cos(lat_grid * 0.2)
            
            # Surface sequence [T, C, H, W]
            surface = np.zeros((t_window, channels, h, w), dtype=np.float32)
            
            for t in range(t_window):
                t_phase = 0.1 * t
                # Channel 0: SST (°C)
                surface[t, 0] = base_sst + eddy + 0.3 * np.sin(t_phase) + 0.1 * sample_rng.randn(h, w)
                
                # Channel 1: SSS (PSU) - Bay of Bengal (east) fresher ~32, Arabian Sea (west) ~36
                surface[t, 1] = 36.0 - (lon_grid - 45.0) * (4.0 / 60.0) + 0.2 * sample_rng.randn(h, w)
                
                # Channel 2: SLA (m) - eddies (-0.25 to +0.25 m)
                surface[t, 2] = 0.15 * eddy + 0.05 * sample_rng.randn(h, w)
                
                # Channel 3 & 4: Surface Currents u, v (m/s)
                surface[t, 3] = 0.4 * np.cos(lat_grid * 0.3 + t_phase) + 0.1 * sample_rng.randn(h, w)
                surface[t, 4] = 0.3 * np.sin(lon_grid * 0.2 + t_phase) + 0.1 * sample_rng.randn(h, w)
                
                # Channel 5 & 6: Winds u, v (m/s) - Monsoon flow
                surface[t, 5] = 6.0 + 2.0 * np.sin(t_phase) + 1.0 * sample_rng.randn(h, w)
                surface[t, 6] = 4.0 + 1.5 * np.cos(t_phase) + 1.0 * sample_rng.randn(h, w)
                
                # Apply land mask
                for c in range(channels):
                    surface[t, c] *= self.mask.numpy()
            
            # Subsurface temperature target [15, H, W]
            target_temp = np.zeros((NUM_DEPTHS, h, w), dtype=np.float32)
            target_anom = np.zeros((NUM_DEPTHS, h, w), dtype=np.float32)
            
            # Mean surface SST of last time step
            last_sst = surface[-1, 0]
            
            for k, depth in enumerate(STANDARD_DEPTHS):
                # Standard profile decay
                deep_t = 4.5
                delta_t = np.maximum(last_sst - deep_t, 5.0)
                thermocline_depth = 120.0
                scale = 160.0
                decay = deep_t + delta_t / (1.0 + np.exp((depth - thermocline_depth) / scale))
                
                # Subsurface eddy signal decays with depth
                depth_eddy_decay = np.exp(-depth / 350.0)
                depth_eddy = eddy * depth_eddy_decay * 1.5
                
                temp_k = (decay + depth_eddy) * self.mask.numpy()
                target_temp[k] = temp_k
                target_anom[k] = depth_eddy * self.mask.numpy()
                
            self.data_cache.append({
                "surface": torch.from_numpy(surface),
                "mask": self.mask,
                "temperature": torch.from_numpy(target_temp),
                "anomaly": torch.from_numpy(target_anom),
                "depths": self.depths,
                "metadata": {
                    "sample_idx": idx,
                    "date": f"2026-03-{10 + (idx % 20):02d}",
                    "region": "North Indian Ocean",
                    "bbox": [5.0, 30.0, 45.0, 105.0],
                    "is_synthetic": True,
                    "status": "DEMO / MODEL DEVELOPMENT DATA"
                }
            })

    def __len__(self) -> int:
        return self.num_samples

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        return self.data_cache[idx]
