"""
OceanEmbed (GNN-Transformer Hybrid): Satellite Embedding-Based Reconstruction Engine.
Reconstructs the 3D Subsurface Ocean Temperature field (15 standard depths: 0m to 1000m)
along with explicit uncertainty estimates sigma(x, y, z) from 7-day surface sequences.

Architecture:
  1. Thermodynamic GNN Branch (SST + SSS)
  2. Dynamic GNN Branch (SLA + currents + winds)
  3. Graph Feature Fusion
  4. Temporal ConvLSTM Module
  5. Cross-Variable & Spatiotemporal Attention Fusion
  6. Latent Ocean Embedding z [B, D, H', W']
  7. Depth-Aware Multi-Task Decoder -> Temperature mu [B, 15, H, W]
  8. Dedicated Heteroscedastic Uncertainty Head -> Uncertainty sigma [B, 15, H, W]
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
from oceanembed.models.thermodynamic_gnn import ThermodynamicGNN
from oceanembed.models.dynamic_gnn import DynamicGNN
from oceanembed.models.graph_fusion import GraphFeatureFusion
from oceanembed.models.convlstm import ConvLSTM
from oceanembed.models.cross_attention import CrossAttentionFusion
from oceanembed.models.depth_embedding import OceanDepthEmbedding
from oceanembed.models.depth_decoder import DepthAwareDecoder
from oceanembed.models.uncertainty_head import UncertaintyHead


class BaseReconstructionModel(nn.Module):
    """
    Abstract Base Class for Ocean Reconstruction Models.
    Enables modular benchmarking of deep-learning architectures vs future baselines.
    """
    def forward(self, surface: torch.Tensor, **kwargs) -> ReconstructionOutput:
        raise NotImplementedError

    def encode_surface(self, surface: torch.Tensor) -> torch.Tensor:
        """Returns the latent ocean embedding tensor z."""
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

    def predict_uncertainty(self, surface: torch.Tensor) -> torch.Tensor:
        """Returns predicted uncertainty maps [B, 15, H, W]."""
        raise NotImplementedError


class OceanEmbed3D(BaseReconstructionModel):
    """
    OceanEmbed GNN-Transformer Hybrid Reconstruction Architecture.
    """
    def __init__(
        self,
        in_channels: int = NUM_SURFACE_CHANNELS,
        temporal_window: int = TEMPORAL_WINDOW_T,
        embedding_dim: int = 128,
        target_h: int = GRID_H,
        target_w: int = GRID_W,
        num_depths: int = NUM_DEPTHS,
        edge_connectivity: int = 8,
        thermodynamic_gnn_layers: int = 3,
        dynamic_gnn_layers: int = 3,
        convlstm_layers: int = 1,
        cross_attention_heads: int = 8,
        use_thermodynamic_branch: bool = True,
        use_dynamic_branch: bool = True,
        use_convlstm: bool = True,
        use_cross_attention: bool = True,
        use_depth_embedding: bool = True,
        use_uncertainty_head: bool = True,
        use_physics_loss: bool = True
    ):
        super().__init__()
        self.in_channels = in_channels
        self.temporal_window = temporal_window
        self.embedding_dim = embedding_dim
        self.target_h = target_h
        self.target_w = target_w
        self.num_depths = num_depths
        
        # Ablation configuration flags
        self.use_thermodynamic_branch = use_thermodynamic_branch
        self.use_dynamic_branch = use_dynamic_branch
        self.use_convlstm = use_convlstm
        self.use_cross_attention = use_cross_attention
        self.use_depth_embedding = use_depth_embedding
        self.use_uncertainty_head = use_uncertainty_head
        self.use_physics_loss = use_physics_loss
        
        # 1. Thermodynamic GNN Branch (SST, SSS -> channels 0, 1)
        if self.use_thermodynamic_branch:
            self.thermo_gnn = ThermodynamicGNN(
                in_channels=2,
                hidden_dims=[32, 64, embedding_dim],
                out_dim=embedding_dim,
                num_layers=thermodynamic_gnn_layers,
                connectivity=edge_connectivity
            )
        else:
            self.thermo_gnn = None
            
        # 2. Dynamic GNN Branch (SLA, uo, vo, uwnd, vwnd -> channels 2..6)
        if self.use_dynamic_branch:
            self.dynamic_gnn = DynamicGNN(
                in_channels=5,
                hidden_dims=[32, 64, embedding_dim],
                out_dim=embedding_dim,
                num_layers=dynamic_gnn_layers,
                connectivity=edge_connectivity
            )
        else:
            self.dynamic_gnn = None
            
        # 3. Graph Feature Fusion
        if self.use_thermodynamic_branch and self.use_dynamic_branch:
            self.graph_fusion = GraphFeatureFusion(
                thermo_dim=embedding_dim,
                dynamic_dim=embedding_dim,
                out_dim=embedding_dim
            )
        else:
            self.graph_fusion = None
            
        # Fallback projection if only one branch is active
        self.single_branch_proj = nn.Conv2d(embedding_dim, embedding_dim, kernel_size=1)
            
        # 4. Temporal ConvLSTM Module
        if self.use_convlstm:
            self.convlstm = ConvLSTM(
                in_channels=embedding_dim,
                hidden_dim=embedding_dim,
                num_layers=convlstm_layers
            )
        else:
            self.convlstm = None
            
        # 5. Cross-Variable Attention Fusion
        if self.use_cross_attention and self.use_convlstm:
            self.cross_attention = CrossAttentionFusion(
                embed_dim=embedding_dim,
                num_heads=cross_attention_heads
            )
        else:
            self.cross_attention = None
            
        # 6. Depth Embedding
        if self.use_depth_embedding:
            self.depth_embed = OceanDepthEmbedding(
                num_depths=num_depths,
                depth_dim=embedding_dim
            )
        else:
            self.depth_embed = None
            
        # 7. Depth-Aware Decoder
        self.decoder = DepthAwareDecoder(
            embed_dim=embedding_dim,
            depth_dim=embedding_dim,
            target_h=target_h,
            target_w=target_w,
            num_depths=num_depths
        )
        
        # 8. Dedicated Uncertainty Head (predicts sigma and log_var)
        if self.use_uncertainty_head:
            self.uncertainty_head = UncertaintyHead(
                in_channels=64, # Matches decoder penultimate feature channels
                num_depths=num_depths
            )
        else:
            self.uncertainty_head = None

    def encode_surface(self, surface_seq: torch.Tensor) -> torch.Tensor:
        """
        Processes 7-day surface input sequence into the Latent Ocean Embedding.
        Args:
            surface_seq: [B, T, C, H, W] (C=7: SST, SSS, SLA, uo, vo, uwnd, vwnd)
        Returns:
            z: Latent Ocean Embedding of shape [B, embedding_dim, H', W']
        """
        B, T, C, H, W = surface_seq.shape
        
        # Split surface into thermodynamic (0, 1) and dynamic (2..6)
        sst_sss = surface_seq[:, :, :2, :, :]
        sla_cur_wnd = surface_seq[:, :, 2:, :, :]
        
        # Process GNN branches
        if self.thermo_gnn is not None and self.dynamic_gnn is not None:
            t_feat = self.thermo_gnn(sst_sss)       # [B, T, D, H', W']
            d_feat = self.dynamic_gnn(sla_cur_wnd)  # [B, T, D, H', W']
            fused_seq = self.graph_fusion(t_feat, d_feat) # [B, T, D, H', W']
            spatial_latest = fused_seq[:, -1]
        elif self.thermo_gnn is not None:
            t_feat = self.thermo_gnn(sst_sss)
            fused_seq = self.single_branch_proj(t_feat.view(B * T, -1, t_feat.shape[-2], t_feat.shape[-1])).view(B, T, -1, t_feat.shape[-2], t_feat.shape[-1])
            spatial_latest = fused_seq[:, -1]
        elif self.dynamic_gnn is not None:
            d_feat = self.dynamic_gnn(sla_cur_wnd)
            fused_seq = self.single_branch_proj(d_feat.view(B * T, -1, d_feat.shape[-2], d_feat.shape[-1])).view(B, T, -1, d_feat.shape[-2], d_feat.shape[-1])
            spatial_latest = fused_seq[:, -1]
        else:
            raise RuntimeError("At least one GNN branch (thermodynamic or dynamic) must be active.")
            
        # Temporal ConvLSTM encoding
        if self.convlstm is not None:
            temporal_rep = self.convlstm(fused_seq)  # [B, D, H', W']
        else:
            temporal_rep = spatial_latest
            
        # Cross-Variable Attention
        if self.cross_attention is not None:
            z = self.cross_attention(spatial_latest, temporal_rep)
        else:
            z = 0.5 * (spatial_latest + temporal_rep)
            
        return z

    def forward(
        self,
        surface_seq: torch.Tensor,
        depth_indices: Optional[torch.Tensor] = None,
        mask: Optional[torch.Tensor] = None
    ) -> ReconstructionOutput:
        """
        Executes complete forward pass through the GNN-hybrid reconstruction engine.
        Args:
            surface_seq: [B, T, C, H, W]
            depth_indices: Optional depth level indices (default: all 15)
            mask: Optional ocean/land mask [H, W] or [B, 1, H, W]
        Returns:
            ReconstructionOutput dataclass containing temperature, anomaly, uncertainty, embedding
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
            
        # 3. Decode into 15 depth temperature maps and extract feature map for uncertainty
        raw_output, dec_feat = self.decoder(
            embedding,
            depth_tokens,
            return_features=True
        ) # raw_output: [B, 15, H, W], dec_feat: [B, 64, H, W]
        
        # 4. Predict uncertainty via dedicated Uncertainty Head
        if self.uncertainty_head is not None:
            sigma, log_var = self.uncertainty_head(dec_feat)
        else:
            sigma = None
            log_var = None
            
        # Apply land-sea mask if provided
        if mask is not None:
            if mask.ndim == 2:
                mask = mask.unsqueeze(0).unsqueeze(0)  # [1, 1, H, W]
            elif mask.ndim == 3:
                mask = mask.unsqueeze(1)               # [B, 1, H, W]
            raw_output = raw_output * mask
            if sigma is not None:
                sigma = sigma * mask
            
        anomaly = raw_output
        temperature = raw_output
        
        return ReconstructionOutput(
            temperature=temperature,
            anomaly=anomaly,
            uncertainty=sigma,
            embedding=embedding,
            log_var=log_var,
            metadata={
                "model_name": "OceanEmbed (GNN-Hybrid)",
                "version": "0.3.0-dev",
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

    def predict_uncertainty(self, surface_seq: torch.Tensor) -> torch.Tensor:
        out = self.forward(surface_seq)
        return out.uncertainty
