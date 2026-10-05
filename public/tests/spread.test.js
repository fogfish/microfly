import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic, cellIndex, DANGER_KINDS, DANGER_SPRITES, EDIBLE_SPRITES, SHORE_CLEARANCE_PX } from '../js/world/layout.js';
import { GRASS_RULES } from '../js/world/shore.js';
import { distanceAt, waterField } from '../js/world/water.js';

// FR-032, SC-013 (BUG-003): flowers and dangers are spread over the whole map.
const REGION_COLS = 3;
const REGION_ROWS = 2;
const MIN_FLOWER_GAP = 6;
const MIN_FLOWERS = 6;
const MIN_DANGERS = 5;
const EDIBLE_ART = new Set(EDIBLE_SPRITES.flower);

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

test('shore decor does not use the edible flower art', () => {
  for (const rule of GRASS_RULES) {
    for (const id of rule.ids ?? []) assert.ok(!EDIBLE_ART.has(id), `shore rule "${rule.name}" uses ${id}`);
  }
});

for (const file of ['world.json', 'world-connectome.json', 'world-antennal-lobe.json']) {
  const config = load(file);
  const flowers = config.edibles.filter((e) => e.kind === 'flower');

  test(`${file}: every region holds a flower and a danger`, () => {
    for (let r = 0; r < REGION_COLS * REGION_ROWS; r++) {
      assert.ok(flowers.some((e) => regionOf(config, e.x, e.y) === r), `region ${r} has no flower`);
      assert.ok(config.dangers.some((d) => regionOf(config, d.x, d.y) === r), `region ${r} has no danger`);
    }
  });

  test(`${file}: counts, kinds and no fire`, () => {
    assert.ok(flowers.length >= MIN_FLOWERS, `${flowers.length} flowers`);
    assert.ok(config.dangers.length >= MIN_DANGERS, `${config.dangers.length} dangers`);
    for (const kind of DANGER_KINDS) assert.ok(config.dangers.some((d) => d.kind === kind), `no ${kind}`);
    assert.ok(!config.dangers.some((d) => d.kind === 'fire'));
  });

  test(`${file}: flowers are at least ${MIN_FLOWER_GAP} cells apart`, () => {
    for (let i = 0; i < flowers.length; i++) {
      for (let j = i + 1; j < flowers.length; j++) {
        const d = Math.hypot(flowers[i].x - flowers[j].x, flowers[i].y - flowers[j].y);
        assert.ok(d >= MIN_FLOWER_GAP, `flowers ${i} and ${j} are ${d.toFixed(1)} cells apart`);
      }
    }
  });

  test(`${file}: spots are off water, the shore band and solid cells`, () => {
    const field = waterField(config);
    const logic = buildLogic(config, catalog);
    for (const [list, name] of [[config.edibles, 'edibles'], [config.dangers, 'dangers']]) {
      list.forEach((s, i) => {
        assert.ok(distanceAt(field, s.x, s.y) >= SHORE_CLEARANCE_PX, `${name}[${i}] is in the shore band`);
        assert.equal(logic.blocked[cellIndex(s.x, s.y, logic.cols)], 0, `${name}[${i}] is on a blocked cell`);
      });
    }
  });

  test(`${file}: decorative scatter does not use the edible flower art`, () => {
    for (const rule of config.scatter ?? []) {
      for (const id of rule.sprites) assert.ok(!EDIBLE_ART.has(id), `scatter "${rule.id}" uses ${id}`);
    }
  });
}
