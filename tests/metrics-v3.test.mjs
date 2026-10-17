// Part K, v3-style arms (ADR 010, spec.md SC-002/SC-003): feedArrivalWithin (K2) and escapeOrTurnWithin (K4). Pure
// functions on one fly's per-tick records, with known hand-computed values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedArrivalWithin, escapeOrTurnWithin } from '../public/js/fly/metrics.js';

test('feedArrivalWithin: counts an arrival (onFlower false -> true) fed within the window', () => {
  const records = [
    { onFlower: false, eating: false },
    { onFlower: true, eating: false },  // arrival
    { onFlower: true, eating: false },
    { onFlower: true, eating: true },   // fed, 2 ticks after arrival
  ];
  assert.deepEqual(feedArrivalWithin(records, 50), { rate: 1, arrivals: 1, fed: 1 });
});

test('feedArrivalWithin: an arrival with no feed within the window is not counted as fed', () => {
  const records = [
    { onFlower: false, eating: false },
    { onFlower: true, eating: false },  // arrival
    { onFlower: true, eating: false },
    { onFlower: true, eating: true },   // fed, but outside a window of 1
  ];
  assert.deepEqual(feedArrivalWithin(records, 1), { rate: 0, arrivals: 1, fed: 0 });
});

test('feedArrivalWithin: staying on the flower for two ticks is only one arrival, not two', () => {
  const records = [
    { onFlower: false, eating: false },
    { onFlower: true, eating: false },  // arrival
    { onFlower: true, eating: true },   // still the same visit, not a second arrival
  ];
  assert.deepEqual(feedArrivalWithin(records, 50), { rate: 1, arrivals: 1, fed: 1 });
});

test('feedArrivalWithin: being on the flower at the first recorded tick counts as an arrival', () => {
  // There is no earlier tick to compare against, so the first recorded tick is treated as the start of the visit.
  const records = [{ onFlower: true, eating: false }, { onFlower: true, eating: true }];
  assert.deepEqual(feedArrivalWithin(records, 50), { rate: 1, arrivals: 1, fed: 1 });
});

test('feedArrivalWithin: no arrivals gives a null rate, not NaN', () => {
  assert.deepEqual(feedArrivalWithin([{ onFlower: false, eating: false }], 50), { rate: null, arrivals: 0, fed: 0 });
});

test('escapeOrTurnWithin: counts a hazard-ring encounter resolved (distance > radius again) within the window', () => {
  const records = [
    { distance: 5 }, { distance: 1 }, // encounter at index 1 (radius 1.5)
    { distance: 1.2 }, { distance: 2 }, // resolved at index 3, 2 ticks after the encounter
  ];
  assert.deepEqual(escapeOrTurnWithin(records, 1.5, 20), { rate: 1, encounters: 1, resolved: 1 });
});

test('escapeOrTurnWithin: an encounter not resolved within the window counts against the rate', () => {
  const records = [{ distance: 5 }, { distance: 1 }, { distance: 1 }, { distance: 1 }];
  assert.deepEqual(escapeOrTurnWithin(records, 1.5, 1), { rate: 0, encounters: 1, resolved: 0 });
});

test('escapeOrTurnWithin: staying inside the ring across the boundary is only one encounter', () => {
  const records = [{ distance: 1 }, { distance: 1 }, { distance: 2 }];
  assert.deepEqual(escapeOrTurnWithin(records, 1.5, 20), { rate: 1, encounters: 1, resolved: 1 });
});

test('escapeOrTurnWithin: no encounters gives a null rate, not NaN', () => {
  assert.deepEqual(escapeOrTurnWithin([{ distance: 5 }, { distance: 4 }], 1.5, 20), { rate: null, encounters: 0, resolved: 0 });
});
