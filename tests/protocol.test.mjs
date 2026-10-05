// Worker protocol v2: host encode and validate, and worker handler replies on both sides.
// The motor content rules are in protocol-v2.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/brain/protocol.js';
import { createWorkerCore } from '../public/js/brain/worker-core.js';
import { TOY_CAPABILITIES } from '../public/js/brain/capabilities.js';

const brain = { neuronCount: 40, outDegree: 4, inhibitoryFraction: 0.2, motorSmoothing: 0.05 };
const initMsg = () => P.init({ flyId: 3, seed: 1234, brain });

test('host builders produce valid toWorker messages', () => {
  assert.equal(P.validateMessage(initMsg(), 'toWorker'), null);
  assert.equal(P.validateMessage(P.sense({ tick: 0, sensory: 0.5 }), 'toWorker'), null);
  assert.equal(P.validateMessage(P.stop(), 'toWorker'), null);
});

test('worker builders produce valid toHost messages', () => {
  assert.equal(P.validateMessage(P.ready({ flyId: 3, neuronCount: 40, capabilities: TOY_CAPABILITIES }), 'toHost'), null);
  const m = P.motor({ tick: 0, sensory: 0, left: 0, right: 0, outputs: new Float32Array(2), spikes: new Uint32Array(0) });
  assert.equal(P.validateMessage(m, 'toHost'), null);
  assert.equal(P.validateMessage(P.error({ flyId: 3, message: 'x' }), 'toHost'), null);
});

test('validation rejects a missing or different version', () => {
  assert.match(P.validateMessage({ type: 'stop' }, 'toWorker'), /missing protocol version/);
  assert.match(P.validateMessage({ v: 1, type: 'stop' }, 'toWorker'), /unsupported protocol version 1; this build supports 2/);
});

test('validation rejects a bad sense tick and sensory value', () => {
  assert.match(P.validateMessage({ v: 2, type: 'sense', tick: -1, sensory: 0 }, 'toWorker'), /sense.tick/);
  assert.match(P.validateMessage({ v: 2, type: 'sense', tick: 1.5, sensory: 0 }, 'toWorker'), /sense.tick/);
  assert.match(P.validateMessage({ v: 2, type: 'sense', tick: 0, sensory: -0.1 }, 'toWorker'), /sensory/);
  assert.match(P.validateMessage({ v: 2, type: 'sense', tick: 0, sensory: NaN }, 'toWorker'), /sensory/);
});

test('a message of the wrong direction is rejected', () => {
  assert.match(P.validateMessage(P.ready({ flyId: 1, neuronCount: 40, capabilities: TOY_CAPABILITIES }), 'toWorker'), /unknown message type/);
});

test('motor transfers its outputs and spikes buffers and no other message does', () => {
  const outputs = new Float32Array(2);
  const spikes = Uint32Array.from([1, 4]);
  const m = P.motor({ tick: 0, sensory: 0, left: 0, right: 0, outputs, spikes });
  assert.deepEqual(P.transferables(m), [outputs.buffer, spikes.buffer]);
  assert.deepEqual(P.transferables(P.ready({ flyId: 1, neuronCount: 40, capabilities: TOY_CAPABILITIES })), []);
});

test('the init of a brain with telemetry is rejected', () => {
  const m = P.init({ flyId: 1, seed: 5, brain: { ...brain, telemetry: [0, 1, 2] } });
  assert.equal(P.validateMessage(m, 'toWorker'), 'init.brain.telemetry is removed in protocol 2');
});

test('worker: init replies ready with the neuron count and the declaration', () => {
  const core = createWorkerCore();
  const { reply } = core.handle(initMsg());
  assert.equal(reply.type, 'ready');
  assert.equal(reply.neuronCount, 40);
  assert.deepEqual(reply.capabilities, TOY_CAPABILITIES);
});

test('worker: sense at tick 0 replies motor with outputs and spikes, and transfers both', () => {
  const core = createWorkerCore();
  core.handle(initMsg());
  const { reply, transfer } = core.handle(P.sense({ tick: 0, sensory: 0.5 }));
  assert.equal(reply.type, 'motor');
  assert.equal(reply.tick, 0);
  assert.equal(reply.outputs.length, 2);
  assert.ok(reply.spikes instanceof Uint32Array);
  assert.deepEqual(transfer, [reply.outputs.buffer, reply.spikes.buffer]);
});

test('worker: an out-of-order tick replies error and then stays silent', () => {
  const core = createWorkerCore();
  core.handle(initMsg());
  const { reply } = core.handle(P.sense({ tick: 5, sensory: 0.5 }));
  assert.equal(reply.type, 'error');
  assert.equal(reply.message, 'sense tick 5 out of order (expected 0)');
  assert.equal(core.handle(P.sense({ tick: 0, sensory: 0.5 })).reply, null);
});

test('worker: a wrong version replies error', () => {
  const core = createWorkerCore();
  const { reply } = core.handle({ v: 1, type: 'init', flyId: 1, seed: 1, brain });
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /unsupported protocol version 1/);
});

test('worker: stop gives no reply', () => {
  const core = createWorkerCore();
  core.handle(initMsg());
  assert.equal(core.handle(P.stop()).reply, null);
});

test('init with brain.snapshot as a URL string validates', () => {
  const m = P.init({ flyId: 1, seed: 5, brain: { snapshot: 'https://example.test/x.brain' } });
  assert.equal(P.validateMessage(m, 'toWorker'), null);
});

test('init with brain.snapshot as a parsed object validates', () => {
  const snapshot = { neuronCount: 5, edgeCount: 4 };
  const m = P.init({ flyId: 1, seed: 5, brain: { snapshot } });
  assert.equal(P.validateMessage(m, 'toWorker'), null);
});

test('init with an empty or non-string snapshot is rejected', () => {
  assert.match(P.validateMessage(P.init({ flyId: 1, seed: 5, brain: { snapshot: '' } }), 'toWorker'), /init.brain.snapshot/);
  assert.match(P.validateMessage(P.init({ flyId: 1, seed: 5, brain: { snapshot: 7 } }), 'toWorker'), /init.brain.snapshot/);
});

test('a wrong protocol version is still rejected for a snapshot init', () => {
  const m = { ...P.init({ flyId: 1, seed: 5, brain: { snapshot: 'x.brain' } }), v: 1 };
  assert.match(P.validateMessage(m, 'toWorker'), /unsupported protocol version 1/);
});

test('worker: init with a resolved snapshot replies ready with its neuron count', () => {
  const snapshot = {
    neuronCount: 3,
    edgeCount: 1,
    offsets: Uint32Array.from([0, 1, 1, 1]),
    targets: Uint32Array.from([2]),
    weights: Float32Array.from([1]),
    synapses: Uint16Array.from([5]),
    capabilities: TOY_CAPABILITIES,
  };
  const core = createWorkerCore();
  const { reply } = core.handle(P.init({ flyId: 2, seed: 9, brain: { snapshot } }));
  assert.equal(reply.type, 'ready');
  assert.equal(reply.neuronCount, 3);
});
