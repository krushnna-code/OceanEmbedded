"""
FastAPI router for the 3D ocean temperature cutaway visualization.

Serves preprocessed GLORYS12V1 binary ocean data (metadata.json + ocean.bin)
from the sih_apraxia data directory. Integrated into the main OceanEmbed backend
so the Next.js dashboard can access it via the existing /api-backend proxy.
"""

import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(
    prefix="/api/ocean3d-cutaway",
    tags=["Ocean 3D Cutaway"],
)

# Resolve paths relative to the project root (backend/app/api/ -> project root)
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_DATA_DIR = os.path.join(_PROJECT_ROOT, "sih_apraxia", "data", "processed")
_METADATA_PATH = os.path.join(_DATA_DIR, "metadata.json")
_BINARY_PATH = os.path.join(_DATA_DIR, "ocean.bin")

# In-memory metadata cache
_metadata_cache: dict | None = None


def _load_metadata() -> dict:
    global _metadata_cache
    if _metadata_cache is not None:
        return _metadata_cache
    if not os.path.exists(_METADATA_PATH):
        raise HTTPException(
            status_code=503,
            detail=(
                "Preprocessed cutaway metadata not found at "
                f"{_METADATA_PATH}. "
                "Run: cd sih_apraxia && python -m backend.scripts.preprocess_dataset"
            ),
        )
    with open(_METADATA_PATH, "r") as f:
        _metadata_cache = json.load(f)
    return _metadata_cache


@router.get("/health")
async def cutaway_health():
    """Health check for the 3D cutaway data pipeline."""
    meta_ok = os.path.exists(_METADATA_PATH)
    data_ok = os.path.exists(_BINARY_PATH)
    return {
        "status": "ok" if (meta_ok and data_ok) else "degraded",
        "metadata_ready": meta_ok,
        "data_ready": data_ok,
        "metadata_path": _METADATA_PATH,
        "binary_path": _BINARY_PATH,
    }


@router.get("/metadata")
async def cutaway_metadata():
    """Return the preprocessed ocean cutaway metadata as JSON."""
    return JSONResponse(content=_load_metadata())


@router.get("/data")
async def cutaway_data():
    """
    Return the binary ocean data file for the 3D cutaway visualization.
    Layout: [longitude f32][latitude f32][depth f32][temperature f32 3D][mask u8 3D]
    Sizes described in the metadata endpoint.
    """
    if not os.path.exists(_BINARY_PATH):
        raise HTTPException(
            status_code=503,
            detail=(
                "Preprocessed binary data not found. "
                "Run: cd sih_apraxia && python -m backend.scripts.preprocess_dataset"
            ),
        )
    return FileResponse(
        _BINARY_PATH,
        media_type="application/octet-stream",
        filename="ocean.bin",
    )
