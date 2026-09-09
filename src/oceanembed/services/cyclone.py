"""
Tropical Cyclone Heat Content (TCHC) Diagnostic Service.
Computes the 26°C isotherm depth (D26) and integrates oceanic sensible heat
down to D26 to estimate thermal potential for tropical cyclone rapid intensification (RI).
Standard physical formulation: TCHC = rho * Cp * Integral_0^D26 (T(z) - 26) dz (kJ/cm^2)
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np

from oceanembed.data.interfaces import STANDARD_DEPTHS, GRID_H, GRID_W


# Standard oceanographic constants
RHO_SEAWATER = 1025.0  # kg/m^3 (mean seawater density)
CP_SEAWATER = 3990.0   # J/(kg * K) (specific heat capacity of seawater)
# 1 J/m^2 = 10^-7 kJ/cm^2 -> RHO * CP * 10^-7 = 0.408975 kJ/(cm^2 * m * °C)
RHO_CP_FACTOR = (RHO_SEAWATER * CP_SEAWATER) * 1e-7  # ~0.409 kJ/(cm^2 * m * °C)

# Regional boundaries for North Indian Ocean cyclogenesis basins
SUB_BASIN_BOUNDS = {
    "Bay of Bengal": {"min_lat": 8.0, "max_lat": 22.0, "min_lon": 80.0, "max_lon": 98.0},
    "Arabian Sea": {"min_lat": 10.0, "max_lat": 25.0, "min_lon": 50.0, "max_lon": 77.0},
    "Equatorial Indian Ocean": {"min_lat": 5.0, "max_lat": 10.0, "min_lon": 60.0, "max_lon": 95.0}
}


class CycloneHeatService:
    """
    Computes Tropical Cyclone Heat Content (TCHC) and evaluates rapid intensification (RI) risk.
    """

    def __init__(self, standard_depths: Optional[List[float]] = None):
        self.depths = np.array(standard_depths or STANDARD_DEPTHS, dtype=np.float32)
        self.grid_lats = np.linspace(5.0, 30.0, GRID_H)
        self.grid_lons = np.linspace(45.0, 105.0, GRID_W)

    def compute_d26(
        self,
        temperature_volume: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Calculates the depth (in meters) of the 26°C isotherm (D26).
        Linearly interpolates between standard depth levels.

        Args:
            temperature_volume: [15, H, W] temperature field (°C)
            mask: Optional ocean/land mask (1=ocean, 0=land)

        Returns:
            d26_grid: [H, W] depth in meters (0 if surface < 26°C, NaN for land)
        """
        vol = np.array(temperature_volume, dtype=np.float32)
        h, w = vol.shape[1], vol.shape[2]
        d26_grid = np.zeros((h, w), dtype=np.float32)

        # Iterate over 2D grid coordinates
        for i in range(h):
            for j in range(w):
                if mask is not None and mask[i, j] <= 0.5:
                    d26_grid[i, j] = np.nan
                    continue

                profile = vol[:, i, j]
                if np.isnan(profile[0]) or profile[0] < 26.0:
                    d26_grid[i, j] = 0.0
                    continue

                # Find crossing where temperature drops below 26°C
                crossed = False
                for k in range(len(self.depths) - 1):
                    t_upper = profile[k]
                    t_lower = profile[k + 1]

                    if t_upper >= 26.0 and t_lower < 26.0:
                        # Linear vertical interpolation:
                        z_upper = self.depths[k]
                        z_lower = self.depths[k + 1]
                        frac = (26.0 - t_upper) / (t_lower - t_upper + 1e-7)
                        d26_grid[i, j] = z_upper + frac * (z_lower - z_upper)
                        crossed = True
                        break

                if not crossed:
                    # Entire column is >= 26°C down to bottom or deepest recorded level
                    if profile[-1] >= 26.0:
                        d26_grid[i, j] = float(self.depths[-1])
                    else:
                        d26_grid[i, j] = 0.0

        return d26_grid

    def compute_tchc(
        self,
        temperature_volume: np.ndarray,
        d26_grid: Optional[np.ndarray] = None,
        mask: Optional[np.ndarray] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Computes Tropical Cyclone Heat Content (kJ/cm^2) by trapezoidal integration
        from surface down to D26:
        TCHC = RHO_CP_FACTOR * Integral_0^D26 (T(z) - 26) dz

        Returns:
            (tchc_grid, d26_grid): arrays of shape [H, W]
        """
        vol = np.array(temperature_volume, dtype=np.float32)
        h, w = vol.shape[1], vol.shape[2]

        if d26_grid is None:
            d26_grid = self.compute_d26(vol, mask=mask)

        tchc_grid = np.zeros((h, w), dtype=np.float32)

        for i in range(h):
            for j in range(w):
                if mask is not None and mask[i, j] <= 0.5:
                    tchc_grid[i, j] = np.nan
                    continue

                d26_val = d26_grid[i, j]
                if np.isnan(d26_val) or d26_val <= 0.0:
                    tchc_grid[i, j] = 0.0
                    continue

                # Trapezoidal vertical integration
                integrated_heat = 0.0
                for k in range(len(self.depths) - 1):
                    z_k = self.depths[k]
                    z_next = self.depths[k + 1]

                    if z_k >= d26_val:
                        break

                    t_k = max(0.0, float(vol[k, i, j]) - 26.0)

                    if z_next <= d26_val:
                        t_next = max(0.0, float(vol[k + 1, i, j]) - 26.0)
                        dz = z_next - z_k
                        integrated_heat += 0.5 * (t_k + t_next) * dz
                    else:
                        # Segment terminates at exact d26_val
                        dz = d26_val - z_k
                        integrated_heat += 0.5 * t_k * dz
                        break

                tchc_grid[i, j] = integrated_heat * RHO_CP_FACTOR

        return tchc_grid, d26_grid

    def analyze_cyclone_heat(
        self,
        temperature_volume: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """
        Runs comprehensive TCHC diagnostic, Rapid Intensification (RI) categorization,
        and regional sub-basin vulnerability analysis.
        """
        tchc_grid, d26_grid = self.compute_tchc(temperature_volume, mask=mask)

        ocean_cells = (mask > 0.5) if mask is not None else ~np.isnan(tchc_grid)
        valid_tchc = tchc_grid[ocean_cells]
        valid_d26 = d26_grid[ocean_cells]

        # Rapid Intensification Risk Tiers:
        # Tier 0: Insufficient / Low (< 50 kJ/cm^2)
        # Tier 1: Moderate (50 - 80 kJ/cm^2)
        # Tier 2: High (80 - 110 kJ/cm^2) -> Category 3 support
        # Tier 3: Extreme (>= 110 kJ/cm^2) -> Category 4-5 Supercyclone trigger
        risk_grid = np.zeros_like(tchc_grid, dtype=np.int32)
        risk_grid[ocean_cells & (tchc_grid >= 50.0) & (tchc_grid < 80.0)] = 1
        risk_grid[ocean_cells & (tchc_grid >= 80.0) & (tchc_grid < 110.0)] = 2
        risk_grid[ocean_cells & (tchc_grid >= 110.0)] = 3

        if mask is not None:
            risk_grid = np.where(mask > 0.5, risk_grid, 0)

        # Statistics
        km2_per_cell = 765.0
        total_ocean_cells = int(np.sum(ocean_cells))
        ri_cells = int(np.sum(ocean_cells & (tchc_grid >= 80.0)))
        ri_area_km2 = round(float(ri_cells * km2_per_cell), 0)

        max_tchc = round(float(np.nanmax(valid_tchc)), 2) if len(valid_tchc) > 0 else 0.0
        # Warm pool average where TCHC > 20 kJ/cm^2
        warm_pool = valid_tchc[valid_tchc > 20.0]
        mean_warm_tchc = round(float(np.mean(warm_pool)), 2) if len(warm_pool) > 0 else 0.0
        mean_d26 = round(float(np.nanmean(valid_d26[valid_d26 > 0])), 1) if len(valid_d26[valid_d26 > 0]) > 0 else 0.0

        risk_counts = {
            "low_under_50": int(np.sum(ocean_cells & (risk_grid == 0))),
            "moderate_50_to_80": int(np.sum(ocean_cells & (risk_grid == 1))),
            "high_80_to_110": int(np.sum(ocean_cells & (risk_grid == 2))),
            "extreme_over_110": int(np.sum(ocean_cells & (risk_grid == 3)))
        }

        # Sub-basin statistics
        sub_basin_stats = {}
        for basin_name, bounds in SUB_BASIN_BOUNDS.items():
            lat_mask = (self.grid_lats >= bounds["min_lat"]) & (self.grid_lats <= bounds["max_lat"])
            lon_mask = (self.grid_lons >= bounds["min_lon"]) & (self.grid_lons <= bounds["max_lon"])
            reg_mask = np.outer(lat_mask, lon_mask) & ocean_cells

            reg_tchc = tchc_grid[reg_mask]
            if len(reg_tchc) > 0:
                reg_max = float(np.nanmax(reg_tchc))
                reg_mean = float(np.nanmean(reg_tchc[reg_tchc > 0])) if len(reg_tchc[reg_tchc > 0]) > 0 else 0.0
                reg_ri_count = int(np.sum(reg_tchc >= 80.0))
                reg_ri_pct = round(float(reg_ri_count / len(reg_tchc) * 100.0), 2)
                reg_d26 = float(np.nanmean(d26_grid[reg_mask & (d26_grid > 0)])) if len(d26_grid[reg_mask & (d26_grid > 0)]) > 0 else 0.0
            else:
                reg_max = 0.0
                reg_mean = 0.0
                reg_ri_pct = 0.0
                reg_d26 = 0.0

            sub_basin_stats[basin_name] = {
                "max_tchc_kj_cm2": round(reg_max, 1),
                "mean_tchc_kj_cm2": round(reg_mean, 1),
                "mean_d26_m": round(reg_d26, 1),
                "ri_potential_pct": reg_ri_pct,
                "risk_status": "Extreme Support" if reg_max >= 110 else "High Support" if reg_max >= 80 else "Moderate" if reg_max >= 50 else "Low"
            }

        return {
            "status": "success",
            "max_tchc_kj_cm2": max_tchc,
            "mean_warm_pool_tchc_kj_cm2": mean_warm_tchc,
            "mean_d26_m": mean_d26,
            "ri_hotspot_area_km2": ri_area_km2,
            "ri_hotspot_pct": round(float(ri_cells / max(1, total_ocean_cells) * 100.0), 2),
            "risk_categories": risk_counts,
            "sub_basin_stats": sub_basin_stats,
            "tchc_grid": tchc_grid,
            "d26_grid": d26_grid,
            "risk_grid": risk_grid,
            "latitude": self.grid_lats.tolist(),
            "longitude": self.grid_lons.tolist(),
            "protocol": "Shay et al. (2000) / Mainelli et al. (2008) Tropical Cyclone Heat Potential (TCHP/TCHC)"
        }
