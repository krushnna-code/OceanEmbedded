"""
Thermodynamic Graph Neural Network (GNN) Branch for OceanEmbed.
Processes Sea Surface Temperature (SST) and Sea Surface Salinity (SSS) (2 channels)
over the 2D ocean spatial grid graph to capture fronts, density gradients, and mixed-layer boundaries.
"""

from typing import List, Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

from oceanembed.data.interfaces import GRID_H, GRID_W


class GridGraphConv(nn.Module):
    """
    Spatial Graph Convolution layer for 2D ocean grid cells.
    Implements message passing over 8-connectivity spatial neighbourhood:
        h_i^(l+1) = act( norm( W_self * h_i^(l) + sum_{j in N(i)} W_neigh * h_j^(l) ) )
    """
    def __init__(self, in_channels: int, out_channels: int, connectivity: int = 8):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.connectivity = connectivity

        # Self-loop transformation
        self.linear_self = nn.Conv2d(in_channels, out_channels, kernel_size=1, bias=False)
        
        # Spatial neighbour message passing kernel (3x3 captures 8-connectivity)
        self.linear_neigh = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=3,
            padding=1,
            bias=False
        )
        self.norm = nn.GroupNorm(num_groups=min(8, out_channels), num_channels=out_channels)
        self.act = nn.GELU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape [B, in_channels, H, W]
        Returns:
            out: Tensor of shape [B, out_channels, H, W]
        """
        # Node self-representation
        h_self = self.linear_self(x)
        # Message passing from 8-connected neighbours
        h_neigh = self.linear_neigh(x)
        
        out = self.act(self.norm(h_self + h_neigh))
        return out


class ThermodynamicGNN(nn.Module):
    """
    Thermodynamic Branch:
    Input: SST and SSS (2 channels) across T timesteps: [B, T, 2, H, W] or [B, 2, H, W].
    Stack of 2-3 GNN message-passing layers + residual blocks.
    Outputs thermodynamic spatial features [B, T, out_dim, H', W'].
    """
    def __init__(
        self,
        in_channels: int = 2,
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
            x: [B, 2, H, W] or [B, T, 2, H, W]
        Returns:
            [B, out_dim, H', W'] or [B, T, out_dim, H', W']
        """
        is_seq = (x.ndim == 5)
        if is_seq:
            B, T, C, H, W = x.shape
            x = x.view(B * T, C, H, W)
            
        h = self.input_proj(x)
        for layer in self.gnn_stack:
            h = layer(h) + (h if h.shape[1] == layer.out_channels else 0)
            
        feat = self.downsample(h)
        
        if is_seq:
            _, D, H_prime, W_prime = feat.shape
            feat = feat.view(B, T, D, H_prime, W_prime)
            
        return feat
