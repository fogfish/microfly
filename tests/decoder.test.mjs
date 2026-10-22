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

// ---- song pool (ADR 012 R12, channel-declaration-v6) ----

const SOCIAL_SNAPSHOT = {
  sha256: 'social123', neuronCount: 20,
  senses: ['odour-food-a', 'odour-food-b', 'odour-conspecific', 'contact-pheromone'],
  hasSongOutput: true,
};

function socialFile(overrides = {}) {
  return {
    format: 'decoder', version: 1,
    snapshot: { file: 'forager-brain-social.brain', sha256: 'social123' },
    lif: {},
    probe: { seeds: [1, 2, 3], heldBack: 4, ticks: 3000, rule: 'D27' },
    pools: {
      'drive.odour-food-a': [0], 'drive.odour-conspecific': [1], 'drive.contact-pheromone': [2],
      alarm: [3], feed: [4], forward: [5], backward: [6], song: [7, 8],
    },
    valence: { 'odour-food-a': 'approach', 'odour-conspecific': 'none', 'contact-pheromone': 'none' },
    valenceSource: { 'odour-conspecific': 'claims.md#odour-conspecific', 'contact-pheromone': 'claims.md#contact-pheromone' },
    homeostasis: { rest: {} },
    provenance: {},
    ...overrides,
  };
}

test('the social decoder loads against a snapshot that declares a song output', () => {
  const decoder = parseDecoder(socialFile(), 'brains/forager-brain-social.decoder.json', SOCIAL_SNAPSHOT);
  assert.deepEqual(decoder.pools.song, [7, 8]);
  assert.equal(decoder.valence['odour-conspecific'], 'none');
  assert.equal(decoder.valence['contact-pheromone'], 'none');
  assert.deepEqual(decoder.valenceSource, {
    'odour-conspecific': 'claims.md#odour-conspecific', 'contact-pheromone': 'claims.md#contact-pheromone',
  });
});

test('a song pool against a snapshot with no song output is rejected', () => {
  const noSongSnapshot = { ...SOCIAL_SNAPSHOT, hasSongOutput: false };
  assert.throws(
    () => parseDecoder(socialFile(), 'brains/forager-brain-mb.decoder.json', noSongSnapshot),
    /song pool needs a snapshot song output/,
  );
});

test('a song pool against forager-brain-mb.brain (no hasSongOutput at all) is rejected', () => {
  const mbSnapshot = { sha256: 'social123', neuronCount: 20, senses: SOCIAL_SNAPSHOT.senses };
  assert.throws(
    () => parseDecoder(socialFile(), 'brains/forager-brain-mb.decoder.json', mbSnapshot),
    /song pool needs a snapshot song output/,
  );
});

test('decodeTick: named.song.drive follows the pool rate, like the other named pools', () => {
  const decoder = parseDecoder(socialFile(), 'p', SOCIAL_SNAPSHOT);
  const channels = [
    { id: 'odour-food-a-left', side: 'L' }, { id: 'odour-food-a-right', side: 'R' },
    { id: 'odour-conspecific-left', side: 'L' }, { id: 'odour-conspecific-right', side: 'R' },
    { id: 'contact-pheromone-left', side: 'L' }, { id: 'contact-pheromone-right', side: 'R' },
  ];
  const state = createDecoderState(decoder, channels);
  const inputs = Float32Array.of(0, 0, 0, 0, 0.9, 0.9); // contact-pheromone present, drives song
  const quiet = decodeTick(state, { spikes: new Uint32Array([]), inputs }, decoder);
  assert.equal(quiet.named.song.drive, 0, 'no song-pool neuron fired: drive is 0');

  const firing = decodeTick(state, { spikes: new Uint32Array([7, 8]), inputs }, decoder);
  assert.ok(firing.named.song.drive > 0, `expected a positive song drive, got ${firing.named.song.drive}`);
});

// ---- learned valence ℓ (ADR 011, contracts/learning-v1.md, data-model.md "Learned valence") ----

const FOOD_SNAPSHOT = { sha256: 'abc123', neuronCount: 12, senses: ['odour-food-a', 'odour-food-b'] };
const FOOD_CHANNELS = [
  { id: 'odour-food-a-left', side: 'L' },
  { id: 'odour-food-a-right', side: 'R' },
];
const MBON = { approach: [10], avoid: [11] };

function foodFile(overrides = {}) {
  return {
    format: 'decoder', version: 1,
    snapshot: { file: 'forager-brain-mb.brain', sha256: 'abc123' },
    lif: {}, probe: { seeds: [1], heldBack: 2, ticks: 10, rule: 'D27' },
    pools: {}, valence: { 'odour-food-a': 'approach' }, homeostasis: { rest: {} }, provenance: {},
    ...overrides,
  };
}

test('rejects an unknown pair in learning.naive', () => {
  const file = foodFile({ learning: { naive: { 'odour-food-nope': 0.1 } } });
  assert.throws(
    () => parseDecoder(file, 'brains/x.decoder.json', FOOD_SNAPSHOT),
    { message: 'decoder brains/x.decoder.json names unknown pair "odour-food-nope"' },
  );
});

test('parseDecoder exposes learning as {} when the file carries none', () => {
  const decoder = parseDecoder(foodFile(), 'p', FOOD_SNAPSHOT);
  assert.deepEqual(decoder.learning, {});
});

test('learnedGain is undefined for a non-food pair, and for every pair when no mbon groups are given', () => {
  const decoder = parseDecoder(foodFile({ valence: { 'odour-danger': 'avoid' } }), 'p', FOOD_SNAPSHOT);
  const state = createDecoderState(decoder, [{ id: 'odour-danger-left', side: 'L' }, { id: 'odour-danger-right', side: 'R' }], MBON);
  const { senses } = decodeTick(state, { spikes: new Uint32Array([]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.equal(senses['odour-danger'].learnedGain, undefined);

  const noMbon = createDecoderState(decoder, [{ id: 'odour-danger-left', side: 'L' }, { id: 'odour-danger-right', side: 'R' }], null);
  const out2 = decodeTick(noMbon, { spikes: new Uint32Array([]), inputs: Float32Array.of(0.9, 0.1) }, decoder);
  assert.equal(out2.senses['odour-danger'].learnedGain, undefined);
});

// bal0 (the naive baseline) is itself the running mean of bal during the first LEARN_TAU presence ticks, so a
// shift only shows once that window has an established, different baseline to compare against: a naive phase
// where both MBON groups fire together (bal ~ 0), then a learning phase that fires only one of them.
test('learnedGain rises above 1 once approach outpaces avoid after an established naive baseline', () => {
  const decoder = parseDecoder(foodFile(), 'p', FOOD_SNAPSHOT);
  const state = createDecoderState(decoder, FOOD_CHANNELS, MBON);
  const present = Float32Array.of(0.9, 0.9);
  for (let t = 0; t < 300; t++) decodeTick(state, { spikes: new Uint32Array([10, 11]), inputs: present }, decoder);
  let last;
  for (let t = 0; t < 1000; t++) {
    last = decodeTick(state, { spikes: new Uint32Array([10]), inputs: present }, decoder).senses['odour-food-a'];
  }
  assert.ok(last.learnedGain > 1, `expected learnedGain > 1, got ${last.learnedGain}`);
  assert.ok(last.learnedGain <= 1.5);
});

test('learnedGain falls below 1 once avoid outpaces approach after an established naive baseline', () => {
  const decoder = parseDecoder(foodFile(), 'p', FOOD_SNAPSHOT);
  const state = createDecoderState(decoder, FOOD_CHANNELS, MBON);
  const present = Float32Array.of(0.9, 0.9);
  for (let t = 0; t < 300; t++) decodeTick(state, { spikes: new Uint32Array([10, 11]), inputs: present }, decoder);
  let last;
  for (let t = 0; t < 1000; t++) {
    last = decodeTick(state, { spikes: new Uint32Array([11]), inputs: present }, decoder).senses['odour-food-a'];
  }
  assert.ok(last.learnedGain < 1, `expected learnedGain < 1, got ${last.learnedGain}`);
  assert.ok(last.learnedGain >= 0.5);
});

test('learnedGain does not update while the pair is quiet (mean input < 0.05)', () => {
  const decoder = parseDecoder(foodFile(), 'p', FOOD_SNAPSHOT);
  const state = createDecoderState(decoder, FOOD_CHANNELS, MBON);
  let last;
  for (let t = 0; t < 50; t++) {
    last = decodeTick(state, { spikes: new Uint32Array([10]), inputs: Float32Array.of(0, 0) }, decoder).senses['odour-food-a'];
  }
  assert.equal(last.learnedGain, 1, 'with no presence ever recorded, bal and bal0 both stay 0');
});

test('a provided naive baseline fixes bal0 instead of the first-300-ticks fallback', () => {
  const decoder = parseDecoder(foodFile({ learning: { naive: { 'odour-food-a': 0.9 } } }), 'p', FOOD_SNAPSHOT);
  const state = createDecoderState(decoder, FOOD_CHANNELS, MBON);
  // approach fires every tick -> bal ~ 1, but naive bal0 is pinned at 0.9, close to bal: gain should stay mild.
  const out = decodeTick(state, { spikes: new Uint32Array([10]), inputs: Float32Array.of(0.9, 0.9) }, decoder);
  assert.ok(out.senses['odour-food-a'].learnedGain < 1.3, 'a naive baseline near bal should keep the gain mild');
});
