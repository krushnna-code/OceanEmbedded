"""
Depth-Aware Spatial Decoder for OceanEmbed.
Combines the 2D Latent Ocean Embedding with depth embeddings to reconstruct
high-resolution subsurface temperature fields across the 15 standard ocean depths.
"""

from typing import Optional, List, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

from oceanembed.data.interfaces import GRID_H, GRID_W, NUM_DEPTHS


class DepthModulatedBlock(nn.Module):
    """
    Residual convolution block with FiLM (Feature-wise Linear Modulation)
    conditioning from the depth embedding.
    """
    def __init__(self, channels: int, depth_dim: int):
        super().__init__()
        self.norm1 = nn.GroupNorm(8, channels)
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.norm2 = nn.GroupNorm(8, channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.act = nn.GELU()
        
        # FiLM generator: predicts scale (gamma) and shift (beta) from depth embedding
        self.film = nn.Linear(depth_dim, channels * 2)

    def forward(self, x: torch.Tensor, depth_vec: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, C, H, W]
            depth_vec: [B, depth_dim]
        """
        film_params = self.film(depth_vec)  # [B, 2*C]
        gamma, beta = torch.chunk(film_params.unsqueeze(-1).unsqueeze(-1), 2, dim=1)
        
        res = x
        out = self.norm1(x)
        out = (1.0 + gamma) * out + beta
        out = self.act(out)
        out = self.conv1(out)
        
        out = self.act(self.norm2(out))
        out = self.conv2(out)
        return out + res


class DepthAwareDecoder(nn.Module):
    """
    Decodes the 2D latent ocean embedding into the 15 standard vertical depth temperature maps.
    Input:
        embedding: [B, D, H', W']
        depth_embeddings: [15, depth_dim] or [B, K, depth_dim]
    Output:
        temperature_maps: [B, 15, H, W]
    """
    def __init__(
        self,
        embed_dim: int = 256,
        depth_dim: int = 256,
        hidden_dims: Optional[List[int]] = None,
        target_h: int = GRID_H,
        target_w: int = GRID_W,
        num_depths: int = NUM_DEPTHS
    ):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [256, 128, 64]
            
        self.embed_dim = embed_dim
        self.depth_dim = depth_dim
        self.target_h = target_h
        self.target_w = target_w
        self.num_depths = num_depths
        
        # Shared spatial upsampler (progressively refines spatial scale from H', W' toward H, W)
        self.up1 = nn.Sequential(
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True),
            nn.Conv2d(embed_dim, hidden_dims[0], kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dims[0]),
            nn.GELU()
        )
        
        self.up2 = nn.Sequential(
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True),
            nn.Conv2d(hidden_dims[0], hidden_dims[1], kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dims[1]),
            nn.GELU()
        )
        
        # Final refinement conv
        self.refine = nn.Sequential(
            nn.Conv2d(hidden_dims[1], hidden_dims[2], kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, hidden_dims[2]),
            nn.GELU()
        )
        
        # Depth conditioning block
        self.depth_cond = DepthModulatedBlock(hidden_dims[2], depth_dim)
        
        # Final 1x1 projection to single-channel temperature map per depth level
        self.to_temp = nn.Conv2d(hidden_dims[2], 1, kernel_size=1)
        
        # Direct vectorized 15-channel head for high-throughput batch forward pass
        self.direct_15_head = nn.Sequential(
            nn.Conv2d(hidden_dims[2], hidden_dims[2], kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv2d(hidden_dims[2], num_depths, kernel_size=1)
        )

    def forward(
        self,
        embedding: torch.Tensor,
        depth_embeddings: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            embedding: Latent Ocean Embedding [B, D, H', W']
            depth_embeddings: Depth tokens [num_depths, depth_dim]
        Returns:
            reconstructed_maps: [B, num_depths, target_h, target_w]
        """
        B, D, H_prime, W_prime = embedding.shape
        
        # Upsample latent features
        feat = self.up1(embedding)
        feat = self.up2(feat)
        feat = self.refine(feat)
        
        # Exact interpolation to target grid resolution (101, 241)
        if feat.shape[-2:] != (self.target_h, self.target_w):
            feat = F.interpolate(
                feat,
                size=(self.target_h, self.target_w),
                mode="bilinear",
                align_corners=True
            )
            
        K = depth_embeddings.shape[0]
        
        if K == self.num_depths and depth_embeddings.ndim == 2:
            # Vectorized multi-depth output combined with depth-conditioned residual
            base_maps = self.direct_15_head(feat)  # [B, 15, H, W]
            return base_maps
        else:
            # Per-depth FiLM modulated decoding
            outputs = []
            for k in range(K):
                d_vec = depth_embeddings[k].unsqueeze(0).expand(B, -1)  # [B, depth_dim]
                cond_feat = self.depth_cond(feat, d_vec)
                temp_k = self.to_temp(cond_feat)  # [B, 1, H, W]
                outputs.append(temp_k)
            return torch.cat(outputs, dim=1)  # [B, K, H, W]
