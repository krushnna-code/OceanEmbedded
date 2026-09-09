"""
Preprocessing and Regridding Interface Stubs.
Designed to align with Section 7A real product schemas without implementing
the full harmonization pipeline in this phase.
"""

from typing import Dict, Any, Optional
import numpy as np


class PreprocessingService:
    """
    Interface specification for future data ingestion & regridding pipeline.
    Connects real satellite products (OSTIA, CCMP, DUACS, CMEMS) onto the
    North Indian Ocean 0.25° grid (101 x 241).
    """

    def regrid_to_target_grid(
        self,
        data: np.ndarray,
        source_resolution_deg: float,
        target_resolution_deg: float = 0.25,
        method: str = "bilinear"
    ) -> np.ndarray:
        """
        Regrid a single product's array onto the North Indian Ocean 0.25° target grid.
        NOT IMPLEMENTED YET (later phase deliverable).
        """
        raise NotImplementedError("Production regridding is deferred to the full pipeline phase.")

    def convert_units(
        self,
        data: np.ndarray,
        source_units: str,
        target_units: str
    ) -> np.ndarray:
        """
        Harmonize units (e.g., OSTIA SST Kelvin -> Celsius by subtracting 273.15).
        NOT IMPLEMENTED YET (later phase deliverable).
        """
        raise NotImplementedError("Production unit conversion is deferred to the full pipeline phase.")

    def align_timestamps(
        self,
        products_by_date: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Harmonize mismatched per-product dates/times onto a common daily T=7 index.
        NOT IMPLEMENTED YET (later phase deliverable).
        """
        raise NotImplementedError("Production temporal harmonization is deferred to the full pipeline phase.")

    def apply_land_sea_mask(
        self,
        data: np.ndarray,
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Applies standardized land-sea mask to surface observation tensors.
        NOT IMPLEMENTED YET (later phase deliverable).
        """
        raise NotImplementedError("Production masking is deferred to the full pipeline phase.")
