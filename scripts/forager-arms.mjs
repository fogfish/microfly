// The forager comparison (ADR 003 Gate C; contracts/experiment-metrics.md). Runs the arms over the same world and seeds,
// with the same spawn for every arm, and reports the five metrics of metrics.js per arm.
//
// Arms:
//   mock           toy random graph (flies.brain shared settings, mock size), v0 runner
//   v0             the small snapshot (version 3), v0 runner (only when flies.brain.snapshot is version 3)
//   v1             the forager snapshot (version 4), forager loop (forager-step.js), three start cohorts:
//                  main (flies.body.energy.initial), hungry (energy 0.1) and sated (energy 0.9)
//   random-matched the v1 snapshot with its targets redrawn uniformly (no self-edge), keeping every neuron's out-degree
//                  and the weight of each edge slot: a degree-preserving null for the connectome structure
//   baseline       random walk, no brain
//
// Find counts a fly that stands on a flower with stock above zero. Approach uses the flies that started more than one
// odour radius from every flower. Bouts are read from the closed bouts of a v1 fly (energy.js closeBout). Contacts are
// printed, and do not decide the verdict (FR-028).

import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { createBaselineMotor } from '../public/js/fly/baseline.js';
import { stepBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { applyForagerMotor, forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';
import { forageEnvWide, senseForagerFlyWide, stepForagerFlyV3 } from '../public/js/fly/forager-step-wide.js';
import { createDecoderState } from '../public/js/fly/decoder.js';
import { initBodyLayerFly } from '../public/js/fly/body-layer.js';
import { senseAt } from '../public/js/fly/stimulus.js';
import { flowerAt, hazardPoints, spawnFlies } from '../public/js/fly/fly-world.js';
import {
  approachMedian, avoidFraction, bootstrapCI, brakeMedian, eatMedian, escapeMean, escapeOrTurnWithin,
  feedArrivalWithin, findInterval, findRate, hungerDependence, stayMedian, touchTurn, walkedShare,
} from '../public/js/fly/metrics.js';
import { createPrng } from '../public/js/world/prng.js';

// ADR 007 Acceptance, Gate C: the fraction-of-ticks-near-a-hazard radius (metric 8), fixed regardless of a
// sense's own declared falloff radius. For a field source (BUG-001) the distance is the cell's tile-step ring, so
// 1.5 means "on a cell next to the source", ring 1, the field's full-strength step after the source itself.
const AVOID_RADIUS = 1.5;

const COHORT_ENERGY = { hungry: 0.1, sated: 0.9 };

// A degree-preserving rewiring of a snapshot: each neuron keeps its out-edges, the targets are drawn uniformly, and the
// weight of each edge slot is kept (so the weight distribution is the same).
export function rewire(snapshot, seed) {
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

// A named arm's snapshot may declare a different output set than the world's own primary brain (ADR 007
// Acceptance compares "v1-11k", 5 outputs, against "wide", 6 outputs, under one shared flies.brain.lif block).
// lif-v1.js's createNetwork rejects an outputScale key that names an output the loaded snapshot does not
// declare, so an arm's own lif is scoped down to its own declared output ids before createFlyBrain sees it —
// the same acknowledged "one shared lif is only ever calibrated for one arm's own brain" limitation
// specs/012-class-seeded-forager-brain/results.md already records, kept from crashing instead of silently fixed.
function scopedLif(lif, armSnapshot) {
  if (!lif?.outputScale || typeof lif.outputScale !== 'object') return lif;
  const known = new Set(armSnapshot.capabilities.channels.outputs.map((ch) => ch.id));
  const outputScale = Object.fromEntries(Object.entries(lif.outputScale).filter(([id]) => known.has(id)));
  return { ...lif, outputScale };
}

// BUG-001 (spec 013 FR-028): where a hazard sense comes from, as the senses read it. A field source (forestEdge,
// water: world/danger-field.js, heat-field.js) gives the tile-step ring distance of the fly's cell; a `dangers` source
// gives the distance to the nearest point of its declared kinds. `inRange` is "the sense reads a value here": a
// field's non-zero rings (distance < 3), a point within the sense's radius. Returns null when the world has no such
// source, so the metric reads n/a instead of a misleading 0 % (a sketch map has no spider/lantern cells). A world
// with no flies.stimuli (v1) keeps the spider/lantern points it always used.
export function hazardLocator(world, spec, fallbackKinds) {
  const fieldOf = { forestEdge: world.dangerField, water: world.heatField };
  if (spec && fieldOf[spec.from]) {
    const field = fieldOf[spec.from];
    const ring = (x, y) => field.distance[Math.floor(y) * world.width + Math.floor(x)];
    return { distanceAt: ring, inRange: (x, y) => ring(x, y) < 3 };
  }
  const kinds = spec ? (spec.from === 'dangers' ? spec.kinds ?? [] : []) : fallbackKinds;
  const points = hazardPoints(world, kinds);
  if (points.length === 0) return null;
  const radius = spec?.radius ?? 0;
  const distanceAt = (x, y) => nearestFlower(points, x, y);
  return { distanceAt, inRange: (x, y) => distanceAt(x, y) <= radius };
}

// Distance from a point to the nearest flower cell centre (tiles), or Infinity without flowers.
function nearestFlower(points, x, y) {
  let best = Infinity;
  for (const p of points) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

// One fly of a v0-style arm (mock, v0, random-matched for v0): the v0 runner drives the body; find is contact.
function runV0Fly(state, brainConfig, ctx) {
  const brain = createFlyBrain(brainConfig, state.brainSeed);
  const start = nearestFlower(ctx.points, state.body.x, state.body.y);
  let firstContactTick = null;
  for (let t = 0; t < ctx.ticks; t++) {
    const out = brain.step(senseAt(ctx.points, state.body.x, state.body.y, ctx.f.stimulus));
    stepBody(state.body, { left: out.left, right: out.right }, ctx.env);
    // Found: inside a flower's eating area (flies.food.reach, spec 017 BUG-002), the same rule as every brain arm.
    if (firstContactTick === null && flowerAt(ctx.world, Math.floor(state.body.x), Math.floor(state.body.y), ctx.foodReach) >= 0) {
      firstContactTick = t;
    }
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [] };
}

function runBaselineFly(state, ctx) {
  const motor = createBaselineMotor(state.brainSeed);
  const start = nearestFlower(ctx.points, state.body.x, state.body.y);
  let firstContactTick = null;
  // ADR 007 Acceptance, Gate C metric 8 (avoid): tracked for every arm, including baseline, since avoid is
  // reported against the random walk. Harmless extra compute for a plain (non-wide) comparison run.
  const dangerRecords = ctx.dangerAt ? [] : undefined;
  const heatRecords = ctx.heatAt ? [] : undefined;
  for (let t = 0; t < ctx.ticks; t++) {
    stepBody(state.body, motor.next(), ctx.env);
    // Found: inside a flower's eating area (flies.food.reach, spec 017 BUG-002), the same rule as every brain arm.
    if (firstContactTick === null && flowerAt(ctx.world, Math.floor(state.body.x), Math.floor(state.body.y), ctx.foodReach) >= 0) {
      firstContactTick = t;
    }
    dangerRecords?.push({ distance: ctx.dangerAt.distanceAt(state.body.x, state.body.y) });
    heatRecords?.push({ distance: ctx.heatAt.distanceAt(state.body.x, state.body.y) });
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [], dangerRecords, heatRecords };
}

// Wide-I/O cohort (ADR 007 Acceptance, Gate C): forageEnvWide/senseForagerFlyWide sensing, the shared
// applyForagerMotor physics (body.js/forager-step.js, unedited), plus the extra per-tick records metrics.js's
// brake/avoid/touch/escape (telemetry) need.
function runWideCohort(seeded, cohortEnergy, brainConfig, ctx) {
  const flowers = createFood(ctx.world, ctx.f);
  const capabilities = brainConfig.snapshot.capabilities ?? ctx.capabilities;
  const env = forageEnvWide(ctx.f, ctx.world, flowers, capabilities);
  const inputs = capabilities.channels.inputs;
  const touchLeftIdx = inputs.findIndex((ch) => ch.sense === 'touch' && ch.side === 'L');
  const touchRightIdx = inputs.findIndex((ch) => ch.sense === 'touch' && ch.side === 'R');
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    const brakeRecords = [];
    const dangerRecords = ctx.dangerAt ? [] : undefined;
    const heatRecords = ctx.heatAt ? [] : undefined;
    const touchRecords = [];
    const escapeRecords = [];
    for (let t = 0; t < ctx.ticks; t++) {
      const { inputs: senseInputs, hunger } = senseForagerFlyWide(state, env);
      const out = brain.step({ inputs: senseInputs, hunger });
      const motor = { tick: state.tick, inputs: out.inputs, outputs: out.outputs, spikes: out.spikes };
      // The mouth site has no offset (ADR 007 W8): "on a flower" is the body's own cell, same test applyForagerMotor
      // already uses for the taste contact sense, sampled before the body moves this tick.
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      const onFlower = ctx.world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0;
      const entry = applyForagerMotor(state, motor, env);
      brakeRecords.push({ forward: entry.drives.forward ?? 0, onFlower });
      const { x, y } = state.body;
      dangerRecords?.push({ distance: ctx.dangerAt.distanceAt(x, y) });
      heatRecords?.push({ distance: ctx.heatAt.distanceAt(x, y) });
      touchRecords.push({
        touchLeft: touchLeftIdx >= 0 ? senseInputs[touchLeftIdx] : 0,
        touchRight: touchRightIdx >= 0 ? senseInputs[touchRightIdx] : 0,
        turnLeft: entry.drives.turnLeft ?? 0, turnRight: entry.drives.turnRight ?? 0,
      });
      escapeRecords.push({
        escape: entry.drives.escape ?? 0,
        inDanger: Boolean(ctx.dangerAt?.inRange(x, y) || ctx.heatAt?.inRange(x, y)),
      });
      if (firstContactTick === null && onFlower) firstContactTick = t;
    }
    return {
      found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: state.bouts,
      contacts: state.body.contacts, brakeRecords, dangerRecords, heatRecords, touchRecords, escapeRecords,
    };
  });
}

// v3 cohort (ADR 010 Part K): the decoder (D27–D29) and body layer (W12–W14) replace applyForagerMotor. The
// same bodyLayerCfg object is passed to every arm that reaches here — Principle III/VI's "the body layer MUST
// be identical across every arm" — and `decoderFile` is this arm's own C2-derived decoder (B uses the real
// snapshot's; RG uses one computed by the identical C2 rule against the rewired snapshot, decoder-engine.mjs).
function runV3Cohort(seeded, cohortEnergy, brainConfig, decoderFile, bodyLayerCfg, ctx) {
  const flowers = createFood(ctx.world, ctx.f);
  const capabilities = brainConfig.snapshot.capabilities ?? ctx.capabilities;
  const env = { ...forageEnvWide(ctx.f, ctx.world, flowers, capabilities), flowers, foodConfig: ctx.f.food, energyConfig: ctx.f.body.energy };
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    initBodyLayerFly(state, state.brainSeed);
    const decoderState = createDecoderState(decoderFile, capabilities.channels.inputs);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    const dangerRecords = ctx.dangerAt ? [] : undefined;
    const heatRecords = ctx.heatAt ? [] : undefined;
    const feedRecords = [];
    for (let t = 0; t < ctx.ticks; t++) {
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      const flower = flowerAt(ctx.world, cx, cy, ctx.foodReach);
      const onFlower = flower >= 0 && flowers.stockAt(flower % ctx.world.width, Math.floor(flower / ctx.world.width)) > 0;
      stepForagerFlyV3(state, env, brain, decoderState, decoderFile, bodyLayerCfg);
      const { x, y } = state.body;
      dangerRecords?.push({ distance: ctx.dangerAt.distanceAt(x, y) });
      heatRecords?.push({ distance: ctx.heatAt.distanceAt(x, y) });
      feedRecords.push({ onFlower, eating: Boolean(state.eating) });
      if (firstContactTick === null && onFlower) firstContactTick = t;
    }
    return {
      found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: state.bouts,
      contacts: state.body.contacts, dangerRecords, heatRecords, feedRecords,
    };
  });
}

// The flies of one v1 cohort share one flower table, as the browser does. Each fly is run to the end of the run.
function runV1Cohort(seeded, cohortEnergy, brainConfig, ctx) {
  const flowers = createFood(ctx.world, ctx.f);
  // Each arm's own snapshot declaration, not ctx.capabilities: a "v1-11k" arm run alongside a "wide" one (ADR 007
  // Acceptance) has a different channel count/shape than the world's own primary snapshot.
  const env = forageEnv(ctx.f, ctx.world, flowers, brainConfig.snapshot.capabilities ?? ctx.capabilities);
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    for (let t = 0; t < ctx.ticks; t++) {
      stepForagerFly(state, env, brain);
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      if (firstContactTick === null && ctx.world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0) {
        firstContactTick = t;
      }
    }
    return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: state.bouts, contacts: state.body.contacts };
  });
}

// Runs every arm over the seeds. Returns { rows, arms } where rows is one entry per seed and arms the metrics per arm.
// snapshots is an optional { armName: snapshot } map for named v1-style arms beyond 'v1' itself (ADR 006 Gate C:
// e.g. 'class-seed-11k', 'v1-selection-rules' — each its own container v4 snapshot, run with the unchanged v1
// cohort logic below). 'v1' falls back to the primary `snapshot` when it is not in the map, so every existing
// caller (which never passes `snapshots`) keeps running exactly as before.
// decoders: { v3: decoderFile, 'random-matched-wide-v3': decoderFile } — each arm's own C2-derived decoder-v1
// object (ADR 010 Part K: RG runs the IDENTICAL C2 rule against its own snapshot, decoder-engine.mjs's runC2).
// rgSnapshot: the ONE matched random graph RG runs on throughout Part K, rewired once (not reseeded per
// experiment seed, unlike v1/v2's older 'random-matched'/'random-matched-wide' arms) — the RG decoder's pools
// are selected against this exact graph, so re-rewiring per seed would make them meaningless (research.md §8).
export function runForagerArms({
  f, world, expConfig, snapshot, v0Snapshot, snapshots = {}, arms, seeds, ticks, capabilities,
  decoders = {}, rgSnapshot,
}) {
  // The v0 arm runs the small snapshot (version 3) with the v0 runner, passed as v0Snapshot. It is not the forager one.
  if (arms.includes('v0') && (v0Snapshot === undefined || v0Snapshot.version !== 3)) {
    throw new Error('the v0 arm needs the small snapshot (version 3), brains/smallest-functional-brain.brain');
  }
  // "wide" and "random-matched-wide" (ADR 007 Acceptance) are their own dispatch, disjoint from the v1-style
  // named snapshots a caller may also pass in `snapshots`.
  const wideStyleArms = new Set(['wide', 'random-matched-wide']);
  const v3StyleArms = new Set(['v3', 'random-matched-wide-v3']);
  const v1StyleArms = new Set(['v1', 'random-matched', ...Object.keys(snapshots).filter((k) => !wideStyleArms.has(k))]);
  const snapshotFor = (arm) => snapshots[arm] ?? snapshot;
  const rgSnapshotOnce = arms.includes('random-matched-wide-v3') ? (rgSnapshot ?? rewire(snapshots.wide ?? snapshot, 0x52470001)) : null;
  // Principle III/VI: "the body layer MUST be identical across every arm" — one object, reference-equal,
  // passed unchanged to every v3-style cohort below (tests/forager-arms-v3.test.mjs checks this mechanically).
  const bodyLayerCfg = { locomotion: f.body.locomotion, escape: f.body.escape, backup: f.body.backup, motor: f.body.motor };
  const ctx = {
    f,
    world,
    ticks,
    // flies.food.reach (spec 017 BUG-002): the eating area, shared by the find metric of every arm. 0 for v1/v2.
    foodReach: f.food?.reach ?? 0,
    capabilities,
    points: [...world.stimulusCells.keys()].map((idx) => ({
      x: (idx % world.width) + 0.5,
      y: Math.floor(idx / world.width) + 0.5,
    })),
    dangerAt: hazardLocator(world, f.stimuli?.['odour:danger'], ['spider']),
    heatAt: hazardLocator(world, f.stimuli?.heat, ['lantern']),
    env: {
      dt: 1 / f.tickHz,
      maxSpeed: f.body.maxSpeed,
      turnRate: f.body.turnRate,
      width: world.width,
      height: world.height,
      isWalkable: world.walkable,
      isStimulusCell: world.isStimulusCell,
    },
  };
  const result = Object.fromEntries(arms.map((arm) => [arm, { flies: [], cohorts: {} }]));

  for (const seed of seeds) {
    const seeded = { ...expConfig, flies: { ...expConfig.flies, seed } };
    for (const arm of arms) {
      const bucket = result[arm];
      if (arm === 'baseline') {
        for (const state of spawnFlies(seeded, world, 'baseline')) bucket.flies.push(runBaselineFly(state, ctx));
        continue;
      }
      if (wideStyleArms.has(arm)) {
        const arm_snapshot = arm === 'random-matched-wide'
          ? rewire(snapshots.wide ?? snapshot, seed + 1)
          : snapshotFor(arm);
        const brainConfig = { ...f.brain, lif: scopedLif(f.brain.lif, arm_snapshot), snapshot: arm_snapshot };
        for (const [cohort, energy] of [['main', f.body.energy.initial], ['hungry', COHORT_ENERGY.hungry], ['sated', COHORT_ENERGY.sated]]) {
          const flies = runWideCohort(seeded, energy, { ...brainConfig, version: 'v2' }, ctx);
          (bucket.cohorts[cohort] ??= []).push(...flies);
          if (cohort === 'main') bucket.flies.push(...flies);
        }
        continue;
      }
      if (v3StyleArms.has(arm)) {
        const arm_snapshot = arm === 'random-matched-wide-v3' ? rgSnapshotOnce : snapshotFor(arm);
        const decoderFile = decoders[arm];
        if (!decoderFile) throw new Error(`arm "${arm}" needs its own decoder-v1 object in runForagerArms({ decoders })`);
        // D32: the world's hunger threshold and gain overrides reach every v3-style arm's brain, as fly-host.js
        // folds them into the worker's brain payload in the browser.
        const brainConfig = { ...f.brain, lif: scopedLif(f.brain.lif, arm_snapshot), snapshot: arm_snapshot, version: 'v3', modulators: f.modulators };
        // Diagnostic only (tests/forager-arms-v3.test.mjs): the mechanical check that every v3-style arm receives
        // the identical bodyLayerCfg reference, not a per-arm copy.
        bucket.bodyLayerCfg = bodyLayerCfg;
        for (const [cohort, energy] of [['main', f.body.energy.initial], ['hungry', COHORT_ENERGY.hungry], ['sated', COHORT_ENERGY.sated]]) {
          const flies = runV3Cohort(seeded, energy, brainConfig, decoderFile, bodyLayerCfg, ctx);
          (bucket.cohorts[cohort] ??= []).push(...flies);
          if (cohort === 'main') bucket.flies.push(...flies);
        }
        continue;
      }
      if (v1StyleArms.has(arm)) {
        const arm_snapshot = arm === 'random-matched' ? rewire(snapshot, seed + 1) : snapshotFor(arm);
        const brainConfig = { ...f.brain, lif: scopedLif(f.brain.lif, arm_snapshot), snapshot: arm_snapshot };
        for (const [cohort, energy] of [['main', f.body.energy.initial], ['hungry', COHORT_ENERGY.hungry], ['sated', COHORT_ENERGY.sated]]) {
          const flies = runV1Cohort(seeded, energy, { ...brainConfig, version: 'v1' }, ctx);
          (bucket.cohorts[cohort] ??= []).push(...flies);
          if (cohort === 'main') bucket.flies.push(...flies);
        }
        continue;
      }
      // mock (toy random graph) and v0 (the small snapshot)
      const brainConfig = arm === 'mock'
        ? { neuronCount: f.brain.neuronCount ?? 40, outDegree: f.brain.outDegree ?? 4,
            inhibitoryFraction: f.brain.inhibitoryFraction ?? 0.2, motorSmoothing: f.brain.motorSmoothing ?? 0.05,
            lif: f.brain.lif?.synapticScale !== undefined ? { synapticScale: f.brain.lif.synapticScale } : {} }
        : { snapshot: v0Snapshot, motorSmoothing: f.brain.motorSmoothing ?? 0.05 };
      for (const state of spawnFlies(seeded, world, 'toy')) bucket.flies.push(runV0Fly(state, brainConfig, ctx));
    }
  }
  return result;
}

// K2/K4 (Part K, v3-style arms): calls `fn` once per fly's own record array (never flatMap'd — a window must not
// cross a fly boundary, same rule touchTurn already follows) and pools the two named counter fields across flies
// into one rate. Null when no fly carries the record key, or the pooled denominator is 0.
function poolPerFly(flies, recordKey, fn, [denomField, numField]) {
  if (flies[0]?.[recordKey] === undefined) return null;
  let denom = 0;
  let num = 0;
  for (const fly of flies) {
    const r = fn(fly[recordKey]);
    denom += r[denomField];
    num += r[numField];
  }
  return { rate: denom ? num / denom : null, [denomField]: denom, [numField]: num };
}

// The metrics of each arm, from the flies of its main cohort and its hungry and sated cohorts.
export function armMetrics(arms, result, radius, seed) {
  const out = {};
  for (const arm of Object.keys(result)) {
    const { flies, cohorts } = result[arm];
    const hungry = cohorts.hungry ?? [];
    const sated = cohorts.sated ?? [];
    const bouts = [...hungry, ...sated].flatMap((fly) => fly.bouts);
    // Metrics 6-10 (ADR 007 Acceptance, Gate C) are only present for arms whose flies carry the extra per-tick
    // records (runWideCohort/runBaselineFly); a v1-style arm's flies have neither key.
    const hasBrake = hungry[0]?.brakeRecords !== undefined;
    const hasTouch = flies[0]?.touchRecords !== undefined;
    const hasEscape = flies[0]?.escapeRecords !== undefined;
    out[arm] = {
      find: findRate(flies),
      findCI: findInterval(flies, seed),
      // K1 (SC-001): find-rate 95% CI per cohort — a hungry fly's lower bound must clear the random walk's; a
      // sated one must not.
      findHungry: cohorts.hungry ? findRate(hungry) : null,
      findHungryCI: cohorts.hungry ? findInterval(hungry, seed) : null,
      findSated: cohorts.sated ? findRate(sated) : null,
      findSatedCI: cohorts.sated ? findInterval(sated, seed) : null,
      approach: approachMedian(flies, radius),
      eatHungry: eatMedian(hungry.flatMap((fly) => fly.bouts)),
      eatSated: eatMedian(sated.flatMap((fly) => fly.bouts)),
      walked: walkedShare(bouts),
      hungerDependence: cohorts.hungry ? hungerDependence(hungry, sated) : null,
      contacts: flies.reduce((sum, fly) => sum + (fly.contacts ?? 0), 0),
      brake: hasBrake ? brakeMedian(hungry.flatMap((fly) => fly.brakeRecords)) : null,
      stay: hasBrake ? stayMedian(bouts) : null,
      // BUG-001: n/a (null) when the world has no source for the sense, or the arm records none (v1-style arms).
      avoidDanger: flies[0]?.dangerRecords ? avoidFraction(flies.flatMap((fly) => fly.dangerRecords), AVOID_RADIUS) : null,
      avoidHeat: flies[0]?.heatRecords ? avoidFraction(flies.flatMap((fly) => fly.heatRecords), AVOID_RADIUS) : null,
      // touchTurn is per-fly (the window must not cross a fly boundary), averaged over flies that had an event.
      touch: hasTouch ? (() => {
        const perFly = flies.map((fly) => touchTurn(fly.touchRecords)).filter((v) => v !== null);
        return perFly.length ? perFly.reduce((a, b) => a + b, 0) / perFly.length : null;
      })() : null,
      escape: hasEscape ? escapeMean(flies.flatMap((fly) => fly.escapeRecords)) : null,
      // K2 (SC-002): hungry arrivals at food followed by feeding within 50 ticks.
      feedWithin: poolPerFly(hungry, 'feedRecords', (r) => feedArrivalWithin(r, 50), ['arrivals', 'fed']),
      // K4 (SC-003): danger-ring encounters followed by escape or turn-away within 20 ticks.
      escapeWithin: poolPerFly(flies, 'dangerRecords', (r) => escapeOrTurnWithin(r, AVOID_RADIUS, 20), ['encounters', 'resolved']),
    };
  }
  return out;
}

const pct = (x) => `${(x * 100).toFixed(1)} %`;
const num = (x) => (x === null || x === undefined ? 'n/a' : Number.isInteger(x) ? String(x) : x.toFixed(2));

// The table of ADR 003 / contracts/experiment-metrics.md, with the verdict of each expectation.
export function printForagerTable(metrics, seeds) {
  const lines = [];
  const hasWide = Object.values(metrics).some((m) => m.brake !== null || m.avoidDanger !== null || m.avoidHeat !== null);
  const header = 'arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds';
  lines.push(hasWide
    ? `${header}   brake  stay   avoid(danger/heat)      touch   escape(in/out)`
    : header);
  for (const [arm, m] of Object.entries(metrics)) {
    const [lo, hi] = m.findCI;
    let line = `${arm.padEnd(16)} ${pct(m.find.rate).padEnd(8)} [${pct(lo)}, ${pct(hi)}]`.padEnd(48)
      + `${num(m.approach.median).padEnd(10)}`
      + `${num(m.eatHungry)}/${num(m.eatSated)}`.padEnd(18)
      + `${m.walked === undefined ? 'n/a' : pct(m.walked)}`.padEnd(9)
      + `${m.hungerDependence === null ? 'n/a' : pct(m.hungerDependence)}`.padEnd(12)
      + `${m.contacts}`.padEnd(10)
      + `${seeds}`;
    if (hasWide) {
      line += `   ${num(m.brake).padEnd(7)}${num(m.stay).padEnd(7)}`
        + `${m.avoidDanger === null ? 'n/a' : pct(m.avoidDanger)}/${m.avoidHeat === null ? 'n/a' : pct(m.avoidHeat)}`.padEnd(24)
        + `${num(m.touch)}`.padEnd(8)
        + `${m.escape === null ? 'n/a' : `${num(m.escape.inside)}/${num(m.escape.outside)}`}`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// The expectations of Gate C. Each is printed as PASS or FAIL with its values. Nothing is adjusted to pass.
// The five ADR 003 verdicts for one named arm (v1 or wide), against the random walk.
function coreVerdicts(name, m, base) {
  const out = [];
  if (base) {
    out.push({ metric: 'find', expectation: `${name} find rate exceeds the random walk`,
      pass: m.find.rate > base.find.rate, values: `${name} ${pct(m.find.rate)}, baseline ${pct(base.find.rate)}` });
  }
  out.push({ metric: 'eat', expectation: 'median bout is longer for hungry starts than for sated starts',
    pass: m.eatHungry !== null && m.eatSated !== null && m.eatHungry > m.eatSated,
    values: `hungry ${num(m.eatHungry)}, sated ${num(m.eatSated)} ticks` });
  out.push({ metric: 'hunger dependence', expectation: 'find rate is higher for hungry starts',
    pass: m.hungerDependence !== null && m.hungerDependence > 0, values: pct(m.hungerDependence) });
  out.push({ metric: 'approach', expectation: 'measured (no threshold in the spec)', pass: null,
    values: `median ${num(m.approach.median)} ticks, ${m.approach.included} included, ${m.approach.excluded} excluded` });
  out.push({ metric: 'leave', expectation: 'measured (no threshold in the spec)', pass: null,
    values: `walked ${pct(m.walked)}` });
  return out;
}

// ADR 007 Acceptance, Gate C metrics 6-10: brake/eat must pass for the wide arm; avoid-heat must not exceed the
// random walk; stay/avoid-danger/touch/escape are reported, never gated (a failed metric is a finding, not
// adjusted to pass -- AGENTS.md).
function wideVerdicts(wide, randomMatchedWide, v1eleven, base) {
  const out = [];
  if (randomMatchedWide) {
    out.push({
      metric: 'brake', expectation: 'forward on-flower/off-flower ratio is < 1 and lower than random-matched-wide',
      pass: wide.brake !== null && wide.brake < 1 && (randomMatchedWide.brake === null || wide.brake < randomMatchedWide.brake),
      values: `wide ${num(wide.brake)}, random-matched-wide ${num(randomMatchedWide.brake)}`,
    });
  }
  if (base) {
    out.push({
      metric: 'avoid heat', expectation: 'heat fraction of ticks is not higher than the random walk',
      pass: wide.avoidHeat !== null && base.avoidHeat !== null && wide.avoidHeat <= base.avoidHeat,
      values: `wide ${wide.avoidHeat === null ? 'n/a' : pct(wide.avoidHeat)}, baseline ${base.avoidHeat === null ? 'n/a' : pct(base.avoidHeat)}`,
    });
    out.push({
      metric: 'avoid danger', expectation: 'measured only (sign depends on hop count, not gated -- ADR 007 Annex A5)',
      pass: null, values: `wide ${wide.avoidDanger === null ? 'n/a' : pct(wide.avoidDanger)}, baseline ${base.avoidDanger === null ? 'n/a' : pct(base.avoidDanger)}`,
    });
  }
  out.push({ metric: 'touch', expectation: 'measured only (no threshold in the spec); positive is toward the touched side',
    pass: null, values: num(wide.touch) });
  out.push({ metric: 'stay', expectation: `measured only, against v1-11k`, pass: null,
    values: `wide ${num(wide.stay)}, v1-11k ${num(v1eleven?.stay)}` });
  out.push({ metric: 'escape (telemetry)', expectation: 'reported only, excluded from the behaviour claims (ADR 007 D17)',
    pass: null, values: `inside ${num(wide.escape?.inside)}, outside ${num(wide.escape?.outside)}` });
  return out;
}

// ADR 010 Part K, spec.md SC-001-SC-005: the demo forager's five gates (R1-R3) against the random walk (RW), plus
// K9 — the random-matched-wide-v3 graph (RG)'s pass/fail on each gate, reported alongside and never hidden
// (FR-024, constitution VI). Nothing here is adjusted to pass (AGENTS.md "Behaviour failures are findings").
function v3Verdicts(v3, rg, base) {
  const out = [];
  const rgPass = (label, pass) => (rg ? ` (K9: random-matched-wide-v3 ${pass ? 'also passes' : 'does not pass'} ${label})` : '');

  if (base && v3.findHungryCI && v3.findSatedCI) {
    const hungryPass = v3.findHungryCI[0] > base.find.rate;
    const satedPass = !(v3.findSatedCI[0] > base.find.rate);
    const rgHungryPass = rg?.findHungryCI ? rg.findHungryCI[0] > base.find.rate : null;
    out.push({
      metric: 'K1 find (hungry)', expectation: 'SC-001: hungry find-rate 95% CI sits strictly above the random walk',
      pass: hungryPass,
      values: `hungry [${pct(v3.findHungryCI[0])}, ${pct(v3.findHungryCI[1])}], baseline ${pct(base.find.rate)}`
        + (rg ? rgPass('K1', rgHungryPass) : ''),
    });
    out.push({
      metric: 'K1 find (sated)', expectation: 'SC-001: the same fly started sated does not clear that bar',
      pass: satedPass,
      values: `sated [${pct(v3.findSatedCI[0])}, ${pct(v3.findSatedCI[1])}], baseline ${pct(base.find.rate)}`,
    });
  }
  if (v3.feedWithin) {
    const pass = v3.feedWithin.rate !== null && v3.feedWithin.rate >= 0.8;
    out.push({
      metric: 'K2 feed within 50 ticks', expectation: 'SC-002: at least 80% of hungry arrivals feed within 50 ticks',
      pass, values: `${v3.feedWithin.fed}/${v3.feedWithin.arrivals} (${num(v3.feedWithin.rate)})${rgPass('K2', rg?.feedWithin?.rate >= 0.8)}`,
    });
  }
  if (v3.escapeWithin) {
    const pass = v3.escapeWithin.rate !== null && v3.escapeWithin.rate >= 0.9;
    out.push({
      metric: 'K4 escape or turn within 20 ticks', expectation: 'SC-003: at least 90% of danger-ring encounters resolve within 20 ticks',
      pass, values: `${v3.escapeWithin.resolved}/${v3.escapeWithin.encounters} (${num(v3.escapeWithin.rate)})${rgPass('K4', rg?.escapeWithin?.rate >= 0.9)}`,
    });
  }
  if (base && v3.avoidDanger !== null && base.avoidDanger !== null) {
    const pass = v3.avoidDanger <= base.avoidDanger / 2;
    out.push({
      metric: 'K5 avoid danger', expectation: 'SC-004: time inside danger rings is at most half the random walk\'s',
      pass, values: `v3 ${pct(v3.avoidDanger)}, baseline ${pct(base.avoidDanger)}${rgPass('K5', rg?.avoidDanger !== null && rg?.avoidDanger <= base.avoidDanger / 2)}`,
    });
  }
  if (base && v3.avoidHeat !== null && base.avoidHeat !== null) {
    const pass = v3.avoidHeat < base.avoidHeat;
    out.push({
      metric: 'K6 avoid heat', expectation: 'SC-005: time inside heat rings is lower than the random walk\'s (SHOULD, not MUST)',
      pass, values: `v3 ${pct(v3.avoidHeat)}, baseline ${pct(base.avoidHeat)}${rgPass('K6', rg?.avoidHeat !== null && rg?.avoidHeat < base.avoidHeat)}`,
    });
  }
  return out;
}

export function verdicts(metrics) {
  const base = metrics.baseline;
  const out = [];
  if (metrics.v1) out.push(...coreVerdicts('v1', metrics.v1, base));
  if (metrics.wide) {
    out.push(...coreVerdicts('wide', metrics.wide, base));
    out.push(...wideVerdicts(metrics.wide, metrics['random-matched-wide'], metrics['v1-11k'], base));
  }
  if (metrics.v3) out.push(...v3Verdicts(metrics.v3, metrics['random-matched-wide-v3'], base));
  return out;
}

export { bootstrapCI };
