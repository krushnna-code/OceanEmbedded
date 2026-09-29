'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { ReconstructionControls } from '@/components/controls/ReconstructionControls';
import { OceanMap2D } from '@/components/map/OceanMap2D';
import { ProfilePanel } from '@/components/profile/ProfilePanel';
import { OceanVolume3D } from '@/components/ocean3d/OceanVolume3D';
import { ModelInfoPanel } from '@/components/info/ModelInfoPanel';
import { MHWPanel } from '@/components/mhw/MHWPanel';
import { ValidationMetricsPanel } from '@/components/metrics/ValidationMetricsPanel';
import { CycloneHeatPanel } from '@/components/cyclone/CycloneHeatPanel';

import {
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
  fetchVolume3D,
  getBackendStatus
} from '@/lib/api/reconstruction';

import { ShieldAlert, Compass, Sparkles, HelpCircle } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('reconstruction');
  const [dates, setDates] = useState<string[]>([
    '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13',
    '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17'
  ]);
  const [depths, setDepths] = useState<number[]>([0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]);

  const [selectedDate, setSelectedDate] = useState<string>('2026-03-10');
  const [selectedDepth, setSelectedDepth] = useState<number>(100.0);
  const [selectedLat, setSelectedLat] = useState<number>(12.50);
  const [selectedLon, setSelectedLon] = useState<number>(82.25);
  const [isAnomaly, setIsAnomaly] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('oceanembed-3d-v1');
  const [showUncertainty, setShowUncertainty] = useState<boolean>(false);
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
  const [regionNotification, setRegionNotification] = useState<string | null>(null);

  // Loaded Data
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [mapData, setMapData] = useState<ReconstructionMapData | null>(null);
  const [profileData, setProfileData] = useState<VerticalProfileData | null>(null);
  const [volumeData, setVolumeData] = useState<Volume3DData | null>(null);

  const [loadingMap, setLoadingMap] = useState<boolean>(false);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [loadingVolume, setLoadingVolume] = useState<boolean>(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);

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
        setBackendAvailable(getBackendStatus());
      } catch (err) {
        console.warn('Backend unavailable, using resilient simulation state:', err);
      }
    }
    init();
  }, []);

  // Fetch 2D Map Data on Date, Depth, or Anomaly change
  useEffect(() => {
    async function loadMap() {
      setLoadingMap(true);
      try {
        const data = await fetchReconstructionMap(selectedDate, selectedDepth, selectedModel, isAnomaly);
        setMapData(data);
        setBackendAvailable(getBackendStatus());
      } catch (err) {
        console.error('Error fetching map:', err);
      } finally {
        setLoadingMap(false);
      }
    }
    loadMap();
  }, [selectedDate, selectedDepth, selectedModel, isAnomaly]);

  // Fetch Vertical Profile Data on Coordinate or Date change
  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true);
      try {
        const data = await fetchVerticalProfile(selectedLat, selectedLon, selectedDate, selectedModel);
        setProfileData(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [selectedLat, selectedLon, selectedDate, selectedModel]);

  // Fetch 3D Volume Data on Date change
  useEffect(() => {
    async function loadVolume() {
      setLoadingVolume(true);
      try {
        const data = await fetchVolume3D(selectedDate, selectedModel, 4);
        setVolumeData(data);
      } catch (err) {
        console.error('Error fetching 3D volume:', err);
      } finally {
        setLoadingVolume(false);
      }
    }
    loadVolume();
  }, [selectedDate, selectedModel]);

  // Synchronized point selection handler
  const handleSelectPoint = (lat: number, lon: number) => {
    setSelectedLat(lat);
    setSelectedLon(lon);
  };

  // Synchronized depth selection handler
  const handleSelectDepth = (depth: number) => {
    setSelectedDepth(depth);
  };

  // Quick region jump handler
  const handleSelectRegion = (lat: number, lon: number, name: string) => {
    setSelectedLat(lat);
    setSelectedLon(lon);
    setRegionNotification(`Focused on ${name} (${lat}°N, ${lon}°E)`);
    setTimeout(() => setRegionNotification(null), 3500);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} isLiveBackend={backendAvailable} />

      <main className="portal-container" style={{ flex: 1, padding: '1.25rem 1.5rem 2.5rem' }}>
        
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
          showUncertainty={showUncertainty}
          onShowUncertaintyChange={setShowUncertainty}
          showStreamlines={showStreamlines}
          onToggleStreamlines={setShowStreamlines}
          onSelectRegion={handleSelectRegion}
        />

        {/* Region focus toast notification */}
        {regionNotification && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.9) 0%, rgba(13, 242, 201, 0.8) 100%)',
            color: '#ffffff',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <Sparkles size={16} />
            <span>{regionNotification}</span>
          </div>
        )}

        {/* Tab 1: Reconstruction Explorer (2D Map + Vertical Profile) */}
        {activeTab === 'reconstruction' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
            <OceanMap2D
              data={mapData}
              selectedLat={selectedLat}
              selectedLon={selectedLon}
              onSelectPoint={handleSelectPoint}
              loading={loadingMap}
              showUncertainty={showUncertainty}
              showStreamlines={showStreamlines}
            />
            <ProfilePanel
              profile={profileData}
              selectedDepth={selectedDepth}
              onDepthSelect={handleSelectDepth}
              loading={loadingProfile}
            />
          </div>
        )}

        {/* Tab 2: 3D Ocean Volume WebGL */}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.3fr)', gap: '1.25rem', alignItems: 'start' }}>
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
              showUncertainty={showUncertainty}
              showStreamlines={showStreamlines}
            />
          </div>
        )}

        {/* Tab 4: Uncertainty Explorer per Gaussian NLL Head */}
        {activeTab === 'uncertainty' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(147, 51, 234, 0.12)',
              border: '1px solid rgba(192, 132, 252, 0.35)',
              borderRadius: '10px',
              padding: '1rem 1.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: '0 0 20px rgba(147, 51, 234, 0.15)'
            }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e9d5ff', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HelpCircle size={16} color="#c084fc" />
                  <span>Heteroscedastic Uncertainty Head &mdash; Predicted &sigma;(x, y, z)</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#d8b4fe', margin: 0 }}>
                  Live Gaussian NLL log-variance dispersion estimator modeling aleatoric ocean noise and spatial gradient sensitivity.
                </p>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                color: '#ffffff',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 12px rgba(147, 51, 234, 0.4)'
              }}>
                NLL Dispersion Active
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'start' }}>
              <OceanMap2D
                data={mapData}
                selectedLat={selectedLat}
                selectedLon={selectedLon}
                onSelectPoint={handleSelectPoint}
                loading={loadingMap}
                showUncertainty={true}
                showStreamlines={showStreamlines}
              />
              <ProfilePanel
                profile={profileData}
                selectedDepth={selectedDepth}
                onDepthSelect={handleSelectDepth}
                loading={loadingProfile}
              />
            </div>
          </div>
        )}

        {/* Tab 5: Marine Heatwave (MHW) Monitoring Phase 2 */}
        {activeTab === 'mhw' && (
          <MHWPanel selectedDate={selectedDate} depths={depths} />
        )}

        {/* Tab 6: Cyclone Heat-Content Diagnostic Tool */}
        {activeTab === 'cyclone' && (
          <CycloneHeatPanel selectedDate={selectedDate} />
        )}

        {/* Tab 7: Independent Validation Metrics Dashboard */}
        {activeTab === 'metrics' && (
          <ValidationMetricsPanel />
        )}

        {/* Tab 8: Model Specifications & Architecture */}
        {activeTab === 'model_info' && (
          <ModelInfoPanel metadata={metadata} />
        )}
      </main>

      {/* Cyber-Oceanic Footer */}
      <footer style={{
        background: 'rgba(5, 10, 20, 0.95)',
        borderTop: '1px solid rgba(56, 189, 248, 0.12)',
        padding: '1.25rem 0',
        marginTop: 'auto'
      }}>
        <div className="portal-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#64748b' }}>
          <div>
            &copy; 2026 Indian National Centre for Ocean Information Services (INCOIS) &middot; Ministry of Earth Sciences &middot; Smart India Hackathon
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#38bdf8' }}>OceanEmbed Framework v0.3.0</span>
            <span>&middot;</span>
            <span>Dual-GNN ConvLSTM Cross-Attention Depth Decoder</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
