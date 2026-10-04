// createNetwork rejects invalid parameters with a message that names the parameter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, LIF_DEFAULTS } from '../public/js/brain/lif.js';

const graph = { neuronCount: 2, edges: [] };

test('rejects dt <= 0 and names dt', () => {
  assert.throws(() => createNetwork(graph, { dt: 0 }), /"dt"/);
  assert.throws(() => createNetwork(graph, { dt: -1 }), /"dt"/);
});

test('rejects tau <= 0 and names tau', () => {
  assert.throws(() => createNetwork(graph, { tau: 0 }), /"tau"/);
});

test('rejects refractorySteps that is not an integer of 0 or more', () => {
  assert.throws(() => createNetwork(graph, { refractorySteps: 1.5 }), /"refractorySteps"/);
  assert.throws(() => createNetwork(graph, { refractorySteps: -1 }), /"refractorySteps"/);
});

test('rejects vThreshold <= vReset and names vThreshold', () => {
  assert.throws(() => createNetwork(graph, { vThreshold: 0, vReset: 0 }), /"vThreshold"/);
});

test('rejects an unknown key and names it', () => {
  assert.throws(() => createNetwork(graph, { membrane: 1 }), /unknown LIF parameter "membrane"/);
});

test('LIF_DEFAULTS is frozen', () => {
  assert.throws(() => {
    LIF_DEFAULTS.dt = 2;
  }, TypeError);
});
