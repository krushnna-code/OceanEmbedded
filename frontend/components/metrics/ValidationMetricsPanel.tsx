'use client';

import React, { useState, useEffect } from 'react';
import { MetricsData } from '@/types/reconstruction';
import { fetchMetrics } from '@/lib/api/reconstruction';
import { BarChart2, CheckCircle2, Award, Layers, ShieldCheck, MapPin, TrendingUp } from 'lucide-react';

export function ValidationMetricsPanel() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      setLoading(true);
      try {
        const data = await fetchMetrics();
        if (isMounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to load metrics:', err);
        if (isMounted) setError(err.message || 'Failed to load validation metrics');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="gov-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f2744' }}>
          Computing Quantitative Oceanographic Metrics across 15 standard depths...
        </div>
      </div>
    );
  }

  if (error || !metrics || !metrics.overall) {
    return (
      <div className="gov-card" style={{ padding: '2rem', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
        <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: '0.5rem' }}>Metrics Engine Error</div>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{error || 'Unable to retrieve validation metrics from backend.'}</p>
      </div>
    );
  }

  const { overall, depth_breakdown, sub_basins } = metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(15, 39, 68, 0.15)',
          border: '1px solid #334155'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Award size={22} color="#38bdf8" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Independent Oceanographic Validation &amp; Error Metrics
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
            {metrics.target_dataset} &middot; {metrics.protocol} &middot; All 15 standard depth levels (0m to 1000m)
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#059669',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            <CheckCircle2 size={13} />
            Validated Benchmarks
          </span>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
            {overall.total_valid_points.toLocaleString()} Ocean Grid Points Evaluated
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Overall Model Accuracy
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#047857', marginTop: '0.25rem' }}>
            {overall.accuracy_pct}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            100% &minus; Mean Absolute % Error (MAPE)
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            R² Score (Variance Explained)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0369a1', marginTop: '0.25rem' }}>
            {overall.r2_score}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            {(overall.r2_score * 100).toFixed(1)}% Subsurface Variance Captured
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Root Mean Square Error (RMSE)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4338ca', marginTop: '0.25rem' }}>
            {overall.rmse_c}°C
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            Domain-wide Root Mean Square Deviation
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Mean Absolute Error (MAE)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b45309', marginTop: '0.25rem' }}>
            {overall.mae_c}°C
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            Average Magnitude of Thermal Error
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0d9488' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
            Pearson Correlation (r)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f766e', marginTop: '0.25rem' }}>
            {overall.correlation}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
            Spatial &amp; Vertical Linear Concordance
          </div>
        </div>
      </div>

      {/* Regional Sub-basin Breakdown */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="gov-card-title">
            <MapPin size={16} color="#0284c7" />
            <span>Regional Sub-basin Performance Breakdown</span>
          </div>
        </div>
        <div className="gov-card-body" style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {Object.entries(sub_basins).map(([name, basin]) => (
              <div
                key={name}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f2744', margin: 0 }}>{name}</h4>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #a7f3d0',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px'
                    }}
                  >
                    {basin.accuracy_pct}% Accuracy
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>RMSE: </span>
                    <strong style={{ color: '#0f2744' }}>{basin.rmse_c}°C</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>MAE: </span>
                    <strong style={{ color: '#0f2744' }}>{basin.mae_c}°C</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>R² Score: </span>
                    <strong style={{ color: '#0f2744' }}>{basin.r2_score}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Correlation: </span>
                    <strong style={{ color: '#0f2744' }}>{basin.correlation}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-Depth Stratification Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="gov-card-title">
            <Layers size={16} color="#0284c7" />
            <span>Vertical Depth-Stratified Error Breakdown (15 Standard Depths: 0m to 1000m)</span>
          </div>
        </div>
        <div className="gov-card-body" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Depth (m)</th>
                <th style={{ padding: '0.75rem 1rem' }}>MAE (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>RMSE (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Mean Bias (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>R² Score</th>
                <th style={{ padding: '0.75rem 1rem' }}>Correlation (r)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Accuracy Rating</th>
                <th style={{ padding: '0.75rem 1rem' }}>Target Mean</th>
              </tr>
            </thead>
            <tbody>
              {depth_breakdown.map((row, idx) => {
                const isThermocline = row.depth_m >= 50 && row.depth_m <= 200;
                return (
                  <tr
                    key={row.depth_m}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: '#0f2744' }}>
                      {row.depth_m}m
                      {isThermocline && (
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.35rem',
                            background: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '3px',
                            fontWeight: 600
                          }}
                        >
                          Thermocline
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#334155' }}>{row.mae_c}°C</td>
                    <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#0f2744' }}>{row.rmse_c}°C</td>
                    <td style={{ padding: '0.7rem 1rem', color: row.bias_c >= 0 ? '#047857' : '#b91c1c' }}>
                      {row.bias_c >= 0 ? `+${row.bias_c}` : row.bias_c}°C
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#334155' }}>{row.r2_score}</td>
                    <td style={{ padding: '0.7rem 1rem', color: '#334155' }}>{row.correlation}</td>
                    <td style={{ padding: '0.7rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '6px',
                            background: '#e2e8f0',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            maxWidth: '70px'
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, row.accuracy_pct)}%`,
                              height: '100%',
                              background: row.accuracy_pct > 90 ? '#10b981' : row.accuracy_pct > 80 ? '#38bdf8' : '#f59e0b'
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#0f2744' }}>
                          {row.accuracy_pct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem 1rem', color: '#64748b' }}>{row.target_mean_c}°C</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protocol Integrity Verification Card */}
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        <ShieldCheck size={28} color="#16a34a" />
        <div style={{ fontSize: '0.78rem', color: '#166534', lineHeight: 1.5 }}>
          <strong>Scientific Integrity Adherence:</strong> GLORYS12V1 reanalysis targets (0.083° regridded to 0.25°) are evaluated with explicit land masking.
          ARGO in-situ float CTD profiles are preserved in strict train/val holdout to guarantee independent out-of-distribution evaluation.
        </div>
      </div>
    </div>
  );
}
