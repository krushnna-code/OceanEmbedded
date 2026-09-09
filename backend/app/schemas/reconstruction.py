"""
Pydantic Schemas for OceanEmbed Backend API.
Ensures typed, validated data exchange matching the frontend TypeScript interfaces.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str


class ModelMetadataSchema(BaseModel):
    model_id: str
    name: str
    version: str
    description: str
    target_region: str
    spatial_resolution: str
    grid_dimensions: Dict[str, int]
    temporal_window_days: int
    depth_levels_m: List[float]
    surface_variables: List[str]
    architecture: Dict[str, Any]
    status: str
    validation_status: Optional[str] = None
    checkpoint_loaded: bool


class StatsSchema(BaseModel):
    min: float
    max: float
    mean: float


class ReconstructionMapSchema(BaseModel):
    model_version: str
    date: str
    requested_depth_m: float
    actual_depth_m: float
    depth_index: int
    is_anomaly: bool
    units: str
    spatial_resolution: str
    latitude: List[float]
    longitude: List[float]
    values: List[List[Optional[float]]]
    uncertainty: Optional[List[List[Optional[float]]]] = None
    uncertainty_units: Optional[str] = None
    stats: StatsSchema
    uncertainty_stats: Optional[StatsSchema] = None
    status: str
    uncertainty_note: Optional[str] = None


class LocationSchema(BaseModel):
    latitude: float
    longitude: float


class NearestGridSchema(BaseModel):
    latitude: float
    longitude: float
    grid_i: int
    grid_j: int


class VerticalProfileSchema(BaseModel):
    model_version: str
    date: str
    requested_location: LocationSchema
    nearest_grid_point: NearestGridSchema
    is_ocean: bool
    depths_m: List[float]
    temperature_profile: List[Optional[float]]
    anomaly_profile: List[Optional[float]]
    uncertainty: Optional[List[Optional[float]]] = None
    uncertainty_band: Optional[Dict[str, Any]] = None
    units: str
    status: str
    uncertainty_note: Optional[str] = None


class VolumeSliceSchema(BaseModel):
    depth_m: float
    depth_index: int
    values: List[List[Optional[float]]]
    uncertainty: Optional[List[List[Optional[float]]]] = None


class Volume3DSchema(BaseModel):
    model_version: str
    date: str
    depths_m: List[float]
    latitude: List[float]
    longitude: List[float]
    downsample_factor: int
    dimensions: Dict[str, int]
    slices: List[VolumeSliceSchema]
    status: str
    note: str


class EmbeddingSchema(BaseModel):
    model_version: str
    date: str
    embedding_dimension: int
    latent_shape: List[int]
    representation: str
    values: List[List[float]]
    status: str


class ConfigResponseSchema(BaseModel):
    grid: Dict[str, Any]
    depth_levels: List[float]
    surface_variables: List[str]
    available_dates: List[str]
    model_id: str
    version: str
    status: str


class MHWCategoryStats(BaseModel):
    none: int
    category_1_moderate: int
    category_2_strong: int
    category_3_severe: int
    category_4_extreme: int


class SubBasinMHWStats(BaseModel):
    active_cells: int
    total_cells: int
    coverage_pct: float
    mean_intensity_c: float
    max_intensity_c: float


class MHWResponseSchema(BaseModel):
    date: str
    requested_depth_m: float
    actual_depth_m: float
    depth_index: int
    status: str
    active_mhw_area_km2: float
    active_mhw_percentage: float
    max_intensity_c: float
    mean_intensity_c: float
    cumulative_intensity: float
    max_penetration_depth_m: float
    categories: MHWCategoryStats
    sub_basin_stats: Dict[str, SubBasinMHWStats]
    category_grid: List[List[int]]
    anomaly_grid: List[List[Optional[float]]]
    latitude: List[float]
    longitude: List[float]
    protocol: str


class DepthMetricSchema(BaseModel):
    depth_m: float
    mae_c: float
    rmse_c: float
    bias_c: float
    r2_score: float
    correlation: float
    accuracy_pct: float
    target_mean_c: float
    pred_mean_c: float


class OverallMetricsSchema(BaseModel):
    rmse_c: float
    mae_c: float
    bias_c: float
    r2_score: float
    correlation: float
    accuracy_pct: float
    total_valid_points: int


class RegionalMetricSchema(BaseModel):
    mae_c: float
    rmse_c: float
    bias_c: float
    r2_score: float
    correlation: float
    accuracy_pct: float
    sample_count: int


class MetricsResponseSchema(BaseModel):
    status: str
    overall: OverallMetricsSchema
    depth_breakdown: List[DepthMetricSchema]
    sub_basins: Dict[str, RegionalMetricSchema]
    target_dataset: str
    protocol: str


