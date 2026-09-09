"""
Cross-Variable & Spatiotemporal Attention Fusion for OceanEmbed.
Allows thermodynamic, dynamic, and temporal ConvLSTM feature streams
to attend across variables and temporal horizons to construct the Latent Ocean Embedding.
"""

from typing import Optional, Tuple
import torch
import torch.nn as nn


class CrossAttentionFusion(nn.Module):
    """
    Cross-Variable & Spatiotemporal Attention Fusion Layer.
    Can fuse:
      1. Spatial features (Query) vs Temporal features (Key/Value)
      2. Cross-variable thermodynamic vs dynamic representations
    """
    def __init__(
        self,
        embed_dim: int = 128,
        num_heads: int = 8,
        dropout: float = 0.0,
        mlp_ratio: float = 4.0
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        
        self.norm_query = nn.LayerNorm(embed_dim)
        self.norm_kv = nn.LayerNorm(embed_dim)
        
        self.cross_attn = nn.MultiheadAttention(
            embed_dim=embed_dim,
            num_heads=num_heads,
            dropout=dropout,
            batch_first=True
        )
        
        self.norm_fused = nn.LayerNorm(embed_dim)
        mlp_hidden_dim = int(embed_dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, mlp_hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(mlp_hidden_dim, embed_dim),
            nn.Dropout(dropout)
        )
        
        # 1x1 conv residual projection
        self.out_conv = nn.Conv2d(embed_dim, embed_dim, kernel_size=1)

    def forward(
        self,
        spatial_feat: torch.Tensor,
        temporal_feat: torch.Tensor,
        aux_feat: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Args:
            spatial_feat: Spatial or fused graph representation [B, D, H, W]
            temporal_feat: Temporal ConvLSTM representation [B, D, H, W]
            aux_feat: Optional auxiliary dynamic/thermo feature map [B, D, H, W]
        Returns:
            fused_feat: Latent representation [B, D, H, W]
        """
        B, D, H, W = spatial_feat.shape
        N = H * W
        
        # Query from spatial state
        q = spatial_feat.flatten(2).transpose(1, 2) # [B, N, D]
        
        # Key/Value from temporal state (and optional aux variable features)
        if aux_feat is not None:
            combined_kv = 0.5 * (temporal_feat + aux_feat)
        else:
            combined_kv = temporal_feat
        kv = combined_kv.flatten(2).transpose(1, 2) # [B, N, D]
        
        norm_q = self.norm_query(q)
        norm_kv = self.norm_kv(kv)
        
        attn_out, _ = self.cross_attn(
            query=norm_q,
            key=norm_kv,
            value=norm_kv
        )
        
        fused = q + attn_out
        fused = fused + self.mlp(self.norm_fused(fused))
        
        # Reshape back to [B, D, H, W]
        fused_2d = fused.transpose(1, 2).view(B, D, H, W)
        out = self.out_conv(fused_2d) + spatial_feat
        return out


# Alias for explicit specification naming
CrossVariableAttentionFusion = CrossAttentionFusion
