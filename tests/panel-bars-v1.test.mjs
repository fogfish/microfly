// The 0–100% bars of the Action section (FR-031, SC-013): barWidth maps a value in [0, 1] to a CSS percentage and
// clamps values outside it, and the energy and hunger bars come from the last history entry of a forager fly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barWidth, buildStatusModel } from '../public/js/ui/panel/model.js';

test('barWidth maps 0 to 0%, 1 to 100% and a value between to its percentage', () => {
  assert.equal(barWidth(0), '0%');
  assert.equal(barWidth(1), '100%');
  assert.equal(barWidth(0.42), '42%');
  assert.equal(barWidth(0.999), '100%');
});

test('barWidth clamps values outside [0, 1]', () => {
  assert.equal(barWidth(-0.2), '0%');
  assert.equal(barWidth(1.7), '100%');
});

test('the bars match the energy and hunger of the last entry on every tick', () => {
  const capabilities = { channels: { inputs: [], outputs: [] } };
  const entry = (energy) => ({
    tick: 0, inputs: new Float32Array(0), outputs: new Float32Array(0), spikes: new Uint32Array(0),
    energy, hunger: 1 - energy, eating: false, drives: {},
  });
  const record = { state: { id: 1 }, brainLabel: 'v1', capabilities, neuronCount: 0, activity: null, positions: null, history: [] };
  for (const energy of [0.3, 0.1, 0.9]) {
    record.history = [entry(energy)];
    const model = buildStatusModel(record, 0);
    assert.equal(barWidth(model.energy), barWidth(energy));
    assert.equal(barWidth(model.hunger), barWidth(1 - energy));
  }
});
