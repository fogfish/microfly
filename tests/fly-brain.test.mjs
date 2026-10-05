// Two-channel toy brain: same seed gives the same motors, rates stay in [0, 1], drive moves LEFT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { TOY_CAPABILITIES } from '../public/js/brain/capabilities.js';

const cfg = { neuronCount: 40, outDegree: 4, inhibitoryFraction: 0.2, motorSmoothing: 0.05 };
const drive = (brain, value, ticks) => {
  const out = [];
  for (let t = 0; t < ticks; t++) out.push(brain.step(value));
  return out;
};

test('same seed and sensory sequence give the same motor sequence', () => {
  const a = drive(createFlyBrain(cfg, 99), 0.3, 200);
  const b = drive(createFlyBrain(cfg, 99), 0.3, 200);
  assert.deepEqual(a.map((o) => [o.left, o.right]), b.map((o) => [o.left, o.right]));
  assert.deepEqual(a.map((o) => [...o.spikes]), b.map((o) => [...o.spikes]));
  assert.deepEqual(a.map((o) => [...o.outputs]), b.map((o) => [...o.outputs]));
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

test('outputs has one value per declared output, in declaration order, and the drives match them', () => {
  const brain = createFlyBrain(cfg, 3);
  const outs = drive(brain, 0.5, 50);
  for (const o of outs) {
    assert.equal(o.outputs.length, brain.capabilities.channels.outputs.length);
    assert.equal(o.outputs[0], Math.fround(o.left));
    assert.equal(o.outputs[1], Math.fround(o.right));
  }
});

test('spikes are ascending neuron indices below neuronCount, and match the LIF spike vector', () => {
  const brain = createFlyBrain(cfg, 11);
  for (let t = 0; t < 100; t++) {
    const o = brain.step(1.0);
    const expected = [...brain.net.spikes].flatMap((s, n) => (s ? [n] : []));
    assert.deepEqual([...o.spikes], expected, `tick ${t}`);
    assert.ok(o.spikes.every((n, i) => n < 40 && (i === 0 || n > o.spikes[i - 1])), `tick ${t}`);
  }
});

test('a declaration whose drive is missing is rejected when the brain is built', () => {
  const capabilities = structuredClone(TOY_CAPABILITIES);
  delete capabilities.channels.outputs[0].drive;
  assert.throws(() => createFlyBrain({ ...cfg, capabilities }, 3), /brain outputs must have exactly one left and one right drive/);
});

test('a display-only extra output is kept in outputs and does not change left or right', () => {
  const extra = structuredClone(TOY_CAPABILITIES);
  extra.channels.outputs.push({ id: 'wing-motor', label: 'Wing motor', side: 'L', neuron: 7, range: [0, 1] });
  const base = drive(createFlyBrain(cfg, 21), 0.6, 200);
  const more = drive(createFlyBrain({ ...cfg, capabilities: extra }, 21), 0.6, 200);
  assert.deepEqual(more.map((o) => [o.left, o.right]), base.map((o) => [o.left, o.right]));
  assert.equal(more[199].outputs.length, 3);
});
