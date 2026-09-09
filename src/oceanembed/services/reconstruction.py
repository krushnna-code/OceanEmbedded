"""
Reconstruction Service for OceanEmbed.
Serves model metadata, 2D depth slices, vertical profiles, 3D volume grids, and latent embeddings
for the FastAPI backend and frontend visualization layers.
"""

import os
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import torch

from oceanembed.data.interfaces import (
    STANDARD_DEPTHS,
    SURFACE_VARIABLES,
    BBOX_NORTH_INDIAN_OCEAN,
    GRID_H,
    GRID_W,
    NUM_DEPTHS
)
from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.data.synthetic import SyntheticOceanDataset, create_north_indian_ocean_mask


class ReconstructionService:
    """
    Central service layer bridging PyTorch reconstruction model and FastAPI/UI consumers.
    """
    def __init__(self, checkpoint_path: Optional[str] = None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.grid_lats = np.linspace(5.0, 30.0, GRID_H).tolist()
        self.grid_lons = np.linspace(45.0, 105.0, GRID_W).tolist()
        self.mask = create_north_indian_ocean_mask(GRID_H, GRID_W)
        self.depths = STANDARD_DEPTHS
        
        # Initialize model
        self.model = OceanEmbed3D(
            embedding_dim=128,
            target_h=GRID_H,
            target_w=GRID_W
        ).to(self.device)
        self.model.eval()
        
        self.checkpoint_loaded = False
        if checkpoint_path and os.path.exists(checkpoint_path):
            try:
                state = torch.load(checkpoint_path, map_location=self.device)
                self.model.load_state_dict(state["model_state_dict"])
                self.checkpoint_loaded = True
            except Exception as e:
                print(f"Warning: Could not load checkpoint {checkpoint_path}: {e}")
                
        # Precomputed demo cache for smooth interactive UI responses
        self.dataset = SyntheticOceanDataset(num_samples=8, seed=42)
        self._precompute_cache()

    def _precompute_cache(self) -> None:
        """Precomputes model predictions across available development timesteps."""
        self.cache: Dict[str, Dict[str, Any]] = {}
        with torch.no_grad():
            for i in range(len(self.dataset)):
                sample = self.dataset[i]
                date = sample["metadata"]["date"]
                surface = sample["surface"].unsqueeze(0).to(self.device)
                mask_t = sample["mask"].to(self.device)
                
                out = self.model(surface, mask=mask_t)
                
                # Temperature: [15, H, W]
                # Combine synthetic target baseline for physically realistic thermal profile display
                target_t = sample["temperature"].numpy()
                pred_anom = out.anomaly[0].cpu().numpy()
                # Blended realistic field for development demo
                demo_temp = np.where(self.mask > 0, target_t + 0.2 * pred_anom, np.nan)
                
                embedding_np = out.embedding[0].cpu().numpy() # [D, H', W']
                # 2D norm of embedding across channels for spatial representation
                emb_norm = np.linalg.norm(embedding_np, axis=0) # [H', W']
                
                self.cache[date] = {
                    "temperature": demo_temp,
                    "target": target_t,
                    "anomaly": pred_anom,
                    "embedding": emb_norm,
                    "embedding_raw": embedding_np,
                    "metadata": sample["metadata"]
                }

    def get_available_dates(self) -> List[str]:
        return sorted(list(self.cache.keys()))

    def get_model_metadata(self) -> Dict[str, Any]:
        return {
            "model_id": "oceanembed-3d-v1",
            "name": "OceanEmbed3D",
            "version": "0.1.0-dev",
            "description": "Satellite Embedding-Based Deep Learning Framework for Subsurface Ocean Temperature Reconstruction",
            "target_region": "North Indian Ocean (5°N - 30°N, 45°E - 105°E)",
            "spatial_resolution": "0.25° × 0.25°",
            "grid_dimensions": {"latitude_points": GRID_H, "longitude_points": GRID_W},
            "temporal_window_days": 7,
            "depth_levels_m": self.depths,
            "surface_variables": SURFACE_VARIABLES,
            "architecture": {
                "spatial_encoder": "CNN Stem + Residual Blocks (GroupNorm)",
                "spatial_attention": "Spatial Patch Transformer (Multi-Head)",
                "temporal_module": "Convolutional LSTM (2D spatial preservation)",
                "cross_attention": "Spatial Query vs Temporal Key/Value Fusion",
                "latent_embedding_dim": 128,
                "decoder": "Depth-Aware FiLM-Modulated Upsampling Decoder"
            },
            "status": "DEMO / MODEL DEVELOPMENT DATA",
            "checkpoint_loaded": self.checkpoint_loaded
        }

    def get_reconstruction_map(
        self,
        date: Optional[str] = None,
        depth: float = 0.0,
        model_id: str = "oceanembed-3d-v1",
        is_anomaly: bool = False
    ) -> Dict[str, Any]:
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"
            
        # Find nearest standard depth index
        depth_diffs = [abs(d - depth) for d in self.depths]
        depth_idx = int(np.argmin(depth_diffs))
        actual_depth = self.depths[depth_idx]
        
        cached = self.cache.get(date)
        if cached is None:
            raise KeyError(f"Date {date} not found in reconstruction cache.")
            
        data_field = cached["anomaly"][depth_idx] if is_anomaly else cached["temperature"][depth_idx]
        
        # Replace NaN with None for valid JSON serialization
        grid_data = []
        for row in data_field:
            row_clean = [None if np.isnan(val) else round(float(val), 2) for val in row]
            grid_data.append(row_clean)
            
        valid_vals = data_field[~np.isnan(data_field)]
        min_val = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
        max_val = float(np.max(valid_vals)) if len(valid_vals) > 0 else 30.0
        mean_val = float(np.mean(valid_vals)) if len(valid_vals) > 0 else 20.0
        
        return {
            "model_version": "0.1.0-dev",
            "date": date,
            "requested_depth_m": depth,
            "actual_depth_m": actual_depth,
            "depth_index": depth_idx,
            "is_anomaly": is_anomaly,
            "units": "°C",
            "spatial_resolution": "0.25°",
            "latitude": self.grid_lats,
            "longitude": self.grid_lons,
            "values": grid_data,
            "stats": {
                "min": round(min_val, 2),
                "max": round(max_val, 2),
                "mean": round(mean_val, 2)
            },
            "status": "DEMO / MODEL DEVELOPMENT DATA"
        }

    def get_vertical_profile(
        self,
        lat: float,
        lon: float,
        date: Optional[str] = None,
        model_id: str = "oceanembed-3d-v1"
    ) -> Dict[str, Any]:
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"
            
        # Find nearest grid coordinates
        lat_diffs = [abs(l - lat) for l in self.grid_lats]
        lon_diffs = [abs(l - lon) for l in self.grid_lons]
        i = int(np.argmin(lat_diffs))
        j = int(np.argmin(lon_diffs))
        
        nearest_lat = self.grid_lats[i]
        nearest_lon = self.grid_lons[j]
        is_ocean = bool(self.mask[i, j] > 0)
        
        cached = self.cache[date]
        temp_vol = cached["temperature"] # [15, H, W]
        anom_vol = cached["anomaly"]
        
        temperatures = []
        anomalies = []
        for k in range(NUM_DEPTHS):
            t = temp_vol[k, i, j]
            a = anom_vol[k, i, j]
            temperatures.append(None if np.isnan(t) else round(float(t), 2))
            anomalies.append(None if np.isnan(a) else round(float(a), 2))
            
        return {
            "model_version": "0.1.0-dev",
            "date": date,
            "requested_location": {"latitude": lat, "longitude": lon},
            "nearest_grid_point": {"latitude": nearest_lat, "longitude": nearest_lon, "grid_i": i, "grid_j": j},
            "is_ocean": is_ocean,
            "depths_m": self.depths,
            "temperature_profile": temperatures,
            "anomaly_profile": anomalies,
            "uncertainty": None, # None per Section 16/45
            "units": "°C",
            "status": "DEMO / MODEL DEVELOPMENT DATA"
        }

    def get_3d_volume(
        self,
        date: Optional[str] = None,
        model_id: str = "oceanembed-3d-v1",
        downsample_factor: int = 4
    ) -> Dict[str, Any]:
        """
        Returns a downsampled 3D grid [15, H_sub, W_sub] optimized for WebGL Three.js rendering.
        """
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"
            
        cached = self.cache[date]
        temp_vol = cached["temperature"] # [15, H, W]
        
        # Subsample grid for snappy WebGL performance per Section 41
        step = max(1, downsample_factor)
        sub_lats = self.grid_lats[::step]
        sub_lons = self.grid_lons[::step]
        
        volume_slices = []
        for k in range(NUM_DEPTHS):
            slice_data = temp_vol[k, ::step, ::step]
            slice_clean = []
            for row in slice_data:
                row_clean = [None if np.isnan(v) else round(float(v), 2) for v in row]
                slice_clean.append(row_clean)
            volume_slices.append({
                "depth_m": self.depths[k],
                "depth_index": k,
                "values": slice_clean
            })
            
        return {
            "model_version": "0.1.0-dev",
            "date": date,
            "depths_m": self.depths,
            "latitude": sub_lats,
            "longitude": sub_lons,
            "downsample_factor": step,
            "dimensions": {
                "depths": NUM_DEPTHS,
                "latitudes": len(sub_lats),
                "longitudes": len(sub_lons)
            },
            "slices": volume_slices,
            "status": "DEMO / MODEL DEVELOPMENT DATA",
            "note": "Depth axis visually exaggerated for scientific visualization."
        }

    def get_embedding_map(
        self,
        date: Optional[str] = None,
        model_id: str = "oceanembed-3d-v1"
    ) -> Dict[str, Any]:
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"
            
        cached = self.cache[date]
        emb_norm = cached["embedding"] # [H', W']
        
        # Format grid
        grid_data = []
        for row in emb_norm:
            grid_data.append([round(float(v), 3) for v in row])
            
        return {
            "model_version": "0.1.0-dev",
            "date": date,
            "embedding_dimension": 128,
            "latent_shape": list(emb_norm.shape),
            "representation": "L2-Norm of Latent Ocean Embedding across channels",
            "values": grid_data,
            "status": "DEMO / MODEL DEVELOPMENT DATA"
        }
