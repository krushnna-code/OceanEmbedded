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
    """
    temperature: torch.Tensor          # [B, 15, H, W] Absolute temperature in °C
    anomaly: torch.Tensor              # [B, 15, H, W] Temperature anomaly in °C
    embedding: torch.Tensor            # [B, D, H', W'] Latent ocean embedding
    uncertainty: Optional[torch.Tensor] = None  # Optional formal uncertainty map [B, 15, H, W]
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "temperature": self.temperature,
            "anomaly": self.anomaly,
            "embedding": self.embedding,
            "uncertainty": self.uncertainty,
            "metadata": self.metadata or {}
        }
