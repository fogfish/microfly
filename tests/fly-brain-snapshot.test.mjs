// createFlyBrain with a parsed snapshot (contracts/integration.md §3): the container's graph,
// no motor drive overwrite, determinism, the declaration of the container.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const FIXTURE = new URL('./fixtures/synthetic-smallest.brain', import.meta.url);
function loadSnapshot() {
  const b = readFileSync(FIXTURE);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

test('the snapshot brain has the neuron count of the container', () => {
  const brain = createFlyBrain({ snapshot: loadSnapshot() }, 1);
  assert.equal(brain.neuronCount, 5);
});

test('two runs with the same sensory sequence give identical outputs', () => {
  const sequence = [0.5, 0.5, 0, 1, 1, 0.2, 0, 0.9, 1, 0];
  const run = () => {
    const brain = createFlyBrain({ snapshot: loadSnapshot() }, 7);
    return sequence.map((v) => {
      const o = brain.step(v);
      return [o.left, o.right, [...o.spikes], [...o.outputs]];
    });
  };
  assert.deepEqual(run(), run());
});

test('the sensory neuron keeps the container weights (no addMotorDrive overwrite)', () => {
  const brain = createFlyBrain({ snapshot: loadSnapshot() }, 1);
  const { offsets, weights } = brain.net;
  const fromSensory = Array.from(weights.subarray(offsets[0], offsets[1]));
  assert.deepEqual(fromSensory, [Math.fround(1.0), Math.fround(0.4)]);
});

test('the brain takes the declaration of the container', () => {
  const snap = loadSnapshot();
  const brain = createFlyBrain({ snapshot: snap }, 1);
  assert.deepEqual(brain.capabilities, snap.capabilities);
  assert.equal(brain.step(0.5).outputs.length, 2);
});

test('a snapshot that is still a URL string is refused by the brain builder', () => {
  assert.throws(() => createFlyBrain({ snapshot: 'brains/x.brain' }, 1), /must be resolved/);
});
