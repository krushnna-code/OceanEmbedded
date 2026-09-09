"""
Dynamic Graph Neural Network (GNN) Branch for OceanEmbed.
Processes Sea Level Anomaly (SLA), Surface Currents (uo, vo), and Surface Winds (uwnd, vwnd) (5 channels)
over the 2D ocean spatial grid graph to capture mesoscale eddies, vorticity, current shear, and wind forcing.
"""

from typing import List, Optional
import torch
import torch.nn as nn

from oceanembed.models.thermodynamic_gnn import GridGraphConv


class DynamicGNN(nn.Module):
    """
    Dynamic Branch:
    Input: SLA, current U, current V, wind U, wind V (5 channels) across T timesteps.
    Stack of GNN message-passing layers + residual blocks.
    Outputs dynamic spatial features [B, T, out_dim, H', W'].
    """
    def __init__(
        self,
        in_channels: int = 5,
        hidden_dims: Optional[List[int]] = None,
        out_dim: int = 128,
        num_layers: int = 3,
        connectivity: int = 8
    ):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [32, 64, 128]
            
        self.in_channels = in_channels
        self.out_dim = out_dim
        
        # Initial projection to first graph dimension
        self.input_proj = nn.Conv2d(in_channels, hidden_dims[0], kernel_size=1)
        
        # GNN layer stack
        gnn_layers = []
        in_d = hidden_dims[0]
        for l in range(num_layers):
            out_d = hidden_dims[min(l + 1, len(hidden_dims) - 1)]
            gnn_layers.append(GridGraphConv(in_d, out_d, connectivity=connectivity))
            in_d = out_d
        self.gnn_stack = nn.ModuleList(gnn_layers)
        
        # Spatial downsampling stage to match latent representation scale (101x241 -> 26x61)
        self.downsample = nn.Sequential(
            nn.Conv2d(in_d, out_dim, kernel_size=3, stride=2, padding=1, bias=False),
            nn.GroupNorm(8, out_dim),
            nn.GELU(),
            nn.Conv2d(out_dim, out_dim, kernel_size=3, stride=2, padding=1, bias=False),
            nn.GroupNorm(8, out_dim),
            nn.GELU()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, 5, H, W] or [B, T, 5, H, W]
        Returns:
            [B, out_dim, H', W'] or [B, T, out_dim, H', W']
        """
        is_seq = (x.ndim == 5)
        if is_seq:
            B, T, C, H, W = x.shape
            x = x.view(B * T, C, H, W)
            
        h = self.input_proj(x)
        for layer in self.gnn_stack:
            h_out = layer(h)
            h = h_out + h if h.shape[1] == h_out.shape[1] else h_out
            
        feat = self.downsample(h)
        
        if is_seq:
            _, D, H_prime, W_prime = feat.shape
            feat = feat.view(B, T, D, H_prime, W_prime)
            
        return feat
