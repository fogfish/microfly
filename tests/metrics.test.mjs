// Gate C metrics (contracts/experiment-metrics.md): find, approach, eat, leave and hunger dependence, and the bootstrap
// interval. Pure functions on run records, so they are tested on hand-made records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findRate, findInterval, approachMedian, eatMedian, walkedShare, hungerDependence, bootstrapCI, median,
} from '../public/js/fly/metrics.js';

const flies = (found) => found.map((f) => ({ found: f }));

test('the find rate is the share of flies that reached a flower', () => {
  assert.equal(findRate(flies([true, false, true, true])).rate, 0.75);
  assert.equal(findRate(flies([])).rate, 0);
});

test('the approach median counts only flies that started beyond one odour radius, and reached a flower', () => {
  const runs = [
    { startDistance: 10, firstContactTick: 40 },
    { startDistance: 12, firstContactTick: 60 },
    { startDistance: 12, firstContactTick: null }, // never reached: excluded and counted
    { startDistance: 3, firstContactTick: 5 }, // inside one radius (8): not in this metric
  ];
  const result = approachMedian(runs, 8);
  assert.equal(result.median, 50);
  assert.equal(result.included, 2);
  assert.equal(result.excluded, 1);
});

test('the eat median is taken per energy class, over the bouts of that class', () => {
  const hungry = [{ ticks: 40 }, { ticks: 60 }, { ticks: 80 }];
  const sated = [{ ticks: 4 }, { ticks: 8 }];
  assert.equal(eatMedian(hungry), 60);
  assert.equal(eatMedian(sated), 6);
  assert.equal(eatMedian([]), null);
});

test('the walked share is the share of bouts that ended with the fly walking off', () => {
  const bouts = [{ endedBy: 'walked' }, { endedBy: 'sated' }, { endedBy: 'walked' }, { endedBy: 'empty' }];
  assert.equal(walkedShare(bouts), 0.5);
});

test('the hunger dependence is the find rate of hungry starts minus that of sated starts', () => {
  assert.ok(Math.abs(hungerDependence(flies([true, true, false, true]), flies([true, false, false, false])) - 0.5) < 1e-12);
});

test('the bootstrap interval is the same for the same seed, and brackets the mean', () => {
  const values = [0, 1, 1, 0, 1, 1, 1, 0, 1, 1];
  const a = bootstrapCI(values, 7);
  const b = bootstrapCI(values, 7);
  assert.deepEqual(a, b);
  assert.ok(a[0] <= 0.7 && 0.7 <= a[1], `interval ${a} should contain the mean 0.7`);
  assert.deepEqual(findInterval(flies(values), 7), a);
});

test('the median of an even and an odd list', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
