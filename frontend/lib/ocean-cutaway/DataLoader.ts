/**
 * DataLoader.ts — Fetch metadata + binary ocean data from the integrated backend.
 *
 * Adapted from sih_apraxia/frontend/src/DataLoader.ts for use within the
 * Next.js frontend. Fetches through the /api-backend proxy rewrite.
 */

const API_BASE = '/api-backend/api/ocean3d-cutaway';

/** Metadata shape matching the backend's metadata.json */
export interface OceanMetadata {
  variable: string;
  long_name: string;
  units: string;
  time: string;
  depth_positive: string;
  longitude: { count: number; min: number; max: number };
  latitude: { count: number; min: number; max: number };
  depth: { count: number; min: number; max: number; values: number[] };
  dimensions: { longitude: number; latitude: number; depth: number };
  temperature: { min: number; max: number; mean: number; fill_value: number };
  downsample_factor: number;
  source: string;
  region: string;
  binary_layout: {
    order: string[];
    longitude_bytes: number;
    latitude_bytes: number;
    depth_bytes: number;
    temperature_bytes: number;
    mask_bytes: number;
    temperature_index: string;
  };
}

/** Parsed binary data ready for Three.js */
export interface OceanData {
  longitude: Float32Array;
  latitude: Float32Array;
  depth: Float32Array;
  /** 3D temperature array, row-major: [depthIdx][latIdx][lonIdx] */
  temperature: Float32Array;
  /** 3D mask array, row-major: [depthIdx][latIdx][lonIdx]. 1=ocean, 0=land/missing */
  mask: Uint8Array;
}

export async function loadMetadata(
  onStatus?: (msg: string) => void
): Promise<OceanMetadata> {
  onStatus?.('Fetching metadata…');
  const res = await fetch(`${API_BASE}/metadata`);
  if (!res.ok) throw new Error(`Metadata request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function loadBinaryData(
  meta: OceanMetadata,
  onStatus?: (msg: string) => void
): Promise<OceanData> {
  onStatus?.('Downloading ocean data…');
  const res = await fetch(`${API_BASE}/data`);
  if (!res.ok) throw new Error(`Data request failed: ${res.status} ${res.statusText}`);

  const buf = await res.arrayBuffer();

  const nlon = meta.dimensions.longitude;
  const nlat = meta.dimensions.latitude;
  const ndepth = meta.dimensions.depth;
  const volumeSize = ndepth * nlat * nlon;

  // Parse binary layout: [lon f32][lat f32][depth f32][temp f32 3D][mask u8 3D]
  let offset = 0;

  const longitude = new Float32Array(buf, offset, nlon);
  offset += nlon * 4;

  const latitude = new Float32Array(buf, offset, nlat);
  offset += nlat * 4;

  const depth = new Float32Array(buf, offset, ndepth);
  offset += ndepth * 4;

  const temperature = new Float32Array(buf, offset, volumeSize);
  offset += volumeSize * 4;

  const mask = new Uint8Array(buf, offset, volumeSize);

  onStatus?.('Building visualization…');

  return { longitude, latitude, depth, temperature, mask };
}
