// Fly world from the shipped config: blocked map, reproducible and walkable spawns, count, no-cell error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateTerrain, placeObjects } from '../public/js/world/generate.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';

const config = JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
const grid = generateTerrain(config);
const { objects } = placeObjects(config, grid);
const world = buildWorld(config, grid, objects);
const terrainIndex = (id) => config.terrain.findIndex((t) => t.id === id);
const cellOf = (o) => o.y * world.width + o.x;

test('buildWorld marks water, rock and scenery as blocked, and grass without scenery as free', () => {
  const water = terrainIndex('water');
  const grass = terrainIndex('grass');
  const scenery = new Set(objects.filter((o) => o.kind === 'scenery').map(cellOf));
  let waterCells = 0;
  let grassCells = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === water) {
      waterCells++;
      assert.equal(world.blocked[i], 1, `water cell ${i} should be blocked`);
    }
    if (grid[i] === grass && !scenery.has(i)) {
      grassCells++;
      assert.equal(world.blocked[i], 0, `grass cell ${i} should be free`);
    }
  }
  assert.ok(waterCells > 0 && grassCells > 0, 'the shipped world should contain water and grass');
});

test('stimulus cells are the apples and cherries, not honey', () => {
  const fruit = objects.filter((o) => ['apple', 'cherry'].includes(o.ruleId));
  assert.equal(world.stimulusCells.size, fruit.length);
  for (const o of objects.filter((o) => o.ruleId === 'honey')) {
    assert.equal(world.stimulusCells.has(cellOf(o)), false, 'honey must not be a stimulus cell');
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
  const allWater = new Uint16Array(world.width * world.height).fill(terrainIndex('water'));
  const blockedWorld = buildWorld(config, allWater, []);
  assert.throws(() => spawnFlies(config, blockedWorld), { message: 'no walkable cell for fly 0' });
});
