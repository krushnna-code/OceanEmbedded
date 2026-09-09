# OceanEmbed

**Satellite Embedding-Based Deep Learning Framework for Reconstruction of Subsurface Ocean Temperature from Surface Satellite Observations**

*Target Region: North Indian Ocean ($5^\circ\text{N}$ to $30^\circ\text{N}$, $45^\circ\text{E}$ to $105^\circ\text{E}$)*  
*Grid Resolution: $0.25^\circ \times 0.25^\circ$ (101 latitude $\times$ 241 longitude nodes)*  
*Vertical Depths (15 levels): 0m, 5m, 10m, 20m, 30m, 50m, 75m, 100m, 125m, 150m, 200m, 300m, 500m, 700m, 1000m*

---

## System Architecture

```text
       Surface Observations (SST, SSS, SLA, uo, vo, uwnd, vwnd)
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
         CNN + Transformer Encoder       ConvLSTM Temporal Module
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                     Cross-Attention Fusion Layer
                                  ▼
                     Latent Ocean Embedding (z)
                                  │
             Depth Embeddings ────┴──── 15 Vertical Levels
                                  ▼
                         Depth-Aware Decoder
                                  ▼
               15 Subsurface Temperature Maps [B, 15, H, W]
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
             FastAPI Backend             Scientific Frontend
         (REST & 3D Volume API)       (2D Map & Three.js 3D WebGL)
```

---

## Quick Start & Running the System

### 1. Prerequisites
- Python 3.10+ (PyTorch, FastAPI, Xarray, NetCDF4)
- Node.js 18+ and npm

### 2. Python Environment Setup
```bash
# Install package in editable mode
python -m pip install -e .
```

### 3. Run Automated Tests & Smoke Test
```bash
# Run complete test suite (24 tests: backend, fixtures, model)
python -m pytest -v

# Run end-to-end integration smoke test
python scripts/smoke_test.py
```

### 4. Start the FastAPI Backend
```bash
# Starts backend service on http://localhost:8000
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start the Scientific Dashboard Frontend
```bash
cd frontend
npm run dev
# Dashboard is accessible at http://localhost:3000
```

---

## Directory Structure

```text
/
├── configs/                  # YAML configurations (model, training, frontend)
│   ├── model.yaml
│   ├── training.yaml
│   └── frontend.yaml
├── data/
│   └── dev_fixtures/         # Section 7A Real NetCDF fixture files (schema references)
├── src/
│   └── oceanembed/
│       ├── data/             # Interfaces, synthetic generator, fixture inspector, regrid stubs
│       ├── models/           # CNN, Transformer, ConvLSTM, Cross-Attention, Depth Decoder
│       ├── training/         # Training pipeline, composite loss, validation, checkpointing
│       ├── services/         # Reconstruction service, preprocessing & anomaly stubs
│       └── utils/            # Seed reproducibility utilities
├── backend/
│   └── app/                  # FastAPI main application, typed schemas, and REST endpoints
├── frontend/
│   ├── app/                  # Next.js App Router pages and layout
│   ├── components/
│   │   ├── map/              # 2D Canvas ocean map with thermal colormap
│   │   ├── ocean3d/          # Interactive Three.js WebGL 3D volume viewer
│   │   ├── profile/          # Vertical profile graph and 15-depth readout table
│   │   ├── controls/         # Parametric depth, date, and anomaly selectors
│   │   └── layout/           # Government-scientific portal header and navigation
│   ├── lib/api/              # Typed API client connecting to FastAPI backend
│   └── types/                # TypeScript schemas matching backend Pydantic models
├── scripts/
│   ├── smoke_test.py         # End-to-end integration verification script
│   └── inspect_fixtures.py   # Development fixture inspection utility
├── tests/
│   ├── model/                # Neural component, forward pass, shape, and seed tests
│   ├── backend/              # FastAPI REST endpoint integration tests
│   └── data/                 # Fixture schema checks against real NetCDF files
└── docs/
    ├── architecture.md       # Long-term vs current subsystem architecture
    ├── model.md              # Deep learning tensor flow and component specifications
    └── visualization.md      # 2D/3D visualization and shared state synchronization
```

---

## Scientific Protocol & Development Status

In accordance with strict research integrity protocols:
- Dev fixture files (`OSTIA`, `CCMP`, `DUACS`, `CMEMS`) are single non-coincident timesteps used strictly for **schema validation**, not model training.
- Development training is executed on physically-grounded **synthetic development fields**.
- Independent validation metrics (ARGO / GLORYS collocations) are clearly marked **"Validation pending"** until Phase 2 data harmonization is conducted.
