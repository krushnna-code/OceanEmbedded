"""
Spatial-Temporal Cross-Attention Fusion for OceanEmbed.
Queries spatial state features against key/value temporal evolution features
to produce the fused Latent Ocean Embedding.
"""

import torch
import torch.nn as nn


class CrossAttentionFusion(nn.Module):
    """
    Cross-Attention Fusion Layer.
    Query: Spatial representation (current high-resolution spatial structures, fronts, SST gradients)
    Key/Value: Temporal representation (memory of heat storage, wind forcing, advective history)
    """
    def __init__(
        self,
        embed_dim: int = 256,
        num_heads: int = 8,
        dropout: float = 0.0,
        mlp_ratio: float = 4.0
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        
        self.norm_spatial = nn.LayerNorm(embed_dim)
        self.norm_temporal = nn.LayerNorm(embed_dim)
        
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
        temporal_feat: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            spatial_feat: [B, D, H, W]
            temporal_feat: [B, D, H, W]
        Returns:
            fused_feat: [B, D, H, W]
        """
        B, D, H, W = spatial_feat.shape
        N = H * W
        
        # Flatten to sequences [B, N, D]
        q = spatial_feat.flatten(2).transpose(1, 2)
        kv = temporal_feat.flatten(2).transpose(1, 2)
        
        norm_q = self.norm_spatial(q)
        norm_kv = self.norm_temporal(kv)
        
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
