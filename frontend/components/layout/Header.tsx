'use client';

import React from 'react';
import {
  Waves,
  Compass,
  Layers,
  Activity,
  Info,
  BarChart3,
  HelpCircle,
  Flame,
  Disc,
  Radio,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isLiveBackend?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isLiveBackend = true
}) => {
  const tabs = [
    { id: 'reconstruction', label: '2D Ocean Map', icon: Compass },
    { id: 'ocean3d', label: '3D Volumetric', icon: Layers, badge: 'WebGL' },
    { id: 'profile', label: 'Vertical Profiles', icon: Activity, badge: '0–1000m' },
    { id: 'uncertainty', label: 'Uncertainty Explorer', icon: HelpCircle, badge: 'σ(x,y,z)' },
    { id: 'mhw', label: 'Marine Heatwaves', icon: Flame, badge: 'Phase 2' },
    { id: 'cyclone', label: 'Cyclone Heat Content', icon: Disc, badge: 'TCHC / D26' },
    { id: 'metrics', label: 'Validation Metrics', icon: BarChart3, badge: 'Argo Match' },
    { id: 'model_info', label: 'Architecture & Docs', icon: Info },
  ];

  return (
    <header style={{
      background: 'rgba(7, 14, 28, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(56, 189, 248, 0.16)',
      position: 'sticky',
      top: 0,
      zIndex: 40
    }}>
      <div className="portal-container" style={{ padding: '0.85rem 1.5rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Logo & Platform Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #0f172a 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              padding: '0.65rem',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(2, 132, 199, 0.35)'
            }}>
              <Waves size={28} color="#38bdf8" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h1 style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#ffffff'
                }}>
                  Ocean<span style={{ color: '#38bdf8' }}>Embed</span>
                </h1>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                  color: '#ffffff',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  boxShadow: '0 0 10px rgba(14, 165, 233, 0.35)',
                  letterSpacing: '0.04em'
                }}>
                  v0.3.0
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: 'rgba(13, 242, 201, 0.12)',
                  color: '#0df2c9',
                  border: '1px solid rgba(13, 242, 201, 0.3)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px'
                }}>
                  Dual-GNN &middot; ConvLSTM &middot; Attention Core
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, marginTop: '0.15rem' }}>
                Subsurface Ocean Intelligence Framework &middot; Satellite Embeddings to 3D Hydrodynamics
              </p>
            </div>
          </div>

          {/* Quick Metrics Ticker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              display: 'flex',
              gap: '1rem',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(56, 189, 248, 0.14)',
              borderRadius: '8px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.74rem'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>Surface Temp</span>
                <span style={{ fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>28.5&deg;C &plusmn; 0.2</span>
              </div>
              <div style={{ width: '1px', background: 'rgba(56, 189, 248, 0.15)' }} />
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>Mean D26</span>
                <span style={{ fontWeight: 700, color: '#0df2c9', fontFamily: 'var(--font-mono)' }}>64.2 m</span>
              </div>
              <div style={{ width: '1px', background: 'rgba(56, 189, 248, 0.15)' }} />
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase' }}>MHW Area</span>
                <span style={{ fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>8.4% Active</span>
              </div>
            </div>

            {/* Backend Status indicator */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: isLiveBackend ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
              border: `1px solid ${isLiveBackend ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.3)'}`,
              color: isLiveBackend ? '#34d399' : '#38bdf8'
            }}>
              <Radio size={12} className={isLiveBackend ? 'animate-pulse' : ''} />
              <span>{isLiveBackend ? 'LIVE API ENGINE' : 'NEURAL SIMULATOR'}</span>
            </div>
          </div>
        </div>

        {/* High-Tech Tab Navigation */}
        <nav style={{
          display: 'flex',
          gap: '0.35rem',
          marginTop: '1rem',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(56, 189, 248, 0.12)',
          paddingBottom: '0.5rem'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                style={{
                  border: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.15)',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    border: '1px solid rgba(56, 189, 248, 0.2)'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
