'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ReconstructionMapData } from '@/types/reconstruction';
import { MapPin, Maximize2, Compass } from 'lucide-react';

interface OceanMap2DProps {
  data: ReconstructionMapData | null;
  selectedLat: number;
  selectedLon: number;
  onSelectPoint: (lat: number, lon: number) => void;
  loading: boolean;
}

export const OceanMap2D: React.FC<OceanMap2DProps> = ({
  data,
  selectedLat,
  selectedLon,
  onSelectPoint,
  loading,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ lat: number; lon: number; val: number | null } | null>(null);

  // Scientific thermal colormap (cividis/turbo approximation)
  const getColormapColor = (val: number, minVal: number, maxVal: number, isAnomaly: boolean): [number, number, number] => {
    if (isAnomaly) {
      // Diverging blue-white-red palette for anomalies (-2°C to +2°C)
      const norm = Math.max(-1, Math.min(1, val / 2.0));
      if (norm < 0) {
        // Blue to white
        const f = 1 + norm;
        return [Math.round(255 * f), Math.round(255 * f), 255];
      } else {
        // White to red
        const f = 1 - norm;
        return [255, Math.round(255 * f), Math.round(255 * f)];
      }
    }

    // Absolute temperature thermal colormap (dark blue -> cyan -> yellow -> deep red)
    const range = Math.max(0.1, maxVal - minVal);
    const t = Math.max(0, Math.min(1, (val - minVal) / range));
    
    let r = 0, g = 0, b = 0;
    if (t < 0.25) {
      const f = t / 0.25;
      r = Math.round(20 * (1 - f) + 30 * f);
      g = Math.round(30 * (1 - f) + 140 * f);
      b = Math.round(140 * (1 - f) + 210 * f);
    } else if (t < 0.5) {
      const f = (t - 0.25) / 0.25;
      r = Math.round(30 * (1 - f) + 40 * f);
      g = Math.round(140 * (1 - f) + 200 * f);
      b = Math.round(210 * (1 - f) + 110 * f);
    } else if (t < 0.75) {
      const f = (t - 0.5) / 0.25;
      r = Math.round(40 * (1 - f) + 240 * f);
      g = Math.round(200 * (1 - f) + 200 * f);
      b = Math.round(110 * (1 - f) + 40 * f);
    } else {
      const f = (t - 0.75) / 0.25;
      r = Math.round(240 * (1 - f) + 220 * f);
      g = Math.round(200 * (1 - f) + 50 * f);
      b = Math.round(40 * (1 - f) + 30 * f);
    }
    return [r, g, b];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !data.values || data.values.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numRows = data.values.length; // 101 (latitudes 5N to 30N)
    const numCols = data.values[0].length; // 241 (longitudes 45E to 105E)

    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = 460;
    const width = canvas.width;
    const height = canvas.height;

    // Create offscreen image buffer for efficient raster mapping
    const imgData = ctx.createImageData(width, height);
    const buf = imgData.data;

    const minVal = data.stats.min;
    const maxVal = data.stats.max;

    for (let py = 0; py < height; py++) {
      // In cartesian coordinates, top of canvas is max_lat (30N), bottom is min_lat (5N)
      const latFraction = 1.0 - py / height;
      const rowIdx = Math.floor(latFraction * (numRows - 1));

      for (let px = 0; px < width; px++) {
        const lonFraction = px / width;
        const colIdx = Math.floor(lonFraction * (numCols - 1));

        const val = data.values[rowIdx]?.[colIdx];
        const pixelIdx = (py * width + px) * 4;

        if (val === null || val === undefined) {
          // Land cell: Neutral dark charcoal for clean government contrast
          buf[pixelIdx] = 30;
          buf[pixelIdx + 1] = 41;
          buf[pixelIdx + 2] = 59;
          buf[pixelIdx + 3] = 255;
        } else {
          // Ocean cell with thermal colormap
          const [r, g, b] = getColormapColor(val, minVal, maxVal, data.is_anomaly);
          buf[pixelIdx] = r;
          buf[pixelIdx + 1] = g;
          buf[pixelIdx + 2] = b;
          buf[pixelIdx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw coordinate grid lines (every 5° latitude and 10° longitude)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

    // Latitude parallels (5, 10, 15, 20, 25, 30)
    for (let lat = 5; lat <= 30; lat += 5) {
      const y = height - ((lat - 5) / 25) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${lat}°N`, 6, y - 4);
    }

    // Longitude meridians (50, 60, 70, 80, 90, 100)
    for (let lon = 50; lon <= 100; lon += 10) {
      const x = ((lon - 45) / 60) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillText(`${lon}°E`, x + 4, height - 8);
    }

    // Draw Selected Point Marker (Crosshair)
    const pinX = ((selectedLon - 45) / 60) * width;
    const pinY = height - ((selectedLat - 5) / 25) * height;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pinX, pinY, 7, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pinX - 12, pinY);
    ctx.lineTo(pinX + 12, pinY);
    ctx.moveTo(pinX, pinY - 12);
    ctx.lineTo(pinX, pinY + 12);
    ctx.stroke();

    // Pulse point center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pinX, pinY, 3, 0, 2 * Math.PI);
    ctx.fill();

  }, [data, selectedLat, selectedLon]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const lonFraction = px / canvas.width;
    const latFraction = 1.0 - py / canvas.height;

    const clickedLat = 5.0 + latFraction * 25.0;
    const clickedLon = 45.0 + lonFraction * 60.0;

    onSelectPoint(
      Math.round(clickedLat * 4) / 4,
      Math.round(clickedLon * 4) / 4
    );
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !data.values) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const lonFraction = px / canvas.width;
    const latFraction = 1.0 - py / canvas.height;

    const lat = 5.0 + latFraction * 25.0;
    const lon = 45.0 + lonFraction * 60.0;

    const rowIdx = Math.floor(latFraction * (data.values.length - 1));
    const colIdx = Math.floor(lonFraction * (data.values[0].length - 1));
    const val = data.values[rowIdx]?.[colIdx] ?? null;

    setHoverInfo({ lat, lon, val });
  };

  return (
    <div className="gov-card">
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Compass size={16} color="#0284c7" />
          <span>
            2D Ocean Horizontal Slice &mdash; Depth: {data?.actual_depth_m ?? 0}m
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
          <span style={{ color: '#475569' }}>
            Domain: 5°N&ndash;30°N, 45°E&ndash;105°E
          </span>
          <span style={{ fontWeight: 600, color: '#0f2744' }}>
            Selected: {selectedLat.toFixed(2)}°N, {selectedLon.toFixed(2)}°E
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', padding: '0.75rem 0.75rem 0.5rem' }}>
        <div className="canvas-map-container" style={{ height: '460px' }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
          />

          {/* Hover Readout Overlay */}
          {hoverInfo && (
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(15, 39, 68, 0.92)',
              color: '#ffffff',
              padding: '0.4rem 0.75rem',
              borderRadius: '3px',
              fontSize: '0.75rem',
              pointerEvents: 'none',
              border: '1px solid #38bdf8',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}>
              <div><strong>Coords:</strong> {hoverInfo.lat.toFixed(2)}°N, {hoverInfo.lon.toFixed(2)}°E</div>
              <div>
                <strong>Temperature:</strong>{' '}
                {hoverInfo.val !== null ? `${hoverInfo.val.toFixed(2)} °C` : 'Land'}
              </div>
            </div>
          )}

          {/* Map Status Tag */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#f8fafc',
            padding: '0.3rem 0.6rem',
            borderRadius: '3px',
            fontSize: '0.7rem',
            border: '1px solid #334155'
          }}>
            Click anywhere on ocean to inspect vertical profile &bull; Arabian Sea / Bay of Bengal
          </div>
        </div>

        {/* Scientific Colorbar */}
        <div style={{
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0 0.5rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', minWidth: '95px' }}>
            {data?.is_anomaly ? 'Anomaly (°C):' : 'Temperature (°C):'}
          </span>

          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
            {data?.stats.min ?? 0}°C
          </span>

          <div style={{
            flex: 1,
            height: '14px',
            borderRadius: '2px',
            border: '1px solid #cbd5e1',
            background: data?.is_anomaly
              ? 'linear-gradient(to right, #0055ff, #ffffff, #ff0000)'
              : 'linear-gradient(to right, #141e8c, #1e8cd2, #28c86e, #f0c828, #dc321e)'
          }} />

          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
            {data?.stats.max ?? 30}°C
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '1rem' }}>
            <div style={{ width: '12px', height: '12px', background: '#1e293b', border: '1px solid #475569' }} />
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Land Mask</span>
          </div>
        </div>
      </div>
    </div>
  );
};
