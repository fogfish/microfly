// Heat odour field: a tile-step distance ring from water (contracts/world-format-sketch-map.md §3, research.md
// R2). Pure: no DOM. Same shape as danger-field.js, sourced from the water mask instead of edge forest.

import { stepDistance, RING_INTENSITY } from './danger-field.js';

// water: Uint8Array(cols × rows), 1 where the cell is water (world/water.js cellWater, world/layout.js buildLogic).
// quiet: optional Uint8Array, 1 where the heat is zero whatever the water (flies.heatQuiet: a ground area the fly may
// cross without the heat ring, e.g. the swamp). Absent, every cell takes its ring intensity.
// Returns { cols, rows, distance: Uint8Array, intensity: Float32Array }.
export function heatField({ water, cols, rows, quiet = null }) {
  const distance = stepDistance(water, cols, rows);
  const intensity = new Float32Array(distance.length);
  for (let i = 0; i < distance.length; i++) intensity[i] = quiet?.[i] ? 0 : RING_INTENSITY[distance[i]];
  return { cols, rows, distance, intensity };
}
