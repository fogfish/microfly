// D32: an optional runtime hunger threshold (flies.modulators.hunger.threshold), read from world config only
// (never the snapshot). Absent keeps today's linear gain curve unchanged for v0/v1/v2 (research.md §6).
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
const INPUTS = Float32Array.from([0.6, 0.3, 0.2, 0.1]);

test('below threshold: gain is gainMin (m\' = 0)', { skip: SKIP }, () => {
  const snap = snapshot();
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1, modulators: { hunger: { threshold: 0.4 } } }, 7);
  brain.step({ inputs: INPUTS, hunger: 0.3 });
  const odourChannel = snap.capabilities.channels.inputs.find((ch) => ch.id.startsWith('odour'));
  const gainMin = 0.5; // the snapshot's hunger modulator: gain [0.5, 1.5]
  for (const neuron of odourChannel.neurons) {
    assert.ok(Math.abs(brain.lastDrive[neuron] - clamp(gainMin * INPUTS[0], 0, 1)) < 1e-9);
  }
});

test('above threshold: gain ramps from gainMin to gainMax over (h - threshold)/(1 - threshold)', { skip: SKIP }, () => {
  const snap = snapshot();
  const threshold = 0.4;
  const hunger = 0.7;
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1, modulators: { hunger: { threshold } } }, 7);
  brain.step({ inputs: INPUTS, hunger });
  const odourChannel = snap.capabilities.channels.inputs.find((ch) => ch.id.startsWith('odour'));
  const mPrime = (hunger - threshold) / (1 - threshold);
  const gain = 0.5 + 1.0 * mPrime; // gain [0.5, 1.5]
  for (const neuron of odourChannel.neurons) {
    assert.ok(Math.abs(brain.lastDrive[neuron] - clamp(gain * INPUTS[0], 0, 1)) < 1e-9);
  }
});

test('with no threshold supplied, output is identical to the pre-existing linear formula', { skip: SKIP }, () => {
  const snap = snapshot();
  const hunger = 0.55;
  const withThreshold = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1 }, 7);
  const plain = createFlyBrain({ version: 'v1', snapshot: snapshot(), stepsPerTick: 1 }, 7);
  withThreshold.step({ inputs: INPUTS, hunger });
  plain.step({ inputs: INPUTS, hunger });
  assert.deepEqual(Array.from(withThreshold.lastDrive), Array.from(plain.lastDrive));
});
