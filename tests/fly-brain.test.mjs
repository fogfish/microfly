// Two-channel toy brain: same seed gives the same motors, rates stay in [0, 1], drive moves LEFT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';

const cfg = { neuronCount: 40, outDegree: 4, inhibitoryFraction: 0.2, motorSmoothing: 0.05, telemetry: [0, 1, 2] };
const drive = (brain, value, ticks) => {
  const out = [];
  for (let t = 0; t < ticks; t++) out.push(brain.step(value));
  return out;
};

test('same seed and sensory sequence give the same motor sequence', () => {
  const a = drive(createFlyBrain(cfg, 99), 0.3, 200);
  const b = drive(createFlyBrain(cfg, 99), 0.3, 200);
  assert.deepEqual(a.map((o) => [o.left, o.right]), b.map((o) => [o.left, o.right]));
  assert.deepEqual(a.map((o) => [...o.selected]), b.map((o) => [...o.selected]));
});

test('motor rates stay in [0, 1]', () => {
  for (const o of drive(createFlyBrain(cfg, 5), 1.0, 500)) {
    assert.ok(o.left >= 0 && o.left <= 1, `left ${o.left}`);
    assert.ok(o.right >= 0 && o.right <= 1, `right ${o.right}`);
  }
});

test('sustained sensory drive raises the LEFT rate above a silent run', () => {
  // The default synapticScale of 0.2 keeps the random network silent (see the feature notes).
  // synapticScale 1 lets activity reach the motors, so this test uses it.
  const lif = { synapticScale: 1 };
  let silentTotal = 0;
  let drivenTotal = 0;
  for (let seed = 1; seed <= 10; seed++) {
    silentTotal += drive(createFlyBrain({ ...cfg, lif }, seed), 0, 200).at(-1).left;
    drivenTotal += drive(createFlyBrain({ ...cfg, lif }, seed), 0.2, 200).at(-1).left;
  }
  assert.equal(silentTotal, 0);
  assert.ok(drivenTotal > silentTotal, `driven ${drivenTotal} should exceed silent ${silentTotal}`);
});

test('selected has one entry per telemetry neuron', () => {
  const brain = createFlyBrain({ ...cfg, telemetry: [0, 5, 9] }, 3);
  assert.equal(brain.step(0.5).selected.length, 3);
});
