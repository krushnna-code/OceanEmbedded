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
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Model Architecture</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>OceanEmbed (GNN-ConvLSTM-Transformer Hybrid)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Version</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0284c7' }}>v0.3.0-dev</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Domain</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>North Indian Ocean (5°N–30°N, 45°E–105°E)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Target Grid Resolution</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>0.25° × 0.25° (101 × 241 = 24,341 graph nodes)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Graph Connectivity</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>8-Neighbour Spatial Graph (192,680 edges)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Temporal Window</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>7-Day Rolling Sequence (T-6 … T)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem 0', color: '#64748b' }}>Output Fields</td>
                  <td style={{ padding: '0.4rem 0', fontWeight: 600, color: '#0f172a' }}>Temperature &mu;(x,y,z) + Uncertainty &sigma;(x,y,z)</td>
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
              Dual-Branch Multimodal Inputs (7 Channels)
            </h3>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '0.3rem 0' }}>Branch</th>
                  <th style={{ padding: '0.3rem 0' }}>Channel</th>
                  <th style={{ padding: '0.3rem 0' }}>Variable</th>
                  <th style={{ padding: '0.3rem 0' }}>Source Product</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td rowSpan={2} style={{ padding: '0.35rem 0', fontWeight: 700, color: '#0369a1', verticalAlign: 'top' }}>Thermodynamic GNN</td>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C0</td>
                  <td>analysed_sst (°C)</td>
                  <td style={{ color: '#64748b' }}>OSTIA SST (0.05°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C1</td>
                  <td>sos (PSU)</td>
                  <td style={{ color: '#64748b' }}>CMEMS SSS (0.125°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td rowSpan={5} style={{ padding: '0.35rem 0', fontWeight: 700, color: '#0f766e', verticalAlign: 'top' }}>Dynamic GNN</td>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C2</td>
                  <td>sla / adt (m)</td>
                  <td style={{ color: '#64748b' }}>DUACS SLA (0.25°)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C3</td>
                  <td>uo (m/s)</td>
                  <td style={{ color: '#64748b' }}>OSCAR / CMEMS Current U</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C4</td>
                  <td>vo (m/s)</td>
                  <td style={{ color: '#64748b' }}>OSCAR / CMEMS Current V</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C5</td>
                  <td>uwnd (m/s)</td>
                  <td style={{ color: '#64748b' }}>CCMP Wind U (10m)</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.35rem 0', fontWeight: 600 }}>C6</td>
                  <td>vwnd (m/s)</td>
                  <td style={{ color: '#64748b' }}>CCMP Wind V (10m)</td>
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
            <span>Dual-Branch GNN-Hybrid Tensor Flow</span>
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
              <strong>Surface Input</strong><br />[B, 7, 7, 101, 241]
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#f0fdf4', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #4ade80' }}>
              <strong>Thermo GNN (SST+SSS) &amp; Dynamic GNN</strong><br />8-Neighbour Graph Convolutions
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#fef3c7', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #fcd34d' }}>
              <strong>Gated Fusion &amp; ConvLSTM</strong><br />7-Day Spatiotemporal Memory
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#f3e8ff', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #c084fc' }}>
              <strong>Cross-Variable Attention</strong><br />Latent Embedding z [B, 128, 26, 61]
            </div>
            <span>&rarr;</span>
            <div style={{ background: '#fee2e2', padding: '0.5rem 0.8rem', borderRadius: '3px', border: '1px solid #f87171' }}>
              <strong>Depth Decoder + Uncertainty Head</strong><br />&mu; [B,15,H,W] &amp; &sigma; [B,15,H,W]
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
