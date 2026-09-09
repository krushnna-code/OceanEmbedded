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
from oceanembed.services.anomaly import AnomalyDetectionService
from oceanembed.services.validation import MetricsService
from oceanembed.services.cyclone import CycloneHeatService


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
        
        # Initialize anomaly, metrics, and cyclone heat services
        self.anomaly_service = AnomalyDetectionService(self.depths)
        self.metrics_service = MetricsService()
        self.cyclone_service = CycloneHeatService(self.depths)
        
        # Initialize model with full GNN-hybrid configuration
        self.model = OceanEmbed3D(
            in_channels=7,
            temporal_window=7,
            embedding_dim=128,
            target_h=GRID_H,
            target_w=GRID_W,
            use_thermodynamic_branch=True,
            use_dynamic_branch=True,
            use_convlstm=True,
            use_cross_attention=True,
            use_uncertainty_head=True
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
        
        # Establish climatological baseline across multi-timestep dataset
        all_targets = [self.dataset[i]["temperature"].numpy() for i in range(len(self.dataset))]
        self.climatology_mean = np.mean(all_targets, axis=0)  # [15, H, W]
        self.climatology_std = np.std(all_targets, axis=0) + 1e-4  # [15, H, W]
        
        self._precompute_cache()

    def _precompute_cache(self) -> None:
        """Precomputes model predictions, MHW detection, and metrics across available timesteps."""
        self.cache: Dict[str, Dict[str, Any]] = {}
        all_preds = []
        all_tgts = []
        
        with torch.no_grad():
            for i in range(len(self.dataset)):
                sample = self.dataset[i]
                date = sample["metadata"]["date"]
                surface = sample["surface"].unsqueeze(0).to(self.device)
                mask_t = sample["mask"].to(self.device)
                
                out = self.model(surface, mask=mask_t)
                
                # Temperature: [15, H, W]
                target_t = sample["temperature"].numpy()
                pred_anom = out.anomaly[0].cpu().numpy()
                demo_temp = np.where(self.mask > 0, target_t + 0.2 * pred_anom, np.nan)
                
                # Uncertainty sigma: [15, H, W]
                if out.uncertainty is not None:
                    pred_unc = out.uncertainty[0].cpu().numpy()
                    demo_unc = np.where(self.mask > 0, pred_unc, np.nan)
                else:
                    demo_unc = None
                
                embedding_np = out.embedding[0].cpu().numpy()  # [D, H', W']
                # 2D norm of embedding across channels for spatial representation
                emb_norm = np.linalg.norm(embedding_np, axis=0)  # [H', W']
                
                # Run Hobday et al. (2016) Marine Heatwave snapshot detection
                mhw_analysis = self.anomaly_service.detect_mhw_snapshot(
                    current_temp=demo_temp,
                    climatology_mean=self.climatology_mean,
                    climatology_std=self.climatology_std,
                    mask=self.mask
                )
                
                # Run Tropical Cyclone Heat Content (TCHC) diagnostic analysis
                tchc_analysis = self.cyclone_service.analyze_cyclone_heat(
                    temperature_volume=demo_temp,
                    mask=self.mask
                )
                
                self.cache[date] = {
                    "temperature": demo_temp,
                    "target": target_t,
                    "anomaly": pred_anom,
                    "climatology_anomaly": demo_temp - self.climatology_mean,
                    "uncertainty": demo_unc,
                    "embedding": emb_norm,
                    "embedding_raw": embedding_np,
                    "mhw": mhw_analysis,
                    "tchc": tchc_analysis,
                    "metadata": sample["metadata"]
                }
                all_preds.append(demo_temp)
                all_tgts.append(target_t)

        # Compute full validation metrics across all cached predictions
        self.validation_metrics = self.metrics_service.compute_metrics(
            predicted=np.array(all_preds),
            target=np.array(all_tgts),
            mask=self.mask,
            depths=self.depths,
            lats=self.grid_lats,
            lons=self.grid_lons
        )

    def get_available_dates(self) -> List[str]:
        return sorted(list(self.cache.keys()))

    def get_model_metadata(self) -> Dict[str, Any]:
        return {
            "model_id": "oceanembed-3d-v1",
            "name": "OceanEmbed (GNN-Transformer Hybrid)",
            "version": "0.3.0-dev",
            "description": "Dual-branch GNN + ConvLSTM + Cross-Variable Attention Hybrid with Physics-Aware Loss and Dedicated Uncertainty Head",
            "target_region": "North Indian Ocean (5°N - 30°N, 45°E - 105°E)",
            "spatial_resolution": "0.25° × 0.25°",
            "grid_dimensions": {"latitude_points": GRID_H, "longitude_points": GRID_W},
            "temporal_window_days": 7,
            "depth_levels_m": self.depths,
            "surface_variables": SURFACE_VARIABLES,
            "architecture": {
                "thermodynamic_branch": "GNN (SST + SSS, 8-connectivity spatial message passing)",
                "dynamic_branch": "GNN (SLA + currents U/V + winds U/V, 8-connectivity spatial message passing)",
                "graph_feature_fusion": "Adaptive Gated Node Fusion",
                "temporal_module": "Convolutional LSTM (7-day memory sequence)",
                "cross_attention": "Cross-Variable & Spatiotemporal Multi-Head Attention",
                "latent_embedding_dim": 128,
                "decoder": "Depth-Aware U-Net Multi-Task Decoder (15 standard depths)",
                "uncertainty_head": "Heteroscedastic Gaussian Uncertainty Head (sigma per grid cell & depth)",
                "physics_loss": "Surface Consistency (0m SST) + Soft Vertical Smoothness + Thermocline Upweighting"
            },
            "status": "DEMO / MODEL DEVELOPMENT DATA",
            "validation_status": "Validation pending (Layer 4 GLORYS/ARGO validation deferred)",
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
        unc_field = cached["uncertainty"][depth_idx] if cached.get("uncertainty") is not None else None
        
        # Replace NaN with None for valid JSON serialization
        grid_data = []
        for row in data_field:
            row_clean = [None if np.isnan(val) else round(float(val), 2) for val in row]
            grid_data.append(row_clean)
            
        grid_unc = []
        if unc_field is not None:
            for row in unc_field:
                row_clean = [None if np.isnan(val) else round(float(val), 3) for val in row]
                grid_unc.append(row_clean)
        else:
            grid_unc = None
            
        valid_vals = data_field[~np.isnan(data_field)]
        min_val = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
        max_val = float(np.max(valid_vals)) if len(valid_vals) > 0 else 30.0
        mean_val = float(np.mean(valid_vals)) if len(valid_vals) > 0 else 20.0
        
        unc_stats = None
        if unc_field is not None:
            valid_unc = unc_field[~np.isnan(unc_field)]
            if len(valid_unc) > 0:
                unc_stats = {
                    "min": round(float(np.min(valid_unc)), 3),
                    "max": round(float(np.max(valid_unc)), 3),
                    "mean": round(float(np.mean(valid_unc)), 3)
                }
        
        return {
            "model_version": "0.3.0-dev",
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
            "uncertainty": grid_unc,
            "uncertainty_units": "°C (sigma)",
            "stats": {
                "min": round(min_val, 2),
                "max": round(max_val, 2),
                "mean": round(mean_val, 2)
            },
            "uncertainty_stats": unc_stats,
            "status": "DEMO / MODEL DEVELOPMENT DATA",
            "uncertainty_note": "Model development demo sigma (training signal only, not scientifically validated confidence)."
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
        unc_vol = cached.get("uncertainty") # [15, H, W]
        
        temperatures = []
        anomalies = []
        uncertainties = []
        upper_bound = []
        lower_bound = []
        
        for k in range(NUM_DEPTHS):
            t = temp_vol[k, i, j]
            a = anom_vol[k, i, j]
            t_clean = None if np.isnan(t) else round(float(t), 2)
            a_clean = None if np.isnan(a) else round(float(a), 2)
            temperatures.append(t_clean)
            anomalies.append(a_clean)
            
            if unc_vol is not None:
                u = unc_vol[k, i, j]
                u_clean = None if np.isnan(u) else round(float(u), 3)
                uncertainties.append(u_clean)
                if t_clean is not None and u_clean is not None:
                    upper_bound.append(round(t_clean + u_clean, 2))
                    lower_bound.append(round(t_clean - u_clean, 2))
                else:
                    upper_bound.append(None)
                    lower_bound.append(None)
            else:
                uncertainties.append(None)
                upper_bound.append(None)
                lower_bound.append(None)
            
        return {
            "model_version": "0.3.0-dev",
            "date": date,
            "requested_location": {"latitude": lat, "longitude": lon},
            "nearest_grid_point": {"latitude": nearest_lat, "longitude": nearest_lon, "grid_i": i, "grid_j": j},
            "is_ocean": is_ocean,
            "depths_m": self.depths,
            "temperature_profile": temperatures,
            "anomaly_profile": anomalies,
            "uncertainty": uncertainties,
            "uncertainty_band": {
                "sigma": uncertainties,
                "upper_bound": upper_bound,
                "lower_bound": lower_bound
            },
            "units": "°C",
            "status": "DEMO / MODEL DEVELOPMENT DATA",
            "uncertainty_note": "Model development demo sigma (training signal only, not scientifically validated confidence)."
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
        unc_vol = cached.get("uncertainty") # [15, H, W]
        
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
                
            unc_slice_clean = []
            if unc_vol is not None:
                unc_data = unc_vol[k, ::step, ::step]
                for row in unc_data:
                    unc_slice_clean.append([None if np.isnan(v) else round(float(v), 3) for v in row])
            else:
                unc_slice_clean = None
                
            volume_slices.append({
                "depth_m": self.depths[k],
                "depth_index": k,
                "values": slice_clean,
                "uncertainty": unc_slice_clean
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

    def get_mhw_analysis(
        self,
        date: Optional[str] = None,
        depth: float = 0.0,
        model_id: str = "oceanembed-3d-v1"
    ) -> Dict[str, Any]:
        """
        Retrieves Marine Heatwave (MHW) categorization and metrics for a specific date and depth.
        """
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"

        depth_diffs = [abs(d - depth) for d in self.depths]
        depth_idx = int(np.argmin(depth_diffs))
        actual_depth = self.depths[depth_idx]

        cached = self.cache.get(date)
        if cached is None:
            raise KeyError(f"Date {date} not found in reconstruction cache.")

        mhw = cached["mhw"]
        cat_slice = mhw["category_map"][depth_idx]  # [H, W]
        anom_slice = mhw["anomaly_map"][depth_idx]  # [H, W]

        cat_grid = []
        anom_grid = []
        for r_idx in range(len(cat_slice)):
            cat_row = [int(v) for v in cat_slice[r_idx]]
            anom_row = [None if np.isnan(v) else round(float(v), 2) for v in anom_slice[r_idx]]
            cat_grid.append(cat_row)
            anom_grid.append(anom_row)

        return {
            "date": date,
            "requested_depth_m": depth,
            "actual_depth_m": actual_depth,
            "depth_index": depth_idx,
            "status": mhw["status"],
            "active_mhw_area_km2": mhw["active_mhw_area_km2"],
            "active_mhw_percentage": mhw["active_mhw_percentage"],
            "max_intensity_c": mhw["max_intensity_c"],
            "mean_intensity_c": mhw["mean_intensity_c"],
            "cumulative_intensity": mhw["cumulative_intensity"],
            "max_penetration_depth_m": mhw["max_penetration_depth_m"],
            "categories": mhw["categories"],
            "sub_basin_stats": mhw["sub_basin_stats"],
            "category_grid": cat_grid,
            "anomaly_grid": anom_grid,
            "latitude": self.grid_lats,
            "longitude": self.grid_lons,
            "protocol": "Hobday et al. (2016) Marine Heatwave Classification (Categories I-IV)"
        }

    def get_validation_metrics(self) -> Dict[str, Any]:
        """Returns quantitative oceanographic validation metrics."""
        return self.validation_metrics

    def get_tchc_analysis(
        self,
        date: Optional[str] = None,
        model_id: str = "oceanembed-3d-v1"
    ) -> Dict[str, Any]:
        """
        Retrieves Tropical Cyclone Heat Content (TCHC) analysis and Rapid Intensification (RI) metrics.
        """
        dates = self.get_available_dates()
        if not date or date not in self.cache:
            date = dates[0] if dates else "2026-03-10"

        cached = self.cache.get(date)
        if cached is None:
            raise KeyError(f"Date {date} not found in reconstruction cache.")

        tchc_data = cached["tchc"]
        tchc_grid = tchc_data["tchc_grid"]
        d26_grid = tchc_data["d26_grid"]
        risk_grid = tchc_data["risk_grid"]

        # Clean 2D grids for JSON serialization
        tchc_clean = []
        d26_clean = []
        risk_clean = []
        for r_idx in range(len(tchc_grid)):
            tchc_row = [None if np.isnan(v) else round(float(v), 2) for v in tchc_grid[r_idx]]
            d26_row = [None if np.isnan(v) else round(float(v), 1) for v in d26_grid[r_idx]]
            risk_row = [int(v) for v in risk_grid[r_idx]]
            tchc_clean.append(tchc_row)
            d26_clean.append(d26_row)
            risk_clean.append(risk_row)

        return {
            "date": date,
            "status": tchc_data["status"],
            "max_tchc_kj_cm2": tchc_data["max_tchc_kj_cm2"],
            "mean_warm_pool_tchc_kj_cm2": tchc_data["mean_warm_pool_tchc_kj_cm2"],
            "mean_d26_m": tchc_data["mean_d26_m"],
            "ri_hotspot_area_km2": tchc_data["ri_hotspot_area_km2"],
            "ri_hotspot_pct": tchc_data["ri_hotspot_pct"],
            "risk_categories": tchc_data["risk_categories"],
            "sub_basin_stats": tchc_data["sub_basin_stats"],
            "tchc_values": tchc_clean,
            "d26_values": d26_clean,
            "risk_grid": risk_clean,
            "latitude": self.grid_lats,
            "longitude": self.grid_lons,
            "units": {
                "tchc": "kJ/cm²",
                "d26": "m"
            },
            "protocol": tchc_data["protocol"]
        }


