import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateTerrain, placeObjects } from '../public/js/world/generate.js';

const load = (relative) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));

const shipped = () => load('../public/world/world.json');

const terrainIndex = (config, id) => config.terrain.findIndex((t) => t.id === id);

const sameGrid = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Minimal config for focused tests
const tiny = (overrides = {}) => ({
  format: 'arcade-world',
  version: 1,
  seed: 7,
  world: { width: 4, height: 4, tileSize: 16 },
  camera: { zoom: { min: 1, max: 2, default: 1 } },
  sprites: { g: { sheet: 'x.png', x: 0, y: 0, w: 16, h: 16 } },
  terrain: [
    { id: 'grass', sprite: 'g', base: true },
    { id: 'water', sprite: 'g' },
    { id: 'rock', sprite: 'g' },
  ],
  terrainLayers: [],
  objects: [],
  ...overrides,
});

// --- Terrain (US1) ---

test('the same config gives an identical grid on two runs', () => {
  const c = shipped();
  assert.ok(sameGrid(generateTerrain(c), generateTerrain(c)));
});

test('the grid is width × height', () => {
  const c = shipped();
  assert.equal(generateTerrain(c).length, c.world.width * c.world.height);
});

test('a water layer only overwrites cells listed in its on array', () => {
  // grass is base, but water may only replace rock, so no cell becomes water
  const c = tiny({
    terrainLayers: [{ shape: 'blobs', terrain: 'water', count: 5, radius: [1, 2], on: ['rock'] }],
  });
  const grid = generateTerrain(c);
  assert.equal(grid.filter((v) => v === terrainIndex(c, 'water')).length, 0);
});

test('rock never replaces water in the shipped config', () => {
  // Water is laid first. Removing the rock layer must leave every water cell unchanged,
  // because the rock layer runs after water and may only replace grass.
  const full = shipped();
  const waterOnly = shipped();
  waterOnly.terrainLayers = waterOnly.terrainLayers.filter((l) => l.terrain === 'water');

  const withRock = generateTerrain(full);
  const withoutRock = generateTerrain(waterOnly);
  const water = terrainIndex(full, 'water');

  for (let i = 0; i < withoutRock.length; i++) {
    if (withoutRock[i] === water) assert.equal(withRock[i], water, `cell ${i} lost its water`);
  }
});

// --- Placement (US2) ---

test('every placed object sits on an allowed terrain and never on water', () => {
  const c = shipped();
  const grid = generateTerrain(c);
  const { objects } = placeObjects(c, grid);
  const water = terrainIndex(c, 'water');
  const rules = Object.fromEntries(c.objects.map((r) => [r.id, r]));

  assert.ok(objects.length > 0);
  for (const o of objects) {
    const allowed = rules[o.ruleId].allowedTerrain.map((id) => terrainIndex(c, id));
    const t = grid[o.y * c.world.width + o.x];
    assert.ok(allowed.includes(t), `${o.ruleId} at ${o.x},${o.y} is on a disallowed terrain`);
    assert.notEqual(t, water);
  }
});

test('every pair of objects of a rule is at least minSpacing apart', () => {
  const c = shipped();
  const { objects } = placeObjects(c, generateTerrain(c));
  const spacing = Object.fromEntries(c.objects.map((r) => [r.id, r.minSpacing ?? 0]));

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      if (a.ruleId !== b.ruleId) continue;
      const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      assert.ok(d >= spacing[a.ruleId], `${a.ruleId} pair at distance ${d}`);
    }
  }
});

test('a rule whose count cannot be met lists the shortfall', () => {
  // A 4×4 grid fits at most 4 objects at spacing 3 (Chebyshev), so 50 leaves 46 short
  const c = tiny({
    objects: [
      { id: 'dense', kind: 'scenery', sprite: 'g', count: 50, allowedTerrain: ['grass'], minSpacing: 3 },
    ],
  });
  const { objects, report } = placeObjects(c, generateTerrain(c));
  assert.equal(report.placed.dense, objects.length);
  assert.equal(report.shortfall.dense, 50 - objects.length);
  assert.ok(report.shortfall.dense > 0);
});

// --- Reproducibility (US3) ---

test('the same config and seed give identical grids and objects', () => {
  const c = shipped();
  const a = generateTerrain(c);
  const b = generateTerrain(c);
  assert.ok(sameGrid(a, b));
  assert.deepEqual(placeObjects(c, a).objects, placeObjects(c, b).objects);
});

test('a different seed changes the grid', () => {
  const c = shipped();
  const other = { ...c, seed: c.seed + 1 };
  assert.ok(!sameGrid(generateTerrain(c), generateTerrain(other)));
});

test('a small fixture generates from its own config, not from world.json', () => {
  const c = load('./fixtures/small-world.json');
  const grid = generateTerrain(c);
  assert.equal(grid.length, 32 * 32);
  const { objects, report } = placeObjects(c, grid);
  assert.equal(objects.length, c.objects[0].count - (report.shortfall[c.objects[0].id] ?? 0));
  assert.ok(objects.every((o) => o.ruleId === c.objects[0].id));
});
