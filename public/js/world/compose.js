// Draws the static scene once into an offscreen canvas at native art size (research R6).
// Order: base grass, ground patches, the shore bands, the water layer, then every overlay (scenery and
// shore decor) sorted by foot y, so a lower overlay covers one above it (FR-006).
// Water follows the art pack's water spec (WATER-SPEC §3.5 to §3.8, grass style; BUG-002): everything
// is painted through masks derived from the signed distance S of the water field (water.js). Nothing
// is animated: one water frame, no drift, one fixed foam phase (FR-005). No sprite is rotated (FR-025).
// Uses the DOM (an offscreen canvas), so it is not part of the Node tests.

import { CELL_PX, depthOrder } from './layout.js';
import { waterField, GRASS_STYLE, fbm, vnoise, bayer, lerp, clamp } from './water.js';

const WATER_FRAME = 'water-water-001';
const LUSH_GRASS = 'rocks2-terrain-020';
const BANK_FACE = 'beach-terrain-007';

// Grass style colours (WATER-SPEC §4.3)
const MUD_LINE = { color: 'rgba(72,58,22,0.55)', toPx: 1.8, rag: 1.0 };
const FACE_TINT = 'rgba(66,40,12,0.60)';
const WATERLINE = 'rgba(10,18,36,0.55)';
const WATER = {
  tint: 'rgba(30,110,80,0.24)',
  shallow: [[6, 'rgba(70,150,110,0.28)'], [2.5, 'rgba(110,170,110,0.30)']],
  shadow: { h: 2, color: 'rgba(0,25,30,0.32)' },
  rim: 'rgba(205,235,210,0.45)',
  foam: 'rgba(220,240,225,0.32)',
};
const RIPPLE = 'rgba(225,240,250,0.6)';
const REED_RIPPLE = 'rgba(225,240,250,0.55)';

// Returns a canvas of cols × rows × CELL_PX pixels.
// shores: from shorePlacements, foot points in cells.
export function composeScene({ config, sprites, logic, ground, shores }) {
  const { cols, rows } = config.grid;
  const canvas = makeCanvas(cols * CELL_PX, rows * CELL_PX);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const draw = (id, x, y) => {
    const s = sprites.get(id);
    ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, Math.round(x), Math.round(y), s.sw, s.sh);
  };

  // 1. Base grass, one 32 px tile per cell
  ground.base.forEach((id, i) => {
    draw(id, (i % cols) * CELL_PX, Math.floor(i / cols) * CELL_PX);
  });

  // 2. Meadow, dark-grass, cobble and gravel patches, at their native size
  for (const p of ground.patches) draw(p.sprite, p.x, p.y);

  // 3. Shore bands and the water layer
  const field = waterField(config);
  if (field.region !== null && field.region.w > 0 && field.region.h > 0) {
    drawWater(ctx, field, sprites, config.seed);
  }

  // 4. Overlays: scenery and shore decor, lower on the map drawn over higher ones
  for (const o of depthOrder([...logic.objects, ...shores])) {
    const px = Math.round(o.x * CELL_PX);
    const py = Math.round(o.y * CELL_PX);
    if (o.reed) {
      const bed = reedBed(sprites, o.reed);
      if (o.wet && o.ripple) ripple(ctx, px, py - 1, bed.rx + 2, Math.max(2, bed.ry * 0.6), REED_RIPPLE);
      ctx.drawImage(bed.canvas, px - bed.ax, py - bed.ay);
      continue;
    }
    const s = sprites.get(o.sprite);
    if (o.wet && o.ripple) {
      const rx = clamp(s.w * 0.42, 4, 26);
      ripple(ctx, px, py - 1, rx, Math.max(2, rx * 0.28), RIPPLE);
    }
    draw(o.sprite, px - s.anchor.x, py - s.anchor.y);
  }

  return canvas;
}

// The shore bands and the water, painted inside the region around all water bodies.
function drawWater(ctx, field, sprites, seed) {
  const { W, S, Wsh, U, RUN } = field;
  const { x0, y0, w, h } = field.region;
  const N = w * h;
  const isWater = (k) => S[k] < 0;

  // A binary mask canvas of the region: alpha 255 where test(x, y, k) holds (k indexes the world).
  const mask = (test) => {
    const c = makeCanvas(w, h);
    const m = c.getContext('2d');
    const img = m.createImageData(w, h);
    const d = img.data;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        if (test(x0 + x, y0 + y, (y0 + y) * W + x0 + x)) d[i * 4 + 3] = 255;
      }
    }
    m.putImageData(img, 0, 0);
    return c;
  };

  // Fill a region canvas through a mask. fill is a colour or a world-aligned pattern.
  const tmp = makeCanvas(w, h);
  const t = tmp.getContext('2d');
  t.imageSmoothingEnabled = false;
  const paint = (dst, fill, m) => {
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, w, h);
    t.save();
    t.translate(-x0, -y0);
    t.fillStyle = fill;
    t.fillRect(x0, y0, w, h);
    t.restore();
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(m, 0, 0);
    t.globalCompositeOperation = 'source-over';
    dst.drawImage(tmp, 0, 0);
  };
  const pattern = (id, fillHoles) => t.createPattern(tile(sprites, id, fillHoles), 'repeat');

  // Bank face height per water pixel (WATER-SPEC §3.5), capped on narrow water
  const [h0, h1] = GRASS_STYLE.face;
  const faceH = new Float32Array(N);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const k = (y0 + y) * W + x0 + x;
      if (!isWater(k)) continue;
      const fh = lerp(h0, h1, vnoise((x0 + x) / 9, (y0 + y) / 40, seed + 11));
      faceH[i] = Math.min(Math.round(fh), Math.floor(RUN[k] * 0.3));
    }
  }
  const face = (x, y) => faceH[(y - y0) * w + (x - x0)];

  // Ground side: the lush grass band to a ragged outer edge, then the mud line (WATER-SPEC §3.6)
  const bands = makeCanvas(w, h);
  const b = bands.getContext('2d');
  paint(b, pattern(LUSH_GRASS, false), mask((x, y, k) => {
    if (isWater(k) || S[k] > 20) return false;
    return S[k] < Wsh[k] + fbm(x / 5, y / 5, seed + 5) * GRASS_STYLE.outerRag;
  }));
  paint(b, MUD_LINE.color, mask((x, y, k) => {
    if (isWater(k) || S[k] > 4) return false;
    return S[k] < MUD_LINE.toPx + fbm(x / 4, y / 4, seed + 13) * MUD_LINE.rag + bayer(x, y) * 0.8;
  }));
  ctx.drawImage(bands, x0, y0);

  // Water side: the static frame, then tint, shallows, bank face, waterline, shadow, rim and foam,
  // all clipped to the water mask (WATER-SPEC §3.7, without motion)
  const waterMask = mask((x, y, k) => isWater(k));
  const layer = makeCanvas(w, h);
  const l = layer.getContext('2d');
  l.imageSmoothingEnabled = false;
  paint(l, pattern(WATER_FRAME, false), waterMask);
  paint(l, WATER.tint, waterMask);
  for (const [depth, color] of WATER.shallow) {
    paint(l, color, mask((x, y, k) => isWater(k) && -S[k] < depth + bayer(x, y) * 1.6 + fbm(x / 11, y / 11, seed + 17) * 1.2));
  }
  const faceMask = mask((x, y, k) => isWater(k) && U[k] <= face(x, y));
  paint(l, pattern(BANK_FACE, true), faceMask);
  paint(l, FACE_TINT, faceMask);
  paint(l, WATERLINE, mask((x, y, k) => isWater(k) && U[k] === face(x, y) + 1));
  const below = (x, y, k) => U[k] > face(x, y) + 1;
  paint(l, WATER.shadow.color, mask((x, y, k) => isWater(k) && below(x, y, k) && U[k] <= face(x, y) + 1 + WATER.shadow.h));
  paint(l, WATER.rim, mask((x, y, k) => isWater(k) && -S[k] < 1.1 && below(x, y, k)));
  // One fixed foam phase: a broken line a little off the shore. It never moves (FR-005).
  paint(l, WATER.foam, mask((x, y, k) => {
    if (!isWater(k) || U[k] <= face(x, y) + 1 + WATER.shadow.h) return false;
    const r = 2.2 + fbm(x / 9, y / 9, seed + 19) * 0.9;
    return Math.abs(-S[k] - r) < 0.55 && vnoise(x / 2.5, y / 2.5, seed + 23) > 0.42;
  }));
  ctx.drawImage(layer, x0, y0);
}

// A seamless texture canvas from a terrain tile. fillHoles plugs the transparent centre that many
// ground tiles have with a half-offset copy underneath (WATER-SPEC §3.1).
const tiles = new Map();
function tile(sprites, id, fillHoles) {
  const key = `${id}${fillHoles ? '+' : ''}`;
  if (tiles.has(key)) return tiles.get(key);
  const s = sprites.get(id);
  const c = makeCanvas(s.sw, s.sh);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const blit = (dx, dy) => x.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, dx, dy, s.sw, s.sh);
  if (fillHoles) {
    const hx = Math.floor(s.sw / 2);
    const hy = Math.floor(s.sh / 2);
    for (const [dx, dy] of [[hx, hy], [hx - s.sw, hy], [hx, hy - s.sh], [hx - s.sw, hy - s.sh]]) blit(dx, dy);
  }
  blit(0, 0);
  tiles.set(key, c);
  return c;
}

// A reed bed: the rectangular tall-grass sprite cut to a clump with a jagged, blade-like top
// (WATER-SPEC §6.3). The raw rectangle is never drawn.
function reedBed(sprites, reed) {
  const { rx, ry, height: ht, source, offset, seed } = reed;
  const w = rx * 2 + 1;
  const h = ht + ry * 2 + 2;
  const cy = ht + ry;
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const s = sprites.get(source);
  const ox = Math.floor(offset * Math.max(1, s.sw - 8));
  for (let tx = -ox; tx < w; tx += s.sw) x.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, tx, 0, s.sw, s.sh);

  const m = makeCanvas(w, h);
  const mc = m.getContext('2d');
  const img = mc.createImageData(w, h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const ex = (px - rx) / rx;
      if (Math.abs(ex) >= 1) continue;
      const e = Math.sqrt(1 - ex * ex);
      const bottom = cy + ry * e + (vnoise(px / 3, 0, seed) - 0.5) * 2;
      const top = cy - ry * e - ht * e * (0.45 + 0.55 * vnoise(px / 1.6, 7, seed + 1));
      if (py >= top && py <= bottom) img.data[(py * w + px) * 4 + 3] = 255;
    }
  }
  mc.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(m, 0, 0);
  return { canvas: c, ax: rx, ay: cy + ry, rx, ry };
}

// A 1 px ring around a foot point that stands in water (WATER-SPEC §6.2).
function ripple(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  const n = Math.ceil(rx * 4);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1);
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
