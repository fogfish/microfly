// decoder-v1 reader (contracts/decoder-v1.md, ADR 010 D27–D29). Reject rules run before any fly starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecoder, createDecoderState, decodeTick } from '../public/js/fly/decoder.js';

const SNAPSHOT = { sha256: 'abc123', neuronCount: 10, senses: ['odour-food', 'odour-danger'] };

function validFile(overrides = {}) {
  return {
    format: 'decoder', version: 1,
    snapshot: { file: 'forager-brain-wide.brain', sha256: 'abc123' },
    lif: {},
    probe: { seeds: [1, 2, 3], heldBack: 4, ticks: 400, rule: 'D27' },
    pools: { 'side.odour-food.L': [0, 1], 'side.odour-food.R': [2, 3], 'drive.odour-food': [4, 5], alarm: [6], feed: [7], forward: [8], backward: [9] },
    valence: { 'odour-food': 'approach', 'odour-danger': 'avoid' },
    homeostasis: { rest: {} },
    provenance: {},
    ...overrides,
  };
}

test('rejects a snapshot.sha256 mismatch, quoting expected and got', () => {
  const file = validFile({ snapshot: { file: 'x.brain', sha256: 'different' } });
  assert.throws(
    () => parseDecoder(file, 'brains/x.decoder.json', SNAPSHOT),
    { message: 'decoder brains/x.decoder.json was built for a different snapshot (expected abc123, got different)' },
  );
});

test('rejects an out-of-range pool member index', () => {
  const file = validFile({ pools: { ...validFile().pools, feed: [99] } });
  assert.throws(
    () => parseDecoder(file, 'brains/x.decoder.json', SNAPSHOT),
    { message: 'decoder brains/x.decoder.json pool "feed" has an out-of-range index' },
  );
});

test('rejects a pools key naming an undeclared pair', () => {
  const file = validFile({ pools: { ...validFile().pools, 'drive.no-such-pair': [0] } });
  assert.throws(
    () => parseDecoder(file, 'brains/x.decoder.json', SNAPSHOT),
    { message: 'decoder brains/x.decoder.json names unknown pair "no-such-pair"' },
  );
});

test('rejects a valence value outside approach/avoid/none', () => {
  const file = validFile({ valence: { 'odour-food': 'sideways' } });
  assert.throws(
    () => parseDecoder(file, 'brains/x.decoder.json', SNAPSHOT),
    { message: 'decoder brains/x.decoder.json has an invalid valence for "odour-food"' },
  );
});

test('accepts a valid file and exposes a missing side pair as absent, not an empty array', () => {
  const file = validFile({ pools: { 'drive.odour-danger': [0], alarm: [1] }, valence: { 'odour-danger': 'avoid' } });
  const parsed = parseDecoder(file, 'brains/x.decoder.json', SNAPSHOT);
  assert.equal(parsed.pools['side.odour-danger.L'], undefined);
  assert.equal(Object.hasOwn(parsed.pools, 'side.odour-danger.L'), false);
});

// D29 per-tick decode: a left-side pool firing makes side positive; an absent side pair exposes side as absent.
test('decodeTick: a pair with no side pool exposes side as absent (undefined), not 0', () => {
  const file = validFile({ pools: { 'drive.odour-danger': [0], alarm: [1] }, valence: { 'odour-danger': 'avoid' } });
  const decoder = parseDecoder(file, 'p', SNAPSHOT);
  const channels = [
    { id: 'odour-danger-left', side: 'L' },
    { id: 'odour-danger-right', side: 'R' },
  ];
  const state = createDecoderState(decoder, channels);
  const { senses } = decodeTick(state, { spikes: new Uint32Array([0]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.equal(senses['odour-danger'].side, undefined);
});

test('decodeTick: a left-dominant side pool yields a positive side value', () => {
  const file = validFile();
  const decoder = parseDecoder(file, 'p', SNAPSHOT);
  const channels = [
    { id: 'odour-food-left', side: 'L' },
    { id: 'odour-food-right', side: 'R' },
  ];
  const state = createDecoderState(decoder, channels);
  // Both members of side.L fire, none of side.R.
  const { senses } = decodeTick(state, { spikes: new Uint32Array([0, 1]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.ok(senses['odour-food'].side > 0, `expected positive side, got ${senses['odour-food'].side}`);
});
