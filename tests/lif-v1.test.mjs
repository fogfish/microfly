// LIF core, version 1 (contracts/lif-v1.md). G1: with defaults, lif-v1 is bit-exact to lif-v0.
// G2: the same graph, parameters, drive and seed give the same spike sequence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNetwork as createV0, step as stepV0 } from '../public/js/brain/lif-v0.js';
import { createNetwork as createV1, step as stepV1 } from '../public/js/brain/lif-v1.js';
import { randomGraph, addMotorDrive } from '../public/js/brain/graph.js';
import { TOY_CAPABILITIES } from '../public/js/brain/capabilities.js';
import { createPrng } from '../public/js/world/prng.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { GOLDEN_SEED, GOLDEN_CONFIG, GOLDEN_DRIVE } from './golden-drive.mjs';

const SNAPSHOT = new URL('./fixtures/synthetic-smallest.brain', import.meta.url);

// The toy brain of golden-drive.mjs as a graph: random wiring, then the motor drive, as fly-brain-v0 builds it.
function toyGraph() {
  const motors = TOY_CAPABILITIES.channels.outputs.filter((ch) => ch.drive).map((ch) => ch.neuron);
  return addMotorDrive(randomGraph({
    neuronCount: GOLDEN_CONFIG.neuronCount,
    outDegree: GOLDEN_CONFIG.outDegree,
    inhibitoryFraction: GOLDEN_CONFIG.inhibitoryFraction,
    rand: createPrng(GOLDEN_SEED).next,
  }), { sensory: 0, motors });
}

function snapshotGraph() {
  const b = readFileSync(SNAPSHOT);
  const snap = parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  return { neuronCount: snap.neuronCount, offsets: snap.offsets, targets: snap.targets, weights: snap.weights };
}

// The drive of golden-drive.mjs: sensory value on neuron 0, one entry per tick.
function sensoryDrive() {
  const values = [];
  for (const { value, ticks } of GOLDEN_DRIVE) for (let t = 0; t < ticks; t++) values.push(value);
  return values;
}

// Runs both cores on the same drive and compares every potential and every spike at every step (G1, ===).
function assertBitExact(graph, drive) {
  const a = createV0(graph);
  const b = createV1(graph, {}, GOLDEN_SEED);
  const extA = new Float64Array(a.n);
  const extB = new Float64Array(b.n);
  drive.forEach((value, t) => {
    extA[0] = value;
    extB[0] = value;
    stepV0(a, extA);
    stepV1(b, extB);
    for (let i = 0; i < a.n; i++) {
      assert.equal(b.v[i], a.v[i], `potential of neuron ${i} differs at step ${t}`);
      assert.equal(b.spikes[i], a.spikes[i], `spike of neuron ${i} differs at step ${t}`);
    }
  });
}

test('G1: with default parameters the toy graph of the golden drive is bit-exact to v0', () => {
  assertBitExact(toyGraph(), sensoryDrive());
});

test('G1: with default parameters the snapshot CSR graph is bit-exact to v0', () => {
  const drive = Array.from({ length: 300 }, (_, t) => (t % 7 === 0 ? 1.0 : 0.1));
  assertBitExact(snapshotGraph(), drive);
});

test('G2: the same graph, parameters, drive and seed give the same spike sequence', () => {
  const run = () => {
    const net = createV1(toyGraph(), {}, GOLDEN_SEED);
    const ext = new Float64Array(net.n);
    const train = [];
    for (const value of sensoryDrive()) {
      ext[0] = value;
      stepV1(net, ext);
      train.push(Array.from(net.spikes));
    }
    return train;
  };
  const a = run();
  assert.deepEqual(run(), a);
  assert.ok(a.some((s) => s.some((x) => x === 1)), 'the run should contain spikes');
});

// G3 (spread): with tauSyn > 0 the arriving input is low-passed. A spike's contribution is w × synapticScale in its
// arrival step, then decays by e^(−dt/tauSyn) per step. A sustained arrival reaches the same level as its input.
test('G3: the synaptic current decays with exp(−dt/tauSyn) and settles at the arriving level', () => {
  const graph = { neuronCount: 2, edges: [{ pre: 0, post: 1, weight: 1 }] };
  const net = createV1(graph, { tauSyn: 5, synapticScale: 1 }, 1);
  const decay = Math.exp(-1 / 5);
  net.input = Float64Array.of(0, 0.4);
  stepV1(net, new Float64Array(2));
  assert.ok(Math.abs(net.syn[1] - 0.4 * (1 - decay)) < 1e-12, 'first step: arrival × (1 − decay)');
  net.input = Float64Array.of(0, 0);
  stepV1(net, new Float64Array(2));
  assert.ok(Math.abs(net.syn[1] - 0.4 * (1 - decay) * decay) < 1e-12, 'second step: decayed');

  const sustained = createV1({ neuronCount: 2, edges: [] }, { tauSyn: 5 }, 1);
  for (let t = 0; t < 200; t++) {
    sustained.input = Float64Array.of(0, 0.4);
    stepV1(sustained, new Float64Array(2));
  }
  assert.ok(Math.abs(sustained.syn[1] - 0.4) < 1e-9, `steady level ${sustained.syn[1]} should be the arriving level 0.4`);
});

// G4 (adaptation): with tauAdapt > 0 a constantly driven neuron fires less in the later part of the run.
test('G4: with adaptation, a constantly driven neuron fires less later in the run', () => {
  const run = (overrides) => {
    const net = createV1({ neuronCount: 1, edges: [] }, overrides, 1);
    const ext = Float64Array.of(0.2);
    const spikes = [];
    for (let t = 0; t < 400; t++) {
      stepV1(net, ext);
      spikes.push(net.spikes[0]);
    }
    return { early: spikes.slice(0, 100).reduce((a, b) => a + b, 0), late: spikes.slice(300).reduce((a, b) => a + b, 0) };
  };
  const plain = run({});
  // The period of the spikes need not divide 100 steps, so the windows may differ by one spike.
  assert.ok(Math.abs(plain.early - plain.late) <= 1, `without adaptation the rate is constant (${plain.early}, ${plain.late})`);
  const adapted = run({ tauAdapt: 50, adaptStep: 0.5 });
  assert.ok(adapted.late < adapted.early, `adapted late ${adapted.late} should be below early ${adapted.early}`);
});

// G5 (jitter): thresholds are reproducible from the seed, and equal vThreshold without jitter.
test('G5: the same seed gives the same thresholds, another seed different ones, and no jitter gives vThreshold', () => {
  const graph = { neuronCount: 50, edges: [] };
  const a = createV1(graph, { thresholdJitter: 0.3 }, 11).threshold;
  const b = createV1(graph, { thresholdJitter: 0.3 }, 11).threshold;
  const c = createV1(graph, { thresholdJitter: 0.3 }, 12).threshold;
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.notDeepEqual(Array.from(a), Array.from(c));
  const flat = createV1(graph, {}, 11).threshold;
  assert.ok(flat.every((v) => v === 1.0));
});

// L5 (steps per tick): the core ignores stepsPerTick. One call of step is one LIF step whatever the value.
test('L5: the core takes one LIF step per call, whatever stepsPerTick is', () => {
  const trace = (stepsPerTick) => {
    const net = createV1({ neuronCount: 1, edges: [] }, { stepsPerTick }, 1);
    const ext = Float64Array.of(0.4);
    return Array.from({ length: 20 }, () => { stepV1(net, ext); return net.v[0]; });
  };
  assert.deepEqual(trace(1), trace(5));
});
