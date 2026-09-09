# OceanEmbed System Architecture & Pipeline Specification (v3)

## 1. Full Target Pipeline (14 Steps) — Authoritative Frozen Architecture

The authoritative end-to-end reconstruction pipeline spans from raw observation ingestion to operational serving. Each step is tagged according to its status in the development phase:

| Step # | Pipeline Stage | Phase Status | Specification & Implementation Notes |
| :--- | :--- | :--- | :--- |
| **1** | **Ingest raw files** | **DEFERRED** | NetCDF/GRIB download via xarray, dask, zarr. Real single-timestep dev fixtures exist on disk for schema verification (Section 8A), but production ingestion is deferred. |
| **2** | **Geographic clipping & quality assessment** | **DEFERRED** | Restrict to North Indian Ocean (5°N–30°N, 45°E–105°E); flag invalid/land values. Handled via `PreprocessingService` interface stub. |
| **3** | **Spatial regridding to 0.25°** | **DEFERRED** | Bilinear / conservative interpolation onto the 101 × 241 master grid. Handled via `PreprocessingService.regrid_to_target_grid`. |
| **4** | **Temporal aggregation to daily fields** | **DEFERRED** | CCMP 6-hourly winds averaged to daily U, V; CMEMS hourly currents averaged to daily. Handled via `PreprocessingService.align_timestamps`. |
| **5** | **Missing-data masking & normalization** | **DEFERRED** | Value + mask channels; scale using training-set statistics only. Handled via `PreprocessingService.apply_land_sea_mask`. |
| **6** | **Build input & target tensors** | **CURRENT PHASE** | Input $X \in \mathbb{R}^{B \times 7 \times 101 \times 241}$, Target $Y \in \mathbb{R}^{B \times 15 \times 101 \times 241}$. Implemented in `SurfaceOceanDataset` and `SyntheticOceanDataset`. |
| **7** | **Temporal windowing** | **CURRENT PHASE** | 7-day rolling sequence per sample ($T-6 \dots T$). Tensor input format: $[B, 7, 7, 101, 241]$. |
| **8** | **OceanEmbed GNN-Hybrid model core** | **CURRENT PHASE** | Thermodynamic GNN branch + Dynamic GNN branch → Adaptive Gated Node Fusion → ConvLSTM → Cross-Variable Attention → Latent Ocean Embedding $z \in \mathbb{R}^{B \times 128 \times 26 \times 61}$. |
| **9** | **Depth-aware decoder** | **CURRENT PHASE** | U-Net style multi-task decoder reconstructing temperature across all 15 standard depths ($0\text{--}1000\text{m}$). |
| **10** | **Physics-aware refinement** | **CURRENT PHASE** | Surface consistency loss ($0\text{m}$ SST), soft vertical smoothness loss, and thermocline-weighted ($50\text{--}200\text{m}$) loss terms in `PhysicsAwareReconstructionLoss`. |
| **11** | **Validation engine** | **DEFERRED** | Comparison against GLORYS12V1 (dense reanalysis training target, explicitly NOT ground truth) and independent ARGO floats (strict train/validation holdout). Stubs in `GLORYSValidationService` & `ARGOValidationService`. |
| **12** | **Metrics & map generation** | **DEFERRED** | RMSE, MAE, bias, Pearson correlation ($r$), $R^2$ per depth and per region. Interface stub in `MetricsService`; returns "validation pending" placeholder. |
| **13** | **Final optimized OceanEmbed model** | **DEFERRED** | Checkpoint selection on real validation + independent ARGO performance requires real validation data. Basic versioned checkpointing is implemented. |
| **14** | **Inference & deployment** | **PARTIALLY CURRENT** | FastAPI serving shell (`/health`, `/config`, `/models`, `/reconstruction`, `/profile`, `/volume`, `/metrics`, `/inference`, `/predict`) + Next.js interactive dashboard: **CURRENT PHASE**. Cloud GPU/Docker/Postgres: **DEFERRED**. |

---

## 2. System Architecture Layers (7 Layers)

Mirroring the INCOIS long-term technical architecture diagram:

```text
LAYER 7 — UI & Visualization Layer                 [PARTIALLY CURRENT]
          (2D Map, 3D WebGL Volume, Synchronized Profiles, Uncertainty Explorer)
                                │
LAYER 6 — Presentation & API Layer                  [CURRENT PHASE]
          (FastAPI REST Endpoints, Pydantic Typed Schemas, JSON Serialization)
                                │
LAYER 5 — Backend & Infrastructure                  [PARTIALLY CURRENT]
          (FastAPI Shell: CURRENT; PostgreSQL, Redis, Docker, Cloud GPU: DEFERRED)
                                │
LAYER 4 — Validation Engine                         [DEFERRED - STUB ONLY]
          (GLORYS12V1 Reanalysis vs ARGO Float In-Situ Holdout Validation)
                                │
LAYER 3 — OceanEmbed Model Core                     [CURRENT PHASE]
          (Dual-Branch GNN + ConvLSTM + Attention + Depth Decoder + Uncertainty Head)
                                │
LAYER 2 — Data Harmonization & Preprocessing        [DEFERRED - STUB ONLY]
          (PreprocessingService: Regridding, Masking, GLORYS Vertical Interpolation)
                                │
LAYER 1 — Curated Satellite & Reanalysis Sources    [DEFERRED - FIXTURES ON DISK]
          (OSTIA SST, CMEMS SSS, DUACS SLA, OSCAR/CMEMS Currents, CCMP Winds)
```

### Layer Breakdown & Phase Status:
- **Layer 1 — Curated Satellite & Reanalysis Data Sources (DEFERRED):** 5 single-timestep schema dev fixtures exist under `data/dev_fixtures/` (and November 2021 coincident files under `dataset/training/`), but automated production downloading is deferred.
- **Layer 2 — Data Harmonization & Preprocessing (DEFERRED):** Geographic clipping, $0.25^\circ$ regridding, temporal alignment, missing-data masking, and GLORYS 50-level to 15-depth vertical interpolation are captured in `PreprocessingService`.
- **Layer 3 — OceanEmbed Model Core (CURRENT PHASE):**
  - **Thermodynamic GNN:** SST + SSS (2 channels), 8-neighbour message passing on grid graph.
  - **Dynamic GNN:** SLA + currents $U,V$ + winds $U,V$ (5 channels), 8-neighbour message passing.
  - **Graph Feature Fusion:** Adaptive gated node fusion.
  - **Temporal ConvLSTM:** 7-day sequential memory ($T-6 \dots T$).
  - **Cross-Variable Attention:** Multi-head attention across spatial-temporal streams.
  - **Latent Ocean Embedding:** Spatiotemporal feature representation $z \in \mathbb{R}^{B \times 128 \times 26 \times 61}$.
  - **Depth-Aware Decoder:** U-Net style multi-task decoder for 15 standard depths ($0\text{--}1000\text{m}$).
  - **Uncertainty Head:** Heteroscedastic Gaussian NLL branch predicting $\sigma(x, y, z) > 0$.
  - **Physics-Aware Loss:** Huber reconstruction + Surface consistency + Soft vertical smoothness + Thermocline weighting + Gaussian NLL uncertainty loss.
- **Layer 4 — Validation Engine (DEFERRED):** `GLORYSValidationService`, `ARGOValidationService`, and `MetricsService` stubs raise `NotImplementedError` per Section 28.
- **Layer 5 — Backend & Infrastructure (PARTIALLY CURRENT):** FastAPI shell with typed responses is built. PostgreSQL metadata store, Redis cache, and Docker/cloud GPU orchestration are deferred.
- **Layer 6 — Presentation & API Layer (CURRENT PHASE):** Full REST API serving reconstructions, profiles with uncertainty bands ($\mu \pm \sigma$), 3D volume grids, and configuration.
- **Layer 7 — UI & Visualization Layer (PARTIALLY CURRENT):** 2D ocean map, 3D WebGL Three.js interactive volume, profile probe with uncertainty shading, and Uncertainty Explorer are active. Marine Heatwave (MHW) and Tropical Cyclone Heat-Content (TCHC) tools are registered placeholders.

---

## 3. Section 7A Reconciliation Note: Named Data Products vs Dev Fixtures

The reference architecture names specific observational products. The dev fixtures on disk represent closely related but distinct products. Per Section 7A, these differences are explicitly documented:

1. **Surface Currents:**
   - *Architecture Diagram Specification:* OSCAR surface currents ($U, V$, $0.25^\circ$, daily).
   - *Dev Fixture on Disk:* CMEMS multi-observation total surface current (`uo`, `vo`, $0.25^\circ$, hourly instantaneous).
   - *Reconciliation:* Both provide total surface currents on a $0.25^\circ$ grid. When the production ingestion pipeline is built in Phase 2, the exact licensing and operational availability (OSCAR vs CMEMS multiobs) will be finalized. They are not silently conflated.
2. **Sea Surface Height / Sea Level Anomaly (SSH/SLA):**
   - *Architecture Diagram Specification:* DUACS SSH/SLA ($0.125^\circ$ daily).
   - *Dev Fixture on Disk:* C3S / DUACS twosat-l4 (`sla`, `adt`, `ugos`, `vgos`, $0.25^\circ$ daily).
   - *Reconciliation:* The actual fixture is natively $0.25^\circ$, which already matches the North Indian Ocean target grid exactly without requiring horizontal spatial regridding.
3. **SST, SSS, and Surface Winds:**
   - OSTIA SST ($0.05^\circ$ L4 daily, Kelvin), CMEMS SSS ($0.125^\circ$ daily, PSU), and CCMP winds ($0.25^\circ$ 6-hourly, $\text{m/s}$) match the architecture diagram specifications.

---

## 4. Real Observational Fixtures Inventory (Section 8A)

| Product | Source Fixture File | Real Variable(s) | Units | Native Grid | Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OSTIA SST** | `METOFFICE-GLO-SST-L4-REP-OBS-SST_*.nc` | `analysed_sst`, `analysis_error` | Kelvin | $0.05^\circ$ | 2026-03-31 |
| **CMEMS SSS** | `cmems_obs-mob_glo_phy-sss_..._multi_P1D_*.nc` | `sos`, `sos_error`, `dos` | PSU | $0.125^\circ$ | 2024-12-15 |
| **C3S/DUACS SLA** | `c3s_obs-sl_glo_phy-ssh_..._twosat-l4-duacs-0.25deg_*.nc` | `sla`, `adt`, `ugos`, `vgos` | m, m/s | $0.25^\circ$ | 2026-01-16 |
| **CMEMS Currents** | `cmems_obs-mob_glo_phy-cur_..._0.25deg_PT1H-i_*.nc` | `uo`, `vo` | m/s | $0.25^\circ$ | 2026-03-31 |
| **CCMP Winds** | `CCMP_Wind_Analysis_20200610_V03.1_L4.nc` | `uwnd`, `vwnd` | m/s | $0.25^\circ$ | 2020-06-10 |

> [!IMPORTANT]
> Because these 5 single-timestep sample files have disparate timestamps, they cannot be stacked into a coherent daily sample. They serve strictly as schema and unit references. No training or scientific validation has been conducted on them.

---

## 5. Future Infrastructure Interfaces (Deferred — Section 40A)

The current backend is structured so the following production components can be integrated without rewriting the service layer:
- **PostgreSQL Metadata Store:** Relational tracking of experiments, model versions, ingestion jobs, and tile catalogs.
- **Redis Cache:** Distributed caching of frequently requested 2D depth slices and downsampled 3D volume grids.
- **Docker + Cloud GPU Deployment:** Multi-stage containerization with CUDA runtime for high-throughput inference.
- **Continuous Model Monitoring:** Operational drift detection and automated comparison against incoming ARGO float profiles.

