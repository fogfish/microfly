// Calibration of the forager brain's LIF settings (ADR 003 Q5; T096; ADR 005 recalibration protocol and Annex B).
// Runs only the CALIBRATION seeds (experiment.seeds) and fixed brain-only probe seeds, never the held-out seeds. The
// chosen setting is recorded in specs/008-hungry-forager-brain/calibration.md with the reason.
//
// ADR 005 Annex B splits calibration into stages, because a behaviour-only objective rewarded a saturated network
// whose outputs ignored the senses (the 2026-10-09 pass):
//   A1 regime  brain-only, no world. Every grid point is probed with fixed sensory inputs and judged by gates on the
//              network's regime (quiet at rest, responsive to odour, not saturated) and on the raw synaptic input
//              arriving at the output neurons (lateralized steering). Raw input is the arrivals divided by the
//              edge scale, so it does not depend on outputScale: output neurons have no outgoing edges (ADR 003 D3),
//              so outputScale never changes the network, only its readout.
//   A2 readout for a point that passes A1 and whose grid neighbours mostly pass too (robustness), the per-channel
//              outputScale is fitted to a target operating point (forward, turn, backward drive at a mid odour; feed
//              by its taste contrast).
//   B  world   the fitted candidates run the forager arms on the calibration seeds (main, hungry and sated cohorts)
//              against the random walk. Brake and feed contrast are reported, not gated: the brake is a structural
//              gap left to the next brain generation (BUG-002).
//
// Usage: node scripts/calibrate-forager.mjs --stage=regime [--shard=k/n] [--json=<file>]
//        node scripts/calibrate-forager.mjs --stage=world --from=<regime.json>[,...] [--top=3] [--ticks=3000]
//                                           [--shard=k/n] [--json=<file>]
//        --axes=<json> replaces grid axes (both stages, so the world stage finds the same neighbours).
//        --shard=k/n runs every n-th setting from k (0-based), for parallel runs.

import { readFileSync, writeFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { sensoryValue } from '../public/js/fly/stimulus.js';
import { runForagerArms, armMetrics, verdicts } from './forager-arms.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const stage = arg('stage', 'regime');
const worldPath = arg('world', 'world/world-forager.json');
const ticks = Number(arg('ticks', '3000'));
const jsonPath = arg('json', null);
const top = Number(arg('top', '3'));
const [shardK, shardN] = arg('shard', '0/1').split('/').map(Number);
const webRoot = new URL('../public/', import.meta.url);
const config = JSON.parse(readFileSync(new URL(worldPath, webRoot), 'utf8'));
const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
const errors = validateConfig(expConfig);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path}: ${message}`);
  process.exit(1);
}
const f = resolveFlies(expConfig);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8')));
if (validateArt(config, catalog).length > 0) process.exit(1);
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const outputs = snapshot.capabilities.channels.outputs;
const outputIds = outputs.map((ch) => ch.id);

// The A1 grid. Each axis is ordered, so a point's neighbours are the previous and next value on each axis.
// noise is a [noiseAmplitude, noiseBulkScale] pair: off, sensory-only (L7′) at three amplitudes, and uniform at a low
// amplitude. Sensory-only noise is what gives the ORNs spontaneous firing below a sub-threshold floor: with the floor
// at τ · resting · gain(h) ≈ 0.2–0.6 and a per-step half-width a, the membrane's stationary spread is ≈ 1.8 a, so
// a ≈ 0.1–0.3 lets a few ORNs cross threshold with no odour (spontaneous, not saturated).
// stimulus is a [resting, gain] pair (ADR 005 D6). resting 0.02 keeps the no-odour floor below threshold at every
// hunger (tau × resting × g1 = 20 × 0.02 × 1.5 = 0.6 < vThreshold); at the shipped 0.05 the floor sits at threshold
// from hunger 0.5 up, and the network amplifies the resting ORN firing into its saturated state (Annex B, run 2).
// A gain below 1 keeps the odour code graded instead of driving the ORNs to their ceiling within the first tile.
const AXES = {
  synapticScale: [10, 15, 20, 30, 40, 50],
  inhibitoryScale: [1, 1.5, 2, 2.5, 3],
  noise: [[0, 1], [0.1, 0], [0.2, 0], [0.3, 0]],
  tauSyn: [0],
  stimulus: [[0.02, 0.1], [0.02, 0.25], [0.02, 1]],
};
// --axes='{"synapticScale":[10,20]}' replaces whole axes for a run; the world stage must be given the same --axes.
Object.assign(AXES, JSON.parse(arg('axes', '{}')));
// Everything else stays at the world's own values (tauAdapt 20, adaptStep 0.05, stepsPerTick 5).
const BASE_LIF = { tauAdapt: f.brain.lif?.tauAdapt ?? 0, adaptStep: f.brain.lif?.adaptStep ?? 0 };

// Brain seeds of the brain-only probes. They seed only the LIF core (jitter, noise), never a world, so they are
// neither the calibration nor the held-out world seeds.
const PROBE_SEEDS = [1, 2, 3];
const PROBE_WARMUP = 50;   // ticks discarded while the network leaves its all-zero start
const PROBE_TICKS = 150;   // ticks measured
const PROBE_HUNGER = 0.5;  // a mid hunger: the odour gain is g0 + (g1 − g0)/2 (modulators, container-v4 M1–M3)

// A1 gates (ADR 005 Annex B). Activity is the share of neurons that spike at least once in a tick.
const GATES = {
  restActivity: 0.1,      // at most: a fly sensing nothing is quiet (about 2 % of neurons per LIF step at 5 steps a
                          // tick). Was 0.05 in the first gated run: every spontaneously active point then failed it,
                          // while odourGain below already keeps rest well under the odour response (Annex B.3).
  restFloor: 0.002,       // at least: and not silent — spontaneous activity keeps the fly walking with no odour
                          // (a silent brain gives forward 0, so a fly out of odour range never moves)
  odourGain: 2,           // odour activity at least this multiple of rest activity, and at least ODOUR_FLOOR
  odourFloor: 0.02,
  odourCeiling: 0.4,      // at most: above this the 2026-10-09 grid's outputs ignored their input (finding 2)
  lateral: 0.1,           // at least: steering index toward the odour side (turn-left minus turn-right, L vs R)
  neighbours: 0.5,        // share of grid neighbours that must also pass (robustness against a jagged landscape)
};

// A2 readout targets: the drive each channel should reach at a mid odour, with no taste.
// Up to 8192: at the low synapticScale where the network is graded, the raw input reaching the 2-neuron DN pools is
// small (about 1e-4 per step), and only the readout gain can lift it to a usable drive (L6).
const READOUT_SCALES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
const TARGET = { turn: 0.3, backward: 0.05 };
const FORWARD_TARGETS = [0.3, 0.5];      // swept in stage B: walking speed trades search coverage for steering
const MOTOR_SMOOTHING = [0.05, 0.02];    // swept in stage B: the readout EMA; 2-neuron pools are shot-noise limited

// The probe inputs for one [resting, gain] pair, through the same sensoryValue mapping the world uses.
function conditions([resting, gain]) {
  const value = (intensity) => sensoryValue(intensity, gain, f.stimulus.max, resting);
  const rest = value(0);
  return {
    rest: [rest, rest, 0, 0],
    odour: [value(0.5), value(0.5), 0, 0],
    left: [value(0.8), rest, 0, 0],
    right: [rest, value(0.8), 0, 0],
    taste: [value(0.5), value(0.5), 1, 1],
  };
}
const stimulusOf = ([resting, gain]) => ({ ...f.stimulus, resting, gain });

// Runs one brain-only probe. Returns the mean activity, the mean output drives, and the mean raw input per output
// channel (arrivals over the applied edge scale, averaged over the channel's neurons).
function probe(lif, inputs, brain = {}) {
  let activity = 0;
  let samples = 0;
  const drive = new Float64Array(outputs.length);
  const raw = new Float64Array(outputs.length);
  for (const seed of PROBE_SEEDS) {
    const fly = createFlyBrain({ ...f.brain, ...brain, snapshot, version: 'v1', lif: { ...BASE_LIF, ...lif } }, seed);
    const { net } = fly;
    const values = Float32Array.from(inputs);
    for (let t = 0; t < PROBE_WARMUP + PROBE_TICKS; t++) {
      const out = fly.step({ inputs: values, hunger: PROBE_HUNGER });
      if (t < PROBE_WARMUP) continue;
      activity += out.spikes.length / fly.neuronCount;
      outputs.forEach((ch, k) => {
        drive[k] += out.outputs[k];
        let sum = 0;
        for (const j of ch.neurons) sum += net.input[j] / (net.outputOverride[j] ? net.outputScaleOf[j] : net.params.synapticScale);
        raw[k] += sum / ch.neurons.length;
      });
      samples++;
    }
  }
  const byId = (arr) => Object.fromEntries(outputIds.map((id, k) => [id, arr[k] / samples]));
  return { activity: activity / samples, drive: byId(drive), raw: byId(raw) };
}

function lifOf(point) {
  const [noiseAmplitude, noiseBulkScale] = point.noise;
  return { synapticScale: point.synapticScale, inhibitoryScale: point.inhibitoryScale, noiseAmplitude, noiseBulkScale, tauSyn: point.tauSyn };
}

// A1: the regime of one grid point.
function regime(point) {
  const lif = lifOf(point);
  const p = Object.fromEntries(Object.entries(conditions(point.stimulus)).map(([k, v]) => [k, probe(lif, v)]));
  const turn = (c) => p[c].raw['turn-left'] - p[c].raw['turn-right'];
  const turnSize = (Math.abs(p.left.raw['turn-left']) + Math.abs(p.left.raw['turn-right'])
    + Math.abs(p.right.raw['turn-left']) + Math.abs(p.right.raw['turn-right'])) / 2;
  const lateral = turnSize > 0 ? (turn('left') - turn('right')) / turnSize : 0;
  const fwd = p.odour.raw.forward;
  const brake = fwd !== 0 ? (p.taste.raw.forward - fwd) / Math.abs(fwd) : 0;
  const feedSize = Math.abs(p.taste.raw.feed) + Math.abs(p.odour.raw.feed);
  const feedContrast = feedSize > 0 ? (p.taste.raw.feed - p.odour.raw.feed) / feedSize : 0;
  const m = {
    rest: p.rest.activity, odour: p.odour.activity, lateral, forwardRaw: fwd, restForwardRaw: p.rest.raw.forward,
    brake, feedContrast,
  };
  const fails = [];
  if (!(m.rest <= GATES.restActivity)) fails.push('rest');
  if (!(m.rest >= GATES.restFloor)) fails.push('silent');
  if (!(m.restForwardRaw > 0)) fails.push('still');
  if (!(m.odour >= Math.max(GATES.odourFloor, GATES.odourGain * m.rest))) fails.push('gain');
  if (!(m.odour <= GATES.odourCeiling)) fails.push('saturated');
  if (!(m.lateral >= GATES.lateral)) fails.push('lateral');
  if (!(m.forwardRaw > 0)) fails.push('forward');
  return { point, ...m, pass: fails.length === 0, fails };
}

// A2: fits each channel's outputScale to its target with all channels scaled together (outputs do not interact).
function readout(lif, stimulus, forwardTarget) {
  const c = conditions(stimulus);
  const runs = READOUT_SCALES.map((s) => {
    const outputScale = Object.fromEntries(outputIds.map((id) => [id, s]));
    return { s, odour: probe({ ...lif, outputScale }, c.odour).drive, taste: probe({ ...lif, outputScale }, c.taste).drive };
  });
  const closest = (fn, target) => runs.reduce((a, b) => (Math.abs(fn(b) - target) < Math.abs(fn(a) - target) ? b : a)).s;
  const scale = {
    forward: closest((r) => r.odour.forward, forwardTarget),
    backward: closest((r) => r.odour.backward, TARGET.backward),
  };
  const turn = closest((r) => (r.odour['turn-left'] + r.odour['turn-right']) / 2, TARGET.turn);
  scale['turn-left'] = turn;
  scale['turn-right'] = turn;
  // feed: the largest taste contrast that keeps feed below threshold without taste; with no contrast anywhere,
  // the largest scale that keeps feed under half the threshold without taste (a silent, not a saturated, feed).
  const below = runs.filter((r) => r.odour.feed < f.food.feedThreshold);
  const best = below.reduce((a, b) => (b.taste.feed - b.odour.feed > a.taste.feed - a.odour.feed ? b : a), below[0] ?? runs[0]);
  scale.feed = best.taste.feed - best.odour.feed >= 0.05
    ? best.s
    : (runs.filter((r) => r.odour.feed <= f.food.feedThreshold / 2).at(-1) ?? runs[0]).s;
  const at = (id) => runs.find((r) => r.s === scale[id]);
  return {
    outputScale: scale,
    drives: Object.fromEntries(outputIds.map((id) => [id, { odour: at(id).odour[id], taste: at(id).taste[id] }])),
  };
}

const keyOf = (point) => JSON.stringify(point);
const fmt = (v, d = 3) => (v === null || v === undefined ? '-' : Number(v).toFixed(d));

if (stage === 'regime') {
  const grid = [];
  for (const synapticScale of AXES.synapticScale) for (const inhibitoryScale of AXES.inhibitoryScale) {
    for (const noise of AXES.noise) for (const tauSyn of AXES.tauSyn) for (const stimulus of AXES.stimulus) {
      grid.push({ synapticScale, inhibitoryScale, noise, tauSyn, stimulus });
    }
  }
  const rows = [];
  console.log(`A1 regime on probe seeds ${PROBE_SEEDS.join(', ')} (${PROBE_TICKS} ticks after ${PROBE_WARMUP} warm-up)`);
  console.log('scale  inh  noise  bulk tauSyn rest  gain |  rest  odour lateral fwdRaw restFwd  brake feedC | verdict');
  for (const [index, point] of grid.entries()) {
    if (index % shardN !== shardK) continue;
    const r = regime(point);
    rows.push(r);
    console.log(`${String(point.synapticScale).padStart(5)} ${String(point.inhibitoryScale).padStart(4)} ${String(point.noise[0]).padStart(6)} `
      + `${String(point.noise[1]).padStart(5)} ${String(point.tauSyn).padStart(6)} ${String(point.stimulus[0]).padStart(4)} `
      + `${String(point.stimulus[1]).padStart(5)} | ${fmt(r.rest)} ${fmt(r.odour)} ${fmt(r.lateral).padStart(7)} `
      + `${fmt(r.forwardRaw, 4).padStart(6)} ${fmt(r.restForwardRaw, 4).padStart(7)} ${fmt(r.brake).padStart(6)} ${fmt(r.feedContrast).padStart(5)} | ${r.pass ? 'PASS' : r.fails.join(',')}`);
  }
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ stage, axes: AXES, gates: GATES, rows }, null, 2)}\n`);
} else if (stage === 'world') {
  const rows = arg('from', '').split(',').filter(Boolean).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
  const byKey = new Map(rows.map((r) => [keyOf(r.point), r]));
  // Robustness: the share of a point's axis neighbours (previous and next value on each axis) that also pass.
  const neighbours = (point) => Object.entries(AXES).flatMap(([axis, values]) => {
    const i = values.findIndex((v) => keyOf(v) === keyOf(point[axis]));
    return [values[i - 1], values[i + 1]].filter((v) => v !== undefined).map((v) => byKey.get(keyOf({ ...point, [axis]: v })));
  }).filter(Boolean);
  const robust = rows.filter((r) => r.pass).map((r) => {
    const n = neighbours(r.point);
    return { ...r, robustness: n.filter((x) => x.pass).length / n.length };
  }).filter((r) => r.robustness >= GATES.neighbours)
    .sort((a, b) => b.robustness - a.robustness || b.lateral - a.lateral);
  console.log(`A1: ${rows.filter((r) => r.pass).length}/${rows.length} pass, ${robust.length} robust; taking the top ${top}`);
  const candidates = [];
  for (const r of robust.slice(0, top)) {
    for (const forwardTarget of FORWARD_TARGETS) for (const motorSmoothing of MOTOR_SMOOTHING) {
      candidates.push({ regime: r, forwardTarget, motorSmoothing });
    }
  }
  const base = armMetrics(['baseline'], runForagerArms({
    f, world, expConfig, snapshot, arms: ['baseline'], seeds: f.experiment.seeds, ticks, capabilities: snapshot.capabilities,
  }), f.stimulus.radius, 1).baseline;
  console.log(`B on calibration seeds ${f.experiment.seeds.join(', ')}, ${ticks} ticks; random-walk find ${fmt(base.find.rate * 100, 1)} %`);
  const out = [];
  for (const [index, c] of candidates.entries()) {
    if (index % shardN !== shardK) continue;
    const lif = { ...f.brain.lif, ...BASE_LIF, ...lifOf(c.regime.point) };
    const { outputScale, drives } = readout(lif, c.regime.point.stimulus, c.forwardTarget);
    const fRun = {
      ...f,
      stimulus: stimulusOf(c.regime.point.stimulus),
      brain: { ...f.brain, motorSmoothing: c.motorSmoothing, lif: { ...lif, outputScale } },
    };
    const metrics = armMetrics(['v1'], runForagerArms({
      f: fRun, world, expConfig, snapshot, arms: ['v1'], seeds: f.experiment.seeds, ticks, capabilities: snapshot.capabilities,
    }), f.stimulus.radius, 1);
    metrics.baseline = base;
    const v = verdicts(metrics);
    out.push({ ...c, lif: fRun.brain.lif, stimulus: fRun.stimulus, drives, metrics: metrics.v1, verdicts: v });
    console.log(`${JSON.stringify(lifOf(c.regime.point))} stimulus ${JSON.stringify(c.regime.point.stimulus)} fwd ${c.forwardTarget} `
      + `ms ${c.motorSmoothing} out ${JSON.stringify(outputScale)}`);
    console.log(`  find ${fmt(metrics.v1.find.rate * 100, 1)} % | eat hungry/sated ${metrics.v1.eatHungry ?? '-'}/${metrics.v1.eatSated ?? '-'} `
      + `| hunger dep ${fmt((metrics.v1.hungerDependence ?? 0) * 100, 1)} % | ${v.filter((x) => x.pass !== null).map((x) => `${x.metric}:${x.pass ? 'PASS' : 'FAIL'}`).join(' ')}`
      + ` | brake ${fmt(c.regime.brake)} feedC ${fmt(c.regime.feedContrast)}`);
  }
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ stage, seeds: f.experiment.seeds, ticks, baseline: base, rows: out }, null, 2)}\n`);
} else {
  console.error(`--stage must be "regime" or "world", got "${stage}"`);
  process.exit(1);
}
