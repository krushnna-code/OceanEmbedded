'use client';

import React from 'react';
import { Info, Cpu, Database, CheckCircle2, AlertTriangle, ShieldCheck, GitBranch, Terminal } from 'lucide-react';
import { ModelMetadata } from '@/types/reconstruction';

interface ModelInfoProps {
  metadata: ModelMetadata | null;
}

export const ModelInfoPanel: React.FC<ModelInfoProps> = ({ metadata }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Overview Card */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="gov-card-title">
            <Cpu size={16} color="#38bdf8" />
            <span>Deep Learning Reconstruction Engine Architecture</span>
          </div>
          <span className="status-tag pulse">ACTIVE v0.3.0 CORE</span>
        </div>

        <div className="gov-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={14} color="#38bdf8" />
              <span>System Specifications</span>
            </h3>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Model Architecture</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#f8fafc' }}>OceanEmbed (GNN-ConvLSTM-Transformer Hybrid)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Target Region</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 600, color: '#38bdf8' }}>North Indian Ocean (5°N–30°N, 45°E–105°E)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Grid Resolution</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 600, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>0.25° × 0.25° (101 × 241 = 24,341 graph nodes)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Graph Connectivity</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 600, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>8-Neighbour Spatial Graph (192,680 edges)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Temporal Window</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 600, color: '#f8fafc' }}>7-Day Rolling Sequence (T-6 … T)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Output Fields</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#0df2c9' }}>Temperature μ(x,y,z) + Uncertainty σ(x,y,z)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.45rem 0', color: '#94a3b8' }}>Vertical Levels</td>
                  <td style={{ padding: '0.45rem 0', fontWeight: 600, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>15 Depths: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GitBranch size={14} color="#0df2c9" />
              <span>Dual-Branch Multimodal Satellite Inputs (7 Channels)</span>
            </h3>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.2)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem 0' }}>Branch</th>
                  <th style={{ padding: '0.4rem 0' }}>Channel</th>
                  <th style={{ padding: '0.4rem 0' }}>Variable</th>
                  <th style={{ padding: '0.4rem 0' }}>Source Satellite Product</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td rowSpan={2} style={{ padding: '0.4rem 0', fontWeight: 700, color: '#38bdf8', verticalAlign: 'top' }}>Thermodynamic GNN</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C0</td>
                  <td style={{ color: '#ffffff' }}>analysed_sst (°C)</td>
                  <td style={{ color: '#94a3b8' }}>OSTIA Sea Surface Temp (0.05°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.15)' }}>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C1</td>
                  <td style={{ color: '#ffffff' }}>sos (PSU)</td>
                  <td style={{ color: '#94a3b8' }}>CMEMS Sea Surface Salinity (0.125°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td rowSpan={5} style={{ padding: '0.4rem 0', fontWeight: 700, color: '#0df2c9', verticalAlign: 'top' }}>Dynamic GNN</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C2</td>
                  <td style={{ color: '#ffffff' }}>sla / adt (m)</td>
                  <td style={{ color: '#94a3b8' }}>DUACS Sea Level Anomaly (0.25°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C3</td>
                  <td style={{ color: '#ffffff' }}>uo (m/s)</td>
                  <td style={{ color: '#94a3b8' }}>CMEMS Zonal Surface Current</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C4</td>
                  <td style={{ color: '#ffffff' }}>vo (m/s)</td>
                  <td style={{ color: '#94a3b8' }}>CMEMS Meridional Surface Current</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C5</td>
                  <td style={{ color: '#ffffff' }}>u10 (m/s)</td>
                  <td style={{ color: '#94a3b8' }}>CCMP Zonal Wind Vector (10m)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>C6</td>
                  <td style={{ color: '#ffffff' }}>v10 (m/s)</td>
                  <td style={{ color: '#94a3b8' }}>CCMP Meridional Wind Vector (10m)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Model Pipeline Flow Diagram */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div className="gov-card-title">
            <Info size={16} color="#38bdf8" />
            <span>Dual-Branch GNN-Hybrid Tensor Flow Pipeline</span>
          </div>
        </div>
        <div className="gov-card-body">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'rgba(15, 23, 42, 0.75)',
            padding: '1.25rem',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.76rem'
          }}>
            <div style={{ background: 'rgba(2, 132, 199, 0.18)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
              <strong style={{ color: '#38bdf8' }}>7 Surface Drivers</strong><br />
              <span style={{ color: '#cbd5e1' }}>[B, 7, 7, 101, 241]</span>
            </div>
            <span style={{ color: '#38bdf8', fontSize: '1.2rem' }}>&rarr;</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.18)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              <strong style={{ color: '#34d399' }}>Dual GNNs</strong><br />
              <span style={{ color: '#cbd5e1' }}>Thermo + Dynamic</span>
            </div>
            <span style={{ color: '#38bdf8', fontSize: '1.2rem' }}>&rarr;</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.18)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
              <strong style={{ color: '#fbbf24' }}>Gated Fusion &amp; ConvLSTM</strong><br />
              <span style={{ color: '#cbd5e1' }}>7-Day Sequence Memory</span>
            </div>
            <span style={{ color: '#38bdf8', fontSize: '1.2rem' }}>&rarr;</span>
            <div style={{ background: 'rgba(168, 85, 247, 0.18)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.35)' }}>
              <strong style={{ color: '#c084fc' }}>Cross-Attention</strong><br />
              <span style={{ color: '#cbd5e1' }}>Latent Embedding z</span>
            </div>
            <span style={{ color: '#38bdf8', fontSize: '1.2rem' }}>&rarr;</span>
            <div style={{ background: 'rgba(244, 63, 94, 0.18)', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.35)' }}>
              <strong style={{ color: '#fb7185' }}>15-Depth Decoder</strong><br />
              <span style={{ color: '#cbd5e1' }}>μ(x,y,z) &amp; σ(x,y,z)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scientific Integrity Statement */}
      <div className="gov-card" style={{ borderLeft: '4px solid #38bdf8' }}>
        <div className="gov-card-body" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ShieldCheck size={28} color="#38bdf8" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.25rem' }}>
              Scientific Integrity &amp; Operational Standards Notice
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              The OceanEmbed framework connects surface remote sensing (SST, SSS, SLA, surface currents, and 10m scatterometer winds)
              to 3D ocean hydrodynamics through physical consistency losses (vertical thermal gradient smoothness, hydrostatic stability,
              and thermocline weighting). Validated against independent in-situ INCOIS ARGO profiling floats and CMEMS GLORYS reanalysis.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
