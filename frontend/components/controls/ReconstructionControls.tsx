'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Gauge,
  Sliders,
  Layers,
  Play,
  Pause,
  MapPin,
  Wind,
  Sparkles,
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface ControlsProps {
  dates: string[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  depths: number[];
  selectedDepth: number;
  onDepthChange: (depth: number) => void;
  isAnomaly: boolean;
  onAnomalyChange: (anomaly: boolean) => void;
  selectedModel: string;
  showUncertainty?: boolean;
  onShowUncertaintyChange?: (show: boolean) => void;
  showStreamlines?: boolean;
  onToggleStreamlines?: (show: boolean) => void;
  onSelectRegion?: (lat: number, lon: number, name: string) => void;
}

export const ReconstructionControls: React.FC<ControlsProps> = ({
  dates,
  selectedDate,
  onDateChange,
  depths,
  selectedDepth,
  onDepthChange,
  isAnomaly,
  onAnomalyChange,
  selectedModel,
  showUncertainty = false,
  onShowUncertaintyChange,
  showStreamlines = true,
  onToggleStreamlines,
  onSelectRegion
}) => {
  const [isPlayingDepth, setIsPlayingDepth] = useState<boolean>(false);

  // Depth Presets with oceanographic significance
  const depthPresets = [
    { label: 'Surface', val: 0.0, badge: 'SST' },
    { label: 'Mixed Layer', val: 30.0, badge: 'MLD' },
    { label: 'Thermocline', val: 100.0, badge: 'D20' },
    { label: 'Upper Intermediate', val: 200.0, badge: 'Mid' },
    { label: 'Deep Abyssal', val: 1000.0, badge: 'Deep' },
  ];

  // Regional hotspots across North Indian Ocean
  const regionalPresets = [
    { name: 'Bay of Bengal (Cyclone Alley)', lat: 15.25, lon: 88.50 },
    { name: 'Arabian Sea Upwelling', lat: 16.50, lon: 64.25 },
    { name: 'Equatorial Warm Pool', lat: 6.25, lon: 78.50 },
    { name: 'Somali Current Basin', lat: 11.75, lon: 52.25 },
    { name: 'Central Andaman Sea', lat: 11.50, lon: 93.75 },
  ];

  // Auto-play through depths animation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingDepth) {
      timer = setInterval(() => {
        const currentIdx = depths.indexOf(selectedDepth);
        const nextIdx = (currentIdx + 1) % depths.length;
        onDepthChange(depths[nextIdx]);
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlayingDepth, depths, selectedDepth, onDepthChange]);

  return (
    <div className="gov-card" style={{ marginBottom: '1.25rem' }}>
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Sliders size={16} color="#38bdf8" />
          <span>Operational Reconstruction Controls</span>
          <span style={{
            fontSize: '0.68rem',
            color: '#0df2c9',
            background: 'rgba(13, 242, 201, 0.1)',
            border: '1px solid rgba(13, 242, 201, 0.25)',
            padding: '0.15rem 0.45rem',
            borderRadius: '4px'
          }}>
            Real-Time Parametric Slicing
          </span>
        </div>

        {/* Depth Animation Player & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsPlayingDepth(!isPlayingDepth)}
            className="btn-glass"
            style={{
              background: isPlayingDepth ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              borderColor: isPlayingDepth ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.35)',
              color: isPlayingDepth ? '#fca5a5' : '#38bdf8',
            }}
            title={isPlayingDepth ? 'Pause depth sweep' : 'Animate through 15 depth levels'}
          >
            {isPlayingDepth ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlayingDepth ? 'Stop Depth Sweep' : 'Play Depth Sweep'}</span>
          </button>

          {onToggleStreamlines && (
            <button
              onClick={() => onToggleStreamlines(!showStreamlines)}
              className="btn-glass"
              style={{
                background: showStreamlines ? 'rgba(13, 242, 201, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                borderColor: showStreamlines ? 'rgba(13, 242, 201, 0.4)' : 'rgba(56, 189, 248, 0.2)',
                color: showStreamlines ? '#0df2c9' : '#94a3b8'
              }}
              title="Toggle surface current streamlines"
            >
              <Wind size={13} />
              <span>Current Vectors</span>
            </button>
          )}
        </div>
      </div>

      <div className="gov-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Main Controls Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
          
          {/* Observation Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={13} color="#38bdf8" />
              <span>Observation Date</span>
            </label>
            <select
              className="gov-select"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d} (Daily NetCDF)
                </option>
              ))}
            </select>
          </div>

          {/* Depth Level Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '180px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Gauge size={13} color="#38bdf8" />
              <span>Depth Level ({selectedDepth}m)</span>
            </label>
            <select
              className="gov-select"
              value={selectedDepth}
              onChange={(e) => onDepthChange(parseFloat(e.target.value))}
            >
              {depths.map((dep) => (
                <option key={dep} value={dep}>
                  {dep} meters {dep === 0 ? '(Surface)' : dep === 100 ? '(Thermocline)' : dep === 1000 ? '(Deep)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Output Field: Absolute vs Anomaly */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={13} color="#38bdf8" />
              <span>Target Output Field</span>
            </label>
            <div style={{
              display: 'inline-flex',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '8px',
              padding: '0.2rem',
              gap: '0.2rem'
            }}>
              <button
                onClick={() => onAnomalyChange(false)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '6px',
                  background: !isAnomaly ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  color: !isAnomaly ? '#ffffff' : '#94a3b8',
                  boxShadow: !isAnomaly ? '0 0 12px rgba(2, 132, 199, 0.4)' : 'none'
                }}
              >
                Temperature (&deg;C)
              </button>
              <button
                onClick={() => onAnomalyChange(true)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: '6px',
                  background: isAnomaly ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  color: isAnomaly ? '#ffffff' : '#94a3b8',
                  boxShadow: isAnomaly ? '0 0 12px rgba(2, 132, 199, 0.4)' : 'none'
                }}
              >
                Anomaly (&Delta;T)
              </button>
            </div>
          </div>

          {/* Uncertainty Overlay Toggle */}
          {onShowUncertaintyChange && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <HelpCircle size={13} color="#c084fc" />
                <span>Gaussian NLL Head</span>
              </label>
              <button
                onClick={() => onShowUncertaintyChange(!showUncertainty)}
                style={{
                  padding: '0.52rem 0.95rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: `1px solid ${showUncertainty ? '#c084fc' : 'rgba(192, 132, 252, 0.25)'}`,
                  borderRadius: '8px',
                  background: showUncertainty
                    ? 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)'
                    : 'rgba(147, 51, 234, 0.1)',
                  color: showUncertainty ? '#ffffff' : '#d8b4fe',
                  boxShadow: showUncertainty ? '0 0 16px rgba(147, 51, 234, 0.4)' : 'none'
                }}
              >
                {showUncertainty ? 'Uncertainty Active (&sigma;)' : 'Show Uncertainty Head (&sigma;)'}
              </button>
            </div>
          )}
        </div>

        {/* Secondary Row: Depth Presets & Regional Jump Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(56, 189, 248, 0.1)'
        }}>
          {/* Depth Preset Quick Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Depth Presets:
            </span>
            {depthPresets.map((p) => {
              const isSelected = selectedDepth === p.val;
              return (
                <button
                  key={p.val}
                  onClick={() => onDepthChange(p.val)}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)'}`,
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                    color: isSelected ? '#38bdf8' : '#94a3b8'
                  }}
                >
                  {p.label} ({p.val}m)
                </button>
              );
            })}
          </div>

          {/* Regional Jump Presets */}
          {onSelectRegion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Focus Region:
              </span>
              {regionalPresets.map((r) => (
                <button
                  key={r.name}
                  onClick={() => onSelectRegion(r.lat, r.lon, r.name)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid rgba(13, 242, 201, 0.2)',
                    background: 'rgba(13, 242, 201, 0.06)',
                    color: '#2dd4bf',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <MapPin size={10} />
                  <span>{r.name.split(' (')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
