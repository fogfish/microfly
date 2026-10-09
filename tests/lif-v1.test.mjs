// LIF core, version 1 (contracts/lif-v1.md). G1: with defaults, lif-v1 is bit-exact to lif-v0.
// G2: the same graph, parameters, drive and seed give the same spike sequence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNetwork as createV0, step as stepV0 } from '../public/js/brain/lif-v0.js';
import { createNetwork as createV1, step as stepV1, resolveParams } from '../public/js/brain/lif-v1.js';
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

// L6(a) (output no-op): outputScale defaults to null, so a network with outputNeurons declared behaves identically
// to one with none at all — the mask exists but has no effect until outputScale is set.
test('L6(a): outputNeurons present but outputScale null matches no outputNeurons at all', () => {
  const graph = toyGraph();
  const drive = sensoryDrive();
  const withOutputs = createV1({ ...graph, outputNeurons: [1, 2, 3] }, { outputScale: null }, GOLDEN_SEED);
  const without = createV1(graph, {}, GOLDEN_SEED);
  const extA = new Float64Array(withOutputs.n);
  const extB = new Float64Array(without.n);
  drive.forEach((value, t) => {
    extA[0] = value;
    extB[0] = value;
    stepV1(withOutputs, extA);
    stepV1(without, extB);
    for (let i = 0; i < without.n; i++) {
      assert.equal(withOutputs.v[i], without.v[i], `potential of neuron ${i} differs at step ${t}`);
      assert.equal(withOutputs.spikes[i], without.spikes[i], `spike of neuron ${i} differs at step ${t}`);
    }
  });
});

// L6(b) (output isolation): one driven presynaptic neuron feeds two equal-weight targets, one declared an output
// neuron. A lower outputScale than synapticScale yields measurably fewer output-target spikes; outputScale: null
// makes the two targets indistinguishable.
test('L6(b): outputScale scales output-targeted edges independently of synapticScale', () => {
  const graph = { neuronCount: 3, edges: [{ pre: 0, post: 1, weight: 0.1 }, { pre: 0, post: 2, weight: 0.1 }] };
  const run = (overrides) => {
    const net = createV1({ ...graph, outputNeurons: [1] }, overrides, 1);
    const ext = new Float64Array(3);
    let outCount = 0;
    let otherCount = 0;
    for (let t = 0; t < 300; t++) {
      ext[0] = 2.0; // drives neuron 0 to spike every time its refractory period allows
      stepV1(net, ext);
      outCount += net.spikes[1];
      otherCount += net.spikes[2];
    }
    return { outCount, otherCount };
  };
  const scaled = run({ synapticScale: 10, outputScale: 2 });
  assert.ok(scaled.outCount < scaled.otherCount,
    `output target spikes ${scaled.outCount} should be below non-output target spikes ${scaled.otherCount}`);
  const unscaled = run({ synapticScale: 10, outputScale: null });
  assert.equal(unscaled.outCount, unscaled.otherCount);
});

// L6(c) (validation): outputScale must be null or a finite number of 0 or more.
test('L6(c): resolveParams rejects a negative or non-numeric outputScale', () => {
  const message = 'LIF parameter "outputScale" must be null or a number of 0 or more';
  assert.throws(() => resolveParams({ outputScale: -1 }), { message });
  assert.throws(() => resolveParams({ outputScale: 'x' }), { message });
});

// L6(d) (per-channel isolation, BUG-002): one driven presynaptic neuron feeds three equal-weight targets, each in
// a different declared output channel. A channel absent from the outputScale map falls back to synapticScale.
test('L6(d): a per-channel outputScale isolates each channel, and an unlisted channel falls back to synapticScale', () => {
  const graph = {
    neuronCount: 4,
    edges: [
      { pre: 0, post: 1, weight: 0.1 },
      { pre: 0, post: 2, weight: 0.1 },
      { pre: 0, post: 3, weight: 0.1 },
    ],
    outputChannels: [
      { id: 'a', neurons: [1] },
      { id: 'b', neurons: [2] },
      { id: 'c', neurons: [3] },
    ],
  };
  const net = createV1(graph, { synapticScale: 10, outputScale: { a: 2, b: 8 } }, 1);
  const ext = new Float64Array(4);
  let countA = 0;
  let countB = 0;
  let countC = 0;
  for (let t = 0; t < 300; t++) {
    ext[0] = 2.0; // drives neuron 0 to spike every time its refractory period allows
    stepV1(net, ext);
    countA += net.spikes[1];
    countB += net.spikes[2];
    countC += net.spikes[3];
  }
  assert.ok(countA < countB, `channel a (${countA}) should fire less than channel b (${countB})`);
  assert.ok(countB < countC, `channel b (${countB}) should fire less than unlisted channel c (${countC})`);

  // c, unlisted in outputScale, must match a plain non-output target under the same synapticScale.
  const baselineGraph = { neuronCount: 2, edges: [{ pre: 0, post: 1, weight: 0.1 }] };
  const baseline = createV1(baselineGraph, { synapticScale: 10 }, 1);
  const extBase = new Float64Array(2);
  let baselineCount = 0;
  for (let t = 0; t < 300; t++) {
    extBase[0] = 2.0;
    stepV1(baseline, extBase);
    baselineCount += baseline.spikes[1];
  }
  assert.equal(countC, baselineCount, 'the unlisted channel must behave exactly like a non-output target');
});

// L6(e) (shared-neuron tie-break, BUG-002): a neuron in two output channels resolves to the first-declared
// channel that carries an explicit entry, not simply the first- or last-declared channel.
test('L6(e): a neuron shared between two output channels resolves to the first channel with an explicit entry', () => {
  const graph = {
    neuronCount: 2,
    edges: [{ pre: 0, post: 1, weight: 0.1 }],
    outputChannels: [
      { id: 'x', neurons: [1] }, // declared first, no entry
      { id: 'y', neurons: [1] }, // declared second, has an entry
    ],
  };
  const net = createV1(graph, { synapticScale: 10, outputScale: { y: 2 } }, 1);
  assert.equal(net.outputScaleOf[1], 2, 'falls through x (no entry) to y (has an entry)');

  const graph2 = {
    neuronCount: 2,
    edges: [{ pre: 0, post: 1, weight: 0.1 }],
    outputChannels: [
      { id: 'p', neurons: [1] }, // declared first, has an entry
      { id: 'q', neurons: [1] }, // declared second, also has an entry
    ],
  };
  const net2 = createV1(graph2, { synapticScale: 10, outputScale: { p: 3, q: 7 } }, 1);
  assert.equal(net2.outputScaleOf[1], 3, 'the first-declared channel with an entry wins, not the last');
});

// L6(f) (per-channel validation, BUG-002): per-channel entries are validated like any LIF number, and the
// pre-existing scalar message (T004/G8) is unchanged for non-object invalid values.
test('L6(f): resolveParams validates per-channel outputScale entries without changing the scalar message', () => {
  const perChannelMessage = 'LIF parameter "outputScale.forward" must be a number of 0 or more';
  assert.throws(() => resolveParams({ outputScale: { forward: -1 } }), { message: perChannelMessage });
  assert.throws(() => resolveParams({ outputScale: { forward: 'x' } }), { message: perChannelMessage });

  const scalarMessage = 'LIF parameter "outputScale" must be null or a number of 0 or more';
  assert.throws(() => resolveParams({ outputScale: -1 }), { message: scalarMessage });
  assert.throws(() => resolveParams({ outputScale: 'x' }), { message: scalarMessage });
});

// L7(a) (noise no-op, G11): noiseAmplitude: 0 is identical to it being absent entirely.
test('L7(a): noiseAmplitude 0 gives identical spike trains and potentials to it being absent', () => {
  const graph = toyGraph();
  const drive = sensoryDrive();
  const zero = createV1(graph, { noiseAmplitude: 0 }, GOLDEN_SEED);
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

// L7(b) (reproducibility, G12): the same seed, graph and noiseAmplitude > 0 give the same spike sequence.
test('L7(b): the same seed and noiseAmplitude > 0 give the same spike sequence across runs', () => {
  const run = () => {
    const net = createV1(toyGraph(), { noiseAmplitude: 0.1 }, GOLDEN_SEED);
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
});

// L7(c) (pool desynchrony, G13): a pool of identically-driven, identically-initialized neurons with no recurrent
// connections spikes in lockstep at noiseAmplitude: 0, and measurably less so at noiseAmplitude: 0.3.
test('L7(c): noiseAmplitude desynchronizes an identically-driven pool', () => {
  const N = 20;
  // refractorySteps: 0 and a drive just above threshold so, without noise, every reset neuron spikes again on
  // the very next step (vReset=0, so v = drive each step) — every neuron in lockstep, every step.
  const graph = { neuronCount: N, edges: [] };
  const lockstepFraction = (noiseAmplitude) => {
    const net = createV1(graph, { noiseAmplitude, refractorySteps: 0 }, 7);
    const ext = new Float64Array(N).fill(1.05);
    let together = 0;
    let steps = 0;
    for (let t = 0; t < 500; t++) {
      stepV1(net, ext);
      steps++;
      if (net.spikes.every((s) => s === 1)) together++;
    }
    return together / steps;
  };
  const still = lockstepFraction(0);
  const noisy = lockstepFraction(0.3);
  assert.ok(still > 0.9, `at noiseAmplitude 0 the pool should spike together almost every step (${still})`);
  assert.ok(noisy < still - 0.1, `noiseAmplitude 0.3 (${noisy}) should desynchronize well below the no-noise case (${still})`);
});

// L7(d) (noise/jitter independence, G14): the two mechanisms' PRNG streams never interact.
test('L7(d): noiseAmplitude and thresholdJitter draw from independent PRNG streams', () => {
  const graph = { neuronCount: 10, edges: [] };
  const withoutJitter = createV1(graph, { noiseAmplitude: 0.5, thresholdJitter: 0 }, 42);
  const withJitter = createV1(graph, { noiseAmplitude: 0.5, thresholdJitter: 0.3 }, 42);
  const drawsA = Array.from({ length: 10 }, () => withoutJitter.noiseRand());
  const drawsB = Array.from({ length: 10 }, () => withJitter.noiseRand());
  assert.deepEqual(drawsA, drawsB, 'the noise draw sequence must not depend on thresholdJitter');

  const noNoise = createV1(graph, { thresholdJitter: 0.3, noiseAmplitude: 0 }, 42);
  const withNoise = createV1(graph, { thresholdJitter: 0.3, noiseAmplitude: 0.5 }, 42);
  assert.deepEqual(Array.from(noNoise.threshold), Array.from(withNoise.threshold),
    'the per-neuron thresholds must not depend on noiseAmplitude');
});

// L7(e) (validation, G15): resolveParams rejects a negative or non-numeric noiseAmplitude.
test('L7(e): resolveParams rejects a negative or non-numeric noiseAmplitude', () => {
  const message = 'LIF parameter "noiseAmplitude" must be 0 or more';
  assert.throws(() => resolveParams({ noiseAmplitude: -1 }), { message });
  assert.throws(() => resolveParams({ noiseAmplitude: 'x' }), { message });
});

// L7′(a) (G16): noiseBulkScale 1 is a no-op — identical to it being absent, with noise on.
test('L7′(a): noiseBulkScale 1 gives identical spike trains and potentials to it being absent', () => {
  const graph = { ...toyGraph(), inputNeurons: [0] };
  const one = createV1(graph, { noiseAmplitude: 0.2, noiseBulkScale: 1 }, GOLDEN_SEED);
  const absent = createV1(graph, { noiseAmplitude: 0.2 }, GOLDEN_SEED);
  const ext = new Float64Array(one.n);
  sensoryDrive().forEach((value, t) => {
    ext[0] = value;
    stepV1(one, ext);
    stepV1(absent, ext);
    for (let i = 0; i < one.n; i++) {
      assert.equal(one.v[i], absent.v[i], `potential of neuron ${i} differs at step ${t}`);
    }
  });
});

// L7′(b) (G17): noiseBulkScale 0 confines noise to the declared input neurons, and the stream is drawn for every
// neuron regardless, so an input neuron sees the same noise at any noiseBulkScale.
test('L7′(b): noiseBulkScale 0 confines noise to the input neurons without moving the stream', () => {
  const graph = { neuronCount: 4, edges: [], inputNeurons: [1] };
  const confined = createV1(graph, { noiseAmplitude: 0.3, noiseBulkScale: 0, refractorySteps: 0 }, 9);
  const uniform = createV1(graph, { noiseAmplitude: 0.3, refractorySteps: 0 }, 9);
  const ext = new Float64Array(4);
  for (let t = 0; t < 50; t++) {
    stepV1(confined, ext);
    stepV1(uniform, ext);
    for (const i of [0, 2, 3]) assert.equal(confined.v[i], 0, `bulk neuron ${i} must stay at rest at step ${t}`);
    assert.equal(confined.v[1], uniform.v[1], `the input neuron's noise must not depend on noiseBulkScale (step ${t})`);
  }
});

// L8(a) (G18): inhibitoryScale 1 is a no-op — the snapshot's own weight array, potentials identical.
test('L8(a): inhibitoryScale 1 uses the graph weights unchanged and matches it being absent', () => {
  const graph = snapshotGraph();
  const one = createV1(graph, { inhibitoryScale: 1 });
  assert.equal(one.weights, graph.weights, 'inhibitoryScale 1 must not copy the weights');
  const absent = createV1(graph, {});
  const ext = new Float64Array(one.n).fill(0.08);
  for (let t = 0; t < 100; t++) {
    stepV1(one, ext);
    stepV1(absent, ext);
    for (let i = 0; i < one.n; i++) assert.equal(one.v[i], absent.v[i], `potential of neuron ${i} differs at step ${t}`);
  }
});

// L8(b) (G19): inhibitoryScale multiplies negative weights only, leaving the graph's own array untouched.
test('L8(b): inhibitoryScale scales negative edges only', () => {
  const graph = { neuronCount: 3, edges: [{ pre: 0, post: 1, weight: 0.5 }, { pre: 0, post: 2, weight: -0.5 }] };
  const net = createV1(graph, { inhibitoryScale: 3, synapticScale: 1 });
  assert.deepEqual(Array.from(net.weights), [0.5, -1.5]);
  const ext = Float64Array.of(2, 0, 0);
  stepV1(net, ext);
  stepV1(net, new Float64Array(3));
  assert.equal(net.v[1], 0.5);
  assert.equal(net.v[2], -1.5);
});

// L7′/L8 validation (G20): both reject a negative or non-numeric value, naming the parameter.
test('L7′/L8: resolveParams rejects a negative or non-numeric noiseBulkScale or inhibitoryScale', () => {
  for (const key of ['noiseBulkScale', 'inhibitoryScale']) {
    const message = `LIF parameter "${key}" must be 0 or more`;
    assert.throws(() => resolveParams({ [key]: -1 }), { message });
    assert.throws(() => resolveParams({ [key]: 'x' }), { message });
  }
});
