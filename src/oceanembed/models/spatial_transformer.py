"""
Spatial Transformer Module for OceanEmbed.
Processes CNN latent feature maps through tokenization, 2D positional embeddings,
and Multi-Head Self-Attention layers to capture long-range spatial teleconnections and eddy dynamics.
"""

from typing import Optional
import torch
import torch.nn as nn
import math


class SpatialPositionalEncoding2D(nn.Module):
    """
    2D Learnable Positional Encoding for downsampled ocean feature maps.
    """
    def __init__(self, embed_dim: int, max_h: int = 128, max_w: int = 256):
        super().__init__()
        self.pos_embed = nn.Parameter(torch.zeros(1, embed_dim, max_h, max_w))
        nn.init.trunc_normal_(self.pos_embed, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x is [B, D, H', W']
        _, _, h, w = x.shape
        return x + self.pos_embed[:, :, :h, :w]


class SpatialTransformerBlock(nn.Module):
    """
    Transformer Encoder Block with Pre-LayerNorm and Multi-Head Self-Attention.
    """
    def __init__(self, embed_dim: int = 256, num_heads: int = 8, mlp_ratio: float = 4.0, dropout: float = 0.0):
        super().__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attn = nn.MultiheadAttention(
            embed_dim=embed_dim,
            num_heads=num_heads,
            dropout=dropout,
            batch_first=True
        )
        self.norm2 = nn.LayerNorm(embed_dim)
        mlp_hidden_dim = int(embed_dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, mlp_hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(mlp_hidden_dim, embed_dim),
            nn.Dropout(dropout)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x is [B, N, D]
        norm_x = self.norm1(x)
        attn_out, _ = self.attn(norm_x, norm_x, norm_x)
        x = x + attn_out
        x = x + self.mlp(self.norm2(x))
        return x


class SpatialTransformer(nn.Module):
    """
    Spatial Transformer Encoder.
    Receives [B, D, H', W'], adds 2D positional encoding, tokens are flattened into [B, H'*W', D],
    processed through N Transformer layers, and reshaped back to [B, D, H', W'].
    """
    def __init__(
        self,
        embed_dim: int = 256,
        num_heads: int = 8,
        num_layers: int = 2,
        mlp_ratio: float = 4.0,
        dropout: float = 0.0
    ):
        super().__init__()
        self.pos_encoder = SpatialPositionalEncoding2D(embed_dim)
        self.layers = nn.ModuleList([
            SpatialTransformerBlock(
                embed_dim=embed_dim,
                num_heads=num_heads,
                mlp_ratio=mlp_ratio,
                dropout=dropout
            )
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, D, H', W']
        Returns:
            [B, D, H', W']
        """
        B, D, H, W = x.shape
        x_pos = self.pos_encoder(x)  # [B, D, H, W]
        
        # Flatten spatial dimensions: [B, D, H, W] -> [B, H*W, D]
        tokens = x_pos.flatten(2).transpose(1, 2)
        
        for layer in self.layers:
            tokens = layer(tokens)
            
        tokens = self.norm(tokens)
        
        # Reshape back: [B, H*W, D] -> [B, D, H, W]
        out = tokens.transpose(1, 2).view(B, D, H, W)
        return out
