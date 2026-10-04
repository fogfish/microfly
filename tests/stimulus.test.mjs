// Fruit stimulus: linear falloff within radius, additive over fruit, sensory clamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fruitIntensity, sensoryValue } from '../public/js/fly/stimulus.js';

test('falloff is 1 at the source and 0 at radius and beyond', () => {
  const pts = [{ x: 5, y: 5 }];
  assert.equal(fruitIntensity(pts, 5, 5, 3), 1);
  assert.ok(Math.abs(fruitIntensity(pts, 6.5, 5, 3) - 0.5) < 1e-9, 'half-way is 0.5');
  assert.equal(fruitIntensity(pts, 8, 5, 3), 0);
  assert.equal(fruitIntensity(pts, 20, 5, 3), 0);
});

test('two fruit add up', () => {
  assert.equal(fruitIntensity([{ x: 5, y: 5 }, { x: 5, y: 5 }], 5, 5, 3), 2);
});

test('sensoryValue scales by gain and clamps to [0, max]', () => {
  assert.equal(sensoryValue(0.3, 2, 1), 0.6);
  assert.equal(sensoryValue(2, 1, 1), 1);
  assert.equal(sensoryValue(0.5, 4, 1), 1);
  assert.equal(sensoryValue(0, 1, 1), 0);
});

test('resting level is the sensory value with no fruit, and still capped at max', () => {
  assert.equal(sensoryValue(0, 1, 1, 0.2), 0.2);
  assert.equal(sensoryValue(0.5, 1, 1, 0.2), 0.7);
  assert.equal(sensoryValue(2, 1, 1, 0.2), 1);
});
