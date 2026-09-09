'use client';

import React from 'react';
import { Waves, Compass, Layers, Activity, Info, BarChart3, HelpCircle, Flame, Disc } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'reconstruction', label: 'Reconstruction', icon: Compass },
    { id: 'ocean3d', label: '3D Ocean', icon: Layers },
    { id: 'profile', label: 'Profiles', icon: Activity },
    { id: 'uncertainty', label: 'Uncertainty Explorer', icon: HelpCircle, badge: 'Demo σ' },
    { id: 'mhw', label: 'Anomaly & MHW', icon: Flame, badge: 'Next Phase' },
    { id: 'cyclone', label: 'Cyclone Heat-Content', icon: Disc, badge: 'Next Phase' },
    { id: 'metrics', label: 'Metrics', icon: BarChart3, badge: 'Pending' },
    { id: 'model_info', label: 'About & Model', icon: Info },
  ];

  return (
    <header style={{ background: '#ffffff', borderBottom: '1px solid #cbd5e1' }}>
      <div className="portal-container" style={{ padding: '0.85rem 1.25rem 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              background: '#0f2744',
              color: '#ffffff',
              padding: '0.55rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Waves size={26} color="#38bdf8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f2744', letterSpacing: '-0.01em' }}>
                  INCOIS / OceanEmbed
                </h1>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '3px'
                }}>
                  v0.3.0-dev
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px'
                }}>
                  GNN-Hybrid Core
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                Subsurface Ocean Intelligence &middot; North Indian Ocean (5°N–30°N, 45°E–105°E)
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e3a5f' }}>
              Target Grid: 0.25° &middot; 15 Depth Levels (0–1000m)
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              Dual GNN Branches &middot; ConvLSTM &middot; Attention Fusion &middot; Uncertainty Head
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.4rem', marginTop: '0.85rem', overflowX: 'auto' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
                style={{
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  paddingBottom: '0.65rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '0.08rem 0.3rem',
                    borderRadius: '2px',
                    background: tab.badge === 'Demo σ' ? '#f3e8ff' : '#f1f5f9',
                    color: tab.badge === 'Demo σ' ? '#9333ea' : '#64748b',
                    border: '1px solid #e2e8f0'
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
