// Neuron positions (research R6): soma layout keeps proportions, the seeded fallback is stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neuronPositions } from '../public/js/brain/layout.js';

const somas = (list) => list.map((soma) => ({ soma }));

test('soma positions are centred and scaled uniformly, the largest extent mapping to 2', () => {
  const pos = neuronPositions(somas([[0, 0, 0], [10, 0, 0], [0, 4, 0]]), 1);
  assert.deepEqual([...pos.slice(0, 3)].map((v) => Math.round(v * 1e6) / 1e6), [-1, -0.4, 0]);
  assert.deepEqual([...pos.slice(3, 6)].map((v) => Math.round(v * 1e6) / 1e6), [1, -0.4, 0]);
});

test('the uniform scale keeps the aspect ratio of the soma box', () => {
  const pos = neuronPositions(somas([[0, 0, 0], [10, 0, 0], [0, 4, 0]]), 1);
  const xExtent = pos[3] - pos[0];
  const yExtent = pos[7] - pos[1];
  assert.ok(Math.abs(yExtent / xExtent - 0.4) < 1e-6);
});

test('the same seed gives the same layout, and another seed a different one', () => {
  const neurons = [{ soma: null }, { soma: null }, { soma: null }];
  const a = neuronPositions(neurons, 42);
  const b = neuronPositions(neurons, 42);
  const c = neuronPositions(neurons, 43);
  assert.deepEqual([...a], [...b]);
  assert.notDeepEqual([...a], [...c]);
});

test('the output has three values per neuron', () => {
  assert.equal(neuronPositions(somas([[1, 2, 3], null].map((s) => s)), 1).length, 6);
  assert.equal(neuronPositions(Array.from({ length: 40 }, () => ({ soma: null })), 9).length, 120);
});

test('neurons without a soma lie on the unit sphere', () => {
  const pos = neuronPositions(Array.from({ length: 50 }, () => ({ soma: null })), 5);
  for (let i = 0; i < 50; i++) {
    const r = Math.hypot(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
    assert.ok(Math.abs(r - 1) < 1e-5, `neuron ${i} radius ${r}`);
  }
});
