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

export interface MetricsData {
  status: string;
  message: string;
  validation_phase: string;
  target_comparisons: Record<string, string>;
  available_metrics: string[];
  note: string;
}

