// Adds the learning-v1 decoder-v1 addition (contracts/learning-v1.md "Addition to decoder-v1", T043) to an
// already-built public/brains/forager-brain-mb.decoder.json: learning.naive (the MBON approach/avoid balance per
// food pair, measured brain-only, before any learning), learning.kValence, learning.tau. Run once, after C2 has
// written the decoder file (scripts/mb-decoder-add-naive.mjs does not build pools/valence itself).
//
// Usage: node scripts/mb-decoder-add-naive.mjs --world=world/world-forager-learning.json
//   --decoder=brains/forager-brain-mb.decoder.json --seeds=calibration

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createNetwork, step as lifStep } from '../public/js/brain/lif-v1.js';
import { parseLearning, resolveLearningGroups } from '../public/js/brain/learning.js';

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

const WARMUP_TICKS = 400;
const PRESENTATIONS = 5;
const PRESENT_TICKS = 100;
const REST_TICKS = 100;
const EPSILON = 1e-6;
// decoder.js's own defaults (public/js/fly/decoder.js LEARN_K_DEFAULT/LEARN_TAU); written explicitly so a
// reader never needs to assume them.
const K_VALENCE = 2.0;
const TAU = 300;

function gainAt(modulators, channelId, hunger) {
  let gain = 1;
  for (const mod of modulators ?? []) {
    if (!mod.targets.includes(channelId)) continue;
    const [g0, g1] = mod.gain;
    const value = mod.range !== undefined ? hunger : 1;
    gain *= g0 + (g1 - g0) * value;
  }
  return gain;
}

function channelDrive(snapshot, sense, n) {
  const channels = snapshot.capabilities.channels.inputs.filter((ch) => ch.sense === sense);
  const drive = new Float64Array(n);
  for (const ch of channels) {
    const value = Math.min(ch.range[1], gainAt(snapshot.modulators, ch.id, 1) * 1);
    for (const idx of ch.neurons) drive[idx] = value;
  }
  return drive;
}

function meanRate(spikes, group) {
  if (group.length === 0) return 0;
  let count = 0;
  for (const i of group) count += spikes[i];
  return count / group.length;
}

function balOf(rApp, rAvoid) {
  return (rApp - rAvoid) / (rApp + rAvoid + EPSILON);
}

function presentWindow(net, drive, ticks, stepsPerTick, groups) {
  let appSum = 0;
  let avoidSum = 0;
  let steps = 0;
  for (let t = 0; t < ticks; t++) {
    for (let s = 0; s < stepsPerTick; s++) {
      lifStep(net, drive);
      appSum += meanRate(net.spikes, groups.approach);
      avoidSum += meanRate(net.spikes, groups.avoid);
      steps++;
    }
  }
  return { rApp: appSum / steps, rAvoid: avoidSum / steps };
}

function idleWindow(net, ticks, stepsPerTick, zero) {
  for (let t = 0; t < ticks; t++) for (let s = 0; s < stepsPerTick; s++) lifStep(net, zero);
}

function naiveBalOneSeed(graph, lifParams, seed, drive, zero, groups) {
  const net = createNetwork(graph, lifParams, seed);
  idleWindow(net, WARMUP_TICKS, 1, new Float64Array(graph.neuronCount));
  const stepsPerTick = lifParams.stepsPerTick ?? 1;
  let balSum = 0;
  for (let p = 0; p < PRESENTATIONS; p++) {
    const { rApp, rAvoid } = presentWindow(net, drive, PRESENT_TICKS, stepsPerTick, groups);
    balSum += balOf(rApp, rAvoid);
    idleWindow(net, REST_TICKS, stepsPerTick, zero);
  }
  return balSum / PRESENTATIONS;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const webRoot = new URL('../public/', import.meta.url);
  const config = JSON.parse(readFileSync(new URL(args.world, webRoot), 'utf8'));
  const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
  const errors = validateConfig(expConfig);
  if (errors.length > 0) {
    for (const { path, message } of errors) console.error(`${path}: ${message}`);
    process.exit(1);
  }
  const f = resolveFlies(expConfig);
  const seeds = args.seeds === 'held-out' ? f.experiment.heldOut : f.experiment.seeds;

  const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
  const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const neurons = snapshot.manifest.neurons;

  const learningPath = f.brain.learning;
  const learningFile = JSON.parse(readFileSync(new URL(learningPath, webRoot), 'utf8'));
  parseLearning(learningFile, learningPath, { sha256 });
  const groups = resolveLearningGroups(learningFile, neurons, learningPath);

  const stepsPerTick = f.brain.stepsPerTick ?? 1;
  const lifParams = { ...f.brain.lif, stepsPerTick, outputScale: null, plasticity: { etaReward: 0, etaPunish: 0 } };
  const n = snapshot.neuronCount;
  const zero = new Float64Array(n);
  const graph = {
    neuronCount: n, offsets: snapshot.offsets, targets: snapshot.targets, weights: snapshot.weights,
    inputNeurons: snapshot.capabilities.channels.inputs.flatMap((ch) => ch.neurons),
    neuronClass: neurons.map((nr) => nr.class ?? null),
    neuronType: neurons.map((nr) => nr.type ?? null),
    learning: groups,
  };

  const naive = {};
  for (const [pair, sense] of [['odour-food-a', 'odour:food-a'], ['odour-food-b', 'odour:food-b']]) {
    const drive = channelDrive(snapshot, sense, n);
    const bals = seeds.map((seed) => naiveBalOneSeed(graph, lifParams, seed, drive, zero, groups));
    naive[pair] = bals.reduce((a, b) => a + b, 0) / bals.length;
    console.log(`${pair}: naive bal = ${naive[pair].toFixed(4)} (per-seed: ${bals.map((b) => b.toFixed(4)).join(', ')})`);
  }

  const decoderPath = args.decoder ?? f.brain.decoder;
  const decoderUrl = new URL(decoderPath, webRoot);
  const decoderFile = JSON.parse(readFileSync(decoderUrl, 'utf8'));
  decoderFile.learning = { naive, kValence: K_VALENCE, tau: TAU };
  writeFileSync(decoderUrl, `${JSON.stringify(decoderFile, null, 2)}\n`);
  console.log(`updated: ${decoderUrl.pathname}`);
}

await main();
