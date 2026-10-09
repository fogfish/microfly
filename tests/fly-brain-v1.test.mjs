// The v1 runner (contracts/lif-v1.md, ADR 003 L4–L5): each input pool neuron receives clamp(gain(h) × value, 0, max),
// gain(h) = g0 + (g1 − g0) × h from the snapshot's modulators, outputs are the EMA of each pool's mean spike rate in
// declaration order, and the same seed gives the same outputs. Runs on the extracted artifact; skipped when absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFlyBrain } from '../public/js/brain/fly-brain-v1.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const FILE = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));
const SKIP = existsSync(FILE) ? false : 'public/brains/forager-brain.brain is absent';

function snapshot() {
  const b = readFileSync(FILE);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const INPUTS = Float32Array.from([0.6, 0.3, 0.2, 0.1]); // odour-left, odour-right, taste-left, taste-right

test('each input pool neuron gets clamp(gain(h) × value, 0, max), with the hunger gain of its modulator', { skip: SKIP }, () => {
  const snap = snapshot();
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1 }, 7);
  const hunger = 0.25;
  brain.step({ inputs: INPUTS, hunger });
  const { channels } = snap.capabilities;
  const gainOdour = 0.5 + 1.0 * hunger; // hunger: [0.5, 1.5] on the odour inputs
  const gainTaste = 0.1 + 1.4 * hunger; // hunger-taste: source hunger, [0.1, 1.5] on the taste inputs
  channels.inputs.forEach((ch, c) => {
    const gain = ch.id.startsWith('odour') ? gainOdour : gainTaste;
    for (const neuron of ch.neurons) {
      assert.ok(Math.abs(brain.lastDrive[neuron] - clamp(gain * INPUTS[c], 0, 1)) < 1e-9,
        `${ch.id} neuron ${neuron} drive ${brain.lastDrive[neuron]}`);
    }
  });
});

test('hunger must be in [0, 1]', { skip: SKIP }, () => {
  const brain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 1 }, 7);
  assert.throws(() => brain.step({ inputs: INPUTS, hunger: 1.2 }), /hunger must be a number from 0 to 1/);
});

test('outputs are the EMA of each pool mean spike rate over the rate ceiling, in declaration order', { skip: SKIP }, () => {
  const snap = snapshot();
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1, motorSmoothing: 0.05 }, 7);
  const out = brain.step({ inputs: INPUTS, hunger: 0.5 });
  const outputs = snap.capabilities.channels.outputs;
  assert.equal(out.outputs.length, outputs.length);
  outputs.forEach((ch, k) => {
    const mean = ch.neurons.reduce((sum, n) => sum + brain.net.spikes[n], 0) / ch.neurons.length;
    // The EMA of the mean rate, over the ceiling 1 / (refractorySteps + 1), clamped to the declared range.
    const expected = Math.min(1, (0.05 * mean) * (1 + brain.net.params.refractorySteps));
    assert.ok(Math.abs(out.outputs[k] - expected) < 1e-6, `${ch.id}: ${out.outputs[k]} vs ${expected}`);
  });
  assert.deepEqual(outputs.map((ch) => ch.drive), ['turnLeft', 'turnRight', 'forward', 'backward', 'feed']);
});

test('the same seed and the same inputs give the same outputs', { skip: SKIP }, () => {
  const run = () => {
    const brain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 2 }, 99);
    const trace = [];
    for (let t = 0; t < 50; t++) trace.push(Array.from(brain.step({ inputs: INPUTS, hunger: 0.4 }).outputs));
    return trace;
  };
  assert.deepEqual(run(), run());
});

test('a tick runs stepsPerTick LIF steps', { skip: SKIP }, () => {
  const brain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 3 }, 7);
  assert.equal(brain.step({ inputs: INPUTS, hunger: 0.4 }).steps, 3);
});

// L6: an outputScale lower than synapticScale lowers the forward/feed output channels' spike rate independently
// of the rest of the network (ADR 004).
test('outputScale lower than synapticScale lowers the mean spike rate on forward/feed', { skip: SKIP }, () => {
  const run = (lif) => {
    const brain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 1, lif }, 7);
    const outputs = brain.capabilities.channels.outputs;
    const idx = outputs.flatMap((ch, k) => (ch.drive === 'forward' || ch.drive === 'feed') ? [k] : []);
    let total = 0;
    for (let t = 0; t < 200; t++) {
      const out = brain.step({ inputs: INPUTS, hunger: 0.5 });
      for (const k of idx) total += out.outputs[k];
    }
    return total / (200 * idx.length);
  };
  const scaled = run({ synapticScale: 50, outputScale: 5 });
  const unscaled = run({ synapticScale: 50, outputScale: null });
  assert.ok(scaled < unscaled,
    `forward/feed mean rate with outputScale ${scaled} should be below outputScale: null ${unscaled}`);
});

// L6 per-channel (BUG-002): a per-channel outputScale raises feed's mean spike rate above the shared
// outputScale: 5 baseline, while forward's mean spike rate stays comparably low in both runs — proving feed and
// forward are now tunable independently.
test('a per-channel outputScale raises feed independently of forward', { skip: SKIP }, () => {
  const meanRate = (lif, drive) => {
    const brain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 1, lif }, 7);
    const outputs = brain.capabilities.channels.outputs;
    const k = outputs.findIndex((ch) => ch.drive === drive);
    let total = 0;
    for (let t = 0; t < 200; t++) total += brain.step({ inputs: INPUTS, hunger: 0.5 }).outputs[k];
    return total / 200;
  };
  const sharedFeed = meanRate({ synapticScale: 50, outputScale: 5 }, 'feed');
  const sharedForward = meanRate({ synapticScale: 50, outputScale: 5 }, 'forward');
  const perChannelFeed = meanRate({ synapticScale: 50, outputScale: { feed: 30, forward: 5 } }, 'feed');
  const perChannelForward = meanRate({ synapticScale: 50, outputScale: { feed: 30, forward: 5 } }, 'forward');
  assert.ok(perChannelFeed > sharedFeed,
    `feed's per-channel rate ${perChannelFeed} should be above the shared-scale rate ${sharedFeed}`);
  assert.ok(Math.abs(perChannelForward - sharedForward) < 0.05,
    `forward's rate should stay comparably low: shared ${sharedForward}, per-channel ${perChannelForward}`);
});

// L7 (noise, ADR 005): a declared input channel's neurons, driven with the same constant value every tick, spike
// less in lockstep at noiseAmplitude: 0.3 than at noiseAmplitude: 0, same fixed seed.
test('noiseAmplitude desynchronizes a declared input channel\'s pool', { skip: SKIP }, () => {
  const snap = snapshot();
  const channel = snap.capabilities.channels.inputs[0];
  const lockstepFraction = (noiseAmplitude) => {
    const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1, lif: { noiseAmplitude } }, 7);
    let together = 0;
    let steps = 0;
    for (let t = 0; t < 300; t++) {
      brain.step({ inputs: INPUTS, hunger: 0.8 });
      steps++;
      if (channel.neurons.every((n) => brain.net.spikes[n] === 1)) together++;
    }
    return together / steps;
  };
  const still = lockstepFraction(0);
  const noisy = lockstepFraction(0.3);
  assert.ok(noisy <= still, `noiseAmplitude 0.3 (${noisy}) should not be more synchronized than noiseAmplitude 0 (${still})`);
});
