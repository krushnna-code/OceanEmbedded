'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TCHCData } from '@/types/reconstruction';
import { fetchTCHCData } from '@/lib/api/reconstruction';
import { Disc, AlertOctagon, Compass, Layers, ShieldAlert, Zap, MapPin, Info, Navigation, Wind } from 'lucide-react';

interface CycloneHeatPanelProps {
  selectedDate: string;
}

type ViewMode = 'tchc' | 'd26' | 'risk';

interface CycloneTrackPoint {
  lat: number;
  lon: number;
  name: string;
  category: string;
  windKts: number;
}

export function CycloneHeatPanel({ selectedDate }: CycloneHeatPanelProps) {
  const [tchcData, setTchcData] = useState<TCHCData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>('tchc');
  const [selectedTrack, setSelectedTrack] = useState<string>('amphan');
  const [hoveredPoint, setHoveredPoint] = useState<{
    lat: number;
    lon: number;
    tchc: number | null;
    d26: number | null;
    risk: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Historical Storm Tracks across North Indian Ocean
  const cycloneTracks: Record<string, { title: string; basin: string; points: CycloneTrackPoint[] }> = {
    amphan: {
      title: 'Super Cyclone Amphan (May 2020)',
      basin: 'Bay of Bengal',
      points: [
        { lat: 10.5, lon: 86.4, name: 'Genesis', category: 'Deep Depression', windKts: 30 },
        { lat: 12.2, lon: 86.5, name: 'CS Amphan', category: 'Cyclonic Storm', windKts: 45 },
        { lat: 13.8, lon: 86.3, name: 'SCS Amphan', category: 'Severe Cyclonic Storm', windKts: 65 },
        { lat: 15.6, lon: 86.4, name: 'VSCS Amphan', category: 'Very Severe CS', windKts: 90 },
        { lat: 17.5, lon: 86.8, name: 'ESCS Amphan', category: 'Extremely Severe CS', windKts: 115 },
        { lat: 19.8, lon: 87.5, name: 'Super Cyclone', category: 'Super Cyclone (Cat 5)', windKts: 140 },
        { lat: 21.8, lon: 88.3, name: 'Landfall Bengal', category: 'VSCS (Landfall)', windKts: 85 }
      ]
    },
    mocha: {
      title: 'Extremely Severe Cyclone Mocha (May 2023)',
      basin: 'Bay of Bengal / Myanmar',
      points: [
        { lat: 11.2, lon: 88.0, name: 'Genesis', category: 'Depression', windKts: 28 },
        { lat: 13.0, lon: 88.1, name: 'CS Mocha', category: 'Cyclonic Storm', windKts: 42 },
        { lat: 15.1, lon: 88.8, name: 'VSCS Mocha', category: 'Very Severe CS', windKts: 85 },
        { lat: 17.8, lon: 91.2, name: 'ESCS Mocha', category: 'Extremely Severe (Cat 5)', windKts: 135 },
        { lat: 20.1, lon: 92.8, name: 'Sittwe Landfall', category: 'ESCS Landfall', windKts: 110 }
      ]
    },
    fani: {
      title: 'Extremely Severe Cyclone Fani (Apr-May 2019)',
      basin: 'Bay of Bengal / Odisha',
      points: [
        { lat: 5.8, lon: 88.5, name: 'Equatorial Genesis', category: 'Depression', windKts: 25 },
        { lat: 8.5, lon: 87.2, name: 'CS Fani', category: 'Cyclonic Storm', windKts: 45 },
        { lat: 11.8, lon: 85.0, name: 'SCS Fani', category: 'Severe CS', windKts: 65 },
        { lat: 14.5, lon: 84.1, name: 'VSCS Fani', category: 'Very Severe CS', windKts: 95 },
        { lat: 17.8, lon: 84.8, name: 'ESCS Fani (Puri)', category: 'Extremely Severe CS', windKts: 115 },
        { lat: 19.8, lon: 85.8, name: 'Puri Landfall', category: 'ESCS Landfall', windKts: 105 }
      ]
    }
  };

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

  // Render 2D Canvas Map based on selected ViewMode and active Cyclone Track
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
          // Land cell: Dark carbon slate
          data[pixelIdx] = 16;
          data[pixelIdx + 1] = 24;
          data[pixelIdx + 2] = 39;
          data[pixelIdx + 3] = 255;
          continue;
        }

        if (viewMode === 'tchc') {
          // TCHC Colormap: 0 - 140 kJ/cm^2
          const v = tchcVal;
          if (v < 15) {
            data[pixelIdx] = 10; data[pixelIdx + 1] = 25; data[pixelIdx + 2] = 60;
          } else if (v < 35) {
            data[pixelIdx] = 6; data[pixelIdx + 1] = 95; data[pixelIdx + 2] = 160;
          } else if (v < 55) {
            data[pixelIdx] = 13; data[pixelIdx + 1] = 185; data[pixelIdx + 2] = 175;
          } else if (v < 80) {
            data[pixelIdx] = 234; data[pixelIdx + 1] = 179; data[pixelIdx + 2] = 8;
          } else if (v < 105) {
            data[pixelIdx] = 249; data[pixelIdx + 1] = 115; data[pixelIdx + 2] = 22;
          } else {
            // Extreme RI Hotspot (Crimson / Magenta)
            data[pixelIdx] = 244; data[pixelIdx + 1] = 63; data[pixelIdx + 2] = 94;
          }
          data[pixelIdx + 3] = 255;
        } else if (viewMode === 'd26') {
          // D26 Depth Colormap: 0 - 120m
          const d = d26Val || 0;
          const norm = Math.min(1.0, d / 120.0);
          data[pixelIdx] = Math.floor(10 + norm * 45);
          data[pixelIdx + 1] = Math.floor(80 + norm * 150);
          data[pixelIdx + 2] = Math.floor(140 + norm * 105);
          data[pixelIdx + 3] = 255;
        } else {
          // Rapid Intensification Risk Tiers
          if (riskVal === 0) {
            data[pixelIdx] = 15; data[pixelIdx + 1] = 45; data[pixelIdx + 2] = 85;
          } else if (riskVal === 1) {
            data[pixelIdx] = 234; data[pixelIdx + 1] = 179; data[pixelIdx + 2] = 8;
          } else if (riskVal === 2) {
            data[pixelIdx] = 249; data[pixelIdx + 1] = 115; data[pixelIdx + 2] = 22;
          } else {
            data[pixelIdx] = 225; data[pixelIdx + 1] = 29; data[pixelIdx + 2] = 72;
          }
          data[pixelIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Draw active historical cyclone track overlay
    const activeTrack = cycloneTracks[selectedTrack];
    if (activeTrack && activeTrack.points.length > 1) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      activeTrack.points.forEach((pt, idx) => {
        // Convert (lat, lon) to canvas (x, y)
        const x = ((pt.lon - 45.0) / 60.0) * w;
        const y = h - ((pt.lat - 5.0) / 25.0) * h;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw Eyewall nodes
      activeTrack.points.forEach((pt) => {
        const x = ((pt.lon - 45.0) / 60.0) * w;
        const y = h - ((pt.lat - 5.0) / 25.0) * h;

        ctx.fillStyle = pt.windKts >= 115 ? '#ec4899' : pt.windKts >= 80 ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      ctx.shadowBlur = 0;
    }
  }, [tchcData, viewMode, selectedTrack]);

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
      const lat = tchcData.latitude ? tchcData.latitude[rowIdx] : 5.0 + rowIdx * 0.25;
      const lon = tchcData.longitude ? tchcData.longitude[j] : 45.0 + j * 0.25;
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
      case 4:
        return 'Extreme RI Hotspot (≥ 110 kJ/cm²)';
      default:
        return 'Sub-threshold (< 50 kJ/cm²)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(99, 102, 241, 0.3)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Disc size={24} color="#818cf8" />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#fef2f2' }}>
              Tropical Cyclone Heat Content (TCHC) &amp; 26°C Isotherm Depth (D₂₆)
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#c7d2fe', margin: 0 }}>
            Shay et al. (2000) Sensible Ocean Heat Engine &middot; Depth-integrated heat reservoir down to 26°C isotherm predicting Rapid Intensification (RI)
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Zap size={13} />
            RI Diagnostic Active
          </span>
          <div style={{ fontSize: '0.74rem', color: '#c7d2fe', marginTop: '0.35rem' }}>
            Observation Date: <strong>{selectedDate}</strong>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #818cf8' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Peak Ocean Heat Content
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {tchcData ? `${tchcData.max_tchc_kj_cm2} kJ/cm²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, marginTop: '0.15rem' }}>
            Max Sensible Energy Core
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Mean Warm Pool TCHC
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {tchcData ? `${tchcData.mean_warm_pool_tchc_kj_cm2} kJ/cm²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, marginTop: '0.15rem' }}>
            Warm Pool (&gt;20 kJ/cm²) Average
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0df2c9' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Mean 26°C Isotherm Depth (D₂₆)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {tchcData ? `${tchcData.mean_d26_m} m` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2dd4bf', fontWeight: 700, marginTop: '0.15rem' }}>
            Thermal Reservoir Thickness
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #f43f5e' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Rapid Intensification Area
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
            {tchcData ? `${tchcData.ri_hotspot_area_km2.toLocaleString()} km²` : '---'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: 700, marginTop: '0.15rem' }}>
            {tchcData ? `${tchcData.ri_hotspot_pct}% (TCHC ≥ 80 kJ/cm²)` : '---'}
          </div>
        </div>
      </div>

      {/* Main Analysis Section: Map + Diagnostic Mode Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Left: Interactive Canvas Map */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div className="gov-card-title">
              <Compass size={17} color="#818cf8" />
              <span>
                {viewMode === 'tchc'
                  ? 'Tropical Cyclone Heat Content (TCHC in kJ/cm²)'
                  : viewMode === 'd26'
                  ? '26°C Isotherm Depth Map (D₂₆ in meters)'
                  : 'Cyclone Rapid Intensification (RI) Potential Tiers'}
              </span>
            </div>
            {hoveredPoint && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E &middot;{' '}
                {hoveredPoint.tchc !== null ? (
                  <>
                    <strong style={{ color: '#818cf8' }}>{hoveredPoint.tchc} kJ/cm²</strong> &middot;{' '}
                    <span>D₂₆: {hoveredPoint.d26}m</span>
                  </>
                ) : (
                  <span style={{ color: '#64748b' }}>Land</span>
                )}
              </div>
            )}
          </div>

          <div className="gov-card-body">
            
            {/* View Mode Toggle Buttons & Cyclone Track Selector */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              {/* Mode Buttons */}
              <div style={{
                display: 'inline-flex',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '8px',
                padding: '0.2rem',
                gap: '0.2rem'
              }}>
                <button
                  onClick={() => setViewMode('tchc')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'tchc' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                    color: viewMode === 'tchc' ? '#ffffff' : '#94a3b8'
                  }}
                >
                  TCHC Field (kJ/cm²)
                </button>
                <button
                  onClick={() => setViewMode('d26')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'd26' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                    color: viewMode === 'd26' ? '#ffffff' : '#94a3b8'
                  }}
                >
                  D₂₆ Isotherm Depth (m)
                </button>
                <button
                  onClick={() => setViewMode('risk')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: viewMode === 'risk' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'transparent',
                    color: viewMode === 'risk' ? '#ffffff' : '#94a3b8'
                  }}
                >
                  RI Risk Tiers
                </button>
              </div>

              {/* Cyclone Track Overlay Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Wind size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700 }}>Track:</span>
                <select
                  className="gov-select"
                  value={selectedTrack}
                  onChange={(e) => setSelectedTrack(e.target.value)}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                >
                  <option value="amphan">Super Cyclone Amphan (2020)</option>
                  <option value="mocha">Extremely Severe Mocha (2023)</option>
                  <option value="fani">Extremely Severe Fani (2019)</option>
                </select>
              </div>
            </div>

            {/* Canvas */}
            <div
              className="canvas-map-container"
              style={{ height: '440px', cursor: 'crosshair', position: 'relative' }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />

              {/* Hover Badge */}
              {hoveredPoint && hoveredPoint.tchc !== null && (
                <div
                  className="glass-tooltip"
                  style={{
                    bottom: '16px',
                    left: '16px',
                    border: '1px solid rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#818cf8', marginBottom: '0.2rem' }}>
                    {getRiskLabel(hoveredPoint.risk)}
                  </div>
                  <div style={{ color: '#f1f5f9' }}>
                    Coordinate: {hoveredPoint.lat.toFixed(2)}°N, {hoveredPoint.lon.toFixed(2)}°E
                  </div>
                  <div style={{ color: '#38bdf8' }}>
                    TCHC: {hoveredPoint.tchc} kJ/cm² &middot; D₂₆: {hoveredPoint.d26}m
                  </div>
                </div>
              )}
            </div>

            {/* Along-Track Heat Reservoir Profile Bar */}
            {cycloneTracks[selectedTrack] && (
              <div style={{
                marginTop: '1rem',
                padding: '0.85rem 1rem',
                background: 'rgba(15, 23, 42, 0.75)',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Navigation size={13} color="#0df2c9" />
                    <span>Along-Track Ocean Fuel Gauge: {cycloneTracks[selectedTrack].title}</span>
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#0df2c9', fontWeight: 700 }}>
                    Basin: {cycloneTracks[selectedTrack].basin}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cycloneTracks[selectedTrack].points.length}, 1fr)`, gap: '0.35rem' }}>
                  {cycloneTracks[selectedTrack].points.map((pt, i) => {
                    const estTchc = Math.min(130, Math.round(pt.windKts * 0.95 + 10));
                    const isExtreme = estTchc >= 100;
                    return (
                      <div
                        key={i}
                        style={{
                          background: isExtreme ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.1)',
                          border: `1px solid ${isExtreme ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.2)'}`,
                          borderRadius: '6px',
                          padding: '0.4rem 0.35rem',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pt.name}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isExtreme ? '#f87171' : '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          {estTchc} <span style={{ fontSize: '0.6rem' }}>kJ</span>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>
                          {pt.windKts} kts
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Column: Advisory & Regional Cyclogenesis Basins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Rapid Intensification Advisory Box */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(69, 10, 10, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
              <AlertOctagon size={18} />
              <span>Rapid Intensification (RI) Advisory</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>
              Tropical cyclones transiting ocean waters where <strong>TCHC ≥ 80 kJ/cm²</strong> and <strong>D₂₆ &gt; 50m</strong> frequently experience
              rapid intensification due to thick upper ocean layers preventing cold-water wake upwelling negative feedback.
            </p>
            {tchcData && (
              <div style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 700, marginTop: '0.45rem' }}>
                Active High/Extreme Hotspots: <strong>{tchcData.ri_hotspot_area_km2.toLocaleString()} km²</strong> ({tchcData.ri_hotspot_pct}% of ocean basin)
              </div>
            )}
          </div>

          {/* Regional Basins Breakdown */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <MapPin size={16} color="#818cf8" />
                <span>Regional Cyclogenesis Basins</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tchcData && tchcData.sub_basin_stats && Object.entries(tchcData.sub_basin_stats).map(([basinName, stats]) => (
                <div
                  key={basinName}
                  style={{
                    padding: '0.75rem 0.95rem',
                    background: 'rgba(15, 23, 42, 0.75)',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.14)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                      {basinName === 'bay_of_bengal'
                        ? 'Bay of Bengal (Cyclone Alley)'
                        : basinName === 'arabian_sea'
                        ? 'Arabian Sea Basin'
                        : 'Equatorial Warm Pool'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '4px',
                        background: stats.max_tchc_kj_cm2 >= 110 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: stats.max_tchc_kj_cm2 >= 110 ? '#f87171' : '#38bdf8',
                        border: `1px solid ${stats.max_tchc_kj_cm2 >= 110 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)'}`
                      }}
                    >
                      {stats.risk_status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.74rem', color: '#94a3b8' }}>
                    <div>Peak TCHC: <strong style={{ color: '#ffffff' }}>{stats.max_tchc_kj_cm2} kJ/cm²</strong></div>
                    <div>Mean TCHC: <strong style={{ color: '#ffffff' }}>{stats.mean_tchc_kj_cm2} kJ/cm²</strong></div>
                    <div>Mean D₂₆: <strong style={{ color: '#ffffff' }}>{stats.mean_d26_m} m</strong></div>
                    <div>RI Potential: <strong style={{ color: '#f87171' }}>{stats.ri_potential_pct}%</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tropical Cyclone Scale Reference Table */}
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <Info size={16} color="#38bdf8" />
                <span>Ocean Thermal Potential Scale</span>
              </div>
            </div>
            <div className="gov-card-body" style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', lineHeight: 1.6 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.15)', fontWeight: 700, color: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>TCHC (kJ/cm²)</th>
                    <th style={{ textAlign: 'left', paddingBottom: '0.4rem' }}>Intensification Support</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ color: '#38bdf8', fontWeight: 700 }}>&lt; 50</td>
                    <td>Low / Weak Cyclonic Storms</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ color: '#facc15', fontWeight: 700 }}>50 - 80</td>
                    <td>Severe Cyclonic Storm (SCS)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ color: '#fb923c', fontWeight: 700 }}>80 - 110</td>
                    <td>Very Severe (VSCS) / Cat 3</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#f87171', fontWeight: 800 }}>≥ 110</td>
                    <td>Super Cyclone / Rapid Intensification</td>
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
