// calibrate.mjs's --stage=all (T028, ADR 010 Part H, spec FR-018 / Story 6 Acceptance Scenario 2): "stops at the
// first stage that fails its gate ... and does not continue to a later stage." decoder-engine.mjs's
// runC1ThenC2 is the same stop-at-first-failure contract calibrate.mjs's CLI dispatch implements, pulled out
// pure (no file I/O, no process.exit) so it is testable directly with a synthetic ctx/profile — spawning the
// real CLI needs a real world config and a real .brain snapshot on disk. Small graphs, not the real ~1,320-
// candidate brain: fast, and isolate the orchestration logic from the real snapshot's connectivity (same
// approach as tests/decoder-engine.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runC1ThenC2 } from '../.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs';

const CAPABILITIES = {
  signals: ['spikes'],
  channels: {
    inputs: [
      { id: 'odour-food-left', label: 'l', side: 'L', neurons: [0], range: [0, 1], sense: 'odour-food', site: 'antenna' },
      { id: 'odour-food-right', label: 'r', side: 'R', neurons: [1], range: [0, 1], sense: 'odour-food', site: 'antenna' },
    ],
    outputs: [
      { id: 'forward', label: 'forward', side: 'both', neurons: [2], range: [0, 1], drive: 'forward' },
      { id: 'feed', label: 'feed', side: 'both', neurons: [3], range: [0, 1], drive: 'feed' },
    ],
  },
};

// Same connectivity as tests/decoder-engine.test.mjs's passingCtx(): neurons 4/5 strong-left (tied |s|), 6
// strong-right, 7 partial -- a fixture C2 selects clean side pools from, so C2 can actually pass here.
function passingCtx() {
  const n = 8;
  const offsets = Uint32Array.from([0, 3, 5, 5, 5, 5, 5, 5]);
  const targets = Uint32Array.from([4, 5, 7, 6, 7]);
  const weights = Float64Array.from([10, 10, 10, 10, 3]);
  const neurons = Array.from({ length: n }, (_, i) => ({
    superclass: i >= 4 ? 'descending_neuron' : null, bodyId: i === 4 ? 500 : (i === 5 ? 100 : 1000 + i),
  }));
  const snapshot = { version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights, capabilities: CAPABILITIES, manifest: { neurons } };
  return { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: {} } }, snapshot, capabilities: CAPABILITIES };
}

// tests/decoder-engine.test.mjs's own held-back-mismatch fixture: C2 fails (E-DECODE-side.odour-food.R) no
// matter how loose its own gates are, so a profile that reaches C2 with this ctx always stops there.
function c2FailingCtx() {
  const n = 9;
  const offsets = Uint32Array.from([0, 1, 2, 2, 2, 2, 2, 2, 2]);
  const targets = Uint32Array.from([8, 8]);
  const weights = Float64Array.from([1.05, 1.05]);
  const neurons = Array.from({ length: n }, (_, i) => ({ superclass: i === 8 ? 'descending_neuron' : null, bodyId: 1000 + i }));
  const snapshot = { version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights, capabilities: CAPABILITIES, manifest: { neurons } };
  // thresholdJitter lives on ctx.f.brain.lif (not the C1 grid), so it survives into C2's lifBlock unchanged
  // ({ ...ctx.f.brain.lif, ...c1.chosen.point } only overrides synapticScale/baselineCurrent).
  return { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: { thresholdJitter: 0.3 } } }, snapshot, capabilities: CAPABILITIES };
}

const LOOSE_C1_GATES = { seeds: [1], ticks: 10, ignitionTicks: 2, restMin: 0, restMax: 1, driveRiseHz: 0 };
const IMPOSSIBLE_C1_GATES = { ...LOOSE_C1_GATES, restMin: 0.99 }; // no trivial/sparse graph reaches 99% rest activity
const LOOSE_C2_GATES = { seeds: [1, 2, 3], heldBack: 99, ticks: 60, sideThreshold: 0.1, sideMinRiseHz: 0, minSideMembers: 1, driveRiseHz: 0.1, driveSelectivityRatio: 0.01 };
const VALENCE = { 'odour-food': 'approach' };

function profile({ c1Gates, c2Gates = LOOSE_C2_GATES } = {}) {
  return { c1: { grid: { synapticScale: [1], baselineCurrent: [0] }, gates: c1Gates }, c2: { gates: c2Gates, valence: VALENCE } };
}

test('stops at C1 when no grid point passes its gate, and never runs C2', () => {
  const result = runC1ThenC2(passingCtx(), profile({ c1Gates: IMPOSSIBLE_C1_GATES }));
  assert.equal(result.stoppedAt, 'c1');
  assert.equal(result.c1.chosen, null);
  assert.equal(result.c2, undefined, 'C2 must not have run');
});

test('stops at C2 when its gate fails, after C1 has already passed', () => {
  const result = runC1ThenC2(c2FailingCtx(), profile({ c1Gates: LOOSE_C1_GATES, c2Gates: { ...LOOSE_C2_GATES, heldBack: 8 } }));
  assert.equal(result.stoppedAt, 'c2');
  assert.ok(result.c1.chosen, 'C1 must have passed for the pipeline to reach C2');
  assert.deepEqual(result.c2.errors, ['E-DECODE-side.odour-food.R']);
});

test('runs both stages and stops nowhere when both gates pass', () => {
  const result = runC1ThenC2(passingCtx(), profile({ c1Gates: LOOSE_C1_GATES }));
  assert.equal(result.stoppedAt, null);
  assert.ok(result.c1.chosen);
  assert.deepEqual(result.c2.errors, []);
  assert.ok(result.c2.pools, 'C2 must have written pools when it passes');
});

test('a budget already spent before C1 stops there without running either stage\'s gate check masking it', () => {
  const result = runC1ThenC2(passingCtx(), profile({ c1Gates: LOOSE_C1_GATES }), { budgetMinutesLeft: () => -1 });
  assert.equal(result.stoppedAt, 'c1');
  assert.equal(result.overBudget, true);
  assert.equal(result.c2, undefined, 'C2 must not have run once the budget is already spent');
});
