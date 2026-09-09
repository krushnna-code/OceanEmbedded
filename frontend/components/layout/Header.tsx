'use client';

import React from 'react';
import { Waves, Compass, Layers, Activity, Info, BarChart3 } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'reconstruction', label: 'Reconstruction Explorer', icon: Compass },
    { id: 'ocean3d', label: '3D Ocean Volume', icon: Layers },
    { id: 'profile', label: 'Vertical Profiles', icon: Activity },
    { id: 'model_info', label: 'Model Specifications', icon: Info },
    { id: 'metrics', label: 'Validation Metrics', icon: BarChart3 },
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
                  OCEANEMBED
                </h1>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '3px'
                }}>
                  v0.1.0-dev
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                North Indian Ocean Subsurface Temperature Intelligence (5°N–30°N, 45°E–105°E)
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e3a5f' }}>
              Target Grid: 0.25° &middot; 15 Depth Levels (0–1000m)
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              Framework: CNN &middot; Transformer &middot; ConvLSTM &middot; Cross-Attention
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
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
                  gap: '0.45rem',
                  paddingBottom: '0.65rem'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
