"""
Inspection and validation utility for development NetCDF fixtures.
Validates real product schemas against Section 7A specifications.
"""

import os
from typing import Dict, Any, List, Optional
import xarray as xr


EXPECTED_FIXTURE_SCHEMAS = {
    "wind": {
        "pattern": "CCMP_Wind_Analysis",
        "variables": ["uwnd", "vwnd"],
        "units": {"uwnd": "m s-1", "vwnd": "m s-1"},
        "expected_lat_bounds": (-89.875, 89.875),
        "expected_lon_bounds": (0.125, 359.875)  # 0 to 360 convention
    },
    "sst": {
        "pattern": "METOFFICE-GLO-SST",
        "variables": ["analysed_sst"],
        "units": {"analysed_sst": "kelvin"},
        "expected_lat_bounds": (-89.975, 89.975),
        "expected_lon_bounds": (-179.975, 179.975)
    },
    "ssh": {
        "pattern": "c3s_obs-sl_glo_phy-ssh",
        "variables": ["sla", "adt"],
        "units": {"sla": "m", "adt": "m"},
        "expected_lat_bounds": (-89.875, 89.875),
        "expected_lon_bounds": (-179.875, 179.875)
    },
    "currents": {
        "pattern": "cmems_obs-mob_glo_phy-cur",
        "variables": ["uo", "vo"],
        "units": {"uo": "m/s", "vo": "m/s"},
        "expected_lat_bounds": (-89.875, 89.875),
        "expected_lon_bounds": (-179.875, 179.875)
    },
    "sss": {
        "pattern": "cmems_obs-mob_glo_phy-sss",
        "variables": ["sos"],
        "units": {"sos": [".001", "0.001", "psu", "PSU"]},
        "expected_lat_bounds": (-89.9375, 89.9375),
        "expected_lon_bounds": (-179.9375, 179.9375)
    }
}


def inspect_dev_fixture(file_path: str) -> Dict[str, Any]:
    """
    Opens a single NetCDF development fixture and extracts its schema metadata:
    variable names, units, shapes, and spatial bounding box.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Fixture file not found: {file_path}")
        
    ds = xr.open_dataset(file_path)
    
    variables_info = {}
    for v in ds.data_vars:
        var = ds[v]
        variables_info[v] = {
            "shape": list(var.shape),
            "dtype": str(var.dtype),
            "units": var.attrs.get("units", "N/A"),
            "long_name": var.attrs.get("long_name", "")
        }
        
    coords_info = {}
    lat_coord = None
    lon_coord = None
    for c in ds.coords:
        c_lower = c.lower()
        coords_info[c] = {
            "size": len(ds[c]),
            "min": float(ds[c].min()),
            "max": float(ds[c].max())
        }
        if "lat" in c_lower:
            lat_coord = ds[c]
        elif "lon" in c_lower:
            lon_coord = ds[c]
            
    summary = {
        "filename": os.path.basename(file_path),
        "file_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
        "dimensions": {k: int(v) for k, v in ds.sizes.items()},
        "variables": variables_info,
        "coordinates": coords_info,
        "covers_north_indian_ocean": False
    }
    
    # Check if bounds cover 5-30N and 45-105E
    if lat_coord is not None and lon_coord is not None:
        min_lat = float(lat_coord.min())
        max_lat = float(lat_coord.max())
        min_lon = float(lon_coord.min())
        max_lon = float(lon_coord.max())
        
        # Longitude could be [-180, 180] or [0, 360]
        lat_covers = (min_lat <= 5.0 and max_lat >= 30.0)
        if min_lon >= 0 and max_lon > 180:
            # 0 to 360 convention covers 45 to 105
            lon_covers = (min_lon <= 45.0 and max_lon >= 105.0)
        else:
            # -180 to 180 convention covers 45 to 105
            lon_covers = (min_lon <= 45.0 and max_lon >= 105.0)
            
        summary["covers_north_indian_ocean"] = (lat_covers and lon_covers)
        summary["lat_bounds"] = (min_lat, max_lat)
        summary["lon_bounds"] = (min_lon, max_lon)
        
    ds.close()
    return summary
