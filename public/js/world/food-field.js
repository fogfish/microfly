// Food odour field: an irregular, stepped per-unit field (contracts/world-format-sketch-map.md §4, research.md
// R4). Pure: no DOM. A 3×3 full-strength core, falling off roughly 10% per Chebyshev ring beyond it, the ring
// boundary roughened by seeded noise so the footprint is organic rather than a perfect square. Several units
// combine by maximum, not sum, so a touching trail reads as one continuous gradient, never past either peak.

import { fbm } from './water.js';

const RING_STEP = 0.1;
// Beyond this ring the kernel is 0 for every seed (1 - 0.1 × (10 + 0.4) < 0); bounds the support for callers
// that want to skip cells, though every export here is safe to call unconditionally.
export const KERNEL_RINGS = 10;

// unitX, unitY: the unit's cell-centre position in tiles (e.g. 10.5, 20.5). Returns a function(cx, cy) → [0, 1]
// for integer cell coordinates: 1 within the 3×3 core (Chebyshev distance ≤ 1) regardless of noise (FR-012),
// else max(0, 1 - 0.1 × roughened-ring-index) where the ring index is perturbed by fbm in roughly [-0.4, 0.4].
export function foodKernel({ unitX, unitY, seed }) {
  const unitCellX = Math.floor(unitX);
  const unitCellY = Math.floor(unitY);
  return (cx, cy) => {
    const ring = Math.max(Math.abs(cx - unitCellX), Math.abs(cy - unitCellY));
    if (ring <= 1) return 1;
    const rough = ring + fbm(cx * 0.3, cy * 0.3, seed) * 0.4;
    return Math.max(0, 1 - RING_STEP * rough);
  };
}

// units: [{ x, y, seed, stockFraction }] (stockFraction defaults to 1). Returns { cols, rows, values: Float32Array }
// where values[k] is the max over every unit of its kernel at that cell × the unit's stockFraction (research R4).
// A static snapshot — the overlay's own evaluation, built once and never rebuilt (flowers never move).
export function foodField({ units, cols, rows }) {
  const kernels = units.map((u) => ({
    kernel: foodKernel({ unitX: u.x, unitY: u.y, seed: u.seed }),
    stockFraction: u.stockFraction ?? 1,
  }));
  const values = new Float32Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let peak = 0;
      for (const u of kernels) {
        const v = u.kernel(cx, cy) * u.stockFraction;
        if (v > peak) peak = v;
      }
      values[cy * cols + cx] = peak;
    }
  }
  return { cols, rows, values };
}

// The live per-sample evaluation a fly's sense uses (data-model.md "Food Odour Area"): units is
// [{ cellX, cellY, kernel }] (shape cached once per unit at world load, world/fly-world.js), and flowers is the
// runtime stock table (fly/food.js createFood) read fresh on every call, so depletion is reflected immediately
// (unlike the static foodField snapshot above, which bakes in the stockFraction it was given).
export function foodFieldAt(units, flowers, cx, cy) {
  let peak = 0;
  for (const u of units) {
    const v = u.kernel(cx, cy) * flowers.fraction(u.cellX, u.cellY);
    if (v > peak) peak = v;
  }
  return peak;
}
