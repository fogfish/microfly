// BUG-001, FR-030, SC-010: the app's brain activity view draws the same neurons as the brain inspector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { drawnNeurons } from '../public/js/brain/layout.js';
import { drawableNeurons } from '../public/brains/js/model.js';

const FORAGER = new URL('../public/brains/forager-brain.brain', import.meta.url);

function loadForager() {
  const buf = fs.readFileSync(FORAGER);
  return parseSnapshot(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

test('the app draws exactly the neurons with a soma position in forager-brain.brain (2,361 of 3,320)', () => {
  const snapshot = loadForager();
  const neurons = snapshot.manifest.neurons.map((n) => ({ soma: n.soma ?? null }));
  const drawn = drawnNeurons(neurons);
  assert.equal(snapshot.neuronCount, 3320);
  assert.equal(drawn.length, 2361);
  assert.equal(neurons.length - drawn.length, 959);
  for (const i of drawn) assert.ok(neurons[i].soma !== null, `neuron ${i} is drawn without a soma`);
});

test('the app and the brain inspector draw the same neuron indices', () => {
  const snapshot = loadForager();
  const neurons = snapshot.manifest.neurons.map((n) => ({ soma: n.soma ?? null }));
  assert.deepEqual(drawnNeurons(neurons), drawableNeurons(snapshot));
});
