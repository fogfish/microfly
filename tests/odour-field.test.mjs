// The odour field shows what the flies sense (specs/007-odor-layer/contracts/odour-layer.md §3; FR-004, FR-006, FR-007).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { odourField } from '../public/js/world/odour-field.js';
import { fruitIntensity } from '../public/js/fly/stimulus.js';

const points = [
  { x: 1.5, y: 1.5 },
  { x: 3.5, y: 2.5 },
];
const stimulus = { radius: 2, gain: 1, max: 1 };
const grid = { cols: 6, rows: 4, samplesPerCell: 4 };

const at = (field, i, j) => field.values[j * field.width + i];
const centre = (i, n) => (i + 0.5) / n;

test('every sample equals the sensed intensity at that point (parity)', () => {
  const f = odourField({ points, stimulus, ...grid });
  for (let j = 0; j < f.height; j++) {
    for (let i = 0; i < f.width; i++) {
      const sx = centre(i, f.samplesPerCell);
      const sy = centre(j, f.samplesPerCell);
      const want = Math.min(1, (stimulus.gain * fruitIntensity(points, sx, sy, stimulus.radius)) / stimulus.max);
      assert.ok(Math.abs(at(f, i, j) - want) < 1e-6, `sample (${i}, ${j}): ${at(f, i, j)} != ${want}`);
    }
  }
});

test('a sample beyond the radius of every point is exactly 0 (reach)', () => {
  const f = odourField({ points: [{ x: 0.5, y: 0.5 }], stimulus, ...grid });
  let checked = 0;
  for (let j = 0; j < f.height; j++) {
    for (let i = 0; i < f.width; i++) {
      const d = Math.hypot(centre(i, 4) - 0.5, centre(j, 4) - 0.5);
      if (d >= stimulus.radius) {
        assert.equal(at(f, i, j), 0);
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});

test('two sources add up (overlap)', () => {
  const s = { radius: 2, gain: 1, max: 10 };
  const two = odourField({ points: [{ x: 2, y: 2 }, { x: 4, y: 2 }], stimulus: s, cols: 6, rows: 4, samplesPerCell: 2 });
  const one = odourField({ points: [{ x: 2, y: 2 }], stimulus: s, cols: 6, rows: 4, samplesPerCell: 2 });
  // Sample (6, 3) sits at (3.25, 1.75): 1.27 cells from (2, 2), 0.79 from (4, 2)
  assert.ok(at(two, 6, 3) > at(one, 6, 3));
  assert.ok(at(one, 6, 3) > 0);
});

test('no value exceeds 1 (cap)', () => {
  const f = odourField({ points, stimulus: { radius: 2, gain: 5, max: 1 }, ...grid });
  assert.ok(f.values.every((v) => v <= 1));
  assert.ok(f.values.some((v) => v === 1));
});

test('a source at the edge writes only inside the field (bounds)', () => {
  const f = odourField({ points: [{ x: 0.5, y: 0.5 }], stimulus, ...grid });
  assert.equal(f.width, 24);
  assert.equal(f.height, 16);
  assert.equal(f.values.length, f.width * f.height);
  assert.ok(f.values.every((v) => Number.isFinite(v) && v >= 0));
  assert.ok(at(f, 0, 0) > 0);
});

test('no sources, or max 0, gives an empty field', () => {
  const none = odourField({ points: [], stimulus, ...grid });
  assert.ok(none.values.every((v) => v === 0));
  const zero = odourField({ points, stimulus: { radius: 2, gain: 1, max: 0 }, ...grid });
  assert.ok(zero.values.every((v) => v === 0));
});
