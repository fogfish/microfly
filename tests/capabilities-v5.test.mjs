// Channel declaration, version 5 (contracts/channel-declaration-v5.md): one assertion per new rule R9–R11, R7's
// six-drive vocabulary, and a regression that validateCapabilitiesV4 still enforces 5 drives and rejects escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCapabilitiesV4, validateCapabilitiesV5, FORAGER_DRIVES, FORAGER_DRIVES_V2 } from '../public/js/brain/capabilities.js';

const N = 20;

function foragerV2() {
  const inputs = [
    { id: 'odour-food-left', label: 'Odour food left', side: 'L', neurons: [0], range: [0, 1], sense: 'odour:food', site: 'antenna' },
    { id: 'odour-food-right', label: 'Odour food right', side: 'R', neurons: [1], range: [0, 1], sense: 'odour:food', site: 'antenna' },
    { id: 'taste-mouth-left', label: 'Taste mouth left', side: 'L', neurons: [2], range: [0, 1], sense: 'taste:mouth', site: 'mouth' },
  ];
  const outputs = [
    { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [10], range: [0, 1], drive: 'turnLeft' },
    { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [11], range: [0, 1], drive: 'turnRight' },
    { id: 'forward', label: 'Forward', side: 'both', neurons: [12], range: [0, 1], drive: 'forward' },
    { id: 'backward', label: 'Backward', side: 'both', neurons: [13], range: [0, 1], drive: 'backward' },
    { id: 'feed', label: 'Feed', side: 'both', neurons: [14], range: [0, 1], drive: 'feed' },
    { id: 'escape', label: 'Escape', side: 'both', neurons: [15], range: [0, 1], drive: 'escape' },
  ];
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const problem = (decl, neuronCount = N) => {
  const [message = null] = validateCapabilitiesV5(decl, neuronCount);
  return message;
};

const edited = (edit) => {
  const decl = structuredClone(foragerV2());
  edit(decl);
  return problem(decl);
};

test('one valid v2 declaration passes', () => {
  assert.deepEqual(validateCapabilitiesV5(foragerV2(), N), []);
  assert.deepEqual(FORAGER_DRIVES_V2, ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape']);
});

test('R9: sense must be one of the six declared senses', () => {
  assert.equal(edited((d) => { d.channels.inputs[0].sense = 'smell'; }),
    'snapshot channel odour-food-left is malformed: sense');
});

test('R10: site must be one of the declared body sites', () => {
  assert.equal(edited((d) => { d.channels.inputs[0].site = 'leg'; }),
    'snapshot channel odour-food-left is malformed: site');
});

test('R11: exactly one escape drive, named with the count found', () => {
  assert.equal(edited((d) => { d.channels.outputs[5].drive = 'forward'; }),
    'snapshot outputs must have exactly one of each forager drive');
  assert.equal(edited((d) => { d.channels.outputs.pop(); }),
    'snapshot outputs must have exactly one of each forager drive');
});

test('R7: six drives required, each once', () => {
  assert.equal(edited((d) => { d.channels.outputs[0].drive = 'escape'; }),
    'snapshot outputs must have exactly one of each forager drive');
});

test('R8: sense/site are not allowed on output channels', () => {
  assert.equal(edited((d) => { d.channels.outputs[0].sense = 'odour:food'; }),
    'snapshot channel turn-left has unknown field sense');
});

test('validateCapabilitiesV4 is unaffected: still rejects escape and requires exactly 5 drives', () => {
  const inputs = [{ id: 'odour-left', label: 'Odour left', side: 'L', neurons: [0], range: [0, 1] }];
  const outputs = [
    { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [1], range: [0, 1], drive: 'turnLeft' },
    { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [2], range: [0, 1], drive: 'turnRight' },
    { id: 'forward', label: 'Forward', side: 'both', neurons: [3], range: [0, 1], drive: 'forward' },
    { id: 'backward', label: 'Backward', side: 'both', neurons: [4], range: [0, 1], drive: 'backward' },
    { id: 'escape', label: 'Escape', side: 'both', neurons: [5], range: [0, 1], drive: 'escape' },
  ];
  const decl = { signals: ['spikes'], channels: { inputs, outputs } };
  const [message] = validateCapabilitiesV4(decl, N, 'forager');
  assert.equal(message, 'snapshot outputs must have exactly one of each forager drive');
  assert.deepEqual(FORAGER_DRIVES, ['turnLeft', 'turnRight', 'forward', 'backward', 'feed']);
});
