# System Architecture & Implementation Status

## 1. Overall System Architecture

The long-term architecture of the OceanEmbed system comprises five operational layers:

```text
RAW SATELLITE DATA (OSTIA, CMEMS, DUACS, CCMP)
      │
      ▼
1. PREPROCESSING & HARMONIZATION SERVICE (Stubs implemented)
      │
      ▼
2. FEATURE ENGINEERING & DATASET INTERFACE (Implemented)
      │
      ▼
3. DEEP-LEARNING RECONSTRUCTION ENGINE (OceanEmbed3D, Implemented)
      │
      ▼
4. ANOMALY, UNCERTAINTY & ARGO VALIDATION (Stubs implemented)
      │
      ▼
5. OUTPUT & SERVICE LAYER (FastAPI Backend, Implemented)
      │
      ▼
6. SCIENTIFIC VISUALIZATION PORTAL (Next.js + Three.js, Implemented)
```

---

## 2. Implementation Status Summary

| Subsystem / Module | Implementation Status | Purpose in Current Phase |
| :--- | :--- | :--- |
| **OceanEmbed3D Neural Engine** | **COMPLETED** | Full PyTorch CNN-Transformer-ConvLSTM-CrossAttention architecture |
| **Dataset Interface (`SurfaceOceanDataset`)** | **COMPLETED** | Standardized `[B, T, C, H, W]` abstraction |
| **Synthetic Dataset Generator** | **COMPLETED** | Grounded physical mock fields for training and software validation |
| **Dev Fixture Inspector** | **COMPLETED** | Validates real product schemas against Section 7A files |
| **Preprocessing Interface Stubs** | **INTERFACE STUB** | PreprocessingService signatures (`regrid`, `convert_units`, `align`) |
| **Anomaly & UQ Interface Stubs** | **INTERFACE STUB** | AnomalyDetection, UncertaintyService, ARGOValidationService |
| **Output Product Stubs** | **INTERFACE STUB** | NetCDF/Zarr export specifications |
| **FastAPI Backend Service** | **COMPLETED** | REST endpoints (`/health`, `/config`, `/models`, `/reconstruction`, `/profile`, `/volume`, `/embedding`) |
| **Government-Scientific Dashboard** | **COMPLETED** | Next.js portal adhering to official visual standards |
| **Interactive 2D Ocean Map** | **COMPLETED** | Canvas-based thermal colormapping & point probing |
| **Interactive 3D Ocean Volume** | **COMPLETED** | WebGL Three.js renderer with depth slices and cross-sections |
| **Synchronized State Model** | **COMPLETED** | Coordinated lat/lon/depth state across 2D, 3D, and profile views |

---

## 3. Real Observational Fixtures Inventory (Section 7A)

Five real, single-timestep NetCDF sample files are preserved under `dataset/training/` (accessible via `data/dev_fixtures/`). They are used exclusively to validate schema contracts and variable units:

| Product | Source Sample File | Real Variable(s) | Units | Native Grid | Timestamp |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SST** | `METOFFICE-GLO-SST-L4-REP-OBS-SST_*.nc` | `analysed_sst`, `analysis_error`, `mask`, `sea_ice_fraction` | Kelvin | $0.05^\circ$ global ($3600 \times 7200$) | 2026-03-31 (daily) |
| **SSS** | `cmems_obs-mob_glo_phy-sss_..._multi_P1D_*.nc` | `sos`, `sos_error`, `dos`, `dos_error` | PSU ($0.001$), $\text{kg/m}^3$ | $0.125^\circ$ global ($1440 \times 2880$) | 2024-12-15 (daily) |
| **SSH / SLA** | `c3s_obs-sl_glo_phy-ssh_..._twosat-l4-duacs-0.25deg_*.nc` | `sla`, `adt`, `ugos`, `vgos`, `ugosa`, `vgosa`, `err_sla` | meters, m/s | $0.25^\circ$ global ($720 \times 1440$) | 2026-01-16 (daily) |
| **Currents** | `cmems_obs-mob_glo_phy-cur_..._0.25deg_PT1H-i_*.nc` | `uo`, `vo`, `ue`, `ve`, `utide`, `vtide` | m/s | $0.25^\circ$ global ($720 \times 1440$) | 2026-03-31 (hourly) |
| **Winds** | `CCMP_Wind_Analysis_20200610_V03.1_L4.nc` | `uwnd`, `vwnd`, `ws`, `nobs` | $\text{m s}^{-1}$ | $0.25^\circ$ global ($720 \times 1440$) | 2020-06-10 (6-hourly) |

> [!IMPORTANT]
> Because these 5 fixtures possess disparate dates, they are not a matched multi-day sequence. Per Section 7A & 55, they are not used for model training and no scientific evaluation is derived from them. Full harmonization is planned for Phase 2.

---

## 4. Backend Service Contracts

The FastAPI application (`backend/app/main.py`) exposes:

- `GET /health`: Heartbeat and service status.
- `GET /api/config`: Grid boundaries, 15 standard depths, and available dates.
- `GET /api/models`: Model metadata and architecture specifications.
- `GET /api/reconstruction?date=&depth=&is_anomaly=`: 2D slice at requested depth.
- `GET /api/profile?lat=&lon=&date=`: Subsurface profile at coordinates.
- `GET /api/volume?date=&downsample=`: 3D volume grid for WebGL rendering.
- `GET /api/embedding?date=`: 2D L2-norm of the Latent Ocean Embedding.
- `POST /api/inference`: On-demand development inference endpoint.
