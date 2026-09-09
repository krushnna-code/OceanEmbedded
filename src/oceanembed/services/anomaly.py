"""
Thermal Anomaly Detection & Marine Heatwave (MHW) Engine.
Implements Hobday et al. (2016) Marine Heatwave categorization and subsurface thermal tracking.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np

from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


# Sub-basin coordinate bounds for the North Indian Ocean
SUB_BASIN_BOUNDS = {
    "Arabian Sea": {"min_lat": 10.0, "max_lat": 25.0, "min_lon": 50.0, "max_lon": 77.0},
    "Bay of Bengal": {"min_lat": 8.0, "max_lat": 22.0, "min_lon": 80.0, "max_lon": 98.0},
    "Equatorial Indian Ocean": {"min_lat": 5.0, "max_lat": 10.0, "min_lon": 60.0, "max_lon": 95.0}
}


class AnomalyDetectionService:
    """
    Service for calculating thermal climatological anomalies and detecting
    subsurface Marine Heatwaves (MHW) per Hobday et al. (2016) standard criteria.
    """

    def __init__(self, standard_depths: Optional[List[float]] = None):
        self.depths = standard_depths or STANDARD_DEPTHS
        self.grid_lats = np.linspace(5.0, 30.0, GRID_H)
        self.grid_lons = np.linspace(45.0, 105.0, GRID_W)

    def compute_climatological_anomaly(
        self,
        temperature_field: np.ndarray,
        climatology_field: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Computes deviation from climatological baseline:
        Delta_T = T - T_clim

        Args:
            temperature_field: Array of shape [H, W] or [D, H, W]
            climatology_field: Array of shape matching temperature_field
            mask: Optional ocean/land mask (1=ocean, 0=land)

        Returns:
            Anomaly array matching input shape with land cells as NaN
        """
        anomaly = np.array(temperature_field, dtype=np.float32) - np.array(climatology_field, dtype=np.float32)
        if mask is not None:
            if anomaly.ndim == 3 and mask.ndim == 2:
                for d in range(anomaly.shape[0]):
                    anomaly[d] = np.where(mask > 0.5, anomaly[d], np.nan)
            elif anomaly.ndim == 2:
                anomaly = np.where(mask > 0.5, anomaly, np.nan)
        return anomaly

    def detect_marine_heatwaves(
        self,
        temperature_series: np.ndarray,
        threshold_percentile: float = 90.0,
        baseline_climatology: Optional[np.ndarray] = None,
        min_duration_days: int = 5,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Detects Marine Heatwave events across a spatiotemporal time series according
        to the Hobday et al. (2016) protocol:
          - Threshold: Exceeding the 90th percentile threshold (T_90)
          - Persistence: For at least 5 consecutive days
          - Severity Categorization:
              Category I (Moderate):   1x to 2x threshold anomaly
              Category II (Strong):    2x to 3x threshold anomaly
              Category III (Severe):   3x to 4x threshold anomaly
              Category IV (Extreme):   >= 4x threshold anomaly

        Args:
            temperature_series: Array of shape [T, D, H, W] or [T, H, W]
            threshold_percentile: Percentile threshold (default 90.0)
            baseline_climatology: Optional climatological mean [D, H, W] or [H, W]
            min_duration_days: Minimum consecutive days (default 5)
            mask: Optional ocean land mask [H, W]

        Returns:
            Dict containing 3D/2D category maps, metrics, and regional summaries.
        """
        series = np.array(temperature_series, dtype=np.float32)
        t_steps = series.shape[0]

        # Compute climatological baseline and threshold if not provided
        if baseline_climatology is None:
            clim_mean = np.mean(series, axis=0)
        else:
            clim_mean = np.array(baseline_climatology, dtype=np.float32)

        thresh_val = np.percentile(series, threshold_percentile, axis=0)
        thresh_diff = np.maximum(thresh_val - clim_mean, 0.1)  # Safeguard against division by zero

        # Evaluate the latest timestep (or peak timestep)
        current_temp = series[-1]
        anomaly = current_temp - clim_mean

        # Consecutive exceedance check across the temporal window
        exceeds_thresh = (series >= thresh_val)  # [T, ...]
        consecutive_exceedance = np.sum(exceeds_thresh[-min_duration_days:], axis=0)
        is_active_mhw = (consecutive_exceedance >= min_duration_days) & (current_temp >= thresh_val)

        # Hobday intensity ratio: (T - T_clim) / (T_90 - T_clim)
        intensity_ratio = anomaly / thresh_diff

        # Categorize: 0=None, 1=Moderate, 2=Strong, 3=Severe, 4=Extreme
        category_map = np.zeros_like(anomaly, dtype=np.int32)
        active_cells = is_active_mhw & (intensity_ratio >= 1.0)

        category_map[active_cells & (intensity_ratio >= 1.0) & (intensity_ratio < 2.0)] = 1
        category_map[active_cells & (intensity_ratio >= 2.0) & (intensity_ratio < 3.0)] = 2
        category_map[active_cells & (intensity_ratio >= 3.0) & (intensity_ratio < 4.0)] = 3
        category_map[active_cells & (intensity_ratio >= 4.0)] = 4

        # Apply mask
        if mask is not None:
            if category_map.ndim == 3:
                for d in range(category_map.shape[0]):
                    category_map[d] = np.where(mask > 0.5, category_map[d], 0)
                    anomaly[d] = np.where(mask > 0.5, anomaly[d], np.nan)
            else:
                category_map = np.where(mask > 0.5, category_map, 0)
                anomaly = np.where(mask > 0.5, anomaly, np.nan)

        # Compute statistics
        stats = self._compute_mhw_statistics(category_map, anomaly, mask)
        return stats

    def detect_mhw_snapshot(
        self,
        current_temp: np.ndarray,
        climatology_mean: np.ndarray,
        climatology_std: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Fast snapshot MHW detector using parametric Gaussian 90th percentile:
        T_90 = T_clim + 1.282 * sigma_clim
        """
        current = np.array(current_temp, dtype=np.float32)
        clim = np.array(climatology_mean, dtype=np.float32)
        std = np.array(climatology_std, dtype=np.float32)

        thresh_diff = np.maximum(1.282 * std, 0.2)
        thresh_90 = clim + thresh_diff
        anomaly = current - clim

        intensity_ratio = anomaly / thresh_diff
        category_map = np.zeros_like(anomaly, dtype=np.int32)

        # Active MHW criteria: anomaly exceeds 90th percentile threshold
        active = (current >= thresh_90) & (intensity_ratio >= 1.0)
        category_map[active & (intensity_ratio >= 1.0) & (intensity_ratio < 2.0)] = 1
        category_map[active & (intensity_ratio >= 2.0) & (intensity_ratio < 3.0)] = 2
        category_map[active & (intensity_ratio >= 3.0) & (intensity_ratio < 4.0)] = 3
        category_map[active & (intensity_ratio >= 4.0)] = 4

        if mask is not None:
            if category_map.ndim == 3:
                for d in range(category_map.shape[0]):
                    category_map[d] = np.where(mask > 0.5, category_map[d], 0)
                    anomaly[d] = np.where(mask > 0.5, anomaly[d], np.nan)
            else:
                category_map = np.where(mask > 0.5, category_map, 0)
                anomaly = np.where(mask > 0.5, anomaly, np.nan)

        return self._compute_mhw_statistics(category_map, anomaly, mask)

    def _compute_mhw_statistics(
        self,
        category_map: np.ndarray,
        anomaly_map: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """Calculates quantitative MHW metrics and regional stratifications."""
        is_3d = category_map.ndim == 3
        surface_cat = category_map[0] if is_3d else category_map
        surface_anom = anomaly_map[0] if is_3d else anomaly_map

        # Ocean mask filter
        if mask is not None:
            ocean_indices = (mask > 0.5)
        else:
            ocean_indices = ~np.isnan(surface_anom)

        total_ocean_cells = int(np.sum(ocean_indices))
        if total_ocean_cells == 0:
            total_ocean_cells = 1

        active_cells = ocean_indices & (surface_cat > 0)
        active_count = int(np.sum(active_cells))
        mhw_percentage = round(float(active_count / total_ocean_cells * 100.0), 2)

        # Grid resolution approx 0.25 deg x 0.25 deg ~ 765 km^2 per cell at 15°N
        km2_per_cell = 765.0
        active_area_km2 = round(float(active_count * km2_per_cell), 0)

        # Anomaly statistics
        if active_count > 0:
            active_anoms = surface_anom[active_cells]
            max_intensity = round(float(np.nanmax(active_anoms)), 2)
            mean_intensity = round(float(np.nanmean(active_anoms)), 2)
            cumulative_intensity = round(float(np.nansum(active_anoms)), 2)
        else:
            max_intensity = 0.0
            mean_intensity = 0.0
            cumulative_intensity = 0.0

        # Subsurface penetration depth (if 3D)
        max_penetration_depth = 0.0
        if is_3d:
            for d_idx, d_m in enumerate(self.depths):
                layer_cat = category_map[d_idx]
                layer_active = ocean_indices & (layer_cat > 0)
                if np.sum(layer_active) > 0:
                    max_penetration_depth = float(d_m)

        # Hobday Category Counts
        cat_counts = {
            "none": int(np.sum(ocean_indices & (surface_cat == 0))),
            "category_1_moderate": int(np.sum(ocean_indices & (surface_cat == 1))),
            "category_2_strong": int(np.sum(ocean_indices & (surface_cat == 2))),
            "category_3_severe": int(np.sum(ocean_indices & (surface_cat == 3))),
            "category_4_extreme": int(np.sum(ocean_indices & (surface_cat == 4)))
        }

        # Sub-basin analysis
        sub_basin_stats = {}
        for basin_name, bounds in SUB_BASIN_BOUNDS.items():
            lat_mask = (self.grid_lats >= bounds["min_lat"]) & (self.grid_lats <= bounds["max_lat"])
            lon_mask = (self.grid_lons >= bounds["min_lon"]) & (self.grid_lons <= bounds["max_lon"])
            region_grid = np.outer(lat_mask, lon_mask) & ocean_indices

            reg_total = int(np.sum(region_grid))
            reg_active = int(np.sum(region_grid & (surface_cat > 0)))
            reg_pct = round(float(reg_active / reg_total * 100.0), 2) if reg_total > 0 else 0.0

            if reg_active > 0:
                reg_anom = float(np.nanmean(surface_anom[region_grid & (surface_cat > 0)]))
                reg_max = float(np.nanmax(surface_anom[region_grid & (surface_cat > 0)]))
            else:
                reg_anom = 0.0
                reg_max = 0.0

            sub_basin_stats[basin_name] = {
                "active_cells": reg_active,
                "total_cells": reg_total,
                "coverage_pct": reg_pct,
                "mean_intensity_c": round(reg_anom, 2),
                "max_intensity_c": round(reg_max, 2)
            }

        return {
            "status": "success",
            "active_mhw_area_km2": active_area_km2,
            "active_mhw_percentage": mhw_percentage,
            "max_intensity_c": max_intensity,
            "mean_intensity_c": mean_intensity,
            "cumulative_intensity": cumulative_intensity,
            "max_penetration_depth_m": max_penetration_depth,
            "categories": cat_counts,
            "sub_basin_stats": sub_basin_stats,
            "category_map": category_map,
            "anomaly_map": anomaly_map
        }


class UncertaintyService:
    """
    Formal Uncertainty Quantification (UQ) and heteroscedastic spread evaluation.
    """

    def estimate_depth_uncertainty(
        self,
        latent_embedding: np.ndarray,
        depth: float
    ) -> np.ndarray:
        """
        Estimates variance/confidence intervals for predicted depth levels
        based on the latent embedding vector and depth attenuation.
        """
        emb_norm = np.linalg.norm(latent_embedding, axis=0)  # [H, W]
        # Depth uncertainty increases in thermocline (50-200m) and deep ocean
        depth_factor = 1.0 + 0.5 * np.exp(-((depth - 100.0) ** 2) / (2 * 50.0 ** 2))
        sigma = 0.3 * (emb_norm / (np.mean(emb_norm) + 1e-6)) * depth_factor
        return np.clip(sigma, 0.1, 2.5).astype(np.float32)

    def compute_uq_metrics(
        self,
        predictions: np.ndarray,
        targets: np.ndarray,
        uncertainties: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """Computes empirical calibration and coverage error for predicted sigmas."""
        p_flat = predictions.flatten()
        t_flat = targets.flatten()
        u_flat = uncertainties.flatten()

        if mask is not None:
            m_flat = np.repeat(mask[None, :, :], predictions.shape[0], axis=0).flatten() if predictions.ndim == 3 else mask.flatten()
            valid = (m_flat > 0.5) & (~np.isnan(p_flat)) & (~np.isnan(t_flat))
        else:
            valid = (~np.isnan(p_flat)) & (~np.isnan(t_flat))

        p_val = p_flat[valid]
        t_val = t_flat[valid]
        u_val = u_flat[valid]

        errors = np.abs(p_val - t_val)
        # 1-sigma coverage (expected ~68.3%)
        cov_1sig = float(np.mean(errors <= u_val) * 100.0)
        # 2-sigma coverage (expected ~95.4%)
        cov_2sig = float(np.mean(errors <= 2.0 * u_val) * 100.0)
        mean_sharpness = float(np.mean(u_val))

        return {
            "coverage_1_sigma_pct": round(cov_1sig, 2),
            "coverage_2_sigma_pct": round(cov_2sig, 2),
            "mean_sharpness_sigma_c": round(mean_sharpness, 3),
            "calibration_status": "Calibrated" if abs(cov_1sig - 68.3) < 15.0 else "Needs Re-scaling"
        }


class ARGOValidationService:
    """
    Independent validation against in-situ CTD profiles from ARGO floats.
    """

    def __init__(self, standard_depths: Optional[List[float]] = None):
        self.standard_depths = standard_depths or STANDARD_DEPTHS

    def compare_with_float(
        self,
        model_profile: np.ndarray,
        float_profile: np.ndarray,
        float_wmo_id: str = "WMO_2901542",
        timestamp: str = "2026-03-10T12:00:00Z"
    ) -> Dict[str, Any]:
        """
        Matches reconstructed 15-depth profile against collocated in-situ ARGO CTD profile.
        Computes vertical stratified bias and root mean squared error.
        """
        p = np.array(model_profile, dtype=np.float32)
        t = np.array(float_profile, dtype=np.float32)

        valid = (~np.isnan(p)) & (~np.isnan(t))
        diff = p[valid] - t[valid]

        rmse = float(np.sqrt(np.mean(diff ** 2)))
        mae = float(np.mean(np.abs(diff)))
        bias = float(np.mean(diff))

        # Stratified layer metrics
        # Mixed Layer (0 - 50m): indices 0 to 5
        ml_diff = diff[:6] if len(diff) >= 6 else diff
        ml_rmse = float(np.sqrt(np.mean(ml_diff ** 2))) if len(ml_diff) > 0 else 0.0

        # Thermocline (50 - 200m): indices 5 to 10
        tc_diff = diff[5:11] if len(diff) >= 11 else diff
        tc_rmse = float(np.sqrt(np.mean(tc_diff ** 2))) if len(tc_diff) > 0 else 0.0

        # Deep Ocean (300 - 1000m): indices 11 to 14
        deep_diff = diff[11:] if len(diff) > 11 else diff
        deep_rmse = float(np.sqrt(np.mean(deep_diff ** 2))) if len(deep_diff) > 0 else 0.0

        return {
            "float_wmo_id": float_wmo_id,
            "timestamp": timestamp,
            "overall_rmse_c": round(rmse, 3),
            "overall_mae_c": round(mae, 3),
            "mean_bias_c": round(bias, 3),
            "layers": {
                "mixed_layer_0_50m_rmse": round(ml_rmse, 3),
                "thermocline_50_200m_rmse": round(tc_rmse, 3),
                "deep_ocean_300_1000m_rmse": round(deep_rmse, 3)
            }
        }
