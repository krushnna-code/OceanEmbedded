# OceanEmbed: GNN-Hybrid Deep Learning Reconstruction Engine (v3)

## Overview

OceanEmbed is a dual-branch Graph Neural Network (GNN), ConvLSTM, and Cross-Variable Attention hybrid deep-learning architecture designed to reconstruct 3D subsurface ocean temperature fields ($0\text{--}1000\text{m}$) alongside an explicit spatial uncertainty field ($\sigma$) from 7 surface satellite observation streams.

- **Target Domain**: North Indian Ocean ($5^\circ\text{N}$ to $30^\circ\text{N}$, $45^\circ\text{E}$ to $105^\circ\text{E}$)
- **Horizontal Resolution**: $0.25^\circ \times 0.25^\circ$ ($H = 101$, $W = 241$, $N = 24,341$ graph nodes)
- **Graph Topology**: 8-connectivity spatial neighbourhood ($192,680$ edges)
- **Temporal Sequence**: $T = 7$ daily rolling surface observation window ($T-6 \dots T$)
- **Standard Vertical Depths**: 15 levels:
  `[0m, 5m, 10m, 20m, 30m, 50m, 75m, 100m, 125m, 150m, 200m, 300m, 500m, 700m, 1000m]`
- **Outputs**: Point temperature estimate $\mu(x, y, z) \in \mathbb{R}^{B \times 15 \times 101 \times 241}$ and heteroscedastic uncertainty $\sigma(x, y, z) \in \mathbb{R}^{B \times 15 \times 101 \times 241}$.

---

## 1. Tensor Flow and Architectural Stages

```text
                     SURFACE INPUT (7 vars, 7-day window)
                            [B, 7, 7, 101, 241]
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
     THERMODYNAMIC BRANCH (GNN)                  DYNAMIC BRANCH (GNN)
     SST + SSS (2 channels)                      SLA + currents(U,V) + winds(U,V) (5 channels)
     8-connectivity message passing              8-connectivity message passing
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                          GRAPH FEATURE FUSION
                       Adaptive Gated Node Fusion
                         [B, T, 128, 26, 61]
                                     ▼
                            TEMPORAL ConvLSTM
                        7-Day Sequence Encoding
                           [B, 128, 26, 61]
                                     ▼
                         CROSS-VARIABLE ATTENTION
                   Spatial & Temporal Multi-Head Fusion
                           [B, 128, 26, 61]
                                     ▼
                          LATENT OCEAN EMBEDDING
                         z in R^[B, 128, 26, 61]
                                     │
           [15, 128] ────────────────┴──────────────── Depth Embeddings (0-1000m)
                                     ▼
                            DEPTH-AWARE DECODER
                        U-Net Style Multi-Task Decoder
                          [B, 64, 101, 241] feature map
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
           POINT TEMPERATURE μ(x,y,z)          UNCERTAINTY HEAD σ(x,y,z)
             [B, 15, 101, 241]                     [B, 15, 101, 241]
                                     │
                                     ▼
                         PHYSICS-AWARE COMPOSITE LOSS
         Huber + Surface Consistency + Vertical Smoothness + Thermocline Upweighting + Gaussian NLL
```

---

## 2. Component Details

### A. Thermodynamic GNN Branch (`ThermodynamicGNN`)
- **Input**: SST and SSS ($C=2$) across $T=7$ timesteps: `[B, T, 2, 101, 241]`.
- **Graph Convolution (`GridGraphConv`)**: Implements message passing over an 8-connectivity spatial neighbourhood:
  $$h_i^{(l+1)} = \text{GELU}\left(\text{GroupNorm}\left(W_{\text{self}} h_i^{(l)} + \sum_{j \in \mathcal{N}_8(i)} W_{\text{neigh}} h_j^{(l)}\right)\right)$$
- **Purpose**: Explicitly models frontal sharpness, density contrasts, and salinity gradients across neighbouring oceanic cells.
- **Downsampling**: Stride-2 group-normalized convolutions downscale to $(H', W') = (26, 61)$.

### B. Dynamic GNN Branch (`DynamicGNN`)
- **Input**: SLA, current $U$, current $V$, wind $U$, wind $V$ ($C=5$ channels): `[B, T, 5, 101, 241]`.
- **Architecture**: Symmetrically mirrors the thermodynamic branch with identical layer depths, allowing clean ablation.
- **Purpose**: Captures mesoscale vortex dynamics, shear zones, and wind-driven divergence across the Arabian Sea and Bay of Bengal.

### C. Graph Feature Fusion (`GraphFeatureFusion`)
- **Mechanism**: Adaptive gated node fusion per timestep:
  $$h_{\text{fused}} = \text{GELU}\left(\text{GroupNorm}\left(W_{\text{proj}} [h_{\text{thermo}} \,\|\, h_{\text{dynamic}}]\right)\right) \odot \sigma\left(W_{\text{gate}} [h_{\text{thermo}} \,\|\, h_{\text{dynamic}}]\right) + h_{\text{thermo}}$$
- **Output**: `[B, T, 128, 26, 61]`.

### D. Temporal ConvLSTM (`ConvLSTM`)
- Encodes the 7-day spatiotemporal sequence into a persistent ocean memory state while preserving 2D spatial topology.
- Output: Hidden representation $h_T \in \mathbb{R}^{B \times 128 \times 26 \times 61}$.

### E. Cross-Variable Attention Fusion (`CrossVariableAttentionFusion`)
- Multi-head attention across spatial-temporal streams. Allows dynamic features to modulate thermodynamic structures and vice-versa.
- Output: Latent Ocean Embedding $z \in \mathbb{R}^{B \times 128 \times 26 \times 61}$.

### F. Depth-Aware Decoder (`DepthAwareDecoder`)
- Multi-task decoder conditioning on discrete learned + continuous log-depth embeddings for all 15 standard depths ($0\text{--}1000\text{m}$).
- Output: Point temperature $\mu(x, y, z) \in \mathbb{R}^{B \times 15 \times 101 \times 241}$ and shared intermediate representation `[B, 64, 101, 241]`.

### G. Dedicated Uncertainty Head (`HeteroscedasticUncertaintyHead`)
- Takes intermediate decoder features and passes them through a dedicated convolutional head predicting log-variance:
  $$\log \sigma^2 \in \mathbb{R}^{B \times 15 \times 101 \times 241} \quad \Longrightarrow \quad \sigma = \exp\left(0.5 \cdot \text{clamp}(\log \sigma^2, -10.0, 5.0)\right) + 10^{-3}$$
- **Output**: strictly positive uncertainty spread $\sigma(x, y, z) > 0$.

---

## 3. Physics-Aware Loss Formulation

$$\mathcal{L} = \mathcal{L}_{\text{temp}} + \lambda_{\text{surface}} \mathcal{L}_{\text{surface}} + \lambda_{\text{vertical}} \mathcal{L}_{\text{vertical}} + \lambda_{\text{thermocline}} \mathcal{L}_{\text{thermocline}} + \lambda_{\text{uncertainty}} \mathcal{L}_{\text{uncertainty}}$$

1. **Primary Temperature Loss ($\mathcal{L}_{\text{temp}}$)**: Masked Huber loss ($\delta=1.0$) between predicted $\mu$ and target $Y$.
2. **Surface Consistency Loss ($\mathcal{L}_{\text{surface}}$)**: Penalizes discrepancy between 0m predicted temperature and surface SST observation:
   $$\mathcal{L}_{\text{surface}} = \frac{1}{|\Omega|} \sum_{x, y \in \Omega} \left(\mu(x, y, z=0\text{m}) - \text{SST}_{\text{obs}}(x, y)\right)^2$$
3. **Soft Vertical Smoothness Loss ($\mathcal{L}_{\text{vertical}}$)**: Second-order vertical difference penalty:
   $$\mathcal{L}_{\text{vertical}} = \mathbb{E}\left[\left| \frac{\partial^2 \mu}{\partial z^2} \right|\right]$$
   Softly discourages unphysical stair-stepping while allowing natural thermal inversions (e.g. northern Arabian Sea winter inversions).
4. **Thermocline-Weighted Loss ($\mathcal{L}_{\text{thermocline}}$)**: Upweights reconstruction errors in the hard-to-predict $50\text{m}\text{--}200\text{m}$ barrier layer:
   $$\mathcal{L}_{\text{thermocline}} = \frac{1}{|\Omega_{\text{thermo}}|} \sum_{z \in [50\text{m}, 200\text{m}]} (\mu - Y)^2$$
5. **Heteroscedastic Gaussian NLL Uncertainty Loss ($\mathcal{L}_{\text{uncertainty}}$)**:
   $$\mathcal{L}_{\text{uncertainty}} = \frac{1}{2} \sum \left( \frac{(Y - \mu)^2}{\sigma^2} + \log \sigma^2 \right)$$
   Directly guides the uncertainty head to assign larger spread $\sigma$ to difficult, volatile ocean regimes.

