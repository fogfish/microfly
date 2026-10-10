// The v2 runner (ADR 006 L9, L10; contracts/lif-v1-groupgain.md, world-config-forager-v2.md): Poisson input
// encoding's rate mapping, reproducibility, and stream independence from lif-v1.js's own jitter/noise streams.
// A few tests also run on the real extracted 15K brain (skipped when absent), mirroring fly-brain-v1.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createV2FlyBrain } from '../public/js/brain/fly-brain-v2.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const FILE = fileURLToPath(new URL('../public/brains/forager-brain-15k.brain', import.meta.url));
const SKIP = existsSync(FILE) ? false : 'public/brains/forager-brain-15k.brain is absent';

function realSnapshot() {
  const b = readFileSync(FILE);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

// A tiny hand-built version-5-shaped snapshot: one input neuron (0), one output neuron (1), no edges. Not a real
// container (createV2FlyBrain reads capabilities.channels directly; it does not re-validate the declaration —
// that happens in snapshot.js at load time).
function tinySnap() {
  return {
    version: 5,
    neuronCount: 2,
    offsets: Uint32Array.of(0, 0, 0),
    targets: Uint32Array.of(),
    weights: Float32Array.of(),
    capabilities: {
      signals: ['spikes'],
      channels: {
        inputs: [{ id: 'touch-left', label: 'Touch left', side: 'L', neurons: [0], range: [0, 1], sense: 'touch', site: 'front-leg' }],
        outputs: [{ id: 'escape', label: 'Escape', side: 'both', neurons: [1], range: [0, 1], drive: 'escape' }],
      },
    },
    manifest: { neurons: [{ group: 'input' }, { group: 'output' }] },
    modulators: [],
  };
}

test('L9: value 0 fires at r0, value 1 fires at r1 (no modulator on this channel, gain 1)', () => {
  const r0 = 0.1;
  const r1 = 0.8;
  const trials = 4000;
  const rateOf = (value) => {
    const brain = createV2FlyBrain({
      snapshot: tinySnap(), stepsPerTick: 1, input: { encoding: 'poisson', rate: [r0, r1], weight: 1 },
    }, 1);
    let fired = 0;
    for (let t = 0; t < trials; t++) {
      brain.step({ inputs: Float32Array.of(value), hunger: 0 });
      if (brain.net.input[0] > 0 || brain.lastDrive[0] > 0) fired++;
    }
    return fired / trials;
  };
  const measured0 = rateOf(0);
  const measured1 = rateOf(1);
  assert.ok(Math.abs(measured0 - r0) < 0.03, `value 0: measured rate ${measured0} should be near r0 ${r0}`);
  assert.ok(Math.abs(measured1 - r1) < 0.03, `value 1: measured rate ${measured1} should be near r1 ${r1}`);
});

test('L9: reproducibility — the same seed gives the same Bernoulli draws', () => {
  const run = () => {
    const brain = createV2FlyBrain({
      snapshot: tinySnap(), stepsPerTick: 1, input: { encoding: 'poisson', rate: [0.1, 0.9], weight: 1 },
    }, 42);
    const draws = [];
    for (let t = 0; t < 200; t++) {
      brain.step({ inputs: Float32Array.of(0.5), hunger: 0 });
      draws.push(brain.lastDrive[0]);
    }
    return draws;
  };
  assert.deepEqual(run(), run());
});

test('L9: the input-encoding stream is independent of thresholdJitter and noiseAmplitude', () => {
  const run = (lif) => {
    const brain = createV2FlyBrain({
      snapshot: tinySnap(), stepsPerTick: 1, lif,
      input: { encoding: 'poisson', rate: [0.1, 0.9], weight: 1 },
    }, 7);
    const draws = [];
    for (let t = 0; t < 100; t++) {
      brain.step({ inputs: Float32Array.of(0.5), hunger: 0 });
      draws.push(brain.lastDrive[0]);
    }
    return draws;
  };
  const plain = run({});
  const jittered = run({ thresholdJitter: 0.3 });
  const noisy = run({ noiseAmplitude: 0.5 });
  assert.deepEqual(jittered, plain, 'the input draws must not depend on thresholdJitter');
  assert.deepEqual(noisy, plain, 'the input draws must not depend on noiseAmplitude');
});

test('"current" encoding (the default) behaves like v1: a constant clamped drive every step', () => {
  const brain = createV2FlyBrain({ snapshot: tinySnap(), stepsPerTick: 1 }, 1);
  brain.step({ inputs: Float32Array.of(0.6), hunger: 0 });
  assert.ok(Math.abs(brain.lastDrive[0] - 0.6) < 1e-6);
});

test('a tick runs stepsPerTick LIF steps', { skip: SKIP }, () => {
  const brain = createV2FlyBrain({ snapshot: realSnapshot(), stepsPerTick: 3 }, 7);
  const inputs = new Float32Array(brain.capabilities.channels.inputs.length);
  assert.equal(brain.step({ inputs, hunger: 0.4 }).steps, 3);
});

test('outputs cover all six declared drives, including escape', { skip: SKIP }, () => {
  const snap = realSnapshot();
  const brain = createV2FlyBrain({ snapshot: snap, stepsPerTick: 1 }, 7);
  const inputs = new Float32Array(snap.capabilities.channels.inputs.length);
  const out = brain.step({ inputs, hunger: 0.5 });
  assert.equal(out.outputs.length, 6);
  assert.deepEqual(snap.capabilities.channels.outputs.map((ch) => ch.drive),
    ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape']);
});

test('the same seed and the same inputs give the same outputs', { skip: SKIP }, () => {
  const run = () => {
    const brain = createV2FlyBrain({ snapshot: realSnapshot(), stepsPerTick: 2 }, 99);
    const inputs = new Float32Array(brain.capabilities.channels.inputs.length).fill(0.3);
    const trace = [];
    for (let t = 0; t < 20; t++) trace.push(Array.from(brain.step({ inputs, hunger: 0.4 }).outputs));
    return trace;
  };
  assert.deepEqual(run(), run());
});
