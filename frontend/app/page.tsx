'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { ReconstructionControls } from '@/components/controls/ReconstructionControls';
import { OceanMap2D } from '@/components/map/OceanMap2D';
import { ProfilePanel } from '@/components/profile/ProfilePanel';
import { OceanVolume3D } from '@/components/ocean3d/OceanVolume3D';
import { ModelInfoPanel } from '@/components/info/ModelInfoPanel';

import {
  ConfigData,
  ModelMetadata,
  ReconstructionMapData,
  VerticalProfileData,
  Volume3DData
} from '@/types/reconstruction';

import {
  fetchConfig,
  fetchModelMetadata,
  fetchReconstructionMap,
  fetchVerticalProfile,
  fetchVolume3D
} from '@/lib/api/reconstruction';

import { AlertTriangle, Compass, Layers, Activity, BarChart2 } from 'lucide-react';

export default function Home() {
  // Shared Application State (Section 38: Central frontend state model)
  const [activeTab, setActiveTab] = useState<string>('reconstruction');
  const [dates, setDates] = useState<string[]>(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']);
  const [depths, setDepths] = useState<number[]>([0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]);
  
  const [selectedDate, setSelectedDate] = useState<string>('2026-03-10');
  const [selectedDepth, setSelectedDepth] = useState<number>(100.0);
  const [selectedLat, setSelectedLat] = useState<number>(12.50);
  const [selectedLon, setSelectedLon] = useState<number>(82.25);
  const [isAnomaly, setIsAnomaly] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('oceanembed-3d-v1');

  // Loaded Data
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [mapData, setMapData] = useState<ReconstructionMapData | null>(null);
  const [profileData, setProfileData] = useState<VerticalProfileData | null>(null);
  const [volumeData, setVolumeData] = useState<Volume3DData | null>(null);

  const [loadingMap, setLoadingMap] = useState<boolean>(false);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [loadingVolume, setLoadingVolume] = useState<boolean>(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(true);

  // Initial Config & Metadata Load
  useEffect(() => {
    async function init() {
      try {
        const config = await fetchConfig();
        if (config.available_dates && config.available_dates.length > 0) {
          setDates(config.available_dates);
          setSelectedDate(config.available_dates[0]);
        }
        if (config.depth_levels) {
          setDepths(config.depth_levels);
        }
        const meta = await fetchModelMetadata();
        setMetadata(meta);
        setBackendAvailable(true);
      } catch (err) {
        console.warn('Backend unavailable, using development state:', err);
        setBackendAvailable(false);
      }
    }
    init();
  }, []);

  // Fetch 2D Map Data on Date, Depth, or Anomaly change
  useEffect(() => {
    async function loadMap() {
      setLoadingMap(true);
      try {
        const data = await fetchReconstructionMap(selectedDate, selectedDepth, isAnomaly);
        setMapData(data);
      } catch (err) {
        console.error('Error fetching map:', err);
      } finally {
        setLoadingMap(false);
      }
    }
    loadMap();
  }, [selectedDate, selectedDepth, isAnomaly]);

  // Fetch Vertical Profile Data on Coordinate or Date change
  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      try {
        const data = await fetchVerticalProfile(selectedLat, selectedLon, selectedDate);
        setProfileData(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [selectedLat, selectedLon, selectedDate]);

  // Fetch 3D Volume Data on Date change
  useEffect(() => {
    async function loadVolume() {
      setLoadingVolume(true);
      try {
        const data = await fetchVolume3D(selectedDate, 4);
        setVolumeData(data);
      } catch (err) {
        console.error('Error fetching 3D volume:', err);
      } finally {
        setLoadingVolume(false);
      }
    }
    loadVolume();
  }, [selectedDate]);

  // Synchronized point selection handler
  const handleSelectPoint = (lat: number, lon: number) => {
    setSelectedLat(lat);
    setSelectedLon(lon);
  };

  // Synchronized depth selection handler
  const handleSelectDepth = (depth: number) => {
    setSelectedDepth(depth);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="portal-container" style={{ flex: 1, padding: '1.25rem 1.25rem 2rem' }}>
        {/* Parametric Controls Bar (always visible) */}
        <ReconstructionControls
          dates={dates}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          depths={depths}
          selectedDepth={selectedDepth}
          onDepthChange={handleSelectDepth}
          isAnomaly={isAnomaly}
          onAnomalyChange={setIsAnomaly}
          selectedModel={selectedModel}
        />

        {/* Tab 1: Reconstruction Explorer (Map + Profile) */}
        {activeTab === 'reconstruction' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
            <OceanMap2D
              data={mapData}
              selectedLat={selectedLat}
              selectedLon={selectedLon}
              onSelectPoint={handleSelectPoint}
              loading={loadingMap}
            />
            <ProfilePanel
              profile={profileData}
              selectedDepth={selectedDepth}
              onDepthSelect={handleSelectDepth}
              loading={loadingProfile}
            />
          </div>
        )}

        {/* Tab 2: 3D Ocean Volume */}
        {activeTab === 'ocean3d' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr)', gap: '1.25rem', alignItems: 'start' }}>
            <OceanVolume3D
              volume={volumeData}
              selectedDepth={selectedDepth}
              onDepthSelect={handleSelectDepth}
              selectedLat={selectedLat}
              selectedLon={selectedLon}
              onPointSelect={handleSelectPoint}
            />
            <ProfilePanel
              profile={profileData}
              selectedDepth={selectedDepth}
              onDepthSelect={handleSelectDepth}
              loading={loadingProfile}
            />
          </div>
        )}

        {/* Tab 3: Dedicated Vertical Profile View */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
            <ProfilePanel
              profile={profileData}
              selectedDepth={selectedDepth}
              onDepthSelect={handleSelectDepth}
              loading={loadingProfile}
            />
            <OceanMap2D
              data={mapData}
              selectedLat={selectedLat}
              selectedLon={selectedLon}
              onSelectPoint={handleSelectPoint}
              loading={loadingMap}
            />
          </div>
        )}

        {/* Tab 4: Model Specifications & Architecture */}
        {activeTab === 'model_info' && (
          <ModelInfoPanel metadata={metadata} />
        )}

        {/* Tab 5: Validation Metrics Placeholder per Section 43 & 45 */}
        {activeTab === 'metrics' && (
          <div className="gov-card">
            <div className="gov-card-header">
              <div className="gov-card-title">
                <BarChart2 size={16} color="#0284c7" />
                <span>Independent Oceanographic Validation</span>
              </div>
              <span className="status-tag">STATUS: VALIDATION PENDING</span>
            </div>
            <div className="gov-card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ maxWidth: '620px', margin: '0 auto' }}>
                <div style={{
                  display: 'inline-flex',
                  padding: '1rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '50%',
                  marginBottom: '1rem'
                }}>
                  <BarChart2 size={36} color="#0284c7" />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2744', marginBottom: '0.6rem' }}>
                  Independent ARGO &amp; GLORYS Validation Pipeline
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  In adherence to the core scientific protocol (Section 45 &amp; 55), empirical validation metrics
                  (RMSE, MAE, correlation, depth-stratified thermal bias) are not fabricated during model development.
                  The full validation suite will be executed once the matched multi-year satellite dataset is harmonized
                  and collocated against INCOIS gridded ARGO CTD float observations.
                </p>
                <div style={{
                  display: 'inline-block',
                  background: '#f1f5f9',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#1e3a5f',
                  border: '1px solid #cbd5e1'
                }}>
                  Scheduled Milestone: Integration Phase 2 (Harmonized Ingestion &amp; ARGO Benchmark)
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #cbd5e1', padding: '1rem 0' }}>
        <div className="portal-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          <div>
            &copy; 2026 Indian National Centre for Ocean Information Services (INCOIS) &middot; Smart India Hackathon
          </div>
          <div>
            OceanEmbed Framework &middot; Deep Learning Subsurface Reconstruction &middot; v0.1.0-dev
          </div>
        </div>
      </footer>
    </div>
  );
}
