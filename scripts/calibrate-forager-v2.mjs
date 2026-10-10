// Calibration of the 15K cautious forager brain's LIF settings (ADR 006 L11, "Calibration protocol"; T supersedes
// scripts/calibrate-forager.mjs for v2, which is hard-coded to v1's 4-channel declaration and version). Runs only
// the CALIBRATION seeds (experiment.seeds) and fixed brain-only probe seeds, never the held-out seeds. The chosen
// setting is recorded in specs/013-forager-brain-15k-lif-v2/calibration.md with the reason (AGENTS.md: a behaviour
// failure is a finding, the fix is config, recorded with the run).
//
// Same staged split as ADR 005 Annex B / calibrate-forager.mjs, with ADR 006's three changes:
//   A1 regime  brain-only, no world. Every grid point is probed with fixed sensory inputs (built generically from
//              the snapshot's declared sense/side, not a hard-coded 4-channel vector) and judged by **per-group**
//              gates (L10: input/output/al/vnc/dn/central) — rest activity in [0.002, 0.1] in every group, odour
//              response above rest in al and central — plus two new gates on the raw synaptic input reaching the
//              output neurons: brake (mouth taste lowers raw forward) and feed (mouth taste raises raw feed above
//              its odour-only value). Lateral steering contrast is measured and reported, not gated (not in ADR
//              006's stated A1 list).
//   A2 readout for a point that passes A1 and whose grid neighbours mostly pass too (robustness), outputScale is
//              fitted per channel to a target operating point, exactly as the v1 script's A2 (output neurons have
//              no outgoing edges, so outputScale never changes the network, only its readout).
//   B  world   the fitted candidates run the v2 arm (scripts/forager-arms.mjs's runV2Cohort) on the calibration
//              seeds against the random walk. Brake/feed/rest are reported, not gated (ADR 006 FR-028); only SC-007
//              (brake < 1 and lower than the random-graph arm's, on HELD-OUT seeds, a separate step) is a pass/fail.
//
// Usage: node scripts/calibrate-forager-v2.mjs --stage=regime [--shard=k/n] [--json=<file>]
//        node scripts/calibrate-forager-v2.mjs --stage=world --from=<regime.json>[,...] [--top=3] [--ticks=3000]
//                                              [--shard=k/n] [--json=<file>]
//        --axes=<json> replaces grid axes (both stages, so the world stage finds the same neighbours).
//        --world=<path> defaults to world/world-forager-15k.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { REGIONS } from '../public/js/ui/panel/counts.js';
import { runForagerArms, armMetrics, regionTotals, regionFractionsOf } from './forager-arms.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const stage = arg('stage', 'regime');
const worldPath = arg('world', 'world/world-forager-15k.json');
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
const capabilities = snapshot.capabilities;
const inputs = capabilities.channels.inputs;
const outputs = capabilities.channels.outputs;
const outputIds = outputs.map((ch) => ch.id);
const groupOf = snapshot.manifest.neurons.map((n) => n.group);
const regionSizes = regionTotals(snapshot);

// ADR 006 L11's starting point, and its own stated grid, centred on it: synapticScale ×{0.5, 1, 2, 4},
// tauSyn {2, 5}, input.rate[1] {0.08, 0.15, 0.3}, stepsPerTick {5, 10}. `rate[0]` and `weight` stay at L11's shipped
// values (0.005, 1.2) — not part of ADR 006's stated axes. Gate B calibrates the shipped `weightRule: synapseCount`
// first (the second arm, `postFractionAbsolute`, needs a second extraction and is left to a later round).
const L11 = { dt: 1, tau: 20, refractorySteps: 2, tauSyn: 5, synapticScale: 0.04 };
const AXES = {
  synapticScale: [0.02, 0.04, 0.08, 0.16],
  tauSyn: [2, 5],
  inputRateHigh: [0.08, 0.15, 0.3],
  stepsPerTick: [5, 10],
  // L10, gated by evidence (ADR 006): a group whose own rest fails while others pass gets its own gain, instead
  // of searching the other four axes for a uniform scale that cannot separate one region's regime from the rest.
  // {} (no override) is round 1's default; a round motivated by a specific failing group names it explicitly via
  // --axes, e.g. '{"groupGain":[{},{"al":0.1},{"al":0.2}]}'.
  groupGain: [{}],
};
Object.assign(AXES, JSON.parse(arg('axes', '{}')));

const PROBE_SEEDS = [1, 2, 3];
const PROBE_WARMUP = 50;
const PROBE_TICKS = 150;
const PROBE_HUNGER = 0.5;

// A1 gates (ADR 006 "Calibration protocol", per group L10). restCeiling relaxed the same way ADR 005 Annex B.3
// relaxed it for v1 (0.05 -> 0.1) if round 1 finds nothing — kept at ADR 006's stated 0.1 until measured otherwise.
const GATES = {
  restFloor: 0.002,
  restCeiling: 0.1,
  odourGroups: ['al', 'central'],
  odourGain: 1.2,     // odour activity at least this multiple of rest activity, in each of odourGroups
  neighbours: 0.5,
};

const READOUT_SCALES = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
const TARGET = { turnLeft: 0.3, turnRight: 0.3, backward: 0.05 };
const FORWARD_TARGETS = [0.3, 0.5];
const MOTOR_SMOOTHING = [0.05, 0.02];

// A sense/side-keyed input vector, built generically from the snapshot's declared channels (ADR 006 W6) instead
// of a hard-coded 4-value layout (the structural reason this script exists separately from v1's).
function vectorOf(assign) {
  const v = new Float32Array(inputs.length);
  inputs.forEach((ch, k) => { v[k] = assign(ch) ?? 0; });
  return v;
}
const conditions = {
  rest: vectorOf(() => 0),
  odour: vectorOf((ch) => (ch.sense === 'odour:food' ? 0.5 : 0)),
  left: vectorOf((ch) => (ch.sense === 'odour:food' && ch.side === 'L' ? 0.8 : 0)),
  right: vectorOf((ch) => (ch.sense === 'odour:food' && ch.side === 'R' ? 0.8 : 0)),
  taste: vectorOf((ch) => (ch.sense === 'taste:mouth' ? 0.5 : 0)),
};

// Runs one brain-only probe. Returns per-group activity, per-output drive, and per-output raw synaptic input
// (arrivals over the applied edge scale — groupScaleOf for a non-output target, outputScaleOf for an output one).
function probe(brainOverrides, values) {
  const activity = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  let samples = 0;
  const drive = new Float64Array(outputs.length);
  const raw = new Float64Array(outputs.length);
  for (const seed of PROBE_SEEDS) {
    const brain = createFlyBrain({ ...f.brain, ...brainOverrides, snapshot, version: 'v2' }, seed);
    const { net } = brain;
    for (let t = 0; t < PROBE_WARMUP + PROBE_TICKS; t++) {
      const out = brain.step({ inputs: values, hunger: PROBE_HUNGER });
      if (t < PROBE_WARMUP) continue;
      const frac = regionFractionsOf(out.spikes, regionSizes, groupOf);
      for (const r of REGIONS) activity[r] += frac[r] ?? 0;
      outputs.forEach((ch, k) => {
        drive[k] += out.outputs[k];
        let sum = 0;
        for (const j of ch.neurons) {
          const scale = net.outputOverride[j] ? net.outputScaleOf[j] : net.groupScaleOf[j] * net.params.synapticScale;
          sum += net.input[j] / scale;
        }
        raw[k] += sum / ch.neurons.length;
      });
      samples++;
    }
  }
  const byId = (arr) => Object.fromEntries(outputIds.map((id, k) => [id, arr[k] / samples]));
  for (const r of REGIONS) activity[r] /= samples;
  return { activity, drive: byId(drive), raw: byId(raw) };
}

function brainOf(point) {
  return {
    lif: { ...L11, synapticScale: point.synapticScale, tauSyn: point.tauSyn, groupGain: point.groupGain ?? {} },
    stepsPerTick: point.stepsPerTick,
    input: { encoding: 'poisson', rate: [0.005, point.inputRateHigh], weight: 1.2 },
  };
}

// A1: the regime of one grid point, against ADR 006's per-group gates.
function regime(point) {
  const brain = brainOf(point);
  const p = Object.fromEntries(Object.entries(conditions).map(([k, v]) => [k, probe(brain, v)]));
  const turn = (c) => p[c].raw['turn-left'] - p[c].raw['turn-right'];
  const turnSize = (Math.abs(p.left.raw['turn-left']) + Math.abs(p.left.raw['turn-right'])
    + Math.abs(p.right.raw['turn-left']) + Math.abs(p.right.raw['turn-right'])) / 2;
  const lateral = turnSize > 0 ? (turn('left') - turn('right')) / turnSize : 0;
  const fwd = p.odour.raw.forward;
  const brake = fwd !== 0 ? (p.taste.raw.forward - fwd) / Math.abs(fwd) : 0;
  const feedSize = Math.abs(p.taste.raw.feed) + Math.abs(p.odour.raw.feed);
  const feedContrast = feedSize > 0 ? (p.taste.raw.feed - p.odour.raw.feed) / feedSize : 0;
  const fails = [];
  for (const r of REGIONS) {
    if (regionSizes[r] === 0) continue;
    const rest = p.rest.activity[r];
    if (!(rest >= GATES.restFloor)) fails.push(`silent:${r}`);
    if (!(rest <= GATES.restCeiling)) fails.push(`ignited:${r}`);
  }
  for (const r of GATES.odourGroups) {
    if (regionSizes[r] === 0) continue;
    if (!(p.odour.activity[r] >= GATES.odourGain * p.rest.activity[r])) fails.push(`gain:${r}`);
  }
  if (!(brake < 0)) fails.push('brake');
  if (!(feedContrast > 0)) fails.push('feed');
  return {
    point, rest: p.rest.activity, odour: p.odour.activity, lateral, forwardRaw: fwd, brake, feedContrast,
    pass: fails.length === 0, fails,
  };
}

// A2: fits each channel's outputScale to its target (odour drive and taste/odour feed contrast), same structure
// as the v1 script's readout().
function readout(brain, forwardTarget) {
  const runs = READOUT_SCALES.map((s) => {
    const outputScale = Object.fromEntries(outputIds.map((id) => [id, s]));
    const b = { ...brain, lif: { ...brain.lif, outputScale } };
    return { s, odour: probe(b, conditions.odour).drive, taste: probe(b, conditions.taste).drive };
  });
  const closest = (fn, target) => runs.reduce((a, b) => (Math.abs(fn(b) - target) < Math.abs(fn(a) - target) ? b : a)).s;
  const scale = {
    forward: closest((r) => r.odour.forward, forwardTarget),
    backward: closest((r) => r.odour.backward, TARGET.backward),
    'turn-left': closest((r) => r.odour['turn-left'], TARGET.turnLeft),
    'turn-right': closest((r) => r.odour['turn-right'], TARGET.turnRight),
  };
  const below = runs.filter((r) => r.odour.feed < f.food.feedThreshold);
  const best = below.reduce((a, b) => (b.taste.feed - b.odour.feed > a.taste.feed - a.odour.feed ? b : a), below[0] ?? runs[0]);
  scale.feed = best.taste.feed - best.odour.feed >= 0.05
    ? best.s
    : (runs.filter((r) => r.odour.feed <= f.food.feedThreshold / 2).at(-1) ?? runs[0]).s;
  scale.escape = scale.feed; // no probe condition drives escape; carried at the same scale as feed, reviewed in B
  const at = (id) => runs.find((r) => r.s === scale[id]);
  return {
    outputScale: scale,
    drives: Object.fromEntries(outputIds.map((id) => [id, { odour: at(id).odour[id], taste: at(id).taste[id] }])),
  };
}

const keyOf = (point) => JSON.stringify(point);
const fmt = (v, d = 3) => (v === null || v === undefined ? '-' : Number(v).toFixed(d));
const regionCols = (activity) => REGIONS.filter((r) => regionSizes[r] > 0).map((r) => `${r}=${fmt(activity[r])}`).join(' ');

if (stage === 'regime') {
  const grid = [];
  for (const synapticScale of AXES.synapticScale) for (const tauSyn of AXES.tauSyn) {
    for (const inputRateHigh of AXES.inputRateHigh) for (const stepsPerTick of AXES.stepsPerTick) {
      for (const groupGain of AXES.groupGain) grid.push({ synapticScale, tauSyn, inputRateHigh, stepsPerTick, groupGain });
    }
  }
  const rows = [];
  console.log(`A1 regime (v2, 15K) on probe seeds ${PROBE_SEEDS.join(', ')} (${PROBE_TICKS} ticks after ${PROBE_WARMUP} warm-up), ${grid.length} points`);
  for (const [index, point] of grid.entries()) {
    if (index % shardN !== shardK) continue;
    const t0 = Date.now();
    const r = regime(point);
    rows.push(r);
    console.log(`scale=${point.synapticScale} tauSyn=${point.tauSyn} rateHi=${point.inputRateHigh} steps=${point.stepsPerTick} `
      + `| rest[${regionCols(r.rest)}] odour[${regionCols(r.odour)}] lateral=${fmt(r.lateral)} fwdRaw=${fmt(r.forwardRaw, 5)} `
      + `brake=${fmt(r.brake)} feedC=${fmt(r.feedContrast)} | ${r.pass ? 'PASS' : r.fails.join(',')} (${Date.now() - t0}ms)`);
  }
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ stage, axes: AXES, gates: GATES, rows }, null, 2)}\n`);
} else if (stage === 'world') {
  const rows = arg('from', '').split(',').filter(Boolean).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
  const byKey = new Map(rows.map((r) => [keyOf(r.point), r]));
  const neighbours = (point) => Object.entries(AXES).flatMap(([axis, values]) => {
    const i = values.findIndex((v) => v === point[axis]);
    return [values[i - 1], values[i + 1]].filter((v) => v !== undefined).map((v) => byKey.get(keyOf({ ...point, [axis]: v })));
  }).filter(Boolean);
  const robust = rows.filter((r) => r.pass).map((r) => {
    const n = neighbours(r.point);
    return { ...r, robustness: n.length ? n.filter((x) => x.pass).length / n.length : 0 };
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
    f, world, expConfig, snapshot, arms: ['baseline'], seeds: f.experiment.seeds, ticks, capabilities,
  }), f.stimuli?.['odour:food']?.radius ?? 6, 1).baseline;
  console.log(`B on calibration seeds ${f.experiment.seeds.join(', ')}, ${ticks} ticks; random-walk find ${fmt(base.find.rate * 100, 1)} %`);
  const out = [];
  for (const [index, c] of candidates.entries()) {
    if (index % shardN !== shardK) continue;
    const brain = brainOf(c.regime.point);
    const { outputScale, drives } = readout(brain, c.forwardTarget);
    const fRun = { ...f, brain: { ...f.brain, ...brain, motorSmoothing: c.motorSmoothing, lif: { ...brain.lif, outputScale } } };
    const metrics = armMetrics(['v2'], runForagerArms({
      f: fRun, world, expConfig, snapshot, arms: ['v2'], seeds: f.experiment.seeds, ticks, capabilities,
    }), f.stimuli?.['odour:food']?.radius ?? 6, 1);
    metrics.baseline = base;
    out.push({ ...c, brain: fRun.brain, drives, metrics: metrics.v2 });
    console.log(`${JSON.stringify(brainOf(c.regime.point))} fwd=${c.forwardTarget} ms=${c.motorSmoothing} out=${JSON.stringify(outputScale)}`);
    console.log(`  find ${fmt(metrics.v2.find.rate * 100, 1)} % | walked ${fmt((metrics.v2.walked ?? 0) * 100, 1)} % `
      + `| brake ${fmt(c.regime.brake)} feedC ${fmt(c.regime.feedContrast)}`);
  }
  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ stage, seeds: f.experiment.seeds, ticks, baseline: base, rows: out }, null, 2)}\n`);
} else {
  console.error(`--stage must be "regime" or "world", got "${stage}"`);
  process.exit(1);
}
