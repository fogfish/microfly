// The mushroom-body teaching-signal probe (ADR 011, research.md §6). Brain-only: no world simulation, no decoder.
// It reads the world config only for flies.brain.{snapshot,lif,learning} and experiment.seeds (calibration only),
// then drives the raw LIF core directly so it can read the dopamine drive D (lif-v1.js's own L12 mechanism) per
// tick, for signals the connectome might already carry versus signals that need an injected reinforcement pair.
//
// Usage: node scripts/mb-teaching-probe.mjs --world=world/world-forager-learning.json --seeds=calibration
//   --out=specs/019-mb-valence-learning/teaching-signals.md
//
// Protocol (research.md §6): per signal, 400-tick warm-up (no input), then 5 blocks of 200 ticks stimulus-on /
// 200 ticks rest, per calibration seed. D is read once per tick (lif-v1.js's net.learning, after the tick's last
// LIF step) with etaReward = etaPunish = 0, so D is measured without ever depressing a synapse (the probe reuses
// the exact same rate/baseline/threshold mechanism the real system runs, instead of reimplementing it by hand).
// A signal "carries" when D is above 0 on >= 50% of stimulus ticks and <= 5% of rest ticks (research.md §6).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
const STIM_TICKS = 200;
const REST_TICKS = 200;
const BLOCKS = 5;
const CARRY_STIM_MIN = 0.5;
const CARRY_REST_MAX = 0.05;

// fly-brain-v1.js's own channelGains/modulatorValue, specialised to a world with no flies.brain.modulators
// override (this world sets none, so hungerThreshold is always undefined and a range modulator reads hunger
// directly). The mb brain declares two modulators: "hunger" (targets the four food-odour channels) and
// "hunger-taste" (sourced from "hunger", targets the four taste channels) — so taste's gain genuinely depends on
// hunger, unlike heat/touch/danger-odour, which no modulator targets (gain 1 regardless of hunger).
function modulatorValueAt(modulators, mod, hunger) {
  if (mod.range !== undefined) return hunger;
  return modulatorValueAt(modulators, modulators.find((m) => m.id === mod.source), hunger);
}
function gainAt(modulators, channelId, hunger) {
  let gain = 1;
  for (const mod of modulators ?? []) {
    if (!mod.targets.includes(channelId)) continue;
    const [g0, g1] = mod.gain;
    gain *= g0 + (g1 - g0) * modulatorValueAt(modulators, mod, hunger);
  }
  return gain;
}

function channelsFor(capabilities, sense) {
  return capabilities.channels.inputs.filter((ch) => ch.sense === sense);
}

// Builds a driveFor(graphNeuronCount) => Float64Array setter for a named sense, at its declared channel max,
// scaled by the gain at the given hunger.
function senseDrive(snapshot, sense, hunger = 1) {
  const channels = channelsFor(snapshot.capabilities, sense);
  return (n) => {
    const drive = new Float64Array(n);
    for (const ch of channels) {
      const value = Math.min(ch.range[1], gainAt(snapshot.modulators, ch.id, hunger) * 1);
      for (const idx of ch.neurons) drive[idx] = value;
    }
    return drive;
  };
}

// Drives an output pool's own neurons directly with a constant current, bypassing the sensory channel path
// entirely — "the escape output driven, to check the MBON/DAN back-path" (research.md §6).
function outputDrive(snapshot, driveName, current) {
  const channels = snapshot.capabilities.channels.outputs.filter((ch) => ch.drive === driveName);
  return (n) => {
    const drive = new Float64Array(n);
    for (const ch of channels) for (const idx of ch.neurons) drive[idx] = current;
    return drive;
  };
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

// Runs one seed's warm-up + BLOCKS stimulus/rest cycles. Returns { stim: { reward: [...], punish: [...] },
// rest: { reward: [...], punish: [...] } }, each a flat array of per-tick D values (0 when plasticity has no
// reward/punish group at all is impossible here: graph.learning always resolves both).
function runSeed(graph, lifParams, seed, driveFn, stepsPerTick) {
  const net = createNetwork(graph, lifParams, seed);
  const n = graph.neuronCount;
  const zero = new Float64Array(n);
  for (let t = 0; t < WARMUP_TICKS; t++) for (let s = 0; s < stepsPerTick; s++) lifStep(net, zero);

  const stim = { reward: [], punish: [] };
  const rest = { reward: [], punish: [] };
  const drive = driveFn(n);
  for (let b = 0; b < BLOCKS; b++) {
    for (let t = 0; t < STIM_TICKS; t++) {
      for (let s = 0; s < stepsPerTick; s++) lifStep(net, drive);
      stim.reward.push(net.learning.dReward);
      stim.punish.push(net.learning.dPunish);
    }
    for (let t = 0; t < REST_TICKS; t++) {
      for (let s = 0; s < stepsPerTick; s++) lifStep(net, zero);
      rest.reward.push(net.learning.dReward);
      rest.punish.push(net.learning.dPunish);
    }
  }
  return { stim, rest };
}

function fractionPositive(xs) { return xs.length ? xs.filter((x) => x > 0).length / xs.length : 0; }

function carries(stimFrac, restFrac) {
  return stimFrac >= CARRY_STIM_MIN && restFrac <= CARRY_REST_MAX;
}

function runSignal(graph, lifParams, seeds, driveFn, stepsPerTick, pools) {
  const perSeed = seeds.map((seed) => runSeed(graph, lifParams, seed, driveFn, stepsPerTick));
  const result = {};
  for (const pool of pools) {
    const stimFrac = mean(perSeed.map((r) => fractionPositive(r.stim[pool])));
    const restFrac = mean(perSeed.map((r) => fractionPositive(r.rest[pool])));
    result[pool] = { stimFraction: stimFrac, restFraction: restFrac, carries: carries(stimFrac, restFrac) };
  }
  return result;
}

function tableMarkdown(rows) {
  const lines = [
    '| Signal | Pool | Stimulus ticks with D>0 | Rest ticks with D>0 | Carried? |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    lines.push(`| ${r.signal} | ${r.pool} | ${(r.stimFraction * 100).toFixed(1)}% | ${(r.restFraction * 100).toFixed(1)}% | ${r.carries ? 'carried' : 'injected'} |`);
  }
  return lines.join('\n');
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
  if (args.seeds && args.seeds !== 'calibration') {
    console.error('--seeds must be "calibration" (teaching signals are measured only, never gated)'); process.exit(1);
  }
  const seeds = f.experiment.seeds;

  const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
  const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const neurons = snapshot.manifest.neurons;

  const learningPath = f.brain.learning;
  const learningFile = JSON.parse(readFileSync(new URL(learningPath, webRoot), 'utf8'));
  parseLearning(learningFile, learningPath, { sha256 });
  const groups = resolveLearningGroups(learningFile, neurons, learningPath);

  const stepsPerTick = f.brain.stepsPerTick ?? 1;
  const worldLif = { ...f.brain.lif };
  // Measure D without ever depressing a synapse (eta 0): the probe reads the exact same rate/baseline/threshold
  // mechanism lif-v1.js runs for real, with none of its side effects.
  const lifParams = { ...worldLif, outputScale: null, plasticity: { ...(worldLif.plasticity ?? {}), etaReward: 0, etaPunish: 0 } };

  const graph = {
    neuronCount: snapshot.neuronCount, offsets: snapshot.offsets, targets: snapshot.targets, weights: snapshot.weights,
    inputNeurons: snapshot.capabilities.channels.inputs.flatMap((ch) => ch.neurons),
    neuronClass: neurons.map((nr) => nr.class ?? null),
    neuronType: neurons.map((nr) => nr.type ?? null),
    learning: groups,
  };

  const signals = [
    { signal: 'mouth taste (hunger 1)', driveFn: senseDrive(snapshot, 'taste', 1), pools: ['reward'] },
    { signal: 'mouth taste (hunger 0)', driveFn: senseDrive(snapshot, 'taste', 0), pools: ['reward'] },
    { signal: 'heat', driveFn: senseDrive(snapshot, 'heat'), pools: ['punish'] },
    { signal: 'touch', driveFn: senseDrive(snapshot, 'touch'), pools: ['punish'] },
    { signal: 'danger odour', driveFn: senseDrive(snapshot, 'odour:danger'), pools: ['punish'] },
    { signal: 'escape output driven', driveFn: outputDrive(snapshot, 'escape', 2), pools: ['punish'] },
    { signal: 'food odour A alone', driveFn: senseDrive(snapshot, 'odour:food-a'), pools: ['reward', 'punish'] },
    { signal: 'food odour B alone', driveFn: senseDrive(snapshot, 'odour:food-b'), pools: ['reward', 'punish'] },
  ];

  const rows = [];
  for (const { signal, driveFn, pools } of signals) {
    console.log(`running: ${signal}...`);
    const result = runSignal(graph, lifParams, seeds, driveFn, stepsPerTick, pools);
    for (const pool of pools) rows.push({ signal, pool, ...result[pool] });
  }

  const md = [
    '# Teaching signals (ADR 011, research.md §6)',
    '',
    `Snapshot: \`${f.brain.snapshot}\` (sha256 \`${sha256}\`). Seeds (calibration): ${seeds.join(', ')}.`,
    `Protocol: ${WARMUP_TICKS}-tick warm-up, then ${BLOCKS} blocks of ${STIM_TICKS} stimulus-on / ${REST_TICKS} rest ticks.`,
    `Carries when D>0 on >= ${CARRY_STIM_MIN * 100}% of stimulus ticks and <= ${CARRY_REST_MAX * 100}% of rest ticks.`,
    '',
    tableMarkdown(rows),
    '',
  ].join('\n');

  console.log(md);
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${md}\n`);
    console.log(`written: ${args.out}`);
  }
}

await main();
