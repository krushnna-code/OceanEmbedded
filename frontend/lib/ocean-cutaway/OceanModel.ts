/**
 * OceanModel.ts — Construct and dynamically render the 3D cutaway ocean block.
 *
 * Sizing & Behavior:
 * - When 1 block is selected, the cuboid itself, its border wireframe, grid lines,
 *   axis ticks, cutaway walls, and labels are sized to THAT SINGLE BLOCK.
 * - When 'all' is selected, the cuboid encompasses the full region.
 * - All 36 native GLORYS scientific depth coordinates are preserved.
 * - Complete data is stored in memory, filtering is 100% frontend with NO network calls.
 *
 * Ported from sih_apraxia/frontend/src/OceanModel.ts
 */

import * as THREE from 'three';
import type { OceanMetadata, OceanData } from './DataLoader';
import type { BlockManager } from './BlockManager';
import { createTemperatureMaterial, createLandMaterial } from './TemperatureMaterial';

const BOX_WIDTH = 10;
const BOX_DEPTH = 6;
const BOX_HEIGHT = 7;

const GRID_COLOR = 0xe8eef5;
const GRID_OPACITY = 0.14;
const EDGE_COLOR = 0xe8eef5;
const EDGE_OPACITY = 0.75;

export class OceanModel {
  readonly group = new THREE.Group();

  private tempMaterial: THREE.ShaderMaterial | null = null;
  private landMaterial: THREE.ShaderMaterial | null = null;

  private currentMeshes: THREE.Mesh[] = [];
  private currentLines: THREE.LineSegments[] = [];
  private currentSprites: THREE.Sprite[] = [];

  readonly nlat: number;
  readonly nlon: number;
  readonly ndepth: number;

  readonly depthMin: number;
  readonly depthMax: number;
  readonly depthRange: number;

  private meta: OceanMetadata;
  private data: OceanData;

  constructor(
    meta: OceanMetadata,
    data: OceanData,
  ) {
    this.meta = meta;
    this.data = data;

    this.nlat = meta.dimensions.latitude;
    this.nlon = meta.dimensions.longitude;
    this.ndepth = meta.dimensions.depth;

    this.depthMin = meta.depth.min; // surface (~0.49 m)
    this.depthMax = meta.depth.max; // deepest (~1062 m)
    this.depthRange = this.depthMax - this.depthMin || 1;
  }

  /** Helper to index into the 3D volume: temp[di][li][lj] */
  volIndex(di: number, li: number, lj: number): number {
    return di * this.nlat * this.nlon + li * this.nlon + lj;
  }

  /** Initial build: sets up shared materials and renders initial block or all */
  build(initialBlock: number | 'all' = 'all', blockManager?: BlockManager): void {
    this.tempMaterial = createTemperatureMaterial();
    this.landMaterial = createLandMaterial();

    if (blockManager) {
      this.renderBlock(initialBlock, blockManager);
    }
  }

  /**
   * Render a single block (or 'all' blocks).
   * The cuboid geometry, wireframe border, grid lines, ticks, and labels
   * are sized specifically to the selected block.
   */
  renderBlock(blockId: number | 'all', blockManager: BlockManager): void {
    // 1. Cleanly dispose previous dynamic objects
    this._disposeCurrent();

    const { meta, data, ndepth } = this;

    // 2. Determine geographic bounds
    let lonMin: number;
    let lonMax: number;
    let latMin: number;
    let latMax: number;
    let latIdxMin: number;
    let latIdxMax: number;
    let lonIdxMin: number;
    let lonIdxMax: number;

    const isAll = blockId === 'all';

    if (isAll) {
      lonMin = meta.longitude.min;
      lonMax = meta.longitude.max;
      latMin = meta.latitude.min;
      latMax = meta.latitude.max;
      latIdxMin = 0;
      latIdxMax = this.nlat - 1;
      lonIdxMin = 0;
      lonIdxMax = this.nlon - 1;
    } else {
      const b = blockManager.getBlock(blockId);
      if (!b) return;
      lonMin = b.lonStart;
      lonMax = b.lonEnd;
      latMin = b.latStart;
      latMax = b.latEnd;
      latIdxMin = b.latIdxMin;
      latIdxMax = b.latIdxMax;
      lonIdxMin = b.lonIdxMin;
      lonIdxMax = b.lonIdxMax;
    }

    const lonRange = lonMax - lonMin || 1;
    const latRange = latMax - latMin || 1;

    // Coordinate mapping functions for THIS cuboid
    const toX = (lon: number) => ((lon - lonMin) / lonRange) * BOX_WIDTH - BOX_WIDTH / 2;
    const toZ = (lat: number) => ((lat - latMin) / latRange) * BOX_DEPTH - BOX_DEPTH / 2;
    const toY = (depthM: number) => -((depthM - this.depthMin) / this.depthRange) * BOX_HEIGHT;

    const x0 = -BOX_WIDTH / 2;
    const x1 = +BOX_WIDTH / 2;
    const z0 = -BOX_DEPTH / 2;
    const z1 = +BOX_DEPTH / 2;
    const y0 = 0;
    const y1 = -BOX_HEIGHT;
    const yLand = y0;

    // Helper to resolve quad temperatures without falling back to -999 on boundary quads
    const resolveQuadTemps = (
      m0: number, t0: number,
      m1: number, t1: number,
      m2: number, t2: number,
      m3: number, t3: number,
    ): [number, number, number, number] => {
      let sum = 0;
      let count = 0;
      if (m0) { sum += t0; count++; }
      if (m1) { sum += t1; count++; }
      if (m2) { sum += t2; count++; }
      if (m3) { sum += t3; count++; }
      const avg = count > 0 ? sum / count : 20.0;
      return [
        m0 ? t0 : avg,
        m1 ? t1 : avg,
        m2 ? t2 : avg,
        m3 ? t3 : avg,
      ];
    };

    // === A. Build Bounding Wireframe Box (Border of only this block) ===
    this._buildEdges(x0, x1, z0, z1, y0, y1);

    // === B. Build Grid Lines and Ticks for this cuboid ===
    this._buildGridLines(toX, toZ, toY, lonMin, lonMax, latMin, latMax, x0, x1, z0, z1, y0, y1, isAll);

    // === C. Build Axis Labels ===
    this._buildAxisLabels(toX, toZ, toY, lonMin, lonMax, latMin, latMax, x0, z0, y1, isAll);

    // === D. Build Ocean and Land Geometry for this block ===
    const oceanPos: number[] = [];
    const oceanTemp: number[] = [];
    const oceanIdx: number[] = [];
    let oceanVCount = 0;

    const addOceanQuad = (
      p0: [number, number, number], t0: number,
      p1: [number, number, number], t1: number,
      p2: [number, number, number], t2: number,
      p3: [number, number, number], t3: number,
      flip = false,
    ) => {
      oceanPos.push(...p0, ...p1, ...p2, ...p3);
      oceanTemp.push(t0, t1, t2, t3);
      if (!flip) {
        oceanIdx.push(oceanVCount, oceanVCount + 1, oceanVCount + 2);
        oceanIdx.push(oceanVCount + 1, oceanVCount + 3, oceanVCount + 2);
      } else {
        oceanIdx.push(oceanVCount, oceanVCount + 2, oceanVCount + 1);
        oceanIdx.push(oceanVCount + 1, oceanVCount + 2, oceanVCount + 3);
      }
      oceanVCount += 4;
    };

    const landPos: number[] = [];
    const landIdx: number[] = [];
    let landVCount = 0;

    const addLandQuad = (
      p0: [number, number, number],
      p1: [number, number, number],
      p2: [number, number, number],
      p3: [number, number, number],
    ) => {
      landPos.push(...p0, ...p1, ...p2, ...p3);
      landIdx.push(landVCount, landVCount + 1, landVCount + 2);
      landIdx.push(landVCount + 1, landVCount + 3, landVCount + 2);
      landVCount += 4;
    };

    // 1. Top and Bottom Horizontal Surfaces
    for (let li = latIdxMin; li < latIdxMax; li++) {
      for (let lj = lonIdxMin; lj < lonIdxMax; lj++) {
        const xL = toX(data.longitude[lj]);
        const xR = toX(data.longitude[lj + 1]);
        const zS = toZ(data.latitude[li]);
        const zN = toZ(data.latitude[li + 1]);

        // Surface (depth index 0)
        const ma0 = data.mask[this.volIndex(0, li, lj)];
        const mb0 = data.mask[this.volIndex(0, li, lj + 1)];
        const mc0 = data.mask[this.volIndex(0, li + 1, lj)];
        const md0 = data.mask[this.volIndex(0, li + 1, lj + 1)];

        if (ma0 + mb0 + mc0 + md0 > 0) {
          const rawA = data.temperature[this.volIndex(0, li, lj)];
          const rawB = data.temperature[this.volIndex(0, li, lj + 1)];
          const rawC = data.temperature[this.volIndex(0, li + 1, lj)];
          const rawD = data.temperature[this.volIndex(0, li + 1, lj + 1)];

          const [t0_a, t0_b, t0_c, t0_d] = resolveQuadTemps(
            ma0, rawA,
            mb0, rawB,
            mc0, rawC,
            md0, rawD,
          );

          addOceanQuad(
            [xL, y0, zS], t0_a,
            [xR, y0, zS], t0_b,
            [xL, y0, zN], t0_c,
            [xR, y0, zN], t0_d,
            false,
          );
        } else {
          // All land
          addLandQuad(
            [xL, yLand, zS],
            [xR, yLand, zS],
            [xL, yLand, zN],
            [xR, yLand, zN],
          );
        }

        // Bottom (depth index ndepth - 1)
        const bIdx = ndepth - 1;
        const maB = data.mask[this.volIndex(bIdx, li, lj)];
        const mbB = data.mask[this.volIndex(bIdx, li, lj + 1)];
        const mcB = data.mask[this.volIndex(bIdx, li + 1, lj)];
        const mdB = data.mask[this.volIndex(bIdx, li + 1, lj + 1)];

        if (maB + mbB + mcB + mdB > 0) {
          const rawA = data.temperature[this.volIndex(bIdx, li, lj)];
          const rawB = data.temperature[this.volIndex(bIdx, li, lj + 1)];
          const rawC = data.temperature[this.volIndex(bIdx, li + 1, lj)];
          const rawD = data.temperature[this.volIndex(bIdx, li + 1, lj + 1)];

          const [tb_a, tb_b, tb_c, tb_d] = resolveQuadTemps(
            maB, rawA,
            mbB, rawB,
            mcB, rawC,
            mdB, rawD,
          );

          addOceanQuad(
            [xL, y1, zS], tb_a,
            [xR, y1, zS], tb_b,
            [xL, y1, zN], tb_c,
            [xR, y1, zN], tb_d,
            true,
          );
        }
      }
    }

    // 2. North Vertical Wall (at latIdxMax, front face)
    for (let lj = lonIdxMin; lj < lonIdxMax; lj++) {
      const xL = toX(data.longitude[lj]);
      const xR = toX(data.longitude[lj + 1]);

      for (let di = 0; di < ndepth - 1; di++) {
        const yTop = toY(data.depth[di]);
        const yBot = toY(data.depth[di + 1]);

        const m0 = data.mask[this.volIndex(di, latIdxMax, lj)];
        const m1 = data.mask[this.volIndex(di, latIdxMax, lj + 1)];
        const m2 = data.mask[this.volIndex(di + 1, latIdxMax, lj)];
        const m3 = data.mask[this.volIndex(di + 1, latIdxMax, lj + 1)];
        if (m0 + m1 + m2 + m3 === 0) continue;

        const raw0 = data.temperature[this.volIndex(di, latIdxMax, lj)];
        const raw1 = data.temperature[this.volIndex(di, latIdxMax, lj + 1)];
        const raw2 = data.temperature[this.volIndex(di + 1, latIdxMax, lj)];
        const raw3 = data.temperature[this.volIndex(di + 1, latIdxMax, lj + 1)];

        const [t0, t1, t2, t3] = resolveQuadTemps(
          m0, raw0,
          m1, raw1,
          m2, raw2,
          m3, raw3,
        );

        addOceanQuad(
          [xL, yTop, z1], t0,
          [xR, yTop, z1], t1,
          [xL, yBot, z1], t2,
          [xR, yBot, z1], t3,
          false,
        );
      }
    }

    // 3. South Vertical Wall (at latIdxMin, back face)
    for (let lj = lonIdxMin; lj < lonIdxMax; lj++) {
      const xL = toX(data.longitude[lj]);
      const xR = toX(data.longitude[lj + 1]);

      for (let di = 0; di < ndepth - 1; di++) {
        const yTop = toY(data.depth[di]);
        const yBot = toY(data.depth[di + 1]);

        const m0 = data.mask[this.volIndex(di, latIdxMin, lj)];
        const m1 = data.mask[this.volIndex(di, latIdxMin, lj + 1)];
        const m2 = data.mask[this.volIndex(di + 1, latIdxMin, lj)];
        const m3 = data.mask[this.volIndex(di + 1, latIdxMin, lj + 1)];
        if (m0 + m1 + m2 + m3 === 0) continue;

        const raw0 = data.temperature[this.volIndex(di, latIdxMin, lj)];
        const raw1 = data.temperature[this.volIndex(di, latIdxMin, lj + 1)];
        const raw2 = data.temperature[this.volIndex(di + 1, latIdxMin, lj)];
        const raw3 = data.temperature[this.volIndex(di + 1, latIdxMin, lj + 1)];

        const [t0, t1, t2, t3] = resolveQuadTemps(
          m0, raw0,
          m1, raw1,
          m2, raw2,
          m3, raw3,
        );

        addOceanQuad(
          [xL, yTop, z0], t0,
          [xR, yTop, z0], t1,
          [xL, yBot, z0], t2,
          [xR, yBot, z0], t3,
          true,
        );
      }
    }

    // 4. East Vertical Wall (at lonIdxMax, right face)
    for (let li = latIdxMin; li < latIdxMax; li++) {
      const zS = toZ(data.latitude[li]);
      const zN = toZ(data.latitude[li + 1]);

      for (let di = 0; di < ndepth - 1; di++) {
        const yTop = toY(data.depth[di]);
        const yBot = toY(data.depth[di + 1]);

        const m0 = data.mask[this.volIndex(di, li, lonIdxMax)];
        const m1 = data.mask[this.volIndex(di, li + 1, lonIdxMax)];
        const m2 = data.mask[this.volIndex(di + 1, li, lonIdxMax)];
        const m3 = data.mask[this.volIndex(di + 1, li + 1, lonIdxMax)];
        if (m0 + m1 + m2 + m3 === 0) continue;

        const raw0 = data.temperature[this.volIndex(di, li, lonIdxMax)];
        const raw1 = data.temperature[this.volIndex(di, li + 1, lonIdxMax)];
        const raw2 = data.temperature[this.volIndex(di + 1, li, lonIdxMax)];
        const raw3 = data.temperature[this.volIndex(di + 1, li + 1, lonIdxMax)];

        const [t0, t1, t2, t3] = resolveQuadTemps(
          m0, raw0,
          m1, raw1,
          m2, raw2,
          m3, raw3,
        );

        addOceanQuad(
          [x1, yTop, zS], t0,
          [x1, yTop, zN], t1,
          [x1, yBot, zS], t2,
          [x1, yBot, zN], t3,
          false,
        );
      }
    }

    // 5. West Vertical Wall (at lonIdxMin, left face)
    for (let li = latIdxMin; li < latIdxMax; li++) {
      const zS = toZ(data.latitude[li]);
      const zN = toZ(data.latitude[li + 1]);

      for (let di = 0; di < ndepth - 1; di++) {
        const yTop = toY(data.depth[di]);
        const yBot = toY(data.depth[di + 1]);

        const m0 = data.mask[this.volIndex(di, li, lonIdxMin)];
        const m1 = data.mask[this.volIndex(di, li + 1, lonIdxMin)];
        const m2 = data.mask[this.volIndex(di + 1, li, lonIdxMin)];
        const m3 = data.mask[this.volIndex(di + 1, li + 1, lonIdxMin)];
        if (m0 + m1 + m2 + m3 === 0) continue;

        const raw0 = data.temperature[this.volIndex(di, li, lonIdxMin)];
        const raw1 = data.temperature[this.volIndex(di, li + 1, lonIdxMin)];
        const raw2 = data.temperature[this.volIndex(di + 1, li, lonIdxMin)];
        const raw3 = data.temperature[this.volIndex(di + 1, li + 1, lonIdxMin)];

        const [t0, t1, t2, t3] = resolveQuadTemps(
          m0, raw0,
          m1, raw1,
          m2, raw2,
          m3, raw3,
        );

        addOceanQuad(
          [x0, yTop, zS], t0,
          [x0, yTop, zN], t1,
          [x0, yBot, zS], t2,
          [x0, yBot, zN], t3,
          true,
        );
      }
    }

    // Add Ocean Mesh to group
    if (oceanIdx.length > 0 && this.tempMaterial) {
      const oceanGeo = new THREE.BufferGeometry();
      oceanGeo.setAttribute('position', new THREE.Float32BufferAttribute(oceanPos, 3));
      oceanGeo.setAttribute('temperature', new THREE.Float32BufferAttribute(oceanTemp, 1));
      oceanGeo.setIndex(oceanIdx);

      const oceanMesh = new THREE.Mesh(oceanGeo, this.tempMaterial);
      this.group.add(oceanMesh);
      this.currentMeshes.push(oceanMesh);
    }

    // Add Land Mesh to group
    if (landIdx.length > 0 && this.landMaterial) {
      const landGeo = new THREE.BufferGeometry();
      landGeo.setAttribute('position', new THREE.Float32BufferAttribute(landPos, 3));
      landGeo.setIndex(landIdx);

      const landMesh = new THREE.Mesh(landGeo, this.landMaterial);
      landMesh.renderOrder = 1;
      this.group.add(landMesh);
      this.currentMeshes.push(landMesh);
    }
  }

  /** Wireframe bounding box edges that tightly enclose the cuboid */
  private _buildEdges(
    x0: number, x1: number, z0: number, z1: number, y0: number, y1: number,
  ): void {
    const pts = [
      x0, y0, z0, x1, y0, z0,
      x1, y0, z0, x1, y0, z1,
      x1, y0, z1, x0, y0, z1,
      x0, y0, z1, x0, y0, z0,

      x0, y1, z0, x1, y1, z0,
      x1, y1, z0, x1, y1, z1,
      x1, y1, z1, x0, y1, z1,
      x0, y1, z1, x0, y1, z0,

      x0, y0, z0, x0, y1, z0,
      x1, y0, z0, x1, y1, z0,
      x1, y0, z1, x1, y1, z1,
      x0, y0, z1, x0, y1, z1,
    ];

    this._addLineSegments(pts, EDGE_COLOR, EDGE_OPACITY);
  }

  /** Faint grid lines on bottom face and tick marks along borders */
  private _buildGridLines(
    toX: (lon: number) => number,
    toZ: (lat: number) => number,
    toY: (depthM: number) => number,
    lonMin: number, lonMax: number,
    latMin: number, latMax: number,
    x0: number, x1: number, z0: number, z1: number,
    _y0: number, y1: number,
    isAll: boolean,
  ): void {
    const pts: number[] = [];

    const lonTicks = this._calculateTicks(lonMin, lonMax, isAll ? 15 : 3);
    const latTicks = this._calculateTicks(latMin, latMax, isAll ? 5 : 3);
    const depthTicks = this._depthTicks();

    // Bottom face grid (longitude lines)
    for (const lon of lonTicks) {
      const x = toX(lon);
      pts.push(x, y1, z0, x, y1, z1);
      // Tick mark on south edge
      pts.push(x, y1, z0, x, y1, z0 - 0.15);
    }

    // Bottom face grid (latitude lines)
    for (const lat of latTicks) {
      const z = toZ(lat);
      pts.push(x0, y1, z, x1, y1, z);
      // Tick mark on west edge
      pts.push(x0, y1, z, x0 - 0.15, y1, z);
    }

    // Depth axis tick marks on west vertical pillar
    for (const dm of depthTicks) {
      const y = toY(dm);
      pts.push(x0, y, z0, x0 - 0.15, y, z0);
    }

    this._addLineSegments(pts, GRID_COLOR, GRID_OPACITY);
  }

  /** Axis labels formatted cleanly for the current cuboid */
  private _buildAxisLabels(
    toX: (lon: number) => number,
    toZ: (lat: number) => number,
    toY: (depthM: number) => number,
    lonMin: number, lonMax: number,
    latMin: number, latMax: number,
    x0: number, z0: number, yBottom: number,
    isAll: boolean,
  ): void {
    const labelY = yBottom - 0.35;
    const lonTicks = this._calculateTicks(lonMin, lonMax, isAll ? 15 : 3);
    const latTicks = this._calculateTicks(latMin, latMax, isAll ? 5 : 3);
    const depthTicks = this._depthTicks();

    // Longitude ticks along south edge
    for (const lon of lonTicks) {
      const str = isAll ? `${lon.toFixed(0)}` : `${lon.toFixed(1)}`;
      const sprite = this._makeTextSprite(str, 0.28);
      sprite.position.set(toX(lon), labelY, z0 - 0.55);
      this.group.add(sprite);
      this.currentSprites.push(sprite);
    }
    const lonTitle = this._makeTextSprite('Longitude (°E)', 0.32);
    lonTitle.position.set(0, labelY - 0.5, z0 - 0.55);
    this.group.add(lonTitle);
    this.currentSprites.push(lonTitle);

    // Latitude ticks along west edge
    for (const lat of latTicks) {
      const str = isAll ? `${lat.toFixed(0)}` : `${lat.toFixed(1)}`;
      const sprite = this._makeTextSprite(str, 0.28);
      sprite.position.set(x0 - 0.75, labelY, toZ(lat));
      this.group.add(sprite);
      this.currentSprites.push(sprite);
    }
    const latTitle = this._makeTextSprite('Latitude (°N)', 0.32);
    latTitle.position.set(x0 - 1.55, labelY - 0.5, 0);
    this.group.add(latTitle);
    this.currentSprites.push(latTitle);

    // Depth ticks along west pillar
    for (const dm of depthTicks) {
      const y = toY(dm);
      const sprite = this._makeTextSprite(`${dm}`, 0.32);
      sprite.position.set(x0 - 0.75, y, z0 + 0.05);
      this.group.add(sprite);
      this.currentSprites.push(sprite);
    }
    const midDepth = (this.depthMin + this.depthMax) / 2;
    const depthTitle = this._makeTextSprite('Depth (m)', 0.34);
    depthTitle.position.set(x0 - 1.55, toY(midDepth), z0 + 0.05);
    this.group.add(depthTitle);
    this.currentSprites.push(depthTitle);
  }

  private _calculateTicks(min: number, max: number, countOrStep: number): number[] {
    const ticks: number[] = [];
    if (countOrStep >= 4 && max - min > countOrStep) {
      // Step-based
      const step = countOrStep;
      const start = Math.ceil(min / step) * step;
      for (let v = start; v <= max; v += step) {
        ticks.push(v);
      }
    } else {
      // Count-based (e.g. 3 ticks: min, mid, max)
      const count = typeof countOrStep === 'number' && countOrStep > 0 ? countOrStep : 3;
      for (let i = 0; i < count; i++) {
        ticks.push(min + (max - min) * (i / (count - 1)));
      }
    }
    return ticks;
  }

  private _depthTicks(): number[] {
    const targets = [0, 200, 400, 600, 800, 1000];
    const depthValues = this.meta.depth.values;
    const ticks: number[] = [];

    for (const target of targets) {
      let bestDist = Math.abs(depthValues[0] - target);
      for (let i = 1; i < depthValues.length; i++) {
        const dist = Math.abs(depthValues[i] - target);
        if (dist < bestDist) {
          bestDist = dist;
        }
      }
      if (bestDist < 100) {
        ticks.push(Math.round(target));
      }
    }
    return ticks;
  }

  private _addLineSegments(pts: number[], color: number, opacity: number): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    });
    const lines = new THREE.LineSegments(geo, mat);
    this.group.add(lines);
    this.currentLines.push(lines);
  }

  private _makeTextSprite(text: string, scale: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, 64);
    ctx.font = '26px Inter, sans-serif';
    ctx.fillStyle = '#e8eef5';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale * 4, scale, 1);
    return sprite;
  }

  private _disposeCurrent(): void {
    for (const mesh of this.currentMeshes) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.currentMeshes = [];

    for (const line of this.currentLines) {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
      this.group.remove(line);
    }
    this.currentLines = [];

    for (const sprite of this.currentSprites) {
      if (sprite.material.map) {
        sprite.material.map.dispose();
      }
      sprite.material.dispose();
      this.group.remove(sprite);
    }
    this.currentSprites = [];
  }

  dispose(): void {
    this._disposeCurrent();

    this.tempMaterial?.dispose();
    this.landMaterial?.dispose();

    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }

    this.tempMaterial = null;
    this.landMaterial = null;
  }
}
