'use client';

import React from 'react';
import { Calendar, Gauge, Sliders, Layers } from 'lucide-react';

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
}) => {
  const depthPresets = [
    { label: 'Surface (0m)', val: 0.0 },
    { label: 'Mixed Layer (30m)', val: 30.0 },
    { label: 'Thermocline (100m)', val: 100.0 },
    { label: 'Upper Intermediate (200m)', val: 200.0 },
    { label: 'Deep Water (1000m)', val: 1000.0 },
  ];

  return (
    <div className="gov-card" style={{ marginBottom: '1.25rem' }}>
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Sliders size={16} color="#0284c7" />
          <span>Operational Reconstruction Controls</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Real-Time Parametric Slicing
        </div>
      </div>

      <div className="gov-card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
        {/* Date Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '150px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} color="#0284c7" />
            <span>Observation Date</span>
          </label>
          <select
            className="gov-select"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d} (Daily)
              </option>
            ))}
          </select>
        </div>

        {/* Depth Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '165px' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Gauge size={14} color="#0284c7" />
            <span>Depth Level</span>
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

        {/* Mode Selector (Temperature vs Anomaly) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={14} color="#0284c7" />
            <span>Output Field</span>
          </label>
          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: '3px', overflow: 'hidden' }}>
            <button
              onClick={() => onAnomalyChange(false)}
              style={{
                padding: '0.42rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                background: !isAnomaly ? '#0284c7' : '#ffffff',
                color: !isAnomaly ? '#ffffff' : '#334155',
                transition: 'all 0.15s ease'
              }}
            >
              Temperature
            </button>
            <button
              onClick={() => onAnomalyChange(true)}
              style={{
                padding: '0.42rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                background: isAnomaly ? '#0284c7' : '#ffffff',
                color: isAnomaly ? '#ffffff' : '#334155',
                borderLeft: '1px solid #cbd5e1',
                transition: 'all 0.15s ease'
              }}
            >
              Anomaly
            </button>
          </div>
        </div>

        {/* Uncertainty Overlay Toggle */}
        {onShowUncertaintyChange && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
              Uncertainty Head
            </span>
            <button
              onClick={() => onShowUncertaintyChange(!showUncertainty)}
              style={{
                padding: '0.42rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid #c084fc',
                borderRadius: '3px',
                background: showUncertainty ? '#9333ea' : '#faf5ff',
                color: showUncertainty ? '#ffffff' : '#7e22ce',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {showUncertainty ? 'Showing σ Field' : 'Show Uncertainty (σ)'}
            </button>
          </div>
        )}

        {/* Model ID Display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '160px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
            Reconstruction Engine
          </span>
          <div style={{
            padding: '0.42rem 0.75rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '3px',
            color: '#0f2744'
          }}>
            OceanEmbed GNN-Hybrid
          </div>
        </div>

        {/* Quick Depth Presets */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
          {depthPresets.map((p) => (
            <button
              key={p.val}
              onClick={() => onDepthChange(p.val)}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: selectedDepth === p.val ? '#0f2744' : '#f8fafc',
                color: selectedDepth === p.val ? '#ffffff' : '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                transition: 'all 0.1s ease'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
