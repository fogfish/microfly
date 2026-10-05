// Fade envelope and per-neuron spike times (data-model.md, ActivityState; research R2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActivity, envelope } from '../public/js/brain/activity.js';

const close = (actual, expected, tol = 1e-4) => assert.ok(Math.abs(actual - expected) < tol, `${actual} ≈ ${expected}`);

test('the envelope is the base at the spike and rises to a peak near 120 ms', () => {
  assert.equal(envelope(0), 0.12);
  close(envelope(60), 0.518128);
  close(envelope(120), 0.840483);
});

test('after 600 ms the envelope is about 0.37 of the peak above base', () => {
  close(envelope(600), 0.443734);
  close((envelope(600) - 0.12) / 0.88, 0.367879);
});

test('a neuron that never spiked stays at base', () => {
  assert.equal(envelope(Infinity), 0.12);
});

test('recordTick then brightness gives the envelope for the spiked neurons only', () => {
  const activity = createActivity(4);
  activity.recordTick(Uint32Array.from([1, 3]), 1000);
  const b = activity.brightness(1120);
  close(b[1], 0.840483);
  close(b[3], 0.840483);
  close(b[0], 0.12);
  close(b[2], 0.12);
});

test('a later spike restarts the rise for that neuron', () => {
  const activity = createActivity(1);
  activity.recordTick(Uint32Array.from([0]), 0);
  activity.recordTick(Uint32Array.from([0]), 500);
  close(activity.brightness(500)[0], 0.12);
});

test('isFading is true after a spike and false once every neuron is past about 4 × fallMs', () => {
  const activity = createActivity(2);
  assert.equal(activity.isFading(0), false);
  activity.recordTick(Uint32Array.from([0]), 1000);
  assert.equal(activity.isFading(1000), true);
  assert.equal(activity.isFading(1000 + 2399), true);
  assert.equal(activity.isFading(1000 + 2400), false);
});

test('brightness reuses an output buffer when one is given', () => {
  const activity = createActivity(3);
  const buffer = new Float32Array(3);
  assert.equal(activity.brightness(0, buffer), buffer);
});
