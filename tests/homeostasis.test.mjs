// D33: online homeostasis. rest/balance update only while a pool's sense is quiet, freeze while active, and a
// fly seeded from the decoder file's own initial values shows no persistent L/R turn bias at tick 0 (Story 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecoder, createDecoderState, decodeTick } from '../public/js/fly/decoder.js';

const SNAPSHOT = { sha256: 'abc', neuronCount: 20, senses: ['odour-food'] };
const CHANNELS = [{ id: 'odour-food-left', side: 'L' }, { id: 'odour-food-right', side: 'R' }];

function decoderFile(rest = {}) {
  return {
    format: 'decoder', version: 1,
    snapshot: { file: 'x.brain', sha256: 'abc' },
    lif: {}, probe: { seeds: [1], heldBack: 2, ticks: 10, rule: 'D27' },
    pools: {
      'side.odour-food.L': [0, 1, 2, 3],
      'side.odour-food.R': [4, 5, 6, 7],
      'drive.odour-food': [8, 9],
    },
    valence: { 'odour-food': 'approach' },
    homeostasis: { rest },
    provenance: {},
  };
}

test('rest and balance keep updating while quiet (inputs below 0.05)', () => {
  const decoder = parseDecoder(decoderFile(), 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  const before = state.rest['side.odour-food.L'];
  // Quiet (both inputs < 0.05), one left-pool neuron fires — rest should move from its seed.
  decodeTick(state, { spikes: new Uint32Array([0]), inputs: Float32Array.of(0.01, 0.01) }, decoder);
  assert.notEqual(state.rest['side.odour-food.L'], before);
});

test('rest and balance freeze while the pair is active (an input >= 0.05)', () => {
  const decoder = parseDecoder(decoderFile(), 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  const before = { ...state.rest };
  decodeTick(state, { spikes: new Uint32Array([0, 1, 2, 3]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.equal(state.rest['side.odour-food.L'], before['side.odour-food.L']);
  assert.equal(state.rest['side.odour-food.R'], before['side.odour-food.R']);
});

test('named pools (alarm/feed/forward/backward) freeze unless every sense is quiet', () => {
  const file = decoderFile();
  file.pools.alarm = [10];
  const decoder = parseDecoder(file, 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  const before = state.rest.alarm;
  // odour-food is active (0.9 >= 0.05), so alarm's rest must not update even though alarm's own pool fires.
  decodeTick(state, { spikes: new Uint32Array([10]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.equal(state.rest.alarm, before);
});

test('Story 7 Scenario 2: a quiet pool tracks a sustained rate drift over a long run, with no new calibration pass', () => {
  // The fly's own history (or the map) can shift a quiet pool's true rest rate away from its C2-seeded value;
  // D33 says rest keeps updating while quiet so the decode tracks that drift, rather than requiring calibrate.mjs
  // to be re-run. Seeded rest is 0.0 (no stimulus condition); a pool that now fires 2/4 members every quiet tick
  // (rate 0.5) must converge its rest rate toward 0.5 over many ticks, not stay pinned at its initial seed.
  const decoder = parseDecoder(decoderFile({ 'side.odour-food.L': 0 }), 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  for (let t = 0; t < 20000; t++) {
    decodeTick(state, { spikes: new Uint32Array([0, 1]), inputs: Float32Array.of(0.01, 0.01) }, decoder);
  }
  assert.ok(Math.abs(state.rest['side.odour-food.L'] - 0.5) < 0.05,
    `rest should have drifted toward 0.5, got ${state.rest['side.odour-food.L']}`);
});

test('Story 7 Scenario 2: an active pool does not drift — its rest freezes for the whole stimulus', () => {
  const decoder = parseDecoder(decoderFile({ 'side.odour-food.L': 0.4, 'side.odour-food.R': 0.2 }), 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  const before = { ...state.rest };
  for (let t = 0; t < 1000; t++) {
    decodeTick(state, { spikes: new Uint32Array([0, 1, 2, 3]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  }
  assert.equal(state.rest['side.odour-food.L'], before['side.odour-food.L']);
  assert.equal(state.rest['side.odour-food.R'], before['side.odour-food.R']);
});

test('a fresh fly seeded from the decoder file shows no persistent L/R turn bias at tick 0 (Story 7)', () => {
  // Seed rest so the pool is naturally L-biased at rest (restL > restR); a correctly balance-corrected side_p
  // should read ~0 under a perfectly symmetric (no stimulus) spike pattern matching that same bias ratio.
  const decoder = parseDecoder(decoderFile({ 'side.odour-food.L': 0.4, 'side.odour-food.R': 0.2, 'drive.odour-food': 0 }), 'p', SNAPSHOT);
  const state = createDecoderState(decoder, CHANNELS);
  // Simulate a tick whose raw L:R rate ratio (0.5 : 0.25 = 2:1) matches the seeded rest bias (0.4 : 0.2 = 2:1):
  // the balance correction should land side_p at exactly 0, not biased towards L.
  const spikes = new Uint32Array([0, 1, 4]); // 2/4 members of L, 1/4 of R
  const { senses } = decodeTick(state, { spikes, inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.ok(Math.abs(senses['odour-food'].side) < 1e-9, `side should be 0 at tick 0, got ${senses['odour-food'].side}`);
});
