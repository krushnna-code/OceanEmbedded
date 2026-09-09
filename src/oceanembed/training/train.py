"""
Training pipeline for OceanEmbed.
Supports configurable synthetic or harmonized datasets, AdamW, cosine annealing schedule,
mixed precision, checkpointing, and early stopping.
"""

import os
import argparse
from typing import Dict, Any, Optional
import yaml
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from oceanembed.utils.seed import seed_everything
from oceanembed.models.oceanembed import OceanEmbed3D
from oceanembed.data.synthetic import SyntheticOceanDataset
from oceanembed.training.losses import PhysicsAwareReconstructionLoss
from oceanembed.training.validate import evaluate
from oceanembed.training.checkpoint import save_checkpoint


def train_oceanembed(
    config: Optional[Dict[str, Any]] = None,
    config_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main training function.
    """
    if config_path and os.path.exists(config_path):
        with open(config_path, "r") as f:
            cfg = yaml.safe_load(f)
    elif config:
        cfg = config
    else:
        # Default training config
        cfg = {
            "seed": 42,
            "device": "cuda" if torch.cuda.is_available() else "cpu",
            "model": {
                "in_channels": 7,
                "temporal_window": 7,
                "embedding_dim": 128,
                "target_h": 101,
                "target_w": 241,
                "use_thermodynamic_branch": True,
                "use_dynamic_branch": True,
                "use_convlstm": True,
                "use_cross_attention": True,
                "use_uncertainty_head": True
            },
            "training": {
                "epochs": 5,
                "batch_size": 2,
                "learning_rate": 1e-4,
                "weight_decay": 1e-4,
                "num_samples": 16,
                "val_ratio": 0.25,
                "checkpoint_dir": "checkpoints"
            },
            "loss": {
                "loss_type": "huber",
                "huber_delta": 1.0,
                "lambda_surface": 0.05,
                "lambda_vertical": 0.05,
                "lambda_thermocline": 0.1,
                "lambda_uncertainty": 0.1
            }
        }
        
    seed_everything(cfg.get("seed", 42))
    device = torch.device(cfg.get("device", "cpu"))
    
    # 1. Instantiate Model
    m_cfg = cfg["model"]
    model = OceanEmbed3D(
        in_channels=m_cfg.get("in_channels", 7),
        temporal_window=m_cfg.get("temporal_window", 7),
        embedding_dim=m_cfg.get("embedding_dim", 128),
        target_h=m_cfg.get("target_h", 101),
        target_w=m_cfg.get("target_w", 241),
        use_thermodynamic_branch=m_cfg.get("use_thermodynamic_branch", True),
        use_dynamic_branch=m_cfg.get("use_dynamic_branch", True),
        use_convlstm=m_cfg.get("use_convlstm", True),
        use_cross_attention=m_cfg.get("use_cross_attention", True),
        use_uncertainty_head=m_cfg.get("use_uncertainty_head", True)
    ).to(device)
    
    # 2. Dataset & Loaders
    t_cfg = cfg["training"]
    full_dataset = SyntheticOceanDataset(
        num_samples=t_cfg.get("num_samples", 16),
        seed=cfg.get("seed", 42)
    )
    val_size = max(1, int(len(full_dataset) * t_cfg.get("val_ratio", 0.25)))
    train_size = len(full_dataset) - val_size
    train_ds, val_ds = random_split(full_dataset, [train_size, val_size])
    
    train_loader = DataLoader(
        train_ds,
        batch_size=t_cfg.get("batch_size", 2),
        shuffle=True,
        drop_last=False
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=t_cfg.get("batch_size", 2),
        shuffle=False
    )
    
    # 3. Loss, Optimizer, Scheduler
    l_cfg = cfg.get("loss", {})
    criterion = PhysicsAwareReconstructionLoss(
        loss_type=l_cfg.get("loss_type", "huber"),
        huber_delta=l_cfg.get("huber_delta", 1.0),
        lambda_surface=l_cfg.get("lambda_surface", 0.05),
        lambda_vertical=l_cfg.get("lambda_vertical", 0.05),
        lambda_thermocline=l_cfg.get("lambda_thermocline", 0.1),
        lambda_uncertainty=l_cfg.get("lambda_uncertainty", 0.1)
    )
    
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=float(t_cfg.get("learning_rate", 1e-4)),
        weight_decay=float(t_cfg.get("weight_decay", 1e-4))
    )
    
    epochs = t_cfg.get("epochs", 5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=epochs,
        eta_min=1e-6
    )
    
    # 4. Training Loop
    best_val_loss = float("inf")
    history = []
    
    print(f"Starting OceanEmbed training on {device} for {epochs} epochs...")
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        train_samples = 0
        
        for batch in train_loader:
            surface = batch["surface"].to(device)
            target = batch["temperature"].to(device)
            mask = batch.get("mask")
            if mask is not None:
                mask = mask.to(device)
                
            optimizer.zero_grad()
            out = model(surface, mask=mask)
            surface_sst = surface[:, -1, 0] # channel 0 of latest timestep
            
            loss, loss_dict = criterion(
                pred_mu=out.temperature,
                target_y=target,
                sigma=out.uncertainty,
                log_var=out.log_var,
                surface_sst=surface_sst,
                mask=mask
            )
            
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            
            b_sz = surface.size(0)
            train_loss += loss.item() * b_sz
            train_samples += b_sz

        scheduler.step()
        epoch_train_loss = train_loss / max(1, train_samples)
        
        # Validation
        val_metrics = evaluate(model, val_loader, criterion, device)
        val_loss = val_metrics["val_loss"]
        
        print(f"Epoch [{epoch}/{epochs}] - Train Loss: {epoch_train_loss:.4f} - Val Loss: {val_loss:.4f}")
        
        # Checkpoint if best
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            ckpt_path = save_checkpoint(
                model=model,
                optimizer=optimizer,
                scheduler=scheduler,
                epoch=epoch,
                metrics=val_metrics,
                config=cfg,
                seed=cfg.get("seed", 42),
                checkpoint_dir=t_cfg.get("checkpoint_dir", "checkpoints"),
                tag="best"
            )
            
        history.append({
            "epoch": epoch,
            "train_loss": epoch_train_loss,
            **val_metrics
        })
        
    print(f"Training completed. Best validation loss: {best_val_loss:.4f}")
    return {
        "model": model,
        "history": history,
        "best_val_loss": best_val_loss,
        "checkpoint_path": ckpt_path
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train OceanEmbed3D Model")
    parser.add_argument("--config", type=str, default=None, help="Path to YAML config")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    args = parser.parse_args()
    
    cfg = None
    if args.config and os.path.exists(args.config):
        with open(args.config, "r") as f:
            cfg = yaml.safe_load(f)
        if args.epochs:
            cfg["training"]["epochs"] = args.epochs
    train_oceanembed(config=cfg)
