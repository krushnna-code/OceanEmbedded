"""
FastAPI Backend Application for OceanEmbed.
Connects the Deep-Learning Reconstruction Engine to the Government-Scientific Frontend Dashboard.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.endpoints import router

app = FastAPI(
    title="OceanEmbed - Subsurface Ocean Intelligence API",
    description=(
        "Satellite Embedding-Based Deep Learning Framework for Reconstruction "
        "of Subsurface Ocean Temperature from Surface Observations (North Indian Ocean)."
    ),
    version="0.1.0-dev"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach API endpoints
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
