'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MHWData } from '@/types/reconstruction';
import { fetchMHWData } from '@/lib/api/reconstruction';
import { Flame, Waves, ShieldAlert, Activity, ArrowDown, MapPin, Compass, AlertTriangle, Layers } from 'lucide-react';

interface MHWPanelProps {
  selectedDate: string;
  depths: number[];
}

export function MHWPanel({ selectedDate, depths }: MHWPanelProps) {
  const [selectedDepth, setSelectedDepth] = useState<number>(0.0);
  const [mhwData, setMhwData] = useState<MHWData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lon: number; cat: number; anom: number | null } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch MHW Data when date or depth changes
  useEffect(() => {
    let isMounted = true;
    async function loadMHW() {
      setLoading(true);
      try {
        const data = await fetchMHWData(selectedDate, selectedDepth);
        if (isMounted) {
          setMhwData(data);
        }
      } catch (err) {
        console.error('Failed to load MHW analysis:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadMHW();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedDepth]);

  // Render 2D Canvas Map
  useEffect(() => {
    if (!canvasRef.current || !mhwData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grid = mhwData.category_grid;
    const anomGrid = mhwData.anomaly_grid;
    const h = grid.length;
    const w = grid[0]?.length || 0;
    if (h === 0 || w === 0) return;

    canvas.width = w;
    canvas.height = h;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    // Palette per Hobday et al. (2016)
    // 0: Ocean background or land
    // 1: Moderate (Yellow: #facc15)
    // 2: Strong (Orange: #f97316)
    // 3: Severe (Red: #ef4444)
    // 4: Extreme (Crimson / Magenta: #ec4899)
    for (let i = 0; i < h; i++) {
      const rowIdx = h - 1 - i;
      for (let j = 0; j < w; j++) {
        const pixelIdx = (i * w + j) * 4;
        const cat = grid[rowIdx][j];
        const anom = anomGrid[rowIdx][j];

        if (anom === null) {
          // Land cell: Dark carbon
          data[pixelIdx] = 16;
          data[pixelIdx + 1] = 24;
          data[pixelIdx + 2] = 39;
          data[pixelIdx + 3] = 255;
        } else if (cat === 0) {
          // Normal background ocean
          data[pixelIdx] = 10;
          data[pixelIdx + 1] = 30;
          data[pixelIdx + 2] = 60;
          data[pixelIdx + 3] = 255;
        } else if (cat === 1) {
          // Moderate (Yellow)
          data[pixelIdx] = 250;
          data[pixelIdx + 1] = 204;
          data[pixelIdx + 2] = 21;
          data[pixelIdx + 3] = 255;
        } else if (cat === 2) {
          // Strong (Orange)
          data[pixelIdx] = 249;
          data[pixelIdx + 1] = 115;
          data[pixelIdx + 2] = 22;
          data[pixelIdx + 3] = 255;
        } else if (cat === 3) {
          // Severe (Red)
          data[pixelIdx] = 239;
          data[pixelIdx + 1] = 68;
          data[pixelIdx + 2] = 68;
          data[pixelIdx + 3] = 255;
        } else {
          // Extreme (Crimson)
          data[pixelIdx] = 225;
          data[pixelIdx + 1] = 29;
          data[pixelIdx + 2] = 72;
          data[pixelIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [mhwData]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mhwData) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;

    const j = Math.floor((x / rect.width) * w);
    const i = Math.floor((y / rect.height) * h);
    const rowIdx = h - 1 - i;

    if (rowIdx >= 0 && rowIdx < h && j >= 0 && j < w) {
      const cat = mhwData.category_grid[rowIdx][j];
      const anom = mhwData.anomaly_grid[rowIdx][j];
      const lat = mhwData.latitude ? mhwData.latitude[rowIdx] : 5.0 + rowIdx * 0.25;
      const lon = mhwData.longitude ? mhwData.longitude[j] : 45.0 + j * 0.25;
      setHoveredPoint({ lat, lon, cat, anom });
    }
  };

  const getCategoryName = (cat: number) => {
    switch (cat) {
      case 1:
        return 'Category I: Moderate';
      case 2:
        return 'Category II: Strong';
      case 3:
        return 'Category III: Severe';
      case 4:
        return 'Category IV: Extreme';
      default:
        return 'Baseline Climatology';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(69, 10, 10, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Flame size={24} color="#f87171" />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#fef2f2' }}>
              Marine Heatwave (MHW) &amp; Subsurface Thermal Penetration Tracker
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#fca5a5', margin: 0 }}>
            Operational Hobday et al. (2016) detection &middot; 90th-percentile baseline thresholding across 15 standard ocean depths (0–1000m)
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.3rem 0.85rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
            }}
          >
            Phase 2 Engine Active
          </span>
          <div style={{ fontSize: '0.74rem', color: '#fca5a5', marginTop: '0.35rem' }}>
            Date: <strong>{selectedDate}</strong> &middot; Depth: <strong>{selectedDepth}m</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Active MHW Area
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {mhwData ? `${mhwData.active_mhw_area_km2.toLocaleString()} km²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, marginTop: '0.15rem' }}>
            {mhwData ? `${mhwData.active_mhw_percentage}% of Ocean Basin` : '---'}
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Peak Thermal Anomaly
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {mhwData ? `+${mhwData.max_intensity_c}°C` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 700, marginTop: '0.15rem' }}>
            Exceeds 90th %ile Climatology
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Mean Plume Intensity
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {mhwData ? `+${mhwData.mean_intensity_c}°C` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fde047', fontWeight: 700, marginTop: '0.15rem' }}>
            Average Active Thermal Core
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Max Vertical Penetration
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {mhwData ? `${mhwData.max_penetration_depth_m} m` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginTop: '0.15rem' }}>
            Thermocline Extension
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Cumulative Intensity (i_cum)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {mhwData ? `${mhwData.cumulative_intensity}°C·days` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700, marginTop: '0.15rem' }}>
            Heatwave Thermal Exposure
          </div>
        </div>
      </div>

      {/* Main Analysis Section: Map + Diagnostic Mode Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Left: Interactive Canvas Map */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div className="gov-card-title">
              <Compass size={17} color="#ef4444" />
              <span>Hobday Severity Categorization Map at {selectedDepth}m</span>
            </div>
            {hoveredPoint && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E &middot;{' '}
                <strong style={{ color: hoveredPoint.cat > 0 ? '#f87171' : '#38bdf8' }}>
                  {getCategoryName(hoveredPoint.cat)}
                </strong>{' '}
                {hoveredPoint.anom !== null && `(+${hoveredPoint.anom}°C)`}
              </div>
            )}
          </div>

          <div className="gov-card-body">
            <div
              className="canvas-map-container"
              style={{ height: '440px', cursor: 'crosshair', position: 'relative' }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />

              {/* Hover Badge */}
              {hoveredPoint && hoveredPoint.cat > 0 && (
                <div
                  className="glass-tooltip"
                  style={{
                    bottom: '16px',
                    left: '16px',
                    pointerEvents: 'none',
                    border: '1px solid rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#f87171', marginBottom: '0.2rem' }}>
                    {getCategoryName(hoveredPoint.cat)}
                  </div>
                  <div style={{ color: '#f1f5f9' }}>
                    Coordinate: {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E
                  </div>
                  <div style={{ color: '#fb923c' }}>
                    Thermal Anomaly: +{hoveredPoint.anom}°C above baseline
                  </div>
                </div>
              )}
            </div>

            {/* Severity Legend */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(56, 189, 248, 0.12)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#0a1e3c', borderRadius: '2px', border: '1px solid #1e3a5f' }} />
                <span style={{ color: '#94a3b8' }}>Normal Ocean</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#facc15', borderRadius: '2px' }} />
                <span style={{ color: '#fef08a' }}>Category I (Moderate)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '2px' }} />
                <span style={{ color: '#fed7aa' }}>Category II (Strong)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
                <span style={{ color: '#fca5a5' }}>Category III (Severe)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#e11d48', borderRadius: '2px' }} />
                <span style={{ color: '#fecdd3' }}>Category IV (Extreme)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Depth Slicing & Category Diagnostics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Depth Level Selector */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <Layers size={16} color="#38bdf8" />
                <span>Select Vertical Slicing Depth</span>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.15rem 0.55rem',
                borderRadius: '4px'
              }}>
                Current: {selectedDepth}m
              </span>
            </div>

            <div className="gov-card-body">
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                Examine subsurface thermal penetration across mixed layer, thermocline, and bathymetry:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem' }}>
                {depths.map((d) => {
                  const isActive = d === selectedDepth;
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDepth(d)}
                      style={{
                        padding: '0.45rem 0.2rem',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 700 : 500,
                        background: isActive
                          ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                          : 'rgba(15, 23, 42, 0.6)',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        border: `1px solid ${isActive ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {d}m
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hobday Category Cell Counts */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <ShieldAlert size={16} color="#f87171" />
                <span>Hobday Classification at {selectedDepth}m</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {mhwData && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#fef08a', fontWeight: 600 }}>Category I (Moderate):</span>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {mhwData.categories.category_1_moderate.toLocaleString()} cells
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#fed7aa', fontWeight: 600 }}>Category II (Strong):</span>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {mhwData.categories.category_2_strong.toLocaleString()} cells
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#fca5a5', fontWeight: 600 }}>Category III (Severe):</span>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {mhwData.categories.category_3_severe.toLocaleString()} cells
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#fecdd3', fontWeight: 600 }}>Category IV (Extreme):</span>
                    <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                      {mhwData.categories.category_4_extreme.toLocaleString()} cells
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sub-Basin Stress Diagnostics */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <Activity size={16} color="#38bdf8" />
                <span>Sub-Basin Ecological Impact</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mhwData && mhwData.sub_basin_stats && Object.entries(mhwData.sub_basin_stats).map(([basinKey, stats]) => {
                const basinName = basinKey === 'bay_of_bengal'
                  ? 'Bay of Bengal Basin'
                  : basinKey === 'arabian_sea'
                  ? 'Arabian Sea Basin'
                  : 'Equatorial Indian Ocean';
                return (
                  <div
                    key={basinKey}
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(56, 189, 248, 0.12)',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>{basinName}</span>
                      <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700 }}>
                        {stats.coverage_pct}% Active
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8' }}>
                      <span>Mean Plume: <strong style={{ color: '#38bdf8' }}>+{stats.mean_intensity_c}°C</strong></span>
                      <span>Peak Hotspot: <strong style={{ color: '#f87171' }}>+{stats.max_intensity_c}°C</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
