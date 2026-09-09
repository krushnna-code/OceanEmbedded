"""
Output Product Generation Service Interface Stub.
Future placeholder for CF-compliant NetCDF/Zarr operational data products and INCOIS dissemination.
"""

from typing import Dict, Any, Optional


class OutputProductService:
    """
    Formats reconstructed ocean temperature volumes into standardized
    scientific formats (CF-1.8 compliant NetCDF4, OPeNDAP, Cloud-Optimized Zarr).
    """
    def export_netcdf(
        self,
        temperature_volume: Any,
        metadata: Dict[str, Any],
        output_path: str
    ) -> str:
        """
        Exports reconstructed field to CF-compliant NetCDF4.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("NetCDF export pipeline is deferred to later phase.")

    def export_zarr_store(
        self,
        temperature_volume: Any,
        zarr_path: str
    ) -> str:
        """
        Appends reconstructed timestep to chunked cloud Zarr archive.
        NOT IMPLEMENTED YET.
        """
        raise NotImplementedError("Zarr archive export is deferred to later phase.")
