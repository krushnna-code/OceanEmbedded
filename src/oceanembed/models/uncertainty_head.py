"""
Dedicated Heteroscedastic Uncertainty Head for OceanEmbed.
Predicts point temperature estimate mu(x, y, z) and predicted uncertainty sigma(x, y, z)
across the 15 standard ocean depth levels.
"""

from typing import Tuple, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F

from oceanembed.data.interfaces import GRID_H, GRID_W, NUM_DEPTHS


class UncertaintyHead(nn.Module):
    """
    Predicts log-variance (log sigma^2) and converts to standard deviation sigma > 0.
    Output: sigma [B, 15, H, W]
    """
    def __init__(
        self,
        in_channels: int = 64,
        num_depths: int = NUM_DEPTHS,
        min_sigma: float = 1e-3,
        max_sigma: float = 10.0
    ):
        super().__init__()
        self.in_channels = in_channels
        self.num_depths = num_depths
        self.min_sigma = min_sigma
        self.max_sigma = max_sigma
        
        # Dedicated convolutional uncertainty prediction head
        self.conv_layers = nn.Sequential(
            nn.Conv2d(in_channels, in_channels, kernel_size=3, padding=1),
            nn.GroupNorm(num_groups=min(8, in_channels), num_channels=in_channels),
            nn.GELU(),
            nn.Conv2d(in_channels, in_channels // 2, kernel_size=3, padding=1),
            nn.GELU(),
            nn.Conv2d(in_channels // 2, num_depths, kernel_size=1)
        )

    def forward(self, feature_map: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            feature_map: Decoder penultimate feature map [B, in_channels, H, W]
        Returns:
            sigma: Standard deviation tensor [B, 15, H, W] (strictly positive)
            log_var: Log-variance tensor [B, 15, H, W] (used for Gaussian NLL loss)
        """
        raw_log_var = self.conv_layers(feature_map) # [B, 15, H, W]
        
        # Clamp log_var for strict numerical stability in training loss: -10 <= log_var <= 5
        log_var = torch.clamp(raw_log_var, min=-10.0, max=5.0)
        
        # sigma = sqrt(exp(log_var)) = exp(0.5 * log_var)
        sigma = torch.exp(0.5 * log_var) + self.min_sigma
        sigma = torch.clamp(sigma, max=self.max_sigma)
        
        return sigma, log_var


# Alias for explicit specification naming
HeteroscedasticUncertaintyHead = UncertaintyHead

