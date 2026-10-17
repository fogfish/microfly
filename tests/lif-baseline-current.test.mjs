// L10 (demo forager, ADR 010): a constant input current added to every neuron every step, input and output pools
// alike. Default 0 keeps lif-v1.js bit-exact to lif-v0.js (G1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork as createV1, step as stepV1, resolveParams } from '../public/js/brain/lif-v1.js';
import { TOY_CAPABILITIES } from '../public/js/brain/capabilities.js';
import { randomGraph, addMotorDrive } from '../public/js/brain/graph.js';
import { createPrng } from '../public/js/world/prng.js';
import { GOLDEN_SEED, GOLDEN_CONFIG, GOLDEN_DRIVE } from './golden-drive.mjs';

function toyGraph() {
  const motors = TOY_CAPABILITIES.channels.outputs.filter((ch) => ch.drive).map((ch) => ch.neuron);
  return addMotorDrive(randomGraph({
    neuronCount: GOLDEN_CONFIG.neuronCount,
    outDegree: GOLDEN_CONFIG.outDegree,
    inhibitoryFraction: GOLDEN_CONFIG.inhibitoryFraction,
    rand: createPrng(GOLDEN_SEED).next,
  }), { sensory: 0, motors });
}

function sensoryDrive() {
  const values = [];
  for (const { value, ticks } of GOLDEN_DRIVE) for (let t = 0; t < ticks; t++) values.push(value);
  return values;
}

test('L10(a): baselineCurrent 0 gives identical spike trains and potentials to it being absent', () => {
  const graph = toyGraph();
  const drive = sensoryDrive();
  const zero = createV1(graph, { baselineCurrent: 0 }, GOLDEN_SEED);
  const absent = createV1(graph, {}, GOLDEN_SEED);
  const extZero = new Float64Array(zero.n);
  const extAbsent = new Float64Array(absent.n);
  drive.forEach((value, t) => {
    extZero[0] = value;
    extAbsent[0] = value;
    stepV1(zero, extZero);
    stepV1(absent, extAbsent);
    for (let i = 0; i < zero.n; i++) {
      assert.equal(zero.v[i], absent.v[i], `potential of neuron ${i} differs at step ${t}`);
      assert.equal(zero.spikes[i], absent.spikes[i], `spike of neuron ${i} differs at step ${t}`);
    }
  });
});

test('L10(b): baselineCurrent > 0 is applied equally to input and output pools', () => {
  const graph = { ...toyGraph(), inputNeurons: [0], outputNeurons: [1, 2] };
  const net = createV1(graph, { baselineCurrent: 0.01, refractorySteps: 0 }, GOLDEN_SEED);
  const ext = new Float64Array(net.n);
  stepV1(net, ext);
  // With zero drive and zero leak-decayed start, every neuron (input, output, bulk alike) should have moved by
  // exactly baselineCurrent from rest — no pool is singled out.
  for (let i = 0; i < net.n; i++) {
    assert.ok(Math.abs(net.v[i] - 0.01) < 1e-12, `neuron ${i} should receive baselineCurrent regardless of pool`);
  }
});

test('L10(c): baselineCurrent raises firing rate of a constantly driven neuron', () => {
  const run = (baselineCurrent) => {
    const net = createV1({ neuronCount: 1, edges: [] }, { baselineCurrent }, 1);
    const ext = Float64Array.of(0.03);
    let spikes = 0;
    for (let t = 0; t < 500; t++) {
      stepV1(net, ext);
      spikes += net.spikes[0];
    }
    return spikes;
  };
  const plain = run(0);
  const boosted = run(0.03);
  assert.ok(boosted > plain, `baselineCurrent should raise the firing rate (plain ${plain}, boosted ${boosted})`);
});

test('L10(d): resolveParams rejects a negative or non-numeric baselineCurrent', () => {
  const message = 'LIF parameter "baselineCurrent" must be 0 or more';
  assert.throws(() => resolveParams({ baselineCurrent: -1 }), { message });
  assert.throws(() => resolveParams({ baselineCurrent: 'x' }), { message });
});
