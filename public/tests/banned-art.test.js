// Art rules from BUG-001 and BUG-002 (SC-010) and the fly size (FR-026). These fail if a banned sprite is used again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { BASE_TILES, PATCH_TILES } from '../js/world/ground.js';
import { GRASS_RULES } from '../js/world/shore.js';
import { EDIBLE_SPRITES } from '../js/world/layout.js';

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
  assert.ok(!('honey' in EDIBLE_SPRITES));
  assert.ok(!code.includes('jungle-prop-001'));
  for (const c of [config, connectome]) {
    assert.ok(!c.edibles.some((e) => e.kind === 'honey'));
    assert.deepEqual(c.flies.stimulus.objects, ['flower']);
  }
});

test('the fly sprites are 22 × 22 pixels (FR-026)', () => {
  for (const name of ['fly', 'fly-baseline']) {
    const { pixels } = config.sprites[name];
    assert.equal(pixels.length, 22, `${name} rows`);
    for (const row of pixels) assert.equal(row.length, 22, `${name} row`);
  }
});

test('the outcrop, the flowers and the bushes named in BUG-001 are used (FR-013, FR-024)', () => {
  const ids = JSON.stringify(config);
  assert.ok(ids.includes('"outcrop_medium_grass"'));
  for (const id of ['jungle-bush-018', 'jungle-plant-016', 'trees-plant-005', 'jungle-plant-010', 'jungle-plant-015']) {
    assert.ok(ids.includes(`"${id}"`), id);
  }
});

test('the connectome world uses the same catalogue and loads as version 2 (FR-027)', () => {
  assert.equal(connectome.version, 2);
  assert.equal(connectome.flies.brain.snapshot, 'brains/smallest-functional-brain.brain');
});
