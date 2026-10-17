// C2 pool selection (decoder-engine.mjs, ADR 010 D27, contracts/decoder-v1.md "Writer rules"): determinism,
// the |s| desc / bodyId asc sort, and a forced held-back-seed sign mismatch producing E-DECODE-<pool> with no
// pools returned. A small synthetic graph (not the real ~1,320-candidate brain) — fast, and isolates the
// selection/sort/reproduction logic from the real snapshot's actual connectivity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runC2 } from '../.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs';

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

// neurons: 0 odour-left, 1 odour-right, 2 forward(out), 3 feed(out), 4/5 strong-left (tied |s|, different
// bodyId), 6 strong-right, 7 partial (left w10 + right w3: not selective either way, but drive-eligible).
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

const LOOSE_GATES = {
  seeds: [1, 2, 3], heldBack: 99, ticks: 60,
  sideThreshold: 0.1, sideMinRiseHz: 0, minSideMembers: 1, driveRiseHz: 0.1, driveSelectivityRatio: 0.01,
};

test('C2 pool selection is deterministic for the same snapshot/LIF block/seeds', () => {
  const ctx = passingCtx();
  const a = runC2(ctx, { synapticScale: 1 }, LOOSE_GATES);
  const b = runC2(ctx, { synapticScale: 1 }, LOOSE_GATES);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(a.pools, b.pools, 'two runs of the same inputs must give identical pools');
});

test('side pool members sort by |s| descending, ties on bodyId ascending', () => {
  const ctx = passingCtx();
  const { pools, errors } = runC2(ctx, { synapticScale: 1 }, LOOSE_GATES);
  assert.deepEqual(errors, []);
  // Candidates 4 and 5 are tied at |s| = 1 (both purely left-driven); bodyId 100 (neuron 5) sorts before 500 (neuron 4).
  assert.deepEqual(pools['side.odour-food.L'], [5, 4]);
  assert.deepEqual(pools['side.odour-food.R'], [6]);
});

test('a forced held-back-seed sign mismatch below the reproduction fraction produces E-DECODE-<pool> and no pools', () => {
  const n = 9;
  // neuron 8: symmetric weight (1.05 each side) + thresholdJitter — its sign is calibration-consistent
  // (seeds 1-3) but flips on the held-back seed (seed 8), forcing the reproduction check to fail.
  const offsets = Uint32Array.from([0, 1, 2, 2, 2, 2, 2, 2, 2]);
  const targets = Uint32Array.from([8, 8]);
  const weights = Float64Array.from([1.05, 1.05]);
  const neurons = Array.from({ length: n }, (_, i) => ({ superclass: i === 8 ? 'descending_neuron' : null, bodyId: 1000 + i }));
  const snapshot = { version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights, capabilities: CAPABILITIES, manifest: { neurons } };
  const ctx = { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: {} } }, snapshot, capabilities: CAPABILITIES };
  const gates = { ...LOOSE_GATES, heldBack: 8 };
  const { errors, pools } = runC2(ctx, { synapticScale: 1, thresholdJitter: 0.3 }, gates);
  assert.deepEqual(errors, ['E-DECODE-side.odour-food.R']);
  assert.equal(pools, null, 'C2 writes no pools/file when a selection fails its held-back reproduction check');
});
