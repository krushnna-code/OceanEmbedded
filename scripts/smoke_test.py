"""
Smoke Test for OceanEmbed (Section 43 Specification).
Verifies:
  1. Generate synthetic surface tensor + graph
  2. Instantiate OceanEmbed (GNN-hybrid)
  3. Execute forward pass
  4. Verify temperature shape [B,15,H,W] and uncertainty shape [B,15,H,W]
  5. Extract embedding
  6. Compute physics-aware loss on a synthetic batch, confirm finite & differentiable
  7. Run backend prediction path
  8. Verify API response includes uncertainty field
  9. Verify frontend demo data (incl. uncertainty) can load
Must run quickly.
"""

import os
import sys

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import torch
from fastapi.testclient import TestClient

from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.data.synthetic import SyntheticOceanDataset
from oceanembed.training.losses import PhysicsAwareReconstructionLoss
from oceanembed.services.reconstruction import ReconstructionService
from backend.app.main import app


def run_smoke_test():
    print("=" * 65)
    print("RUNNING OCEANEMBED SMOKE TEST (SECTION 43)")
    print("=" * 65)
    
    # 1. Generate synthetic surface tensor + graph
    print("[1/9] Generating synthetic surface tensor + spatial graph...")
    dataset = SyntheticOceanDataset(num_samples=2, seed=42)
    sample = dataset[0]
    surface = sample["surface"].unsqueeze(0)
    target = sample["temperature"].unsqueeze(0)
    mask = sample["mask"].unsqueeze(0)
    assert surface.shape == (1, 7, 7, 101, 241)
    print(f"  -> Surface tensor: {surface.shape}, Grid: 101x241 (N=24,341 nodes)")
    
    # 2. Instantiate OceanEmbed (GNN-hybrid)
    print("[2/9] Instantiating OceanEmbed (GNN-Hybrid reconstruction engine)...")
    model = OceanEmbed3D(
        in_channels=7,
        temporal_window=7,
        embedding_dim=128,
        target_h=101,
        target_w=241,
        use_thermodynamic_branch=True,
        use_dynamic_branch=True,
        use_convlstm=True,
        use_cross_attention=True,
        use_uncertainty_head=True
    )
    model.eval()
    print("  -> Architecture: Thermo GNN + Dynamic GNN -> Gated Fusion -> ConvLSTM -> Attention -> Depth Decoder + Uncertainty Head")
    
    # 3. Execute forward pass
    print("[3/9] Executing forward pass...")
    with torch.no_grad():
        out = model(surface, mask=mask)
        
    # 4. Verify temperature shape [B,15,H,W] and uncertainty shape [B,15,H,W]
    print("[4/9] Verifying temperature and uncertainty output shapes...")
    assert out.temperature.shape == (1, 15, 101, 241), f"Unexpected mu shape: {out.temperature.shape}"
    assert out.uncertainty is not None, "Uncertainty head output must not be None"
    assert out.uncertainty.shape == (1, 15, 101, 241), f"Unexpected sigma shape: {out.uncertainty.shape}"
    print(f"  -> Temperature (mu) shape: {out.temperature.shape}")
    print(f"  -> Uncertainty (sigma) shape: {out.uncertainty.shape}")
    
    # 5. Extract embedding
    print("[5/9] Extracting latent ocean embedding...")
    emb = model.encode_surface(surface)
    assert emb.shape == (1, 128, 26, 61)
    print(f"  -> Latent ocean embedding shape: {emb.shape}")
    
    # 6. Compute physics-aware loss on synthetic batch, confirm finite and differentiable
    print("[6/9] Computing physics-aware loss on synthetic batch...")
    criterion = PhysicsAwareReconstructionLoss(
        loss_type="huber",
        lambda_surface=0.05,
        lambda_vertical=0.05,
        lambda_thermocline=0.1,
        lambda_uncertainty=0.1
    )
    # Enable grad for loss check
    model.train()
    surface_grad = surface.clone().requires_grad_(True)
    out_train = model(surface_grad, mask=mask)
    surface_sst = surface[:, -1, 0] # 0m surface SST observation
    loss, loss_dict = criterion(
        pred_mu=out_train.temperature,
        target_y=target,
        sigma=out_train.uncertainty,
        log_var=out_train.log_var,
        surface_sst=surface_sst,
        mask=mask
    )
    assert torch.isfinite(loss), "Loss must be finite"
    loss.backward()
    assert surface_grad.grad is not None and torch.isfinite(surface_grad.grad).all(), "Gradients must flow smoothly"
    model.eval()
    print(f"  -> Total Physics-Aware Loss: {loss.item():.4f} (Differentiable, finite)")
    for k, v in loss_dict.items():
        print(f"     - {k}: {v:.4f}")
        
    # 7. Run backend prediction path
    print("[7/9] Running backend ReconstructionService prediction path...")
    svc = ReconstructionService()
    dates = svc.get_available_dates()
    assert len(dates) > 0
    rec_map = svc.get_reconstruction_map(depth=50.0)
    assert rec_map["actual_depth_m"] == 50.0
    assert rec_map["uncertainty"] is not None
    print("  -> ReconstructionService produced valid 50m temperature and uncertainty maps.")
    
    # 8. Verify API response includes uncertainty field
    print("[8/9] Verifying FastAPI response includes uncertainty field...")
    client = TestClient(app)
    resp = client.get("/api/reconstruction?depth=100.0")
    assert resp.status_code == 200
    data = resp.json()
    assert "uncertainty" in data and data["uncertainty"] is not None
    assert "uncertainty_note" in data
    
    prof_resp = client.get("/api/profile?lat=12.5&lon=82.25")
    assert prof_resp.status_code == 200
    pdata = prof_resp.json()
    assert "uncertainty" in pdata and pdata["uncertainty"] is not None
    assert "uncertainty_band" in pdata
    print("  -> Endpoints (/reconstruction, /profile) validated with uncertainty fields.")
    
    # 9. Verify frontend demo data can load
    print("[9/9] Verifying 3D volume WebGL and metrics responses...")
    vol_resp = client.get("/api/volume?downsample=4")
    assert vol_resp.status_code == 200
    vdata = vol_resp.json()
    assert len(vdata["slices"]) == 15
    assert "uncertainty" in vdata["slices"][0]
    
    metrics_resp = client.get("/api/metrics")
    assert metrics_resp.status_code == 200
    assert metrics_resp.json()["status"] == "validation pending"
    print("  -> 3D Volume slices + /api/metrics validated.")
    
    print("=" * 65)
    print("ALL 9 SMOKE TEST STEPS PASSED PERFECTLY!")
    print("=" * 65)


if __name__ == "__main__":
    try:
        run_smoke_test()
    except Exception as e:
        print(f"\nSMOKE TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

