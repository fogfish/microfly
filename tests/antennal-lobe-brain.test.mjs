// The antennal-lobe brain (extract/configs/antennal-lobe-brain.json) and the world that runs it.
// It is a parallel brain: the smallest functional brain stays the manifest default and the
// connectome world's snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { validateConfig } from '../public/js/world/validate.js';

const read = (path) => readFileSync(new URL(path, import.meta.url));
const json = (path) => JSON.parse(read(path).toString('utf8'));

function loadBrain() {
  const b = read('../public/brains/antennal-lobe-brain.brain');
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

test('antennal-lobe brain has 35 neurons and 617 edges', () => {
  const snap = loadBrain();
  assert.equal(snap.neuronCount, 35);
  assert.equal(snap.edgeCount, 617);
});

test('antennal-lobe brain reads ORN_DP1m and drives the DNb05 pair', () => {
  const [sensory, left, right] = loadBrain().manifest.neurons;
  assert.equal(sensory.type, 'ORN_DP1m');
  assert.equal(sensory.class, 'olfactory');
  assert.deepEqual([left.type, left.somaSide, right.type, right.somaSide], ['DNb05', 'L', 'DNb05', 'R']);
});

test('the extract config and the brain agree on the neuron count', () => {
  const config = json('../extract/configs/antennal-lobe-brain.json');
  assert.equal(config.expectedNeuronCount, loadBrain().neuronCount);
});

test('world-antennal-lobe.json validates and names the antennal-lobe brain', () => {
  const world = json('../public/world/world-antennal-lobe.json');
  assert.deepEqual(validateConfig(world), []);
  assert.equal(world.flies.brain.snapshot, 'brains/antennal-lobe-brain.brain');
});

test('the world brain settings build a brain whose readouts both fire', () => {
  const world = json('../public/world/world-antennal-lobe.json');
  const brain = createFlyBrain({ ...world.flies.brain, snapshot: loadBrain() }, 1);
  let left = 0;
  let right = 0;
  for (let t = 0; t < 1000; t++) {
    brain.step(world.flies.stimulus.resting);
    left += brain.net.spikes[1];
    right += brain.net.spikes[2];
  }
  assert.ok(left > 0 && right > 0, `left ${left}, right ${right}`);
});

test('the smallest functional brain stays the default', () => {
  assert.equal(json('../public/brains/brains.json').default, 'smallest-functional-brain.brain');
  assert.equal(json('../public/world/world-connectome.json').flies.brain.snapshot,
    'brains/smallest-functional-brain.brain');
});
