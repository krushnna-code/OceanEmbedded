'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadMetadata, loadBinaryData, OceanMetadata, OceanData } from '@/lib/ocean-cutaway/DataLoader';
import { OceanModel } from '@/lib/ocean-cutaway/OceanModel';
import { BlockManager } from '@/lib/ocean-cutaway/BlockManager';
import { ChevronLeft, ChevronRight, Maximize, AlertCircle } from 'lucide-react';

export const OceanCutaway3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('Connecting to server');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Master Data
  const metaRef = useRef<OceanMetadata | null>(null);
  const dataRef = useRef<OceanData | null>(null);
  const blockManagerRef = useRef<BlockManager | null>(null);
  const oceanModelRef = useRef<OceanModel | null>(null);

  // UI State
  const [currentBlock, setCurrentBlock] = useState<number | 'all'>(1);
  const [totalBlocks, setTotalBlocks] = useState<number>(0);
  const [statusTitle, setStatusTitle] = useState<string>('');
  const [statusSubtitle, setStatusSubtitle] = useState<string>('');
  const [badgeText, setBadgeText] = useState<string>('');
  const [infoDetails, setInfoDetails] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // Three.js setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // transparent background to blend with page
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const { clientWidth, clientHeight } = containerRef.current;
    renderer.setSize(clientWidth, clientHeight);
    renderer.setClearColor(0x06111f, 0.85); // dark theme background
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 200);
    camera.position.set(12, 8, 10);
    camera.lookAt(0, -1.5, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.update();

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Load Data
    let mounted = true;
    const initData = async () => {
      try {
        setLoadingStatus('Fetching metadata…');
        const meta = await loadMetadata((msg) => { if(mounted) setLoadingStatus(msg); });
        
        if (!mounted) return;
        setLoadingStatus('Downloading ocean data…');
        const data = await loadBinaryData(meta, (msg) => { if(mounted) setLoadingStatus(msg); });
        
        if (!mounted) return;
        setLoadingStatus('Building visualization…');

        metaRef.current = meta;
        dataRef.current = data;
        
        const bm = new BlockManager(meta, data);
        blockManagerRef.current = bm;
        setTotalBlocks(bm.totalBlocks);

        const model = new OceanModel(meta, data);
        model.build(1, bm);
        oceanModelRef.current = model;
        scene.add(model.group);

        const latMax = Math.min(30, meta.latitude.max);
        const lonMin = Math.max(45, Math.round(meta.longitude.min / 15) * 15);
        const lonMax = Math.min(105, Math.round(meta.longitude.max / 15) * 15);
        const resolution = (0.25 * meta.downsample_factor).toFixed(2);
        
        setInfoDetails(`${latMax.toFixed(0)}°N, ${lonMin}°E – ${lonMax}°E | Depth: ${meta.depth.min.toFixed(0)}–${meta.depth.max.toFixed(0)} m (${meta.depth.count} levels) | Res: ${resolution}°`);

        // Select initial block
        if (mounted) {
          handleSelectBlock(1, model, bm);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          console.error('Failed to init OceanCutaway3D:', err);
          setErrorMsg(err.message || 'Unknown error occurred');
          setIsLoading(false);
        }
      }
    };
    initData();

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      if (oceanModelRef.current) oceanModelRef.current.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSelectBlock = (target: number | 'all', model = oceanModelRef.current, bm = blockManagerRef.current) => {
    if (!model || !bm) return;
    setCurrentBlock(target);

    model.renderBlock(target, bm);

    const info = bm.formatSingleBlock(target);
    setStatusTitle(info.title);
    setStatusSubtitle(info.subtitle);
    setBadgeText(info.badge);
  };

  const handlePrev = () => {
    if (currentBlock === 'all') handleSelectBlock(totalBlocks);
    else handleSelectBlock(currentBlock <= 1 ? totalBlocks : currentBlock - 1);
  };

  const handleNext = () => {
    if (currentBlock === 'all') handleSelectBlock(1);
    else handleSelectBlock(currentBlock >= totalBlocks ? 1 : currentBlock + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      handleSelectBlock(Math.max(1, Math.min(totalBlocks, val)));
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '700px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.2)', background: '#06111f' }}>
      
      {/* 3D Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

      {/* Loading Overlay */}
      {isLoading && !errorMsg && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6, 17, 31, 0.9)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', margin: '0 auto 16px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#e0e8f0', fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>Loading ocean data…</div>
            <div style={{ color: '#8899aa', fontSize: '0.8rem', fontFamily: 'monospace' }}>{loadingStatus}</div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6, 17, 31, 0.95)' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '1.2rem', marginBottom: '8px' }}>Failed to load ocean data</div>
            <div style={{ color: '#8899aa', fontSize: '0.85rem', fontFamily: 'monospace' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div style={{ position: 'absolute', top: '24px', left: '24px', pointerEvents: 'none', zIndex: 10, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e0e8f0', margin: 0 }}>Ocean Model</h1>
        <p style={{ fontSize: '0.85rem', color: '#e0e8f0', margin: '4px 0 8px' }}>Temperature (°C)</p>
        <div style={{ fontSize: '0.75rem', color: '#e0e8f0', opacity: 0.9, lineHeight: 1.5 }}>
          {infoDetails.split(' | ').map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>

      {/* Filter Panel */}
      <div style={{ position: 'absolute', top: '130px', left: '24px', zIndex: 10, width: '290px', background: 'rgba(10, 14, 30, 0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(100, 140, 200, 0.2)', borderRadius: '10px', padding: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e0e8f0' }}>Spatial Block</span>
          <span style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.3)', fontFamily: 'monospace' }}>
            {badgeText || `${totalBlocks} Blocks`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
          <button onClick={handlePrev} style={{ background: 'rgba(100, 140, 200, 0.15)', border: '1px solid rgba(100, 140, 200, 0.3)', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e8f0', cursor: 'pointer' }}>
            <ChevronLeft size={16} />
          </button>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(100, 140, 200, 0.2)', borderRadius: '6px', padding: '2px 8px' }}>
            <span style={{ fontSize: '0.6rem', color: '#8899aa', textTransform: 'uppercase' }}>Block</span>
            <input 
              type="number" 
              min={1} 
              max={totalBlocks}
              value={currentBlock === 'all' ? '' : currentBlock}
              onChange={handleInputChange}
              style={{ background: 'transparent', border: 'none', color: '#e0e8f0', fontSize: '0.9rem', outline: 'none', width: '100%' }}
            />
          </div>

          <button onClick={handleNext} style={{ background: 'rgba(100, 140, 200, 0.15)', border: '1px solid rgba(100, 140, 200, 0.3)', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e0e8f0', cursor: 'pointer' }}>
            <ChevronRight size={16} />
          </button>

          <button onClick={() => handleSelectBlock('all')} style={{ background: currentBlock === 'all' ? '#38bdf8' : 'rgba(100, 140, 200, 0.15)', color: currentBlock === 'all' ? '#000' : '#e0e8f0', border: '1px solid rgba(100, 140, 200, 0.3)', borderRadius: '6px', padding: '0 10px', height: '32px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            All
          </button>
        </div>

        <select 
          value={currentBlock} 
          onChange={(e) => handleSelectBlock(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
          style={{ width: '100%', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(100, 140, 200, 0.2)', color: '#e0e8f0', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="all">All Blocks (Full Region)</option>
          {blockManagerRef.current?.blocks.map(b => (
            <option key={b.id} value={b.id}>
              Block {b.id}: {b.latStart.toFixed(1)}°–{b.latEnd.toFixed(1)}°N, {b.lonStart.toFixed(1)}°–{b.lonEnd.toFixed(1)}°E
            </option>
          ))}
        </select>

        <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(100, 140, 200, 0.1)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e0e8f0', marginBottom: '4px' }}>{statusTitle || 'All Blocks (Full Region)'}</div>
          <div style={{ fontSize: '0.7rem', color: '#8899aa', lineHeight: 1.4 }}>{statusSubtitle || 'Coverage: 5.0°N–30.0°N, 45.0°E–104.8°E'}</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ fontSize: '0.75rem', color: '#e0e8f0', textAlign: 'center', marginBottom: '8px' }}>Temp (°C)</div>
        <div style={{ display: 'flex', gap: '8px', height: '200px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.7rem', color: '#e0e8f0', fontFamily: 'monospace' }}>
            <span>30</span>
            <span>26</span>
            <span>22</span>
            <span>18</span>
            <span>14</span>
            <span>10</span>
          </div>
          <div style={{ 
            width: '16px', 
            borderRadius: '4px', 
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'linear-gradient(to bottom, #D00000, #FF4500, #FF8C00, #FFD000, #DFFF00, #00E676, #00BFFF, #0077FF, #0055FF, #2A2AE0, #1717B8)'
          }} />
        </div>
      </div>

      {/* Controls Hint */}
      <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none', display: 'flex', gap: '16px', background: 'rgba(10, 14, 30, 0.7)', border: '1px solid rgba(100, 140, 200, 0.2)', padding: '6px 16px', borderRadius: '20px', backdropFilter: 'blur(8px)', fontSize: '0.7rem', color: '#8899aa' }}>
        <span>🖱 Drag to rotate</span>
        <span>⚙ Scroll to zoom</span>
        <span>⇧+Drag to pan</span>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
