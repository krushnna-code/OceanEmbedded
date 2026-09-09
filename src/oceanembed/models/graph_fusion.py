"""
Graph Feature Fusion for OceanEmbed.
Combines thermodynamic and dynamic GNN branch representations per grid node
using adaptive learned gating and linear projection.
"""

from typing import Optional
import torch
import torch.nn as nn


class GraphFeatureFusion(nn.Module):
    """
    Fuses Thermodynamic and Dynamic graph features:
      h_fused = W_proj * [h_thermo || h_dynamic] * gate + h_thermo
    """
    def __init__(
        self,
        thermo_dim: int = 128,
        dynamic_dim: int = 128,
        out_dim: int = 128
    ):
        super().__init__()
        self.thermo_dim = thermo_dim
        self.dynamic_dim = dynamic_dim
        self.out_dim = out_dim
        
        # Linear projection of concatenated features
        self.proj = nn.Sequential(
            nn.Conv2d(thermo_dim + dynamic_dim, out_dim, kernel_size=1, bias=False),
            nn.GroupNorm(num_groups=min(8, out_dim), num_channels=out_dim),
            nn.GELU()
        )
        
        # Adaptive gating mechanism
        self.gate = nn.Sequential(
            nn.Conv2d(thermo_dim + dynamic_dim, out_dim, kernel_size=1),
            nn.Sigmoid()
        )
        
        # Residual projection if dimensions differ
        if thermo_dim != out_dim:
            self.res_proj = nn.Conv2d(thermo_dim, out_dim, kernel_size=1)
        else:
            self.res_proj = nn.Identity()

    def forward(
        self,
        thermo_feat: torch.Tensor,
        dynamic_feat: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            thermo_feat: [B, D_t, H, W] or [B, T, D_t, H, W]
            dynamic_feat: [B, D_d, H, W] or [B, T, D_d, H, W]
        Returns:
            fused: [B, out_dim, H, W] or [B, T, out_dim, H, W]
        """
        is_seq = (thermo_feat.ndim == 5)
        if is_seq:
            B, T, D_t, H, W = thermo_feat.shape
            _, _, D_d, _, _ = dynamic_feat.shape
            thermo_feat = thermo_feat.view(B * T, D_t, H, W)
            dynamic_feat = dynamic_feat.view(B * T, D_d, H, W)
            
        combined = torch.cat([thermo_feat, dynamic_feat], dim=1)
        projected = self.proj(combined)
        g = self.gate(combined)
        
        fused = projected * g + self.res_proj(thermo_feat)
        
        if is_seq:
            fused = fused.view(B, T, self.out_dim, H, W)
            
        return fused
