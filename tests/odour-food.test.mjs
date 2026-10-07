// Food odour rules of specs/009-food-odour-recalibration (SC-001 to SC-004, FR-001 to FR-010, FR-019).
// The checks use the app's own geometry: buildLogic for land and blocked cells, buildWorld for the odour sources,
// odourField at one sample per cell for the odour value of every cell. Pure: no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, cellIndex, EDIBLE_KINDS } from '../public/js/world/layout.js';
import { buildWorld, stimulusPoints } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { odourField } from '../public/js/world/odour-field.js';
import { GRASS_RULES } from '../public/js/world/shore.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
const FILES = ['world.json', 'world-forager.json', 'world-connectome.json', 'world-antennal-lobe.json'];
const REMOVED = ['jungle-plant-016', 'jungle-plant-017', 'jungle-bush-018'];
const YELLOW = ['trees-plant-001', 'trees-plant-002', 'trees-plant-003'];
const FOOD = ['trees-plant-005', 'jungle-plant-010', 'jungle-plant-015']; // red_flower_plant, medium, large
const idOf = (ref) => catalog.lookup(ref).sprite.id;

// One world: config, logic, the fly world, the odour value of every cell (one sample per cell) and the cell flags.
function scene(file) {
  const config = JSON.parse(read(`../public/world/${file}`));
  const logic = buildLogic(config, catalog);
  const world = buildWorld(config, logic);
  const stimulus = resolveFlies(config).stimulus;
  const field = odourField({ points: stimulusPoints(world), stimulus, cols: logic.cols, rows: logic.rows, samplesPerCell: 1 });
  const cells = logic.cols * logic.rows;
  const walkable = (i) => logic.blocked[i] === 0;
  return { config, logic, world, stimulus, odour: field.values, cells, walkable };
}

// Food units with their cell index and the reach the app gives them (stimulusPoints), read from the world config.
function units(s) {
  const points = stimulusPoints(s.world);
  return s.config.edibles.map((e) => {
    const idx = cellIndex(e.x, e.y, s.logic.cols);
    const point = points.find((p) => cellIndex(p.x, p.y, s.logic.cols) === idx);
    return { kind: e.kind, sprite: e.sprite, idx, reach: point.reach };
  });
}

for (const file of FILES) {
  test(`${file}: one or more food units per size class, every class present (FR-001, BUG-001)`, () => {
    const s = scene(file);
    const kinds = s.config.edibles.map((e) => e.kind);
    for (const k of EDIBLE_KINDS) assert.ok(kinds.includes(k), `no ${k} unit`);
    for (const e of s.config.edibles) assert.ok(FOOD.includes(idOf(e.sprite)), `${e.kind} unit uses non-food sprite ${e.sprite}`);
  });

  test(`${file}: the peak is on each unit, the same for all, and the world maximum (SC-001)`, () => {
    const s = scene(file);
    const peak = Math.max(...s.odour);
    for (const u of units(s)) {
      assert.equal(s.odour[u.idx], 1, `${u.kind} unit is not at the peak`);
      assert.equal(s.odour[u.idx], peak);
    }
  });

  test(`${file}: reach ratio follows size ratio within 5% (SC-001, FR-002)`, () => {
    const s = scene(file);
    const byKind = Object.fromEntries(units(s).map((u) => [u.kind, u.reach]));
    // Size in tiles from the catalogue: large 63/32 : medium 45/32 : small 32/32
    const size = { large: 63 / 32, medium: 45 / 32, small: 1 };
    for (const kind of ['large', 'medium', 'small']) {
      const want = byKind.small * (size[kind] / size.small);
      assert.ok(Math.abs(byKind[kind] / want - 1) <= 0.05, `${kind}: reach ${byKind[kind]} vs ${want}`);
    }
  });

  test(`${file}: the odour-free share of walkable cells is between 30% and 40% (SC-002, FR-006, BUG-001)`, () => {
    const s = scene(file);
    let walkable = 0;
    let free = 0;
    for (let i = 0; i < s.cells; i++) {
      if (!s.walkable(i)) continue;
      walkable++;
      if (s.odour[i] === 0) free++;
    }
    const share = free / walkable;
    assert.ok(share >= 0.3 && share <= 0.4, `odour-free share ${share.toFixed(3)}`);
  });

  test(`${file}: every walkable cell has a land route to odour (SC-003, FR-007)`, () => {
    const s = scene(file);
    const { cols, rows } = s.logic;
    // Multi-source breadth-first search from every walkable cell with odour, over walkable 4-neighbours
    const reached = new Uint8Array(s.cells);
    const queue = [];
    for (let i = 0; i < s.cells; i++) {
      if (s.walkable(i) && s.odour[i] > 0) {
        reached[i] = 1;
        queue.push(i);
      }
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const x = i % cols;
      const y = Math.floor(i / cols);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (!reached[j] && s.walkable(j)) {
          reached[j] = 1;
          queue.push(j);
        }
      }
    }
    let cut = 0;
    for (let i = 0; i < s.cells; i++) if (s.walkable(i) && !reached[i]) cut++;
    assert.equal(cut, 0, `${cut} walkable cells cut off from odour`);
  });

  test(`${file}: each unit is on land and not on another edible's cell (FR-008)`, () => {
    // BUG-001: instances no longer need non-overlapping reaches — several units of the same (or a different)
    // kind MAY sit close enough for their odour to add (FR-020). Only the same-cell exclusivity of FR-008 holds.
    const s = scene(file);
    const list = units(s);
    for (const u of list) {
      assert.ok(s.walkable(u.idx), `${u.kind} unit stands on water or a blocked cell`);
      assert.equal(list.filter((v) => v.idx === u.idx).length, 1, `${u.kind} shares its cell with another unit`);
    }
  });

  test(`${file}: no food sprite is decor, no yellow flower is food (FR-010, FR-019)`, () => {
    const s = scene(file);
    for (const rule of s.config.scatter ?? []) {
      for (const ref of rule.sprites) assert.ok(!FOOD.includes(idOf(ref)), `scatter "${rule.id}" uses food sprite ${ref}`);
    }
    for (const rule of GRASS_RULES) {
      for (const id of rule.ids ?? []) assert.ok(!FOOD.includes(id), `shore rule "${rule.name}" uses food sprite ${id}`);
    }
    const yellowEdible = s.config.edibles.some((e) => YELLOW.includes(idOf(e.sprite)));
    assert.equal(yellowEdible, false, 'a yellow flower is an edible unit');
    assert.deepEqual([...s.config.flies.stimulus.objects].sort(), [...EDIBLE_KINDS].sort());
  });
}

test('no removed sprite appears in any shipped world file (SC-004, FR-009)', () => {
  for (const file of [...FILES, 'world-forager-bad.json']) {
    const text = read(`../public/world/${file}`);
    for (const id of REMOVED) assert.ok(!text.includes(`"${id}"`), `${id} in ${file}`);
  }
});
