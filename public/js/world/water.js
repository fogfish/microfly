// Water field: the signed distance S from every scene pixel to the waterline (BUG-002, FR-028).
// Ported from the art pack's reference renderer (zrpg-art/examples/water.js, WATER-SPEC.md §3).
// Water is never built from cells. Each body is a wobbly ellipse (`blob`) or a winding, varying-width
// band (`river`, BUG-001, contracts/world-format-sketch-map.md §6) rasterised into a pixel mask; an
// exact distance transform gives S (< 0 in water, >= 0 on land), roughened by seeded noise.
// Everything else (shore bands, bank face, decor, the logic grid) is derived from S. Pure: no DOM.

import { createPrng } from './prng.js';

// Units are scene px at 1×. CELL_PX is repeated here to keep this module free of imports from layout.js.
const CELL_PX = 32;

// Padding around a body's box, so distances stay correct near the box edge (WATER-SPEC §3.2).
export const PAD = 48;

// Grass shore style (WATER-SPEC §4.3), the only style in this world (FR-012).
export const GRASS_STYLE = {
  shoreWidth: [4, 11],
  edgeRag: 1.2,
  outerRag: 4,
  face: [2, 4],
};

// Body size ranges in px (FR-011, art pack ponds.md and lakes.md). puddle (BUG-001): the zrpg-art
// reference's own swamp-pool chain (world.js WATER.bodies, rx 11-30 ref-px), smaller than any pond.
export const BODY_RANGES = {
  puddle: { rx: [15, 50], ratio: [0.45, 0.85], wobble: [0.2, 0.35], harmonics: [2, 4] },
  pond: { rx: [60, 100], ratio: [0.65, 0.8], wobble: [0.08, 0.14], harmonics: [3, 5] },
  lake: { rx: [180, 260], ratio: [0.55, 0.65], wobble: [0.14, 0.24], harmonics: [5, 7] },
};

// River width-noise default (BUG-001, contracts/world-format-sketch-map.md §6, WATER-SPEC §3.2 "river").
const RIVER_WIDTH_NOISE = 0.2;

// Which range a blob falls in, or null. blob is in cells.
export function bodyKind(blob) {
  const rx = blob.rx * CELL_PX;
  const ratio = blob.ry / blob.rx;
  const within = (v, [a, b]) => v >= a - 1e-9 && v <= b + 1e-9;
  for (const [kind, r] of Object.entries(BODY_RANGES)) {
    if (within(rx, r.rx) && within(ratio, r.ratio) && within(blob.wobble, r.wobble) && within(blob.harmonics, r.harmonics)) {
      return kind;
    }
  }
  return null;
}

// ------------------------------------------------------------------ noise

export function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise in [0, 1)
export function vnoise(x, y, s) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s);
  const b = hash2(ix + 1, iy, s);
  const c = hash2(ix, iy + 1, s);
  const d = hash2(ix + 1, iy + 1, s);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

// Fractal noise in about [-1, 1]
export function fbm(x, y, s, octaves = 3) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (vnoise(x * f, y * f, s + i * 101) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// 4 × 4 ordered dither offsets in [-0.5, 0.5)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------- exact distance transform
// Felzenszwalb and Huttenlocher squared EDT, O(n).

const INF = 1e20;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// Distance from every pixel to the nearest pixel where site[i] is set.
export function edt(site, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = site[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = g[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
  }
  return g;
}

// ------------------------------------------------------------------ shapes

// The harmonics of a blob: r(θ) = 1 + Σ a_k·sin(kθ + φ_k), k = 2 … n+1 (WATER-SPEC §3.2).
export function blobShape(blob, seed) {
  const rnd = createPrng(seed).next;
  const n = blob.harmonics;
  const terms = [];
  let total = 0;
  for (let k = 2; k <= n + 1; k++) {
    const a = (blob.wobble * (0.4 + 0.6 * rnd())) / Math.pow(k - 1, 0.7);
    terms.push({ k, a, phase: rnd() * Math.PI * 2 });
    total += a;
  }
  return { terms, total };
}

// Seed of body i: the same world seed and body order always give the same outline (FR-031).
export const bodySeed = (seed, i) => (Math.imul(seed, 31) + i * 977) >>> 0;

// Box of a body in scene px, including PAD: { x0, y0, w, h }. May extend past the world.
function bodyBox(blob, shape) {
  const cx = blob.cx * CELL_PX;
  const cy = blob.cy * CELL_PX;
  const ex = blob.rx * CELL_PX * (1 + shape.total) + 2 + PAD;
  const ey = blob.ry * CELL_PX * (1 + shape.total) + 2 + PAD;
  const x0 = Math.floor(cx - ex);
  const y0 = Math.floor(cy - ey);
  return { x0, y0, w: Math.ceil(cx + ex) - x0, h: Math.ceil(cy + ey) - y0 };
}

// Signed distance of one body inside its box (no noise): < 0 in water.
function bodyDistance(blob, shape, box) {
  const { x0, y0, w, h } = box;
  const cx = blob.cx * CELL_PX;
  const cy = blob.cy * CELL_PX;
  const rx = blob.rx * CELL_PX;
  const ry = blob.ry * CELL_PX;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x0 + x + 0.5 - cx) / rx;
      const dy = (y0 + y + 0.5 - cy) / ry;
      const th = Math.atan2(dy, dx);
      let r = 1;
      for (const t of shape.terms) r += t.a * Math.sin(t.k * th + t.phase);
      if (dx * dx + dy * dy < r * r) mask[y * w + x] = 1;
    }
  }
  const dOut = edt(mask, w, h);
  const dIn = edt(mask.map((v) => 1 - v), w, h);
  const s = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) s[i] = mask[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5;
  return s;
}

// ------------------------------------------------------------- river shape (BUG-001)
// A river is a winding band of varying width, not a wobbly ellipse: `outline.river = { path, width,
// widthNoise? }` (contracts/world-format-sketch-map.md §6). Modelled on the art pack's `river` body kind
// (WATER-SPEC §3.2): sample a Catmull-Rom spline through `path`, stamp a disc of the arc-length-lerped
// `width` at every sample, then run the same mask → exact-distance-transform pipeline `bodyDistance`
// already uses for `blob`. `path` points may fall outside the grid (a river "starts above the canvas" or
// "ends below the canvas", WATER-SPEC §1.7) — the box below is sized from the points themselves, not
// clamped to the grid, the same way `bodyBox` lets a blob's box extend past the world.

const RIVER_STEPS_PER_SEGMENT = 20;

// One Catmull-Rom point at parameter t in [0, 1] between p1 and p2, using p0/p3 as tangent neighbours.
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const a = (k) => 0.5 * (
    2 * p1[k]
    + (-p0[k] + p2[k]) * t
    + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3
  );
  return [a(0), a(1)];
}

// The river's centreline, densely sampled in scene px, each point carrying `t`: its arc-length fraction
// (0 at the first point, 1 at the last) used to lerp `width` (WATER-SPEC §3.2).
function riverSamples(river) {
  const pts = river.path.map(([x, y]) => [x * CELL_PX, y * CELL_PX]);
  const n = pts.length;
  const raw = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < RIVER_STEPS_PER_SEGMENT; s++) raw.push(catmullRom(p0, p1, p2, p3, s / RIVER_STEPS_PER_SEGMENT));
  }
  raw.push(pts[n - 1]);
  let total = 0;
  const out = [{ x: raw[0][0], y: raw[0][1], len: 0 }];
  for (let i = 1; i < raw.length; i++) {
    total += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    out.push({ x: raw[i][0], y: raw[i][1], len: total });
  }
  return out.map((p) => ({ x: p.x, y: p.y, t: total > 0 ? p.len / total : 0 }));
}

// Box of a river body in scene px, including PAD: { x0, y0, w, h }. Points may lie outside the grid.
function riverBox(river) {
  const maxWidthPx = Math.max(river.width[0], river.width[1]) * CELL_PX;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of river.path) {
    const px = x * CELL_PX;
    const py = y * CELL_PX;
    x0 = Math.min(x0, px);
    y0 = Math.min(y0, py);
    x1 = Math.max(x1, px);
    y1 = Math.max(y1, py);
  }
  const ex = maxWidthPx / 2 + 2 + PAD;
  const bx0 = Math.floor(x0 - ex);
  const by0 = Math.floor(y0 - ex);
  return { x0: bx0, y0: by0, w: Math.ceil(x1 + ex) - bx0, h: Math.ceil(y1 + ex) - by0 };
}

// Signed distance of one river body inside its box (no waterline noise): < 0 in water.
function riverDistance(river, seed, box) {
  const { x0, y0, w, h } = box;
  const mask = new Uint8Array(w * h);
  const samples = riverSamples(river);
  const [w0, w1] = river.width;
  const noiseAmt = river.widthNoise ?? RIVER_WIDTH_NOISE;
  const phase = createPrng(seed).next() * 1000;
  for (const p of samples) {
    const widthCells = lerp(w0, w1, p.t) * (1 + noiseAmt * fbm(p.x / CELL_PX / 10 + phase, p.y / CELL_PX / 10 + phase, seed));
    const r = Math.max(1, (widthCells * CELL_PX) / 2);
    const rCeil = Math.ceil(r);
    const cx = Math.round(p.x - x0);
    const cy = Math.round(p.y - y0);
    for (let dy = -rCeil; dy <= rCeil; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= h) continue;
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= w) continue;
        if (dx * dx + dy * dy <= r * r) mask[py * w + px] = 1;
      }
    }
  }
  const dOut = edt(mask, w, h);
  const dIn = edt(mask.map((v) => 1 - v), w, h);
  const s = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) s[i] = mask[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5;
  return s;
}

// ------------------------------------------------------------- the field

// Distance beyond which nothing water-related is drawn or placed; S is left without noise there.
const NEAR = PAD;

// The water field of a world. bodies: [{ id, outline: { blob } }] (valid only). Returns
// { W, H, S, Wsh, U, RUN, label, region, bodies: [{ id, kind, box, perimeter }] }.
// S, Wsh, U and RUN are Float32Array of W × H. label is the body index + 1 nearest each pixel
// near water (0 elsewhere). region is the box around all bodies, clipped to the world.
export function buildWaterField({ cols, rows, seed, bodies }) {
  const W = cols * CELL_PX;
  const H = rows * CELL_PX;
  const N = W * H;
  const S = new Float32Array(N).fill(INF);
  const label = new Uint8Array(N);
  const info = [];
  let region = null;

  bodies.forEach((body, i) => {
    const bodySd = bodySeed(seed, i);
    const river = body.outline.river;
    const blob = body.outline.blob;
    const shape = river ? null : blobShape(blob, bodySd);
    const box = river ? riverBox(river) : bodyBox(blob, shape);
    const s = river ? riverDistance(river, bodySd, box) : bodyDistance(blob, shape, box);
    for (let y = 0; y < box.h; y++) {
      const wy = box.y0 + y;
      if (wy < 0 || wy >= H) continue;
      for (let x = 0; x < box.w; x++) {
        const wx = box.x0 + x;
        if (wx < 0 || wx >= W) continue;
        const v = s[y * box.w + x];
        const k = wy * W + wx;
        if (v < S[k]) {
          S[k] = v;
          label[k] = i + 1;
        }
      }
    }
    const clipped = clipBox(box, W, H);
    region = region === null ? clipped : unionBox(region, clipped);
    info.push({ id: body.id, kind: river ? 'river' : bodyKind(blob), box: clipped, perimeter: 0 });
  });

  // Waterline noise and shore width, only near water (WATER-SPEC §3.3)
  const [w0, w1] = GRASS_STYLE.shoreWidth;
  const Wsh = new Float32Array(N).fill((w0 + w1) / 2);
  if (region !== null) {
    forBox(region, W, (x, y, k) => {
      if (S[k] > NEAR) return;
      S[k] += fbm(x / 7, y / 7, seed + 3) * GRASS_STYLE.edgeRag;
      Wsh[k] = lerp(w0, w1, 0.5 + 0.5 * fbm(x / 70, y / 70, seed + 7, 2));
    });
  }

  // U: water pixels counted down from the nearest land pixel straight above. RUN: the length of the
  // vertical water run a pixel belongs to. Both drive the bank face (WATER-SPEC §3.5).
  const U = new Float32Array(N);
  const RUN = new Float32Array(N);
  if (region !== null) {
    for (let x = region.x0; x < region.x0 + region.w; x++) {
      let u = 0;
      for (let y = region.y0; y < region.y0 + region.h; y++) {
        const k = y * W + x;
        u = S[k] < 0 ? u + 1 : 0;
        U[k] = u;
      }
      let d = 0;
      for (let y = region.y0 + region.h - 1; y >= region.y0; y--) {
        const k = y * W + x;
        d = S[k] < 0 ? d + 1 : 0;
        RUN[k] = d ? U[k] + d - 1 : 0;
      }
    }
    // Shoreline length per body: water pixels within 1 px of the waterline
    forBox(region, W, (x, y, k) => {
      if (S[k] < 0 && S[k] >= -1 && label[k]) info[label[k] - 1].perimeter++;
    });
  }

  return { W, H, S, Wsh, U, RUN, label, region, bodies: info };
}

// Logic water: a cell is water when S < 0 at its centre (FR-016).
export function cellWater(field, cols, rows) {
  const water = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const k = (cy * CELL_PX + CELL_PX / 2) * field.W + cx * CELL_PX + CELL_PX / 2;
      if (field.S[k] < 0) water[cy * cols + cx] = 1;
    }
  }
  return water;
}

// S at a point in cells.
export function distanceAt(field, x, y) {
  const px = clamp(Math.floor(x * CELL_PX), 0, field.W - 1);
  const py = clamp(Math.floor(y * CELL_PX), 0, field.H - 1);
  return field.S[py * field.W + px];
}

// The field of a world definition, cached per definition object (validate, layout and compose share it).
const cache = new WeakMap();
export function waterField(config) {
  if (!cache.has(config)) {
    const { cols, rows } = config.grid;
    cache.set(config, buildWaterField({ cols, rows, seed: config.seed, bodies: config.waterBodies ?? [] }));
  }
  return cache.get(config);
}

export function forBox(box, W, fn) {
  for (let y = box.y0; y < box.y0 + box.h; y++) {
    for (let x = box.x0; x < box.x0 + box.w; x++) fn(x, y, y * W + x);
  }
}

function clipBox(b, W, H) {
  const x0 = Math.max(0, b.x0);
  const y0 = Math.max(0, b.y0);
  const x1 = Math.min(W, b.x0 + b.w);
  const y1 = Math.min(H, b.y0 + b.h);
  return { x0, y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

function unionBox(a, b) {
  const x0 = Math.min(a.x0, b.x0);
  const y0 = Math.min(a.y0, b.y0);
  return { x0, y0, w: Math.max(a.x0 + a.w, b.x0 + b.w) - x0, h: Math.max(a.y0 + a.h, b.y0 + b.h) - y0 };
}
