// Paints a sketch-map plan (world/sketch-map.js) into one static canvas, as the art pack's reference design draws
// its world map (zrpg-art examples/world.js + water.js, WORLD-SPEC §3, contracts/world-format-sketch-map.md §7).
// Layers, bottom to top: grass, shore bands and water at t = 0 with the shore decor; organic ground areas; roads;
// the depth-sorted sprites (map scenery, food, dangers); the finish (warm grade, sun glow, vignette).
// Nothing is animated: one water frame and one foam phase (spec 014 FR-005, WORLD-SPEC §1.3).
// Uses the DOM (canvases), so it is not part of the Node tests.

import { fbm, vnoise, bayer, lerp, clamp } from './water.js';
import { GRASS } from './map-water.js';

const CELL_PX = 32;
const WATERLINE = 'rgba(10,18,36,0.55)';
const RIPPLE = 'rgba(225,240,250,0.6)';
const REED_RIPPLE = 'rgba(225,240,250,0.55)';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

// plan: from mapPlan. sprites: Map<id, { source, sx, sy, sw, sh, anchor }> (render/sprites.js). objects: food and
// dangers, { sprite, x, y } in cells, drawn among the scenery by foot point. waterFrame: the water frame id.
export function paintMap({ plan, sprites, objects = [], waterFrame }) {
  const { W, H } = plan;
  const blit = (ctx, id, x, y) => {
    const s = sprites.get(id);
    ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, Math.round(x), Math.round(y), s.sw, s.sh);
  };
  const draw = (ctx, id, x, y) => {
    const s = sprites.get(id);
    blit(ctx, id, x - s.anchor.x, y - s.anchor.y);
  };
  const tiles = new Map();
  // A seamless texture canvas from a terrain sprite; fillHoles plugs a transparent centre with a half-offset copy
  // underneath (WATER-SPEC §3.1); rows keeps only the top rows (the trampled-grass road band, WORLD-SPEC §6).
  const tile = (id, fillHoles = false, rows = 0) => {
    const key = `${id}${fillHoles ? '+' : ''}${rows}`;
    if (tiles.has(key)) return tiles.get(key);
    const s = sprites.get(id);
    const [c, x] = makeCanvas(s.sw, rows || s.sh);
    if (fillHoles) {
      const hx = Math.floor(s.sw / 2);
      const hy = Math.floor(s.sh / 2);
      for (const [dx, dy] of [[hx, hy], [hx - s.sw, hy], [hx, hy - s.sh], [hx - s.sw, hy - s.sh]]) blit(x, id, dx, dy);
    }
    blit(x, id, 0, 0);
    tiles.set(key, c);
    return c;
  };

  const water = paintWater(plan, { W, H, tile, sprites, draw, blit, waterFrame });
  const ground = paintGround(plan, { W, H, tile, blit, sprites });

  // Sprites: everything sorted by foot y, ties by x (WORLD-SPEC §7)
  const [top, tp] = makeCanvas(W, H);
  const list = [
    ...plan.items.map((it) => ({ id: it.id, x: it.x, y: it.y })),
    ...objects.map((o) => ({ id: o.sprite, x: Math.round(o.x * CELL_PX), y: Math.round(o.y * CELL_PX) })),
  ];
  list.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of list) draw(tp, it.id, it.x, it.y);

  // Flatten and finish (WORLD-SPEC §8)
  const [out, ox] = makeCanvas(W, H);
  ox.drawImage(water, 0, 0);
  ox.drawImage(ground, 0, 0);
  ox.drawImage(top, 0, 0);
  const F = plan.finish;
  ox.globalCompositeOperation = 'soft-light';
  ox.fillStyle = F.warm;
  ox.fillRect(0, 0, W, H);
  const glow = ox.createRadialGradient(W * 0.25, H * 0.1, 0, W * 0.25, H * 0.1, W * 0.7);
  glow.addColorStop(0, F.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ox.globalCompositeOperation = 'screen';
  ox.fillStyle = glow;
  ox.fillRect(0, 0, W, H);
  const vig = ox.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, F.vignette);
  ox.globalCompositeOperation = 'source-over';
  ox.fillStyle = vig;
  ox.fillRect(0, 0, W, H);
  return out;
}

// Layer 1: grass, shore bands, the water at t = 0 and the shore decor (WATER-SPEC §3.5–§3.8, §6).
function paintWater(plan, { W, H, tile, sprites, draw, blit, waterFrame }) {
  const style = GRASS;
  const { S, Wsh, B, U, RUN, decor } = plan.water;
  const N = W * H;
  const seed = plan.water.seed;
  const isWater = (i) => S[i] < 0;

  const [tmp, t] = makeCanvas(W, H);
  const mask = (test) => {
    const [c, m] = makeCanvas(W, H);
    const img = m.createImageData(W, H);
    const d = img.data;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) if (test(x, y, i)) d[i * 4 + 3] = 255;
    m.putImageData(img, 0, 0);
    return c;
  };
  const paint = (dst, fill, m) => {
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.fillStyle = fill;
    t.fillRect(0, 0, W, H);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(m, 0, 0);
    t.globalCompositeOperation = 'source-over';
    dst.drawImage(tmp, 0, 0);
  };
  const pat = (id, holes) => t.createPattern(tile(id, holes), 'repeat');

  // Bank face height per pixel, taller on a cut bank, capped on narrow water
  const faceH = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    const h = lerp(style.face.h[0], style.face.h[1], vnoise(x / 9, y / 40, seed + 11));
    faceH[i] = Math.min(Math.round(h * clamp(2 - B[i], 0.6, 1.8)), Math.floor(RUN[i] * 0.3));
  }
  const outerEdge = (x, y, i) => Wsh[i] + fbm(x / 5, y / 5, seed + 5) * style.outerRag;

  const [out, g] = makeCanvas(W, H);
  g.fillStyle = g.createPattern(tile(style.ground), 'repeat');
  g.fillRect(0, 0, W, H);
  for (const band of style.bands) {
    const m = mask((x, y, i) => {
      if (isWater(i)) return false;
      const rag = band.rag ? fbm(x / 4, y / 4, seed + 13) * band.rag + bayer(x, y) * 0.8 : 0;
      const lim = band.toPx != null ? band.toPx : band.to === 1 ? outerEdge(x, y, i) : Wsh[i] * band.to;
      return S[i] < lim + rag;
    });
    paint(g, band.tex ? pat(band.tex, band.fillHoles) : band.color, m);
  }
  for (const d of decor) if (d.layer === 'ground') blit(g, d.id, d.x - sprites.get(d.id).sw / 2, d.y - sprites.get(d.id).sh / 2);

  // The water: frame 0, then tint, shallows, bank face, waterline, shadow, rim and one foam phase
  const waterMask = mask((x, y, i) => isWater(i));
  const [layer, l] = makeCanvas(W, H);
  const ws = style.water;
  paint(l, pat(waterFrame, false), waterMask);
  paint(l, ws.tint, waterMask);
  for (const [depth, color] of ws.shallow) {
    paint(l, color, mask((x, y, i) => isWater(i) && -S[i] < depth + bayer(x, y) * 1.6 + fbm(x / 11, y / 11, seed + 17) * 1.2));
  }
  const faceMask = mask((x, y, i) => isWater(i) && U[i] <= faceH[i]);
  paint(l, pat(style.face.tex, style.face.fillHoles), faceMask);
  paint(l, style.face.tint, faceMask);
  paint(l, WATERLINE, mask((x, y, i) => isWater(i) && U[i] === faceH[i] + 1));
  paint(l, ws.shadow.color, mask((x, y, i) => isWater(i) && U[i] > faceH[i] + 1 && U[i] <= faceH[i] + 1 + ws.shadow.h));
  paint(l, ws.rim, mask((x, y, i) => isWater(i) && -S[i] < 1.1 && U[i] > faceH[i] + 1));
  paint(l, ws.foam, mask((x, y, i) => {
    if (!isWater(i) || U[i] <= faceH[i] + 1 + ws.shadow.h) return false;
    const r = 2.2 + fbm(x / 9, y / 9, seed + 19) * 0.9;
    return Math.abs(-S[i] - r) < 0.55 && vnoise(x / 2.5, y / 2.5, seed + 23) > 0.42;
  }));
  g.drawImage(layer, 0, 0);

  // Shore decor, depth-sorted by foot y
  const sprite = decor.filter((d) => d.layer === 'sprite').sort((a, b) => a.y - b.y || a.x - b.x);
  for (const d of sprite) {
    if (d.reed) {
      const bed = reedBed(sprites, blit, d.reed);
      if (d.wet && d.ripple) ripple(g, d.x, d.y - 1, bed.rx + 2, Math.max(2, bed.ry * 0.6), REED_RIPPLE);
      g.drawImage(bed.canvas, d.x - bed.ax, d.y - bed.ay);
      continue;
    }
    if (d.wet && d.ripple) {
      const rx = clamp(sprites.get(d.id).sw * 0.42, 4, 26);
      ripple(g, d.x, d.y - 1, rx, Math.max(2, rx * 0.28), RIPPLE);
    }
    draw(g, d.id, d.x, d.y);
  }
  return out;
}

// Layers 2a and 2b: organic ground areas and trampled-grass roads (WORLD-SPEC §5, §6).
function paintGround(plan, { W, H, tile, blit, sprites }) {
  const S = plan.water.S;
  const [out, g] = makeCanvas(W, H);
  // Paint fill (a colour or a texture canvas) through a per-pixel test inside a box: pixel-crisp edges, the
  // texture aligned to the world.
  const paint = (fill, x0, y0, x1, y1, test, opacity = 1) => {
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1));
    y1 = Math.min(H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    const [c, cx] = makeCanvas(x1 - x0, y1 - y0);
    const im = cx.createImageData(x1 - x0, y1 - y0);
    const d = im.data;
    for (let y = y0, i = 3; y < y1; y++) for (let x = x0; x < x1; x++, i += 4) if (test(x, y)) d[i] = 255;
    cx.putImageData(im, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    if (typeof fill === 'string') cx.fillStyle = fill;
    else {
      const p = cx.createPattern(fill, 'repeat');
      p.setTransform(new DOMMatrix().translate(-x0, -y0));
      cx.fillStyle = p;
    }
    cx.fillRect(0, 0, x1 - x0, y1 - y0);
    g.globalAlpha = opacity;
    g.drawImage(c, x0, y0);
    g.globalAlpha = 1;
  };

  const { areaOf } = plan;
  for (const a of plan.areas) {
    const { x0, y0, x1, y1 } = a.box;
    const bw = x1 - x0;
    const at = (x, y) => a.E[(y - y0) * bw + (x - x0)];
    const inside = (x, y) => areaOf[y * W + x] === a.index;
    paint(tile(plan.areaTextures[a.tex]), x0, y0, x1, y1, inside);
    if (a.tex2) {
      paint(tile(plan.areaTextures[a.tex2]), x0, y0, x1, y1, (x, y) => inside(x, y) && at(x, y) < 0.9
        && vnoise(x / 26, y / 26, 51) + fbm(x / 6, y / 6, 53) * 0.12 > a.tex2At);
    }
    if (a.mud) {
      paint(a.mud, x0, y0, x1, y1, (x, y) => inside(x, y)
        && (S[y * W + x] < 5 + fbm(x / 7, y / 7, 3) * 3 || vnoise(x / 22, y / 22, 57) + bayer(x, y) * 0.1 > 0.66));
    }
    if (a.wet) paint(a.wet, x0, y0, x1, y1, (x, y) => inside(x, y) && S[y * W + x] < 7 + fbm(x / 8, y / 8, 3) * 3);
    if (a.rim) paint(a.rim, x0, y0, x1, y1, (x, y) => inside(x, y) && at(x, y) > 0.93);
  }
  // Ground decals anchor top-left: centre them on their point
  for (const d of plan.decals) blit(g, d.id, d.x - sprites.get(d.id).sw / 2, d.y - sprites.get(d.id).sh / 2);

  // Roads: trampled grass with a wavering, dithered edge and worn spots in the middle
  const beach = plan.areas.find((a) => a.name === plan.beachName)?.index ?? -1;
  const road = tile(plan.roadTexture, false, plan.roadRows);
  const worn = tile(plan.roadWorn);
  const dry = (x, y) => S[y * W + x] > 3 && areaOf[y * W + x] !== beach;
  for (const r of plan.roads) {
    const { x0, y0, x1, y1 } = r.box;
    const bw = x1 - x0;
    const cover = (x, y) => {
      const d = r.D[(y - y0) * bw + (x - x0)];
      const h = r.hw * (1 + 0.28 * fbm(x / 70, y / 70, 61));
      return 1 - d / h + fbm(x / 9, y / 9, 63) * 0.18;
    };
    paint(road, x0, y0, x1, y1, (x, y) => dry(x, y) && cover(x, y) + bayer(x, y) * 0.35 > 0.18);
    paint(worn, x0, y0, x1, y1, (x, y) => dry(x, y) && cover(x, y) > 0.55 && vnoise(x / 30, y / 30, 67) + bayer(x, y) * 0.18 > 0.6, 0.5);
  }
  return out;
}

// A reed bed: the rectangular tall-grass sprite cut to a clump with a jagged, blade-like top (WATER-SPEC §6.3).
function reedBed(sprites, blit, reed) {
  const { rx, ry, height: ht, source, offset, seed } = reed;
  const w = rx * 2 + 1;
  const h = ht + ry * 2 + 2;
  const cy = ht + ry;
  const [c, x] = makeCanvas(w, h);
  const s = sprites.get(source);
  const ox = Math.floor(offset * Math.max(1, s.sw - 8));
  for (let tx = -ox; tx < w; tx += s.sw) blit(x, source, tx, 0);
  const [m, mc] = makeCanvas(w, h);
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
