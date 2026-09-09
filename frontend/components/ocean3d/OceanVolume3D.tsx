'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Volume3DData } from '@/types/reconstruction';
import { Layers, Eye, RotateCw, ZoomIn, Compass, Sliders, Scissors } from 'lucide-react';

interface OceanVolume3DProps {
  volume: Volume3DData | null;
  selectedDepth: number;
  onDepthSelect: (depth: number) => void;
  selectedLat: number;
  selectedLon: number;
  onPointSelect: (lat: number, lon: number) => void;
}

export const OceanVolume3D: React.FC<OceanVolume3DProps> = ({
  volume,
  selectedDepth,
  onDepthSelect,
  selectedLat,
  selectedLon,
  onPointSelect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  const [viewMode, setViewMode] = useState<'all_layers' | 'single_slice' | 'cross_section'>('all_layers');
  const [crossSectionAxis, setCrossSectionAxis] = useState<'lat' | 'lon'>('lat');
  const [crossSectionLat, setCrossSectionLat] = useState<number>(12.5);
  const [crossSectionLon, setCrossSectionLon] = useState<number>(82.25);
  const [showWireframe, setShowWireframe] = useState<boolean>(true);

  // Mouse interaction state for manual orbit control
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.5, y: -0.6 });
  const zoomRef = useRef(14);

  // Thermal colormap helper
  const getColormapColor = (tNorm: number): THREE.Color => {
    // 0 = 4°C (deep ocean blue), 1 = 30°C (warm red)
    const color = new THREE.Color();
    if (tNorm < 0.25) {
      color.setRGB(0.1, 0.2 + tNorm * 2, 0.8);
    } else if (tNorm < 0.5) {
      color.setRGB(0.1, 0.7 + (tNorm - 0.25) * 1.2, 0.8 - (tNorm - 0.25) * 2);
    } else if (tNorm < 0.75) {
      color.setRGB(0.2 + (tNorm - 0.5) * 3, 0.9, 0.2);
    } else {
      color.setRGB(0.95, 0.9 - (tNorm - 0.75) * 3, 0.1);
    }
    return color;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b14');
    sceneRef.current = scene;

    // 2. Camera setup
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, zoomRef.current);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // 5. Volume Object Group
    const group = new THREE.Group();
    scene.add(group);
    meshGroupRef.current = group;

    // 6. Draw Bounding Box & Depth Axis Exaggeration Grid
    // North Indian Ocean dimensions: X: 45 to 105 (width=6), Y: 5 to 30 (depth=2.5), Z: 0 to 1000m (height=3.5 exaggerated)
    const boxGeo = new THREE.BoxGeometry(7, 3.5, 3.5);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 1 }));
    boxLine.position.set(0, 0, 0);
    group.add(boxLine);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (group) {
        group.rotation.x = rotationRef.current.x;
        group.rotation.y = rotationRef.current.y;
      }
      if (camera) {
        camera.position.z = zoomRef.current;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Mouse Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      rotationRef.current.y += deltaX * 0.008;
      rotationRef.current.x += deltaY * 0.008;

      // Restrict vertical rotation angle
      rotationRef.current.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotationRef.current.x));

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.max(6, Math.min(30, zoomRef.current + e.deltaY * 0.015));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update 3D ocean data layers whenever volume data or viewing mode changes
  useEffect(() => {
    const group = meshGroupRef.current;
    if (!group || !volume || !volume.slices || volume.slices.length === 0) return;

    // Clear previous layer meshes while preserving outer bounding frame
    while (group.children.length > 1) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
    }

    const { slices, depths_m, dimensions } = volume;
    const numLats = dimensions.latitudes;
    const numLons = dimensions.longitudes;

    const boxWidth = 7.0;  // Longitude axis (45E to 105E)
    const boxDepth = 3.5;  // Latitude axis (5N to 30N)
    const boxHeight = 3.5; // Depth axis (0m to 1000m)

    // Helper: Map depth in meters to 3D Y coordinate (0m at top: +1.75, 1000m at bottom: -1.75)
    const getDepthY = (depthMeters: number): number => {
      // Square root scaling for visual clarity of upper layers
      const frac = Math.sqrt(depthMeters) / Math.sqrt(1000);
      return 1.75 - frac * boxHeight;
    };

    if (viewMode === 'all_layers' || viewMode === 'single_slice') {
      slices.forEach((slice, idx) => {
        const depthM = slice.depth_m;
        if (viewMode === 'single_slice' && depthM !== selectedDepth) return;

        const isSelected = depthM === selectedDepth;
        const layerY = getDepthY(depthM);

        // Build plane mesh for this depth slice
        const geometry = new THREE.PlaneGeometry(boxWidth, boxDepth, numLons - 1, numLats - 1);
        geometry.rotateX(-Math.PI / 2); // Orient horizontally

        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 3);

        const posAttr = geometry.attributes.position;
        for (let i = 0; i < count; i++) {
          // Normalize grid coordinates to row/col
          const x = posAttr.getX(i);
          const z = posAttr.getZ(i);

          const lonFrac = (x + boxWidth / 2) / boxWidth;
          const latFrac = (z + boxDepth / 2) / boxDepth;

          const col = Math.min(numLons - 1, Math.max(0, Math.floor(lonFrac * numLons)));
          const row = Math.min(numLats - 1, Math.max(0, Math.floor(latFrac * numLats)));

          const val = slice.values[row]?.[col];

          if (val === null || val === undefined) {
            // Land cell: dark muted slate
            colors[i * 3] = 0.08;
            colors[i * 3 + 1] = 0.12;
            colors[i * 3 + 2] = 0.18;
          } else {
            // Temperature mapping (4°C deep ocean to 30°C warm surface)
            const tNorm = Math.max(0, Math.min(1, (val - 4.0) / 26.0));
            const c = getColormapColor(tNorm);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
          }
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelected ? 0.95 : viewMode === 'all_layers' ? 0.35 : 0.9,
          wireframe: showWireframe && isSelected,
          roughness: 0.6
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = layerY;
        group.add(mesh);
      });
    } else if (viewMode === 'cross_section') {
      // Vertical Curtain Cross-Section along constant Latitude or Longitude
      const numDepths = depths_m.length;

      if (crossSectionAxis === 'lat') {
        // Vertical curtain at fixed latitude spanning all longitudes (45E to 105E) and depths (0 to 1000m)
        const latFrac = (crossSectionLat - 5.0) / 25.0;
        const curZ = (latFrac - 0.5) * boxDepth;

        const curtainGeo = new THREE.PlaneGeometry(boxWidth, boxHeight, numLons - 1, numDepths - 1);
        const count = curtainGeo.attributes.position.count;
        const colors = new Float32Array(count * 3);

        const latIdx = Math.min(numLats - 1, Math.max(0, Math.floor(latFrac * numLats)));

        for (let i = 0; i < count; i++) {
          const x = curtainGeo.attributes.position.getX(i);
          const y = curtainGeo.attributes.position.getY(i);

          const lonFrac = (x + boxWidth / 2) / boxWidth;
          const dFrac = 1.0 - (y + boxHeight / 2) / boxHeight; // 0 at top, 1 at bottom

          const col = Math.min(numLons - 1, Math.max(0, Math.floor(lonFrac * numLons)));
          const dIdx = Math.min(numDepths - 1, Math.max(0, Math.floor(dFrac * numDepths)));

          const val = slices[dIdx]?.values[latIdx]?.[col];
          if (val === null || val === undefined) {
            colors[i * 3] = 0.08;
            colors[i * 3 + 1] = 0.12;
            colors[i * 3 + 2] = 0.18;
          } else {
            const tNorm = Math.max(0, Math.min(1, (val - 4.0) / 26.0));
            const c = getColormapColor(tNorm);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
          }
        }

        curtainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: 0.5
        });
        const curtainMesh = new THREE.Mesh(curtainGeo, mat);
        curtainMesh.position.z = curZ;
        group.add(curtainMesh);
      }
    }

    // Add 3D Coordinate Probe Marker at (selectedLat, selectedLon, selectedDepth)
    const pinX = ((selectedLon - 45) / 60 - 0.5) * boxWidth;
    const pinZ = ((selectedLat - 5) / 25 - 0.5) * boxDepth;
    const pinY = getDepthY(selectedDepth);

    const probeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const probeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const probeMesh = new THREE.Mesh(probeGeo, probeMat);
    probeMesh.position.set(pinX, pinY, pinZ);
    group.add(probeMesh);

    // Vertical dashed probe line through water column
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pinX, 1.75, pinZ),
      new THREE.Vector3(pinX, -1.75, pinZ)
    ]);
    const lineMat = new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.15, gapSize: 0.1 });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    group.add(line);

  }, [volume, viewMode, selectedDepth, crossSectionAxis, crossSectionLat, crossSectionLon, selectedLat, selectedLon, showWireframe]);

  const resetView = () => {
    rotationRef.current = { x: 0.5, y: -0.6 };
    zoomRef.current = 14;
  };

  return (
    <div className="gov-card">
      <div className="gov-card-header">
        <div className="gov-card-title">
          <Layers size={16} color="#0284c7" />
          <span>Interactive 3D Subsurface Ocean Volume (WebGL)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
            &ldquo;Depth axis visually exaggerated&rdquo;
          </span>
          <button
            onClick={resetView}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.6rem',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#1e293b'
            }}
          >
            <RotateCw size={12} />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* 3D Mode Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.6rem',
          background: '#f8fafc',
          padding: '0.5rem 0.75rem',
          border: '1px solid #e2e8f0',
          borderRadius: '3px'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>3D Visualization Mode:</span>
            <button
              onClick={() => setViewMode('all_layers')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '3px',
                border: '1px solid #cbd5e1',
                background: viewMode === 'all_layers' ? '#0284c7' : '#ffffff',
                color: viewMode === 'all_layers' ? '#ffffff' : '#334155'
              }}
            >
              15 Depth Layers
            </button>
            <button
              onClick={() => setViewMode('single_slice')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '3px',
                border: '1px solid #cbd5e1',
                background: viewMode === 'single_slice' ? '#0284c7' : '#ffffff',
                color: viewMode === 'single_slice' ? '#ffffff' : '#334155'
              }}
            >
              Single Slice ({selectedDepth}m)
            </button>
            <button
              onClick={() => setViewMode('cross_section')}
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '3px',
                border: '1px solid #cbd5e1',
                background: viewMode === 'cross_section' ? '#0284c7' : '#ffffff',
                color: viewMode === 'cross_section' ? '#ffffff' : '#334155'
              }}
            >
              Vertical Cross-Section
            </button>
          </div>

          {/* Cross-section controls */}
          {viewMode === 'cross_section' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>Curtain Latitude:</span>
              <input
                type="range"
                min="5.0"
                max="25.0"
                step="0.5"
                value={crossSectionLat}
                onChange={(e) => setCrossSectionLat(parseFloat(e.target.value))}
                style={{ width: '120px' }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f2744' }}>
                {crossSectionLat.toFixed(1)}°N
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
              />
              <span>Mesh Wireframe</span>
            </label>
          </div>
        </div>

        {/* 3D WebGL Canvas Viewport */}
        <div ref={containerRef} className="three-canvas-container" style={{ height: '480px' }}>
          {/* Instructions Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(7, 11, 20, 0.85)',
            color: '#94a3b8',
            padding: '0.4rem 0.75rem',
            borderRadius: '3px',
            fontSize: '0.7rem',
            border: '1px solid #1e293b',
            pointerEvents: 'none'
          }}>
            <div><strong>Orbit Controls:</strong> Click + Drag to Rotate &bull; Scroll to Zoom</div>
            <div><strong>Synchronized Probe:</strong> Lat: {selectedLat.toFixed(2)}°N, Lon: {selectedLon.toFixed(2)}°E, Depth: {selectedDepth}m</div>
          </div>

          {/* Axis Guide */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(7, 11, 20, 0.85)',
            color: '#38bdf8',
            padding: '0.35rem 0.65rem',
            borderRadius: '3px',
            fontSize: '0.7rem',
            border: '1px solid #1e293b',
            pointerEvents: 'none'
          }}>
            <div>X: Longitude (45°E &rarr; 105°E)</div>
            <div>Z: Latitude (5°N &rarr; 30°N)</div>
            <div>Y: Depth (0m &rarr; 1000m, visually exaggerated)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
