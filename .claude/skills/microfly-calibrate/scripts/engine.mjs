// Generic, version-agnostic calibration engine behind the microfly-calibrate skill. A "profile" (profiles/v*.mjs)
// supplies everything version-specific (world/snapshot paths, grid axes, gates, how to build a brain config and a
// probe input vector from a grid point); this file supplies the staged A1/A2/B procedure itself (ADR 005 Annex B,
// generalised by ADR 006's "Calibration protocol" to per-group gates), so a new brain generation is a new profile,
// not a new copy of this file.
//
// Stages:
//   regime   A1, brain-only: gate each grid point's per-region rest/odour/brake/feed behaviour. Cheap (seconds to
//            low minutes per point) — safe to run interactively.
//   classify derives, from a 1-axis scale scan (phase 0), which regions never leave their rest-ceiling gate across
//            the whole tested range ("stuck") vs. which do ("scale-sensitive") — the rule that replaces a human
//            reading the table and proposing a groupGain axis by hand.
//   world    B, on calibration seeds only (never held-out — enforced below). Expensive (minutes per candidate);
//            requires an explicit --budget-minutes and is never chained automatically by "auto".
//   auto     chains regime (phase 0 scale-only scan) -> classify -> regime (phase 2, the real grid, with any
//            "stuck" region's own groupGain-equivalent axis added) -> robustness filter -> A2 readout. Stops
//            before world: a human decides whether the found candidates are worth the expensive stage.
//
// Every stage writes its rows to a JSON checkpoint under --out, and re-reads rather than recomputes a checkpoint
// that already exists (Ctrl-C or a crash loses at most the in-progress phase).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createFlyBrain } from '../../../../public/js/brain/fly-brain.js';
import { runForagerArms, armMetrics } from '../../../../scripts/forager-arms.mjs';

export const PROBE_SEEDS = [1, 2, 3];
export const PROBE_WARMUP = 50;
export const PROBE_TICKS = 150;
export const PROBE_HUNGER = 0.5;

const fmt = (v, d = 3) => (v === null || v === undefined ? '-' : Number(v).toFixed(d));
export const keyOf = (v) => JSON.stringify(v);

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readCheckpoint(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function writeCheckpoint(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

// One brain-only probe. values: Float32Array, one entry per declared input channel, in declaration order.
// Returns per-region activity (profile.regionNames), per-output drive, and per-output raw synaptic input (the
// arrivals before synapticScale/groupScale/outputScale is divided back out, so it reads the network's own signal
// independent of the readout gain — output neurons have no outgoing edges, ADR 003 D3, so this is stable across
// an A2 fit).
export function probe(profile, ctx, brainOverrides, values) {
  const { capabilities, snapshot, f } = ctx;
  const outputs = capabilities.channels.outputs;
  const outputIds = outputs.map((ch) => ch.id);
  const activity = Object.fromEntries(profile.regionNames.map((r) => [r, 0]));
  let samples = 0;
  const drive = new Float64Array(outputs.length);
  const raw = new Float64Array(outputs.length);
  for (const seed of PROBE_SEEDS) {
    const brain = createFlyBrain({ ...f.brain, ...brainOverrides, snapshot, version: profile.brainVersion }, seed);
    const { net } = brain;
    for (let t = 0; t < PROBE_WARMUP + PROBE_TICKS; t++) {
      const out = brain.step({ inputs: values, hunger: PROBE_HUNGER });
      if (t < PROBE_WARMUP) continue;
      const frac = profile.regionFractions(out.spikes, ctx);
      for (const r of profile.regionNames) activity[r] += frac[r] ?? 0;
      outputs.forEach((ch, k) => {
        drive[k] += out.outputs[k];
        let sum = 0;
        for (const j of ch.neurons) sum += net.input[j] / profile.appliedScale(net, j);
        raw[k] += sum / ch.neurons.length;
      });
      samples++;
    }
  }
  const byId = (arr) => Object.fromEntries(outputIds.map((id, k) => [id, arr[k] / samples]));
  for (const r of profile.regionNames) activity[r] /= samples;
  return { activity, drive: byId(drive), raw: byId(raw) };
}

// A1: the regime of one grid point, against the profile's per-region gates plus the two structural gates every
// version shares (brake: mouth/food taste lowers raw forward; feed: taste raises raw feed above its odour value).
export function regime(profile, ctx, point) {
  const brain = profile.brainOf(point);
  const named = profile.conditions(point, ctx);
  const p = Object.fromEntries(Object.entries(named).map(([k, v]) => [k, probe(profile, ctx, brain, v)]));
  const turn = (c) => p[c].raw['turn-left'] - p[c].raw['turn-right'];
  const turnSize = (Math.abs(p.left.raw['turn-left']) + Math.abs(p.left.raw['turn-right'])
    + Math.abs(p.right.raw['turn-left']) + Math.abs(p.right.raw['turn-right'])) / 2;
  const lateral = turnSize > 0 ? (turn('left') - turn('right')) / turnSize : 0;
  const fwd = p.odour.raw.forward;
  const brake = fwd !== 0 ? (p.taste.raw.forward - fwd) / Math.abs(fwd) : 0;
  const feedSize = Math.abs(p.taste.raw.feed) + Math.abs(p.odour.raw.feed);
  const feedContrast = feedSize > 0 ? (p.taste.raw.feed - p.odour.raw.feed) / feedSize : 0;
  const fails = [];
  for (const r of profile.regionNames) {
    const rest = p.rest.activity[r];
    if (!(rest >= profile.gates.restFloor)) fails.push(`silent:${r}`);
    if (rest > profile.gates.restCeiling) fails.push(`ignited:${r}`);
  }
  for (const r of profile.gates.odourGroups) {
    if (!(p.odour.activity[r] >= profile.gates.odourGain * p.rest.activity[r])) fails.push(`gain:${r}`);
  }
  if (!(brake < 0)) fails.push('brake');
  if (!(feedContrast > 0)) fails.push('feed');
  return {
    point, rest: p.rest.activity, odour: p.odour.activity, lateral, forwardRaw: fwd, brake, feedContrast,
    pass: fails.length === 0, fails,
  };
}

function buildGrid(axes) {
  const names = Object.keys(axes);
  let grid = [{}];
  for (const name of names) {
    const next = [];
    for (const base of grid) for (const value of axes[name]) next.push({ ...base, [name]: value });
    grid = next;
  }
  return grid;
}

// Runs A1 over the full cartesian product of axes, sharded. seen() lets "auto" skip points already in a prior
// checkpoint instead of re-probing them.
export function runRegimeGrid(profile, ctx, axes, { shardK = 0, shardN = 1, onRow } = {}) {
  const grid = buildGrid(axes);
  const rows = [];
  for (const [index, point] of grid.entries()) {
    if (index % shardN !== shardK) continue;
    const r = regime(profile, ctx, point);
    rows.push(r);
    onRow?.(r, index, grid.length);
  }
  return { axes, rows };
}

// Phase 0 -> phase 1: scan synapticScale alone (every other axis at the profile's single reference point) and
// classify each region as "stuck" (fails the ignited gate at every tested scale) or scale-sensitive. This is the
// rule that used to be a human reading the regime table and proposing a groupGain axis by hand (ADR 006 L10:
// "gated by evidence"). Returns { stuck: string[], rows }.
export function classifyRegions(profile, ctx, scaleScanValues) {
  const axis = profile.scaleAxis;
  const reference = profile.referencePoint();
  const rows = scaleScanValues.map((value) => regime(profile, ctx, { ...reference, [axis]: value }));
  const stuck = profile.regionNames.filter((r) => rows.every((row) => row.fails.includes(`ignited:${r}`)));
  return { stuck, rows };
}

// A1 robustness + A2 readout, exactly ADR 005 Annex B's structure: a point's axis-neighbours must mostly also
// pass before its readout is fitted, so the chosen candidates are not an isolated spike in a jagged landscape.
export function robustCandidates(profile, axes, rows, top) {
  const byKey = new Map(rows.map((r) => [keyOf(r.point), r]));
  const neighboursOf = (point) => Object.entries(axes).flatMap(([axis, values]) => {
    const i = values.findIndex((v) => keyOf(v) === keyOf(point[axis]));
    return [values[i - 1], values[i + 1]].filter((v) => v !== undefined)
      .map((v) => byKey.get(keyOf({ ...point, [axis]: v })));
  }).filter(Boolean);
  return rows.filter((r) => r.pass).map((r) => {
    const n = neighboursOf(r.point);
    return { ...r, robustness: n.length ? n.filter((x) => x.pass).length / n.length : 0 };
  }).filter((r) => r.robustness >= profile.gates.neighbours)
    .sort((a, b) => b.robustness - a.robustness || b.lateral - a.lateral)
    .slice(0, top);
}

// A2: fits each output channel's outputScale to the profile's target operating point. Cheap: outputScale never
// changes the network (output neurons have no outgoing edges), so this only re-reads, never re-simulates the bulk.
export function readout(profile, ctx, point, forwardTarget) {
  const brain = profile.brainOf(point);
  const named = profile.conditions(point, ctx);
  const scales = profile.readoutScales;
  const runs = scales.map((s) => {
    const outputScale = Object.fromEntries(ctx.capabilities.channels.outputs.map((ch) => [ch.id, s]));
    const withScale = { ...brain, lif: { ...brain.lif, outputScale } };
    return {
      s,
      odour: probe(profile, ctx, withScale, named.odour).drive,
      taste: probe(profile, ctx, withScale, named.taste).drive,
    };
  });
  return profile.fitReadout(runs, forwardTarget, ctx);
}

// Stage B: the fitted candidates run the profile's own arm (scripts/forager-arms.mjs) on CALIBRATION seeds only.
// seeds="held-out" is refused unless allowHeldOut is explicitly set — ADR 005/006 and AGENTS.md both treat tuning
// on held-out seeds as a correctness bug, not a style choice, so this engine enforces it rather than documenting
// it as a convention someone could forget.
export function runWorldStage(profile, ctx, candidates, { ticks, allowHeldOut = false, onCandidate } = {}) {
  const { f, world, expConfig, snapshot, capabilities } = ctx;
  if (allowHeldOut) {
    throw new Error('stage=world never runs held-out seeds, even with --allow-held-out: that flag does not exist '
      + 'for this stage. Held-out verification is a separate, explicit step after a candidate is chosen.');
  }
  const seeds = f.experiment.seeds;
  const base = armMetrics(['baseline'], runForagerArms({
    f, world, expConfig, snapshot, arms: ['baseline'], seeds, ticks, capabilities,
  }), profile.odourRadius(f), 1).baseline;
  const out = [];
  for (const c of candidates) {
    const brain = profile.brainOf(c.point);
    const { outputScale, drives } = readout(profile, ctx, c.point, c.forwardTarget);
    const fRun = {
      ...f,
      brain: { ...f.brain, ...brain, motorSmoothing: c.motorSmoothing, lif: { ...brain.lif, outputScale } },
    };
    const metrics = armMetrics([profile.brainVersion], runForagerArms({
      f: fRun, world, expConfig, snapshot, arms: [profile.brainVersion], seeds, ticks, capabilities,
    }), profile.odourRadius(f), 1);
    metrics.baseline = base;
    const row = { ...c, brain: fRun.brain, drives, metrics: metrics[profile.brainVersion] };
    out.push(row);
    onCandidate?.(row, base);
  }
  return { seeds, ticks, baseline: base, rows: out };
}

export { ensureDir, readCheckpoint, writeCheckpoint, fmt };
