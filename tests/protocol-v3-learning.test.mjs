// Worker protocol 3, learning additions (contracts/worker-protocol-v3-learning.md, ADR 011): init.brain.learning,
// motor.learning, and the worker's E-LEARN-MISSING guard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P3 from '../public/js/brain/protocol-v3.js';
import { createWorkerCore } from '../public/js/brain/worker-core.js';

const DECL = { inputCount: 0, outputCount: 1, neuronCount: 6 };

test('validateMotorV3 accepts a Float32Array(4) learning field and rejects anything else', () => {
  const base = {
    v: 3, type: 'motor', tick: 0, inputs: new Float32Array(0), outputs: new Float32Array(1), spikes: new Uint32Array(0),
  };
  assert.equal(P3.validateMotorV3({ ...base, learning: new Float32Array(4) }, DECL), null);
  assert.equal(P3.validateMotorV3(base, DECL), null);
  assert.equal(
    P3.validateMotorV3({ ...base, learning: new Float32Array(3) }, DECL),
    'motor.learning must be a Float32Array of 4 entries',
  );
  assert.equal(
    P3.validateMotorV3({ ...base, learning: [0, 0, 0, 0] }, DECL),
    'motor.learning must be a Float32Array of 4 entries',
  );
});

test('motor() omits learning when absent, and transferables lists its buffer when present', () => {
  const plain = P3.motor({ tick: 0, inputs: new Float32Array(0), outputs: new Float32Array(1), spikes: new Uint32Array(0) });
  assert.equal('learning' in plain, false);
  const learning = new Float32Array([0.1, 0.2, 0.9, 0.8]);
  const withLearning = P3.motor({
    tick: 0, inputs: new Float32Array(0), outputs: new Float32Array(1), spikes: new Uint32Array(0), learning,
  });
  assert.deepEqual([...withLearning.learning], [...learning]);
  assert.deepEqual(P3.transferables(withLearning), [withLearning.outputs.buffer, withLearning.spikes.buffer, learning.buffer]);
});

// A minimal version-4 snapshot with a KC, a reward DAN (PAM), a punish DAN (PPL1), an avoid MBON (MBON01) and an
// approach MBON (MBON11), wired KC->avoid and KC->approach, plus one output neuron so the brain still declares a
// drive (fly-brain-v1.js needs at least one output channel).
function learningSnapshot() {
  const entry = (index, cls, type) => ({ index, class: cls, type, bodyId: index });
  return {
    version: 4, kind: 'forager', neuronCount: 6, edgeCount: 2,
    offsets: new Uint32Array([0, 2, 2, 2, 2, 2, 2]),
    targets: new Uint32Array([1, 2]),
    weights: new Float32Array([0.5, 0.5]),
    synapses: new Uint16Array([1, 1]),
    manifest: {
      neurons: [
        entry(0, 'Kenyon_Cell', 'KCg-m'),
        entry(1, 'MBON', 'MBON01'),
        entry(2, 'MBON', 'MBON11'),
        entry(3, 'DAN', 'PAM01'),
        entry(4, 'DAN', 'PPL101'),
        entry(5, null, 'forward-output'),
      ],
    },
    capabilities: {
      signals: ['spikes'],
      channels: {
        inputs: [],
        outputs: [{ id: 'forward', label: 'Forward', side: 'both', neurons: [5], range: [0, 1], drive: 'forward' }],
      },
    },
  };
}

const LEARNING_SIDECAR = {
  groups: {
    kc: { class: 'Kenyon_Cell' },
    reward: { class: 'DAN', typePrefixes: ['PAM'] },
    punish: { class: 'DAN', typePrefixes: ['PPL1'] },
  },
  mbon: [
    { type: 'MBON01', role: 'avoid', cite: 'Owald et al. 2015' },
    { type: 'MBON11', role: 'approach', cite: 'Aso et al. 2014' },
  ],
};

function sense(core, tick = 0) {
  return core.handle({ v: 3, type: 'sense', tick, inputs: new Float32Array(0), state: { hunger: 1 } });
}

test('worker: an init with plasticity and no learning gives an error', () => {
  const core = createWorkerCore();
  const { reply } = core.handle({
    v: 3, type: 'init', flyId: 'fly-a', seed: 1,
    brain: { version: 'v1', snapshot: learningSnapshot(), lif: { plasticity: {} } },
  });
  assert.equal(reply.type, 'error');
  assert.equal(reply.message, 'E-LEARN-MISSING: plasticity needs flies.brain.learning');
});

test('worker: sense with plasticity on returns motor.learning of length 4', () => {
  const core = createWorkerCore();
  const init = core.handle({
    v: 3, type: 'init', flyId: 'fly-a', seed: 1,
    brain: { version: 'v1', snapshot: learningSnapshot(), lif: { plasticity: {} }, learning: LEARNING_SIDECAR },
  });
  assert.equal(init.reply.type, 'ready');
  const { reply } = sense(core);
  assert.equal(reply.type, 'motor');
  assert.ok(reply.learning instanceof Float32Array);
  assert.equal(reply.learning.length, 4);
});

test('worker: sense with plasticity off has no motor.learning key', () => {
  const core = createWorkerCore();
  const init = core.handle({
    v: 3, type: 'init', flyId: 'fly-a', seed: 1,
    brain: { version: 'v1', snapshot: learningSnapshot() },
  });
  assert.equal(init.reply.type, 'ready');
  const { reply } = sense(core);
  assert.equal(reply.type, 'motor');
  assert.equal('learning' in reply, false);
});

test('worker: a learning.js reader error (a group resolving to no neuron) propagates as an error reply naming the code', () => {
  const core = createWorkerCore();
  const emptySidecar = { ...LEARNING_SIDECAR, mbon: [] }; // no role entries -> approach/avoid resolve empty
  const { reply } = core.handle({
    v: 3, type: 'init', flyId: 'fly-a', seed: 1,
    brain: { version: 'v1', snapshot: learningSnapshot(), learning: emptySidecar },
  });
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /^E-LEARN-GROUP-EMPTY:/);
});
