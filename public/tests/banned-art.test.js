// Art rules from BUG-001 and BUG-002 (SC-010) and the fly size (FR-026). These fail if a banned sprite is used again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { BASE_TILES, PATCH_TILES } from '../js/world/ground.js';
import { GRASS_RULES } from '../js/world/shore.js';
import { EDIBLE_KINDS } from '../js/world/layout.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const config = JSON.parse(read('../world/world.json'));
const connectome = JSON.parse(read('../world/world-connectome.json'));
const code = ['../js/world/ground.js', '../js/world/shore.js', '../js/world/layout.js', '../js/world/compose.js', '../js/world/water.js']
  .map(read).join('\n');

const BANNED_TERRAIN = ['rocks2-terrain-004', 'rocks2-terrain-005', 'rocks2-terrain-006', 'rocks2-terrain-007'];
const SAND = ['beach-terrain-001', 'beach-terrain-002'];
const PEBBLES_AS_SHORE = ['beach-rock-001', 'beach-rock-002', 'beach-rock-003'];

test('no solid one-colour tile is used as ground (FR-004)', () => {
  for (const id of BANNED_TERRAIN) {
    assert.ok(!BASE_TILES.includes(id), id);
    assert.ok(!Object.values(PATCH_TILES).flat().includes(id), id);
    assert.ok(!JSON.stringify(config).includes(`"${id}"`), `${id} is in world.json`);
  }
});

test('no sand is used anywhere (FR-012, BUG-001)', () => {
  for (const id of SAND) {
    assert.ok(!code.includes(id), `${id} in code`);
    assert.ok(!JSON.stringify(config).includes(`"${id}"`), `${id} in world.json`);
  }
  for (const b of config.waterBodies) assert.equal(b.shore, undefined, `${b.id} still sets a shore`);
});

test('pebbles (beach-rock-001 to -003) are overlays, not shore art (FR-024)', () => {
  const shoreIds = GRASS_RULES.flatMap((r) => r.ids ?? []);
  for (const id of PEBBLES_AS_SHORE) assert.ok(!shoreIds.includes(id), id);
});

test('no raw reed block, no rotated sprite and no water animation (BUG-002)', () => {
  const worlds = JSON.stringify(config) + JSON.stringify(connectome);
  assert.ok(!code.includes('beach-plant-001') && !worlds.includes('"beach-plant-001"'), 'beach-plant-001 is used');
  // The reed sprites are only named as reed-bed sources, never as a placed sprite
  for (const id of ['beach-plant-002', 'beach-plant-003']) {
    assert.ok(!GRASS_RULES.some((r) => (r.ids ?? []).includes(id)), `${id} placed raw by a shore rule`);
    assert.ok(!worlds.includes(`"${id}"`), `${id} placed raw in a world file`);
  }
  assert.ok(!/\.rotate\(|scale\(-1/.test(code), 'a sprite is rotated or mirrored');
  for (let n = 2; n <= 21; n++) {
    const id = `water-water-${String(n).padStart(3, '0')}`;
    assert.ok(!code.includes(id) && !worlds.includes(`"${id}"`), `${id} (animation frame) is used`);
  }
  assert.ok(!/animations/.test(code), 'the water animation is read');
});

test('both world files have the same water (BUG-002, SC-011)', () => {
  assert.deepEqual(connectome.waterBodies, config.waterBodies);
});

test('honey is not an edible kind, in code or in either world file (BUG-001)', () => {
  assert.ok(!EDIBLE_KINDS.includes('honey'));
  assert.ok(!code.includes('jungle-prop-001'));
  for (const c of [config, connectome]) {
    assert.ok(!c.edibles.some((e) => e.kind === 'honey'));
    assert.deepEqual(c.flies.stimulus.objects, ['small', 'medium', 'large']);
  }
});

test('the fly sprites are 32 × 32 pixels (spec 009 FR-013, FR-021; BUG-002)', () => {
  for (const name of ['fly-female', 'fly-female-baseline', 'fly-male', 'fly-male-baseline']) {
    const { pixels } = config.sprites[name];
    assert.equal(pixels.length, 32, `${name} rows`);
    for (const row of pixels) assert.equal(row.length, 32, `${name} row`);
  }
});

test('the outcrop and the food sprites are used (FR-013, FR-024; spec 009 FR-001, FR-012)', () => {
  const ids = JSON.stringify(config);
  assert.ok(ids.includes('"outcrop_medium_grass"'));
  // FR-012 withdraws jungle-bush-018 and jungle-plant-016 (removed by FR-009); the food sprites stay
  for (const id of ['red_flower_plant', 'jungle-plant-010', 'jungle-plant-015']) {
    assert.ok(ids.includes(`"${id}"`), id);
  }
});

test('the connectome world uses the same catalogue and loads as version 3 (FR-027)', () => {
  assert.equal(connectome.version, 3);
  assert.equal(connectome.flies.brain.snapshot, 'brains/smallest-functional-brain.brain');
});
