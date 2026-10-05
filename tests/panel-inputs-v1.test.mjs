// The panel model for forager flies (ADR 003 W5; channel-declaration-v4.md "Panel and body use"): each input row shows
// its own value from the last history entry when the entry has inputs, and the v0 sensory value otherwise. The energy and
// hunger rows come from the last entry too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusModel } from '../public/js/ui/panel/model.js';

const CAPABILITIES = {
  channels: {
    inputs: [
      { id: 'odour-left', label: 'Odour left', side: 'L', range: [0, 1] },
      { id: 'odour-right', label: 'Odour right', side: 'R', range: [0, 1] },
      { id: 'taste-left', label: 'Taste left', side: 'L', range: [0, 1] },
      { id: 'taste-right', label: 'Taste right', side: 'R', range: [0, 1] },
    ],
    outputs: [
      { id: 'turn-left', label: 'Turn left', side: 'L', range: [0, 1], drive: 'turnLeft' },
      { id: 'turn-right', label: 'Turn right', side: 'R', range: [0, 1], drive: 'turnRight' },
      { id: 'forward', label: 'Forward', side: 'both', range: [0, 1], drive: 'forward' },
      { id: 'backward', label: 'Backward', side: 'both', range: [0, 1], drive: 'backward' },
      { id: 'feed', label: 'Feed', side: 'both', range: [0, 1], drive: 'feed' },
    ],
  },
};

function record(entry) {
  return {
    state: { id: 3 },
    brainLabel: 'v1 forager brain',
    capabilities: CAPABILITIES,
    neuronCount: 0,
    activity: null,
    positions: null,
    history: entry ? [entry] : [],
  };
}

test('each input row shows its own value from the last entry when the entry has inputs', () => {
  const entry = {
    tick: 4, sensory: 0.9, inputs: Float32Array.of(0.1, 0.2, 0.3, 0.4), outputs: new Float32Array(5),
    spikes: new Uint32Array(0), energy: 0.3, hunger: 0.7, eating: false, drives: {},
  };
  const model = buildStatusModel(record(entry), 0);
  assert.deepEqual(model.inputs.map((row) => row.value), [0.1, 0.2, 0.3, 0.4].map(Math.fround));
  assert.deepEqual(model.inputs.map((row) => row.channel.id), ['odour-left', 'odour-right', 'taste-left', 'taste-right']);
});

test('without inputs, every input row shows the v0 sensory value', () => {
  const model = buildStatusModel(record({ tick: 1, sensory: 0.5, left: 0.2, right: 0.1, outputs: Float32Array.of(0.2, 0.1), spikes: new Uint32Array(0) }), 0);
  assert.deepEqual(model.inputs.map((row) => row.value), [0.5, 0.5, 0.5, 0.5]);
});

test('the energy and hunger rows come from the last entry of a forager fly', () => {
  const model = buildStatusModel(record({
    tick: 2, inputs: Float32Array.of(0, 0, 0, 0), outputs: new Float32Array(5), spikes: new Uint32Array(0),
    energy: 0.42, hunger: 0.58, eating: true, drives: {},
  }), 0);
  assert.equal(model.energy, 0.42);
  assert.equal(model.hunger, 0.58);
  assert.equal(model.eating, true);
});
