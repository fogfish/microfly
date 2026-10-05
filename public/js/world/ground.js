// Ground layer: a base of 32 px grass tiles chosen per cell by seed, and meadow or dark-grass patches
// drawn over it. Pure: no DOM. The base is opaque, so patch edges show grass, never the page (FR-004).

import { CELL_PX, outlineBounds } from './layout.js';

// rocks2-terrain-004 to -007 are one-colour solid tiles and are not used (BUG-001).
export const BASE_TILES = [
  'trees-terrain-001',
  'trees-terrain-004',
  'trees-terrain-005',
  'trees-terrain-007',
];
// Patches are drawn at their native size over the base. cobble and gravel are larger than one cell,
// so they are layered over the grass like the meadow patches.
export const PATCH_TILES = {
  meadow: ['trees-terrain-010', 'trees-terrain-012'],
  darkGrass: ['trees-terrain-002'],
  cobble: ['rocks2-terrain-009'],
  gravel: ['beach-terrain-011'],
};

// Integer hash of (seed, a, b). Same inputs always give the same value.
export function cellHash(seed, a, b) {
  let h = (seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// Returns { base: string[] (one id per cell, row-major), patches: [{ sprite, x, y }] in scene px }.
// catalog: from indexCatalog, for patch sizes. config must be valid.
export function groundPlan(config, catalog) {
  const { cols, rows } = config.grid;
  const seed = config.seed;

  const base = new Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      base[y * cols + x] = BASE_TILES[cellHash(seed, x, y) % BASE_TILES.length];
    }
  }

  const patches = [];
  (config.ground ?? []).forEach((area, n) => {
    const options = PATCH_TILES[area.kind];
    const sprite = options[n % options.length];
    const b = outlineBounds(area.outline);
    const { w, h } = catalog.sprites.get(sprite);
    patches.push({
      sprite,
      x: Math.round(((b.minX + b.maxX) / 2) * CELL_PX - w / 2),
      y: Math.round(((b.minY + b.maxY) / 2) * CELL_PX - h / 2),
    });
  });

  return { base, patches };
}
