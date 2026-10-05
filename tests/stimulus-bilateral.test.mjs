// Bilateral odour (ADR 003 W3): two antenna samples at ±antennaOffset across the heading, weighted by each flower's
// stock. The fly's left is (sin θ, −cos θ) in screen coordinates (y points down), so a flower on the left is nearer the
// left antenna.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { senseBilateral, antennaPoints } from '../public/js/fly/stimulus.js';
import { senseAt } from '../public/js/fly/stimulus.js';

const STIMULUS = { radius: 8, gain: 1, max: 1, resting: 0, antennaOffset: 0.5 };

test('the two samples sit at plus and minus antennaOffset across the heading', () => {
  const fly = { x: 10, y: 10, heading: 0 }; // facing east: the left antenna is north of the centre
  const { left, right } = antennaPoints(fly, 0.5);
  assert.ok(Math.abs(left.x - 10) < 1e-12 && Math.abs(left.y - 9.5) < 1e-12);
  assert.ok(Math.abs(right.x - 10) < 1e-12 && Math.abs(right.y - 10.5) < 1e-12);
});

test('an empty flower (stock 0) contributes nothing', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const flower = [{ x: 11.5, y: 10.5, fraction: 0 }];
  assert.deepEqual(senseBilateral(flower, fly, STIMULUS), { left: 0, right: 0 });
});

test('a flower six tiles away is sensed with radius 8', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const flower = [{ x: 16.5, y: 10.5, fraction: 1 }];
  const { left, right } = senseBilateral(flower, fly, STIMULUS);
  assert.ok(left > 0 && right > 0, `expected a sample at six tiles, got ${left} and ${right}`);
});

test('a flower on the fly\'s left gives the larger left sample', () => {
  const fly = { x: 10, y: 10, heading: 0 }; // facing east, so the left is north (smaller y)
  const flower = [{ x: 10.5, y: 7.5, fraction: 1 }];
  const { left, right } = senseBilateral(flower, fly, STIMULUS);
  assert.ok(left > right, `left ${left} should exceed right ${right}`);
});

test('the sample is weighted by the stock of the flower', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const full = senseBilateral([{ x: 12.5, y: 10.5, fraction: 1 }], fly, STIMULUS);
  const half = senseBilateral([{ x: 12.5, y: 10.5, fraction: 0.5 }], fly, STIMULUS);
  assert.ok(Math.abs(half.left - full.left / 2) < 1e-12);
});

test('the v0 sense is unchanged by the bilateral sampler', () => {
  // One flower at distance hypot(2.5, 0.5): falloff 1 − d ÷ radius, added to the resting level and clamped at max.
  const points = [{ x: 12.5, y: 10.5 }];
  const expected = Math.min(1, 0.2 + 1 * (1 - Math.hypot(2.5, 0.5) / 8));
  assert.equal(senseAt(points, 10, 10, { ...STIMULUS, resting: 0.2 }), expected);
});
