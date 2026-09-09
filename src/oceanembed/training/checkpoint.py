"""
Model checkpoint management for OceanEmbed.
Saves and loads versioned PyTorch checkpoints including model weights, optimizer,
scheduler, configuration, seed, and training metadata without overwriting previous runs.
"""

import os
from datetime import datetime
from typing import Dict, Any, Optional
import torch
import torch.nn as nn


def save_checkpoint(
    model: nn.Module,
    optimizer: Optional[torch.optim.Optimizer] = None,
    scheduler: Optional[Any] = None,
    epoch: int = 0,
    metrics: Optional[Dict[str, float]] = None,
    config: Optional[Dict[str, Any]] = None,
    seed: int = 42,
    checkpoint_dir: str = "checkpoints",
    model_version: str = "0.1.0-dev",
    tag: Optional[str] = None
) -> str:
    """
    Saves a versioned checkpoint file.
    Filename pattern: oceanembed_v{version}_{timestamp}_{tag}.pt
    """
    os.makedirs(checkpoint_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    tag_str = f"_{tag}" if tag else ""
    filename = f"oceanembed_v{model_version}_{timestamp}{tag_str}.pt"
    save_path = os.path.join(checkpoint_dir, filename)
    
    state = {
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict() if optimizer else None,
        "scheduler_state_dict": scheduler.state_dict() if scheduler else None,
        "epoch": epoch,
        "metrics": metrics or {},
        "config": config or {},
        "seed": seed,
        "model_version": model_version,
        "timestamp": timestamp
    }
    
    torch.save(state, save_path)
    
    # Also update 'latest.pt' pointer for convenient inference serving
    latest_path = os.path.join(checkpoint_dir, "latest.pt")
    torch.save(state, latest_path)
    
    return save_path


def load_checkpoint(
    checkpoint_path: str,
    model: nn.Module,
    optimizer: Optional[torch.optim.Optimizer] = None,
    scheduler: Optional[Any] = None,
    device: str = "cpu"
) -> Dict[str, Any]:
    """Loads a checkpoint into the model and optional optimizer."""
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at: {checkpoint_path}")
        
    state = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state["model_state_dict"])
    
    if optimizer and state.get("optimizer_state_dict"):
        optimizer.load_state_dict(state["optimizer_state_dict"])
    if scheduler and state.get("scheduler_state_dict"):
        scheduler.load_state_dict(state["scheduler_state_dict"])
        
    return state
