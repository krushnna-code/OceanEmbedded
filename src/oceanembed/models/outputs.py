"""
Model output containers and interfaces for OceanEmbed.
Future-proof schema supporting temperature, anomaly, uncertainty, and latent embedding.
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any
import torch


@dataclass
class ReconstructionOutput:
    """
    Standard output contract for the OceanEmbed reconstruction engine.
    Now includes predicted temperature mu, anomaly, uncertainty sigma, and latent embedding z.
    """
    temperature: torch.Tensor          # [B, 15, H, W] Point temperature estimate mu (°C)
    anomaly: torch.Tensor              # [B, 15, H, W] Temperature anomaly (°C)
    uncertainty: torch.Tensor          # [B, 15, H, W] Predicted uncertainty spread sigma (°C)
    embedding: torch.Tensor            # [B, D, H', W'] Latent ocean embedding z
    log_var: Optional[torch.Tensor] = None  # Optional [B, 15, H, W] log sigma^2 for Gaussian NLL training loss
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "temperature": self.temperature,
            "anomaly": self.anomaly,
            "uncertainty": self.uncertainty,
            "embedding": self.embedding,
            "metadata": self.metadata or {}
        }
