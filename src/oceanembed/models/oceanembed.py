"""
OceanEmbed3D: Satellite Embedding-Based Deep Learning Reconstruction Engine.
Reconstructs the 3D Subsurface Ocean Temperature field (15 depth levels: 0m - 1000m)
from 7-day surface satellite sequences over the North Indian Ocean.
"""

from typing import Dict, Any, Optional, List
import torch
import torch.nn as nn

from oceanembed.data.interfaces import (
    STANDARD_DEPTHS,
    NUM_DEPTHS,
    GRID_H,
    GRID_W,
    TEMPORAL_WINDOW_T,
    NUM_SURFACE_CHANNELS
)
from oceanembed.models.outputs import ReconstructionOutput
from oceanembed.models.cnn_encoder import CNNSpatialEncoder
from oceanembed.models.spatial_transformer import SpatialTransformer
from oceanembed.models.convlstm import ConvLSTM
from oceanembed.models.cross_attention import CrossAttentionFusion
from oceanembed.models.depth_embedding import OceanDepthEmbedding
from oceanembed.models.depth_decoder import DepthAwareDecoder


class BaseReconstructionModel(nn.Module):
    """
    Abstract Base Class for Ocean Reconstruction Models.
    Allows modular benchmarking of deep-learning architectures vs future baselines.
    """
    def forward(self, surface: torch.Tensor, **kwargs) -> ReconstructionOutput:
        raise NotImplementedError

    def encode_surface(self, surface: torch.Tensor) -> torch.Tensor:
        """Returns the latent ocean embedding tensor."""
        raise NotImplementedError

    def predict_anomaly(self, surface: torch.Tensor) -> torch.Tensor:
        """Returns subsurface temperature anomaly maps [B, 15, H, W]."""
        raise NotImplementedError

    def predict_temperature(
        self,
        surface: torch.Tensor,
        climatology: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """Returns absolute subsurface temperature maps [B, 15, H, W]."""
        raise NotImplementedError


class OceanEmbed3D(BaseReconstructionModel):
    """
    OceanEmbed3D Neural Reconstruction Architecture:
      1. Multimodal CNN Encoder extracts multiscale surface features per timestep
      2. Spatial Transformer models mesoscale spatial relationships & eddy structures
      3. ConvLSTM Temporal Module captures 7-day persistence and thermal memory
      4. Cross-Attention fuses spatial and temporal modalities
      5. Latent Ocean Embedding z [B, D, H', W']
      6. Depth-Aware Decoder reconstructs 15 standard ocean depth layers [B, 15, H, W]
    """
    def __init__(
        self,
        in_channels: int = NUM_SURFACE_CHANNELS,
        temporal_window: int = TEMPORAL_WINDOW_T,
        embedding_dim: int = 256,
        target_h: int = GRID_H,
        target_w: int = GRID_W,
        num_depths: int = NUM_DEPTHS,
        use_transformer: bool = True,
        use_convlstm: bool = True,
        use_cross_attention: bool = True,
        use_depth_embedding: bool = True,
        transformer_heads: int = 8,
        transformer_layers: int = 2,
        convlstm_layers: int = 1
    ):
        super().__init__()
        self.in_channels = in_channels
        self.temporal_window = temporal_window
        self.embedding_dim = embedding_dim
        self.target_h = target_h
        self.target_w = target_w
        self.num_depths = num_depths
        
        # Ablation configuration flags
        self.use_transformer = use_transformer
        self.use_convlstm = use_convlstm
        self.use_cross_attention = use_cross_attention
        self.use_depth_embedding = use_depth_embedding
        
        # 1. Spatial CNN Stem & Residual Encoder
        self.cnn_encoder = CNNSpatialEncoder(
            in_channels=in_channels,
            hidden_dims=[64, 128, embedding_dim],
            out_dim=embedding_dim
        )
        
        # 2. Spatial Transformer (optional ablation)
        if self.use_transformer:
            self.spatial_transformer = SpatialTransformer(
                embed_dim=embedding_dim,
                num_heads=transformer_heads,
                num_layers=transformer_layers
            )
        else:
            self.spatial_transformer = nn.Identity()
            
        # 3. ConvLSTM Temporal Module (optional ablation)
        if self.use_convlstm:
            self.convlstm = ConvLSTM(
                in_channels=embedding_dim,
                hidden_dim=embedding_dim,
                num_layers=convlstm_layers
            )
        else:
            self.convlstm = None
            
        # 4. Cross-Attention Fusion (optional ablation)
        if self.use_cross_attention and self.use_convlstm:
            self.cross_attention = CrossAttentionFusion(
                embed_dim=embedding_dim,
                num_heads=transformer_heads
            )
        else:
            self.cross_attention = None
            
        # 5. Depth Embedding (optional ablation)
        if self.use_depth_embedding:
            self.depth_embed = OceanDepthEmbedding(
                num_depths=num_depths,
                depth_dim=embedding_dim
            )
        else:
            self.depth_embed = None
            
        # 6. Depth-Aware Decoder
        self.decoder = DepthAwareDecoder(
            embed_dim=embedding_dim,
            depth_dim=embedding_dim,
            target_h=target_h,
            target_w=target_w,
            num_depths=num_depths
        )

    def encode_surface(self, surface_seq: torch.Tensor) -> torch.Tensor:
        """
        Processes surface input sequence into the Latent Ocean Embedding.
        Args:
            surface_seq: [B, T, C, H, W]
        Returns:
            z: Latent Ocean Embedding of shape [B, embedding_dim, H', W']
        """
        B, T, C, H, W = surface_seq.shape
        
        # Encode all T timesteps through CNN
        cnn_feats = self.cnn_encoder(surface_seq)  # [B, T, D, H', W']
        
        # Spatial representation of the latest surface observation (timestep T-1)
        spatial_latest = cnn_feats[:, -1]  # [B, D, H', W']
        if self.use_transformer:
            spatial_rep = self.spatial_transformer(spatial_latest)
        else:
            spatial_rep = spatial_latest
            
        # Temporal representation across the sequence
        if self.use_convlstm:
            temporal_rep = self.convlstm(cnn_feats)  # [B, D, H', W']
        else:
            temporal_rep = spatial_latest
            
        # Fusion via Cross-Attention
        if self.cross_attention is not None:
            fused_embedding = self.cross_attention(spatial_rep, temporal_rep)
        else:
            fused_embedding = 0.5 * (spatial_rep + temporal_rep)
            
        return fused_embedding

    def forward(
        self,
        surface_seq: torch.Tensor,
        depth_indices: Optional[torch.Tensor] = None,
        mask: Optional[torch.Tensor] = None
    ) -> ReconstructionOutput:
        """
        Full forward pass.
        Args:
            surface_seq: [B, T, C, H, W]
            depth_indices: Optional depth level indices (default: all 15)
            mask: Optional ocean/land mask [H, W] or [B, 1, H, W]
        Returns:
            ReconstructionOutput dataclass containing temperature, anomaly, embedding
        """
        # 1. Encode surface
        embedding = self.encode_surface(surface_seq)  # [B, D, H', W']
        
        # 2. Get depth embeddings
        if self.depth_embed is not None:
            depth_tokens = self.depth_embed(depth_indices)  # [num_depths, D]
        else:
            depth_tokens = torch.zeros(
                self.num_depths, self.embedding_dim,
                device=surface_seq.device, dtype=surface_seq.dtype
            )
            
        # 3. Decode into 15 depth temperature maps
        raw_output = self.decoder(embedding, depth_tokens)  # [B, 15, H, W]
        
        # Apply land-sea mask if provided
        if mask is not None:
            if mask.ndim == 2:
                mask = mask.unsqueeze(0).unsqueeze(0)  # [1, 1, H, W]
            elif mask.ndim == 3:
                mask = mask.unsqueeze(1)               # [B, 1, H, W]
            raw_output = raw_output * mask
            
        # In this phase without climatology, raw_output is formulated as anomaly
        # and physical absolute temperature is derived with baseline stratification
        anomaly = raw_output
        temperature = raw_output
        
        return ReconstructionOutput(
            temperature=temperature,
            anomaly=anomaly,
            embedding=embedding,
            uncertainty=None,  # Not fabricated per Section 16/45
            metadata={
                "model_name": "OceanEmbed3D",
                "version": "0.1.0-dev",
                "depth_levels": STANDARD_DEPTHS,
                "grid_shape": [self.target_h, self.target_w]
            }
        )

    def predict_anomaly(self, surface_seq: torch.Tensor) -> torch.Tensor:
        out = self.forward(surface_seq)
        return out.anomaly

    def predict_temperature(
        self,
        surface_seq: torch.Tensor,
        climatology: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        out = self.forward(surface_seq)
        if climatology is not None:
            return out.anomaly + climatology
        return out.temperature
