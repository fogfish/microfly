// Worker protocol, version 3 (contracts/worker-protocol-v3.md): builders set v: 3, the sense and motor
// checks against the declaration, and routing by message version (a protocol 2 message still goes to the v0 handler).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P3 from '../public/js/brain/protocol-v3.js';
import { createWorkerCore } from '../public/js/brain/worker-core.js';

const DECL = { inputCount: 4, outputCount: 5, neuronCount: 11 };

test('builders set v: 3 and the fields of the contract', () => {
  const s = P3.sense({ tick: 3, inputs: new Float32Array(4), state: { hunger: 0.5 } });
  assert.equal(s.v, 3);
  assert.equal(s.type, 'sense');
  assert.deepEqual(s.state, { hunger: 0.5 });
  assert.equal(P3.stop().v, 3);
  assert.equal(P3.ready({ flyId: 'f', neuronCount: 11, capabilities: {} }).v, 3);
  assert.equal(P3.error({ flyId: 'f', tick: 1, message: 'x' }).v, 3);
  const m = P3.motor({ tick: 1, inputs: new Float32Array(4), outputs: new Float32Array(5), spikes: new Uint32Array(0) });
  assert.equal(m.v, 3);
  assert.equal(m.type, 'motor');
});

test('sense.inputs length is checked against the declared inputs', () => {
  const msg = P3.sense({ tick: 0, inputs: new Float32Array(2), state: { hunger: 0.5 } });
  assert.equal(P3.validateSenseV3(msg, DECL), 'sense.inputs must have 4 entries, one per declared input');
  const ok = P3.sense({ tick: 0, inputs: new Float32Array(4), state: { hunger: 0.5 } });
  assert.equal(P3.validateSenseV3(ok, DECL), null);
});

test('sense.state.hunger is a finite number in [0, 1]', () => {
  const bad = (hunger) => P3.validateMessage(
    P3.sense({ tick: 0, inputs: new Float32Array(4), state: { hunger } }), 'toWorker',
  );
  assert.equal(bad(1.5), 'sense.state.hunger must be a finite number from 0 to 1');
  assert.equal(bad(-0.1), 'sense.state.hunger must be a finite number from 0 to 1');
  assert.equal(bad(Number.NaN), 'sense.state.hunger must be a finite number from 0 to 1');
  assert.equal(bad(0.25), null);
});

test('a motor with left or right is rejected for a forager brain', () => {
  const base = {
    v: 3, type: 'motor', tick: 0, inputs: new Float32Array(4), outputs: new Float32Array(5), spikes: new Uint32Array(0),
  };
  assert.equal(P3.validateMotorV3({ ...base, left: 0.5 }, DECL), 'motor.left is not part of protocol 3 forager messages');
  assert.equal(P3.validateMotorV3({ ...base, right: 0.5 }, DECL), 'motor.right is not part of protocol 3 forager messages');
  assert.equal(P3.validateMotorV3(base, DECL), null);
});

test('motor.outputs has one entry per declared output, and spikes are ascending and below neuronCount', () => {
  const base = { v: 3, type: 'motor', tick: 0, inputs: new Float32Array(4), outputs: new Float32Array(5) };
  assert.equal(P3.validateMotorV3({ ...base, spikes: new Uint32Array(0), outputs: new Float32Array(4) }, DECL),
    'motor.outputs must have 5 entries, one per declared output');
  assert.equal(P3.validateMotorV3({ ...base, spikes: new Uint32Array([11]) }, DECL),
    'motor.spikes 11 is not below neuronCount 11');
  assert.equal(P3.validateMotorV3({ ...base, spikes: new Uint32Array([3, 3]) }, DECL),
    'motor.spikes must be strictly ascending');
});

test('only motor carries typed arrays to transfer; inputs are copied on echo', () => {
  const outputs = new Float32Array(5);
  const spikes = new Uint32Array(1);
  const m = P3.motor({ tick: 0, inputs: new Float32Array(4), outputs, spikes });
  assert.deepEqual(P3.transferables(m), [outputs.buffer, spikes.buffer]);
  assert.deepEqual(P3.transferables(P3.stop()), []);
});

test('a protocol 2 message still goes to the v0 handler', () => {
  const core = createWorkerCore();
  const { reply } = core.handle({ v: 2, type: 'init', flyId: 'fly-a', seed: 1, brain: { neuronCount: 40, outDegree: 4 } });
  assert.equal(reply.v, 2);
  assert.equal(reply.type, 'ready');
});

test('a protocol 2 init on a version 4 snapshot is refused', () => {
  const core = createWorkerCore();
  const { reply } = core.handle({
    v: 2, type: 'init', flyId: 'fly-a', seed: 1, brain: { snapshot: { version: 4 } },
  });
  assert.equal(reply.type, 'error');
  assert.equal(reply.message, 'brain version does not match the message protocol');
});
