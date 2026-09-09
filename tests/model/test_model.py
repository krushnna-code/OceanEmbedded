"""
Model Component & Architecture Tests for OceanEmbed (GNN-Hybrid Core).
Verifies:
  - Thermodynamic GNN branch shape test (SST + SSS, 2 channels)
  - Dynamic GNN branch shape test (SLA, currents, winds, 5 channels)
  - Graph feature fusion output shape test
  - ConvLSTM shape test
  - Cross-variable attention shape test
  - Embedding shape test
  - Depth-decoder shape test (15 depths)
  - Uncertainty head shape test (mu and sigma both [B, 15, H, W])
  - Physics-aware loss unit tests (finite, gradients flow, components)
  - Model ablation tests
  - Deterministic seed test
"""

import pytest
import torch
import numpy as np

from oceanembed.models.thermodynamic_gnn import ThermodynamicGNN
from oceanembed.models.dynamic_gnn import DynamicGNN
from oceanembed.models.graph_fusion import GraphFeatureFusion
from oceanembed.models.convlstm import ConvLSTM
from oceanembed.models.cross_attention import CrossVariableAttentionFusion
from oceanembed.models.depth_embedding import OceanDepthEmbedding
from oceanembed.models.depth_decoder import DepthAwareDecoder
from oceanembed.models.uncertainty_head import HeteroscedasticUncertaintyHead
from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.training.losses import PhysicsAwareReconstructionLoss
from oceanembed.utils.seed import seed_everything


def test_thermodynamic_gnn_branch():
    thermo = ThermodynamicGNN(in_channels=2, out_dim=64, num_layers=2)
    # [B, 2, 101, 241]
    x = torch.randn(2, 2, 101, 241)
    feat = thermo(x)
    assert feat.shape == (2, 64, 26, 61)


def test_dynamic_gnn_branch():
    dynamic = DynamicGNN(in_channels=5, out_dim=64, num_layers=2)
    # [B, 5, 101, 241]
    x = torch.randn(2, 5, 101, 241)
    feat = dynamic(x)
    assert feat.shape == (2, 64, 26, 61)


def test_graph_feature_fusion():
    fusion = GraphFeatureFusion(thermo_dim=64, dynamic_dim=64, out_dim=128)
    f_thermo = torch.randn(2, 64, 26, 61)
    f_dyn = torch.randn(2, 64, 26, 61)
    fused = fusion(f_thermo, f_dyn)
    assert fused.shape == (2, 128, 26, 61)


def test_convlstm_shapes():
    convlstm = ConvLSTM(in_channels=128, hidden_dim=128, num_layers=1)
    # Sequence of 7 timesteps: [B, T, D, H', W']
    x = torch.randn(2, 7, 128, 26, 61)
    
    h_last = convlstm(x, return_sequence=False)
    assert h_last.shape == (2, 128, 26, 61)
    
    h_seq = convlstm(x, return_sequence=True)
    assert h_seq.shape == (2, 7, 128, 26, 61)


def test_cross_variable_attention():
    attn = CrossVariableAttentionFusion(embed_dim=128, num_heads=4)
    graph_f = torch.randn(2, 128, 26, 61)
    temporal_f = torch.randn(2, 128, 26, 61)
    fused = attn(graph_f, temporal_f)
    assert fused.shape == (2, 128, 26, 61)


def test_depth_embedding():
    depth_mod = OceanDepthEmbedding(num_depths=15, depth_dim=128)
    all_depths = depth_mod()
    assert all_depths.shape == (15, 128)


def test_depth_decoder_and_uncertainty_head():
    decoder = DepthAwareDecoder(embed_dim=128, depth_dim=128, target_h=101, target_w=241, num_depths=15)
    unc_head = HeteroscedasticUncertaintyHead(in_channels=64, num_depths=15)
    
    embedding = torch.randn(2, 128, 26, 61)
    depth_tokens = torch.randn(15, 128)
    
    mu, dec_feat = decoder(embedding, depth_tokens, return_features=True)
    assert mu.shape == (2, 15, 101, 241)
    assert dec_feat.shape == (2, 64, 101, 241)
    
    sigma, log_var = unc_head(dec_feat)
    assert sigma.shape == (2, 15, 101, 241)
    assert log_var.shape == (2, 15, 101, 241)
    assert (sigma > 0).all(), "Sigma must be strictly positive"


def test_oceanembed3d_full_forward():
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
    surface = torch.randn(2, 7, 7, 101, 241)
    out = model(surface)
    
    assert out.temperature.shape == (2, 15, 101, 241)
    assert out.anomaly.shape == (2, 15, 101, 241)
    assert out.uncertainty.shape == (2, 15, 101, 241)
    assert out.log_var.shape == (2, 15, 101, 241)
    assert out.embedding.shape == (2, 128, 26, 61)


def test_physics_aware_loss_and_gradients():
    criterion = PhysicsAwareReconstructionLoss(
        loss_type="huber",
        lambda_surface=0.05,
        lambda_vertical=0.05,
        lambda_thermocline=0.1,
        lambda_uncertainty=0.1
    )
    
    pred_mu = torch.randn(2, 15, 101, 241, requires_grad=True)
    target_y = torch.randn(2, 15, 101, 241)
    log_var = torch.zeros(2, 15, 101, 241, requires_grad=True)
    surface_sst = torch.randn(2, 101, 241)
    
    loss, loss_dict = criterion(
        pred_mu=pred_mu,
        target_y=target_y,
        log_var=log_var,
        surface_sst=surface_sst
    )
    
    assert torch.isfinite(loss), "Loss must be finite"
    assert "loss_total" in loss_dict
    assert "loss_surface" in loss_dict
    assert "loss_vertical" in loss_dict
    assert "loss_thermocline" in loss_dict
    assert "loss_uncertainty" in loss_dict
    
    loss.backward()
    assert pred_mu.grad is not None and torch.isfinite(pred_mu.grad).all()
    assert log_var.grad is not None and torch.isfinite(log_var.grad).all()


def test_model_ablations():
    # Dynamic-branch only (disable thermodynamic branch)
    model_ablation = OceanEmbed3D(
        in_channels=7,
        temporal_window=7,
        embedding_dim=64,
        target_h=101,
        target_w=241,
        use_thermodynamic_branch=False,
        use_dynamic_branch=True,
        use_uncertainty_head=False
    )
    surface = torch.randn(1, 7, 7, 101, 241)
    out = model_ablation(surface)
    assert out.temperature.shape == (1, 15, 101, 241)
    assert out.uncertainty is None


def test_deterministic_seed():
    seed_everything(42)
    m1 = OceanEmbed3D(embedding_dim=64, target_h=101, target_w=241)
    x1 = torch.randn(1, 7, 7, 101, 241)
    out1 = m1(x1).temperature
    
    seed_everything(42)
    m2 = OceanEmbed3D(embedding_dim=64, target_h=101, target_w=241)
    x2 = torch.randn(1, 7, 7, 101, 241)
    out2 = m2(x2).temperature
    
    assert torch.allclose(out1, out2, atol=1e-5), "Outputs must be deterministic for identical seeds"

