// The sketch map (specs/014-sketch-world-map contracts/world-format-sketch-map.md §7, BUG-002): the art pack's
// reference world map planned on the world grid. Plan and logic grid only; the painter needs the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, DECOR_FORBIDDEN, cellIndex } from '../public/js/world/layout.js';
import { planMap, mapScale } from '../public/js/world/sketch-map.js';
import { validateConfig, validateArt } from '../public/js/world/validate.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
const load = (file) => JSON.parse(read(`../public/world/${file}`));
const config = load('world.json');
const logic = buildLogic(config, catalog);
const { cols, rows } = logic;

test('every 64 × 40 world carries the same map and keeps the world grid (FR-026)', () => {
  for (const file of ['world-antennal-lobe.json', 'world-connectome.json', 'world-forager.json', 'world-forager-11k.json',
    'world-forager-wide.json', 'world-forager-wide-bad.json']) {
    const w = load(file);
    assert.deepEqual(w.map, config.map, file);
    assert.deepEqual(w.grid, { cols: 64, rows: 40, cellPx: 32 }, file);
  }
});

test('reference px scale to the world grid per axis', () => {
  const { sx, sy, k, W, H } = mapScale(config.map, config.grid);
  assert.equal(W, 64 * 32);
  assert.equal(H, 40 * 32);
  assert.ok(Math.abs(sx * 1376 - W) < 1e-9 && Math.abs(sy * 768 - H) < 1e-9);
  assert.ok(Math.abs(k * k - sx * sy) < 1e-9);
});

test('the plan is deterministic', () => {
  const a = planMap(config, catalog, DECOR_FORBIDDEN);
  const b = planMap(JSON.parse(JSON.stringify(config)), catalog, DECOR_FORBIDDEN);
  assert.deepEqual(a.items, b.items);
  assert.deepEqual(a.water.decor, b.water.decor);
});

test('the edge forest touches every side, with a gap where the river crosses the north and south edges', () => {
  const row = (y) => Array.from({ length: cols }, (_, x) => y * cols + x);
  const col = (x) => Array.from({ length: rows }, (_, y) => y * cols + x);
  for (const cells of [row(0), row(rows - 1), col(0), col(cols - 1)]) assert.ok(cells.some((i) => logic.forestEdge[i]));
  for (const y of [0, rows - 1]) {
    const river = row(y).filter((i) => logic.water[i]);
    assert.ok(river.length > 0, `no river on row ${y}`);
    for (const i of river) assert.equal(logic.forestEdge[i], 0);
  }
});

test('food stands on land with its 3 × 3 eating square free of solid scenery (FR-012)', () => {
  for (const e of config.edibles) {
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    assert.equal(logic.water[cellIndex(e.x, e.y, cols)], 0, `${e.kind} at (${e.x}, ${e.y}) is on water`);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (cy + dy) * cols + cx + dx;
        assert.ok(logic.water[i] || !logic.blocked[i], `solid scenery at (${cx + dx}, ${cy + dy}) by ${e.kind}`);
      }
    }
  }
});

test('no food or removed art is placed as scenery (spec 009 FR-009, FR-019)', () => {
  const plan = planMap(config, catalog, DECOR_FORBIDDEN);
  for (const it of [...plan.items, ...plan.water.decor]) assert.ok(!DECOR_FORBIDDEN.has(it.id), it.id);
});

test('a solid map sprite blocks its foot cell; a plant does not', () => {
  const inGrid = (o) => o.x >= 0 && o.y >= 0 && o.x < cols && o.y < rows;
  const scenery = logic.objects.filter((o) => o.kind === undefined && inGrid(o));
  assert.ok(scenery.some((o) => o.solid) && scenery.some((o) => !o.solid));
  for (const o of scenery) if (o.solid) assert.equal(logic.blocked[cellIndex(o.x, o.y, cols)], 1, o.sprite);
});

test('a world with both a map and tile sections is refused', () => {
  const c = { ...config, groves: [] };
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['groves']);
});

test('a map sprite that does not resolve names its entry', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.map.objects[0][0] = 'jungle/no_such_sprite';
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), ['map.objects[0]']);
});

test('food on the drawn water is refused', () => {
  const c = JSON.parse(JSON.stringify(config));
  const i = logic.water.indexOf(1);
  c.edibles.push({ kind: 'small', sprite: 'red_flower_plant', x: (i % cols) + 0.5, y: Math.floor(i / cols) + 0.5 });
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), [`edibles[${c.edibles.length - 1}]`]);
});

// border.dead (contracts/world-format-sketch-map.md §7): the edge forest inside the dunes is dead, and live trees
// stay on the rest of the edge, so the transition between them is the blend, not a rule about one tree.
test('the edge forest in the dunes corner is dead; the rest of the edge stays live (border.dead)', () => {
  const plan = planMap(config, catalog, DECOR_FORBIDDEN);
  const deadId = catalog.lookup(config.map.border.dead.trees[0]).sprite.id;
  const liveIds = new Set(config.map.trees.map((ref) => catalog.lookup(ref).sprite.id));
  // The border loop also places trees just past the map edge; those are never drawn, so only the map itself counts.
  const onMap = (it) => it.x >= 0 && it.y >= 0 && it.x < plan.W && it.y < plan.H;
  const trees = plan.items.filter((it) => onMap(it) && plan.inBorder(it.x, it.y) && (it.id === deadId || liveIds.has(it.id)));
  const corner = trees.filter((it) => it.x > plan.W - 300 && it.y > plan.H - 300);
  assert.ok(corner.length > 0, 'no border trees in the corner');
  assert.ok(corner.every((it) => it.id === deadId), 'a live tree stands in the dead corner');
  assert.ok(trees.some((it) => it.id === deadId), 'no dead tree on the edge');
  assert.ok(trees.some((it) => liveIds.has(it.id) && it.x < plan.W / 3), 'no live tree on the west edge');
});

test('a border.dead rule naming no ground, no trees or a bad blend is refused', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.map.border.dead.area = 'no-such-ground';
  c.map.border.dead.blend = 0;
  c.map.border.dead.trees = [];
  const paths = validateConfig(c).map((e) => e.path);
  assert.ok(paths.includes('map.border.dead.area'));
  assert.ok(paths.includes('map.border.dead.trees'));
  assert.ok(paths.includes('map.border.dead.blend'));
});

test('a border.dead tree sprite that does not resolve names its entry', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.map.border.dead.trees = ['beach/no_such_tree'];
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), ['map.border.dead.trees[0]']);
});

// One dead tree sprite is 96 px wide: a bare patch narrower than a sprite is not a visible gap at the edge.
test('every dunes cell on the map edge has a dead tree within one sprite width, and no live border tree stands on the dunes', () => {
  const plan = planMap(config, catalog, DECOR_FORBIDDEN);
  const deadId = catalog.lookup(config.map.border.dead.trees[0]).sprite.id;
  const liveIds = new Set(config.map.trees.map((ref) => catalog.lookup(ref).sprite.id));
  const dunes = plan.areas.find((a) => a.name === config.map.border.dead.area).index;
  const dead = plan.items.filter((it) => it.id === deadId);
  for (let y = 0; y < plan.H; y += 8) {
    for (let x = 0; x < plan.W; x += 8) {
      if (!(x >= plan.W - 40 || y >= plan.H - 40) || plan.areaOf[y * plan.W + x] !== dunes) continue;
      const near = Math.min(...dead.map((d) => Math.hypot(d.x - x, d.y - y)));
      assert.ok(near <= 96, `bare dunes edge at (${x}, ${y}): nearest dead tree ${Math.round(near)} px`);
    }
  }
  const live = plan.items.filter((it) => liveIds.has(it.id) && plan.inBorder(it.x, it.y) && it.x >= 0 && it.y >= 0
    && it.x < plan.W && it.y < plan.H && plan.areaOf[Math.round(it.y) * plan.W + Math.round(it.x)] === dunes);
  assert.deepEqual(live, []);
});
