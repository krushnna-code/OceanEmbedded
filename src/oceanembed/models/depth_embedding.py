"""
Physical Depth Embedding Module for OceanEmbed.
Encodes the 15 discrete ocean depths (0m to 1000m) into continuous feature representations.
Combines learned discrete depth tokens with continuous log-scale depth encodings
to inform the decoder of vertical ocean stratification (mixed layer vs thermocline vs deep water).
"""

from typing import List, Optional
import math
import torch
import torch.nn as nn

from oceanembed.data.interfaces import STANDARD_DEPTHS, NUM_DEPTHS


class OceanDepthEmbedding(nn.Module):
    """
    Multi-scale depth embedding.
    Maps depth levels (either discrete indices 0..14 or continuous depth values in meters)
    to a latent vector of dimension `depth_dim`.
    """
    def __init__(
        self,
        num_depths: int = NUM_DEPTHS,
        depth_dim: int = 256,
        depth_values: Optional[List[float]] = None
    ):
        super().__init__()
        if depth_values is None:
            depth_values = STANDARD_DEPTHS
            
        self.num_depths = num_depths
        self.depth_dim = depth_dim
        
        # Register standard depth values as buffer
        self.register_buffer("standard_depths", torch.tensor(depth_values, dtype=torch.float32))
        
        # 1. Discrete learned embedding for the 15 canonical levels
        self.discrete_embed = nn.Embedding(num_depths, depth_dim)
        
        # 2. Continuous log-scale MLP for depth in meters (allows smooth generalization)
        self.continuous_mlp = nn.Sequential(
            nn.Linear(1, depth_dim // 2),
            nn.GELU(),
            nn.Linear(depth_dim // 2, depth_dim),
            nn.GELU()
        )
        
        # 3. Fusion projection
        self.fusion_proj = nn.Linear(depth_dim * 2, depth_dim)
        self.norm = nn.LayerNorm(depth_dim)

    def forward(self, depth_indices: Optional[torch.Tensor] = None) -> torch.Tensor:
        """
        Returns depth embeddings of shape:
        - If depth_indices is None: returns embeddings for all 15 depths -> [15, depth_dim]
        - If depth_indices is provided: returns [K, depth_dim] or [B, K, depth_dim]
        """
        device = self.standard_depths.device
        if depth_indices is None:
            depth_indices = torch.arange(self.num_depths, device=device)
            
        # Discrete embeddings
        disc = self.discrete_embed(depth_indices)
        
        # Physical depth in meters (using log1p for physical scaling: log(1 + depth))
        phys_meters = self.standard_depths[depth_indices].unsqueeze(-1)
        log_depth = torch.log1p(phys_meters)
        cont = self.continuous_mlp(log_depth)
        
        combined = torch.cat([disc, cont], dim=-1)
        out = self.norm(self.fusion_proj(combined))
        return out
