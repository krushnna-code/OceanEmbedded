"""
Preprocessing Service Interface Stub.
Sketched with Section 7A schema-compliant method signatures per Section 47.
"""

from typing import Dict, Any, Optional
import numpy as np


class PreprocessingService:
    """
    Service responsible for raw NetCDF/GRIB satellite data harmonization.
    Converts diverse observational grids, units, and timestamps into
    standardized tensors for OceanEmbed consumption.
    """

    def regrid_to_target_grid(
        self,
        data: np.ndarray,
        source_resolution_deg: float,
        target_resolution_deg: float = 0.25,
        method: str = "bilinear"
    ) -> np.ndarray:
        """
        Regrid a single product's array onto the North Indian Ocean 0.25 deg target grid.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Production regridding is deferred to the full pipeline phase.")

    def convert_units(
        self,
        data: np.ndarray,
        source_units: str,
        target_units: str
    ) -> np.ndarray:
        """
        Converts real product units to model standards:
        E.g. OSTIA SST Kelvin -> Celsius (subtract 273.15).
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Production unit conversion is deferred to the full pipeline phase.")

    def align_timestamps(
        self,
        products_by_date: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Harmonizes mismatched per-product observation timestamps onto common daily T=7 sequence.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Production temporal harmonization is deferred to the full pipeline phase.")

    def apply_land_sea_mask(
        self,
        data: np.ndarray,
        mask: np.ndarray
    ) -> np.ndarray:
        """
        Standardizes land/sea masking across heterogeneous satellite masks.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Production masking is deferred to the full pipeline phase.")

    def interpolate_glorys_depths(
        self,
        glorys_50_level_field: np.ndarray,
        target_depths: Optional[list] = None
    ) -> np.ndarray:
        """
        GLORYS 50 vertical levels -> 15 standard target depths (0 - 1000m).
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("GLORYS depth vertical interpolation is deferred to the full pipeline phase.")

