// The FlyStatusModel built from a fly record (data-model.md, FlyStatusModel; panel-sections.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusModel } from '../public/js/ui/panel/model.js';
import { actionLabel } from '../public/js/fly/action.js';
import { createActivity } from '../public/js/brain/activity.js';
import { TOY_CAPABILITIES } from '../public/js/brain/capabilities.js';

const record = (overrides = {}) => ({
  state: { id: 3, body: { contacts: 0 } },
  status: 'running',
  brainLabel: 'toy (synthetic test fixture)',
  neuronCount: 40,
  capabilities: TOY_CAPABILITIES,
  activity: createActivity(40),
  positions: new Float32Array(120),
  history: [],
  ...overrides,
});

const tick = (overrides = {}) => ({
  tick: 0,
  sensory: 0.4,
  left: 0.9,
  right: 0.2,
  outputs: Float32Array.from([0.9, 0.2]),
  spikes: Uint32Array.from([1, 9]),
  ...overrides,
});

test('action is null before the first tick, and matches actionLabel after one', () => {
  assert.equal(buildStatusModel(record(), 0).action, null);
  const model = buildStatusModel(record({ history: [tick()] }), 0);
  assert.equal(model.action, actionLabel(0.9, 0.2));
  assert.equal(model.action, 'Turn right');
});

test('flyId and brainLabel come from the record', () => {
  const model = buildStatusModel(record(), 0);
  assert.equal(model.flyId, 3);
  assert.equal(model.brainLabel, 'toy (synthetic test fixture)');
});

test('inputs are the declared input channels with the sensory value of the last tick', () => {
  assert.deepEqual(buildStatusModel(record(), 0).inputs.map((r) => r.value), [0]);
  const model = buildStatusModel(record({ history: [tick({ sensory: 0.7 })] }), 0);
  assert.equal(model.inputs.length, 1);
  assert.equal(model.inputs[0].channel.id, 'food-odour');
  assert.equal(model.inputs[0].value, 0.7);
});

test('outputs follow the declaration index, and the left drive equals the last left value', () => {
  const model = buildStatusModel(record({ history: [tick({ left: 0.3125, right: 0.6, outputs: Float32Array.from([0.3125, 0.6]) })] }), 0);
  assert.deepEqual(model.outputs.map((r) => r.channel.id), ['left-motor', 'right-motor']);
  const leftDrive = model.outputs.find((r) => r.channel.drive === 'left');
  assert.equal(leftDrive.value, Math.fround(0.3125));
  assert.equal(leftDrive.value, Math.fround(0.3125));
  assert.equal(model.outputs[1].value, Math.fround(0.6));
});

test('a display-only extra output adds one row and leaves the drive rows unchanged', () => {
  const extra = structuredClone(TOY_CAPABILITIES);
  extra.channels.outputs.push({ id: 'wing-motor', label: 'Wing motor', side: 'L', neuron: 7, range: [0, 1] });
  const model = buildStatusModel(record({
    capabilities: extra,
    history: [tick({ outputs: Float32Array.from([0.9, 0.2, 0.5]) })],
  }), 0);
  assert.equal(model.outputs.length, 3);
  assert.equal(model.outputs[2].channel.id, 'wing-motor');
  assert.equal(model.outputs[2].value, Math.fround(0.5));
  assert.deepEqual(model.outputs.slice(0, 2).map((r) => r.value), [Math.fround(0.9), Math.fround(0.2)]);
});

test('activeCount counts the neurons that spiked in the window', () => {
  const history = [tick({ spikes: Uint32Array.from([1, 9]) }), tick({ spikes: Uint32Array.from([9]) })];
  assert.equal(buildStatusModel(record({ history }), 0).activeCount, 2);
});

test('a baseline record has no activity, no brightness and no positions', () => {
  const model = buildStatusModel(record({ activity: null, positions: null, neuronCount: 0 }), 0);
  assert.equal(model.brightness, null);
  assert.equal(model.coveredCount, 0);
  assert.equal(model.activeCount, 0);
});
