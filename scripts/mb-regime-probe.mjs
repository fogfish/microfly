// The mushroom-body regime gate (ADR 011, FR-006/FR-008, research.md §2). Brain-only: no world simulation, no
// decoder — it reads the world config only for flies.brain.{snapshot,lif,stepsPerTick} and experiment.seeds/
// heldOut, then drives the raw LIF core directly so it can count true per-step KC spikes (lif-v1.js's own
// step() returns a per-tick union, which loses the count this gate needs).
//
// Usage: node scripts/mb-regime-probe.mjs --world=world/world-forager-learning.json --seeds=calibration
//   --out=specs/019-mb-valence-learning/regime-gate.json [--pathway-gain='{"routes":[...],...}']
//   [--lif='{"synapticScale":5,...}']
// --lif merges over the world's own LIF block (calibration only); --pathway-gain replaces the world's pathwayGain.
//
// Protocol (research.md §2): 400-tick warm-up, no input. Then 10 trials per odour, alternating A, B, "none":
// 100 ticks of odour at channel-max value on both channels of the pair, then 200 ticks of rest. Hunger fixed at
// 1. A KC is active in a trial when its spike count in the 100-tick window exceeds its own seed's mean "none"-
// window count by >= 2 spikes AND by >= 2 SD (both, same seed's 10 "none" trials as the reference).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createNetwork, step as lifStep } from '../public/js/brain/lif-v1.js';
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
const ODOUR_TICKS = 100;
const REST_TICKS = 200;
const TRIALS_PER_ODOUR = 10;

// A size-matched random graph: each neuron keeps its out-edges and their weights, targets redrawn uniformly
// (scripts/forager-arms.mjs's own rewire, duplicated here to keep this script brain-only/dependency-free of
// the world-building machinery forager-arms.mjs also imports).
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

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function sd(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
// Pearson correlation; 0 when either vector has no variance (degenerate, e.g. an all-zero mean vector).
function pearson(a, b) {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  return (da === 0 || db === 0) ? 0 : num / Math.sqrt(da * db);
}

// The per-pair channel neuron indices (both sides), from the declared capabilities (decoder.js's pairOf
// convention: a channel id's "-left"/"-right" suffix stripped gives its pair/sense name).
function pairNeurons(capabilities, sense) {
  const neurons = [];
  for (const ch of capabilities.channels.inputs) if (ch.sense === sense) neurons.push(...ch.neurons);
  return neurons;
}

// At hunger 1, every modulator's value is 1 (the "hunger" range modulator reads hunger directly; any modulator
// chained from it inherits that), so a channel's gain is the product of every targeting modulator's upper
// bound g1 (fly-brain-v1.js's channelGains, specialised to the fixed hunger=1 this gate always uses).
function gainAtHunger1(modulators, channelId) {
  let gain = 1;
  for (const mod of modulators ?? []) if (mod.targets.includes(channelId)) gain *= mod.gain[1];
  return gain;
}

// Drives `graph` for one seed's full protocol. Returns { noneCounts: Float64Array(nKC)[10], aCounts: [...],
// bCounts: [...] } — each a list of 10 per-trial KC spike-count vectors, in trial order.
function runSeed(graph, lifParams, seed, kcIndex, driveFor, stepsPerTick) {
  const net = createNetwork(graph, lifParams, seed);
  const n = graph.neuronCount;
  const zero = new Float64Array(n);
  for (let t = 0; t < WARMUP_TICKS; t++) for (let s = 0; s < stepsPerTick; s++) lifStep(net, zero);

  const order = [];
  for (let i = 0; i < TRIALS_PER_ODOUR; i++) order.push('A', 'B', 'none');

  const counts = { A: [], B: [], none: [] };
  for (const odour of order) {
    const drive = odour === 'none' ? zero : driveFor(odour);
    const kcCount = new Float64Array(kcIndex.length);
    for (let t = 0; t < ODOUR_TICKS; t++) {
      for (let s = 0; s < stepsPerTick; s++) {
        lifStep(net, drive);
        kcIndex.forEach((idx, k) => { kcCount[k] += net.spikes[idx]; });
      }
    }
    counts[odour].push(kcCount);
    for (let t = 0; t < REST_TICKS; t++) for (let s = 0; s < stepsPerTick; s++) lifStep(net, zero);
  }
  return counts;
}

// perOdour measures (research.md §2) from the pooled trials of every seed. nKC: Kenyon-cell count.
function measure(allCounts, nKC) {
  // Per seed: the "none" reference (mean, SD per KC), then each A/B trial's binary active vector and raw counts.
  const activeVectors = { A: [], B: [] };
  const rawCounts = { A: [], B: [] };
  for (const seedCounts of allCounts) {
    const noneByKc = Array.from({ length: nKC }, (_, k) => seedCounts.none.map((v) => v[k]));
    const noneMean = noneByKc.map(mean);
    const noneSd = noneByKc.map(sd);
    for (const odour of ['A', 'B']) {
      for (const trial of seedCounts[odour]) {
        const active = new Uint8Array(nKC);
        for (let k = 0; k < nKC; k++) {
          const rise = trial[k] - noneMean[k];
          active[k] = (rise >= 2 && rise >= 2 * noneSd[k]) ? 1 : 0;
        }
        activeVectors[odour].push(active);
        rawCounts[odour].push(trial);
      }
    }
  }

  const activeFraction = {};
  const reliability = {};
  const meanVector = {};
  const meanRate = {};
  for (const odour of ['A', 'B']) {
    const fractions = activeVectors[odour].map((v) => v.reduce((a, b) => a + b, 0) / nKC);
    activeFraction[odour] = { mean: mean(fractions), min: Math.min(...fractions), max: Math.max(...fractions) };

    const pairs = [];
    const vecs = activeVectors[odour];
    for (let i = 0; i < vecs.length; i++) for (let j = i + 1; j < vecs.length; j++) pairs.push(pearson(vecs[i], vecs[j]));
    reliability[odour] = pairs.length ? mean(pairs) : null;

    meanVector[odour] = Array.from({ length: nKC }, (_, k) => mean(vecs.map((v) => v[k])));
    meanRate[odour] = Array.from({ length: nKC }, (_, k) => mean(rawCounts[odour].map((v) => v[k])));
  }

  return {
    perOdour: { A: { activeFraction: activeFraction.A, reliability: reliability.A },
                B: { activeFraction: activeFraction.B, reliability: reliability.B } },
    overlapAB: pearson(meanVector.A, meanVector.B),
    rateCorrelationAB: pearson(meanRate.A, meanRate.B),
  };
}

// FR-006 pass targets. Same-odour reliability was 0.9 until ADR 011 D41 relaxed it to 0.85.
const ACTIVE_MIN = 0.05;
const ACTIVE_MAX = 0.15;
const RELIABILITY_MIN = 0.85;
const OVERLAP_MAX = 0.7;

function verdictOf(result) {
  const targets = (m) => m.activeFraction.mean >= ACTIVE_MIN && m.activeFraction.mean <= ACTIVE_MAX
    && m.reliability > RELIABILITY_MIN;
  return (targets(result.perOdour.A) && targets(result.perOdour.B) && result.overlapAB < OVERLAP_MAX) ? 'pass' : 'fail';
}

function pct(x) { return `${(x * 100).toFixed(1)}%`; }
function fmt(x) { return x === null ? 'n/a' : x.toFixed(3); }

function regimeGateMarkdown(out, label) {
  const row = (name, m) => `| ${name} | ${pct(m.activeFraction.mean)} [${pct(m.activeFraction.min)}, ${pct(m.activeFraction.max)}] | ${fmt(m.reliability)} |`;
  return [
    `# Regime gate: ${label}`,
    '',
    `Snapshot: \`${out.snapshot.file}\` (sha256 \`${out.snapshot.sha256}\`). Seeds: ${out.seeds.join(', ')}.`,
    `LIF: \`${JSON.stringify(out.lif)}\`.`,
    '',
    '| Odour | Active fraction (mean [min, max]) | Same-odour reliability |',
    '| --- | --- | --- |',
    row('A (fruit)', out.perOdour.A),
    row('B (floral)', out.perOdour.B),
    '',
    `A-B overlap (Pearson of mean vectors): ${fmt(out.overlapAB)} (target < 0.7)`,
    `Rate-vector correlation (secondary): ${fmt(out.rateCorrelationAB)}`,
    '',
    `Targets (research.md §2, FR-006, ADR 011 D41): active fraction ${ACTIVE_MIN * 100}-${ACTIVE_MAX * 100}% per odour, ` +
      `same-odour reliability > ${RELIABILITY_MIN}, A-B overlap < ${OVERLAP_MAX}.`,
    '',
    `**Verdict: ${out.verdict.toUpperCase()}**`,
    '',
    out.remedy ? `## Remedy tried\n\n\`${JSON.stringify(out.remedy.pathwayGain)}\`\n\nResult: ${out.remedy.verdict.toUpperCase()}\n` : '',
    '## Matched random graph (reported, not gated)',
    '',
    '| Odour | Active fraction (mean [min, max]) | Same-odour reliability |',
    '| --- | --- | --- |',
    row('A (fruit)', out.randomGraph.perOdour.A),
    row('B (floral)', out.randomGraph.perOdour.B),
    '',
    `A-B overlap: ${fmt(out.randomGraph.overlapAB)}. Rate-vector correlation: ${fmt(out.randomGraph.rateCorrelationAB)}.`,
    '',
  ].join('\n');
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

  const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
  const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const neurons = snapshot.manifest.neurons;
  const kcIndex = [];
  neurons.forEach((nr, i) => { if (nr.class === 'Kenyon_Cell') kcIndex.push(i); });
  if (kcIndex.length === 0) { console.error('snapshot declares no Kenyon_Cell neurons'); process.exit(1); }

  const stepsPerTick = f.brain.stepsPerTick ?? 1;
  const lifOverrides = args.lif ? JSON.parse(args.lif) : {};
  const worldLif = { ...f.brain.lif, ...lifOverrides };
  const pathwayGain = args['pathway-gain'] ? JSON.parse(args['pathway-gain']) : (worldLif.pathwayGain ?? null);
  // outputScale (L6) only scales edges into output-pool neurons, which are sinks with no outgoing edges
  // (selection_class_seed.py's "outputs as sinks" rule) — it cannot affect KC spike counts. Dropped here so
  // this brain-only probe does not need to pass graph.outputChannels/outputNeurons at all.
  const lifParams = { ...worldLif, outputScale: null, pathwayGain };

  const aChannels = snapshot.capabilities.channels.inputs.filter((ch) => ch.sense === 'odour:food-a');
  const bChannels = snapshot.capabilities.channels.inputs.filter((ch) => ch.sense === 'odour:food-b');
  if (aChannels.length === 0 || bChannels.length === 0) {
    console.error('snapshot declares no odour:food-a/odour:food-b channels'); process.exit(1);
  }
  const driveFor = (graphNeuronCount) => (odour) => {
    const drive = new Float64Array(graphNeuronCount);
    const channels = odour === 'A' ? aChannels : bChannels;
    for (const ch of channels) {
      const value = Math.min(ch.range[1], gainAtHunger1(snapshot.modulators, ch.id) * 1);
      for (const idx of ch.neurons) drive[idx] = value;
    }
    return drive;
  };

  // The graph as fly-brain-v1.js builds it. BUG (ADR 011 D40): the first gate run left out inputNeurons, so with
  // noiseBulkScale 0 every neuron got zero noise and the gate measured a noise-free brain the fly never runs.
  const graphOf = (snap) => ({
    neuronCount: snap.neuronCount, offsets: snap.offsets, targets: snap.targets, weights: snap.weights,
    inputNeurons: snap.capabilities.channels.inputs.flatMap((ch) => ch.neurons),
    neuronClass: neurons.map((nr) => nr.class ?? null),
    neuronType: neurons.map((nr) => nr.type ?? null),
  });

  function runArm(snap) {
    const graph = graphOf(snap);
    const drive = driveFor(graph.neuronCount);
    const allCounts = seeds.map((seed) => runSeed(graph, lifParams, seed, kcIndex, drive, stepsPerTick));
    return measure(allCounts, kcIndex.length);
  }

  console.log(`mb-regime-probe: ${args.world}, seeds ${args.seeds} (${seeds.join(',')}), ${kcIndex.length} KCs, ` +
    `${WARMUP_TICKS} warm-up + ${TRIALS_PER_ODOUR * 3} trials x ${ODOUR_TICKS + REST_TICKS} ticks, stepsPerTick=${stepsPerTick}`);
  console.log('running the real brain...');
  const brainResult = runArm(snapshot);
  console.log('running the matched random graph (reported, not gated)...');
  const randomResult = runArm(rewire(snapshot, 0xC0FFEE));

  const verdict = verdictOf(brainResult);
  const out = {
    snapshot: { file: f.brain.snapshot.split('/').pop(), sha256 },
    lif: lifParams,
    seeds,
    perOdour: brainResult.perOdour,
    overlapAB: brainResult.overlapAB,
    rateCorrelationAB: brainResult.rateCorrelationAB,
    verdict,
    remedy: null,
    randomGraph: { perOdour: randomResult.perOdour, overlapAB: randomResult.overlapAB, rateCorrelationAB: randomResult.rateCorrelationAB },
  };

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(out, null, 2)}\n`);
    const mdPath = args.out.replace(/\.json$/, '.md');
    writeFileSync(mdPath, regimeGateMarkdown(out, `${args.world}, ${args.seeds} seeds`));
    console.log(`written: ${args.out}, ${mdPath}`);
  }
  console.log(JSON.stringify(out, null, 2));
  console.log(`verdict: ${verdict}`);
}

await main();
