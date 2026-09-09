# Scientific Visualization Architecture

## Overview

The OceanEmbed visualization interface is built with Next.js, TypeScript, and Three.js WebGL, adhering to institutional and government-scientific design principles (clean white/light backgrounds, deep navy text, ocean-blue accents, restrained borders, and clear semantic labeling).

---

## 1. 2D Ocean Horizontal Reconstruction Map

- **Domain**: North Indian Ocean ($5^\circ\text{N}$ to $30^\circ\text{N}$, $45^\circ\text{E}$ to $105^\circ\text{E}$).
- **Rendering**: HTML5 Canvas with sub-millisecond rasterization from downsampled backend payloads.
- **Colormaps**:
  - **Absolute Temperature**: Thermal colormap ranging from deep navy ($4^\circ\text{C}$ in deep water) through cyan, green, and yellow up to deep red ($30^\circ\text{C}$ at the tropical surface).
  - **Temperature Anomaly**: Diverging blue-white-red palette centered at $0^\circ\text{C}$.
- **Land Masking**: Neutral dark charcoal (`#1e293b`) covering the Indian subcontinent, Arabian Peninsula, and Southeast Asia.
- **Interactions**:
  - **Click-to-Probe**: Clicking any point on the ocean updates the shared application coordinates `(selectedLat, selectedLon)`.
  - **Hover Inspection**: Displays instantaneous latitude, longitude, and temperature readout in an overlay tooltip.
  - **Synchronized Crosshair**: Indicates the actively probed geographic location.

---

## 2. Interactive 3D Ocean Volume (Three.js WebGL)

The 3D viewer represents the North Indian Ocean as a 3D volumetric block with axes:
- **X-Axis**: Longitude ($45^\circ\text{E}$ to $105^\circ\text{E}$, width = 7 units).
- **Z-Axis**: Latitude ($5^\circ\text{N}$ to $30^\circ\text{N}$, depth = 3.5 units).
- **Y-Axis**: Vertical Depth ($0\text{m}$ to $1000\text{m}$, height = 3.5 units).

> [!NOTE]
> The vertical depth axis is visually exaggerated for scientific readability. The interface prominently displays: *"Depth axis visually exaggerated"*.

### Supported 3D Modes:
1. **Mode 1: 15 Layered Depth Planes**:
   All 15 standard depth planes are rendered simultaneously with depth-scaled transparency, allowing inspection of the vertical heat stack.
2. **Mode 2: Single Depth Slice**:
   Displays the horizontal temperature field exclusively at the currently selected depth level.
3. **Mode 3: Vertical Curtain Cross-Section**:
   Renders a vertical slice along a user-specified latitude or longitude line, cutting through the water column from surface to $1000\text{m}$.
4. **Mode 4: 3D Coordinate Probe**:
   A 3D marker and dashed water column probe line track the active `(lat, lon, depth)` selection.

### Camera & Orbit Controls:
- **Rotate**: Click and drag across the canvas.
- **Zoom**: Scroll wheel or pinch gesture.
- **Reset View**: Button to quickly restore standard top-oblique projection.

---

## 3. Vertical Subsurface Profile Explorer

- **Graph**: Inverted depth profile graph (Y-axis: $0\text{m}$ at surface down to $1000\text{m}$ at bottom).
- **Thermocline Layer Shading**: Highlights the critical $50\text{m}\text{--}200\text{m}$ thermocline zone with soft cyan tinting.
- **Uncertainty Band ($\mu \pm \sigma$)**: Shaded polygon enclosing the point prediction $\mu$ with the model's predicted spread $\sigma$, rendered in translucent violet (`rgba(147, 51, 234, 0.18)`).
- **Table**: Full numerical breakdown of all 15 standard depths with temperature (°C), uncertainty ($\sigma$), and anomaly values.
- **Scientific Labeling**: Explicitly states: *"Model development demo $\sigma$ (internal training signal, not validated confidence interval)."*
- **Validation Notice**: Transparently flags that independent in-situ ARGO float comparison is *"Validation pending"* in this development phase.

---

## 4. Heteroscedastic Uncertainty Explorer

- **Dedicated View**: Accessible via the "Uncertainty Explorer" navigation tab and via the "Show Uncertainty (σ)" toggle on the reconstruction dashboard.
- **Distinct Non-Alarming Palette**: Maps internal $\sigma$ values using an indigo $\to$ violet $\to$ magenta $\to$ cyan gradient, strictly avoiding red/yellow warning connotations.
- **Purpose**: Displays the spatial variation of model certainty—revealing where high frontal variability or missing observations naturally produce wider predicted spreads.
- **Prominent Disclaimers**: Labeled `DEMO / MODEL DEVELOPMENT DATA` with a banner emphasizing that $\sigma$ is an internal signal from the Gaussian NLL loss head.

---

## 5. Shared State Synchronization

The application maintains a single unified state model across all views:

```text
       ┌──────────────────────────────┐
       │        Central State         │
       │                              │
       │  - selectedDate              │
       │  - selectedDepth             │
       │  - selectedLat               │
       │  - selectedLon               │
       │  - isAnomaly                 │
       │  - showUncertainty           │
       │  - activeTab                 │
       └──────────────┬───────────────┘
                      │
     ┌────────────────┼────────────────┬────────────────┐
     ▼                ▼                ▼                ▼
  2D Map          3D Volume      Profile Panel    Uncertainty
(Horizontal)       (WebGL)         (Vertical)       Explorer
```

- Clicking on the 2D map at `(12.50°N, 82.25°E)` moves the 3D probe and refreshes the vertical profile graph.
- Selecting a depth (e.g. `100m`) updates the 2D map slice, the 3D layer highlight, and the profile table cursor.
- Toggling uncertainty activates the dedicated $\sigma$ field across both 2D horizontal slices and profile bands.

