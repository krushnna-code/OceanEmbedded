"""
Backend API Tests for OceanEmbed.
Verifies all FastAPI endpoints: health, models, config, reconstruction, profile, volume, embedding.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_config():
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "depth_levels" in data
    assert len(data["depth_levels"]) == 15
    assert data["grid"]["region"] == "North Indian Ocean"
    assert len(data["available_dates"]) > 0


def test_models():
    response = client.get("/api/models")
    assert response.status_code == 200
    models = response.json()
    assert len(models) >= 1
    assert models[0]["model_id"] == "oceanembed-3d-v1"


def test_model_by_id():
    response = client.get("/api/model/oceanembed-3d-v1")
    assert response.status_code == 200
    data = response.json()
    assert "OceanEmbed" in data["name"]
    assert "thermodynamic_branch" in data["architecture"]


def test_reconstruction_endpoint():
    response = client.get("/api/reconstruction?depth=100.0&is_anomaly=false")
    assert response.status_code == 200
    data = response.json()
    assert data["actual_depth_m"] == 100.0
    assert len(data["values"]) == 101
    assert len(data["values"][0]) == 241
    assert "stats" in data
    assert "uncertainty" in data
    assert data["units"] == "°C"


def test_profile_endpoint():
    response = client.get("/api/profile?lat=12.50&lon=82.25")
    assert response.status_code == 200
    data = response.json()
    assert "temperature_profile" in data
    assert len(data["temperature_profile"]) == 15
    assert "uncertainty" in data
    assert "uncertainty_band" in data
    assert len(data["uncertainty"]) == 15


def test_volume_endpoint():
    response = client.get("/api/volume?downsample=4")
    assert response.status_code == 200
    data = response.json()
    assert len(data["slices"]) == 15
    assert "dimensions" in data
    assert data["downsample_factor"] == 4
    assert "uncertainty" in data["slices"][0]


def test_embedding_endpoint():
    response = client.get("/api/embedding")
    assert response.status_code == 200
    data = response.json()
    assert "values" in data
    assert data["embedding_dimension"] == 128


def test_metrics_endpoint():
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "validation pending"
    assert "target_comparisons" in data
    assert "GLORYS12V1" in data["target_comparisons"]
    assert "ARGO" in data["target_comparisons"]


def test_inference_endpoints():
    payload = {"date": "2026-03-10", "depth": 50.0, "is_anomaly": False}
    # Test /api/inference
    r1 = client.post("/api/inference", json=payload)
    assert r1.status_code == 200
    # Test /predict alias
    r2 = client.post("/predict", json=payload)
    assert r2.status_code == 200
    assert r2.json()["status"] == "success"

