// Gate C metrics, wide-I/O brain additions (contracts/experiment-metrics-wide.md, metrics 6-10): brake, stay,
// avoid, touch and escape (telemetry). Pure functions on hand-made records, with known hand-computed values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brakeMedian, stayMedian, avoidFraction, touchTurn, escapeMean } from '../public/js/fly/metrics.js';

test('brakeMedian: median forward on a flower divided by median forward off any flower', () => {
  const records = [
    { forward: 0.2, onFlower: true }, { forward: 0.4, onFlower: true }, { forward: 0.3, onFlower: true },
    { forward: 0.8, onFlower: false }, { forward: 1.0, onFlower: false }, { forward: 0.6, onFlower: false },
  ];
  // on-flower median 0.3, off-flower median 0.8 -> 0.375
  assert.equal(brakeMedian(records), 0.3 / 0.8);
});

test('brakeMedian is null with no samples on one side, or an off-flower median of 0', () => {
  assert.equal(brakeMedian([{ forward: 0.2, onFlower: true }]), null);
  assert.equal(brakeMedian([{ forward: 0.2, onFlower: true }, { forward: 0, onFlower: false }]), null);
});

test('stayMedian: the median tick length of the closed bouts', () => {
  assert.equal(stayMedian([{ ticks: 10 }, { ticks: 30 }, { ticks: 20 }]), 20);
  assert.equal(stayMedian([]), null);
});

test('avoidFraction: the share of ticks within radius tiles of a hazard', () => {
  const records = [{ distance: 0.5 }, { distance: 1.4 }, { distance: 1.5 }, { distance: 1.6 }, { distance: 5 }];
  // three of five are at or within 1.5
  assert.equal(avoidFraction(records, 1.5), 3 / 5);
  assert.equal(avoidFraction([], 1.5), 0);
});

test('touchTurn: mean turnLeft - turnRight over the ten ticks after a one-sided touch', () => {
  const records = [
    { touchLeft: 1, touchRight: 0, turnLeft: 0, turnRight: 0 }, // touch event at index 0
    { touchLeft: 0, touchRight: 0, turnLeft: 0.6, turnRight: 0.2 }, // +0.4
    { touchLeft: 0, touchRight: 0, turnLeft: 0.5, turnRight: 0.1 }, // +0.4
    { touchLeft: 0, touchRight: 0, turnLeft: 0.2, turnRight: 0.2 }, // 0
  ];
  // window defaults to 10, but only 3 ticks follow the event here: mean(0.4, 0.4, 0) = 0.2667
  assert.ok(Math.abs(touchTurn(records) - (0.8 / 3)) < 1e-9);
});

test('touchTurn is signed by the touched side: a right touch followed by a right turn is toward (BUG-001)', () => {
  const records = [
    { touchLeft: 0, touchRight: 1, turnLeft: 0, turnRight: 0 }, // right-touch event
    { touchLeft: 0, touchRight: 0, turnLeft: 0.1, turnRight: 0.5 }, // turns right: toward, +0.4
  ];
  assert.ok(Math.abs(touchTurn(records) - 0.4) < 1e-9);
  // a fly that turns left after either touch has no net touch response, not a +ve one (the old left-bias reading)
  const biased = [
    { touchLeft: 1, touchRight: 0, turnLeft: 0, turnRight: 0 },
    { touchLeft: 0, touchRight: 0, turnLeft: 0.5, turnRight: 0.1 },
    { touchLeft: 0, touchRight: 1, turnLeft: 0, turnRight: 0 },
    { touchLeft: 0, touchRight: 0, turnLeft: 0.5, turnRight: 0.1 },
  ];
  assert.ok(Math.abs(touchTurn(biased, 1)) < 1e-9);
});

test('touchTurn ignores a bilateral touch (both sides at once) and returns null with no event', () => {
  const noEvent = [{ touchLeft: 0, touchRight: 0, turnLeft: 1, turnRight: 0 }];
  assert.equal(touchTurn(noEvent), null);
  const bilateral = [
    { touchLeft: 1, touchRight: 1, turnLeft: 0, turnRight: 0 },
    { touchLeft: 0, touchRight: 0, turnLeft: 1, turnRight: 0 },
  ];
  assert.equal(touchTurn(bilateral), null);
});

test('touchTurn respects a custom window', () => {
  const records = [
    { touchLeft: 1, touchRight: 0, turnLeft: 0, turnRight: 0 },
    { touchLeft: 0, touchRight: 0, turnLeft: 1, turnRight: 0 }, // within window 1
    { touchLeft: 0, touchRight: 0, turnLeft: 0, turnRight: 1 }, // outside window 1
  ];
  assert.equal(touchTurn(records, 1), 1);
});

test('escapeMean: mean escape drive inside the danger radius versus outside it (telemetry)', () => {
  const records = [
    { escape: 0.2, inDanger: true }, { escape: 0.4, inDanger: true },
    { escape: 0.05, inDanger: false }, { escape: 0.1, inDanger: false }, { escape: 0.03, inDanger: false },
  ];
  const result = escapeMean(records);
  assert.ok(Math.abs(result.inside - 0.3) < 1e-9);
  assert.ok(Math.abs(result.outside - (0.18 / 3)) < 1e-9);
});

test('escapeMean is null on a side with no samples', () => {
  assert.deepEqual(escapeMean([{ escape: 0.5, inDanger: true }]), { inside: 0.5, outside: null });
});
