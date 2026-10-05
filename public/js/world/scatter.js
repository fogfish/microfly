// Seeded scatter of small vegetation in an area, with clearings. Pure: no DOM.
// The same seed and inputs always give the same placements (FR-018).

import { createPrng } from './prng.js';

const CLEARING_RADIUS = { min: 1.5, max: 3 };
const CLEARING_TRIES = 5000;

// area and water are Uint8Array masks of cols × rows cells. Returns [{ sprite, x, y }] in cells.
// density: expected objects per cell (a fraction is a chance). clearings: share of the area kept open.
export function scatterPlacements({ seed, density, clearings, sprites, area, water, cols, rows }) {
  const out = [];
  if (sprites.length === 0 || density <= 0) return out;

  const prng = createPrng(seed);
  const cells = [];
  for (let i = 0; i < area.length; i++) if (area[i]) cells.push(i);
  if (cells.length === 0) return out;

  // Clearings are discs cut from the area until the target share is open
  const cleared = new Uint8Array(cols * rows);
  const target = Math.round(clearings * cells.length);
  let opened = 0;
  for (let tries = 0; opened < target && tries < CLEARING_TRIES; tries++) {
    const centre = cells[prng.int(0, cells.length - 1)];
    const cx = (centre % cols) + 0.5;
    const cy = Math.floor(centre / cols) + 0.5;
    const r = CLEARING_RADIUS.min + prng.next() * (CLEARING_RADIUS.max - CLEARING_RADIUS.min);
    const reach = Math.ceil(r);
    for (let y = Math.max(0, Math.floor(cy - reach)); y <= Math.min(rows - 1, Math.floor(cy + reach)); y++) {
      for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(cols - 1, Math.floor(cx + reach)); x++) {
        const i = y * cols + x;
        if (!area[i] || cleared[i] || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
        cleared[i] = 1;
        opened++;
      }
    }
  }

  for (const i of cells) {
    if (cleared[i] || water[i]) continue;
    const count = Math.floor(density) + (prng.next() < density % 1 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      out.push({
        sprite: sprites[prng.int(0, sprites.length - 1)],
        x: (i % cols) + 0.15 + prng.next() * 0.7,
        y: Math.floor(i / cols) + 0.15 + prng.next() * 0.7,
      });
    }
  }
  return out;
}
