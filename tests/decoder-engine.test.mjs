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

// ADR 011 (forager-mb profile, 2026-10-21): noSidePairs skips side-pool selection for a named pair entirely —
// the same outcome as Part L's "too few members" fallback (klinotaxis alone), declared instead of discovered by
// a reproduction failure. The same fixture as above would otherwise hit E-DECODE-side.odour-food.R.
// ADR 012 R12: a `song` output in the capabilities gives a named `song` pool (the snapshot's own song-output
// neurons), the same way feed/forward/backward already work. No song output means no `song` key at all.
test('a song output in the capabilities gives a named song pool', () => {
  const capabilitiesWithSong = {
    signals: ['spikes'],
    channels: {
      inputs: CAPABILITIES.channels.inputs,
      outputs: [
        ...CAPABILITIES.channels.outputs,
        { id: 'song', label: 'song', side: 'both', neurons: [8], range: [0, 1], drive: 'song' },
      ],
    },
  };
  const n = 9;
  const offsets = Uint32Array.from([0, 3, 5, 5, 5, 5, 5, 5, 5]);
  const targets = Uint32Array.from([4, 5, 7, 6, 7]);
  const weights = Float64Array.from([10, 10, 10, 10, 3]);
  const neurons = Array.from({ length: n }, (_, i) => ({
    superclass: i >= 4 && i <= 6 ? 'descending_neuron' : null, bodyId: i === 4 ? 500 : (i === 5 ? 100 : 1000 + i),
  }));
  const snapshot = {
    version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights,
    capabilities: capabilitiesWithSong, manifest: { neurons },
  };
  const ctx = { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: {} } }, snapshot, capabilities: capabilitiesWithSong };
  const { pools, errors } = runC2(ctx, { synapticScale: 1 }, LOOSE_GATES);
  assert.deepEqual(errors, []);
  assert.deepEqual(pools.song, [8]);
});

test('a capabilities with no song output gives no song pool', () => {
  const ctx = passingCtx();
  const { pools, errors } = runC2(ctx, { synapticScale: 1 }, LOOSE_GATES);
  assert.deepEqual(errors, []);
  assert.equal(pools.song, undefined);
});

// ADR 012 research R15: the D27 specificity gate (driveSelectivityRatio) must drop a candidate from
// drive.<pair> when its rise under another pair's bilateral stimulus is not clearly smaller — the shared
// AL/LH risk a social pair's PNs could leak into a food pool's readout. Neuron 8 is wired identically to both
// odour-food and odour-conspecific (two weight-10 edges each), so it fires about as strongly under either
// pair's bilateral drive: neither rise clears 2x the other, so it must be excluded from both drive pools.
test("D27's specificity gate drops a candidate that responds as strongly to a conspecific pair (research R15)", () => {
  const capabilities = {
    signals: ['spikes'],
    channels: {
      inputs: [
        { id: 'odour-food-left', label: 'l', side: 'L', neurons: [0], range: [0, 1], sense: 'odour-food', site: 'antenna' },
        { id: 'odour-food-right', label: 'r', side: 'R', neurons: [1], range: [0, 1], sense: 'odour-food', site: 'antenna' },
        { id: 'odour-conspecific-left', label: 'l', side: 'L', neurons: [2], range: [0, 1], sense: 'odour:conspecific', site: 'antenna' },
        { id: 'odour-conspecific-right', label: 'r', side: 'R', neurons: [3], range: [0, 1], sense: 'odour:conspecific', site: 'antenna' },
      ],
      outputs: [
        { id: 'forward', label: 'forward', side: 'both', neurons: [4], range: [0, 1], drive: 'forward' },
        { id: 'feed', label: 'feed', side: 'both', neurons: [5], range: [0, 1], drive: 'feed' },
      ],
    },
  };
  const n = 9;
  // neuron 8 (the shared candidate) receives one weight-10 edge from each of the four input neurons.
  const offsets = Uint32Array.from([0, 1, 2, 3, 4, 4, 4, 4, 4]);
  const targets = Uint32Array.from([8, 8, 8, 8]);
  const weights = Float64Array.from([10, 10, 10, 10]);
  const neurons = Array.from({ length: n }, (_, i) => ({ superclass: i === 8 ? 'descending_neuron' : null, bodyId: 1000 + i }));
  const snapshot = { version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights, capabilities, manifest: { neurons } };
  const ctx = { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: {} } }, snapshot, capabilities };
  const gates = { ...LOOSE_GATES, driveSelectivityRatio: 2 };
  const { pools, errors } = runC2(ctx, { synapticScale: 1 }, gates);
  assert.deepEqual(errors, []);
  assert.equal(pools['drive.odour-food'], undefined, 'equally strong under both pairs: not specific to food');
  assert.equal(pools['drive.odour-conspecific'], undefined, 'equally strong under both pairs: not specific to conspecific');
});

test('noSidePairs skips side-pool selection for a named pair, with no error, and the decoder still builds', () => {
  const n = 9;
  const offsets = Uint32Array.from([0, 1, 2, 2, 2, 2, 2, 2, 2]);
  const targets = Uint32Array.from([8, 8]);
  const weights = Float64Array.from([1.05, 1.05]);
  const neurons = Array.from({ length: n }, (_, i) => ({ superclass: i === 8 ? 'descending_neuron' : null, bodyId: 1000 + i }));
  const snapshot = { version: 4, kind: 'forager-wide', neuronCount: n, offsets, targets, weights, capabilities: CAPABILITIES, manifest: { neurons } };
  const ctx = { f: { tickHz: 20, brain: { stepsPerTick: 1, lif: {} } }, snapshot, capabilities: CAPABILITIES };
  const gates = { ...LOOSE_GATES, heldBack: 8, noSidePairs: ['odour-food'] };
  const { errors, pools } = runC2(ctx, { synapticScale: 1, thresholdJitter: 0.3 }, gates);
  assert.deepEqual(errors, []);
  assert.equal(pools['side.odour-food.L'], undefined);
  assert.equal(pools['side.odour-food.R'], undefined);
  assert.ok(Array.isArray(pools['drive.odour-food']), 'drive.odour-food is unaffected by noSidePairs');
});
