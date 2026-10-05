// The heatmap ramp (specs/007-odor-layer/contracts/odour-layer.md §4, research R4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRamp, rampColor } from '../public/js/render/heatmap.js';

const tokens = {
  '--odour-low': ' 1, 2, 3',
  '--odour-mid': '100, 110, 120',
  '--odour-high': '200, 210, 220 ',
  '--odour-alpha': ' 0.5',
};
const stub = (map) => ({ getPropertyValue: (n) => map[n] ?? '' });
const ramp = parseRamp(stub(tokens));

test('parseRamp reads the --odour-* tokens', () => {
  assert.deepEqual(ramp, {
    stops: [
      [1, 2, 3],
      [100, 110, 120],
      [200, 210, 220],
    ],
    maxAlpha: 0.5,
  });
});

test('parseRamp falls back to the defaults on missing or invalid tokens', () => {
  const defaults = {
    stops: [
      [255, 214, 10],
      [255, 128, 0],
      [220, 38, 38],
    ],
    maxAlpha: 0.55,
  };
  assert.deepEqual(parseRamp(stub({})), defaults);
  assert.deepEqual(parseRamp(stub({ '--odour-low': 'red', '--odour-mid': '1, 2', '--odour-high': '1, 2, 300', '--odour-alpha': '2' })), defaults);
});

test('alpha is 0 at t <= 0', () => {
  assert.equal(rampColor(0, ramp)[3], 0);
  assert.equal(rampColor(-1, ramp)[3], 0);
});

test('alpha does not decrease with t and stays under the cap', () => {
  let prev = -1;
  for (let i = 0; i <= 10; i++) {
    const a = rampColor(i / 10, ramp)[3];
    assert.ok(a >= prev);
    assert.ok(a <= 255 * ramp.maxAlpha);
    prev = a;
  }
});

test('t above 1 is treated as 1', () => {
  assert.deepEqual(rampColor(2, ramp), rampColor(1, ramp));
});

test('the colour hits the low, mid and high stops', () => {
  assert.deepEqual(rampColor(0, ramp).slice(0, 3), [1, 2, 3]);
  assert.deepEqual(rampColor(0.5, ramp).slice(0, 3), [100, 110, 120]);
  assert.deepEqual(rampColor(1, ramp).slice(0, 3), [200, 210, 220]);
});
