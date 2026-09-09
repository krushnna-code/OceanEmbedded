'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TCHCData } from '@/types/reconstruction';
import { fetchTCHCData } from '@/lib/api/reconstruction';
import { Disc, AlertOctagon, Compass, Layers, ShieldAlert, Zap, MapPin, Info } from 'lucide-react';

interface CycloneHeatPanelProps {
  selectedDate: string;
}

type ViewMode = 'tchc' | 'd26' | 'risk';

export function CycloneHeatPanel({ selectedDate }: CycloneHeatPanelProps) {
  const [tchcData, setTchcData] = useState<TCHCData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tchc');
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lon: number;
    tchc: number | null;
    d26: number | null;
    risk: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadTCHC() {
      setLoading(true);
      try {
        const data = await fetchTCHCData(selectedDate);
        if (isMounted) setTchcData(data);
      } catch (err) {
        console.error('Failed to load TCHC analysis:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadTCHC();
    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Render 2D Canvas Map based on selected ViewMode
  useEffect(() => {
    if (!canvasRef.current || !tchcData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tchcGrid = tchcData.tchc_values;
    const d26Grid = tchcData.d26_values;
    const riskGrid = tchcData.risk_grid;
    const h = tchcGrid.length;
    const w = tchcGrid[0]?.length || 0;
    if (h === 0 || w === 0) return;

    canvas.width = w;
    canvas.height = h;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let i = 0; i < h; i++) {
      const rowIdx = h - 1 - i;
      for (let j = 0; j < w; j++) {
        const pixelIdx = (i * w + j) * 4;
        const tchcVal = tchcGrid[rowIdx][j];
        const d26Val = d26Grid[rowIdx][j];
        const riskVal = riskGrid[rowIdx][j];

        if (tchcVal === null) {
          // Land cell: Dark navy slate
          data[pixelIdx] = 30;
          data[pixelIdx + 1] = 41;
          data[pixelIdx + 2] = 59;
          data[pixelIdx + 3] = 255;
          continue;
        }

        if (viewMode === 'tchc') {
          // TCHC Colormap: 0 - 140 kJ/cm^2
          // < 20: Navy blue
          // 20 - 50: Cyan
          // 50 - 80: Yellow / Gold
          // 80 - 110: Deep Orange
          // >= 110: Crimson / Magenta
          const v = tchcVal;
          if (v < 10) {
            data[pixelIdx] = 15; data[pixelIdx + 1] = 35; data[pixelIdx + 2] = 75;
          } else if (v < 30) {
            data[pixelIdx] = 6; data[pixelIdx + 1] = 95; data[pixelIdx + 2] = 140;
          } else if (v < 50) {
            data[pixelIdx] = 14; data[pixelIdx + 1] = 165; data[pixelIdx + 2] = 160;
          } else if (v < 70) {
            data[pixelIdx] = 234; data[pixelIdx + 1] = 179; data[pixelIdx + 2] = 8;
          } else if (v < 90) {
            data[pixelIdx] = 249; data[pixelIdx + 1] = 115; data[pixelIdx + 2] = 22;
          } else if (v < 110) {
            data[pixelIdx] = 239; data[pixelIdx + 1] = 68; data[pixelIdx + 2] = 68;
          } else {
            data[pixelIdx] = 168; data[pixelIdx + 1] = 85; data[pixelIdx + 2] = 247;
          }
          data[pixelIdx + 3] = 255;
        } else if (viewMode === 'd26') {
          // D26 Depth Colormap: 0 - 120m
          const d = d26Val || 0;
          const norm = Math.min(1.0, d / 120.0);
          data[pixelIdx] = Math.floor(10 + norm * 40);
          data[pixelIdx + 1] = Math.floor(80 + norm * 140);
          data[pixelIdx + 2] = Math.floor(140 + norm * 90);
          data[pixelIdx + 3] = 255;
        } else {
          // Rapid Intensification Risk Tiers:
          // 0: Low (Navy Blue)
          // 1: Moderate (Yellow)
          // 2: High (Orange)
          // 3: Extreme (Crimson)
          if (riskVal === 0) {
            data[pixelIdx] = 30; data[pixelIdx + 1] = 64; data[pixelIdx + 2] = 110;
          } else if (riskVal === 1) {
            data[pixelIdx] = 234; data[pixelIdx + 1] = 179; data[pixelIdx + 2] = 8;
          } else if (riskVal === 2) {
            data[pixelIdx] = 249; data[pixelIdx + 1] = 115; data[pixelIdx + 2] = 22;
          } else {
            data[pixelIdx] = 220; data[pixelIdx + 1] = 38; data[pixelIdx + 2] = 38;
          }
          data[pixelIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [tchcData, viewMode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !tchcData) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;

    const j = Math.floor((x / rect.width) * w);
    const i = Math.floor((y / rect.height) * h);
    const rowIdx = h - 1 - i;

    if (rowIdx >= 0 && rowIdx < h && j >= 0 && j < w) {
      const tchc = tchcData.tchc_values[rowIdx][j];
      const d26 = tchcData.d26_values[rowIdx][j];
      const risk = tchcData.risk_grid[rowIdx][j];
      const lat = tchcData.latitude[rowIdx];
      const lon = tchcData.longitude[j];
      setHoveredPoint({ lat, lon, tchc, d26, risk });
    }
  };

  const getRiskLabel = (risk: number) => {
    switch (risk) {
      case 1:
        return 'Moderate Potential (50 - 80 kJ/cm²)';
      case 2:
        return 'High RI Potential (80 - 110 kJ/cm²)';
      case 3:
        return 'Extreme RI Hotspot (≥ 110 kJ/cm²)';
      default:
        return 'Low / Sub-threshold (< 50 kJ/cm²)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          border: '1px solid #3730a3'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Disc size={22} color="#818cf8" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#e0e7ff' }}>
              Tropical Cyclone Heat Content (TCHC) Diagnostic Engine
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#c7d2fe', margin: 0 }}>
            Vertical sensible heat integrated to 26°C isotherm depth ($D_{26}$) &middot; Shay et al. (2000) &middot; Rapid Intensification (RI) index
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <Zap size={13} />
            RI Diagnostic Active
          </span>
          <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: '0.25rem' }}>
            Observation Date: <strong>{selectedDate}</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Peak Ocean Heat Content
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {tchcData ? `${tchcData.max_tchc_kj_cm2} kJ/cm²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600, marginTop: '0.15rem' }}>
            Max Sensible Reservoir
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Mean Warm Pool TCHC
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {tchcData ? `${tchcData.mean_warm_pool_tchc_kj_cm2} kJ/cm²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: '0.15rem' }}>
            Warm Pool Average (&gt;20 kJ/cm²)
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0d9488' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Mean 26°C Isotherm Depth (D₂₆)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {tchcData ? `${tchcData.mean_d26_m} m` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600, marginTop: '0.15rem' }}>
            Thermal Reservoir Thickness
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Rapid Intensification Area
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {tchcData ? `${tchcData.ri_hotspot_area_km2.toLocaleString()} km²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>
            {tchcData ? `${tchcData.ri_hotspot_pct}% (TCHC ≥ 80 kJ/cm²)` : '---'}
          </div>
        </div>
      </div>

      {/* Main Analysis Section: Map + Diagnostic Mode Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left: Interactive Canvas Map */}
        <div className="gov-card">
          <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="gov-card-title">
              <Compass size={16} color="#4f46e5" />
              <span>
                {viewMode === 'tchc'
                  ? 'Tropical Cyclone Heat Content (TCHC in kJ/cm²)'
                  : viewMode === 'd26'
                  ? '26°C Isotherm Depth Map (D₂₆ in meters)'
                  : 'Cyclone Rapid Intensification (RI) Potential Tiers'}
              </span>
            </div>
            {hoveredPoint && (
              <div style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>
                {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E &middot;{' '}
                {hoveredPoint.tchc !== null ? (
                  <>
                    <strong style={{ color: '#4f46e5' }}>{hoveredPoint.tchc} kJ/cm²</strong> &middot;{' '}
                    <span>D₂₆: {hoveredPoint.d26}m</span>
                  </>
                ) : (
                  <span style={{ color: '#64748b' }}>Land</span>
                )}
              </div>
            )}
          </div>

          <div className="gov-card-body" style={{ padding: '1rem' }}>
            {/* View Mode Toggle Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <button
                onClick={() => setViewMode('tchc')}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: viewMode === 'tchc' ? 700 : 500,
                  background: viewMode === 'tchc' ? '#4f46e5' : '#f8fafc',
                  color: viewMode === 'tchc' ? '#ffffff' : '#334155',
                  border: `1px solid ${viewMode === 'tchc' ? '#4f46e5' : '#cbd5e1'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                TCHC Energy Field (kJ/cm²)
              </button>
              <button
                onClick={() => setViewMode('d26')}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: viewMode === 'd26' ? 700 : 500,
                  background: viewMode === 'd26' ? '#0284c7' : '#f8fafc',
                  color: viewMode === 'd26' ? '#ffffff' : '#334155',
                  border: `1px solid ${viewMode === 'd26' ? '#0284c7' : '#cbd5e1'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                26°C Isotherm Depth (D₂₆)
              </button>
              <button
                onClick={() => setViewMode('risk')}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: viewMode === 'risk' ? 700 : 500,
                  background: viewMode === 'risk' ? '#dc2626' : '#f8fafc',
                  color: viewMode === 'risk' ? '#ffffff' : '#334155',
                  border: `1px solid ${viewMode === 'risk' ? '#dc2626' : '#cbd5e1'}`,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                RI Risk Classification
              </button>
            </div>

            {/* Map Canvas */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                background: '#0f172a',
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: 'inset 0 0 16px rgba(0,0,0,0.5)'
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  cursor: 'crosshair',
                  aspectRatio: '241 / 101'
                }}
              />
              {loading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Calculating Vertical Isotherms &amp; TCHC Integration...
                </div>
              )}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '0.85rem',
                padding: '0.6rem 1rem',
                background: '#f8fafc',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontWeight: 700, color: '#334155' }}>
                {viewMode === 'tchc' ? 'TCHC Range (kJ/cm²):' : viewMode === 'd26' ? 'D₂₆ Depth:' : 'RI Tiers:'}
              </span>

              {viewMode === 'tchc' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#0f234b', borderRadius: '2px', display: 'inline-block' }} />
                    <span>&lt;20</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#0ea5e9', borderRadius: '2px', display: 'inline-block' }} />
                    <span>20 - 50</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '2px', display: 'inline-block' }} />
                    <span>50 - 80</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '2px', display: 'inline-block' }} />
                    <span>80 - 110</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#a855f7', borderRadius: '2px', display: 'inline-block' }} />
                    <span>≥ 110 (Extreme)</span>
                  </div>
                </>
              ) : viewMode === 'd26' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#0a508c', borderRadius: '2px', display: 'inline-block' }} />
                    <span>0 - 30m</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#14b8a6', borderRadius: '2px', display: 'inline-block' }} />
                    <span>30 - 60m</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#38bdf8', borderRadius: '2px', display: 'inline-block' }} />
                    <span>60 - 90m</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#818cf8', borderRadius: '2px', display: 'inline-block' }} />
                    <span>&gt; 90m</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#1e40af', borderRadius: '2px', display: 'inline-block' }} />
                    <span>Low (&lt;50)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '2px', display: 'inline-block' }} />
                    <span>Moderate (50-80)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '2px', display: 'inline-block' }} />
                    <span>High (80-110)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '12px', height: '12px', background: '#dc2626', borderRadius: '2px', display: 'inline-block' }} />
                    <span>Extreme (≥110)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Rapid Intensification Diagnostic Advisory & Basin Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Advisory Box */}
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b', fontWeight: 700, fontSize: '0.9rem' }}>
              <AlertOctagon size={18} />
              <span>Rapid Intensification (RI) Advisory</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>
              Tropical cyclones transiting ocean areas where <strong>TCHC ≥ 80 kJ/cm²</strong> and <strong>D₂₆ &gt; 50m</strong> frequently experience
              rapid intensification due to the absence of cold-water wake upwelling feedback.
            </p>
            {tchcData && (
              <div style={{ fontSize: '0.74rem', color: '#991b1b', marginTop: '0.25rem' }}>
                Active High/Extreme Hotspots: <strong>{tchcData.ri_hotspot_area_km2.toLocaleString()} km²</strong> ({tchcData.ri_hotspot_pct}% of ocean)
              </div>
            )}
          </div>

          {/* Regional Sub-basin Breakdown */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <MapPin size={16} color="#4f46e5" />
                <span>Regional Cyclogenesis Basins</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ padding: '0.85rem' }}>
              {tchcData && tchcData.sub_basin_stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(tchcData.sub_basin_stats).map(([basinName, stats]) => (
                    <div
                      key={basinName}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: '#f8fafc',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f2744' }}>{basinName}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '3px',
                            background: stats.max_tchc_kj_cm2 >= 110 ? '#fee2e2' : stats.max_tchc_kj_cm2 >= 80 ? '#ffedd5' : '#e0f2fe',
                            color: stats.max_tchc_kj_cm2 >= 110 ? '#991b1b' : stats.max_tchc_kj_cm2 >= 80 ? '#9a3412' : '#0369a1'
                          }}
                        >
                          {stats.risk_status}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.4rem', fontSize: '0.74rem', color: '#64748b' }}>
                        <div>Peak TCHC: <strong style={{ color: '#0f2744' }}>{stats.max_tchc_kj_cm2} kJ/cm²</strong></div>
                        <div>Mean TCHC: <strong style={{ color: '#0f2744' }}>{stats.mean_tchc_kj_cm2} kJ/cm²</strong></div>
                        <div>Mean D₂₆: <strong style={{ color: '#0f2744' }}>{stats.mean_d26_m} m</strong></div>
                        <div>RI Area: <strong style={{ color: '#dc2626' }}>{stats.ri_potential_pct}%</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tropical Cyclone Scale Reference */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <Info size={16} color="#0284c7" />
                <span>Ocean Thermal Potential Scale</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ padding: '0.85rem', fontSize: '0.74rem', color: '#475569' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.6 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', fontWeight: 700, color: '#0f2744' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.3rem' }}>TCHC (kJ/cm²)</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.3rem' }}>Intensification Support</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: '#2563eb', fontWeight: 600 }}>&lt; 50</td>
                    <td>Low / Weak Cyclonic Storms</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#d97706', fontWeight: 600 }}>50 - 80</td>
                    <td>Severe Cyclonic Storm (SCS)</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#ea580c', fontWeight: 600 }}>80 - 110</td>
                    <td>Very Severe (VSCS) / Cat 3</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>≥ 110</td>
                    <td>Supercyclone / Rapid Intensification</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
