// Channel declaration, version 4 (contracts/channel-declaration-v4.md): one assertion per rule R1–R8,
// with the exact message text, and one valid forager declaration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCapabilitiesV4, FORAGER_DRIVES } from '../public/js/brain/capabilities.js';

const N = 10;

// A valid forager declaration: three input pools (odour-left, odour-right, taste-left), five output pools.
function forager() {
  const inputs = [
    { id: 'odour-left', label: 'Odour left', side: 'L', neurons: [0, 1], range: [0, 1] },
    { id: 'odour-right', label: 'Odour right', side: 'R', neurons: [2], range: [0, 1] },
    { id: 'taste-left', label: 'Taste left', side: 'L', neurons: [3], range: [0, 1] },
  ];
  const outputs = [
    { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [4], range: [0, 1], drive: 'turnLeft' },
    { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [5], range: [0, 1], drive: 'turnRight' },
    { id: 'forward', label: 'Forward', side: 'both', neurons: [6], range: [0, 1], drive: 'forward' },
    { id: 'backward', label: 'Backward', side: 'both', neurons: [7], range: [0, 1], drive: 'backward' },
    { id: 'feed', label: 'Feed', side: 'both', neurons: [8], range: [0, 1], drive: 'feed' },
  ];
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

// Returns the message the validator gives for `decl`, or null when it passes.
const problem = (decl, neuronCount = N, kind = 'forager') => {
  const [message = null] = validateCapabilitiesV4(decl, neuronCount, kind);
  return message;
};

// Mutates a copy of the valid declaration with `edit`, then returns the message.
const edited = (edit) => {
  const decl = structuredClone(forager());
  edit(decl);
  return problem(decl);
};

test('one valid forager declaration passes', () => {
  assert.deepEqual(validateCapabilitiesV4(forager(), N, 'forager'), []);
  assert.deepEqual(FORAGER_DRIVES, ['turnLeft', 'turnRight', 'forward', 'backward', 'feed']);
});

test('R1: a missing declaration is refused', () => {
  assert.equal(problem(undefined), 'snapshot capabilities are missing');
});

test('R2: signals and channel lists have the required shape', () => {
  assert.equal(edited((d) => { d.signals = ['spikes', 'spikes']; }), 'snapshot signals are malformed');
  assert.equal(edited((d) => { d.channels.inputs = 'odour'; }), 'snapshot channels are malformed');
});

test('R3: ids match the pattern and are unique across inputs and outputs', () => {
  assert.equal(edited((d) => { d.channels.inputs[0].id = 'Odour'; }), 'snapshot channel Odour has a malformed id');
  assert.equal(edited((d) => { d.channels.outputs[0].id = 'odour-left'; }), 'duplicate id odour-left');
});

test('R4: label, side, neurons and range are well formed', () => {
  assert.equal(edited((d) => { d.channels.inputs[0].label = ''; }),
    'snapshot channel odour-left is malformed: label');
  assert.equal(edited((d) => { d.channels.inputs[0].side = 'left'; }),
    'snapshot channel odour-left is malformed: side');
  assert.equal(edited((d) => { d.channels.inputs[0].neurons = []; }),
    'snapshot channel odour-left is malformed: neurons');
  assert.equal(edited((d) => { d.channels.inputs[0].neurons = [0, 0]; }),
    'snapshot channel odour-left is malformed: neurons');
  assert.equal(edited((d) => { d.channels.inputs[0].range = [1, 0]; }),
    'snapshot channel odour-left is malformed: range');
});

test('R5: every neuron index is below neuronCount', () => {
  assert.equal(edited((d) => { d.channels.outputs[4].neurons = [N]; }),
    `snapshot channel feed references neuron ${N} outside neuronCount`);
});

test('R6: no two input channels share a neuron', () => {
  assert.equal(edited((d) => { d.channels.inputs[1].neurons = [1]; }),
    'snapshot input channels odour-left and odour-right share neuron 1');
});

test('R7: a forager declares exactly one of each drive', () => {
  assert.equal(edited((d) => { d.channels.outputs[4].drive = 'forward'; }),
    'snapshot outputs must have exactly one of each forager drive');
  assert.equal(edited((d) => { d.channels.outputs.pop(); }),
    'snapshot outputs must have exactly one of each forager drive');
});

test('R8: no fields beyond the declaration (inputs take no drive)', () => {
  assert.equal(edited((d) => { d.channels.inputs[0].drive = 'forward'; }),
    'snapshot channel odour-left has unknown field drive');
  assert.equal(edited((d) => { d.channels.outputs[0].neuron = 4; }),
    'snapshot channel turn-left has unknown field neuron');
});
