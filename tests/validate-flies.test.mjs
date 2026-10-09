// The optional `flies` section: default config is valid, and each invalid field gives an error at its path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
const loadForager = () => JSON.parse(readFileSync(new URL('../public/world/world-forager.json', import.meta.url), 'utf8'));
const paths = (errors) => errors.map((e) => e.path);

test('the default world with flies validates with no errors', () => {
  assert.deepEqual(validateConfig(load()), []);
});

test('an absent flies section validates as before', () => {
  const c = load();
  delete c.flies;
  assert.deepEqual(validateConfig(c), []);
});

test('outDegree equal to neuronCount is rejected with the contract message', () => {
  const c = load();
  c.flies.brain.outDegree = 40;
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.outDegree']);
  assert.equal(errors[0].message, 'must be an integer from 1 to 39 (neuronCount - 1)');
});

test('apple is rejected as a stimulus: it is not an edible kind', () => {
  const c = load();
  c.flies.stimulus.objects = ['small', 'apple'];
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.stimulus.objects[1]']);
  assert.equal(errors[0].message, '"apple" is not an edible kind');
});

test('the three food kinds are accepted as stimulus kinds; flower and honey are not (spec 009 FR-018)', () => {
  const c = load();
  c.flies.stimulus.objects = ['small', 'medium', 'large'];
  assert.deepEqual(validateConfig(c), []);
  c.flies.stimulus.objects = ['flower'];
  assert.deepEqual(paths(validateConfig(c)), ['flies.stimulus.objects[0]']);
  c.flies.stimulus.objects = ['honey', 'small'];
  assert.deepEqual(paths(validateConfig(c)), ['flies.stimulus.objects[0]']);
});

test('an unknown sprite is rejected', () => {
  const c = load();
  c.flies.sprite = 'nope';
  assert.deepEqual(paths(validateConfig(c)), ['flies.sprite']);
});

test('flies.sex with the wrong length is rejected (BUG-002)', () => {
  const c = load();
  c.flies.sex = ['female', 'male'];
  assert.deepEqual(paths(validateConfig(c)), ['flies.sex']);
});

test('flies.sex with an entry that is not "female" or "male" is rejected (BUG-002)', () => {
  const c = load();
  c.flies.sex = ['female', 'male', 'female', 'male', 'female', 'nonbinary-moth'];
  assert.deepEqual(paths(validateConfig(c)), ['flies.sex[5]']);
});

test('flies.sex is rejected when it names a sex with no sprite pair (BUG-002)', () => {
  const c = load();
  delete c.sprites['fly-male'];
  const errors = validateConfig(c);
  assert.ok(errors.some((e) => e.path === 'flies.sex' && e.message.includes('fly-male')), JSON.stringify(errors));
});

test('an unknown mode is rejected', () => {
  const c = load();
  c.flies.mode = 'random';
  assert.deepEqual(paths(validateConfig(c)), ['flies.mode']);
});

test('a toy fly without a brain is rejected', () => {
  const c = load();
  delete c.flies.brain;
  assert.deepEqual(paths(validateConfig(c)), ['flies.brain']);
});

test('a baseline fly does not need a brain', () => {
  const c = load();
  c.flies.mode = 'baseline';
  delete c.flies.brain;
  assert.deepEqual(validateConfig(c), []);
});

test('the removed telemetry list is rejected, with the reason', () => {
  const c = load();
  c.flies.brain.telemetry = [0, 1, 2];
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.telemetry']);
  assert.match(errors[0].message, /was removed; the panel reads the full spike stream/);
});

test('a valid toy declaration override is accepted', () => {
  const c = load();
  c.flies.brain.capabilities = {
    signals: ['spikes'],
    channels: {
      inputs: [{ id: 'food-odour', label: 'Food odour', side: 'both', neuron: 0, range: [0, 1] }],
      outputs: [
        { id: 'left-motor', label: 'Left motor', side: 'L', neuron: 1, range: [0, 1], drive: 'left' },
        { id: 'right-motor', label: 'Right motor', side: 'R', neuron: 2, range: [0, 1], drive: 'right' },
        { id: 'wing-motor', label: 'Wing motor', side: 'L', neuron: 7, range: [0, 1] },
      ],
    },
  };
  assert.deepEqual(validateConfig(c), []);
});

test('a malformed toy declaration override is rejected at its path, with the channel named', () => {
  const c = load();
  c.flies.brain.capabilities = {
    signals: ['spikes'],
    channels: {
      inputs: [{ id: 'food-odour', label: '', side: 'both', neuron: 0, range: [0, 1] }],
      outputs: [
        { id: 'left-motor', label: 'Left motor', side: 'L', neuron: 1, range: [0, 1], drive: 'left' },
        { id: 'right-motor', label: 'Right motor', side: 'R', neuron: 2, range: [0, 1], drive: 'right' },
      ],
    },
  };
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.capabilities']);
  assert.equal(errors[0].message, 'brain channel food-odour is malformed: label');
});

test('an unknown LIF parameter is rejected', () => {
  const c = load();
  c.flies.brain.lif = { membrane: 2 };
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif']);
  assert.match(errors[0].message, /unknown LIF parameter "membrane"/);
});

test('an invalid LIF value is rejected with the parameter named', () => {
  const c = load();
  c.flies.brain.lif = { dt: 0 };
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif']);
  assert.match(errors[0].message, /"dt"/);
});

test('empty experiment seeds are rejected', () => {
  const c = load();
  c.flies.experiment.seeds = [];
  assert.deepEqual(paths(validateConfig(c)), ['flies.experiment.seeds']);
});

test('a zero maxSpeed is rejected', () => {
  const c = load();
  c.flies.body.maxSpeed = 0;
  assert.deepEqual(paths(validateConfig(c)), ['flies.body.maxSpeed']);
});

test('count above 64 is rejected', () => {
  const c = load();
  c.flies.count = 65;
  delete c.flies.sex; // unrelated to the count bound; flies.sex length is checked against count (BUG-002)
  assert.deepEqual(paths(validateConfig(c)), ['flies.count']);
});

test('tickHz of 0 is rejected', () => {
  const c = load();
  c.flies.tickHz = 0;
  assert.deepEqual(paths(validateConfig(c)), ['flies.tickHz']);
});

test('a negative stimulus gain is rejected', () => {
  const c = load();
  c.flies.stimulus.gain = -1;
  assert.deepEqual(paths(validateConfig(c)), ['flies.stimulus.gain']);
});

test('flies.brain.lif.outputScale set to a finite number >= 0 validates with no errors (version v1)', () => {
  const c = loadForager();
  c.flies.brain.lif.outputScale = 5;
  assert.deepEqual(validateConfig(c), []);
});

test('flies.brain.lif.outputScale: null (the literal JSON value) is rejected; a world file must omit the key', () => {
  const c = loadForager();
  c.flies.brain.lif.outputScale = null;
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif.outputScale']);
  assert.equal(errors[0].message, 'must be a number');
});

test('an object-valued flies.brain.lif.outputScale with valid numeric entries validates with no errors (BUG-002)', () => {
  const c = loadForager();
  c.flies.brain.lif.outputScale = { feed: 30, forward: 5 };
  assert.deepEqual(validateConfig(c), []);
});

test('a non-numeric entry in an object-valued flies.brain.lif.outputScale is rejected, naming the channel (BUG-002)', () => {
  const c = loadForager();
  c.flies.brain.lif.outputScale = { feed: 'x' };
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif.outputScale.feed']);
  assert.equal(errors[0].message, 'must be a number');
});

test('a flies.brain.lif.outputScale that is neither a number nor an object is rejected (BUG-002)', () => {
  const c = loadForager();
  c.flies.brain.lif.outputScale = 'nope';
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif.outputScale']);
  assert.equal(errors[0].message, 'must be a number');
});

test('flies.brain.lif.noiseBulkScale and inhibitoryScale validate as numbers >= 0 (version v1, ADR 005 Annex B)', () => {
  const c = loadForager();
  c.flies.brain.lif.noiseBulkScale = 0;
  c.flies.brain.lif.inhibitoryScale = 2;
  assert.deepEqual(validateConfig(c), []);
});

test('a negative flies.brain.lif.inhibitoryScale is rejected with the engine message (ADR 005 Annex B)', () => {
  const c = loadForager();
  c.flies.brain.lif.inhibitoryScale = -1;
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.brain.lif']);
  assert.equal(errors[0].message, 'LIF parameter "inhibitoryScale" must be 0 or more');
});
