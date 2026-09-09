"""
Validation & Metrics Services for OceanEmbed.
Provides quantitative evaluation against GLORYS12V1 reanalysis targets and ARGO in-situ profiles.
Calculates RMSE, MAE, Mean Bias, Pearson correlation, and R^2 across 15 standard ocean depths
and 3 regional sub-basins (Arabian Sea, Bay of Bengal, Equatorial Indian Ocean).
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


SUB_BASINS = {
    "Arabian Sea": {"min_lat": 10.0, "max_lat": 25.0, "min_lon": 50.0, "max_lon": 77.0},
    "Bay of Bengal": {"min_lat": 8.0, "max_lat": 22.0, "min_lon": 80.0, "max_lon": 98.0},
    "Equatorial Indian Ocean": {"min_lat": 5.0, "max_lat": 10.0, "min_lon": 60.0, "max_lon": 95.0}
}


class MetricsService:
    """
    Calculates oceanographic error, fidelity, and variance-explained metrics:
      - RMSE (Root Mean Squared Error)
      - MAE (Mean Absolute Error)
      - Mean Bias (Predicted - Target)
      - Pearson Correlation (r)
      - Coefficient of Determination (R^2)
      - Accuracy % (100 - MAPE)
    Broken down across 15 standard depths and regional sub-basins.
    """

    @staticmethod
    def compute_metrics(
        predicted: np.ndarray,
        target: np.ndarray,
        mask: Optional[np.ndarray] = None,
        depths: Optional[List[float]] = None,
        lats: Optional[List[float]] = None,
        lons: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Computes comprehensive evaluation metrics over the ocean domain.

        Args:
            predicted: [15, H, W] or [N, 15, H, W]
            target: [15, H, W] or [N, 15, H, W]
            mask: [H, W] or [N, H, W] (1=ocean, 0=land)
            depths: List of 15 standard depths
            lats: List of H latitudes
            lons: List of W longitudes
        """
        p = np.array(predicted, dtype=np.float64)
        t = np.array(target, dtype=np.float64)
        depth_list = depths or STANDARD_DEPTHS
        h = p.shape[-2]
        w = p.shape[-1]
        lat_arr = np.array(lats if lats is not None else np.linspace(5.0, 30.0, h))
        lon_arr = np.array(lons if lons is not None else np.linspace(45.0, 105.0, w))

        # Align dimensions if batch dimension present
        if p.ndim == 4:
            # Multi-sample batch: [N, D, H, W]
            n, num_d, _, _ = p.shape
            if mask is not None:
                if mask.ndim == 2:
                    ocean_mask = np.broadcast_to(mask > 0.5, (n, num_d, h, w))
                elif mask.ndim == 3:
                    ocean_mask = np.broadcast_to((mask > 0.5)[:, None, :, :], (n, num_d, h, w))
                else:
                    ocean_mask = (mask > 0.5)
            else:
                ocean_mask = (~np.isnan(p)) & (~np.isnan(t))
        else:
            # Single volume: [D, H, W]
            num_d = p.shape[0]
            if mask is not None:
                ocean_mask = np.broadcast_to(mask > 0.5, (num_d, h, w))
            else:
                ocean_mask = (~np.isnan(p)) & (~np.isnan(t))

        valid_mask = ocean_mask & (~np.isnan(p)) & (~np.isnan(t))
        p_valid = p[valid_mask]
        t_valid = t[valid_mask]

        if len(t_valid) == 0:
            raise ValueError("No valid ocean grid points found for metrics calculation.")

        # Overall domain metrics
        diff = p_valid - t_valid
        mae = float(np.mean(np.abs(diff)))
        rmse = float(np.sqrt(np.mean(diff ** 2)))
        bias = float(np.mean(diff))

        # Variance explained (R^2)
        ss_res = float(np.sum(diff ** 2))
        ss_tot = float(np.sum((t_valid - np.mean(t_valid)) ** 2))
        r2 = float(1.0 - (ss_res / ss_tot)) if ss_tot > 1e-8 else 0.0

        # Pearson correlation
        p_std = float(np.std(p_valid))
        t_std = float(np.std(t_valid))
        if p_std > 1e-6 and t_std > 1e-6:
            corr = float(np.corrcoef(p_valid, t_valid)[0, 1])
        else:
            corr = 0.0

        # Mean Absolute Percentage Error (MAPE) and accuracy percentage
        # Clamp denominator to >= 1.0 to avoid division by near-zero deep temperatures
        mape = float(np.mean(np.abs(diff) / np.maximum(t_valid, 1.0)) * 100.0)
        accuracy_pct = float(max(0.0, 100.0 - mape))

        # Per-depth breakdown
        depth_breakdown = []
        for d_idx, depth_val in enumerate(depth_list[:num_d]):
            if p.ndim == 4:
                d_mask = valid_mask[:, d_idx, :, :]
                d_p = p[:, d_idx, :, :][d_mask]
                d_t = t[:, d_idx, :, :][d_mask]
            else:
                d_mask = valid_mask[d_idx, :, :]
                d_p = p[d_idx, :, :][d_mask]
                d_t = t[d_idx, :, :][d_mask]

            if len(d_t) > 0:
                d_diff = d_p - d_t
                d_mae = float(np.mean(np.abs(d_diff)))
                d_rmse = float(np.sqrt(np.mean(d_diff ** 2)))
                d_bias = float(np.mean(d_diff))
                d_ss_res = float(np.sum(d_diff ** 2))
                d_ss_tot = float(np.sum((d_t - np.mean(d_t)) ** 2))
                d_r2 = float(1.0 - (d_ss_res / d_ss_tot)) if d_ss_tot > 1e-8 else 0.0
                d_mape = float(np.mean(np.abs(d_diff) / np.maximum(d_t, 1.0)) * 100.0)
                d_acc = float(max(0.0, 100.0 - d_mape))
                d_p_std = float(np.std(d_p))
                d_t_std = float(np.std(d_t))
                d_corr = float(np.corrcoef(d_p, d_t)[0, 1]) if d_p_std > 1e-6 and d_t_std > 1e-6 else 0.0

                depth_breakdown.append({
                    "depth_m": float(depth_val),
                    "mae_c": round(d_mae, 4),
                    "rmse_c": round(d_rmse, 4),
                    "bias_c": round(d_bias, 4),
                    "r2_score": round(d_r2, 4),
                    "correlation": round(d_corr, 4),
                    "accuracy_pct": round(d_acc, 2),
                    "target_mean_c": round(float(np.mean(d_t)), 2),
                    "pred_mean_c": round(float(np.mean(d_p)), 2)
                })

        # Regional Sub-Basin Breakdown
        sub_basin_metrics = {}
        for basin_name, bounds in SUB_BASINS.items():
            lat_in_basin = (lat_arr >= bounds["min_lat"]) & (lat_arr <= bounds["max_lat"])
            lon_in_basin = (lon_arr >= bounds["min_lon"]) & (lon_arr <= bounds["max_lon"])
            region_spatial = np.outer(lat_in_basin, lon_in_basin)

            if p.ndim == 4:
                region_3d = np.broadcast_to(region_spatial[None, None, :, :], (n, num_d, h, w))
            else:
                region_3d = np.broadcast_to(region_spatial[None, :, :], (num_d, h, w))

            reg_valid = valid_mask & region_3d
            reg_p = p[reg_valid]
            reg_t = t[reg_valid]

            if len(reg_t) > 0:
                reg_diff = reg_p - reg_t
                reg_mae = float(np.mean(np.abs(reg_diff)))
                reg_rmse = float(np.sqrt(np.mean(reg_diff ** 2)))
                reg_bias = float(np.mean(reg_diff))
                reg_ss_res = float(np.sum(reg_diff ** 2))
                reg_ss_tot = float(np.sum((reg_t - np.mean(reg_t)) ** 2))
                reg_r2 = float(1.0 - (reg_ss_res / reg_ss_tot)) if reg_ss_tot > 1e-8 else 0.0
                reg_mape = float(np.mean(np.abs(reg_diff) / np.maximum(reg_t, 1.0)) * 100.0)
                reg_acc = float(max(0.0, 100.0 - reg_mape))
                reg_p_std = float(np.std(reg_p))
                reg_t_std = float(np.std(reg_t))
                reg_corr = float(np.corrcoef(reg_p, reg_t)[0, 1]) if reg_p_std > 1e-6 and reg_t_std > 1e-6 else 0.0

                sub_basin_metrics[basin_name] = {
                    "mae_c": round(reg_mae, 4),
                    "rmse_c": round(reg_rmse, 4),
                    "bias_c": round(reg_bias, 4),
                    "r2_score": round(reg_r2, 4),
                    "correlation": round(reg_corr, 4),
                    "accuracy_pct": round(reg_acc, 2),
                    "sample_count": int(len(reg_t))
                }

        return {
            "status": "validated",
            "overall": {
                "rmse_c": round(rmse, 4),
                "mae_c": round(mae, 4),
                "bias_c": round(bias, 4),
                "r2_score": round(r2, 4),
                "correlation": round(corr, 4),
                "accuracy_pct": round(accuracy_pct, 2),
                "total_valid_points": int(len(t_valid))
            },
            "depth_breakdown": depth_breakdown,
            "sub_basins": sub_basin_metrics,
            "target_dataset": "GLORYS12V1 Reanalysis Target",
            "protocol": "North Indian Ocean 0.25° Resolution Physics-Aware Evaluation"
        }

    @staticmethod
    def compute_synthetic_smoke_metrics(
        predicted: np.ndarray,
        target: np.ndarray
    ) -> Dict[str, Any]:
        """Backward-compatible quick smoke test."""
        return MetricsService.compute_metrics(predicted, target)


class GLORYSValidationService:
    """
    Compares OceanEmbed reconstruction outputs against GLORYS12V1 reanalysis.
    """

    def __init__(self, target_depths: Optional[List[float]] = None):
        self.target_depths = target_depths or STANDARD_DEPTHS

    def validate_reconstruction(
        self,
        predicted_temp: np.ndarray,
        glorys_temp: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Runs full comparative validation between model prediction and GLORYS reanalysis.
        """
        metrics = MetricsService.compute_metrics(
            predicted=predicted_temp,
            target=glorys_temp,
            mask=mask,
            depths=self.target_depths
        )
        metrics["target_type"] = "GLORYS12V1 Global Reanalysis (Dense Target)"
        metrics["note"] = "GLORYS12V1 is treated as training target reference, not strict in-situ truth."
        return metrics


class ARGOValidationService:
    """
    Compares OceanEmbed reconstruction outputs against independent in-situ ARGO float profiles.
    """

    def __init__(self, target_depths: Optional[List[float]] = None):
        self.target_depths = target_depths or STANDARD_DEPTHS

    def validate_against_argo_profiles(
        self,
        predicted_volume: np.ndarray,
        argo_profiles: List[Dict[str, Any]],
        date_str: str = "2026-03-10"
    ) -> Dict[str, Any]:
        """
        Evaluates predictions against a collection of collocated ARGO float observations.
        """
        profile_results = []
        overall_diffs = []

        for p in argo_profiles:
            wmo_id = p.get("wmo_id", "ARGO_UNKNOWN")
            obs_temp = np.array(p.get("temperature", []), dtype=np.float32)
            model_temp = np.array(p.get("model_profile", []), dtype=np.float32)

            if len(obs_temp) == len(model_temp) and len(obs_temp) > 0:
                diff = model_temp - obs_temp
                overall_diffs.extend(diff.tolist())
                rmse = float(np.sqrt(np.mean(diff ** 2)))
                mae = float(np.mean(np.abs(diff)))

                profile_results.append({
                    "wmo_id": wmo_id,
                    "lat": p.get("lat"),
                    "lon": p.get("lon"),
                    "rmse_c": round(rmse, 3),
                    "mae_c": round(mae, 3)
                })

        if len(overall_diffs) > 0:
            all_d = np.array(overall_diffs)
            tot_rmse = float(np.sqrt(np.mean(all_d ** 2)))
            tot_mae = float(np.mean(np.abs(all_d)))
            tot_bias = float(np.mean(all_d))
        else:
            tot_rmse = 0.0
            tot_mae = 0.0
            tot_bias = 0.0

        return {
            "status": "validated",
            "date": date_str,
            "total_argo_floats": len(profile_results),
            "benchmark_target": "INCOIS / Coriolis ARGO In-Situ Profiles (Strict Holdout)",
            "overall_rmse_c": round(tot_rmse, 3),
            "overall_mae_c": round(tot_mae, 3),
            "mean_bias_c": round(tot_bias, 3),
            "profile_evaluations": profile_results
        }
