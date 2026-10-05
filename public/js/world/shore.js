// Shore decor (BUG-002, FR-030): the grass shore rules of the art pack's water spec
// (WATER-SPEC §4.3, placement §6.1). Items are placed from the signed distance S of the water field,
// so reeds and stones stand across the waterline and hide the seam. No sprite is rotated or mirrored
// (FR-025), and the rectangular reed sprites are only used cut into a reed bed (compose.js). Pure: no DOM.

import { createPrng } from './prng.js';
import { waterField, bodySeed, lerp } from './water.js';

const CELL_PX = 32;

export const SPRIGS = ['beach-plant-004', 'beach-plant-005', 'beach-plant-006', 'beach-plant-007',
  'beach-plant-008', 'beach-plant-010', 'beach-plant-011', 'beach-plant-012'];
export const REED_SOURCES = ['beach-plant-003', 'beach-plant-002'];

// In table order: big items first, so they win space. A rule's band is s: [a, b] on S (px) or
// t: [a, b] on S / Wsh (land only). per100: items per 100 px of shoreline. clear: keep-out radius
// against earlier items. maxPond: cap on a pond (one reed bed reads as a pond, three as a marsh).
export const GRASS_RULES = [
  { name: 'reed beds', kind: 'reedbed', s: [-5, 1], per100: 0.32, spacing: 56, clear: 16, ripple: true, maxPond: 1, rx: [9, 20], ry: [4, 7], height: [14, 26] },
  { name: 'waterline stones', ids: ['rocks2-rock-013', 'rocks2-rock-011'], s: [-2, 2], per100: 0.35, spacing: 40, clear: 5, ripple: true },
  { name: 'mossy log', ids: ['jungle-prop-007'], s: [-3, 3], per100: 0.05, spacing: 400, clear: 14, ripple: true, max: 1, minPerimeter: 900 },
  { name: 'tufts', ids: ['trees-plant-006', 'trees-plant-007', 'jungle-plant-011', 'beach-plant-015'], t: [0, 1.3], per100: 3.6, spacing: 10, clear: 3 },
  { name: 'sprigs', ids: SPRIGS, t: [0.2, 1.8], per100: 3.0, spacing: 7 },
  { name: 'ferns', ids: ['trees-plant-008', 'jungle-bush-008'], t: [1.0, 2.6], per100: 0.35, spacing: 50, clear: 12 },
  { name: 'wild flowers', ids: ['jungle-plant-016', 'jungle-plant-017', 'trees-plant-005'], t: [1.3, 3.5], per100: 0.7, spacing: 22 },
];

// Shore decor for every water body. Returns
// [{ body, rule, kind: 'sprite' | 'reedbed', sprite?, reed?, x, y, wet, ripple }]
// x, y is the foot point in cells. reed: { rx, ry, height, source, offset, seed } for compose.js.
export function shorePlacements(config) {
  const field = waterField(config);
  const out = [];
  field.bodies.forEach((body, i) => {
    out.push(...placeBody(field, body, i, bodySeed(config.seed, i)));
  });
  return out;
}

function placeBody(field, body, index, seed) {
  const { W, H, S, Wsh, label } = field;
  const rnd = createPrng(Math.imul(seed, 7) + 1).next;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const own = index + 1;
  const placed = [];
  const out = [];

  for (const rule of GRASS_RULES) {
    if (rule.minPerimeter && body.perimeter < rule.minPerimeter) continue;
    const inBand = (k) => {
      if (rule.s) return S[k] >= rule.s[0] && S[k] <= rule.s[1];
      return S[k] >= 0 && S[k] / Wsh[k] >= rule.t[0] && S[k] / Wsh[k] <= rule.t[1];
    };
    // Foot points stay inside the world, with room for the sprite above them
    const inside = (x, y) => x >= 4 && y >= 6 && x < W - 4 && y < H - 2;

    const cand = [];
    const { x0, y0, w, h } = body.box;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const k = y * W + x;
        if (label[k] === own && inside(x, y) && inBand(k)) cand.push(k);
      }
    }
    if (cand.length === 0) continue;

    let want = Math.round((rule.per100 * body.perimeter) / 100 + rnd() * 0.6);
    if (rule.max) want = Math.min(want, rule.max);
    if (rule.maxPond && body.kind === 'pond') want = Math.min(want, rule.maxPond);

    const mine = [];
    const ok = (x, y) => {
      for (const p of mine) if (Math.hypot(p.px - x, p.py - y) < rule.spacing) return false;
      if (rule.clear) for (const p of placed) if (p.clear && Math.hypot(p.px - x, p.py - y) < rule.clear + p.clear) return false;
      return true;
    };
    for (let a = 0; a < want * 40 && mine.length < want; a++) {
      const k = pick(cand);
      const x = k % W;
      const y = Math.floor(k / W);
      if (!ok(x, y)) continue;
      const item = {
        body: body.id,
        rule: rule.name,
        x: x / CELL_PX,
        y: y / CELL_PX,
        wet: S[k] < 0,
        ripple: rule.ripple === true,
      };
      if (rule.kind === 'reedbed') {
        item.kind = 'reedbed';
        item.reed = {
          rx: Math.round(lerp(rule.rx[0], rule.rx[1], rnd())),
          ry: Math.round(lerp(rule.ry[0], rule.ry[1], rnd())),
          height: Math.round(lerp(rule.height[0], rule.height[1], rnd())),
          source: pick(REED_SOURCES),
          offset: rnd(),
          seed: (seed + out.length) >>> 0,
        };
      } else {
        item.kind = 'sprite';
        item.sprite = pick(rule.ids);
      }
      const record = { px: x, py: y, clear: rule.clear ?? 0 };
      mine.push(record);
      placed.push(record);
      out.push(item);
    }
  }
  return out;
}
