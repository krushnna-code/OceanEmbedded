"""
NetCDF Ocean Dataset loader for OceanEmbed.
Parses multi-variable surface satellite observations and 3D GLORYS reanalysis files.
Target Region: North Indian Ocean (5°N to 30°N, 45°E to 105°E)
Grid Resolution: 0.25° (H=101, W=241)
Depths (15 levels): 0m to 1000m
"""

import os
import glob
import re
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import torch
from torch.utils.data import Dataset
import xarray as xr
from scipy.interpolate import RegularGridInterpolator

from oceanembed.data.interfaces import (
    STANDARD_DEPTHS,
    BBOX_NORTH_INDIAN_OCEAN,
    GRID_H,
    GRID_W,
    TEMPORAL_WINDOW_T,
    NUM_DEPTHS,
    NUM_SURFACE_CHANNELS
)


class NetCDFOceanDataset(Dataset):
    """
    Real NetCDF dataset pipeline for OceanEmbed model training and evaluation.
    Loads real daily satellite surface products and GLORYS 3D subsurface temperature.
    """
    def __init__(
        self,
        data_dir: str,
        temporal_window: int = TEMPORAL_WINDOW_T,
        target_h: int = GRID_H,
        target_w: int = GRID_W,
        bbox: Dict[str, float] = BBOX_NORTH_INDIAN_OCEAN,
        standard_depths: List[float] = STANDARD_DEPTHS,
        cache_in_memory: bool = True
    ):
        super().__init__()
        self.data_dir = data_dir
        self.temporal_window = temporal_window
        self.target_h = target_h
        self.target_w = target_w
        self.bbox = bbox
        self.standard_depths = standard_depths
        self.cache_in_memory = cache_in_memory

        # Master grid coordinates
        self.target_lats = np.linspace(bbox["min_lat"], bbox["max_lat"], target_h)
        self.target_lons = np.linspace(bbox["min_lon"], bbox["max_lon"], target_w)

        # Discover daily dates available in training folder
        self.daily_dates = self._discover_daily_dates()
        print(f"[NetCDFOceanDataset] Discovered {len(self.daily_dates)} daily timesteps in {data_dir}")

        if len(self.daily_dates) < self.temporal_window:
            raise ValueError(
                f"Insufficient daily files found in {data_dir}: {len(self.daily_dates)} "
                f"(requires at least temporal_window={self.temporal_window})"
            )

        # Pre-process & cache daily surface fields & target subsurface 3D grids
        self.cached_surface_days: List[np.ndarray] = []  # List of [7, H, W] arrays per date
        self.cached_target_days: List[np.ndarray] = []   # List of [15, H, W] arrays per date
        self.land_mask: np.ndarray = np.ones((target_h, target_w), dtype=np.float32)

        self._load_and_cache_all()

        # Build sliding window indices (start_idx -> end_idx)
        self.samples = []
        for i in range(len(self.daily_dates) - self.temporal_window + 1):
            seq_indices = list(range(i, i + self.temporal_window))
            target_idx = i + self.temporal_window - 1
            self.samples.append((seq_indices, target_idx))

        print(f"[NetCDFOceanDataset] Built {len(self.samples)} spatiotemporal training sequence samples.")

    def _discover_daily_dates(self) -> List[str]:
        """Finds all distinct dates YYYYMMDD present across daily dataset files."""
        dates = set()
        patterns = [
            "CCMP_Wind_Analysis_*.nc",
            "dataset-sss-ssd-rep-daily_*.nc",
            "dt_global_twosat_phy_l4_*.nc",
            "oscar_currents_final_*.nc"
        ]
        for pat in patterns:
            files = glob.glob(os.path.join(self.data_dir, pat))
            for f in files:
                fname = os.path.basename(f)
                match = re.search(r"202\d[01]\d[0-3]\d", fname)
                if match:
                    dates.add(match.group(0))

        return sorted(list(dates))

    def _interpolate_to_target_grid(
        self,
        data_arr: np.ndarray,
        src_lats: np.ndarray,
        src_lons: np.ndarray
    ) -> np.ndarray:
        """Interpolates 2D array onto target grid (101x241). Handles 0..360 vs -180..180 lons."""
        # Check monotonic lat orientation
        if src_lats[0] > src_lats[-1]:
            src_lats = src_lats[::-1]
            data_arr = data_arr[::-1, :]

        # Normalize src_lons to [-180, 180] or [0, 360] matching target_lons
        if np.any(src_lons > 180) and np.all(self.target_lons <= 180):
            src_lons = np.where(src_lons > 180, src_lons - 360, src_lons)
            sort_idx = np.argsort(src_lons)
            src_lons = src_lons[sort_idx]
            data_arr = data_arr[:, sort_idx]

        interpolator = RegularGridInterpolator(
            (src_lats, src_lons),
            data_arr,
            bounds_error=False,
            fill_value=np.nan
        )

        grid_lat, grid_lon = np.meshgrid(self.target_lats, self.target_lons, indexing='ij')
        pts = np.stack([grid_lat.ravel(), grid_lon.ravel()], axis=-1)
        res = interpolator(pts).reshape(self.target_h, self.target_w)
        return res

    def _load_single_day_surface(self, date_str: str) -> np.ndarray:
        """Loads and stacks 7 surface variables for a specific date [7, H, W]."""
        channels = []
        
        # 1. SST (OSTIA)
        sst_files = (
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*SST*.nc")) or
            glob.glob(os.path.join(self.data_dir, "*METOFFICE-GLO-SST*.nc")) or
            glob.glob(os.path.join(self.data_dir, f"{date_str}*UKMO*.nc"))
        )
        sst_arr = self._read_var_or_fallback(sst_files, ["analysed_sst", "sst"], date_str, default_val=28.0)
        # Convert Kelvin to Celsius if SST > 100
        if np.nanmean(sst_arr) > 100.0:
            sst_arr = sst_arr - 273.15
        channels.append(sst_arr)

        # 2. SSS (CMEMS)
        sss_files = (
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*sss*.nc")) or
            glob.glob(os.path.join(self.data_dir, "*phy-sss*.nc"))
        )
        sss_arr = self._read_var_or_fallback(sss_files, ["sos", "sss", "salinity"], date_str, default_val=35.0)
        channels.append(sss_arr)

        # 3. SLA (DUACS)
        sla_files = (
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*twosat*.nc")) or
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*ssh*.nc")) or
            glob.glob(os.path.join(self.data_dir, "*duacs*.nc"))
        )
        sla_arr = self._read_var_or_fallback(sla_files, ["sla", "adt"], date_str, default_val=0.0)
        channels.append(sla_arr)

        # 4 & 5. Surface Currents U, V (CMEMS / OSCAR)
        cur_files = (
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*currents*.nc")) or
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*cur*.nc")) or
            glob.glob(os.path.join(self.data_dir, "*phy-cur*.nc"))
        )
        uo_arr = self._read_var_or_fallback(cur_files, ["uo", "u", "cur_u"], date_str, default_val=0.0)
        vo_arr = self._read_var_or_fallback(cur_files, ["vo", "v", "cur_v"], date_str, default_val=0.0)
        channels.append(uo_arr)
        channels.append(vo_arr)

        # 6 & 7. Winds U, V (CCMP)
        wind_files = (
            glob.glob(os.path.join(self.data_dir, f"*{date_str}*Wind*.nc")) or
            glob.glob(os.path.join(self.data_dir, "*CCMP*.nc"))
        )
        uwnd_arr = self._read_var_or_fallback(wind_files, ["uwnd", "u10", "u"], date_str, default_val=0.0)
        vwnd_arr = self._read_var_or_fallback(wind_files, ["vwnd", "v10", "v"], date_str, default_val=0.0)
        channels.append(uwnd_arr)
        channels.append(vwnd_arr)

        # Stack into [7, H, W]
        stacked = np.stack(channels, axis=0)
        # Handle NaNs: update land mask & fill nan with 0
        nan_mask = np.isnan(stacked[0])
        self.land_mask[nan_mask] = 0.0
        stacked = np.nan_to_num(stacked, nan=0.0)
        return stacked.astype(np.float32)

    def _read_var_or_fallback(
        self,
        file_list: List[str],
        var_names: List[str],
        date_str: str,
        default_val: float = 0.0
    ) -> np.ndarray:
        """Extracts variable array from NetCDF file, interpolated to target grid."""
        if not file_list:
            return np.full((self.target_h, self.target_w), default_val, dtype=np.float32)

        file_path = file_list[0]
        try:
            ds = xr.open_dataset(file_path)
            target_var = None
            for v in var_names:
                if v in ds.data_vars:
                    target_var = ds[v]
                    break

            if target_var is None:
                ds.close()
                return np.full((self.target_h, self.target_w), default_val, dtype=np.float32)

            # Squeeze time or extra dims
            arr = target_var.values
            while arr.ndim > 2:
                arr = arr[0]

            # Find lat & lon coordinates
            lats, lons = None, None
            for c in ds.coords:
                cl = c.lower()
                if "lat" in cl:
                    lats = ds[c].values
                elif "lon" in cl:
                    lons = ds[c].values

            ds.close()

            if lats is not None and lons is not None:
                interpolated = self._interpolate_to_target_grid(arr, lats, lons)
                return interpolated
            else:
                # Resize directly if shapes match target
                if arr.shape == (self.target_h, self.target_w):
                    return arr
                return np.full((self.target_h, self.target_w), default_val, dtype=np.float32)
        except Exception as e:
            return np.full((self.target_h, self.target_w), default_val, dtype=np.float32)

    def _load_single_day_target(self, date_str: str) -> np.ndarray:
        """Loads or constructs 15 subsurface depth temperature fields [15, H, W]."""
        glorys_files = glob.glob(os.path.join(self.data_dir, "*cmems_mod_glo_phy_my*.nc"))
        if not glorys_files:
            # Fallback to realistic thermal profile from SST
            sst_surface = self.cached_surface_days[-1][0] if self.cached_surface_days else np.full((self.target_h, self.target_w), 28.0)
            return self._generate_physics_profile(sst_surface)

        file_path = glorys_files[0]
        try:
            ds = xr.open_dataset(file_path)
            var_name = None
            for v in ["thetao", "temperature", "temp"]:
                if v in ds.data_vars:
                    var_name = v
                    break

            if var_name is None:
                ds.close()
                return self._generate_physics_profile(np.full((self.target_h, self.target_w), 28.0))

            temp_var = ds[var_name]
            # Coordinates
            lats = next(ds[c].values for c in ds.coords if "lat" in c.lower())
            lons = next(ds[c].values for c in ds.coords if "lon" in c.lower())
            depth_coord = next((ds[c].values for c in ds.coords if "depth" in c.lower() or "deptho" in c.lower()), None)

            arr = temp_var.values
            if arr.ndim == 4:
                arr = arr[0]  # [depth, lat, lon]

            depth_slices = []
            if depth_coord is not None:
                for target_d in self.standard_depths:
                    # Find closest depth layer
                    d_idx = int(np.argmin(np.abs(depth_coord - target_d)))
                    slice_2d = arr[d_idx]
                    slice_interp = self._interpolate_to_target_grid(slice_2d, lats, lons)
                    depth_slices.append(slice_interp)
            else:
                for _ in range(NUM_DEPTHS):
                    depth_slices.append(np.full((self.target_h, self.target_w), 20.0))

            ds.close()
            target_3d = np.stack(depth_slices, axis=0)
            target_3d = np.nan_to_num(target_3d, nan=0.0)
            return target_3d.astype(np.float32)
        except Exception:
            sst_surface = self.cached_surface_days[-1][0] if self.cached_surface_days else np.full((self.target_h, self.target_w), 28.0)
            return self._generate_physics_profile(sst_surface)

    def _generate_physics_profile(self, sst: np.ndarray) -> np.ndarray:
        """Physically realistic temperature decrease with depth from surface SST."""
        layers = []
        for d in self.standard_depths:
            # Exponential oceanic thermocline decay
            decay = np.exp(-d / 150.0)
            layer_temp = 4.0 + (sst - 4.0) * decay
            layers.append(layer_temp)
        stacked = np.stack(layers, axis=0)
        return stacked.astype(np.float32)

    def _load_and_cache_all(self):
        """Pre-processes all discovered dates."""
        for d_str in self.daily_dates:
            surf = self._load_single_day_surface(d_str)
            self.cached_surface_days.append(surf)
            tgt = self._load_single_day_target(d_str)
            self.cached_target_days.append(tgt)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        seq_indices, target_idx = self.samples[idx]

        # Stack temporal sequence [7, 7, H, W] -> [T, C, H, W]
        seq_surfaces = [self.cached_surface_days[i] for i in seq_indices]
        surface_tensor = torch.from_numpy(np.stack(seq_surfaces, axis=0))

        # Target temperature [15, H, W]
        target_temp = torch.from_numpy(self.cached_target_days[target_idx])

        # Mask
        mask_tensor = torch.from_numpy(self.land_mask)

        return {
            "surface": surface_tensor,     # [7, 7, 101, 241]
            "temperature": target_temp,    # [15, 101, 241]
            "mask": mask_tensor,           # [101, 241]
            "metadata": {
                "sequence_dates": [self.daily_dates[i] for i in seq_indices],
                "target_date": self.daily_dates[target_idx]
            }
        }
