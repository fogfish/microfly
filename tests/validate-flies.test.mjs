// The optional `flies` section: default config is valid, and each invalid field gives an error at its path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
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

test('honey is rejected as a stimulus because it is not in the fruit list', () => {
  const c = load();
  c.flies.stimulus.objects = ['apple', 'honey'];
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.stimulus.objects[1]']);
  assert.equal(errors[0].message, '"honey" is not an edible object rule');
});

test('an unknown sprite is rejected', () => {
  const c = load();
  c.flies.sprite = 'nope';
  assert.deepEqual(paths(validateConfig(c)), ['flies.sprite']);
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

test('duplicate telemetry indices are rejected', () => {
  const c = load();
  c.flies.brain.telemetry = [0, 0, 1];
  assert.deepEqual(paths(validateConfig(c)), ['flies.brain.telemetry']);
});

test('telemetry index at or above neuronCount is rejected', () => {
  const c = load();
  c.flies.brain.telemetry = [0, 1, 40];
  assert.deepEqual(paths(validateConfig(c)), ['flies.brain.telemetry']);
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
