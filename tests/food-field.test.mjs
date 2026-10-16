// Food odour field: irregular, stepped, per-unit (contracts/world-format-sketch-map.md §4, research.md R4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foodKernel, foodField } from '../public/js/world/food-field.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the 3×3 core is exactly 1 for every unit, every seed', () => {
  for (const seed of [0, 1, 42, 999, 123456]) {
    const k = foodKernel({ unitX: 10.5, unitY: 10.5, seed });
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        assert.equal(k(10 + dx, 10 + dy), 1, `seed ${seed} at offset (${dx}, ${dy})`);
      }
    }
  }
});

test('beyond the core, value falls roughly 10% per ring and reaches 0 by about ring 10', () => {
  const k = foodKernel({ unitX: 10.5, unitY: 10.5, seed: 7 });
  assert.ok(k(12, 10) < 1 && k(12, 10) > 0, 'ring 2 is between 0 and 1');
  assert.equal(k(21, 10), 0, 'ring 11 is 0');
  assert.equal(k(100, 100), 0, 'far away is 0');
});

test('the footprint outline is not a perfect square or circle for at least one seed (irregularity)', () => {
  let irregular = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const k = foodKernel({ unitX: 20.5, unitY: 20.5, seed });
    // The Chebyshev-distance-10 ring is where the un-roughened kernel reaches exactly 0 (1 - 0.1 × 10); a
    // perfect square/circle falloff would make every cell on that ring the same (all 0 or all > 0). Noise
    // (±0.4 of a ring) should break that uniformity for at least one tested seed.
    const ring10 = [];
    for (let dx = -10; dx <= 10; dx++) {
      for (let dy = -10; dy <= 10; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 10) ring10.push(k(20 + dx, 20 + dy) > 0);
      }
    }
    if (ring10.some((v) => v) && ring10.some((v) => !v)) irregular = true;
  }
  assert.ok(irregular, 'no tested seed produced an irregular ring-10 boundary');
});

test('two overlapping units combine by maximum, not sum', () => {
  const units = [
    { x: 10.5, y: 10.5, seed: 1, stockFraction: 1 },
    { x: 12.5, y: 10.5, seed: 2, stockFraction: 1 },
  ];
  const { values } = foodField({ units, cols: 24, rows: 24 });
  // The overlap cell (11, 10) is within both units' 3×3 cores, so each kernel alone is 1; the combined value
  // must stay at 1 (the max), never 2 (what a sum would give).
  assert.equal(values[10 * 24 + 11], 1);
});

test('stock-fraction scaling: halving a unit\'s stockFraction halves its own contribution but never raises another\'s', () => {
  const full = foodField({
    units: [{ x: 10.5, y: 10.5, seed: 1, stockFraction: 1 }, { x: 18.5, y: 10.5, seed: 2, stockFraction: 1 }],
    cols: 24, rows: 24,
  });
  const halved = foodField({
    units: [{ x: 10.5, y: 10.5, seed: 1, stockFraction: 0.5 }, { x: 18.5, y: 10.5, seed: 2, stockFraction: 1 }],
    cols: 24, rows: 24,
  });
  // At unit 1's own cell (no overlap with unit 2), halving its stock exactly halves the value there.
  const idx1 = 10 * 24 + 10;
  assert.ok(Math.abs(halved.values[idx1] - full.values[idx1] / 2) < 1e-9);
  // Unit 2's own cell (far from unit 1) is unaffected by unit 1's stock change.
  const idx2 = 10 * 24 + 18;
  assert.equal(halved.values[idx2], full.values[idx2]);
  // No cell anywhere increases when a unit's stock is lowered.
  for (let i = 0; i < full.values.length; i++) assert.ok(halved.values[i] <= full.values[i] + 1e-9);
});

test('cells outside every unit\'s support read 0', () => {
  const { values } = foodField({ units: [{ x: 2.5, y: 2.5, seed: 1, stockFraction: 1 }], cols: 30, rows: 30 });
  assert.equal(values[29 * 30 + 29], 0);
});

// Connectivity over the shipped world.json (spec SC-004, mirroring tests/odour-food.test.mjs's former SC-003
// pattern): every food item is reachable from every other by following non-zero food odour.
test('world.json: every food unit is reachable from every other via non-zero food odour (SC-004)', () => {
  const config = JSON.parse(read('../public/world/world.json'));
  const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
  const logic = buildLogic(config, catalog);
  const { cols, rows } = logic;
  const units = config.edibles.map((e, i) => ({ x: e.x, y: e.y, seed: (i + 1) * 97, stockFraction: 1 }));
  const { values } = foodField({ units, cols, rows });

  const reached = new Uint8Array(cols * rows);
  const start = Math.floor(units[0].y) * cols + Math.floor(units[0].x);
  const queue = [start];
  reached[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % cols;
    const y = Math.floor(i / cols);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (!reached[j] && values[j] > 0) {
        reached[j] = 1;
        queue.push(j);
      }
    }
  }
  for (const u of units) {
    const idx = Math.floor(u.y) * cols + Math.floor(u.x);
    assert.equal(reached[idx], 1, `unit at (${u.x}, ${u.y}) is not reachable via non-zero food odour`);
  }
});
