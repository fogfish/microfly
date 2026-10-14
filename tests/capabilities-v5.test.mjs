// Channel declaration, version 5 (contracts/channel-declaration-v5.md): R9 (sense/site), R10 (the six
// forager-wide drives), R11 (unknown field), and a valid twelve-input/six-output fixture. Same messages as
// extract/malecns_brain/capabilities.py's validate_capabilities_v5 (tests/test_capabilities_v5.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCapabilitiesV5, FORAGER_WIDE_DRIVES } from '../public/js/brain/capabilities.js';

const N = 24;

// A valid twelve-input/six-output forager-wide declaration (ADR 007 D20).
function foragerWide() {
  const pair = (id, label, side, neuron, sense, site) => (
    { id, label, side, neurons: [neuron], range: [0, 1], sense, site }
  );
  const inputs = [
    pair('odour-food-left', 'Food odour left', 'L', 0, 'odour:food', 'antenna'),
    pair('odour-food-right', 'Food odour right', 'R', 1, 'odour:food', 'antenna'),
    pair('odour-danger-left', 'Danger odour left', 'L', 2, 'odour:danger', 'antenna'),
    pair('odour-danger-right', 'Danger odour right', 'R', 3, 'odour:danger', 'antenna'),
    pair('heat-left', 'Heat left', 'L', 4, 'heat', 'antenna'),
    pair('heat-right', 'Heat right', 'R', 5, 'heat', 'antenna'),
    pair('taste-mouth-left', 'Mouth taste left', 'L', 6, 'taste', 'mouth'),
    pair('taste-mouth-right', 'Mouth taste right', 'R', 7, 'taste', 'mouth'),
    pair('taste-leg-left', 'Leg taste left', 'L', 8, 'taste', 'front-leg'),
    pair('taste-leg-right', 'Leg taste right', 'R', 9, 'taste', 'front-leg'),
    pair('touch-left', 'Touch left', 'L', 10, 'touch', 'front-leg'),
    pair('touch-right', 'Touch right', 'R', 11, 'touch', 'front-leg'),
  ];
  const outputs = [
    { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [12], range: [0, 1], drive: 'turnLeft' },
    { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [13], range: [0, 1], drive: 'turnRight' },
    { id: 'forward', label: 'Forward', side: 'both', neurons: [14], range: [0, 1], drive: 'forward' },
    { id: 'backward', label: 'Backward', side: 'both', neurons: [15], range: [0, 1], drive: 'backward' },
    { id: 'feed', label: 'Feed', side: 'both', neurons: [16], range: [0, 1], drive: 'feed' },
    { id: 'escape', label: 'Escape', side: 'both', neurons: [17], range: [0, 1], drive: 'escape' },
  ];
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const problem = (decl, neuronCount = N) => {
  const [message = null] = validateCapabilitiesV5(decl, neuronCount);
  return message;
};

const edited = (edit) => {
  const decl = structuredClone(foragerWide());
  edit(decl);
  return problem(decl);
};

test('one valid twelve-input/six-output forager-wide declaration passes', () => {
  assert.deepEqual(validateCapabilitiesV5(foragerWide(), N), []);
  assert.deepEqual(FORAGER_WIDE_DRIVES, ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape']);
});

test('R9: a missing sense is refused', () => {
  assert.equal(edited((d) => { delete d.channels.inputs[0].sense; }),
    'snapshot channel odour-food-left is malformed: sense');
  assert.equal(edited((d) => { d.channels.inputs[0].sense = ''; }),
    'snapshot channel odour-food-left is malformed: sense');
});

test('R9: a missing site is refused', () => {
  assert.equal(edited((d) => { delete d.channels.inputs[0].site; }),
    'snapshot channel odour-food-left is malformed: site');
});

test('R10: wrong, missing or duplicate drive is refused', () => {
  assert.equal(edited((d) => { d.channels.outputs[5].drive = 'feed'; }),
    'snapshot outputs must have exactly one of each forager-wide drive');
  assert.equal(edited((d) => { d.channels.outputs.pop(); }),
    'snapshot outputs must have exactly one of each forager-wide drive');
});

test('R11: an unknown field is refused', () => {
  assert.equal(edited((d) => { d.channels.outputs[0].sense = 'odour:food'; }),
    'snapshot channel turn-left has unknown field sense');
  assert.equal(edited((d) => { d.channels.inputs[0].neuron = 0; }),
    'snapshot channel odour-food-left has unknown field neuron');
});
