'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MHWData } from '@/types/reconstruction';
import { fetchMHWData } from '@/lib/api/reconstruction';
import { Flame, Waves, ShieldAlert, Activity, ArrowDown, MapPin, Compass } from 'lucide-react';

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

    // Palette:
    // 0: Ocean background or land
    // 1: Moderate (Yellow: #facc15 -> 250, 204, 21)
    // 2: Strong (Orange: #f97316 -> 249, 115, 22)
    // 3: Severe (Red: #ef4444 -> 239, 68, 68)
    // 4: Extreme (Crimson: #991b1b -> 153, 27, 27)
    for (let i = 0; i < h; i++) {
      // Invert row index because grid lat 5 is bottom and lat 30 is top
      const rowIdx = h - 1 - i;
      for (let j = 0; j < w; j++) {
        const pixelIdx = (i * w + j) * 4;
        const cat = grid[rowIdx][j];
        const anom = anomGrid[rowIdx][j];

        if (anom === null) {
          // Land cell: Dark navy slate
          data[pixelIdx] = 30;
          data[pixelIdx + 1] = 41;
          data[pixelIdx + 2] = 59;
          data[pixelIdx + 3] = 255;
        } else if (cat === 0) {
          // Normal Ocean background
          data[pixelIdx] = 12;
          data[pixelIdx + 1] = 44;
          data[pixelIdx + 2] = 78;
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
          // Extreme (Deep Crimson)
          data[pixelIdx] = 153;
          data[pixelIdx + 1] = 27;
          data[pixelIdx + 2] = 27;
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
      const lat = mhwData.latitude[rowIdx];
      const lon = mhwData.longitude[j];
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
        return 'No Marine Heatwave';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #450a0a 0%, #1c1917 100%)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid #7f1d1d'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Flame size={22} color="#f87171" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fef2f2' }}>
              Marine Heatwave (MHW) &amp; Subsurface Thermal Tracker
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#fca5a5', margin: 0 }}>
            Operational Hobday et al. (2016) detection &middot; 90th-percentile baseline thresholding across 15 standard ocean depths
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: '#b91c1c',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Phase 2 Engine Active
          </span>
          <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '0.25rem' }}>
            Date: <strong>{selectedDate}</strong> &middot; Depth: <strong>{selectedDepth}m</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Active MHW Area
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {mhwData ? `${mhwData.active_mhw_area_km2.toLocaleString()} km²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>
            {mhwData ? `${mhwData.active_mhw_percentage}% of Ocean` : '---'}
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Peak Thermal Anomaly
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {mhwData ? `+${mhwData.max_intensity_c}°C` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600, marginTop: '0.15rem' }}>
            Above 90th %ile Threshold
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Mean MHW Intensity
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {mhwData ? `+${mhwData.mean_intensity_c}°C` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#ca8a04', fontWeight: 600, marginTop: '0.15rem' }}>
            Active Plumes Average
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Max Subsurface Penetration
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {mhwData ? `${mhwData.max_penetration_depth_m}m` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: '0.15rem' }}>
            Subsurface Extension
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #7c3aed' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Cumulative Intensity
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f2744', marginTop: '0.3rem' }}>
            {mhwData ? `${mhwData.cumulative_intensity.toLocaleString()} °C·d` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600, marginTop: '0.15rem' }}>
            Integrated Thermal Load
          </div>
        </div>
      </div>

      {/* Main Analysis Section: Map + Depth Controller */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        {/* Left: 2D Spatial MHW Map */}
        <div className="gov-card">
          <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="gov-card-title">
              <Compass size={16} color="#0284c7" />
              <span>North Indian Ocean MHW Category Map ({selectedDepth}m Depth)</span>
            </div>
            {hoveredPoint && (
              <div style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 600 }}>
                {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E &middot;{' '}
                <span style={{ color: hoveredPoint.cat > 0 ? '#dc2626' : '#0284c7' }}>
                  {getCategoryName(hoveredPoint.cat)}
                </span>
                {hoveredPoint.anom !== null && ` (+${hoveredPoint.anom}°C)`}
              </div>
            )}
          </div>
          <div className="gov-card-body" style={{ position: 'relative', padding: '1rem' }}>
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
                onMouseMove={handleCanvasMouseMove}
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
                  Calculating MHW Spatial Clusters...
                </div>
              )}
            </div>

            {/* Map Legend */}
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
              <span style={{ fontWeight: 700, color: '#334155' }}>Hobday Categories:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#0c2c4e', borderRadius: '2px', display: 'inline-block' }} />
                <span>Normal Ocean</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#facc15', borderRadius: '2px', display: 'inline-block' }} />
                <span>Cat I (Moderate)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#f97316', borderRadius: '2px', display: 'inline-block' }} />
                <span>Cat II (Strong)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px', display: 'inline-block' }} />
                <span>Cat III (Severe)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#991b1b', borderRadius: '2px', display: 'inline-block' }} />
                <span>Cat IV (Extreme)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '12px', height: '12px', background: '#1e293b', borderRadius: '2px', display: 'inline-block' }} />
                <span>Land Mask</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Depth Slicing + Regional Stratification */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Depth Level Selector */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <Waves size={16} color="#0284c7" />
                <span>Subsurface Depth Level (0m - 1000m)</span>
              </div>
              <span className="status-tag" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                Current: {selectedDepth}m
              </span>
            </div>
            <div className="gov-card-body" style={{ padding: '0.85rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Track heatwave penetration across the mixed layer, thermocline, and deep bathymetry:
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
                        background: isActive ? '#0f2744' : '#f8fafc',
                        color: isActive ? '#ffffff' : '#334155',
                        border: `1px solid ${isActive ? '#0f2744' : '#cbd5e1'}`,
                        borderRadius: '4px',
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

          {/* Hobday Severity Category Breakdown */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <ShieldAlert size={16} color="#dc2626" />
                <span>Hobday Category Counts at {selectedDepth}m</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ padding: '0.85rem' }}>
              {mhwData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#ca8a04', fontWeight: 600 }}>Category I (Moderate):</span>
                    <strong>{mhwData.categories.category_1_moderate} cells</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#ea580c', fontWeight: 600 }}>Category II (Strong):</span>
                    <strong>{mhwData.categories.category_2_strong} cells</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>Category III (Severe):</span>
                    <strong>{mhwData.categories.category_3_severe} cells</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#991b1b', fontWeight: 600 }}>Category IV (Extreme):</span>
                    <strong>{mhwData.categories.category_4_extreme} cells</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Regional Sub-basin Breakdown */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <MapPin size={16} color="#0284c7" />
                <span>Regional Sub-basin MHW Status</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ padding: '0.85rem' }}>
              {mhwData && mhwData.sub_basin_stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(mhwData.sub_basin_stats).map(([basinName, stats]) => (
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
                            background: stats.coverage_pct > 15 ? '#fee2e2' : '#e0f2fe',
                            color: stats.coverage_pct > 15 ? '#991b1b' : '#0369a1'
                          }}
                        >
                          {stats.coverage_pct}% Covered
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>Mean Anomaly: <strong style={{ color: '#0f2744' }}>+{stats.mean_intensity_c}°C</strong></span>
                        <span>Peak: <strong style={{ color: '#dc2626' }}>+{stats.max_intensity_c}°C</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
