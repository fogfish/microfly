// US4 (spec Acceptance Scenario 1): a fly whose front leg meets a non-walkable cell changes its turn output on
// that side. Records the measured direction rather than asserting a side (ADR 006 Q4 is an open question: wall
// following vs. an artefact of the linear probe) — a wiring check on the real extracted brain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelIndex, fixture, newFly, OUTPUT_DRIVES, SKIP } from './forager-v2-fixture.mjs';

const WARMUP = 50;
const WINDOW = 400;

function meanOutputs(seed, inputs) {
  const { brain } = newFly(seed);
  for (let t = 0; t < WARMUP; t++) brain.step({ inputs, hunger: 0.5 });
  const sums = new Float64Array(OUTPUT_DRIVES.length);
  for (let t = 0; t < WINDOW; t++) {
    const out = brain.step({ inputs, hunger: 0.5 });
    for (let k = 0; k < sums.length; k++) sums[k] += out.outputs[k];
  }
  return Array.from(sums, (s) => s / WINDOW);
}

test('a blocked left front leg changes turn output, and the measured direction is recorded (not asserted)', { skip: SKIP }, () => {
  const { snapshot } = fixture();
  const n = snapshot.capabilities.channels.inputs.length;
  const zero = new Float32Array(n);
  const touchLeft = channelIndex('touch', 'L');
  assert.ok(touchLeft >= 0, 'touch-left channel must be declared');
  const withTouch = new Float32Array(n);
  withTouch[touchLeft] = 1;

  const baseline = meanOutputs(5, zero);
  const touched = meanOutputs(5, withTouch);
  const turnLeftK = OUTPUT_DRIVES.indexOf('turnLeft');
  const turnRightK = OUTPUT_DRIVES.indexOf('turnRight');
  const turnChanged = Math.abs(touched[turnLeftK] - baseline[turnLeftK]) > 1e-6
    || Math.abs(touched[turnRightK] - baseline[turnRightK]) > 1e-6;
  assert.ok(turnChanged, `turn output should change when the left front leg is touched: ${touched} vs ${baseline}`);
  // Measured direction (ADR 006 Q4), recorded here, not asserted toward either side:
  const towardTouchedSide = touched[turnLeftK] - baseline[turnLeftK];
  const awayFromTouchedSide = touched[turnRightK] - baseline[turnRightK];
  // eslint-disable-next-line no-console
  console.log(`Q4 measured direction: turnLeft delta ${towardTouchedSide.toFixed(4)}, `
    + `turnRight delta ${awayFromTouchedSide.toFixed(4)} (left leg touched)`);
});
