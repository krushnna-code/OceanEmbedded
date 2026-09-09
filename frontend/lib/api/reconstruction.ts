/**
 * Typed API Client for OceanEmbed Backend.
 * Connects frontend Next.js interface to FastAPI REST endpoints.
 */

import {
  ConfigData,
  ModelMetadata,
  ReconstructionMapData,
  VerticalProfileData,
  Volume3DData,
  MetricsData,
  MHWData
} from '@/types/reconstruction';

// Prefer relative proxy /api-backend (which rewrites to http://localhost:8000), fallback to direct origin
const API_BASE = '/api-backend/api';

export async function fetchConfig(): Promise<ConfigData> {
  const res = await fetch(`${API_BASE}/config`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch configuration: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchModelMetadata(modelId?: string): Promise<ModelMetadata> {
  const url = modelId ? `${API_BASE}/model/${modelId}` : `${API_BASE}/models`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch model metadata: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchReconstructionMap(
  date?: string,
  depth: number = 0.0,
  model: string = 'oceanembed-3d-v1',
  isAnomaly: boolean = false
): Promise<ReconstructionMapData> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  params.append('depth', depth.toString());
  params.append('model', model);
  params.append('is_anomaly', isAnomaly.toString());

  const res = await fetch(`${API_BASE}/reconstruction?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch reconstruction map: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchVerticalProfile(
  lat: number = 12.50,
  lon: number = 82.25,
  date?: string,
  model: string = 'oceanembed-3d-v1'
): Promise<VerticalProfileData> {
  const params = new URLSearchParams();
  params.append('lat', lat.toString());
  params.append('lon', lon.toString());
  if (date) params.append('date', date);
  params.append('model', model);

  const res = await fetch(`${API_BASE}/profile?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch vertical profile: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchVolume3D(
  date?: string,
  model: string = 'oceanembed-3d-v1',
  downsample: number = 4
): Promise<Volume3DData> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  params.append('model', model);
  params.append('downsample', downsample.toString());

  const res = await fetch(`${API_BASE}/volume?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch 3D volume: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMetrics(): Promise<MetricsData> {
  const res = await fetch(`${API_BASE}/metrics`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch metrics: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMHWData(
  date?: string,
  depth: number = 0.0,
  model: string = 'oceanembed-3d-v1'
): Promise<MHWData> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  params.append('depth', depth.toString());
  params.append('model', model);

  const res = await fetch(`${API_BASE}/mhw?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch MHW analysis: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

