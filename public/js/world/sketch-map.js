// The sketch map (contracts/world-format-sketch-map.md §7, BUG-002): the "Arcade World Map" of the art pack's
// reference design (zrpg-art examples/world.js, WORLD-SPEC.md) planned on this app's grid. Pure: no DOM.
//
// planMap lays out everything the reference draws (water and shores, organic ground areas, trampled-grass roads,
// border forest, groves, mountains, region objects, area and meadow scatter) as data; world/sketch-paint.js paints
// it. mapLogic turns the plan into the logic grid the fly senses: water, blocked cells and the edge-forest band.
//
// Units: config.map is authored in reference px (the sketch, map.reference = [w, h]); the scene is the world grid
// in px (cols × rows × CELL_PX). A reference x scales by sx, a y by sy, and a length (a width, a spacing, a rag) by
// the geometric mean k = √(sx·sy) — the reference design's s(v) = v·K with K split per axis (WORLD-SPEC §2), because
// the world keeps its own grid and aspect (spec 014 FR-018). Distances the reference states in world px (tree grid
// step, jitter, water margins) are sprite-scale and stay as they are.

import { createPrng } from './prng.js';
import { fbm, edt, bayer } from './water.js';
import { buildWaterFields, placeWaterDecor } from './map-water.js';

const CELL_PX = 32;

// Sprite classes a fly bumps into (spec 014 FR-016, research.md R7, layout.js SOLID_SCATTER_CLASSES).
const SOLID_CLASSES = new Set(['bush', 'tree', 'rock', 'prop']);

// Reference-design constants in world px (WORLD-SPEC §5–§7).
const AREA_NOISE = [40, 0.16, 6, 0.035]; // §5: fbm(x/40)·0.16 + fbm(x/6)·0.035
const SOFT_EDGE = 0.22; // §5: bayer·0.22 on a soft (dithered) area edge
const ROAD_SAMPLES = 12; // §6: Catmull-Rom samples per segment
const GROVE_STEP = 44; // §7: grove grid step, jitter 30, fill 0.85
const GROVE_JITTER = 30;
const GROVE_FILL = 0.85;
const MOUNTAIN_PAD = 14; // §7: border trees keep 14 ref px off a mountain ellipse
const DECAL_TRIES = 400; // §5: sand decals, ≥ 30 px inside the beach and 22 px from water
const AREA_TRIES = 900;

// Scale helpers from the map's reference size to scene px.
export function mapScale(map, grid) {
  const [rw, rh] = map.reference;
  const sx = (grid.cols * CELL_PX) / rw;
  const sy = (grid.rows * CELL_PX) / rh;
  return { sx, sy, k: Math.sqrt(sx * sy), W: grid.cols * CELL_PX, H: grid.rows * CELL_PX };
}

// Catmull-Rom through pts, seg samples per segment (WORLD-SPEC §6).
function catmull(pts, seg) {
  const out = [];
  const n = pts.length;
  const P = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
        + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// The border band test (WORLD-SPEC §7): true when a scene point lies in the ragged edge band, outside a river gap.
function borderTest(border, scale) {
  const { sx, sy, k, W, H } = scale;
  const inGap = (x, side) => (border.gaps ?? []).some(([a, b, sd]) => sd === side && x / sx > a && x / sx < b);
  return (x, y) => {
    const rag = fbm(x / 90, y / 90, 5) * border.rag * k;
    return x < border.left * sx + rag || x > W - border.right * sx - rag
      || (y < border.top * sy + rag && !inGap(x, 'top')) || (y > H - border.bottom * sy - rag && !inGap(x, 'bottom'));
  };
}

// config: a validated world with a `map` section. catalog: from indexCatalog (sprite refs are "sheet/name" or ids).
// forbidden: sprite ids never placed as decor (food art, removed art). Returns the plan:
// { W, H, scale, water: fields + decor, areas, areaOf, roads, nearRoad, decals, items, finish }.
export function planMap(config, catalog, forbidden = new Set()) {
  const map = config.map;
  const scale = mapScale(map, config.grid);
  const { sx, sy, k, W, H } = scale;
  const X = (v) => v * sx;
  const Y = (v) => v * sy;
  const L = (v) => v * k;
  const rnd = createPrng(((map.seed ?? 1) * 977 + 3) >>> 0).next;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const idOf = (ref) => catalog.lookup(ref).sprite.id;
  const ids = (refs) => refs.map(idOf);

  // 1. Water and shores (WORLD-SPEC §4). The water seed follows the variation: water.seed + map.seed − 1.
  const bodies = map.water.bodies.map((b) => {
    const o = { ...b };
    if ('x' in o) o.x = X(o.x);
    if ('y' in o) o.y = Y(o.y);
    if ('rx' in o) o.rx = X(o.rx);
    if ('ry' in o) o.ry = Y(o.ry);
    if (o.path) o.path = o.path.map(([x, y]) => [X(x), Y(y)]);
    if (o.width) o.width = o.width.map(L);
    return o;
  });
  const waterSeed = map.water.seed + (map.seed ?? 1) - 1;
  const fields = buildWaterFields({ width: W, height: H, bodies }, waterSeed);
  const S = fields.S;
  // No waterline decor on the sand beach, enlarged by 24 ref px (WORLD-SPEC §4).
  const beachArea = map.grounds.find((g) => g.name === map.beach);
  const beach = (beachArea?.blobs ?? []).map(([x, y, rx, ry]) => [X(x), Y(y), X(rx + 24), Y(ry + 24)]);
  const shoreDecor = placeWaterDecor(fields, {
    seed: waterSeed,
    density: map.water.density,
    filter: (x, y) => !beach.some(([bx, by, rx, ry]) => Math.hypot((x - bx) / rx, (y - by) / ry) < 1),
    forbidden,
    catalog,
  });
  const landAt = (x, y, margin = 0) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    return S[y * W + x] > margin;
  };

  // 2a. Organic ground areas: a union of ellipses with a noisy edge, clipped to land (WORLD-SPEC §5).
  const areaOf = new Uint8Array(W * H);
  const areas = map.grounds.map((gr, n) => {
    const bl = gr.blobs.map(([x, y, rx, ry]) => [X(x), Y(y), X(rx), Y(ry)]);
    const x0 = Math.max(0, Math.floor(Math.min(...bl.map((b) => b[0] - b[2] * 1.3))));
    const x1 = Math.min(W, Math.ceil(Math.max(...bl.map((b) => b[0] + b[2] * 1.3))));
    const y0 = Math.max(0, Math.floor(Math.min(...bl.map((b) => b[1] - b[3] * 1.3))));
    const y1 = Math.min(H, Math.ceil(Math.max(...bl.map((b) => b[1] + b[3] * 1.3))));
    const bw = Math.max(0, x1 - x0);
    const E = new Float32Array(bw * Math.max(0, y1 - y0));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let e = Infinity;
        for (const [bx, by, rx, ry] of bl) e = Math.min(e, Math.hypot((x - bx) / rx, (y - by) / ry));
        e += fbm(x / AREA_NOISE[0], y / AREA_NOISE[0], 31 + n) * AREA_NOISE[1]
          + fbm(x / AREA_NOISE[2], y / AREA_NOISE[2], 37 + n) * AREA_NOISE[3];
        if (gr.soft) e += bayer(x, y) * SOFT_EDGE;
        E[(y - y0) * bw + (x - x0)] = e;
        if (e < 1 && S[y * W + x] > 0) areaOf[y * W + x] = n + 1;
      }
    }
    return { ...gr, index: n + 1, box: { x0, y0, x1, y1 }, E };
  });
  const AREA = Object.fromEntries(areas.map((a) => [a.name, a.index]));
  const areaAt = (x, y) => {
    x = Math.round(x);
    y = Math.round(y);
    return x >= 0 && y >= 0 && x < W && y < H ? areaOf[y * W + x] : 0;
  };
  const nearArea = (x, y, pad) => [[0, 0], [pad, 0], [-pad, 0], [0, pad], [0, -pad]].some(([dx, dy]) => areaAt(x + dx, y + dy));
  const areaBox = (name) => areas.find((a) => a.name === name).box;

  // Ground decals on an area (WORLD-SPEC §5: sand ripples and clumps on the beach).
  const decals = [];
  for (const rule of map.decals ?? []) {
    const a = AREA[rule.area];
    const { x0, y0, x1, y1 } = areaBox(rule.area);
    const set = ids(rule.sprites);
    const m = rule.inset;
    for (let n = 0, placed = 0; n < DECAL_TRIES && placed < rule.max; n++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      if (areaAt(x, y) !== a || [[m, 0], [-m, 0], [0, m], [0, -m]].some(([dx, dy]) => areaAt(x + dx, y + dy) !== a)) continue;
      if (!landAt(x, y, rule.waterMargin)) continue;
      decals.push({ id: pick(set), x, y });
      placed++;
    }
  }

  // 2b. Roads: distance to a Catmull-Rom centreline, kept per road box for the painter (WORLD-SPEC §6).
  const nearRoad = new Uint8Array(W * H);
  const roads = map.roads.paths.map((r) => {
    const pts = catmull(r.pts.map(([x, y]) => [X(x), Y(y)]), ROAD_SAMPLES);
    const hw = L(r.w) / 2;
    const pad = Math.ceil(hw * 1.6 + 8);
    const bx0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0])) - pad));
    const by0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1])) - pad));
    const bx1 = Math.min(W, Math.ceil(Math.max(...pts.map((p) => p[0])) + pad));
    const by1 = Math.min(H, Math.ceil(Math.max(...pts.map((p) => p[1])) + pad));
    const bw = bx1 - bx0;
    const bh = by1 - by0;
    // The centreline as a 1 px line of sites (the reference strokes it 2 px wide on a canvas; same distance ±1 px).
    const site = new Uint8Array(bw * bh);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [cx, cy] = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(cx - ax, cy - ay) * 2));
      for (let j = 0; j <= n; j++) {
        const px = Math.floor(ax + ((cx - ax) * j) / n) - bx0;
        const py = Math.floor(ay + ((cy - ay) * j) / n) - by0;
        if (px >= 0 && py >= 0 && px < bw && py < bh) site[py * bw + px] = 1;
      }
    }
    const D = edt(site, bw, bh);
    for (let y = by0; y < by1; y++) {
      for (let x = bx0; x < bx1; x++) if (D[(y - by0) * bw + (x - bx0)] < hw * 1.6) nearRoad[y * W + x] = 1;
    }
    return { hw, box: { x0: bx0, y0: by0, x1: bx1, y1: by1 }, D };
  });

  // 3. Sprites (WORLD-SPEC §7), in the reference's order so the same seed gives the same layout.
  const items = [];
  const add = (id, x, y) => items.push({ id, x: Math.round(x), y: Math.round(y) });
  const keepOut = map.keepOut ?? [];
  const free = (x, y, pad) => {
    const rx = x / sx;
    const ry = y / sy;
    for (const [a, b, c, d] of keepOut) if (rx > a && rx < c && ry > b && ry < d) return false;
    const xx = Math.round(x);
    const yy = Math.round(y);
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && nearRoad[yy * W + xx]) return false;
    return !nearArea(x, y, pad);
  };
  const trees = ids(map.trees);

  // Border forest: a jittered grid inside the ragged edge band, with gaps where the river crosses an edge.
  const B = map.border;
  const inBorder = borderTest(B, scale);
  for (let y = -40; y < H + 90; y += B.step) {
    for (let x = -40; x < W + 40; x += B.step) {
      const jx = x + (rnd() - 0.5) * B.step * 0.9;
      const jy = y + (rnd() - 0.5) * B.step * 0.9;
      const rock = map.mountains.some((m) => Math.hypot((jx / sx - m.x) / (m.rx + MOUNTAIN_PAD), (jy / sy - m.y) / (m.ry + MOUNTAIN_PAD)) < 1);
      if (inBorder(jx, jy) && !rock && rnd() < B.fill && landAt(jx, jy, 10) && !nearArea(jx, jy, 20)) add(pick(trees), jx, jy);
    }
  }
  // Groves
  for (const gr of map.groves) {
    const cx = X(gr.x);
    const cy = Y(gr.y);
    const rx = X(gr.rx);
    const ry = Y(gr.ry);
    for (let y = cy - ry; y < cy + ry; y += GROVE_STEP) {
      for (let x = cx - rx; x < cx + rx; x += GROVE_STEP) {
        const jx = x + (rnd() - 0.5) * GROVE_JITTER;
        const jy = y + (rnd() - 0.5) * GROVE_JITTER;
        if (Math.hypot((jx - cx) / rx, (jy - cy) / ry) > 1 + fbm(jx / 30, jy / 30, 9) * 0.2 || rnd() > GROVE_FILL) continue;
        if (landAt(jx, jy, 12) && free(jx, jy, 22)) add(pick(trees), jx, jy);
      }
    }
  }
  // Mountains: rock pieces spread over an ellipse, north to south.
  const peaks = ids(map.peaks);
  for (const m of map.mountains) {
    for (let i = 0; i < m.n; i++) {
      const t = i / m.n;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      add(pick(peaks), X(m.x) + Math.cos(a) * r * X(m.rx), Y(m.y - m.ry) + t * Y(m.ry * 2) + (rnd() - 0.5) * 30);
    }
  }
  // Hand-placed region objects
  for (const [ref, x, y] of map.objects) add(idOf(ref), X(x), Y(y));
  // Area scatter, with a cap and a minimum spacing (the anti-crowding rules, WORLD-SPEC §7)
  const spaced = (list, x, y, d) => list.every((p) => Math.hypot(p[0] - x, p[1] - y) >= d);
  for (const rule of map.areaScatter ?? []) {
    const a = AREA[rule.area];
    const set = ids(rule.sprites);
    const { x0, y0, x1, y1 } = areaBox(rule.area);
    const mine = [];
    for (let n = 0; n < AREA_TRIES && mine.length < rule.max; n++) {
      const x = x0 + rnd() * (x1 - x0);
      const y = y0 + rnd() * (y1 - y0);
      if (areaAt(x, y) !== a || !landAt(x, y, rule.waterMargin) || !spaced(mine, x, y, L(rule.spacing) / 2)) continue;
      if (rule.onRoads !== true && nearRoad[Math.round(y) * W + Math.round(x)]) continue;
      mine.push([x, y]);
      add(pick(set), x, y);
    }
  }
  // Meadow scatter: open grass only, kept apart
  const M = map.meadow;
  const mix = M.mix.map(([share, refs]) => [share, ids(refs)]);
  const meadow = [];
  const [mx0, my0, mx1, my1] = M.box;
  for (let n = 0; n < M.tries && meadow.length < M.max; n++) {
    const x = X(mx0) + rnd() * X(mx1 - mx0);
    const y = Y(my0) + rnd() * Y(my1 - my0);
    if (!landAt(x, y, 14) || !free(x, y, 12) || !spaced(meadow, x, y, M.spacing)) continue;
    const r = rnd();
    meadow.push([x, y]);
    let acc = 0;
    const set = mix.find(([share]) => r < (acc += share))?.[1] ?? mix[mix.length - 1][1];
    add(pick(set), x, y);
  }

  for (const it of items) it.solid = SOLID_CLASSES.has(catalog.sprites.get(it.id).class);
  // Shore decor (tufts, reeds, waterline stones, a mossy log) is drawn, not bumped into, as on the tile worlds, whose
  // shore placements never entered the logic grid; it stands on the waterline, partly in water already.
  for (const d of shoreDecor) d.solid = false;
  // Food wins over scenery: the food allocation is the world's own (spec 014 FR-012, BUG-002), so no solid sprite
  // stands in the 3×3 eating square of an edible. Dropped after placement, so the rest of the layout keeps its seed.
  const reserved = new Set();
  const { cols, rows } = config.grid;
  for (const e of config.edibles ?? []) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = Math.floor(e.x) + dx;
        const cy = Math.floor(e.y) + dy;
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) reserved.add(cy * cols + cx);
      }
    }
  }
  const clearOfFood = (o) => !o.solid || !reserved.has(Math.floor(o.y / CELL_PX) * cols + Math.floor(o.x / CELL_PX));

  return {
    W, H, scale,
    water: { ...fields, decor: shoreDecor.filter(clearOfFood), bodies, seed: waterSeed },
    beachName: map.beach,
    areas, areaOf, roads, nearRoad, decals, items: items.filter(clearOfFood),
    roadTexture: idOf(map.roads.texture),
    roadRows: map.roads.textureRows,
    roadWorn: idOf(map.roads.worn),
    areaTextures: Object.fromEntries(areas.flatMap((a) => [a.tex, a.tex2].filter(Boolean).map((t) => [t, idOf(t)]))),
    finish: map.finish,
    inBorder,
  };
}

const plans = new WeakMap();
// One plan per config object: the logic grid, the overlays and the painter all read the same plan.
export function mapPlan(config, catalog, forbidden) {
  if (!plans.has(config)) plans.set(config, planMap(config, catalog, forbidden));
  return plans.get(config);
}

// The logic grid of a sketch map (contracts/world-format-sketch-map.md §7). A cell is water when the drawn water
// covers its centre; it is blocked when it is water or holds the foot point of a solid map sprite (a tree, rock,
// bush or prop); it is edge forest when its centre lies in the border band and is not water.
// Returns { water, blocked, forestEdge, objects } with objects in cell units, like buildScene's.
export function mapLogic(plan, cols, rows) {
  const { W, H } = plan;
  const S = plan.water.S;
  const count = cols * rows;
  const water = new Uint8Array(count);
  const forestEdge = new Uint8Array(count);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = Math.min(W - 1, Math.floor((cx + 0.5) * CELL_PX));
      const py = Math.min(H - 1, Math.floor((cy + 0.5) * CELL_PX));
      const i = cy * cols + cx;
      water[i] = S[py * W + px] < 0 ? 1 : 0;
      if (!water[i] && plan.inBorder(px, py)) forestEdge[i] = 1;
    }
  }
  const objects = [];
  // Shore decor stays out of the logic grid, as the tile worlds' shore placements do (world/shore.js).
  for (const it of plan.items) objects.push({ sprite: it.id, x: it.x / CELL_PX, y: it.y / CELL_PX, solid: it.solid });
  const blocked = new Uint8Array(water);
  for (const o of objects) {
    if (!o.solid) continue;
    const cx = Math.floor(o.x);
    const cy = Math.floor(o.y);
    if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) blocked[cy * cols + cx] = 1;
  }
  return { water, blocked, forestEdge, objects };
}

