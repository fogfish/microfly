// Builds the terrain grid and places objects from a validated config.
// Pure: no DOM. Same config gives the same output (FR-013).

import { createPrng } from './prng.js';
import { createValueNoise } from './noise.js';

const PLACEMENT_ATTEMPTS = 50;

// Returns a Uint16Array of width × height terrain indices (index into config.terrain)
export function generateTerrain(config) {
  const { width, height } = config.world;
  const terrainIndex = new Map(config.terrain.map((t, i) => [t.id, i]));
  const base = config.terrain.findIndex((t) => t.base === true);
  const grid = new Uint16Array(width * height).fill(base);
  const prng = createPrng(config.seed);

  for (const layer of config.terrainLayers ?? []) {
    const target = terrainIndex.get(layer.terrain);
    const on = new Set(layer.on.map((id) => terrainIndex.get(id)));

    if (layer.shape === 'blobs') {
      const [minR, maxR] = layer.radius;
      for (let n = 0; n < layer.count; n++) {
        const cx = prng.int(0, width - 1);
        const cy = prng.int(0, height - 1);
        const r = prng.int(minR, maxR);
        for (let y = Math.max(0, cy - r); y <= Math.min(height - 1, cy + r); y++) {
          for (let x = Math.max(0, cx - r); x <= Math.min(width - 1, cx + r); x++) {
            const dx = x - cx;
            const dy = y - cy;
            const i = y * width + x;
            if (dx * dx + dy * dy <= r * r && on.has(grid[i])) grid[i] = target;
          }
        }
      }
    } else {
      const noise = createValueNoise(prng, layer.scale);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (noise.sample(x, y) >= layer.threshold && on.has(grid[i])) grid[i] = target;
        }
      }
    }
  }

  return grid;
}

// Places objects rule by rule, in config order.
// Returns { objects, report: { placed, shortfall } }, both keyed by rule id.
export function placeObjects(config, grid) {
  const { width, height } = config.world;
  const terrainIndex = new Map(config.terrain.map((t, i) => [t.id, i]));
  const prng = createPrng(config.seed);
  const objects = [];
  const report = { placed: {}, shortfall: {} };

  for (const rule of config.objects ?? []) {
    const allowed = new Set(rule.allowedTerrain.map((id) => terrainIndex.get(id)));
    const spacing = rule.minSpacing ?? 0;
    let placed = 0;

    for (let k = 0; k < rule.count; k++) {
      let found = false;
      for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS && !found; attempt++) {
        const x = prng.int(0, width - 1);
        const y = prng.int(0, height - 1);
        if (!allowed.has(grid[y * width + x])) continue;
        const clear = objects.every(
          (o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) >= spacing,
        );
        if (!clear) continue;
        objects.push({ ruleId: rule.id, kind: rule.kind, sprite: rule.sprite, x, y });
        found = true;
      }
      if (found) placed++;
    }

    report.placed[rule.id] = placed;
    if (placed < rule.count) report.shortfall[rule.id] = rule.count - placed;
  }

  return { objects, report };
}
