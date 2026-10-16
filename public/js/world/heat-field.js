// Heat odour field: a tile-step distance ring from water (contracts/world-format-sketch-map.md §3, research.md
// R2). Pure: no DOM. Same shape as danger-field.js, sourced from the water mask instead of edge forest.

import { stepDistance, RING_INTENSITY } from './danger-field.js';

// water: Uint8Array(cols × rows), 1 where the cell is water (world/water.js cellWater, world/layout.js buildLogic).
// Returns { cols, rows, distance: Uint8Array, intensity: Float32Array }.
export function heatField({ water, cols, rows }) {
  const distance = stepDistance(water, cols, rows);
  const intensity = new Float32Array(distance.length);
  for (let i = 0; i < distance.length; i++) intensity[i] = RING_INTENSITY[distance[i]];
  return { cols, rows, distance, intensity };
}
