// Declaration rules 11–18 (contracts/snapshot-format-v3.md). The messages are the ones the Python
// reader gives for the same declarations (extract/tests/test_capabilities.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_CAPABILITIES, TOY_CAPABILITIES, validateCapabilities } from '../public/js/brain/capabilities.js';

const decl = (mutate) => {
  const d = structuredClone(TOY_CAPABILITIES);
  mutate(d);
  return d;
};
const inputs = (d) => d.channels.inputs;
const outputs = (d) => d.channels.outputs;
const first = (d, n = 11) => validateCapabilities(d, n);

test('the toy and baseline declarations are valid', () => {
  assert.deepEqual(first(TOY_CAPABILITIES), []);
  assert.deepEqual(validateCapabilities(BASELINE_CAPABILITIES, 40), []);
});

test('rule 11: a missing declaration', () => {
  assert.deepEqual(first(undefined), ['snapshot capabilities are missing']);
});

test('rule 12: signals must be unique strings', () => {
  assert.deepEqual(first(decl((d) => { d.signals = 'spikes'; })), ['snapshot signals are malformed']);
  assert.deepEqual(first(decl((d) => { d.signals = ['spikes', 'spikes']; })), ['snapshot signals are malformed']);
});

test('rule 13: a malformed or duplicate id', () => {
  assert.deepEqual(first(decl((d) => { inputs(d)[0].id = 'Food'; })), ['snapshot channel Food has a malformed id']);
  assert.deepEqual(first(decl((d) => { outputs(d)[0].id = 'food-odour'; })), ['duplicate id food-odour']);
});

test('rule 14: label, side, neuron and range', () => {
  assert.deepEqual(first(decl((d) => { outputs(d)[0].label = ''; })), ['snapshot channel left-motor is malformed: label']);
  assert.deepEqual(first(decl((d) => { outputs(d)[0].label = 'x'.repeat(41); })), ['snapshot channel left-motor is malformed: label']);
  assert.deepEqual(first(decl((d) => { outputs(d)[0].side = 'X'; })), ['snapshot channel left-motor is malformed: side']);
  assert.deepEqual(first(decl((d) => { outputs(d)[0].range = [1, 1]; })), ['snapshot channel left-motor is malformed: range']);
  assert.deepEqual(first(decl((d) => { outputs(d)[0].range = [0, Infinity]; })), ['snapshot channel left-motor is malformed: range']);
});

test('rule 14: a missing range defaults to [0, 1]', () => {
  assert.deepEqual(first(decl((d) => { delete outputs(d)[0].range; })), []);
});

test('rule 15: an input must read neuron 0', () => {
  assert.deepEqual(first(decl((d) => { inputs(d)[0].neuron = 1; })), ['snapshot input channel food-odour must read neuron 0']);
});

test('rule 16: an output must read a neuron below neuronCount', () => {
  assert.deepEqual(first(decl((d) => { outputs(d)[0].neuron = 11; })),
    ['snapshot output channel left-motor references neuron 11 outside neuronCount']);
});

test('rule 17: exactly one left and one right drive', () => {
  assert.deepEqual(first(decl((d) => { outputs(d)[1].drive = 'left'; })),
    ['snapshot outputs must have exactly one left and one right drive']);
  assert.deepEqual(first(decl((d) => { for (const ch of outputs(d)) delete ch.drive; })),
    ['snapshot outputs must have exactly one left and one right drive']);
});

test('rule 18: no fields beyond the declaration, and no drive on an input', () => {
  assert.deepEqual(first(decl((d) => { outputs(d)[0].gain = 2; })), ['snapshot channel left-motor has unknown field gain']);
  assert.deepEqual(first(decl((d) => { inputs(d)[0].drive = 'left'; })), ['snapshot channel food-odour has unknown field drive']);
});

test('the first error in rule order is the one reported, and the subject names the source', () => {
  const two = decl((d) => { outputs(d)[0].neuron = 99; inputs(d)[0].label = ''; });
  assert.deepEqual(first(two), ['snapshot channel food-odour is malformed: label']);
  assert.deepEqual(validateCapabilities(decl((d) => { outputs(d)[0].side = 'X'; }), 11, 'brain'),
    ['brain channel left-motor is malformed: side']);
});

test('each malformed declaration of the channel-declaration contract names the channel and the field', () => {
  const cases = [
    [(d) => { inputs(d)[0].label = ''; }, 'food-odour', 'label'],
    [(d) => { outputs(d)[0].side = 'X'; }, 'left-motor', 'side'],
    [(d) => { inputs(d)[0].neuron = 1; }, 'food-odour', 'must read neuron 0'],
    [(d) => { outputs(d)[1].id = 'left-motor'; }, 'left-motor', 'duplicate id'],
    [(d) => { outputs(d)[1].drive = 'left'; }, null, 'exactly one left and one right drive'],
    [(d) => { for (const ch of outputs(d)) delete ch.drive; }, null, 'exactly one left and one right drive'],
  ];
  for (const [mutate, id, field] of cases) {
    const [message] = first(decl(mutate));
    assert.ok(message, `expected an error for ${field}`);
    if (id) assert.ok(message.includes(id), message);
    assert.ok(message.includes(field), message);
  }
});
