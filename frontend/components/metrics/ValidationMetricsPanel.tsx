'use client';

import React, { useState, useEffect } from 'react';
import { MetricsData } from '@/types/reconstruction';
import { fetchMetrics } from '@/lib/api/reconstruction';
import { BarChart2, CheckCircle2, Award, Layers, ShieldCheck, MapPin, TrendingUp, Download, Sparkles } from 'lucide-react';

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
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8' }}>
          Computing Quantitative Oceanographic Metrics across 15 standard depths...
        </div>
      </div>
    );
  }

  if (error || !metrics || !metrics.overall) {
    return (
      <div className="gov-card" style={{ padding: '2rem', textAlign: 'center', borderLeft: '4px solid #ef4444' }}>
        <div style={{ color: '#f87171', fontWeight: 700, marginBottom: '0.5rem' }}>Metrics Engine Error</div>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{error || 'Unable to retrieve validation metrics from backend.'}</p>
      </div>
    );
  }

  const { overall, depth_breakdown, sub_basins } = metrics;

  const handleExportCSV = () => {
    const header = 'depth_m,mae_c,rmse_c,bias_c,r2_score,correlation,accuracy_pct\n';
    const rows = depth_breakdown
      .map((d) => `${d.depth_m},${d.mae_c},${d.rmse_c},${d.bias_c},${d.r2_score},${d.correlation},${d.accuracy_pct}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Validation_Metrics_15Depths.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(15, 23, 42, 0.85) 100%)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(56, 189, 248, 0.3)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <Award size={24} color="#38bdf8" />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
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
              gap: '0.4rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
            }}
          >
            <CheckCircle2 size={13} />
            Validated Benchmarks
          </span>
          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
            {overall.total_valid_points.toLocaleString()} Ocean Grid Nodes Evaluated
          </div>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Overall Accuracy
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {overall.accuracy_pct}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            100% &minus; Mean Absolute % Error (MAPE)
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            R² Variance Explained
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {overall.r2_score}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {(overall.r2_score * 100).toFixed(1)}% Subsurface Variance Captured
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #818cf8' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Root Mean Square Error
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {overall.rmse_c}°C
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Domain-wide Root Mean Square Deviation
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Mean Absolute Error (MAE)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {overall.mae_c}°C
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Average Magnitude of Thermal Error
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1rem', borderLeft: '4px solid #0df2c9' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Pearson Correlation (r)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0df2c9', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
            {overall.correlation}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Spatial &amp; Vertical Linear Concordance
          </div>
        </div>
      </div>

      {/* Regional Sub-basin Breakdown */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="gov-card-title">
            <MapPin size={16} color="#38bdf8" />
            <span>Regional Sub-basin Performance Breakdown</span>
          </div>
        </div>
        <div className="gov-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {Object.entries(sub_basins).map(([name, basin]) => {
              const displayName = name === 'bay_of_bengal'
                ? 'Bay of Bengal Basin'
                : name === 'arabian_sea'
                ? 'Arabian Sea Basin'
                : 'Equatorial Indian Ocean';
              return (
                <div
                  key={name}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(56, 189, 248, 0.15)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{displayName}</h4>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px'
                      }}
                    >
                      {basin.accuracy_pct}% Accuracy
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>RMSE: </span>
                      <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{basin.rmse_c}°C</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>MAE: </span>
                      <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>{basin.mae_c}°C</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>R² Score: </span>
                      <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{basin.r2_score}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Correlation: </span>
                      <strong style={{ color: '#0df2c9', fontFamily: 'var(--font-mono)' }}>{basin.correlation}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-Depth Stratification Table */}
      <div className="gov-card">
        <div className="gov-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="gov-card-title">
            <Layers size={16} color="#38bdf8" />
            <span>Vertical Depth-Stratified Error Breakdown (15 Standard Depths: 0m to 1000m)</span>
          </div>
          <button
            onClick={handleExportCSV}
            className="btn-glass"
          >
            <Download size={13} />
            <span>Export Table CSV</span>
          </button>
        </div>
        <div className="gov-card-body" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', color: '#94a3b8', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Depth (m)</th>
                <th style={{ padding: '0.75rem 1rem' }}>MAE (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>RMSE (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Mean Bias (°C)</th>
                <th style={{ padding: '0.75rem 1rem' }}>R² Score</th>
                <th style={{ padding: '0.75rem 1rem' }}>Correlation (r)</th>
                <th style={{ padding: '0.75rem 1rem' }}>Accuracy Rating</th>
              </tr>
            </thead>
            <tbody>
              {depth_breakdown.map((row, idx) => (
                <tr
                  key={row.depth_m}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.4)'
                  }}
                >
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {row.depth_m}m
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                    {row.mae_c}°C
                  </td>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {row.rmse_c}°C
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: row.bias_c < 0 ? '#60a5fa' : '#fb923c', fontFamily: 'var(--font-mono)' }}>
                    {row.bias_c > 0 ? `+${row.bias_c}` : row.bias_c}°C
                  </td>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {row.r2_score}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: '#0df2c9', fontFamily: 'var(--font-mono)' }}>
                    {row.correlation}
                  </td>
                  <td style={{ padding: '0.7rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '60px', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${row.accuracy_pct}%`,
                            height: '100%',
                            background: row.accuracy_pct >= 95 ? '#10b981' : row.accuracy_pct >= 90 ? '#38bdf8' : '#f59e0b',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {row.accuracy_pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
