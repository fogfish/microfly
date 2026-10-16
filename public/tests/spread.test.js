import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic, cellIndex, DANGER_KINDS, DANGER_SPRITES, EDIBLE_KINDS, FOOD_SPRITE_IDS, SHORE_CLEARANCE_PX } from '../js/world/layout.js';
import { GRASS_RULES } from '../js/world/shore.js';
import { distanceAt, waterField } from '../js/world/water.js';

// Spec 009 replaced the flower rule with the food rules (FR-001, FR-008, FR-011): one or more food units per size
// class (BUG-001), each on land, outside the shore band and not on a blocked cell. The odour share and route rules
// (SC-002, SC-003) are checked in tests/odour-food.test.mjs, which needs the odour formula.
// Spec 014 replaced the point-source dangers list with the edge-forest danger field (contracts/world-format-
// sketch-map.md §1, §3): danger placement is now checked here as "edge forest touches every side of the map"
// (the forestEdge mask's own coverage), not as individual spider/lantern spread (research.md R10).
const FOOD_ART = new Set(Object.values(FOOD_SPRITE_IDS));

const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));
const load = (file) => JSON.parse(readFileSync(new URL(`../world/${file}`, import.meta.url), 'utf8'));

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

for (const file of ['world.json', 'world-connectome.json', 'world-antennal-lobe.json', 'world-forager.json', 'world-forager-11k.json', 'world-forager-wide.json']) {
  const config = load(file);

  test(`${file}: no point-source dangers list remains (research.md R10)`, () => {
    assert.equal(config.dangers, undefined);
  });

  test(`${file}: edge forest (the danger source) touches every side of the map (contracts/world-format-sketch-map.md §1)`, () => {
    const { cols, rows } = config.grid;
    const logic = buildLogic(config, catalog);
    let top = false, bottom = false, left = false, right = false;
    for (let x = 0; x < cols; x++) {
      if (logic.forestEdge[x]) top = true;
      if (logic.forestEdge[(rows - 1) * cols + x]) bottom = true;
    }
    for (let y = 0; y < rows; y++) {
      if (logic.forestEdge[y * cols]) left = true;
      if (logic.forestEdge[y * cols + cols - 1]) right = true;
    }
    assert.ok(top && bottom && left && right, `edge forest sides: top=${top} bottom=${bottom} left=${left} right=${right}`);
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

  test(`${file}: decorative scatter does not use the food art (FR-019)`, () => {
    for (const rule of config.scatter ?? []) {
      for (const id of rule.sprites) {
        assert.ok(!FOOD_ART.has(catalog.lookup(id).sprite.id), `scatter "${rule.id}" uses food sprite ${id}`);
      }
    }
  });
}
