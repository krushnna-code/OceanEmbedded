"""
Validation & Metrics Service Interfaces (Deferred Phase).
Per Section 28 of OceanEmbed Specification:
  - GLORYSValidationService: Compares model output to GLORYS12V1 (dense reanalysis, explicitly NOT ground truth).
  - ARGOValidationService: Compares model output to independent ARGO float profiles (strict train/val holdout).
  - MetricsService: Computes RMSE, MAE, bias, Pearson correlation, R^2 per depth and geographic sub-basin.

Real data validation is deferred until matched multi-day observation datasets and regridded GLORYS targets are ready.
These stubs establish the frozen software interface contract.
"""

from typing import Dict, Any, List, Optional
import numpy as np


class GLORYSValidationService:
    """
    Compares OceanEmbed reconstruction outputs against GLORYS12V1 reanalysis.
    NOTE: GLORYS12V1 is a dense reanalysis training target, EXPLICITLY NOT treated as ground truth.
    """

    def __init__(self, target_depths: Optional[List[float]] = None):
        self.target_depths = target_depths or [
            0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0,
            125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0
        ]

    def validate_reconstruction(
        self,
        predicted_temp: np.ndarray,
        glorys_temp: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Compare [15, 101, 241] prediction with [15, 101, 241] GLORYS reanalysis field.
        Raises NotImplementedError as production validation pipeline is deferred.
        """
        raise NotImplementedError(
            "GLORYS12V1 validation pipeline is deferred. "
            "GLORYS12V1 is a dense reanalysis target, not ground truth."
        )


class ARGOValidationService:
    """
    Compares OceanEmbed reconstruction outputs against independent in-situ ARGO float profiles.
    NOTE: ARGO profiles are STRICTLY HELD OUT from training and used exclusively for validation.
    """

    def __init__(self, target_depths: Optional[List[float]] = None):
        self.target_depths = target_depths or [
            0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0,
            125.0, 150.0, 200.0, 300.0, 500.0, 700.0, 1000.0
        ]

    def validate_against_argo_profiles(
        self,
        predicted_volume: np.ndarray,
        argo_profiles: List[Dict[str, Any]],
        date_str: str
    ) -> Dict[str, Any]:
        """
        Extracts column predictions at ARGO float locations (lat, lon) and evaluates vertical fidelity.
        Strict train/val holdout enforced at dataset splitting level.
        Raises NotImplementedError in this phase.
        """
        raise NotImplementedError(
            "ARGO independent float validation is deferred to Layer 4 implementation."
        )


class MetricsService:
    """
    Calculates oceanographic error and fidelity metrics:
      - RMSE (Root Mean Squared Error)
      - MAE (Mean Absolute Error)
      - Mean Bias (Predicted - Target)
      - Pearson Correlation (r)
      - Coefficient of Determination (R^2)
    Broken down across 15 vertical standard depth levels and key basins:
      - Arabian Sea (AS)
      - Bay of Bengal (BoB)
      - Equatorial Indian Ocean (EIO)
    """

    @staticmethod
    def compute_metrics(
        predicted: np.ndarray,
        target: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Production metrics computation for real data.
        Deferred until Layer 4 validation pipeline is integrated.
        """
        raise NotImplementedError("Production validation metrics calculation is deferred.")

    @staticmethod
    def compute_synthetic_smoke_metrics(
        predicted: np.ndarray,
        target: np.ndarray
    ) -> Dict[str, Any]:
        """
        Purely for smoke testing interface tensor shapes with synthetic data.
        ALWAYS explicitly labeled 'SYNTHETIC / DEMO METRIC'.
        """
        pred_flat = predicted.flatten()
        targ_flat = target.flatten()
        diff = pred_flat - targ_flat
        
        rmse = float(np.sqrt(np.mean(diff ** 2)))
        mae = float(np.mean(np.abs(diff)))
        bias = float(np.mean(diff))
        
        # Pearson correlation
        pred_std = np.std(pred_flat)
        targ_std = np.std(targ_flat)
        if pred_std > 1e-6 and targ_std > 1e-6:
            corr = float(np.corrcoef(pred_flat, targ_flat)[0, 1])
        else:
            corr = 0.0

        return {
            "status": "DEMO / MODEL DEVELOPMENT DATA (SYNTHETIC SMOKE TEST ONLY)",
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "bias": round(bias, 4),
            "correlation": round(corr, 4),
            "note": "Not scientifically validated; synthetic placeholder only."
        }
