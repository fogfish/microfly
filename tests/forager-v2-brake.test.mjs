// US2 (spec Acceptance Scenarios 1-2): mouth taste reaches forward and feed (ADR 006 D11 selects this pathway
// by construction — Annex A4's signed probe measured it directly), and leg taste on one side does not lower
// backward/turn-toward-that-side drives below their no-leg-taste values. These are WIRING checks on the real
// extracted brain, run with a held-constant input (the brake ratio itself, SC-007, needs a calibrated network —
// see calibration.md; it is not asserted here as a pass/fail gate, per AGENTS.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelIndex, fixture, newFly, OUTPUT_DRIVES, SKIP } from './forager-v2-fixture.mjs';

const WARMUP = 50;
const WINDOW = 400;

// Mean output per channel over WINDOW ticks after WARMUP, with a constant input vector.
function meanOutputs(seed, inputs) {
  const { brain } = newFly(seed);
  for (let t = 0; t < WARMUP; t++) brain.step({ inputs, hunger: 0.8 });
  const sums = new Float64Array(OUTPUT_DRIVES.length);
  for (let t = 0; t < WINDOW; t++) {
    const out = brain.step({ inputs, hunger: 0.8 });
    for (let k = 0; k < sums.length; k++) sums[k] += out.outputs[k];
  }
  return Array.from(sums, (s) => s / WINDOW);
}

test('mouth taste measurably changes forward and feed output versus no taste at all', { skip: SKIP }, () => {
  const { snapshot } = fixture();
  const n = snapshot.capabilities.channels.inputs.length;
  const zero = new Float32Array(n);
  const mouthLeft = channelIndex('taste:mouth', 'L');
  const mouthRight = channelIndex('taste:mouth', 'R');
  assert.ok(mouthLeft >= 0 && mouthRight >= 0, 'taste:mouth channels must be declared');
  const withTaste = new Float32Array(n);
  withTaste[mouthLeft] = 1;
  withTaste[mouthRight] = 1;

  const baseline = meanOutputs(1, zero);
  const tasted = meanOutputs(1, withTaste);
  const forwardK = OUTPUT_DRIVES.indexOf('forward');
  const feedK = OUTPUT_DRIVES.indexOf('feed');
  assert.notEqual(tasted[forwardK], baseline[forwardK],
    `forward output with mouth taste (${tasted[forwardK]}) should differ from no taste (${baseline[forwardK]})`);
  assert.notEqual(tasted[feedK], baseline[feedK],
    `feed output with mouth taste (${tasted[feedK]}) should differ from no taste (${baseline[feedK]})`);
});

test('leg taste on one side does not lower backward or turn-toward-that-side below their no-leg-taste values', { skip: SKIP }, () => {
  const { snapshot } = fixture();
  const n = snapshot.capabilities.channels.inputs.length;
  const zero = new Float32Array(n);
  const legLeft = channelIndex('taste:leg', 'L');
  assert.ok(legLeft >= 0, 'taste:leg-left channel must be declared');
  const withLegTaste = new Float32Array(n);
  withLegTaste[legLeft] = 1;

  const baseline = meanOutputs(2, zero);
  const tasted = meanOutputs(2, withLegTaste);
  const backwardK = OUTPUT_DRIVES.indexOf('backward');
  const turnLeftK = OUTPUT_DRIVES.indexOf('turnLeft'); // toward the tasting (left) side
  assert.ok(tasted[backwardK] >= baseline[backwardK] - 1e-6,
    `backward with leg taste (${tasted[backwardK]}) should not drop below no-taste (${baseline[backwardK]})`);
  assert.ok(tasted[turnLeftK] >= baseline[turnLeftK] - 1e-6,
    `turn-left (toward the tasting side) with leg taste (${tasted[turnLeftK]}) should not drop below no-taste (${baseline[turnLeftK]})`);
});
