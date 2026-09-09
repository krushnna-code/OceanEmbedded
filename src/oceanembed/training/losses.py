"""
Physical and reconstruction loss functions for OceanEmbed.
Supports Huber / MSE reconstruction with optional vertical stratification
and spatial gradient smoothness regularizations.
"""

from typing import Dict, Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F


class ReconstructionLoss(nn.Module):
    """
    Composite Ocean Reconstruction Loss:
      L = L_temp + lambda_vertical * L_vertical + lambda_spatial * L_spatial
      
    Note: As specified in Section 20, monotonicity with depth is NOT forced,
    allowing realistic temperature inversions (e.g. Arabian Sea winter inversions).
    """
    def __init__(
        self,
        loss_type: str = "huber",
        huber_delta: float = 1.0,
        lambda_vertical: float = 0.01,
        lambda_spatial: float = 0.005
    ):
        super().__init__()
        self.loss_type = loss_type.lower()
        self.huber_delta = huber_delta
        self.lambda_vertical = lambda_vertical
        self.lambda_spatial = lambda_spatial

    def forward(
        self,
        pred: torch.Tensor,
        target: torch.Tensor,
        mask: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """
        Args:
            pred: Reconstructed temperature [B, 15, H, W]
            target: Ground-truth temperature [B, 15, H, W]
            mask: Ocean mask [H, W] or [B, 1, H, W] (1=ocean, 0=land)
        Returns:
            total_loss: scalar torch.Tensor
            loss_components: Dict of floats for logging
        """
        if mask is not None:
            if mask.ndim == 2:
                mask = mask.unsqueeze(0).unsqueeze(0)
            elif mask.ndim == 3:
                mask = mask.unsqueeze(1)
            pred = pred * mask
            target = target * mask
            valid_elements = mask.sum() * pred.shape[1]
            if valid_elements == 0:
                valid_elements = 1.0
        else:
            valid_elements = pred.numel()

        # 1. Base temperature reconstruction loss
        if self.loss_type == "huber":
            l_temp = F.huber_loss(pred, target, delta=self.huber_delta, reduction="sum") / valid_elements
        else:
            l_temp = F.mse_loss(pred, target, reduction="sum") / valid_elements

        # 2. Vertical smoothness regularization (second vertical difference)
        # Penalizes unphysical vertical zig-zagging without enforcing monotonicity
        if self.lambda_vertical > 0 and pred.shape[1] >= 3:
            # diff across depth dimension (dim=1)
            d1 = pred[:, 1:] - pred[:, :-1]
            d2 = d1[:, 1:] - d1[:, :-1]
            if mask is not None:
                d2 = d2 * mask
            l_vert = torch.mean(torch.abs(d2))
        else:
            l_vert = torch.tensor(0.0, device=pred.device)

        # 3. Spatial total variation regularization (smoothness over ocean eddy fields)
        if self.lambda_spatial > 0:
            diff_h = torch.abs(pred[:, :, 1:, :] - pred[:, :, :-1, :])
            diff_w = torch.abs(pred[:, :, :, 1:] - pred[:, :, :, :-1])
            l_spatial = torch.mean(diff_h) + torch.mean(diff_w)
        else:
            l_spatial = torch.tensor(0.0, device=pred.device)

        total_loss = l_temp + self.lambda_vertical * l_vert + self.lambda_spatial * l_spatial

        loss_dict = {
            "loss_total": float(total_loss.item()),
            "loss_temp": float(l_temp.item()),
            "loss_vertical": float(l_vert.item()),
            "loss_spatial": float(l_spatial.item())
        }
        return total_loss, loss_dict
