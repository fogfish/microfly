// Fly world from the shipped config: blocked cells from the logic grid, stimulus cells, reproducible and walkable spawns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, cellIndex, EDIBLE_KINDS } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';

const config = JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../public/assets/atlas/catalog.json', import.meta.url), 'utf8')));
const logic = buildLogic(config, catalog);
const world = buildWorld(config, logic);

test('water and solid objects are blocked, and open grass is free', () => {
  let water = 0;
  let free = 0;
  for (let i = 0; i < logic.water.length; i++) {
    if (logic.water[i]) {
      water++;
      assert.equal(world.blocked[i], 1, `water cell ${i} should be blocked`);
    } else if (logic.objects.every((o) => !o.solid || cellIndex(o.x, o.y, logic.cols) !== i)) {
      free++;
      assert.equal(world.blocked[i], 0, `open cell ${i} should be free`);
    }
  }
  assert.ok(water > 0 && free > 0, 'the shipped world should contain water and open grass');
});

test('stimulus cells are the food cells, not dangers, and each carries the reach of its unit (spec 009)', () => {
  const expected = config.edibles.filter((e) => EDIBLE_KINDS.includes(e.kind));
  assert.equal(world.stimulusCells.size, expected.length);
  for (const d of config.dangers) {
    assert.equal(world.isStimulusCell(Math.floor(d.x), Math.floor(d.y)), false, `danger ${d.kind} must not be a stimulus`);
  }
  // reach = radius × sprite size in tiles, the size from the catalogue (contracts/odour-reach.md §1)
  for (const e of expected) {
    const { w, h } = catalog.lookup(e.sprite).sprite;
    const idx = cellIndex(e.x, e.y, logic.cols);
    const want = config.flies.stimulus.radius * (Math.max(w, h) / 32);
    assert.ok(Math.abs(world.stimulusCells.get(idx).reach - want) < 1e-9, `${e.kind} reach`);
  }
});

test('spawns the configured count, every spawn is walkable, and the same seed gives the same positions', () => {
  const a = spawnFlies(config, world);
  const b = spawnFlies(config, world);
  assert.equal(a.length, config.flies.count);
  for (const f of a) {
    assert.ok(world.walkable(Math.floor(f.body.x), Math.floor(f.body.y)), `fly ${f.id} spawned on a blocked cell`);
  }
  assert.deepEqual(a.map((f) => [f.body.x, f.body.y, f.body.heading]), b.map((f) => [f.body.x, f.body.y, f.body.heading]));
});

test('brain seeds are distinct per fly', () => {
  const seeds = spawnFlies(config, world).map((f) => f.brainSeed);
  assert.equal(new Set(seeds).size, seeds.length);
});

test('a world with no walkable cell throws the spawn error', () => {
  const blockedWorld = { ...world, walkable: () => false };
  assert.throws(() => spawnFlies(config, blockedWorld), { message: 'no walkable cell for fly 0' });
});

test('each fly draws the sprite for its declared sex, normal or baseline by mode (contracts/fly-sprite.md §2, BUG-002)', () => {
  const toy = spawnFlies(config, world, 'toy');
  const baseline = spawnFlies(config, world, 'baseline');
  for (let i = 0; i < config.flies.sex.length; i++) {
    const sex = config.flies.sex[i];
    assert.equal(toy[i].sprite, `fly-${sex}`);
    assert.equal(baseline[i].sprite, `fly-${sex}-baseline`);
  }
});

test('a world without flies.sex falls back to flies.sprite/baselineSprite', () => {
  const c = { ...config, flies: { ...config.flies, sex: undefined } };
  const toy = spawnFlies(c, world, 'toy');
  const baseline = spawnFlies(c, world, 'baseline');
  assert.ok(toy.every((f) => f.sprite === config.flies.sprite));
  assert.ok(baseline.every((f) => f.sprite === config.flies.baselineSprite));
});
