// The mushroom-body conditioning probe (ADR 011, FR-013/FR-014/FR-015, research.md §8; ported from the
// described learn_test.mjs, CHANGELOG). Brain-only: no world simulation, no decoder, no body layer — it reads
// the world config only for flies.brain.{snapshot,lif,learning} and experiment.heldOut/seeds, then drives the
// raw LIF core directly so it can read the MBON approach/avoid group balance each presentation.
//
// Usage: node scripts/mb-conditioning-probe.mjs --world=world/world-forager-learning.json
//   --seeds=calibration|held-out --arms=plastic,frozen,shuffled,random
//   --out=specs/019-mb-valence-learning/conditioning.json
//
// Protocol (research.md §8): naive test (5 presentations each of A and B, 100 ticks each, 100-tick rest between
// trials); 6 pairings of odour A (100 ticks each: 50 ticks odour alone, then 50 ticks odour + the teaching
// pair), run once with the reward pair and once with the punish pair; an immediate post-test (5+5 presentations,
// same protocol as naive); a rest of tauForget steps (idle, zero input); a final (decay) test. Learned-valence
// balance bal = (rApp - rAvoid)/(rApp + rAvoid + eps) per presentation, averaged over the 5; shift = bal(stage) -
// bal(naive). Four arms: plastic, frozen (plasticity: null), shuffled (dopamine: "shuffled"), random (the
// matched random graph, rewire() from forager-arms.mjs, same learning-sidecar groups by index).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createNetwork, step as lifStep } from '../public/js/brain/lif-v1.js';
import { parseLearning, resolveLearningGroups } from '../public/js/brain/learning.js';
import { createPrng } from '../public/js/world/prng.js';

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
const REST_TICKS = 100; // between every trial/pairing, so eligibility traces (tauElig) clear between them
const PAIRINGS = 6;
const PAIR_TICKS = 100;
const TEACH_ON_AT = 50; // the teaching pair joins odour A halfway through each pairing (research.md §8)
const EPSILON = 1e-6;

// Size-matched random graph (duplicated from mb-regime-probe.mjs/forager-arms.mjs's own rewire(), to keep this
// script brain-only/dependency-free of the world-building machinery forager-arms.mjs also imports).
function rewire(snapshot, seed) {
  const rand = createPrng(seed).next;
  const n = snapshot.neuronCount;
  const targets = new Uint32Array(snapshot.targets.length);
  for (let pre = 0; pre < n; pre++) {
    for (let k = snapshot.offsets[pre]; k < snapshot.offsets[pre + 1]; k++) {
      let post = Math.floor(rand() * n);
      while (post === pre) post = Math.floor(rand() * n);
      targets[k] = post;
    }
  }
  return { ...snapshot, targets };
}

function gainAt(modulators, channelId, hunger) {
  let gain = 1;
  for (const mod of modulators ?? []) {
    if (!mod.targets.includes(channelId)) continue;
    const [g0, g1] = mod.gain;
    const value = mod.range !== undefined ? hunger : 1; // every modulator here is hunger-sourced at hunger 1
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

function addInto(a, b) {
  const out = Float64Array.from(a);
  for (let i = 0; i < out.length; i++) out[i] += b[i];
  return out;
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

// Runs `ticks` LIF steps (each stepsPerTick LIF sub-steps) at a fixed drive, returns the mean approach/avoid
// group rate over the window.
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

// PRESENTATIONS trials of `drive`, rest between each; returns the mean bal over the trials.
function testOdour(net, drive, zero, stepsPerTick, groups) {
  let balSum = 0;
  for (let p = 0; p < PRESENTATIONS; p++) {
    const { rApp, rAvoid } = presentWindow(net, drive, PRESENT_TICKS, stepsPerTick, groups);
    balSum += balOf(rApp, rAvoid);
    idleWindow(net, REST_TICKS, stepsPerTick, zero);
  }
  return balSum / PRESENTATIONS;
}

// PAIRINGS pairings of odour A: 50 ticks odour alone, then 50 ticks odour + the teaching drive.
//
// Found and fixed 2026-10-20 (ADR 011): the first version of this function rested only REST_TICKS (100 ticks =
// 500 steps) between pairings, and the shuffled arm then showed the *same* large shift as the plastic arm
// (reward/punish alike, every seed) -- not a smaller one, as SC-002 needs. The cause is not periodicity:
// L12's shuffled mode (contracts/lif-v1-plasticity.md) reads the dopamine ring at a lag drawn from [1000, 4000]
// steps (200-800 ticks). With 6 pairings of A recurring every ~200 ticks, a KC's eligibility trace (tauElig 400
// steps = 80 ticks) never fully decays between pairings, so *any* lag within that 800-tick reach still lands
// inside the same "A was just presented" episode -- the shuffle can reorder *when* within the episode the
// teaching pulse is read, but never escape the episode into genuinely odour-A-free history. Jittering the rest
// period (tried first) does not change this, since the whole episode is still shorter than the max lag can
// reach past. The fix is distance, not timing: rest 1,000+ ticks (5,000+ steps) between pairings, safely
// past the 800-tick maximum lag, so a shuffled read can land in true rest instead.
const PAIRING_REST_TICKS = 1000;
const PAIRING_REST_JITTER_TICKS = 300;
function pairOdourA(net, driveA, teachDrive, zero, stepsPerTick, groups, rand) {
  for (let p = 0; p < PAIRINGS; p++) {
    presentWindow(net, driveA, TEACH_ON_AT, stepsPerTick, groups);
    presentWindow(net, addInto(driveA, teachDrive), PAIR_TICKS - TEACH_ON_AT, stepsPerTick, groups);
    idleWindow(net, PAIRING_REST_TICKS + Math.floor(rand() * PAIRING_REST_JITTER_TICKS), stepsPerTick, zero);
  }
}

// One seed's full protocol for one arm/teach combination. Returns { balNaive, balPost, balDecay } each { A, B }.
function runSeed({ graph, lifParams, seed, driveA, driveB, teachDrive, zero, tauForgetTicks, groups }) {
  const net = createNetwork(graph, lifParams, seed);
  const n = graph.neuronCount;
  idleWindow(net, WARMUP_TICKS, 1, new Float64Array(n)); // warm-up at 1 LIF step/tick, matching other probes
  const stepsPerTick = lifParams.stepsPerTick ?? 1;

  const jitterRand = createPrng(seed ^ 0x4A495454).next; // 'JITT', a stream dedicated to pairing-rest jitter

  const balNaive = { A: testOdour(net, driveA, zero, stepsPerTick, groups), B: testOdour(net, driveB, zero, stepsPerTick, groups) };
  pairOdourA(net, driveA, teachDrive, zero, stepsPerTick, groups, jitterRand);
  const balPost = { A: testOdour(net, driveA, zero, stepsPerTick, groups), B: testOdour(net, driveB, zero, stepsPerTick, groups) };
  idleWindow(net, tauForgetTicks, stepsPerTick, zero);
  const balDecay = { A: testOdour(net, driveA, zero, stepsPerTick, groups), B: testOdour(net, driveB, zero, stepsPerTick, groups) };

  return { balNaive, balPost, balDecay };
}

const ARM_NAMES = ['plastic', 'frozen', 'shuffled', 'random'];

function lifParamsFor(arm, worldLif) {
  const base = { ...worldLif, outputScale: null };
  if (arm === 'frozen') return { ...base, plasticity: null };
  if (arm === 'shuffled') return { ...base, plasticity: { dopamine: 'shuffled' } };
  return { ...base, plasticity: {} }; // plastic, random: pool mode (the default)
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
  if (args.seeds !== 'calibration' && args.seeds !== 'held-out') {
    console.error('--seeds must be "calibration" or "held-out"'); process.exit(1);
  }
  const seeds = args.seeds === 'held-out' ? f.experiment.heldOut : f.experiment.seeds;
  const arms = (args.arms ?? ARM_NAMES.join(',')).split(',');
  for (const arm of arms) if (!ARM_NAMES.includes(arm)) { console.error(`unknown arm "${arm}"`); process.exit(1); }

  const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
  const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const neurons = snapshot.manifest.neurons;

  const learningPath = f.brain.learning;
  const learningFile = JSON.parse(readFileSync(new URL(learningPath, webRoot), 'utf8'));
  parseLearning(learningFile, learningPath, { sha256 });
  const groups = resolveLearningGroups(learningFile, neurons, learningPath);

  const stepsPerTick = f.brain.stepsPerTick ?? 1;
  const worldLif = { ...f.brain.lif, stepsPerTick };
  const tauForget = (worldLif.plasticity?.tauForget) ?? 30000; // L12 default (contracts/lif-v1-plasticity.md)
  const tauForgetTicks = Math.ceil(tauForget / stepsPerTick);

  const n = snapshot.neuronCount;
  const zero = new Float64Array(n);
  const driveA = channelDrive(snapshot, 'odour:food-a', n);
  const driveB = channelDrive(snapshot, 'odour:food-b', n);
  const teachOf = { reward: channelDrive(snapshot, 'reinforcement:reward', n), punish: channelDrive(snapshot, 'reinforcement:punish', n) };

  const graphOf = (snap) => ({
    neuronCount: snap.neuronCount, offsets: snap.offsets, targets: snap.targets, weights: snap.weights,
    inputNeurons: snap.capabilities.channels.inputs.flatMap((ch) => ch.neurons),
    neuronClass: neurons.map((nr) => nr.class ?? null),
    neuronType: neurons.map((nr) => nr.type ?? null),
    learning: groups,
  });
  const graphFor = (arm) => (arm === 'random' ? graphOf(rewire(snapshot, 0xC0FFEE)) : graphOf(snapshot));

  const out = {
    snapshot: { file: f.brain.snapshot.split('/').pop(), sha256 },
    learning: learningPath.split('/').pop(),
    seeds, armsRun: arms, tauForgetTicks,
    results: {},
  };

  for (const arm of arms) {
    const graph = graphFor(arm);
    const lifParams = lifParamsFor(arm, worldLif);
    out.results[arm] = {};
    for (const teach of ['reward', 'punish']) {
      console.log(`running: arm=${arm} teach=${teach} (${seeds.length} seeds)...`);
      out.results[arm][teach] = seeds.map((seed) => ({
        seed,
        ...runSeed({
          graph, lifParams, seed, driveA, driveB, teachDrive: teachOf[teach], zero, tauForgetTicks, groups,
        }),
      }));
    }
  }

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`written: ${args.out}`);
  } else {
    console.log(JSON.stringify(out, null, 2));
  }
}

await main();
