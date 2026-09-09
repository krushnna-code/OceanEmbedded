"""
Validation routine for OceanEmbed reconstruction engine.
Evaluates model on validation split and logs performance components including physics terms and uncertainty.
"""

from typing import Dict, Any
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from oceanembed.training.losses import PhysicsAwareReconstructionLoss


@torch.no_grad()
def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: PhysicsAwareReconstructionLoss,
    device: torch.device
) -> Dict[str, float]:
    """
    Evaluates model across validation dataloader.
    """
    model.eval()
    total_loss = 0.0
    total_samples = 0
    
    comp_sums: Dict[str, float] = {}
    
    for batch in dataloader:
        surface = batch["surface"].to(device)
        target = batch["temperature"].to(device)
        mask = batch.get("mask")
        if mask is not None:
            mask = mask.to(device)
            
        out = model(surface, mask=mask)
        surface_sst = surface[:, -1, 0] # channel 0 of latest timestep
        
        loss, comp = criterion(
            pred_mu=out.temperature,
            target_y=target,
            sigma=out.uncertainty,
            log_var=out.log_var,
            surface_sst=surface_sst,
            mask=mask
        )
        
        batch_size = surface.size(0)
        total_loss += loss.item() * batch_size
        total_samples += batch_size
        
        for k, v in comp.items():
            comp_sums[k] = comp_sums.get(k, 0.0) + v * batch_size
            
    if total_samples == 0:
        return {"val_loss": 0.0}
        
    metrics = {f"val_{k}": v / total_samples for k, v in comp_sums.items()}
    metrics["val_loss"] = total_loss / total_samples
    return metrics
