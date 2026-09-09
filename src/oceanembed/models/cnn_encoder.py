"""
Multimodal CNN Spatial Encoder for OceanEmbed.
Extracts local gradients, fronts, eddies, and spatial relationships across 7 surface variables.
"""

from typing import List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F


class ResidualBlock(nn.Module):
    """
    Standard pre-activation Residual Convolutional Block with GroupNorm.
    GroupNorm is chosen for stability across small batch sizes common in oceanographic ML.
    """
    def __init__(self, channels: int, num_groups: int = 8):
        super().__init__()
        self.norm1 = nn.GroupNorm(num_groups, channels)
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.norm2 = nn.GroupNorm(num_groups, channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.act = nn.GELU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = self.act(self.norm1(x))
        out = self.conv1(out)
        out = self.act(self.norm2(out))
        out = self.conv2(out)
        return out + residual


class CNNSpatialEncoder(nn.Module):
    """
    Multimodal Surface CNN Encoder.
    Processes [B, C, H, W] or sequence [B*T, C, H, W] into feature maps [B, D, H', W'].
    Downsamples by factor of 4: (101, 241) -> (26, 61).
    """
    def __init__(
        self,
        in_channels: int = 7,
        hidden_dims: Optional[List[int]] = None,
        out_dim: int = 256
    ):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [64, 128, 256]
            
        self.in_channels = in_channels
        self.out_dim = out_dim
        
        # Initial stem: 7 channels -> hidden_dims[0]
        self.stem = nn.Sequential(
            nn.Conv2d(in_channels, hidden_dims[0], kernel_size=5, stride=1, padding=2, bias=False),
            nn.GroupNorm(8, hidden_dims[0]),
            nn.GELU(),
            ResidualBlock(hidden_dims[0], num_groups=8)
        )
        
        # Stage 1 downsampling (stride 2): hidden_dims[0] -> hidden_dims[1]
        self.down1 = nn.Sequential(
            nn.Conv2d(hidden_dims[0], hidden_dims[1], kernel_size=3, stride=2, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dims[1]),
            nn.GELU(),
            ResidualBlock(hidden_dims[1], num_groups=8)
        )
        
        # Stage 2 downsampling (stride 2): hidden_dims[1] -> hidden_dims[2]
        self.down2 = nn.Sequential(
            nn.Conv2d(hidden_dims[1], hidden_dims[2], kernel_size=3, stride=2, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dims[2]),
            nn.GELU(),
            ResidualBlock(hidden_dims[2], num_groups=8)
        )
        
        # Projection to output dimension if different from hidden_dims[-1]
        if hidden_dims[-1] != out_dim:
            self.proj = nn.Conv2d(hidden_dims[-1], out_dim, kernel_size=1)
        else:
            self.proj = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape [B, C, H, W] or [B, T, C, H, W]
        Returns:
            Tensor of shape [B, out_dim, H', W'] or [B, T, out_dim, H', W']
        """
        is_seq = (x.ndim == 5)
        if is_seq:
            B, T, C, H, W = x.shape
            x = x.view(B * T, C, H, W)
            
        feat = self.stem(x)
        feat = self.down1(feat)
        feat = self.down2(feat)
        feat = self.proj(feat)
        
        if is_seq:
            _, D, H_prime, W_prime = feat.shape
            feat = feat.view(B, T, D, H_prime, W_prime)
            
        return feat
