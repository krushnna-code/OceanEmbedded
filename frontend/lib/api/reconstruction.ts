/**
 * Typed API Client for OceanEmbed Backend with Resilient Simulation Fallback.
 * Connects frontend Next.js interface to FastAPI REST endpoints with seamless
 * fallback to high-fidelity oceanographic simulation when offline.
 */

import {
  ConfigData,
  ModelMetadata,
  ReconstructionMapData,
  VerticalProfileData,
  Volume3DData,
  MetricsData,
  MHWData,
  TCHCData
} from '@/types/reconstruction';

import {
  generateMockConfig,
  generateMockMetadata,
  generateMockReconstructionMap,
  generateMockVerticalProfile,
  generateMockVolume3D,
  generateMockMetrics,
  generateMockMHWData,
  generateMockTCHCData
} from './mockData';

const API_BASE = '/api-backend/api';

// Tracks whether the live Python backend is actively responding
let isBackendLive: boolean = false;
export function getBackendStatus(): boolean {
  return isBackendLive;
}

export async function fetchConfig(): Promise<ConfigData> {
  try {
    const res = await fetch(`${API_BASE}/config`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  isBackendLive = false;
  return generateMockConfig();
}

export async function fetchModelMetadata(modelId?: string): Promise<ModelMetadata> {
  try {
    const url = modelId ? `${API_BASE}/model/${modelId}` : `${API_BASE}/models`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockMetadata();
}

export async function fetchReconstructionMap(
  date?: string,
  depth: number = 0.0,
  model: string = 'oceanembed-3d-v1',
  isAnomaly: boolean = false
): Promise<ReconstructionMapData> {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('depth', depth.toString());
    params.append('model', model);
    params.append('is_anomaly', isAnomaly.toString());

    const res = await fetch(`${API_BASE}/reconstruction?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockReconstructionMap(date, depth, isAnomaly);
}

export async function fetchVerticalProfile(
  lat: number = 12.50,
  lon: number = 82.25,
  date?: string,
  model: string = 'oceanembed-3d-v1'
): Promise<VerticalProfileData> {
  try {
    const params = new URLSearchParams();
    params.append('lat', lat.toString());
    params.append('lon', lon.toString());
    if (date) params.append('date', date);
    params.append('model', model);

    const res = await fetch(`${API_BASE}/profile?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockVerticalProfile(lat, lon, date);
}

export async function fetchVolume3D(
  date?: string,
  model: string = 'oceanembed-3d-v1',
  downsample: number = 4
): Promise<Volume3DData> {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('model', model);
    params.append('downsample', downsample.toString());

    const res = await fetch(`${API_BASE}/volume?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockVolume3D(date, downsample);
}

export async function fetchMetrics(): Promise<MetricsData> {
  try {
    const res = await fetch(`${API_BASE}/metrics`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockMetrics();
}

export async function fetchMHWData(
  date?: string,
  depth: number = 0.0,
  model: string = 'oceanembed-3d-v1'
): Promise<MHWData> {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('depth', depth.toString());
    params.append('model', model);

    const res = await fetch(`${API_BASE}/mhw?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockMHWData(date, depth);
}

export async function fetchTCHCData(
  date?: string,
  model: string = 'oceanembed-3d-v1'
): Promise<TCHCData> {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    params.append('model', model);

    const res = await fetch(`${API_BASE}/tchc?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      isBackendLive = true;
      return await res.json();
    }
  } catch {
    // Backend offline; use fallback
  }
  return generateMockTCHCData(date);
}
