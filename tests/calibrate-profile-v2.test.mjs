// BUG-003 (ADR 006 Amendment 2026-10-11, A6): unit tests for profiles/v2.mjs's widened calibration grid --
// the corrected synapticScale centre and the three new LIF-mechanism axes (inhibitoryScale L8, adapt L2,
// thresholdJitter L3) `brainOf()` must forward into the lif config it builds. profiles/v1.mjs is untouched by
// this fix and is checked here only to confirm it stays that way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profile as v2 } from '../.claude/skills/microfly-calibrate/scripts/profiles/v2.mjs';
import { profile as v1 } from '../.claude/skills/microfly-calibrate/scripts/profiles/v1.mjs';

test('v2 brainOf forwards inhibitoryScale, adapt and thresholdJitter into the lif config', () => {
  const point = {
    synapticScale: 0.0049, tauSyn: 5, inputRateHigh: 0.15, stepsPerTick: 10, groupGain: {},
    inhibitoryScale: 2, adapt: [100, 0.05], thresholdJitter: 0.1,
  };
  const { lif } = v2.brainOf(point);
  assert.equal(lif.inhibitoryScale, 2);
  assert.equal(lif.tauAdapt, 100);
  assert.equal(lif.adaptStep, 0.05);
  assert.equal(lif.thresholdJitter, 0.1);
});

test('v2 brainOf defaults the new fields to their LIF no-ops when a point omits them', () => {
  const point = { synapticScale: 0.0098, tauSyn: 5, inputRateHigh: 0.15, stepsPerTick: 10 };
  const { lif } = v2.brainOf(point);
  assert.equal(lif.inhibitoryScale, 1);
  assert.equal(lif.tauAdapt, 0);
  assert.equal(lif.adaptStep, 0);
  assert.equal(lif.thresholdJitter, 0);
});

test('v2 axes are centred on the corrected synapticScale and include the new mechanism axes', () => {
  assert.deepEqual(v2.axes.synapticScale, [0.00245, 0.0049, 0.0098]);
  assert.deepEqual(v2.axes.inhibitoryScale, [1, 1.5, 2, 3]);
  assert.deepEqual(v2.axes.adapt, [[0, 0], [50, 0.05], [100, 0.05], [200, 0.05]]);
  assert.deepEqual(v2.axes.thresholdJitter, [0, 0.1, 0.2]);
});

test('v2 referencePoint carries a no-op value for every new axis (classify-phase single-axis scans)', () => {
  const ref = v2.referencePoint();
  assert.equal(ref.inhibitoryScale, 1);
  assert.deepEqual(ref.adapt, [0, 0]);
  assert.equal(ref.thresholdJitter, 0);
});

test('v1 brainOf is unaffected by BUG-003: same fields, no new ones', () => {
  const point = { synapticScale: 25, inhibitoryScale: 1.5, noise: [0.1, 0], tauSyn: 0 };
  const { lif } = v1.brainOf(point);
  assert.deepEqual(Object.keys(lif).sort(), ['inhibitoryScale', 'noiseAmplitude', 'noiseBulkScale', 'synapticScale', 'tauSyn'].sort());
  assert.equal(lif.synapticScale, 25);
  assert.equal(lif.inhibitoryScale, 1.5);
});
