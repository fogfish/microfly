// Fly world from the shipped config: blocked cells from the logic grid, stimulus cells, reproducible and walkable spawns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, cellIndex } from '../public/js/world/layout.js';
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

test('stimulus cells are the honey and flower cells, not dangers', () => {
  const expected = config.edibles.filter((e) => ['honey', 'flower'].includes(e.kind));
  assert.equal(world.stimulusCells.size, expected.length);
  for (const d of config.dangers) {
    assert.equal(world.isStimulusCell(Math.floor(d.x), Math.floor(d.y)), false, `danger ${d.kind} must not be a stimulus`);
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
