"""
Physics-Aware and Heteroscedastic Loss Formulation for OceanEmbed.
Combines:
  1. Primary Reconstruction Loss (Huber / MSE)
  2. Surface Consistency Loss (penalizes 0m reconstructed deviation from surface SST input)
  3. Soft Vertical Smoothness Loss (penalizes large adjacent depth jumps, non-monotonic)
  4. Thermocline-Weighted Loss (upweights 50m - 200m depth reconstruction errors)
  5. Heteroscedastic Gaussian NLL Uncertainty Loss (trains uncertainty head sigma)
"""

from typing import Dict, Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

from oceanembed.data.interfaces import STANDARD_DEPTHS, NUM_DEPTHS


class PhysicsAwareReconstructionLoss(nn.Module):
    """
    Total Loss:
      L = L_temperature
          + lambda_surface     * L_surface_consistency
          + lambda_vertical    * L_vertical_smoothness
          + lambda_thermocline * L_thermocline_weight
          + lambda_uncertainty * L_uncertainty
    """
    def __init__(
        self,
        loss_type: str = "huber",
        huber_delta: float = 1.0,
        lambda_surface: float = 0.05,
        lambda_vertical: float = 0.05,
        lambda_thermocline: float = 0.1,
        lambda_uncertainty: float = 0.1,
        thermocline_min_depth: float = 50.0,
        thermocline_max_depth: float = 200.0
    ):
        super().__init__()
        self.loss_type = loss_type.lower()
        self.huber_delta = huber_delta
        self.lambda_surface = lambda_surface
        self.lambda_vertical = lambda_vertical
        self.lambda_thermocline = lambda_thermocline
        self.lambda_uncertainty = lambda_uncertainty
        
        # Identify depth indices corresponding to thermocline (50m to 200m)
        self.register_buffer("depths", torch.tensor(STANDARD_DEPTHS, dtype=torch.float32))
        thermo_mask = (self.depths >= thermocline_min_depth) & (self.depths <= thermocline_max_depth)
        self.register_buffer("thermocline_mask", thermo_mask.float())

    def forward(
        self,
        pred_mu: torch.Tensor,
        target_y: torch.Tensor,
        sigma: Optional[torch.Tensor] = None,
        log_var: Optional[torch.Tensor] = None,
        surface_sst: Optional[torch.Tensor] = None,
        mask: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, Dict[str, float]]:
        """
        Args:
            pred_mu: Predicted temperature mu [B, 15, H, W]
            target_y: Ground truth temperature [B, 15, H, W]
            sigma: Predicted uncertainty sigma [B, 15, H, W]
            log_var: Predicted log-variance log(sigma^2) [B, 15, H, W]
            surface_sst: Optional surface SST observation [B, H, W] or [B, 1, H, W]
            mask: Optional ocean mask [H, W] or [B, 1, H, W]
        Returns:
            total_loss: scalar tensor
            loss_components: Dict of floats for logging
        """
        if mask is not None:
            if mask.ndim == 2:
                mask = mask.unsqueeze(0).unsqueeze(0) # [1, 1, H, W]
            elif mask.ndim == 3:
                mask = mask.unsqueeze(1)              # [B, 1, H, W]
            pred_mu = pred_mu * mask
            target_y = target_y * mask
            valid_elements = mask.sum() * pred_mu.shape[1]
            if valid_elements == 0:
                valid_elements = torch.tensor(1.0, device=pred_mu.device)
        else:
            valid_elements = torch.tensor(pred_mu.numel(), device=pred_mu.device, dtype=torch.float32)

        # 1. Base temperature reconstruction loss
        if self.loss_type == "huber":
            l_temp = F.huber_loss(pred_mu, target_y, delta=self.huber_delta, reduction="sum") / valid_elements
        else:
            l_temp = F.mse_loss(pred_mu, target_y, reduction="sum") / valid_elements

        # 2. Surface Consistency Loss: 0m predicted temperature vs surface observation
        if self.lambda_surface > 0 and surface_sst is not None:
            if surface_sst.ndim == 4:
                surface_sst = surface_sst.squeeze(1) # [B, H, W]
            pred_surface = pred_mu[:, 0] # depth index 0 = 0m
            diff_surface = pred_surface - surface_sst
            if mask is not None:
                diff_surface = diff_surface * mask.squeeze(1)
                s_valid = mask.squeeze(1).sum()
                l_surf = (diff_surface ** 2).sum() / max(1.0, float(s_valid))
            else:
                l_surf = torch.mean(diff_surface ** 2)
        else:
            l_surf = torch.tensor(0.0, device=pred_mu.device)

        # 3. Soft Vertical Smoothness Loss: penalizes second vertical differences
        if self.lambda_vertical > 0 and pred_mu.shape[1] >= 3:
            d1 = pred_mu[:, 1:] - pred_mu[:, :-1]
            d2 = d1[:, 1:] - d1[:, :-1]
            if mask is not None:
                d2 = d2 * mask
            l_vert = torch.mean(torch.abs(d2))
        else:
            l_vert = torch.tensor(0.0, device=pred_mu.device)

        # 4. Thermocline-Weighted Loss (50m - 200m)
        if self.lambda_thermocline > 0:
            thermo_weights = self.thermocline_mask.view(1, -1, 1, 1) # [1, 15, 1, 1]
            thermo_diff = (pred_mu - target_y) * thermo_weights
            if mask is not None:
                thermo_diff = thermo_diff * mask
            thermo_count = self.thermocline_mask.sum()
            if mask is not None:
                denom = mask.sum() * thermo_count
            else:
                denom = pred_mu.shape[0] * thermo_count * pred_mu.shape[2] * pred_mu.shape[3]
            l_thermo = (thermo_diff ** 2).sum() / max(1.0, float(denom))
        else:
            l_thermo = torch.tensor(0.0, device=pred_mu.device)

        # 5. Heteroscedastic Gaussian NLL Uncertainty Loss: 0.5 * ( (y - mu)^2 / sigma^2 + log(sigma^2) )
        if self.lambda_uncertainty > 0 and log_var is not None:
            # log_var is log(sigma^2), exp(-log_var) = 1 / sigma^2
            sq_err = (target_y - pred_mu) ** 2
            nll_term = 0.5 * (sq_err * torch.exp(-log_var) + log_var)
            if mask is not None:
                nll_term = nll_term * mask
            l_unc = nll_term.sum() / valid_elements
        else:
            l_unc = torch.tensor(0.0, device=pred_mu.device)

        # Total Composite Loss
        total_loss = (
            l_temp
            + self.lambda_surface * l_surf
            + self.lambda_vertical * l_vert
            + self.lambda_thermocline * l_thermo
            + self.lambda_uncertainty * l_unc
        )

        loss_dict = {
            "loss_total": float(total_loss.item()),
            "loss_temp": float(l_temp.item()),
            "loss_surface": float(l_surf.item()),
            "loss_vertical": float(l_vert.item()),
            "loss_thermocline": float(l_thermo.item()),
            "loss_uncertainty": float(l_unc.item())
        }
        return total_loss, loss_dict


# Alias for backward compatibility with existing imports
ReconstructionLoss = PhysicsAwareReconstructionLoss
