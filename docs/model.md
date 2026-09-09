# OceanEmbed3D: Deep Learning Reconstruction Engine

## Overview

OceanEmbed3D is a satellite embedding-based deep learning architecture designed to reconstruct the 3D subsurface ocean temperature field from multimodal satellite observations.

- **Target Domain**: North Indian Ocean ($5^\circ\text{N}$ to $30^\circ\text{N}$, $45^\circ\text{E}$ to $105^\circ\text{E}$)
- **Horizontal Resolution**: $0.25^\circ \times 0.25^\circ$ ($H = 101$, $W = 241$)
- **Temporal Sequence**: $T = 7$ daily surface observation timesteps
- **Standard Vertical Depths**: 15 levels:
  `[0m, 5m, 10m, 20m, 30m, 50m, 75m, 100m, 125m, 150m, 200m, 300m, 500m, 700m, 1000m]`

---

## 1. Tensor Flow and Architectural Stages

```text
[B, 7, 7, 101, 241]  Surface Sequence (SST, SSS, SLA, uo, vo, uwnd, vwnd)
        │
        ▼
[B*T, 128, 26, 61]   Multimodal CNN Spatial Encoder (GroupNorm + Residual Blocks)
        │
        ├─────────────────────────────┐
        ▼                             ▼
[B, 128, 26, 61]              [B, 128, 26, 61]
Spatial Transformer           ConvLSTM Temporal Module
(Patch Self-Attention)        (7-day advective & heat memory)
        │                             │
        ▼                             ▼
     (Query)                      (Key/Value)
        └──────────────┬──────────────┘
                       ▼
[B, 128, 26, 61]     Cross-Attention Fusion Layer
                       ▼
[B, 128, 26, 61]     Latent Ocean Embedding (z)
                       │
       [15, 128] ──────┴────── Depth Embedding (Learned + Log-depth MLP)
                       ▼
[B, 15, 101, 241]    Depth-Aware Decoder (FiLM modulation + Bilinear Upsampling)
                       ▼
[B, 15, 101, 241]    15 Subsurface Temperature Maps
```

---

## 2. Component Details

### A. Multimodal CNN Spatial Encoder (`CNNSpatialEncoder`)
- **Input**: `[B, T, C, H, W]` where $C=7$ (SST, SSS, SLA, $u_o$, $v_o$, $u_{\text{wnd}}$, $v_{\text{wnd}}$)
- **Stem**: $5\times 5$ conv (stride 1) + GroupNorm(8) + GELU + ResidualBlock
- **Downsampling**: Two stride-2 convolutional blocks reducing spatial dimensions by a factor of 4:
  $$(H, W) = (101, 241) \longrightarrow (H', W') = (26, 61)$$
- **Output**: `[B, T, D, H', W']` ($D=128$)

### B. Spatial Transformer (`SpatialTransformer`)
- Operates on the latest timestep's spatial feature map `[B, D, H', W']`.
- Adds 2D learnable positional encodings: `SpatialPositionalEncoding2D`.
- Flattens spatial patches into tokens `[B, H'*W', D]` ($N = 26 \times 61 = 1586$).
- Multi-Head Self-Attention ($H=8$, pre-LayerNorm) captures mesoscale eddy dynamics and teleconnections across the Arabian Sea and Bay of Bengal.

### C. ConvLSTM Temporal Module (`ConvLSTM`)
- Processes the full sequence of spatial feature maps `[B, T, D, H', W']`.
- Employs 2D convolutions in the input, forget, cell, and output gates to preserve spatial topology while tracking advective thermal evolution and wind-driven mixing over the 7-day window.
- Yields final hidden state $h_T \in \mathbb{R}^{B \times D \times H' \times W'}$.

### D. Cross-Attention Fusion (`CrossAttentionFusion`)
- **Query**: Spatial state representation from the Transformer.
- **Key & Value**: Temporal evolution memory from ConvLSTM.
- Questions answered: *"What spatial surface structures should be modulated by recent temporal evolution?"*
- Produces the fused **Latent Ocean Embedding** $z \in \mathbb{R}^{B \times D \times H' \times W'}$.

### E. Physical Depth Embedding (`OceanDepthEmbedding`)
- Combines discrete learned embeddings for the 15 standard depths ($0..14$) with continuous log-scale depth features ($\log(1 + z_{\text{meters}})$) via an MLP.
- Represents vertical physical regimes: mixed layer ($0\text{--}30\text{m}$), thermocline ($50\text{--}200\text{m}$), and deep ocean ($300\text{--}1000\text{m}$).

### F. Depth-Aware Decoder (`DepthAwareDecoder`)
- Combines the 2D Latent Ocean Embedding with depth embeddings.
- Progressively upsamples features back to the target grid resolution ($101 \times 241$) using bilinear interpolation and group-normalized residual convolutions.
- Employs FiLM (Feature-wise Linear Modulation) conditioning to generate distinct, physically stratified temperature maps at each depth level.

---

## 3. Loss Function Formulation

The training loss is formulated as a multi-objective composite criterion:

$$\mathcal{L} = \mathcal{L}_{\text{temp}} + \lambda_{\text{vertical}} \mathcal{L}_{\text{vertical}} + \lambda_{\text{spatial}} \mathcal{L}_{\text{spatial}}$$

Where:
1. **$\mathcal{L}_{\text{temp}}$**: Masked Huber loss on valid ocean grid cells ($\delta = 1.0$).
2. **$\mathcal{L}_{\text{vertical}}$**: Second vertical difference penalty:
   $$\mathcal{L}_{\text{vertical}} = \mathbb{E}\left[\left| \frac{\partial^2 T}{\partial z^2} \right|\right]$$
   Penalizes unphysical vertical oscillations without enforcing strict monotonicity (preserving natural temperature inversions common in the northern Arabian Sea).
3. **$\mathcal{L}_{\text{spatial}}$**: Total variation spatial gradient regularizer over ocean eddy fields.
