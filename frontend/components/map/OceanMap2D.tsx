'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ReconstructionMapData } from '@/types/reconstruction';
import { MapPin, Maximize2, Compass, Download, Wind, Eye, Sparkles, Navigation } from 'lucide-react';

interface OceanMap2DProps {
  data: ReconstructionMapData | null;
  selectedLat: number;
  selectedLon: number;
  onSelectPoint: (lat: number, lon: number) => void;
  loading: boolean;
  showUncertainty?: boolean;
  showStreamlines?: boolean;
}

export const OceanMap2D: React.FC<OceanMap2DProps> = ({
  data,
  selectedLat,
  selectedLon,
  onSelectPoint,
  loading,
  showUncertainty = false,
  showStreamlines = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    lat: number;
    lon: number;
    val: number | null;
    unc: number | null;
    x: number;
    y: number;
  } | null>(null);

  // Particle streamline simulation references
  const particlesRef = useRef<{ x: number; y: number; age: number; maxAge: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // High-fidelity scientific thermal colormap
  const getColormapColor = (val: number, minVal: number, maxVal: number, isAnomaly: boolean): [number, number, number] => {
    if (isAnomaly) {
      // Diverging cool cyan-blue to neutral slate to hot coral-red (-2°C to +2°C)
      const norm = Math.max(-1, Math.min(1, val / 2.0));
      if (norm < 0) {
        const f = 1 + norm;
        return [
          Math.round(20 + 200 * f),
          Math.round(130 + 100 * f),
          Math.round(240 + 15 * f)
        ];
      } else {
        const f = 1 - norm;
        return [
          Math.round(245 + 10 * (1 - f)),
          Math.round(70 + 150 * f),
          Math.round(70 + 150 * f)
        ];
      }
    }

    // Absolute temperature palette: Deep Navy -> Cyber Cyan -> Bright Green -> Amber -> Ruby Red
    const range = Math.max(0.1, maxVal - minVal);
    const t = Math.max(0, Math.min(1, (val - minVal) / range));

    let r = 0, g = 0, b = 0;
    if (t < 0.2) {
      const f = t / 0.2;
      r = Math.round(10 * (1 - f) + 20 * f);
      g = Math.round(25 * (1 - f) + 120 * f);
      b = Math.round(90 * (1 - f) + 220 * f);
    } else if (t < 0.45) {
      const f = (t - 0.2) / 0.25;
      r = Math.round(20 * (1 - f) + 14 * f);
      g = Math.round(120 * (1 - f) + 210 * f);
      b = Math.round(220 * (1 - f) + 180 * f);
    } else if (t < 0.7) {
      const f = (t - 0.45) / 0.25;
      r = Math.round(14 * (1 - f) + 245 * f);
      g = Math.round(210 * (1 - f) + 215 * f);
      b = Math.round(180 * (1 - f) + 30 * f);
    } else if (t < 0.88) {
      const f = (t - 0.7) / 0.18;
      r = Math.round(245 * (1 - f) + 245 * f);
      g = Math.round(215 * (1 - f) + 110 * f);
      b = Math.round(30 * (1 - f) + 20 * f);
    } else {
      const f = (t - 0.88) / 0.12;
      r = Math.round(245 * (1 - f) + 225 * f);
      g = Math.round(110 * (1 - f) + 25 * f);
      b = Math.round(20 * (1 - f) + 50 * f);
    }
    return [r, g, b];
  };

  // Gaussian NLL Uncertainty colormap (violet to electric magenta to cyan)
  const getUncertaintyColor = (val: number, minVal: number, maxVal: number): [number, number, number] => {
    const range = Math.max(0.01, maxVal - minVal);
    const t = Math.max(0, Math.min(1, (val - minVal) / range));
    const r = Math.round(45 * (1 - t) + 220 * t);
    const g = Math.round(20 * (1 - t) + 140 * t);
    const b = Math.round(140 * (1 - t) + 250 * t);
    return [r, g, b];
  };

  // Main Canvas Heatmap Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const gridSource = (showUncertainty && data.uncertainty) ? data.uncertainty : data.values;
    if (!gridSource || gridSource.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numRows = gridSource.length; // 101 lats (5N to 30N)
    const numCols = gridSource[0].length; // 241 lons (45E to 105E)

    const parentWidth = canvas.parentElement?.clientWidth || 800;
    canvas.width = parentWidth;
    canvas.height = 490;
    const width = canvas.width;
    const height = canvas.height;

    const imgData = ctx.createImageData(width, height);
    const buf = imgData.data;

    const minVal = showUncertainty ? (data.uncertainty_stats?.min ?? 0.15) : data.stats.min;
    const maxVal = showUncertainty ? (data.uncertainty_stats?.max ?? 0.7) : data.stats.max;

    for (let py = 0; py < height; py++) {
      const latFraction = 1.0 - py / height;
      const rowIdx = Math.floor(latFraction * (numRows - 1));

      for (let px = 0; px < width; px++) {
        const lonFraction = px / width;
        const colIdx = Math.floor(lonFraction * (numCols - 1));

        const val = gridSource[rowIdx]?.[colIdx];
        const pixelIdx = (py * width + px) * 4;

        if (val === null || val === undefined) {
          // Land cell: Dark carbon slate with subtle topography texture
          const landPattern = (px % 4 === 0 && py % 4 === 0) ? 22 : 16;
          buf[pixelIdx] = landPattern;
          buf[pixelIdx + 1] = landPattern + 8;
          buf[pixelIdx + 2] = landPattern + 18;
          buf[pixelIdx + 3] = 255;
        } else {
          const [r, g, b] = showUncertainty
            ? getUncertaintyColor(val, minVal, maxVal)
            : getColormapColor(val, minVal, maxVal, data.is_anomaly);
          buf[pixelIdx] = r;
          buf[pixelIdx + 1] = g;
          buf[pixelIdx + 2] = b;
          buf[pixelIdx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Coordinate grid overlay
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(241, 245, 249, 0.7)';

    // Latitude parallels (5°N to 30°N)
    for (let lat = 5; lat <= 30; lat += 5) {
      const y = height - ((lat - 5) / 25) * height;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${lat}°N`, 8, y - 4);
    }

    // Longitude meridians (45°E to 105°E)
    for (let lon = 50; lon <= 100; lon += 10) {
      const x = ((lon - 45) / 60) * width;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillText(`${lon}°E`, x + 4, height - 8);
    }
    ctx.setLineDash([]); // Reset line dash

    // Sub-basin labels
    ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;

    const arabianX = ((63 - 45) / 60) * width;
    const arabianY = height - ((16 - 5) / 25) * height;
    ctx.fillText('ARABIAN SEA', arabianX, arabianY);

    const bayX = ((88 - 45) / 60) * width;
    const bayY = height - ((15 - 5) / 25) * height;
    ctx.fillText('BAY OF BENGAL', bayX, bayY);

    const andamanX = ((94 - 45) / 60) * width;
    const andamanY = height - ((11 - 5) / 25) * height;
    ctx.fillText('ANDAMAN SEA', andamanX, andamanY);

    const eqX = ((73 - 45) / 60) * width;
    const eqY = height - ((6.5 - 5) / 25) * height;
    ctx.fillText('EQUATORIAL INDIAN OCEAN', eqX, eqY);

    ctx.shadowBlur = 0; // Reset shadow

    // Draw selected target probe reticle with holographic glow
    if (selectedLat >= 5 && selectedLat <= 30 && selectedLon >= 45 && selectedLon <= 105) {
      const selX = ((selectedLon - 45) / 60) * width;
      const selY = height - ((selectedLat - 5) / 25) * height;

      // Outer animated ring
      ctx.strokeStyle = '#0df2c9';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#0df2c9';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.arc(selX, selY, 11, 0, 2 * Math.PI);
      ctx.stroke();

      // Inner reticle crosshair
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(selX - 16, selY);
      ctx.lineTo(selX - 6, selY);
      ctx.moveTo(selX + 6, selY);
      ctx.lineTo(selX + 16, selY);
      ctx.moveTo(selX, selY - 16);
      ctx.lineTo(selX, selY - 6);
      ctx.moveTo(selX, selY + 6);
      ctx.lineTo(selX, selY + 16);
      ctx.stroke();

      // Center point
      ctx.fillStyle = '#0df2c9';
      ctx.beginPath();
      ctx.arc(selX, selY, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.shadowBlur = 0;
    }
  }, [data, selectedLat, selectedLon, showUncertainty]);

  // Current Streamlines Particle Flow Simulation
  useEffect(() => {
    const canvas = streamlineCanvasRef.current;
    if (!canvas || !showStreamlines) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    canvas.width = parent?.clientWidth || 800;
    canvas.height = 490;
    const width = canvas.width;
    const height = canvas.height;

    // Initialize 240 current particles
    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: 240 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        age: Math.random() * 80,
        maxAge: 70 + Math.random() * 60
      }));
    }

    let isRunning = true;

    const animateParticles = () => {
      if (!isRunning) return;

      // Transparent clear to create motion blur trails
      ctx.clearRect(0, 0, width, height);

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillStyle = 'rgba(13, 242, 201, 0.7)';

      particlesRef.current.forEach((p) => {
        // Convert screen (x, y) to (lon, lat)
        const lon = 45 + (p.x / width) * 60;
        const lat = 5 + (1 - p.y / height) * 25;

        // North Indian Ocean Current Physics Vector Field:
        // Somali Current (western boundary northward jet), Equatorial Counter-Current (eastward jet), EICC (cyclonic in Bay of Bengal)
        let u = 0.4; // zonal velocity (eastward)
        let v = 0.0; // meridional velocity (northward)

        if (lon < 56 && lat < 18) {
          // Somali jet: strong northward flow
          u = 0.8;
          v = 1.4;
        } else if (lon > 82 && lat > 10) {
          // Bay of Bengal gyre
          const centerLat = 15;
          const centerLon = 88;
          const dx = lon - centerLon;
          const dy = lat - centerLat;
          u = -dy * 0.12;
          v = dx * 0.12;
        } else if (lat < 8) {
          // Equatorial Jet
          u = 1.2;
          v = 0.1;
        }

        const nextX = p.x + u * 1.8;
        const nextY = p.y - v * 1.8; // Invert for canvas Y

        // Draw particle trail
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();

        p.x = nextX;
        p.y = nextY;
        p.age++;

        // Reset if out of bounds or expired
        if (p.age > p.maxAge || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.age = 0;
        }
      });

      animFrameRef.current = requestAnimationFrame(animateParticles);
    };

    animFrameRef.current = requestAnimationFrame(animateParticles);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [showStreamlines]);

  // Click handler to select probe point
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const lonFraction = px / canvas.width;
    const latFraction = 1.0 - py / canvas.height;

    const lon = 45.0 + lonFraction * 60.0;
    const lat = 5.0 + latFraction * 25.0;

    // Snap to 0.25° grid node
    const snappedLat = Math.round(lat * 4) / 4;
    const snappedLon = Math.round(lon * 4) / 4;

    onSelectPoint(snappedLat, snappedLon);
  };

  // Mouse move handler for live hover probe
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const lonFraction = px / canvas.width;
    const latFraction = 1.0 - py / canvas.height;

    const lon = 45.0 + lonFraction * 60.0;
    const lat = 5.0 + latFraction * 25.0;

    const snappedLat = Math.round(lat * 4) / 4;
    const snappedLon = Math.round(lon * 4) / 4;

    const rowIdx = Math.round((snappedLat - 5.0) / 0.25);
    const colIdx = Math.round((snappedLon - 45.0) / 0.25);

    const val = data.values[rowIdx]?.[colIdx] ?? null;
    const unc = data.uncertainty?.[rowIdx]?.[colIdx] ?? null;

    setHoverInfo({
      lat: snappedLat,
      lon: snappedLon,
      val,
      unc,
      x: px,
      y: py
    });
  };

  // Snapshot export handler
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `OceanEmbed_Map_${data?.date ?? '2026-03-10'}_${data?.requested_depth_m ?? 0}m.png`;
    a.click();
  };

  return (
    <div className="gov-card">
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Compass size={17} color="#38bdf8" />
          <span>
            {showUncertainty ? 'Gaussian NLL Uncertainty Map σ(x,y,z)' : 'Horizontal Subsurface Reconstruction (0.25°)'}
          </span>
          <span style={{
            fontSize: '0.68rem',
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            padding: '0.12rem 0.5rem',
            borderRadius: '4px'
          }}>
            Depth: {data?.requested_depth_m ?? 0}m
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            onClick={handleExportPNG}
            className="btn-glass"
            title="Download high-resolution map snapshot"
          >
            <Download size={13} />
            <span>Export PNG</span>
          </button>
        </div>
      </div>

      <div className="gov-card-body">
        {/* Canvas Map Container */}
        <div
          className="canvas-map-container"
          onMouseLeave={() => setHoverInfo(null)}
          style={{ cursor: 'crosshair', position: 'relative' }}
        >
          {/* Main Thermal Heatmap Canvas */}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* Current Streamline Particles Canvas Layer */}
          {showStreamlines && (
            <canvas
              ref={streamlineCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                opacity: 0.8
              }}
            />
          )}

          {/* Interactive Hover Probe Tooltip */}
          {hoverInfo && (
            <div
              className="glass-tooltip"
              style={{
                left: Math.min(hoverInfo.x + 14, (canvasRef.current?.width || 800) - 200),
                top: Math.max(hoverInfo.y - 70, 10),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <Navigation size={12} color="#0df2c9" />
                <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                  {hoverInfo.lat.toFixed(2)}°N, {hoverInfo.lon.toFixed(2)}°E
                </span>
              </div>
              {hoverInfo.val !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ color: '#94a3b8' }}>
                      {data?.is_anomaly ? 'Temp Anomaly:' : 'Reconstructed Temp:'}
                    </span>
                    <span style={{ fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {hoverInfo.val.toFixed(2)}°C
                    </span>
                  </div>
                  {hoverInfo.unc !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ color: '#c084fc' }}>Uncertainty (σ):</span>
                      <span style={{ fontWeight: 700, color: '#d8b4fe', fontFamily: 'var(--font-mono)' }}>
                        ±{hoverInfo.unc.toFixed(2)}°C
                      </span>
                    </div>
                  )}
                  <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Click point to lock vertical probe
                  </span>
                </div>
              ) : (
                <span style={{ color: '#f87171', fontWeight: 600 }}>Land / Non-Ocean Cell</span>
              )}
            </div>
          )}

          {/* Map Overlay Controls / Compass */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            background: 'rgba(7, 14, 28, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#94a3b8',
            pointerEvents: 'none'
          }}>
            <Compass size={14} color="#38bdf8" />
            <span>Target: 5°N–30°N, 45°E–105°E</span>
          </div>
        </div>

        {/* Dynamic Scientific Thermal Colormap Legend */}
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.12)'
        }}>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
              {showUncertainty
                ? 'Predicted Dispersion σ(x,y,z) (°C)'
                : data?.is_anomaly
                ? 'Thermal Climatological Anomaly ΔT (°C)'
                : 'Subsurface Temperature T(x,y,z) (°C)'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {showUncertainty ? '0.15°C' : data?.is_anomaly ? '-2.0°C' : `${data?.stats.min ?? 0}°C`}
              </span>
              <div style={{
                width: '260px',
                height: '10px',
                borderRadius: '6px',
                background: showUncertainty
                  ? 'linear-gradient(90deg, #2d1b4e 0%, #7e22ce 50%, #38bdf8 100%)'
                  : data?.is_anomaly
                  ? 'linear-gradient(90deg, #0284c7 0%, #cbd5e1 50%, #f43f5e 100%)'
                  : 'linear-gradient(90deg, #062b5e 0%, #0284c7 25%, #0df2c9 50%, #eab308 75%, #ef4444 100%)'
              }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#f43f5e' }}>
                {showUncertainty ? '0.70°C' : data?.is_anomaly ? '+2.5°C' : `${data?.stats.max ?? 32}°C`}
              </span>
            </div>
          </div>

          {/* Selected Probe Summary Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'rgba(13, 242, 201, 0.08)',
            border: '1px solid rgba(13, 242, 201, 0.25)',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem'
          }}>
            <MapPin size={14} color="#0df2c9" />
            <div style={{ fontSize: '0.74rem' }}>
              <span style={{ color: '#94a3b8' }}>Locked Probe: </span>
              <span style={{ fontWeight: 700, color: '#0df2c9', fontFamily: 'var(--font-mono)' }}>
                {selectedLat.toFixed(2)}°N, {selectedLon.toFixed(2)}°E
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
