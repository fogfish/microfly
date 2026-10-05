// Protocol v2 contract (specs/006-fly-status-panel/contracts/worker-protocol-v2.md): the motor rules
// the host applies to each message, and the init rule that rejects the removed telemetry key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/brain/protocol.js';

// A toy-shaped declaration: 40 neurons, two outputs, left drives output 0, right drives output 1.
const DECL = { neuronCount: 40, outputCount: 2, leftIndex: 0, rightIndex: 1 };

const motor = (overrides = {}) => ({
  v: 2,
  type: 'motor',
  tick: 0,
  sensory: 0.5,
  left: 0.25,
  right: 0.75,
  outputs: Float32Array.from([0.25, 0.75]),
  spikes: Uint32Array.from([1, 7, 39]),
  ...overrides,
});

test('a well-formed motor message passes every content rule', () => {
  assert.equal(P.validateMotor(motor(), DECL), null);
  assert.equal(P.validateMessage(motor(), 'toHost'), null);
});

test('a motor with no spikes is valid', () => {
  assert.equal(P.validateMotor(motor({ spikes: new Uint32Array(0) }), DECL), null);
});

test('outputs with the wrong length is rejected', () => {
  const bad = motor({ outputs: Float32Array.from([0.25]) });
  assert.match(P.validateMotor(bad, DECL), /motor.outputs must have 2 entries/);
  const more = motor({ outputs: Float32Array.from([0.25, 0.75, 0.5]) });
  assert.match(P.validateMotor(more, DECL), /motor.outputs must have 2 entries/);
});

test('outputs that are not a Float32Array are rejected by the shape check', () => {
  assert.equal(P.validateMessage(motor({ outputs: [0.25, 0.75] }), 'toHost'), 'motor.outputs must be a Float32Array');
});

test('spikes that are not a Uint32Array are rejected by the shape check', () => {
  assert.equal(P.validateMessage(motor({ spikes: [1, 2] }), 'toHost'), 'motor.spikes must be a Uint32Array');
});

test('a spike index at or above neuronCount is rejected', () => {
  const bad = motor({ spikes: Uint32Array.from([1, 40]) });
  assert.match(P.validateMotor(bad, DECL), /motor.spikes 40 is not below neuronCount 40/);
});

test('spikes out of ascending order, or repeated, are rejected', () => {
  assert.match(P.validateMotor(motor({ spikes: Uint32Array.from([7, 1]) }), DECL), /strictly ascending/);
  assert.match(P.validateMotor(motor({ spikes: Uint32Array.from([3, 3]) }), DECL), /strictly ascending/);
});

test('left that disagrees with the outputs entry of the left drive is rejected', () => {
  const bad = motor({ left: 0.5 });
  assert.match(P.validateMotor(bad, DECL), /motor.left does not match/);
});

test('right that disagrees with the outputs entry of the right drive is rejected', () => {
  const bad = motor({ right: 0.1 });
  assert.match(P.validateMotor(bad, DECL), /motor.right does not match/);
});

test('left and right are compared after rounding to float32, so an exact double still matches', () => {
  const left = 0.1234567890123;
  const right = 0.9876543210987;
  const ok = motor({ left, right, outputs: Float32Array.from([left, right]) });
  assert.equal(P.validateMotor(ok, DECL), null);
});

test('the drive positions follow the declaration, not the order of the outputs', () => {
  const swapped = { ...DECL, leftIndex: 1, rightIndex: 0 };
  const m = motor({ left: 0.75, right: 0.25 });
  assert.equal(P.validateMotor(m, swapped), null);
  assert.match(P.validateMotor(m, DECL), /motor.left does not match/);
});

test('a display-only extra output does not change the drive checks', () => {
  const extra = { ...DECL, outputCount: 3 };
  const m = motor({ outputs: Float32Array.from([0.25, 0.75, 0.4]) });
  assert.equal(P.validateMotor(m, extra), null);
});

test('transferables are the outputs and spikes buffers, in that order', () => {
  const m = motor();
  assert.deepEqual(P.transferables(m), [m.outputs.buffer, m.spikes.buffer]);
});

test('init with a telemetry key is rejected, and the message names the removal', () => {
  const m = P.init({ flyId: 1, seed: 5, brain: { neuronCount: 40, telemetry: [0] } });
  assert.equal(P.validateMessage(m, 'toWorker'), 'init.brain.telemetry is removed in protocol 2');
});

test('init without telemetry is accepted', () => {
  const m = P.init({ flyId: 1, seed: 5, brain: { neuronCount: 40 } });
  assert.equal(P.validateMessage(m, 'toWorker'), null);
});
