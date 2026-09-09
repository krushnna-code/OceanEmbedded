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
    stats: StatsSchema
    status: str


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
    units: str
    status: str


class VolumeSliceSchema(BaseModel):
    depth_m: float
    depth_index: int
    values: List[List[Optional[float]]]


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
