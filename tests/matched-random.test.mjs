// Size-matched random control (research R9): same neuron count and mean out-degree as the snapshot,
// random wiring, and a toy brain that passes validateConfig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchedRandomBrain } from '../public/js/brain/snapshot.js';
import { validateConfig } from '../public/js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));

test('neuron count is the snapshot neuron count', () => {
  const brain = matchedRandomBrain({ neuronCount: 11, edgeCount: 78 });
  assert.equal(brain.neuronCount, 11);
});

test('out-degree is the rounded mean out-degree', () => {
  // 78 edges over 11 neurons is 7.09 per neuron.
  assert.equal(matchedRandomBrain({ neuronCount: 11, edgeCount: 78 }).outDegree, 7);
});

test('out-degree is at least 1 for a sparse snapshot', () => {
  // 2 edges over 3 neurons is 0.67, rounded to 1.
  assert.equal(matchedRandomBrain({ neuronCount: 3, edgeCount: 2 }).outDegree, 1);
});

test('out-degree stays below the neuron count', () => {
  // 40 edges over 3 neurons would be 13 per neuron; the random graph needs outDegree < neuronCount.
  assert.equal(matchedRandomBrain({ neuronCount: 3, edgeCount: 40 }).outDegree, 2);
});

test('the result is a valid toy brain in the default world', () => {
  const c = load();
  c.flies.brain = matchedRandomBrain({ neuronCount: 5, edgeCount: 4 }, c.flies.brain);
  assert.deepEqual(validateConfig(c), []);
});

test('shared settings come from the base brain and no snapshot setting is carried over', () => {
  const base = { snapshot: 'brains/x.brain', motorSmoothing: 0.07, telemetry: [0, 1, 2], lif: { synapticScale: 0.5 } };
  const brain = matchedRandomBrain({ neuronCount: 5, edgeCount: 4 }, base);
  assert.equal(brain.snapshot, undefined);
  assert.equal(brain.motorSmoothing, 0.07);
  assert.deepEqual(brain.lif, { synapticScale: 0.5 });
});
