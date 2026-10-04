// Random-walk baseline motors: seeded, in [0, 1], and a different stream from the toy brain seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineMotor } from '../public/js/fly/baseline.js';
import { createPrng } from '../public/js/world/prng.js';

test('the same seed gives the same motor sequence', () => {
  const a = createBaselineMotor(77);
  const b = createBaselineMotor(77);
  for (let t = 0; t < 100; t++) assert.deepEqual(a.next(), b.next());
});

test('motor values stay in [0, 1]', () => {
  const m = createBaselineMotor(1);
  for (let t = 0; t < 1000; t++) {
    const { left, right } = m.next();
    assert.ok(left >= 0 && left < 1 && right >= 0 && right < 1);
  }
});

test('the baseline stream differs from the toy brain stream for the same fly seed', () => {
  const seed = 123456;
  const toyFirst = createPrng(seed).next();
  const baselineFirst = createBaselineMotor(seed).next().left;
  assert.notEqual(baselineFirst, toyFirst);
});
