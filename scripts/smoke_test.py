"""
Smoke Test for OceanEmbed.
Verifies the end-to-end integration:
  Synthetic surface tensor -> OceanEmbed3D forward -> Latent Embedding ->
  ReconstructionService -> Backend API responses -> Frontend data contracts.
Must run fast and deterministically.
"""

import os
import sys

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import torch
from fastapi.testclient import TestClient

from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.data.synthetic import SyntheticOceanDataset
from oceanembed.services.reconstruction import ReconstructionService
from backend.app.main import app


def run_smoke_test():
    print("=" * 60)
    print("RUNNING OCEANEMBED SMOKE TEST")
    print("=" * 60)
    
    # 1. Generate synthetic surface sequence
    print("[1/8] Generating synthetic surface sequence...")
    dataset = SyntheticOceanDataset(num_samples=1, seed=42)
    sample = dataset[0]
    surface = sample["surface"].unsqueeze(0)
    mask = sample["mask"].unsqueeze(0)
    assert surface.shape == (1, 7, 7, 101, 241)
    print("  -> Surface tensor shape:", surface.shape)
    
    # 2. Instantiate OceanEmbed3D
    print("[2/8] Instantiating OceanEmbed3D reconstruction engine...")
    model = OceanEmbed3D(embedding_dim=128, target_h=101, target_w=241)
    model.eval()
    
    # 3. Execute forward pass
    print("[3/8] Executing model forward pass...")
    with torch.no_grad():
        out = model(surface, mask=mask)
        
    # 4. Verify shape [B, 15, H, W]
    print("[4/8] Verifying output temperature shapes...")
    assert out.temperature.shape == (1, 15, 101, 241), f"Unexpected shape {out.temperature.shape}"
    assert out.anomaly.shape == (1, 15, 101, 241)
    print("  -> Output temperature shape:", out.temperature.shape)
    print("  -> All 15 standard ocean depths successfully predicted.")
    
    # 5. Extract embedding
    print("[5/8] Extracting latent ocean embedding...")
    emb = model.encode_surface(surface)
    assert emb.shape == (1, 128, 26, 61)
    print("  -> Latent ocean embedding shape:", emb.shape)
    
    # 6. Run backend prediction path
    print("[6/8] Executing ReconstructionService prediction path...")
    svc = ReconstructionService()
    dates = svc.get_available_dates()
    assert len(dates) > 0
    rec_map = svc.get_reconstruction_map(depth=50.0)
    assert rec_map["actual_depth_m"] == 50.0
    print("  -> Reconstruction map retrieved successfully for depth 50m.")
    
    # 7. Verify API response
    print("[7/8] Querying FastAPI backend test client...")
    client = TestClient(app)
    resp = client.get("/api/reconstruction?depth=100.0")
    assert resp.status_code == 200
    assert resp.json()["actual_depth_m"] == 100.0
    
    prof_resp = client.get("/api/profile?lat=12.5&lon=82.25")
    assert prof_resp.status_code == 200
    assert len(prof_resp.json()["temperature_profile"]) == 15
    print("  -> Backend endpoints (/reconstruction, /profile) validated.")
    
    # 8. Verify frontend 3D demo data volume can load
    print("[8/8] Verifying 3D volume WebGL payload...")
    vol_resp = client.get("/api/volume?downsample=4")
    assert vol_resp.status_code == 200
    vol_data = vol_resp.json()
    assert len(vol_data["slices"]) == 15
    print("  -> 3D Volume payload ready for Three.js WebGL visualizer.")
    
    print("=" * 60)
    print("ALL 8 SMOKE TEST STEPS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_smoke_test()
    except Exception as e:
        print(f"\nSMOKE TEST FAILED: {e}")
        sys.exit(1)
