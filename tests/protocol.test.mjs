// Worker protocol v1: host encode and validate, and worker handler replies on both sides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/brain/protocol.js';
import { createWorkerCore } from '../public/js/brain/worker-core.js';

const brain = { neuronCount: 40, outDegree: 4, inhibitoryFraction: 0.2, motorSmoothing: 0.05, telemetry: [0, 1, 2] };
const initMsg = () => P.init({ flyId: 3, seed: 1234, brain });

test('host builders produce valid toWorker messages', () => {
  assert.equal(P.validateMessage(initMsg(), 'toWorker'), null);
  assert.equal(P.validateMessage(P.sense({ tick: 0, sensory: 0.5 }), 'toWorker'), null);
  assert.equal(P.validateMessage(P.stop(), 'toWorker'), null);
});

test('worker builders produce valid toHost messages', () => {
  assert.equal(P.validateMessage(P.ready({ flyId: 3, neuronCount: 40 }), 'toHost'), null);
  const m = P.motor({ tick: 0, sensory: 0, left: 0, right: 0, selected: new Uint8Array(3) });
  assert.equal(P.validateMessage(m, 'toHost'), null);
  assert.equal(P.validateMessage(P.error({ flyId: 3, message: 'x' }), 'toHost'), null);
});

test('validation rejects a missing or different version', () => {
  assert.match(P.validateMessage({ type: 'stop' }, 'toWorker'), /missing protocol version/);
  assert.match(P.validateMessage({ v: 2, type: 'stop' }, 'toWorker'), /unsupported protocol version 2/);
});

test('validation rejects a bad sense tick and sensory value', () => {
  assert.match(P.validateMessage({ v: 1, type: 'sense', tick: -1, sensory: 0 }, 'toWorker'), /sense.tick/);
  assert.match(P.validateMessage({ v: 1, type: 'sense', tick: 1.5, sensory: 0 }, 'toWorker'), /sense.tick/);
  assert.match(P.validateMessage({ v: 1, type: 'sense', tick: 0, sensory: -0.1 }, 'toWorker'), /sensory/);
  assert.match(P.validateMessage({ v: 1, type: 'sense', tick: 0, sensory: NaN }, 'toWorker'), /sensory/);
});

test('a message of the wrong direction is rejected', () => {
  assert.match(P.validateMessage(P.ready({ flyId: 1, neuronCount: 40 }), 'toWorker'), /unknown message type/);
});

test('motor transfers its selected buffer and no other message does', () => {
  const selected = new Uint8Array(3);
  const m = P.motor({ tick: 0, sensory: 0, left: 0, right: 0, selected });
  assert.deepEqual(P.transferables(m), [selected.buffer]);
  assert.deepEqual(P.transferables(P.ready({ flyId: 1, neuronCount: 40 })), []);
});

test('worker: init replies ready with the neuron count', () => {
  const core = createWorkerCore();
  const { reply } = core.handle(initMsg());
  assert.equal(reply.type, 'ready');
  assert.equal(reply.neuronCount, 40);
});

test('worker: sense at tick 0 replies motor with the same tick and transfers selected', () => {
  const core = createWorkerCore();
  core.handle(initMsg());
  const { reply, transfer } = core.handle(P.sense({ tick: 0, sensory: 0.5 }));
  assert.equal(reply.type, 'motor');
  assert.equal(reply.tick, 0);
  assert.equal(reply.selected.length, 3);
  assert.deepEqual(transfer, [reply.selected.buffer]);
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
  const { reply } = core.handle({ v: 2, type: 'init', flyId: 1, seed: 1, brain });
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /unsupported protocol version 2/);
});

test('worker: stop gives no reply', () => {
  const core = createWorkerCore();
  core.handle(initMsg());
  assert.equal(core.handle(P.stop()).reply, null);
});
