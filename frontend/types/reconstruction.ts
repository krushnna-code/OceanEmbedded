/**
 * TypeScript Interfaces for OceanEmbed Backend API.
 */

export interface ModelMetadata {
  model_id: string;
  name: string;
  version: string;
  description: string;
  target_region: string;
  spatial_resolution: string;
  grid_dimensions: {
    latitude_points: number;
    longitude_points: number;
  };
  temporal_window_days: number;
  depth_levels_m: number[];
  surface_variables: string[];
  architecture: Record<string, string | number>;
  status: string;
  validation_status?: string;
  checkpoint_loaded: boolean;
}

export interface ReconstructionMapData {
  model_version: string;
  date: string;
  requested_depth_m: number;
  actual_depth_m: number;
  depth_index: number;
  is_anomaly: boolean;
  units: string;
  spatial_resolution: string;
  latitude: number[];
  longitude: number[];
  values: (number | null)[][];
  uncertainty?: (number | null)[][] | null;
  uncertainty_units?: string;
  stats: {
    min: number;
    max: number;
    mean: number;
  };
  uncertainty_stats?: {
    min: number;
    max: number;
    mean: number;
  };
  status: string;
  uncertainty_note?: string;
}

export interface VerticalProfileData {
  model_version: string;
  date: string;
  requested_location: {
    latitude: number;
    longitude: number;
  };
  nearest_grid_point: {
    latitude: number;
    longitude: number;
    grid_i: number;
    grid_j: number;
  };
  is_ocean: boolean;
  depths_m: number[];
  temperature_profile: (number | null)[];
  anomaly_profile: (number | null)[];
  uncertainty?: (number | null)[] | null;
  uncertainty_band?: {
    sigma: (number | null)[];
    upper_bound: (number | null)[];
    lower_bound: (number | null)[];
  };
  units: string;
  status: string;
  uncertainty_note?: string;
}

export interface VolumeSlice {
  depth_m: number;
  depth_index: number;
  values: (number | null)[][];
  uncertainty?: (number | null)[][] | null;
}

export interface Volume3DData {
  model_version: string;
  date: string;
  depths_m: number[];
  latitude: number[];
  longitude: number[];
  downsample_factor: number;
  dimensions: {
    depths: number;
    latitudes: number;
    longitudes: number;
  };
  slices: VolumeSlice[];
  status: string;
  note: string;
}

export interface ConfigData {
  grid: {
    region: string;
    bbox: number[];
    resolution_deg: number;
    latitude_points: number;
    longitude_points: number;
    lats: number[];
    lons: number[];
  };
  depth_levels: number[];
  surface_variables: string[];
  available_dates: string[];
  model_id: string;
  version: string;
  status: string;
}

export interface EmbeddingData {
  model_version: string;
  date: string;
  embedding_dimension: number;
  latent_shape: number[];
  representation: string;
  values: number[][];
  status: string;
}

export interface MHWCategoryStats {
  none: number;
  category_1_moderate: number;
  category_2_strong: number;
  category_3_severe: number;
  category_4_extreme: number;
}

export interface SubBasinMHWStats {
  active_cells: number;
  total_cells: number;
  coverage_pct: number;
  mean_intensity_c: number;
  max_intensity_c: number;
}

export interface MHWData {
  date: string;
  requested_depth_m: number;
  actual_depth_m: number;
  depth_index: number;
  status: string;
  active_mhw_area_km2: number;
  active_mhw_percentage: number;
  max_intensity_c: number;
  mean_intensity_c: number;
  cumulative_intensity: number;
  max_penetration_depth_m: number;
  categories: MHWCategoryStats;
  sub_basin_stats: Record<string, SubBasinMHWStats>;
  category_grid: number[][];
  anomaly_grid: (number | null)[][];
  latitude: number[];
  longitude: number[];
  protocol: string;
}

export interface DepthMetric {
  depth_m: number;
  mae_c: number;
  rmse_c: number;
  bias_c: number;
  r2_score: number;
  correlation: number;
  accuracy_pct: number;
  target_mean_c: number;
  pred_mean_c: number;
}

export interface RegionalMetric {
  mae_c: number;
  rmse_c: number;
  bias_c: number;
  r2_score: number;
  correlation: number;
  accuracy_pct: number;
  sample_count: number;
}

export interface MetricsData {
  status: string;
  overall: {
    rmse_c: number;
    mae_c: number;
    bias_c: number;
    r2_score: number;
    correlation: number;
    accuracy_pct: number;
    total_valid_points: number;
  };
  depth_breakdown: DepthMetric[];
  sub_basins: Record<string, RegionalMetric>;
  target_dataset: string;
  protocol: string;
}


