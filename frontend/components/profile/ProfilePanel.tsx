'use client';

import React from 'react';
import { VerticalProfileData } from '@/types/reconstruction';
import { Activity, MapPin, AlertCircle, BarChart2 } from 'lucide-react';

interface ProfilePanelProps {
  profile: VerticalProfileData | null;
  selectedDepth: number;
  onDepthSelect: (depth: number) => void;
  loading: boolean;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  profile,
  selectedDepth,
  onDepthSelect,
  loading,
}) => {
  if (!profile) {
    return (
      <div className="gov-card" style={{ height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading vertical ocean profile...</p>
      </div>
    );
  }

  const { depths_m, temperature_profile, anomaly_profile, uncertainty, nearest_grid_point, is_ocean } = profile;

  // Filter valid numeric pairs for SVG rendering
  const validPoints: { depth: number; temp: number; anom: number; unc: number | null; idx: number }[] = [];
  depths_m.forEach((d, idx) => {
    const t = temperature_profile[idx];
    const a = anomaly_profile[idx];
    const u = uncertainty ? uncertainty[idx] : null;
    if (t !== null && !isNaN(t)) {
      validPoints.push({ depth: d, temp: t, anom: a ?? 0, unc: u, idx });
    }
  });

  const minTemp = validPoints.length > 0 ? Math.min(...validPoints.map((p) => p.temp - (p.unc ?? 0))) - 1 : 0;
  const maxTemp = validPoints.length > 0 ? Math.max(...validPoints.map((p) => p.temp + (p.unc ?? 0))) + 1 : 32;
  const tempRange = Math.max(1, maxTemp - minTemp);

  const svgWidth = 320;
  const svgHeight = 360;
  const padding = { top: 25, right: 30, bottom: 35, left: 55 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  // Depth scaling: square root scaling stretches upper 0-200m while accommodating 1000m
  const scaleDepth = (d: number): number => {
    const maxSqrt = Math.sqrt(1000);
    const frac = Math.sqrt(d) / maxSqrt;
    return padding.top + frac * plotH;
  };

  const scaleTemp = (t: number): number => {
    const frac = (t - minTemp) / tempRange;
    return padding.left + frac * plotW;
  };

  const pathD = validPoints.reduce((acc, pt, i) => {
    const x = scaleTemp(pt.temp);
    const y = scaleDepth(pt.depth);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Build uncertainty band polygon (upper bounds going down, lower bounds coming back up)
  const hasUncertainty = validPoints.some((p) => p.unc !== null && p.unc !== undefined);
  let uncertaintyBandD = '';
  if (hasUncertainty) {
    const upperCoords = validPoints.map((pt) => {
      const u = pt.unc ?? 0.3;
      return `${scaleTemp(pt.temp + u)},${scaleDepth(pt.depth)}`;
    });
    const lowerCoords = [...validPoints].reverse().map((pt) => {
      const u = pt.unc ?? 0.3;
      return `${scaleTemp(pt.temp - u)},${scaleDepth(pt.depth)}`;
    });
    uncertaintyBandD = [...upperCoords, ...lowerCoords].join(' ');
  }

  return (
    <div className="gov-card">
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Activity size={16} color="#0284c7" />
          <span>Subsurface Vertical Profile (with Uncertainty &sigma;)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#334155' }}>
          <MapPin size={13} color="#0284c7" />
          <span>
            {nearest_grid_point.latitude.toFixed(2)}°N, {nearest_grid_point.longitude.toFixed(2)}°E
          </span>
          {!is_ocean && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '2px' }}>
              LAND
            </span>
          )}
        </div>
      </div>

      <div className="gov-card-body" style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* SVG Depth vs Temperature Curve */}
          <div style={{ flex: '1 1 300px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '3px', padding: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e3a5f' }}>
                Temperature (&mu; &plusmn; &sigma;) vs Depth
              </span>
              {hasUncertainty && (
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9333ea', background: '#f3e8ff', padding: '0.1rem 0.4rem', borderRadius: '2px' }}>
                  &plusmn;&sigma; Band (Demo)
                </span>
              )}
            </div>

            <svg width="100%" height="340" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
              {/* Thermocline region shading (50m to 200m) */}
              <rect
                x={padding.left}
                y={scaleDepth(50)}
                width={plotW}
                height={scaleDepth(200) - scaleDepth(50)}
                fill="#f0f9ff"
                opacity="0.8"
              />
              <text
                x={padding.left + plotW - 6}
                y={scaleDepth(120)}
                fontSize="9"
                fill="#0284c7"
                textAnchor="end"
                fontStyle="italic"
              >
                Thermocline (50-200m)
              </text>

              {/* Grid lines - Depth (horizontal) */}
              {[0, 50, 100, 200, 500, 1000].map((d) => {
                const y = scaleDepth(d);
                return (
                  <g key={d}>
                    <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y} stroke="#e2e8f0" strokeDasharray="2,2" />
                    <text x={padding.left - 8} y={y + 3} fontSize="10" fill="#64748b" textAnchor="end">
                      {d}m
                    </text>
                  </g>
                );
              })}

              {/* Grid lines - Temperature (vertical) */}
              {[10, 15, 20, 25, 30].map((temp) => {
                if (temp < minTemp || temp > maxTemp) return null;
                const x = scaleTemp(temp);
                return (
                  <g key={temp}>
                    <line x1={x} y1={padding.top} x2={x} y2={padding.top + plotH} stroke="#e2e8f0" strokeDasharray="2,2" />
                    <text x={x} y={padding.top + plotH + 16} fontSize="10" fill="#64748b" textAnchor="middle">
                      {temp}°
                    </text>
                  </g>
                );
              })}

              {/* Uncertainty Band Shading (μ ± σ) */}
              {hasUncertainty && uncertaintyBandD && (
                <polygon
                  points={uncertaintyBandD}
                  fill="rgba(147, 51, 234, 0.18)"
                  stroke="rgba(147, 51, 234, 0.45)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              )}

              {/* Selected Depth Indicator Line */}
              <line
                x1={padding.left}
                y1={scaleDepth(selectedDepth)}
                x2={padding.left + plotW}
                y2={scaleDepth(selectedDepth)}
                stroke="#f59e0b"
                strokeWidth="2"
              />

              {/* Temperature Profile Curve (μ) */}
              {pathD && <path d={pathD} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />}

              {/* Depth Point Markers */}
              {validPoints.map((pt) => {
                const cx = scaleTemp(pt.temp);
                const cy = scaleDepth(pt.depth);
                const isSelected = pt.depth === selectedDepth;
                return (
                  <circle
                    key={pt.depth}
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5 : 3.5}
                    fill={isSelected ? '#f59e0b' : '#0f2744'}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 2 : 1}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onDepthSelect(pt.depth)}
                  />
                );
              })}
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem', padding: '0 0.5rem' }}>
              <span>Y-Axis: Exaggerated Depth (m)</span>
              <span style={{ color: '#0284c7', fontWeight: 600 }}>Click points to change depth</span>
            </div>
          </div>

          {/* 15 Depth Levels Numerical Readout Table */}
          <div style={{ flex: '1 1 240px', overflowY: 'auto', maxHeight: '380px' }}>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Depth</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Temp &mu;</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Unc &sigma;</th>
                  <th style={{ padding: '0.35rem 0.5rem' }}>Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {depths_m.map((d, idx) => {
                  const t = temperature_profile[idx];
                  const a = anomaly_profile[idx];
                  const u = uncertainty ? uncertainty[idx] : null;
                  const isSelected = d === selectedDepth;
                  return (
                    <tr
                      key={d}
                      onClick={() => onDepthSelect(d)}
                      style={{
                        background: isSelected ? '#e0f2fe' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      <td style={{ padding: '0.32rem 0.5rem', color: isSelected ? '#0369a1' : '#1e293b' }}>
                        {d} m
                      </td>
                      <td style={{ padding: '0.32rem 0.5rem', color: '#0f172a' }}>
                        {t !== null ? `${t.toFixed(2)} °C` : '&mdash;'}
                      </td>
                      <td style={{ padding: '0.32rem 0.5rem', color: '#9333ea', fontSize: '0.72rem' }}>
                        {u !== null ? `&plusmn;${u.toFixed(2)}` : '&plusmn;0.25'}
                      </td>
                      <td style={{ padding: '0.32rem 0.5rem', color: a && a > 0 ? '#dc2626' : '#2563eb' }}>
                        {a !== null ? `${a > 0 ? '+' : ''}${a.toFixed(2)}` : '&mdash;'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Uncertainty & Validation Notice per Section 17, 38 & 48 */}
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '3px',
              fontSize: '0.68rem',
              color: '#64748b',
              display: 'flex',
              gap: '0.35rem'
            }}>
              <AlertCircle size={14} color="#9333ea" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Model Development &sigma; Notice:</strong> Predicted spread &sigma;(x,y,z) is an internal training signal from the heteroscedastic uncertainty head (DEMO / MODEL DEVELOPMENT DATA, not validated confidence).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
