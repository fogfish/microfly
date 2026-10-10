// ADR 006 Gate C metrics (contracts/experiment-metrics-v2.md): brake, avoid, touch, escape and rest. Pure
// functions on hand-built per-tick records, the same style tests/metrics.test.mjs already uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avoidMetric, brakeMetric, escapeMetric, restMetric, touchMetric } from '../public/js/fly/metrics.js';

test('brake: median forward on-flower over off-flower, hungry ticks only', () => {
  const ticks = [
    { forward: 0.1, mouthTaste: 0.8, hungry: true },
    { forward: 0.2, mouthTaste: 0.6, hungry: true },
    { forward: 0.8, mouthTaste: 0, hungry: true },
    { forward: 0.6, mouthTaste: 0, hungry: true },
    { forward: 0.9, mouthTaste: 0.9, hungry: false }, // not hungry: excluded
  ];
  const ratio = brakeMetric(ticks);
  assert.ok(ratio < 1, `brake ratio ${ratio} should be below 1`);
  assert.ok(Math.abs(ratio - (0.15 / 0.7)) < 1e-9);
});

test('brake: null when either side (on-flower or off-flower) has no hungry data', () => {
  assert.equal(brakeMetric([{ forward: 0.5, mouthTaste: 0.5, hungry: true }]), null);
  assert.equal(brakeMetric([]), null);
});

test('avoid: the fraction of ticks within 1.5 tiles of the named danger kind', () => {
  const ticks = [
    { distanceToDanger: { spider: 1.0 } },
    { distanceToDanger: { spider: 1.4 } },
    { distanceToDanger: { spider: 3.0 } },
    { distanceToDanger: {} },
  ];
  assert.equal(avoidMetric(ticks, 'spider'), 0.5);
  assert.equal(avoidMetric(ticks, 'lantern'), 0);
  assert.equal(avoidMetric([], 'spider'), 0);
});

test('touch: the fraction of ticks with a nonzero touch input', () => {
  const ticks = [{ touch: 0 }, { touch: 1 }, { touch: 0.5 }, { touch: 0 }];
  assert.equal(touchMetric(ticks), 0.5);
});

test('escape: events per minute, near danger vs away from it', () => {
  const tickHz = 20;
  const near = Array.from({ length: 20 * 60 }, (_, i) => ({ nearDanger: true, escaped: i % 600 === 0 })); // 2/min
  const away = Array.from({ length: 20 * 60 }, () => ({ nearDanger: false, escaped: false }));
  const { near: nearRate, away: awayRate } = escapeMetric([...near, ...away], tickHz);
  assert.ok(Math.abs(nearRate - 2) < 1e-9, `near rate ${nearRate} should be 2/min`);
  assert.equal(awayRate, 0);
});

test('rest: mean activity per region, over ticks with no stimulus present', () => {
  const ticks = [
    { stimulusPresent: false, regionActivity: { al: 0.02, vnc: 0.01 } },
    { stimulusPresent: false, regionActivity: { al: 0.04, vnc: 0.03 } },
    { stimulusPresent: true, regionActivity: { al: 0.5, vnc: 0.5 } }, // excluded: stimulus present
  ];
  const result = restMetric(ticks);
  assert.ok(Math.abs(result.al - 0.03) < 1e-9);
  assert.ok(Math.abs(result.vnc - 0.02) < 1e-9);
});

test('rest: null for a region with no data among the rest ticks', () => {
  const ticks = [{ stimulusPresent: false, regionActivity: {} }];
  assert.deepEqual(restMetric(ticks), {});
});
