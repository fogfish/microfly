// Water for the sketch map (contracts/world-format-sketch-map.md §7, BUG-002): a pure port of the art pack's
// reference water renderer (zrpg-art examples/water.js, WATER-SPEC.md), grass shore style only. Pure: no DOM.
// It returns the fields and the decor placements; world/sketch-paint.js paints them.
//
//   bodies -> water mask -> signed distance S -> shore width Wsh, bank bias B, column runs U/RUN -> decor
//
// Units are scene px. S < 0 is water, S > 0 is land, 0 on the waterline.

import { createPrng } from './prng.js';
import { fbm, edt, lerp, clamp } from './water.js';

// Bodies are rasterised on a grid padded on every side, so a river that starts off the map flows in (WATER-SPEC §4).
const PAD = 48;
const INF = 1e20;

const GRASS_SPRIGS = ['beach-plant-004', 'beach-plant-005', 'beach-plant-006', 'beach-plant-007', 'beach-plant-008',
  'beach-plant-010', 'beach-plant-011', 'beach-plant-012'];

// Grass shore style (WATER-SPEC §4.3). Sprite ids are of the zrpg-art catalogue (assets/atlas/catalog.json).
export const GRASS = {
  ground: 'rocks2-terrain-052',
  shoreWidth: [4, 11],
  edgeRag: 1.2,
  outerRag: 4,
  bands: [
    { name: 'lush grass', tex: 'rocks2-terrain-066', to: 1 },
    { name: 'mud line', color: 'rgba(72,58,22,0.55)', toPx: 1.8, rag: 1.0 },
  ],
  face: { h: [2, 4], tex: 'beach-terrain-017', fillHoles: true, tint: 'rgba(66,40,12,0.60)' },
  water: {
    tint: 'rgba(30,110,80,0.24)',
    shallow: [[6, 'rgba(70,150,110,0.28)'], [2.5, 'rgba(110,170,110,0.30)']],
    shadow: { h: 2, color: 'rgba(0,25,30,0.32)' },
    rim: 'rgba(205,235,210,0.45)',
    foam: 'rgba(220,240,225,0.32)',
  },
  decor: [
    { name: 'meadow flowers', ids: ['trees-plant-001', 'trees-plant-002', 'trees-plant-003'], s: [40, 1e9], per100: 0.8, spacing: 22 },
    { name: 'reed beds', kind: 'reedbed', s: [-5, 1], per100: 0.32, spacing: 56, clear: 16, ripple: true, rx: [9, 20], ry: [4, 7], height: [14, 26] },
    { name: 'waterline stones', ids: ['rocks2-rock-042', 'rocks2-rock-040'], s: [-2, 2], per100: 0.35, spacing: 40, clear: 5, ripple: true },
    { name: 'mossy log', ids: ['jungle-prop-007'], s: [-3, 3], per100: 0.05, spacing: 400, clear: 14, ripple: true, max: 1, minPerimeter: 900 },
    { name: 'tufts', ids: ['trees-plant-006', 'trees-plant-007', 'jungle-plant-011', 'beach-plant-015'], t: [0.0, 1.3], per100: 3.6, spacing: 10, clear: 3 },
    { name: 'sprigs', ids: GRASS_SPRIGS, t: [0.2, 1.8], per100: 3.0, spacing: 7 },
    { name: 'ferns', ids: ['trees-plant-008', 'jungle-bush-008'], t: [1.0, 2.6], per100: 0.35, spacing: 50, clear: 12 },
    // The art pack's "wild flowers" (blue_flower, white_flower_sprout, red_flower_plant) are left out: the first two
    // are removed from every world (spec 009 FR-009) and red_flower_plant is the small food (FOOD_SPRITE_IDS).
  ],
};

// ------------------------------------------------------------------ shapes

// blob: ellipse with harmonic wobble (lakes, pools, islands). value 1 paints water, 0 paints land back.
function rasterBlob(grid, b, seed, value) {
  const { gw, gh, mask } = grid;
  const rnd = createPrng(seed >>> 0).next;
  const n = b.harmonics ?? 4;
  const wob = b.wobble ?? 0.12;
  const amp = [];
  const ph = [];
  let total = 0;
  for (let k = 2; k <= n + 1; k++) {
    amp[k] = (wob * (0.4 + 0.6 * rnd())) / Math.pow(k - 1, 0.7);
    ph[k] = rnd() * Math.PI * 2;
    total += amp[k];
  }
  const cx = b.x + PAD;
  const cy = b.y + PAD;
  const ex = b.rx * (1 + total) + 2;
  const ey = b.ry * (1 + total) + 2;
  for (let y = Math.max(0, Math.floor(cy - ey)); y < Math.min(gh, cy + ey); y++) {
    for (let x = Math.max(0, Math.floor(cx - ex)); x < Math.min(gw, cx + ex); x++) {
      const dx = (x + 0.5 - cx) / b.rx;
      const dy = (y + 0.5 - cy) / b.ry;
      const th = Math.atan2(dy, dx);
      let r = 1;
      for (let k = 2; k <= n + 1; k++) r += amp[k] * Math.sin(k * th + ph[k]);
      if (dx * dx + dy * dy < r * r) mask[y * gw + x] = value;
    }
  }
}

// Catmull-Rom centreline sampled every ~2 px, with tangent and smoothed signed curvature (+ turns left).
function samplePath(pts) {
  const P = pts.map((p) => [p[0] + PAD, p[1] + PAD]);
  const out = [];
  let s = 0;
  let px = P[0][0];
  let py = P[0][1];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let j = i === 0 ? 0 : 1; j <= n; j++) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const x = f(p0[0], p1[0], p2[0], p3[0]);
      const y = f(p0[1], p1[1], p2[1], p3[1]);
      s += Math.hypot(x - px, y - py);
      px = x;
      py = y;
      out.push({ x, y, s });
    }
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 2)];
    const b = out[Math.min(out.length - 1, i + 2)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    out[i].tx = (b.x - a.x) / l;
    out[i].ty = (b.y - a.y) / l;
  }
  const W = 10;
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - W)];
    const b = out[Math.min(out.length - 1, i + W)];
    const cross = a.tx * b.ty - a.ty * b.tx;
    const len = Math.max(1, b.s - a.s);
    out[i].k = Math.asin(clamp(cross, -1, 1)) / len;
  }
  return out;
}

// river: a union of discs along the centreline; the width runs from width[0] to width[1] with noise.
function rasterRiver(grid, b, seed) {
  const { gw, gh, mask } = grid;
  const path = samplePath(b.path);
  const L = path[path.length - 1].s;
  const wn = b.widthNoise ?? 0.2;
  for (const p of path) {
    const w = lerp(b.width[0], b.width[1], p.s / L) * (1 + wn * fbm(p.s / 60, 0.5, seed));
    p.hw = w / 2;
    const r = p.hw;
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(p.y - r)); y <= Math.min(gh - 1, Math.ceil(p.y + r)); y++) {
      for (let x = Math.max(0, Math.floor(p.x - r)); x <= Math.min(gw - 1, Math.ceil(p.x + r)); x++) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        if (dx * dx + dy * dy <= r2) mask[y * gw + x] = 1;
      }
    }
  }
  return path;
}

// ------------------------------------------------------------- fields

// scene: { width, height, bodies } in scene px. Returns { W, H, S, Wsh, B, U, RUN, rivers }.
export function buildWaterFields(scene, seed, style = GRASS) {
  const W = scene.width;
  const H = scene.height;
  const gw = W + 2 * PAD;
  const gh = H + 2 * PAD;
  const grid = { gw, gh, mask: new Uint8Array(gw * gh) };
  const rivers = [];
  scene.bodies.forEach((b, i) => {
    const bs = seed * 31 + i * 977;
    if (b.kind === 'blob') rasterBlob(grid, b, bs, 1);
    else if (b.kind === 'island') rasterBlob(grid, b, bs, 0);
    else if (b.kind === 'river') rivers.push(rasterRiver(grid, b, bs));
    else throw new Error(`unknown water body kind ${b.kind}`);
  });

  const m = grid.mask;
  const dOut = edt(m, gw, gh);
  const dIn = edt(m.map((v) => 1 - v), gw, gh);

  // Bend bias: a wider shore inside a river bend, a narrow one and a taller bank on the outside (WATER-SPEC §3.4).
  const C = 4;
  const cw = Math.ceil(gw / C);
  const ch = Math.ceil(gh / C);
  const coarse = new Float32Array(cw * ch).fill(1);
  if (rivers.length) {
    const pts = [].concat(...rivers.map((r) => r.filter((_, i) => i % 3 === 0)));
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const x = cx * C + C / 2;
        const y = cy * C + C / 2;
        let best = null;
        let bd = INF;
        for (const p of pts) {
          const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (!best || Math.sqrt(bd) > best.hw + 60) continue;
        const side = Math.sign(best.tx * (y - best.y) - best.ty * (x - best.x));
        const k = clamp(best.k * 45, -1, 1);
        coarse[cy * cw + cx] = clamp(1 + 1.1 * k * side, 0.35, 2.2);
      }
    }
  }
  const bias = (gx, gy) => coarse[Math.min(ch - 1, (gy / C) | 0) * cw + Math.min(cw - 1, (gx / C) | 0)];

  const N = W * H;
  const S = new Float32Array(N);
  const Wsh = new Float32Array(N);
  const B = new Float32Array(N);
  const [w0, w1] = style.shoreWidth;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gi = (y + PAD) * gw + x + PAD;
      const i = y * W + x;
      const raw = m[gi] ? -(dIn[gi] - 0.5) : dOut[gi] - 0.5;
      S[i] = raw + fbm(x / 7, y / 7, seed + 3) * style.edgeRag;
      B[i] = bias(x + PAD, y + PAD);
      Wsh[i] = lerp(w0, w1, 0.5 + 0.5 * fbm(x / 70, y / 70, seed + 7, 2)) * B[i];
    }
  }
  // U: px below the nearest land pixel straight above (water only), for the 3/4-view bank face.
  const U = new Float32Array(N);
  for (let x = 0; x < W; x++) {
    let u = 0;
    for (let y = -PAD; y < 0; y++) u = m[(y + PAD) * gw + x + PAD] ? u + 1 : 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      u = S[i] < 0 ? u + 1 : 0;
      U[i] = u;
    }
  }
  // RUN: length of the vertical water run a pixel belongs to, so a brook is not covered by its own bank.
  const RUN = new Float32Array(N);
  for (let x = 0; x < W; x++) {
    let d = 0;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      d = S[i] < 0 ? d + 1 : 0;
      RUN[i] = d ? U[i] + d - 1 : 0;
    }
  }
  return { W, H, S, Wsh, B, U, RUN, rivers };
}

// ------------------------------------------------------------- decor

// Shore decor along the waterline (WATER-SPEC §6). Returns plain records:
// { x, y, layer: 'sprite' | 'ground', id, wet, ripple, reed? } where reed = { rx, ry, height, source, offset, seed }.
// filter(x, y, rule) may veto a spot (the sand beach has no reeds, WORLD-SPEC §4). forbidden: ids never placed.
export function placeWaterDecor(F, { seed, density = 1, filter = null, forbidden = new Set(), catalog }, style = GRASS) {
  const { W, H, S, Wsh } = F;
  const N = W * H;
  const rnd = createPrng((seed * 7 + 1) >>> 0).next;
  let perimeter = 0;
  for (let i = 0; i < N; i++) if (S[i] < 0 && S[i] >= -1) perimeter++;

  const placed = [];
  const out = [];
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  for (const rule of style.decor) {
    if (rule.minPerimeter && perimeter < rule.minPerimeter) continue;
    const ids = rule.ids?.filter((id) => !forbidden.has(id));
    if (ids !== undefined && ids.length === 0) continue;
    const inBand = (i) => {
      if (rule.s) return S[i] >= rule.s[0] && S[i] <= rule.s[1];
      const t = S[i] / Wsh[i];
      return S[i] >= 0 && t >= rule.t[0] && t <= rule.t[1];
    };
    const cand = [];
    for (let y = 6; y < H - 2; y++) for (let x = 4; x < W - 4; x++) if (inBand(y * W + x)) cand.push(y * W + x);
    if (!cand.length) continue;
    let want = Math.round((rule.per100 * perimeter) / 100 * density + rnd() * 0.6);
    if (rule.max) want = Math.min(want, rule.max);
    const mine = [];
    const ok = (x, y) => {
      if (x < 4 || y < 6 || x >= W - 4 || y >= H - 2 || !inBand((y | 0) * W + (x | 0))) return false;
      if (filter && !filter(x, y, rule)) return false;
      for (const p of mine) if (Math.hypot(p.x - x, p.y - y) < rule.spacing) return false;
      if (rule.clear) for (const p of placed) if (p.clear && Math.hypot(p.x - x, p.y - y) < rule.clear + p.clear) return false;
      return true;
    };
    for (let a = 0; a < want * 40 && mine.length < want; a++) {
      const c = pick(cand);
      if (!ok(c % W, (c / W) | 0)) continue;
      const x = c % W;
      const y = (c / W) | 0;
      const item = { x, y, layer: rule.layer ?? 'sprite', clear: rule.clear ?? 0, wet: S[y * W + x] < 0, ripple: rule.ripple === true };
      if (rule.kind === 'reedbed') {
        item.id = 'reedbed';
        item.reed = {
          rx: Math.round(lerp(rule.rx[0], rule.rx[1], rnd())),
          ry: Math.round(lerp(rule.ry[0], rule.ry[1], rnd())),
          height: Math.round(lerp(rule.height[0], rule.height[1], rnd())),
          source: rnd() < 0.5 ? 'beach-plant-003' : 'beach-plant-002',
          offset: rnd(),
          seed: seed + out.length,
        };
      } else {
        item.id = ids[Math.floor(rnd() * ids.length)];
        item.class = catalog?.sprites.get(item.id)?.class;
      }
      mine.push(item);
      placed.push(item);
      out.push(item);
    }
  }
  return out;
}

