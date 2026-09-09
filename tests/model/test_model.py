"""
Model Component & Architecture Tests for OceanEmbed.
Verifies shapes, latent embedding dimensions, forward pass, ablations, and seed determinism.
"""

import pytest
import torch
import numpy as np

from oceanembed.models.cnn_encoder import CNNSpatialEncoder
from oceanembed.models.spatial_transformer import SpatialTransformer
from oceanembed.models.convlstm import ConvLSTM
from oceanembed.models.cross_attention import CrossAttentionFusion
from oceanembed.models.depth_embedding import OceanDepthEmbedding
from oceanembed.models.depth_decoder import DepthAwareDecoder
from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.utils.seed import seed_everything


def test_cnn_spatial_encoder_shapes():
    encoder = CNNSpatialEncoder(in_channels=7, out_dim=128)
    
    # 4D input: [B, C, H, W]
    x4d = torch.randn(2, 7, 101, 241)
    feat4d = encoder(x4d)
    assert feat4d.shape == (2, 128, 26, 61)
    
    # 5D input: [B, T, C, H, W]
    x5d = torch.randn(2, 7, 7, 101, 241)
    feat5d = encoder(x5d)
    assert feat5d.shape == (2, 7, 128, 26, 61)


def test_spatial_transformer_shapes():
    transformer = SpatialTransformer(embed_dim=128, num_heads=4, num_layers=1)
    x = torch.randn(2, 128, 26, 61)
    out = transformer(x)
    assert out.shape == (2, 128, 26, 61)


def test_convlstm_shapes():
    convlstm = ConvLSTM(in_channels=128, hidden_dim=128, num_layers=1)
    x = torch.randn(2, 7, 128, 26, 61)
    
    # Final hidden state
    h_last = convlstm(x, return_sequence=False)
    assert h_last.shape == (2, 128, 26, 61)
    
    # Full sequence
    h_seq = convlstm(x, return_sequence=True)
    assert h_seq.shape == (2, 7, 128, 26, 61)


def test_cross_attention_shapes():
    cross_attn = CrossAttentionFusion(embed_dim=128, num_heads=4)
    spatial = torch.randn(2, 128, 26, 61)
    temporal = torch.randn(2, 128, 26, 61)
    fused = cross_attn(spatial, temporal)
    assert fused.shape == (2, 128, 26, 61)


def test_depth_embedding():
    depth_mod = OceanDepthEmbedding(num_depths=15, depth_dim=128)
    
    # All 15 depths
    all_depths = depth_mod()
    assert all_depths.shape == (15, 128)
    
    # Subset of depth indices
    subset = depth_mod(torch.tensor([0, 5, 14]))
    assert subset.shape == (3, 128)


def test_depth_decoder_shapes():
    decoder = DepthAwareDecoder(embed_dim=128, depth_dim=128, target_h=101, target_w=241, num_depths=15)
    embedding = torch.randn(2, 128, 26, 61)
    depth_tokens = torch.randn(15, 128)
    out = decoder(embedding, depth_tokens)
    assert out.shape == (2, 15, 101, 241)


def test_oceanembed3d_full_forward():
    model = OceanEmbed3D(
        in_channels=7,
        temporal_window=7,
        embedding_dim=128,
        target_h=101,
        target_w=241
    )
    surface = torch.randn(2, 7, 7, 101, 241)
    out = model(surface)
    
    assert out.temperature.shape == (2, 15, 101, 241)
    assert out.anomaly.shape == (2, 15, 101, 241)
    assert out.embedding.shape == (2, 128, 26, 61)
    assert out.uncertainty is None


def test_oceanembed3d_ablations():
    # Model without transformer and without convlstm
    model_ablation = OceanEmbed3D(
        in_channels=7,
        temporal_window=7,
        embedding_dim=64,
        target_h=101,
        target_w=241,
        use_transformer=False,
        use_convlstm=False,
        use_cross_attention=False
    )
    surface = torch.randn(1, 7, 7, 101, 241)
    out = model_ablation(surface)
    assert out.temperature.shape == (1, 15, 101, 241)


def test_deterministic_seed():
    seed_everything(1234)
    m1 = OceanEmbed3D(embedding_dim=64, target_h=101, target_w=241)
    x1 = torch.randn(1, 7, 7, 101, 241)
    out1 = m1(x1).temperature
    
    seed_everything(1234)
    m2 = OceanEmbed3D(embedding_dim=64, target_h=101, target_w=241)
    x2 = torch.randn(1, 7, 7, 101, 241)
    out2 = m2(x2).temperature
    
    assert torch.allclose(out1, out2, atol=1e-5), "Outputs must be deterministic for identical seeds"
