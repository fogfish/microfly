// Food placement/sprite/kind rules of specs/009-food-odour-recalibration (FR-001, FR-008, FR-009, FR-010,
// FR-019). The falloff-shape rules (SC-001 to SC-003) moved to tests/food-field.test.mjs under spec 014, which
// replaced the point-sum odourField/fruitIntensity model this file used to check (research.md R4). The checks
// use the app's own geometry: buildLogic for land and blocked cells, buildWorld for the stimulus cells. Pure: no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, cellIndex, EDIBLE_KINDS } from '../public/js/world/layout.js';
import { buildWorld, stimulusPoints } from '../public/js/fly/fly-world.js';
import { GRASS_RULES } from '../public/js/world/shore.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
const FILES = ['world.json', 'world-forager.json', 'world-forager-11k.json', 'world-connectome.json', 'world-antennal-lobe.json'];
const REMOVED = ['jungle-plant-016', 'jungle-plant-017', 'jungle-bush-018'];
const YELLOW = ['trees-plant-001', 'trees-plant-002', 'trees-plant-003'];
const FOOD = ['trees-plant-005', 'jungle-plant-010', 'jungle-plant-015']; // red_flower_plant, medium, large
const idOf = (ref) => catalog.lookup(ref).sprite.id;

// One world: config, logic, the fly world and the walkable-cell flag.
function scene(file) {
  const config = JSON.parse(read(`../public/world/${file}`));
  const logic = buildLogic(config, catalog);
  const world = buildWorld(config, logic);
  const cells = logic.cols * logic.rows;
  const walkable = (i) => logic.blocked[i] === 0;
  return { config, logic, world, cells, walkable };
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

  // The falloff-shape assertions that used to live here (SC-001 peak/reach-ratio, SC-002 odour-free share,
  // SC-003 land-route-to-odour) tested the old point-sum odourField/fruitIntensity model. Spec 014 replaced that
  // model, for both the fly's sense and the overlay, with the irregular stepped food field (research.md R4,
  // contracts/world-format-sketch-map.md §4); its own shape and connectivity properties are covered by
  // tests/food-field.test.mjs instead (contract: "replaces the now-superseded falloff-shape assertions...while
  // keeping its placement/sprite/kind checks").

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
  for (const file of [...FILES, 'world-forager-bad.json', 'world-forager-11k-bad.json']) {
    const text = read(`../public/world/${file}`);
    for (const id of REMOVED) assert.ok(!text.includes(`"${id}"`), `${id} in ${file}`);
  }
});
