// Generic, version-agnostic calibration engine behind the microfly-calibrate skill. A "profile" (profiles/v*.mjs)
// supplies everything version-specific (world/snapshot paths, grid axes, gates, how to build a brain config and a
// probe input vector from a grid point); this file supplies the staged A1/A2/B procedure itself (ADR 005 Annex B,
// generalised by ADR 006's "Calibration protocol" to per-group gates), so a new brain generation is a new profile,
// not a new copy of this file.
//
// Stages:
//   regime   A1, brain-only: gate each grid point's per-region rest/odour/feed behaviour (`brake` is probed and
//            reported on every row but is not a gate — see regime() below). Cheap (seconds to low minutes per
//            point) — safe to run interactively.
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

// BUG-002 item 2: a per-tick union-of-spikes fraction is not comparable across the stepsPerTick axis (more steps
// per tick means more chances for a neuron to be counted active, independent of its actual per-step firing rate).
// Converts the recorded fraction back to an approximate per-LIF-step rate, assuming independent per-step firing
// at a stable rate across the tick: fraction = 1 - (1 - rate)^stepsPerTick. Opt-in per profile (`gates.rateBasis
// === 'perStep'`) so v1's already-concluded calibration, which never varies stepsPerTick, is unaffected.
export function perStepRateFromUnion(fraction, stepsPerTick) {
  if (!(stepsPerTick > 0)) return fraction;
  return 1 - (1 - Math.min(Math.max(fraction, 0), 1)) ** (1 / stepsPerTick);
}

// The A1 rest/ceiling gate (ADR 006 Amendment 2026-10-11, A5), shared between a live regime() probe and
// rescoreStoredRow()'s replay of a stored checkpoint row, so the two can never drift apart. `floorGroups`
// (default: every region, matching the pre-A5 behaviour) and `ceilingExemptGroups` (default: none) let a profile
// opt into A5's `input`-only floor and `output` exemption without changing a profile that does not set them.
function restGateFails(profile, restActivity, stepsPerTick) {
  const rateOf = (fraction) => (profile.gates.rateBasis === 'perStep' ? perStepRateFromUnion(fraction, stepsPerTick) : fraction);
  const floorGroups = profile.gates.floorGroups ?? profile.regionNames;
  const ceilingExempt = profile.gates.ceilingExemptGroups ?? [];
  const fails = [];
  for (const r of profile.regionNames) {
    if (!(r in restActivity)) continue;
    const rest = rateOf(restActivity[r]);
    if (floorGroups.includes(r) && !(rest >= profile.gates.restFloor)) fails.push(`silent:${r}`);
    if (!ceilingExempt.includes(r) && rest > profile.gates.restCeiling) fails.push(`ignited:${r}`);
  }
  return fails;
}

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

// Settle gate (ADR 006 Amendment 2026-10-11, A5 item 7): clamps `clampValues` for PROBE_TICKS after warmup, then
// releases to zero input for another PROBE_TICKS on the same brain instance, and reports each phase's per-tick
// union activity. A brain that stays ignited after its stimulus is removed (runaway/bistable) is indistinguishable
// from a reactive-then-quiet one without this. Opt-in per profile (`gates.settleGroups`), so v1's profile, which
// does not set it, is unaffected.
export function probeSettle(profile, ctx, brainOverrides, clampValues) {
  const { snapshot, f } = ctx;
  const zero = new Float32Array(clampValues.length);
  const phases = {
    during: Object.fromEntries(profile.regionNames.map((r) => [r, 0])),
    after: Object.fromEntries(profile.regionNames.map((r) => [r, 0])),
  };
  const samples = { during: 0, after: 0 };
  for (const seed of PROBE_SEEDS) {
    const brain = createFlyBrain({ ...f.brain, ...brainOverrides, snapshot, version: profile.brainVersion }, seed);
    for (let t = 0; t < PROBE_WARMUP + PROBE_TICKS * 2; t++) {
      const phase = t < PROBE_WARMUP ? null : (t < PROBE_WARMUP + PROBE_TICKS ? 'during' : 'after');
      const out = brain.step({ inputs: phase === 'after' ? zero : clampValues, hunger: PROBE_HUNGER });
      if (!phase) continue;
      const frac = profile.regionFractions(out.spikes, ctx);
      for (const r of profile.regionNames) phases[phase][r] += frac[r] ?? 0;
      samples[phase]++;
    }
  }
  for (const phase of ['during', 'after']) for (const r of profile.regionNames) phases[phase][r] /= samples[phase];
  return phases;
}

// A1: the regime of one grid point, against the profile's per-region gates plus the structural gates every
// version shares (feed: taste raises raw feed above its odour value). `brake` (mouth/food taste lowering raw
// forward) is computed and returned on every row but is NOT a gate: specs/012-class-seeded-forager-brain/
// calibration.md found it fails at all 80 calibration points tried (synapticScale 2-50), and ADR 006 D13's
// independent, connectome-level probe found taste -> forward positive on the whole MaleCNS v1.0 graph itself, not
// only on this brain's own selection -- so no synapticScale/inhibitoryScale/noise setting can pass it with the
// v1 taste pool. ADR 006 Q4 names the prerequisite as a declared taste-pool change (e.g. mouth/pharyngeal GRNs
// only), not a parameter search. By user decision (2026-10-13) `brake` is dropped as a gate and as acceptance
// criteria everywhere in this engine, the same treatment `requireFeed` already gives `feed` below.
// A profile's `taste` condition decides what "mouth taste" is compared against — v1's and (since BUG-002) v2's
// both combine it with food odour, so feed reads as "odour-plus-taste vs. odour alone", not "taste alone vs.
// odour alone".
// `gates.requireFeed` (default true, so v1 is unaffected) lets a profile stop treating `feed` as a hard A1 gate.
// v2's own regime sweep (2026-10-11, specs/013 calibration.md) found feedContrast pinned at exactly 0 across its
// whole viable low-scale window -- the feed output never discriminates taste from odour there at all, a separate,
// still-open problem from lateral movement -- so by user decision movement is prioritised and feed is tracked
// but no longer blocks a candidate.
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
  const stepsPerTick = point.stepsPerTick ?? 1;
  const fails = restGateFails(profile, p.rest.activity, stepsPerTick);
  for (const r of profile.gates.odourGroups) {
    if (!(p.odour.activity[r] >= profile.gates.odourGain * p.rest.activity[r])) fails.push(`gain:${r}`);
  }
  if ((profile.gates.requireFeed ?? true) && !(feedContrast > 0)) fails.push('feed');
  if (profile.gates.lateralMin !== undefined && !(Math.abs(lateral) >= profile.gates.lateralMin)) fails.push('lateral');
  let settleAfter;
  if (profile.gates.settleGroups) {
    settleAfter = probeSettle(profile, ctx, brain, named[profile.gates.settleCondition ?? 'odour']).after;
    for (const r of profile.gates.settleGroups) {
      if (restGateFails(profile, { [r]: settleAfter[r] }, stepsPerTick).length) fails.push(`settle:${r}`);
    }
  }
  return {
    point, rest: p.rest.activity, odour: p.odour.activity, lateral, forwardRaw: fwd, brake, feedContrast,
    ...(settleAfter ? { settleAfter } : {}),
    pass: fails.length === 0, fails,
  };
}

// Re-scores a previously recorded regime() row under the profile's CURRENT gates, using only the per-tick
// `rest`/`odour`/`lateral` fields a checkpoint already stores (BUG-002 T100: no new simulation). This can apply
// the `output` exemption, the `input`-only floor, the per-step rate conversion and the lateral gate, all of which
// are pure functions of stored data — but it CANNOT re-evaluate `feedContrast` (recorded under the old
// taste-alone probe, not the corrected odour-plus-taste one) or the settle gate (never probed by `--stage=auto`
// before A5). `brake` is not a gate at all (see regime() above), so there is nothing to re-evaluate for it; its
// stored value just carries through unchanged via `...row`. Callers must treat `partialPass` as necessary, not
// sufficient: a full verdict still needs a fresh `regime()` run with the corrected profile.
export function rescoreStoredRow(profile, row) {
  const stepsPerTick = row.point.stepsPerTick ?? 1;
  const fails = restGateFails(profile, row.rest, stepsPerTick);
  for (const r of profile.gates.odourGroups) {
    if (!(row.odour[r] >= profile.gates.odourGain * row.rest[r])) fails.push(`gain:${r}`);
  }
  if (profile.gates.lateralMin !== undefined && !(Math.abs(row.lateral) >= profile.gates.lateralMin)) fails.push('lateral');
  return {
    ...row, partialFails: fails, partialPass: fails.length === 0, notReevaluated: ['feed', 'settle'],
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
      // A5 item 6: lets a profile's fitReadout() require near-zero fitted forward drive with no stimulus present.
      // Purely additive (v1's fitReadout ignores the extra field) so v1's already-concluded result is unchanged.
      rest: probe(profile, ctx, withScale, named.rest).drive,
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
