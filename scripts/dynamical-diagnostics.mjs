// Dynamical-regime diagnostics (ADR 005 recalibration protocol step 2(b)/(c)): pool-synchrony and
// sensory-gradient, run directly against one declared input channel, bypassing the world/food/body loop
// (constant external drive, fixed hunger, repeated LIF steps via createFlyBrain's own step()).
//
// Usage: node scripts/dynamical-diagnostics.mjs [--world=world/world-forager.json] [--channel=odour-left]
//                                                [--hunger=0.5] [--ticks=500] [--noiseAmplitude=0]

import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { sensoryValue } from '../public/js/fly/stimulus.js';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const worldPath = arg('world', 'world/world-forager.json');
const channelId = arg('channel', 'odour-left');
const hunger = Number(arg('hunger', '0.5'));
const ticks = Number(arg('ticks', '500'));
const noiseAmplitude = Number(arg('noiseAmplitude', '0'));
const seed = Number(arg('seed', '7'));
// D6 candidates: resting/gain default to the world file's own, overridable to test a recalibration candidate
// before it is written to world-forager.json.
const restingArg = arg('resting', null);
const gainArg = arg('gain', null);

const webRoot = new URL('../public/', import.meta.url);
const config = JSON.parse(readFileSync(new URL(worldPath, webRoot), 'utf8'));
const errors = validateConfig(config);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path}: ${message}`);
  process.exit(1);
}
const f = resolveFlies(config);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8')));
if (validateArt(config, catalog).length > 0) process.exit(1);
const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

const inputs = snapshot.capabilities.channels.inputs;
const channel = inputs.find((ch) => ch.id === channelId);
if (!channel) {
  console.error(`unknown input channel "${channelId}"; declared channels are ${inputs.map((ch) => ch.id).join(', ')}`);
  process.exit(1);
}
const channelIndex = inputs.indexOf(channel);
const resting = restingArg !== null ? Number(restingArg) : f.stimulus.resting;
const gain = gainArg !== null ? Number(gainArg) : f.stimulus.gain;
const max = f.stimulus.max ?? 1;

// Builds a fresh brain and runs it for `steps` ticks, all input channels at 0 except `channelIndex` at `value`.
// Returns per-step spike state of the pool's neurons (steps × pool size, 0/1).
function runPool(value, steps, lif) {
  const brainConfig = { ...f.brain, snapshot, version: 'v1', lif: { ...f.brain.lif, ...lif } };
  const brain = createFlyBrain(brainConfig, seed);
  const values = new Float32Array(inputs.length);
  values[channelIndex] = value;
  const trace = [];
  for (let t = 0; t < steps; t++) {
    brain.step({ inputs: values, hunger });
    trace.push(channel.neurons.map((n) => brain.net.spikes[n]));
  }
  return trace;
}

// Pool-synchrony diagnostic (ADR 005, G13's population-level analogue): the fraction of steps on which every
// neuron in the pool spikes together.
function poolSynchrony(value, steps, lif) {
  const trace = runPool(value, steps, lif);
  const together = trace.filter((step) => step.every((s) => s === 1)).length;
  return together / steps;
}

// Sensory-gradient diagnostic (ADR 005, spec SC-002): mean firing rate of the pool at each fixed intensity.
function meanFiringRate(value, steps, lif) {
  const trace = runPool(value, steps, lif);
  const total = trace.reduce((sum, step) => sum + step.reduce((s, x) => s + x, 0), 0);
  return total / (steps * channel.neurons.length);
}

console.log(`channel ${channelId} (${channel.neurons.length} neurons), hunger ${hunger}, ${ticks} ticks, seed ${seed}`);
console.log(`stimulus resting ${resting}, gain ${gain}, max ${max}`);

console.log('\npool-synchrony diagnostic (fraction of steps every neuron spikes together, drive = max):');
for (const amp of [0, noiseAmplitude].filter((v, i, a) => a.indexOf(v) === i)) {
  const fraction = poolSynchrony(1.0, ticks, { noiseAmplitude: amp });
  console.log(`  noiseAmplitude ${amp}: ${(fraction * 100).toFixed(1)} %`);
}

// D6: "none" is intensity 0 (no fruit nearby) routed through the real sensoryValue formula, so the "no odour"
// level reflects the resting floor a fly actually senses, not a bare 0 — the same mapping stimulus.js applies.
console.log('\nsensory-gradient diagnostic (mean firing rate at fixed, real-mapped intensities):');
const LEVELS = [['none', 0], ['low', 0.33], ['mid', 0.66], ['high', 1.0]];
for (const [label, intensity] of LEVELS) {
  const value = sensoryValue(intensity, gain, max, resting);
  const rate = meanFiringRate(value, ticks, { noiseAmplitude });
  console.log(`  ${label.padEnd(5)} (intensity ${intensity.toFixed(2)} -> value ${value.toFixed(3)}): ${rate.toFixed(4)} spikes/step/neuron`);
}
