/**
 * BlockManager.ts — Spatial block partitioning and selection manager.
 *
 * Divides the horizontal 0.25° grid (longitude × latitude) into deterministic,
 * numbered spatial blocks (Block 1 … Block N) in row-major order.
 *
 * Ported from sih_apraxia/frontend/src/BlockManager.ts
 */

import type { OceanData, OceanMetadata } from './DataLoader';

export interface SpatialBlock {
  id: number;
  row: number;
  col: number;
  latStart: number;
  latEnd: number;
  lonStart: number;
  lonEnd: number;
  latIdxMin: number;
  latIdxMax: number;
  lonIdxMin: number;
  lonIdxMax: number;
  latIndices: number[];
  lonIndices: number[];
}

export interface ActiveCellInfo {
  /** 1 = active cell, 0 = inactive. Size: (nlat - 1) * (nlon - 1) */
  active: Uint8Array;
  activeCount: number;
  minLatIdx: number;
  maxLatIdx: number;
  minLonIdx: number;
  maxLonIdx: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export class BlockManager {
  readonly blocks: SpatialBlock[] = [];
  readonly blockMap = new Map<number, SpatialBlock>();

  readonly nlat: number;
  readonly nlon: number;
  readonly latCells: number;
  readonly lonCells: number;

  readonly numRows: number;
  readonly numCols: number;
  readonly totalBlocks: number;

  private meta: OceanMetadata;
  private data: OceanData;
  readonly blockLatCells: number;
  readonly blockLonCells: number;

  constructor(
    meta: OceanMetadata,
    data: OceanData,
    /** Default: 10 lat cells (~2.5°) and 24 lon cells (~6.0°) giving 100 blocks */
    blockLatCells: number = 10,
    blockLonCells: number = 24,
  ) {
    this.meta = meta;
    this.data = data;
    this.blockLatCells = blockLatCells;
    this.blockLonCells = blockLonCells;
    this.nlat = meta.dimensions.latitude;
    this.nlon = meta.dimensions.longitude;
    this.latCells = this.nlat - 1;
    this.lonCells = this.nlon - 1;

    this.numRows = Math.ceil(this.latCells / this.blockLatCells);
    this.numCols = Math.ceil(this.lonCells / this.blockLonCells);
    this.totalBlocks = this.numRows * this.numCols;

    this._generateBlocks();
  }

  private _generateBlocks(): void {
    let currentId = 1;

    for (let r = 0; r < this.numRows; r++) {
      const latCellMin = r * this.blockLatCells;
      const latCellMax = Math.min((r + 1) * this.blockLatCells, this.latCells);
      const latIdxMin = latCellMin;
      const latIdxMax = latCellMax;

      const latIndices: number[] = [];
      for (let i = latIdxMin; i <= latIdxMax; i++) {
        latIndices.push(i);
      }

      const latStart = this.data.latitude[latIdxMin];
      const latEnd = this.data.latitude[latIdxMax];

      for (let c = 0; c < this.numCols; c++) {
        const lonCellMin = c * this.blockLonCells;
        const lonCellMax = Math.min((c + 1) * this.blockLonCells, this.lonCells);
        const lonIdxMin = lonCellMin;
        const lonIdxMax = lonCellMax;

        const lonIndices: number[] = [];
        for (let j = lonIdxMin; j <= lonIdxMax; j++) {
          lonIndices.push(j);
        }

        const lonStart = this.data.longitude[lonIdxMin];
        const lonEnd = this.data.longitude[lonIdxMax];

        const block: SpatialBlock = {
          id: currentId,
          row: r,
          col: c,
          latStart,
          latEnd,
          lonStart,
          lonEnd,
          latIdxMin,
          latIdxMax,
          lonIdxMin,
          lonIdxMax,
          latIndices,
          lonIndices,
        };

        this.blocks.push(block);
        this.blockMap.set(currentId, block);
        currentId++;
      }
    }
  }

  getBlock(id: number): SpatialBlock | undefined {
    return this.blockMap.get(id);
  }

  getAllBlockIds(): Set<number> {
    const ids = new Set<number>();
    for (let i = 1; i <= this.totalBlocks; i++) {
      ids.add(i);
    }
    return ids;
  }

  /**
   * Parse user input expressions into a set of valid Block IDs.
   * Supports:
   * - "all" -> all blocks
   * - "none" -> empty set
   * - "25" -> block 25
   * - "1-10" or "1..10" -> blocks 1 through 10
   * - "1-10, 25, 50-70" -> combination of ranges and single blocks
   */
  parseSelection(input: string): Set<number> {
    const trimmed = input.trim().toLowerCase();
    if (trimmed === 'all' || trimmed === '*' || trimmed === '') {
      return this.getAllBlockIds();
    }
    if (trimmed === 'none' || trimmed === '0') {
      return new Set<number>();
    }

    const selected = new Set<number>();
    const tokens = trimmed.split(/[,;\s]+/).filter(Boolean);

    for (const token of tokens) {
      if (token.includes('-') || token.includes('..') || token.includes('–')) {
        const parts = token.split(/[-–]|\.\./);
        if (parts.length === 2) {
          const start = parseInt(parts[0], 10);
          const end = parseInt(parts[1], 10);
          if (!isNaN(start) && !isNaN(end)) {
            const min = Math.max(1, Math.min(start, end));
            const max = Math.min(this.totalBlocks, Math.max(start, end));
            for (let id = min; id <= max; id++) {
              if (this.blockMap.has(id)) {
                selected.add(id);
              }
            }
          }
        }
      } else {
        const id = parseInt(token, 10);
        if (!isNaN(id) && id >= 1 && id <= this.totalBlocks) {
          if (this.blockMap.has(id)) {
            selected.add(id);
          }
        }
      }
    }

    return selected;
  }

  /**
   * Create an active cell mask and bounding box info from a set of selected block IDs.
   */
  getActiveCellInfo(selectedBlockIds: Set<number>): ActiveCellInfo {
    const active = new Uint8Array(this.latCells * this.lonCells);
    let activeCount = 0;

    let minLatIdx = this.nlat;
    let maxLatIdx = -1;
    let minLonIdx = this.nlon;
    let maxLonIdx = -1;

    for (const id of selectedBlockIds) {
      const block = this.blockMap.get(id);
      if (!block) continue;

      minLatIdx = Math.min(minLatIdx, block.latIdxMin);
      maxLatIdx = Math.max(maxLatIdx, block.latIdxMax);
      minLonIdx = Math.min(minLonIdx, block.lonIdxMin);
      maxLonIdx = Math.max(maxLonIdx, block.lonIdxMax);

      for (let li = block.latIdxMin; li < block.latIdxMax; li++) {
        for (let lj = block.lonIdxMin; lj < block.lonIdxMax; lj++) {
          const idx = li * this.lonCells + lj;
          if (active[idx] === 0) {
            active[idx] = 1;
            activeCount++;
          }
        }
      }
    }

    const minLat = minLatIdx < this.nlat ? this.data.latitude[minLatIdx] : 0;
    const maxLat = maxLatIdx >= 0 ? this.data.latitude[maxLatIdx] : 0;
    const minLon = minLonIdx < this.nlon ? this.data.longitude[minLonIdx] : 0;
    const maxLon = maxLonIdx >= 0 ? this.data.longitude[maxLonIdx] : 0;

    return {
      active,
      activeCount,
      minLatIdx,
      maxLatIdx,
      minLonIdx,
      maxLonIdx,
      minLat,
      maxLat,
      minLon,
      maxLon,
    };
  }

  /**
   * Format human-readable status text for selected blocks.
   */
  formatSelection(selectedBlockIds: Set<number>): { title: string; subtitle: string } {
    const count = selectedBlockIds.size;
    if (count === 0) {
      return {
        title: 'Selected: None',
        subtitle: 'No spatial blocks visible',
      };
    }
    if (count === this.totalBlocks) {
      return {
        title: `Selected: All (${this.totalBlocks} blocks)`,
        subtitle: `Coverage: ${this.meta.latitude.min.toFixed(1)}°N–${this.meta.latitude.max.toFixed(1)}°N, ${this.meta.longitude.min.toFixed(1)}°E–${this.meta.longitude.max.toFixed(1)}°E`,
      };
    }

    const sortedIds = Array.from(selectedBlockIds).sort((a, b) => a - b);

    // Format contiguous runs: e.g. "1–10, 25, 40–45"
    const ranges: string[] = [];
    let start = sortedIds[0];
    let prev = sortedIds[0];

    for (let i = 1; i < sortedIds.length; i++) {
      const curr = sortedIds[i];
      if (curr === prev + 1) {
        prev = curr;
      } else {
        ranges.push(start === prev ? `Block ${start}` : `Blocks ${start}–${prev}`);
        start = curr;
        prev = curr;
      }
    }
    ranges.push(start === prev ? `Block ${start}` : `Blocks ${start}–${prev}`);

    const cellInfo = this.getActiveCellInfo(selectedBlockIds);
    const rangeStr = ranges.length <= 4 ? ranges.join(', ') : `${ranges.slice(0, 3).join(', ')} … (+${count - 3} more)`;

    return {
      title: `Selected: ${rangeStr} (${count} block${count > 1 ? 's' : ''})`,
      subtitle: `Coverage: ${cellInfo.minLat.toFixed(1)}°N–${cellInfo.maxLat.toFixed(1)}°N, ${cellInfo.minLon.toFixed(1)}°E–${cellInfo.maxLon.toFixed(1)}°E`,
    };
  }

  /**
   * Format status text for a single block (or 'all').
   */
  formatSingleBlock(blockId: number | 'all'): { title: string; subtitle: string; badge: string } {
    if (blockId === 'all') {
      return {
        title: `All Blocks (Full Region)`,
        subtitle: `Coverage: ${this.meta.latitude.min.toFixed(1)}°N–${this.meta.latitude.max.toFixed(1)}°N, ${this.meta.longitude.min.toFixed(1)}°E–${this.meta.longitude.max.toFixed(1)}°E`,
        badge: `${this.totalBlocks} Blocks`,
      };
    }

    const b = this.getBlock(blockId);
    if (!b) {
      return {
        title: `Block ${blockId}`,
        subtitle: 'Unknown block',
        badge: `Block ${blockId}`,
      };
    }

    return {
      title: `Block ${b.id} (Row ${b.row + 1}, Col ${b.col + 1})`,
      subtitle: `Lat: ${b.latStart.toFixed(2)}°N–${b.latEnd.toFixed(2)}°N | Lon: ${b.lonStart.toFixed(2)}°E–${b.lonEnd.toFixed(2)}°E`,
      badge: `Block ${b.id} of ${this.totalBlocks}`,
    };
  }
}
