import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic, cellIndex, DANGER_KINDS, DANGER_SPRITES, EDIBLE_KINDS, FOOD_SPRITE_IDS, SHORE_CLEARANCE_PX } from '../js/world/layout.js';
import { GRASS_RULES } from '../js/world/shore.js';
import { distanceAt, waterField } from '../js/world/water.js';

// FR-032, SC-013 (BUG-003): dangers are spread over the whole map.
// Spec 009 replaced the flower rule with the food rules (FR-001, FR-008, FR-011): one or more food units per size
// class (BUG-001), each on land, outside the shore band and not on a blocked cell. The odour share and route rules
// (SC-002, SC-003) are checked in tests/odour-food.test.mjs, which needs the odour formula.
const REGION_COLS = 3;
const REGION_ROWS = 2;
const MIN_DANGERS = 5;
const FOOD_ART = new Set(Object.values(FOOD_SPRITE_IDS));

const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));
const load = (file) => JSON.parse(readFileSync(new URL(`../world/${file}`, import.meta.url), 'utf8'));

const regionOf = (config, x, y) => {
  const { cols, rows } = config.grid;
  const rx = Math.min(REGION_COLS - 1, Math.floor((x * REGION_COLS) / cols));
  const ry = Math.min(REGION_ROWS - 1, Math.floor((y * REGION_ROWS) / rows));
  return ry * REGION_COLS + rx;
};

test('fire is not a danger kind and campfire logs are not danger art', () => {
  assert.ok(!DANGER_KINDS.includes('fire'));
  assert.ok(!Object.values(DANGER_SPRITES).includes('jungle-prop-002'));
  assert.deepEqual([...DANGER_KINDS].sort(), ['lantern', 'spider']);
});

test('shore decor does not use the food art (FR-019)', () => {
  for (const rule of GRASS_RULES) {
    for (const id of rule.ids ?? []) assert.ok(!FOOD_ART.has(id), `shore rule "${rule.name}" uses ${id}`);
  }
});

for (const file of ['world.json', 'world-connectome.json', 'world-antennal-lobe.json']) {
  const config = load(file);

  test(`${file}: every region holds a danger`, () => {
    for (let r = 0; r < REGION_COLS * REGION_ROWS; r++) {
      assert.ok(config.dangers.some((d) => regionOf(config, d.x, d.y) === r), `region ${r} has no danger`);
    }
  });

  test(`${file}: danger counts, kinds and no fire`, () => {
    assert.ok(config.dangers.length >= MIN_DANGERS, `${config.dangers.length} dangers`);
    for (const kind of DANGER_KINDS) assert.ok(config.dangers.some((d) => d.kind === kind), `no ${kind}`);
    assert.ok(!config.dangers.some((d) => d.kind === 'fire'));
  });

  test(`${file}: food units are one or more per kind, every kind present, on land off the shore band and off blocked cells (FR-001, FR-008, BUG-001)`, () => {
    const field = waterField(config);
    const logic = buildLogic(config, catalog);
    const kinds = config.edibles.map((e) => e.kind);
    for (const k of EDIBLE_KINDS) assert.ok(kinds.includes(k), `no ${k} unit`);
    config.edibles.forEach((s, i) => {
      assert.ok(distanceAt(field, s.x, s.y) >= SHORE_CLEARANCE_PX, `edibles[${i}] is in the shore band`);
      assert.equal(logic.blocked[cellIndex(s.x, s.y, logic.cols)], 0, `edibles[${i}] is on a blocked cell`);
    });
  });

  test(`${file}: dangers are off water, the shore band and solid cells`, () => {
    const field = waterField(config);
    const logic = buildLogic(config, catalog);
    config.dangers.forEach((s, i) => {
      assert.ok(distanceAt(field, s.x, s.y) >= SHORE_CLEARANCE_PX, `dangers[${i}] is in the shore band`);
      assert.equal(logic.blocked[cellIndex(s.x, s.y, logic.cols)], 0, `dangers[${i}] is on a blocked cell`);
    });
  });

  test(`${file}: decorative scatter does not use the food art (FR-019)`, () => {
    for (const rule of config.scatter ?? []) {
      for (const id of rule.sprites) {
        assert.ok(!FOOD_ART.has(catalog.lookup(id).sprite.id), `scatter "${rule.id}" uses food sprite ${id}`);
      }
    }
  });
}
