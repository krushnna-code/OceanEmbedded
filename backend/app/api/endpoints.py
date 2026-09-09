"""
FastAPI Endpoints for OceanEmbed.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body

from backend.app.schemas.reconstruction import (
    HealthResponse,
    ModelMetadataSchema,
    ReconstructionMapSchema,
    VerticalProfileSchema,
    Volume3DSchema,
    EmbeddingSchema,
    ConfigResponseSchema,
    MetricsResponseSchema
)
from oceanembed.services.reconstruction import ReconstructionService

router = APIRouter()

# Global service instance with latest checkpoint pointer if available
_reconstruction_service: Optional[ReconstructionService] = None


def get_service() -> ReconstructionService:
    global _reconstruction_service
    if _reconstruction_service is None:
        checkpoint = "checkpoints/latest.pt"
        _reconstruction_service = ReconstructionService(checkpoint_path=checkpoint)
    return _reconstruction_service


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Service health and heartbeat check."""
    return HealthResponse(
        status="healthy",
        service="OceanEmbed Reconstruction Engine",
        version="0.1.0-dev",
        timestamp=datetime.now().isoformat()
    )


@router.get("/api/config", response_model=ConfigResponseSchema)
def get_configuration():
    """Returns grid coordinates, standard depth levels, and available dates."""
    svc = get_service()
    return ConfigResponseSchema(
        grid={
            "region": "North Indian Ocean",
            "bbox": [5.0, 30.0, 45.0, 105.0],
            "resolution_deg": 0.25,
            "latitude_points": len(svc.grid_lats),
            "longitude_points": len(svc.grid_lons),
            "lats": svc.grid_lats,
            "lons": svc.grid_lons
        },
        depth_levels=svc.depths,
        surface_variables=svc.get_model_metadata()["surface_variables"],
        available_dates=svc.get_available_dates(),
        model_id="oceanembed-3d-v1",
        version="0.1.0-dev",
        status="DEMO / MODEL DEVELOPMENT DATA"
    )


@router.get("/api/models", response_model=List[ModelMetadataSchema])
def list_models():
    """Lists available reconstruction models."""
    svc = get_service()
    return [ModelMetadataSchema(**svc.get_model_metadata())]


@router.get("/api/model/{model_id}", response_model=ModelMetadataSchema)
def get_model(model_id: str):
    """Returns metadata for a specific model."""
    svc = get_service()
    meta = svc.get_model_metadata()
    if model_id != meta["model_id"]:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found.")
    return ModelMetadataSchema(**meta)


@router.get("/api/reconstruction", response_model=ReconstructionMapSchema)
def get_reconstruction(
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    depth: float = Query(0.0, description="Depth level in meters (0 to 1000m)"),
    model: str = Query("oceanembed-3d-v1", description="Model identifier"),
    is_anomaly: bool = Query(False, description="Whether to return anomaly field instead of absolute temperature")
):
    """Returns a 2D temperature map across the North Indian Ocean at the specified depth."""
    svc = get_service()
    try:
        rec = svc.get_reconstruction_map(
            date=date,
            depth=depth,
            model_id=model,
            is_anomaly=is_anomaly
        )
        return ReconstructionMapSchema(**rec)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/profile", response_model=VerticalProfileSchema)
def get_profile(
    lat: float = Query(12.50, description="Latitude (5°N to 30°N)"),
    lon: float = Query(82.25, description="Longitude (45°E to 105°E)"),
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    model: str = Query("oceanembed-3d-v1", description="Model identifier")
):
    """Extracts a vertical subsurface temperature profile (15 depths) at the requested coordinate."""
    svc = get_service()
    try:
        prof = svc.get_vertical_profile(
            lat=lat,
            lon=lon,
            date=date,
            model_id=model
        )
        return VerticalProfileSchema(**prof)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/volume", response_model=Volume3DSchema)
def get_volume(
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    model: str = Query("oceanembed-3d-v1", description="Model identifier"),
    downsample: int = Query(4, ge=1, le=8, description="Spatial downsample factor for WebGL rendering performance")
):
    """Returns the full 3D subsurface temperature volume downsampled for interactive Three.js WebGL visualization."""
    svc = get_service()
    try:
        vol = svc.get_3d_volume(
            date=date,
            model_id=model,
            downsample_factor=downsample
        )
        return Volume3DSchema(**vol)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/embedding", response_model=EmbeddingSchema)
def get_embedding(
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    model: str = Query("oceanembed-3d-v1", description="Model identifier")
):
    """Returns the 2D spatial summary (norm) of the learned Latent Ocean Embedding."""
    svc = get_service()
    try:
        emb = svc.get_embedding_map(
            date=date,
            model_id=model
        )
        return EmbeddingSchema(**emb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/metrics", response_model=MetricsResponseSchema)
def get_validation_metrics():
    """
    Deferred Validation Metrics endpoint per Section 25/28.
    Returns 'validation pending' placeholder until Layer 4 validation engine is integrated.
    """
    return MetricsResponseSchema(
        status="validation pending",
        message="Independent GLORYS12V1 and ARGO float validation is deferred to Phase 2 data harmonization.",
        validation_phase="Layer 4 Validation Engine (Deferred)",
        target_comparisons={
            "GLORYS12V1": "Dense reanalysis target comparison (explicitly NOT ground truth) pending.",
            "ARGO": "Independent in-situ float validation (strict train/val holdout) pending."
        },
        available_metrics=["RMSE", "MAE", "Mean Bias", "Pearson Correlation (r)", "R^2"],
        note="Do not fabricate scientific metrics during model development phase."
    )


@router.post("/api/inference")
@router.post("/predict")
def run_development_inference(payload: Dict[str, Any] = Body(...)):
    """Development endpoint to execute on-demand model inference (alias: /predict)."""
    svc = get_service()
    date = payload.get("date")
    depth = payload.get("depth", 0.0)
    is_anomaly = payload.get("is_anomaly", False)
    
    rec = svc.get_reconstruction_map(
        date=date,
        depth=depth,
        is_anomaly=is_anomaly
    )
    return {
        "status": "success",
        "result": rec,
        "note": "Development inference executed via ReconstructionService."
    }

