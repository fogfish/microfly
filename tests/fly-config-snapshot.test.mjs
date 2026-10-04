// resolveFlies on a snapshot world: the toy defaults are not merged into the brain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveFlies } from '../public/js/fly/fly-config.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));

test('a snapshot brain gets no toy neuronCount', () => {
  const c = load();
  c.flies.brain = { snapshot: 'brains/smallest-functional-brain.brain' };
  const brain = resolveFlies(c).brain;
  assert.equal(brain.neuronCount, undefined);
  assert.equal(brain.outDegree, undefined);
  assert.equal(brain.inhibitoryFraction, undefined);
  assert.equal(brain.snapshot, 'brains/smallest-functional-brain.brain');
});

test('a snapshot brain keeps the shared defaults that apply in both modes', () => {
  const c = load();
  c.flies.brain = { snapshot: 'brains/smallest-functional-brain.brain' };
  const brain = resolveFlies(c).brain;
  assert.equal(brain.motorSmoothing, 0.05);
  assert.deepEqual(brain.telemetry, [0, 1, 2]);
});

test('a toy brain still merges the toy defaults', () => {
  const c = load();
  delete c.flies.brain.neuronCount;
  const brain = resolveFlies(c).brain;
  assert.equal(brain.neuronCount, 40);
  assert.equal(brain.outDegree, 4);
});
