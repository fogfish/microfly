// C1 regime, C2 decode (pool selection + decoder-v1 writer) and C3 smoke (ADR 010 Part H). A new module, sibling
// to engine.mjs: the A1/A2/B grid-search protocol in engine.mjs is retired for "v3" (research.md §4). C2 needs a
// primitive engine.mjs does not provide — per-neuron spike-rate measurement under left/right/bilateral stimulus,
// to compute each candidate's selectivity s = (rL − rR)/(rL + rR) — not a per-region activity fraction, so this
// stays its own file rather than being grafted onto engine.mjs (keeps v1/v2's calibration path untouched).

import { createFlyBrain } from '../../../../public/js/brain/fly-brain.js';
import { pairOf } from '../../../../public/js/fly/decoder.js';
import { runForagerArms, armMetrics, rewire } from '../../../../scripts/forager-arms.mjs';
import { perStepRateFromUnion, ensureDir, readCheckpoint, writeCheckpoint, fmt } from './engine.mjs';

const WARMUP = 50;

// ---- shared probing primitives ----

// The readout candidates (ADR 010 D27), each carrying its bodyId for the determinism tie-break (D27, AGENTS.md's
// Python sort rule applied here in JS). scope "descending": every descending neuron plus every named output
// neuron ("about 1,320", D27 as first written). scope "non-input" (D27 as amended, spec 017 BUG-001): every neuron
// that is not in a sensory input pool, plus the named outputs. The 2026-10-17 probe found no sense-specific DN
// response, while 1,623 central-brain neurons respond reproducibly to food odour, 12 to danger and 36 to heat
// (calibration.md). Input-pool neurons are never candidates: their rate is the stimulus itself, and the body
// layer must not read the stimulus (constitution VI).
export function candidateNeurons(snapshot, scope = 'descending') {
  if (scope !== 'descending' && scope !== 'non-input') throw new Error(`unknown candidate scope "${scope}"`);
  const neurons = snapshot.manifest.neurons;
  const outputNeurons = new Set(snapshot.capabilities.channels.outputs.flatMap((ch) => ch.neurons));
  const inputNeurons = new Set(snapshot.capabilities.channels.inputs.flatMap((ch) => ch.neurons));
  const list = [];
  for (let i = 0; i < neurons.length; i++) {
    const wanted = outputNeurons.has(i)
      || (scope === 'descending' ? neurons[i].superclass === 'descending_neuron' : !inputNeurons.has(i));
    if (wanted) list.push({ index: i, bodyId: neurons[i].bodyId });
  }
  return list;
}

// Declared pairs (D26), derived from channel ids (decoder.js's pairOf), each with its L/R input-vector index.
export function declaredPairs(capabilities) {
  const pairs = new Map();
  capabilities.channels.inputs.forEach((ch, k) => {
    const pair = pairOf(ch.id);
    const entry = pairs.get(pair) ?? {};
    entry[ch.side] = k;
    pairs.set(pair, entry);
  });
  return pairs;
}

function fullStrengthVector(inputCount, entries) {
  const v = new Float32Array(inputCount);
  for (const [idx, value] of entries) if (idx !== undefined) v[idx] = value;
  return v;
}

// Drives a brain for `ticks` after `warmup`, at a constant input vector and hunger 1 (full gain — a brain-only
// probe, independent of the D32 hunger ramp). Returns per-candidate union-fraction (D29's own union semantics —
// protocol v3 carries no richer signal, so calibration-time measurement matches decode-time exactly) and the
// whole-network union-fraction (the regime gate's own "rest activity" measure).
function probe(ctx, candidates, lifOverrides, inputsVec, seed, ticks, warmup = WARMUP) {
  const brain = createFlyBrain({ ...ctx.f.brain, lif: { ...ctx.f.brain.lif, ...lifOverrides }, snapshot: ctx.snapshot, version: 'v3' }, seed);
  const n = ctx.snapshot.neuronCount;
  const fired = new Float64Array(candidates.length);
  const firedMask = new Uint8Array(n);
  let networkUnion = 0;
  let sampled = 0;
  for (let t = 0; t < warmup + ticks; t++) {
    const out = brain.step({ inputs: inputsVec, hunger: 1 });
    if (t < warmup) continue;
    firedMask.fill(0);
    for (const idx of out.spikes) firedMask[idx] = 1;
    candidates.forEach((c, k) => { if (firedMask[c.index]) fired[k]++; });
    networkUnion += out.spikes.length / n;
    sampled++;
  }
  return {
    perCandidate: Array.from(fired, (count) => count / sampled),
    network: networkUnion / sampled,
  };
}

// Converts a per-tick union-fraction to Hz, via engine.mjs's established BUG-002 correction (a per-tick union is
// not directly comparable across stepsPerTick): per-step rate × LIF-steps-per-second.
function toHz(unionFraction, stepsPerTick, tickHz) {
  return perStepRateFromUnion(unionFraction, stepsPerTick) * stepsPerTick * tickHz;
}

// ---- C1 regime ----

// grid: { synapticScale: number[], baselineCurrent: number[] }. gates: { restMin, restMax (fraction of neurons
// per tick), driveRiseHz, ignitionTicks, seeds, ticks }. Returns { rows, pass } — the passing point with the
// lowest rest activity, ties on lower synapticScale (ADR 010 Part H), or null when every point fails.
export function runC1(ctx, grid, gates) {
  const candidates = candidateNeurons(ctx.snapshot, gates.candidates);
  const pairs = declaredPairs(ctx.capabilities);
  const inputCount = ctx.capabilities.channels.inputs.length;
  const tickHz = ctx.f.tickHz;
  const stepsPerTick = ctx.f.brain.stepsPerTick ?? 1;
  const seeds = gates.seeds ?? [1, 2];
  const ticks = gates.ticks ?? 300;
  const ignitionTicks = gates.ignitionTicks ?? 100;

  const rows = [];
  for (const synapticScale of grid.synapticScale) {
    for (const baselineCurrent of grid.baselineCurrent) {
      const overrides = { synapticScale, baselineCurrent };
      let restSum = 0;
      const driveRiseMin = {}; // pair -> min across seeds of (candidate-population rise, Hz)
      let ignitionFails = 0;
      for (const seed of seeds) {
        const rest = probe(ctx, candidates, overrides, new Float32Array(inputCount), seed, ticks);
        restSum += rest.network;
        const restCandidateHz = toHz(rest.perCandidate.reduce((a, b) => a + b, 0) / candidates.length, stepsPerTick, tickHz);
        for (const [pairId, sides] of pairs) {
          const vec = fullStrengthVector(inputCount, [[sides.L, 1], [sides.R, 1]]);
          const r = probe(ctx, candidates, overrides, vec, seed, ticks);
          const candidateMean = r.perCandidate.reduce((a, b) => a + b, 0) / candidates.length;
          const riseHz = toHz(candidateMean, stepsPerTick, tickHz) - restCandidateHz;
          driveRiseMin[pairId] = Math.min(driveRiseMin[pairId] ?? Infinity, riseHz);
        }
        // Ignition (ADR 010 Part H): every pair driven at once for `ticks`, then released; activity must fall
        // back to the rest ceiling within `ignitionTicks` of release.
        const brain = createFlyBrain({ ...ctx.f.brain, lif: { ...ctx.f.brain.lif, ...overrides }, snapshot: ctx.snapshot, version: 'v3' }, seed);
        const n = ctx.snapshot.neuronCount;
        const stim = new Float32Array(inputCount).fill(1);
        const zero = new Float32Array(inputCount);
        for (let t = 0; t < WARMUP + ticks; t++) brain.step({ inputs: stim, hunger: 1 });
        let settled = 0;
        for (let t = 0; t < ignitionTicks; t++) settled = brain.step({ inputs: zero, hunger: 1 }).spikes.length / n;
        if (settled > gates.restMax) ignitionFails++;
      }
      const restActivity = restSum / seeds.length;
      const restOk = restActivity >= gates.restMin && restActivity <= gates.restMax;
      const risesOk = Object.values(driveRiseMin).every((hz) => hz >= gates.driveRiseHz);
      const ignitionOk = ignitionFails === 0;
      const fails = [];
      if (!restOk) fails.push(`rest:${fmt(restActivity, 4)}`);
      if (!risesOk) fails.push(`rise:${JSON.stringify(Object.fromEntries(Object.entries(driveRiseMin).map(([k, v]) => [k, Number(v.toFixed(2))])))}`);
      if (!ignitionOk) fails.push('ignition');
      rows.push({ point: { synapticScale, baselineCurrent }, restActivity, driveRiseMin, pass: fails.length === 0, fails });
    }
  }
  const passing = rows.filter((r) => r.pass)
    .sort((a, b) => a.restActivity - b.restActivity || a.point.synapticScale - b.point.synapticScale);
  return { rows, chosen: passing[0] ?? null };
}

// ---- C2 decode ----

// C2 (ADR 010 D27): selects side/drive pools for every declared pair, seeds the homeostatic baseline (D33),
// writes the decoder-v1 shape (contracts/decoder-v1.md). Does not write the file itself (callers decide the
// path); throws E-DECODE-<pool> and returns no pools when a selection fails its held-back reproduction check.
//
// One brain run probes every candidate at once (probe() already does this) — 19 conditions (1 rest + 6 pairs x
// {left, right, bilateral}) x 4 seeds (3 calibration + 1 held-back), matching ADR 010 Part H's own count, not
// one run per candidate (which would be ~1,320x more simulation for no extra information).
export function runC2(ctx, lifBlock, gates) {
  const candidates = candidateNeurons(ctx.snapshot, gates.candidates);
  const pairs = declaredPairs(ctx.capabilities);
  const inputCount = ctx.capabilities.channels.inputs.length;
  const tickHz = ctx.f.tickHz;
  const stepsPerTick = ctx.f.brain.stepsPerTick ?? 1;
  const seeds = gates.seeds ?? [1, 2, 3];
  const heldBack = gates.heldBack ?? 4;
  const ticks = gates.ticks ?? 400;
  // D27's own numbers, as defaults; overridable so a small synthetic graph (tests/decoder-engine.test.mjs) can
  // exercise the selection/sort/reproduction logic without needing ~1,320 real candidate neurons.
  const sideThreshold = gates.sideThreshold ?? 0.3;
  const sideMinRiseHz = gates.sideMinRiseHz ?? 2;
  const minSideMembers = gates.minSideMembers ?? 5;
  const driveRiseHz = gates.driveRiseHz ?? 3;
  const driveSelectivityRatio = gates.driveSelectivityRatio ?? 2;
  const reproductionFraction = gates.reproductionFraction ?? 0.7;
  // ADR 011 (forager-mb profile, found 2026-10-21): at this brain's activity level some pairs' side candidates
  // are single-spike-level events over the whole probe window (shot noise, not signal — confirmed directly:
  // more ticks does not fix it, since scaling a mean count of ~1 spike up by the same factor leaves the
  // relative Poisson-like noise just as large). Declaring a pair here skips side-pool *selection* for it
  // entirely, the same outcome Part L already gives when too few candidates clear the bar (klinotaxis alone) —
  // this just names the different, measured reason. Empty by default; no other profile sets it.
  const noSidePairs = new Set(gates.noSidePairs ?? []);

  // measurements.get(seed).get(pairId) -> { rest, left, right, bilateral: number[] } (per-candidate union
  // fractions, in `candidates` order). rest is seed-level (pair-independent), stored once per seed under "".
  const measurements = new Map();
  for (const seed of [...seeds, heldBack]) {
    const perSeed = new Map();
    const rest = probe(ctx, candidates, lifBlock, new Float32Array(inputCount), seed, ticks).perCandidate;
    for (const [pairId, sides] of pairs) {
      const left = sides.L !== undefined ? probe(ctx, candidates, lifBlock, fullStrengthVector(inputCount, [[sides.L, 1]]), seed, ticks).perCandidate : candidates.map(() => 0);
      const right = sides.R !== undefined ? probe(ctx, candidates, lifBlock, fullStrengthVector(inputCount, [[sides.R, 1]]), seed, ticks).perCandidate : candidates.map(() => 0);
      const bilateral = probe(ctx, candidates, lifBlock, fullStrengthVector(inputCount, [[sides.L, 1], [sides.R, 1]]), seed, ticks).perCandidate;
      perSeed.set(pairId, { rest, left, right, bilateral });
    }
    measurements.set(seed, perSeed);
  }
  const hz = (fraction) => toHz(fraction, stepsPerTick, tickHz);
  // k: the candidate's position in `candidates` (not its neuron index).
  const meanOverSeeds = (k, pairId, field, seedList) => (
    seedList.reduce((sum, seed) => sum + measurements.get(seed).get(pairId)[field][k], 0) / seedList.length
  );

  const pools = {};
  const errors = [];

  for (const [pairId, sides] of pairs) {
    // side.<pair>.L/.R (D27): s = (rL − rR)/(rL + rR) on the calibration seeds; |s| > 0.3, mean rate >= 2 Hz
    // above rest, members sorted by |s| desc, ties on bodyId asc.
    if (noSidePairs.has(pairId)) {
      // Skipped by declared gate (see noSidePairs above) — no side.<pairId>.L/.R pool at all, klinotaxis alone.
    } else {
      const sideScored = candidates.map((c, k) => {
        const rL = meanOverSeeds(k, pairId, 'left', seeds);
        const rR = meanOverSeeds(k, pairId, 'right', seeds);
        const rest = meanOverSeeds(k, pairId, 'rest', seeds);
        const s = (rL + rR) > 0 ? (rL - rR) / (rL + rR) : 0;
        const meanRiseHz = hz((rL + rR) / 2) - hz(rest);
        return { c, k, s, meanRiseHz };
      });
      const sideSelected = (sign) => sideScored
        .filter((r) => (sign > 0 ? r.s > sideThreshold : r.s < -sideThreshold) && r.meanRiseHz >= sideMinRiseHz)
        .sort((a, b) => Math.abs(b.s) - Math.abs(a.s) || a.c.bodyId - b.c.bodyId);
      const leftMembers = sideSelected(1);
      const rightMembers = sideSelected(-1);
      for (const [name, members, sign] of [[`side.${pairId}.L`, leftMembers, 1], [`side.${pairId}.R`, rightMembers, -1]]) {
        if (members.length < minSideMembers) continue; // D27 Part L: too few a side -> no side pool (klinotaxis alone)
        const reproduced = members.filter((m) => {
          const rL = measurements.get(heldBack).get(pairId).left[m.k];
          const rR = measurements.get(heldBack).get(pairId).right[m.k];
          const sHeld = (rL + rR) > 0 ? (rL - rR) / (rL + rR) : 0;
          return sign > 0 ? sHeld > 0 : sHeld < 0;
        });
        if (reproduced.length / members.length < reproductionFraction) {
          errors.push(`E-DECODE-${name}`);
          continue;
        }
        pools[name] = members.map((m) => m.c.index);
      }
    }

    // drive.<pair> (D27): rise >= driveRiseHz over rest under bilateral, and >= driveSelectivityRatio x the
    // rise under any OTHER pair.
    const driveScored = candidates.map((c, k) => {
      const rest = meanOverSeeds(k, pairId, 'rest', seeds);
      const bilateral = meanOverSeeds(k, pairId, 'bilateral', seeds);
      const rise = hz(bilateral) - hz(rest);
      const otherRises = [...pairs.keys()].filter((p) => p !== pairId).map((other) => {
        const otherRest = meanOverSeeds(k, other, 'rest', seeds);
        const otherBilateral = meanOverSeeds(k, other, 'bilateral', seeds);
        return hz(otherBilateral) - hz(otherRest);
      });
      const maxOther = otherRises.length ? Math.max(...otherRises) : 0;
      return { c, k, rise, selective: rise >= driveRiseHz && rise >= driveSelectivityRatio * Math.max(maxOther, 1e-9) };
    });
    const driveMembers = driveScored.filter((r) => r.selective).sort((a, b) => b.rise - a.rise || a.c.bodyId - b.c.bodyId);
    if (driveMembers.length > 0) {
      const reproduced = driveMembers.filter((m) => {
        const rest = measurements.get(heldBack).get(pairId).rest[m.k];
        const bilateral = measurements.get(heldBack).get(pairId).bilateral[m.k];
        return hz(bilateral) - hz(rest) >= driveRiseHz;
      });
      if (reproduced.length / driveMembers.length < reproductionFraction) {
        errors.push(`E-DECODE-drive.${pairId}`);
      } else {
        pools[`drive.${pairId}`] = driveMembers.map((m) => m.c.index);
      }
    }
  }

  // Named pools (D27): alarm/feed/forward/backward are the snapshot's own output neurons, plus drive.odour-danger
  // and drive.heat for alarm (the fallback path when neither exists is ADR 010 Part L's, handled by the body
  // layer, not here).
  const outputNeurons = (drive) => ctx.capabilities.channels.outputs.find((ch) => ch.drive === drive)?.neurons ?? [];
  pools.feed = outputNeurons('feed');
  pools.forward = outputNeurons('forward');
  pools.backward = outputNeurons('backward');
  pools.alarm = [...new Set([
    ...outputNeurons('escape'),
    ...(pools['drive.odour-danger'] ?? []),
    ...(pools['drive.heat'] ?? []),
  ])].sort((a, b) => a - b);

  if (errors.length > 0) {
    return { errors, pools: null };
  }

  // D33: homeostasis rest, measured under the same rest condition, one value per pool named above. `rest` is
  // pair-independent (the same array under every pairId for a given seed), so any declared pair reads it; every
  // named-pool member (forward/backward/feed/escape's output neurons) is already a `candidates` entry too
  // (candidateNeurons unions in every named output), so no separate re-probe is needed.
  const kOf = new Map(candidates.map((c, k) => [c.index, k]));
  const anyPairId = pairs.keys().next().value;
  const homeostasisRest = {};
  for (const name of Object.keys(pools)) {
    const members = pools[name];
    if (members.length === 0) { homeostasisRest[name] = 0; continue; }
    const restFractions = members.map((idx) => meanOverSeeds(kOf.get(idx), anyPairId, 'rest', seeds));
    homeostasisRest[name] = restFractions.reduce((a, b) => a + b, 0) / restFractions.length;
  }

  const valence = gates.valence ?? {};
  return {
    errors: [],
    pools,
    valence,
    homeostasisRest,
    probe: { seeds, heldBack, ticks, rule: 'D27', candidates: gates.candidates ?? 'descending' },
  };
}

// Writes the decoder-v1 shape (contracts/decoder-v1.md). sha256: the loaded .brain file's own hash.
export function buildDecoderFile(c2Result, snapshotFile, sha256, lifBlock, configHash) {
  return {
    format: 'decoder', version: 1,
    snapshot: { file: snapshotFile, sha256 },
    lif: lifBlock,
    probe: c2Result.probe,
    pools: c2Result.pools,
    valence: c2Result.valence,
    homeostasis: { rest: c2Result.homeostasisRest },
    provenance: { createdAt: new Date().toISOString(), tool: 'calibrate.mjs C2', configHash },
  };
}

// ---- stage=all orchestration (C1 -> C2) ----

// The same stop-at-the-first-failing-gate contract calibrate.mjs's `--stage=all` dispatch implements (spec
// FR-018, ADR 010 Part H: "all runs them in order and stops at the first failing gate"): run C1; if it is over
// budget or no grid point passes, stop there; otherwise run C2 with C1's chosen point; if that is over budget or
// fails, stop there instead. Pure (no file I/O, no process.exit) so the stop-at-first-failure behaviour is
// testable directly (tests/calibrate-stage-all.test.mjs) with a synthetic ctx/profile, without spawning the CLI
// against a real world and snapshot on disk. calibrate.mjs's own `stage === 'c1' || 'all'` /
// `stage === 'c2' || 'all'` blocks implement this same sequencing inline (so they can print/checkpoint between
// stages); keep the two in sync if either changes.
export function runC1ThenC2(ctx, profile, { budgetMinutesLeft } = {}) {
  const overBudget = () => budgetMinutesLeft !== undefined && budgetMinutesLeft() <= 0;

  const c1 = runC1(ctx, profile.c1.grid, profile.c1.gates);
  if (overBudget()) return { stoppedAt: 'c1', overBudget: true, c1 };
  if (!c1.chosen) return { stoppedAt: 'c1', c1 };
  const lifBlock = { ...ctx.f.brain.lif, ...c1.chosen.point };

  const c2 = runC2(ctx, lifBlock, { ...profile.c2.gates, valence: profile.c2.valence });
  if (overBudget()) return { stoppedAt: 'c2', overBudget: true, c1, c2, lifBlock };
  if (c2.errors.length > 0) return { stoppedAt: 'c2', c1, c2, lifBlock };

  return { stoppedAt: null, c1, c2, lifBlock };
}

// ---- C3 smoke ----

// Closed-loop run on calibration seeds, both maps, brain arm vs. random-walk, hungry start (ADR 010 Part H: "R1
// -R3 quick metrics, reported, never tuned on"). ctxFor(worldPath) builds a fresh { f, world, expConfig,
// snapshot, capabilities } for that world (the two demo worlds share one snapshot/decoder).
export function runC3(ctxFor, worldPaths, decoderFile, seeds, ticks) {
  const reports = [];
  for (const worldPath of worldPaths) {
    const ctx = ctxFor(worldPath);
    const result = runForagerArms({
      f: ctx.f,
      world: ctx.world, expConfig: ctx.expConfig, snapshot: ctx.snapshot,
      arms: ['v3', 'baseline'], seeds, ticks, capabilities: ctx.capabilities,
      decoders: { v3: decoderFile },
      // ADR 011: ctxFor's own f.brain.learning must already be the parsed object (as ctxFor already resolves
      // f.brain.snapshot), not the raw world-config path string.
      learning: typeof ctx.f.brain.learning === 'object' ? ctx.f.brain.learning : undefined,
    });
    const metrics = armMetrics(['v3', 'baseline'], result, ctx.f.stimuli?.['odour:food']?.radius ?? 6, seeds[0] ?? 1);
    reports.push({ worldPath, metrics });
  }
  return reports;
}

export { ensureDir, readCheckpoint, writeCheckpoint, fmt, rewire };
