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

    @property
    def mean(self) -> torch.Tensor:
        """Alias for predicted temperature mean."""
        return self.temperature

    @property
    def std(self) -> torch.Tensor:
        """Alias for predicted uncertainty sigma."""
        return self.uncertainty

    @property
    def confidence(self) -> Optional[torch.Tensor]:
        """Confidence score bounded in (0, 1] inversely proportional to uncertainty sigma."""
        if self.uncertainty is not None:
            return 1.0 / (1.0 + self.uncertainty)
        return None

    def to(self, device: torch.device) -> "ReconstructionOutput":
        """Transfers all member tensors to the specified device."""
        return ReconstructionOutput(
            temperature=self.temperature.to(device) if self.temperature is not None else None,
            anomaly=self.anomaly.to(device) if self.anomaly is not None else None,
            uncertainty=self.uncertainty.to(device) if self.uncertainty is not None else None,
            embedding=self.embedding.to(device) if self.embedding is not None else None,
            log_var=self.log_var.to(device) if self.log_var is not None else None,
            metadata=self.metadata
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "temperature": self.temperature,
            "anomaly": self.anomaly,
            "uncertainty": self.uncertainty,
            "embedding": self.embedding,
            "metadata": self.metadata or {}
        }
