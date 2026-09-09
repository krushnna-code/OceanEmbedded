"""
Anomaly and Uncertainty Analysis Service Interface Stub.
Future placeholder for ARGO validation, residual modeling, and probabilistic uncertainty.
"""

from typing import Dict, Any, Optional
import numpy as np


class AnomalyDetectionService:
    """
    Interface specification for thermal anomaly detection, marine heatwave (MHW) identification,
    and subsurface barrier layer anomaly tracking.
    """
    def compute_climatological_anomaly(
        self,
        temperature_field: np.ndarray,
        climatology_field: np.ndarray
    ) -> np.ndarray:
        """
        Computes deviation from 30-year climatological baseline.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Climatological anomaly engine is deferred to later pipeline phase.")

    def detect_marine_heatwaves(
        self,
        temperature_series: np.ndarray,
        threshold_percentile: float = 90.0
    ) -> Dict[str, Any]:
        """
        Detects marine heatwave events according to Hobday et al. (2016) criteria.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("MHW detection is deferred to later pipeline phase.")


class UncertaintyService:
    """
    Interface specification for formal uncertainty quantification (UQ).
    """
    def estimate_depth_uncertainty(
        self,
        latent_embedding: np.ndarray,
        depth: float
    ) -> np.ndarray:
        """
        Estimates variance/confidence intervals for predicted depth levels.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Uncertainty estimation is deferred to later pipeline phase.")


class ARGOValidationService:
    """
    Interface specification for independent validation against INCOIS / Coriolis ARGO floats.
    """
    def compare_with_float(
        self,
        model_profile: np.ndarray,
        float_wmo_id: str,
        timestamp: str
    ) -> Dict[str, Any]:
        """
        Matches reconstructed 15-depth profile against collocated in-situ ARGO CTD profile.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("ARGO float validation engine is deferred to later pipeline phase.")
