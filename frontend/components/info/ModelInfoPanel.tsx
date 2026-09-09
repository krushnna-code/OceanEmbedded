'use client';

import React from 'react';
import { Info, Cpu, Database, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
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
            <Cpu size={16} color="#0284c7" />
            <span>Deep Learning Reconstruction Engine Architecture</span>
          </div>
          <span className="status-tag">DEMO / MODEL DEVELOPMENT DATA</span>
        </div>

        <div className="gov-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
              System Specifications
            </h3>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Model Identifier</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>OceanEmbed3D</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Version</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0284c7' }}>v0.1.0-dev</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Domain</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>North Indian Ocean (5°N–30°N, 45°E–105°E)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Target Grid Resolution</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>0.25° × 0.25° (101 × 241 nodes)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Temporal Input Window</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>7-Day Sequential Window (T=7)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Reconstructed Depths</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>15 Levels: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000m</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.5rem' }}>
              7 Multimodal Surface Satellite Inputs
            </h3>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.3rem 0' }}>Channel</th>
                  <th style={{ padding: '0.3rem 0' }}>Variable</th>
                  <th style={{ padding: '0.3rem 0' }}>Source Sensor/Product</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C0</td>
                  <td>analysed_sst (°C)</td>
                  <td style={{ color: '#64748b' }}>OSTIA / MetOffice Global SST</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C1</td>
                  <td>sos (PSU)</td>
                  <td style={{ color: '#64748b' }}>CMEMS Multi-Observation SSS</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C2</td>
                  <td>sla / adt (m)</td>
                  <td style={{ color: '#64748b' }}>C3S / DUACS Two-Satellite Altimetry</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C3</td>
                  <td>uo (m/s)</td>
                  <td style={{ color: '#64748b' }}>CMEMS Zonal Geostrophic+Ekman Current</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C4</td>
                  <td>vo (m/s)</td>
                  <td style={{ color: '#64748b' }}>CMEMS Meridional Current</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C5</td>
                  <td>uwnd (m/s)</td>
                  <td style={{ color: '#64748b' }}>CCMP Zonal Wind Vector (10m)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C6</td>
                  <td>vwnd (m/s)</td>
                  <td style={{ color: '#64748b' }}>CCMP Meridional Wind Vector (10m)</td>
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
            <Info size={16} color="#0284c7" />
            <span>Subsurface Neural Tensor Flow</span>
          </div>
        </div>
        <div className="gov-card-body" style={{ fontSize: '0.8rem', color: '#334155' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.6rem',
            background: '#f8fafc',
            padding: '1rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.78rem'
          }}>
            <div style={{ background: '#e0f2fe', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #38bdf8' }}>
              <strong>Surface Tensor</strong><br />[B, 7, 7, 101, 241]
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#f0fdf4', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #4ade80' }}>
              <strong>CNN Stem + ResBlocks</strong><br />[B*T, 128, 26, 61]
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#fef3c7', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #fcd34d' }}>
              <strong>Spatial Transformer &amp; ConvLSTM</strong><br />Spatial Q &times; Temporal KV
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#f3e8ff', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #c084fc' }}>
              <strong>Latent Embedding z</strong><br />[B, 128, 26, 61]
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#fee2e2', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #f87171' }}>
              <strong>Depth Decoder</strong><br />[B, 15, 101, 241]
            </div>
          </div>
        </div>
      </div>

      {/* Scientific Integrity Statement per Section 45 */}
      <div className="gov-card" style={{ borderLeft: '4px solid #0284c7' }}>
        <div className="gov-card-body" style={{ display: 'flex', gap: '0.85rem' }}>
          <ShieldCheck size={24} color="#0284c7" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.3rem' }}>
              Scientific Integrity &amp; Development Status Notice
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.5 }}>
              This release represents the completed deep-learning reconstruction architecture, FastAPI service backend,
              and interactive 2D/3D visualization portal. In accordance with government scientific standards (Section 45 &amp; 55),
              no fabricated ARGO agreement scores, RMSE, or correlation figures are displayed. Formal statistical validation
              is designated <strong>&ldquo;Validation pending&rdquo;</strong> until the full multi-day harmonized observational
              pipeline is trained and collocated against independent INCOIS ARGO CTD profiles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
