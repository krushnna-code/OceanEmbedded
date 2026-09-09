"""
Dataset interfaces and specifications for OceanEmbed.
Target region: North Indian Ocean (5°N to 30°N, 45°E to 105°E)
Grid resolution: 0.25° (H=101, W=241)
Standard depths (15 levels): 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m
"""

from typing import Dict, Any, Optional, List, Tuple
import torch
from torch.utils.data import Dataset

STANDARD_DEPTHS: List[float] = [
    0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 
    125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0
]

SURFACE_VARIABLES: List[str] = [
    "analysed_sst",   # OSTIA SST (°C / Kelvin)
    "sos",            # CMEMS multiobs SSS (PSU)
    "sla",            # C3S/DUACS SLA (m)
    "uo",             # CMEMS multiobs total zonal current (m/s)
    "vo",             # CMEMS multiobs total meridional current (m/s)
    "uwnd",           # CCMP 10m zonal wind (m/s)
    "vwnd"            # CCMP 10m meridional wind (m/s)
]

BBOX_NORTH_INDIAN_OCEAN: Dict[str, float] = {
    "min_lat": 5.0,
    "max_lat": 30.0,
    "min_lon": 45.0,
    "max_lon": 105.0,
    "res_lat": 0.25,
    "res_lon": 0.25,
}

# Grid shapes: lat: (30.0 - 5.0)/0.25 + 1 = 101, lon: (105.0 - 45.0)/0.25 + 1 = 241
GRID_H = 101
GRID_W = 241
TEMPORAL_WINDOW_T = 7
NUM_DEPTHS = 15
NUM_SURFACE_CHANNELS = 7


class SurfaceOceanDataset(Dataset):
    """
    Abstract interface for Surface Ocean sequences.
    Supplies tensors shaped [T, C, H, W] for individual samples
    or [B, T, C, H, W] when batched by DataLoader.
    
    The model consumes tensors without knowing whether data originates from
    synthetic generation, Zarr arrays, or harmonized NetCDF products.
    """
    def __len__(self) -> int:
        raise NotImplementedError

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        """
        Returns:
            {
                "surface": torch.Tensor of shape [T, C, H, W], dtype=torch.float32,
                "mask": Optional[torch.Tensor] of shape [H, W] (1=ocean, 0=land),
                "graph": {
                    "node_features": Optional[torch.Tensor], # [B*T, N, C]
                    "edge_index": Optional[torch.Tensor],    # [2, num_edges]
                    "edge_weight": Optional[torch.Tensor]
                },
                "metadata": Dict[str, Any] (dates, timestamps, coords)
            }
        """
        raise NotImplementedError


class TemperatureTargetDataset(Dataset):
    """
    Abstract interface for Subsurface Temperature Targets.
    Supplies target tensors of shape [15, H, W] (or [B, 15, H, W] batched)
    corresponding to the 15 standard ocean depths from 0m to 1000m.
    """
    def __len__(self) -> int:
        raise NotImplementedError

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        """
        Returns:
            {
                "temperature": torch.Tensor of shape [15, H, W], dtype=torch.float32,
                "anomaly": Optional[torch.Tensor] of shape [15, H, W],
                "depths": torch.Tensor of shape [15],
                "metadata": Dict[str, Any]
            }
        """
        raise NotImplementedError
