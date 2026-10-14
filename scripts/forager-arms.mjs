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
import { forageEnvWide, senseForagerFlyWide } from '../public/js/fly/forager-step-wide.js';
import { senseAt } from '../public/js/fly/stimulus.js';
import { hazardPoints, spawnFlies } from '../public/js/fly/fly-world.js';
import {
  approachMedian, avoidFraction, bootstrapCI, brakeMedian, eatMedian, escapeMean, findInterval, findRate,
  hungerDependence, stayMedian, touchTurn, walkedShare,
} from '../public/js/fly/metrics.js';
import { createPrng } from '../public/js/world/prng.js';

// ADR 007 Acceptance, Gate C: the fraction-of-ticks-near-a-hazard radius (metric 8), fixed regardless of a
// sense's own declared falloff radius.
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
    if (firstContactTick === null && ctx.world.isStimulusCell(Math.floor(state.body.x), Math.floor(state.body.y))) {
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
  const spiderRecords = [];
  const lanternRecords = [];
  for (let t = 0; t < ctx.ticks; t++) {
    stepBody(state.body, motor.next(), ctx.env);
    if (firstContactTick === null && ctx.world.isStimulusCell(Math.floor(state.body.x), Math.floor(state.body.y))) {
      firstContactTick = t;
    }
    spiderRecords.push({ distance: nearestFlower(ctx.spiderPoints, state.body.x, state.body.y) });
    lanternRecords.push({ distance: nearestFlower(ctx.lanternPoints, state.body.x, state.body.y) });
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [], spiderRecords, lanternRecords };
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
  const dangerRadius = ctx.f.stimuli['odour:danger']?.radius ?? 0;
  const heatRadius = ctx.f.stimuli.heat?.radius ?? 0;
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    const brakeRecords = [];
    const spiderRecords = [];
    const lanternRecords = [];
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
      const spiderDist = nearestFlower(ctx.spiderPoints, state.body.x, state.body.y);
      const lanternDist = nearestFlower(ctx.lanternPoints, state.body.x, state.body.y);
      spiderRecords.push({ distance: spiderDist });
      lanternRecords.push({ distance: lanternDist });
      touchRecords.push({
        touchLeft: touchLeftIdx >= 0 ? senseInputs[touchLeftIdx] : 0,
        touchRight: touchRightIdx >= 0 ? senseInputs[touchRightIdx] : 0,
        turnLeft: entry.drives.turnLeft ?? 0, turnRight: entry.drives.turnRight ?? 0,
      });
      escapeRecords.push({
        escape: entry.drives.escape ?? 0,
        inDanger: spiderDist <= dangerRadius || lanternDist <= heatRadius,
      });
      if (firstContactTick === null && onFlower) firstContactTick = t;
    }
    return {
      found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: state.bouts,
      contacts: state.body.contacts, brakeRecords, spiderRecords, lanternRecords, touchRecords, escapeRecords,
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
export function runForagerArms({ f, world, expConfig, snapshot, v0Snapshot, snapshots = {}, arms, seeds, ticks, capabilities }) {
  // The v0 arm runs the small snapshot (version 3) with the v0 runner, passed as v0Snapshot. It is not the forager one.
  if (arms.includes('v0') && (v0Snapshot === undefined || v0Snapshot.version !== 3)) {
    throw new Error('the v0 arm needs the small snapshot (version 3), brains/smallest-functional-brain.brain');
  }
  // "wide" and "random-matched-wide" (ADR 007 Acceptance) are their own dispatch, disjoint from the v1-style
  // named snapshots a caller may also pass in `snapshots`.
  const wideStyleArms = new Set(['wide', 'random-matched-wide']);
  const v1StyleArms = new Set(['v1', 'random-matched', ...Object.keys(snapshots).filter((k) => !wideStyleArms.has(k))]);
  const snapshotFor = (arm) => snapshots[arm] ?? snapshot;
  const ctx = {
    f,
    world,
    ticks,
    capabilities,
    points: [...world.stimulusCells.keys()].map((idx) => ({
      x: (idx % world.width) + 0.5,
      y: Math.floor(idx / world.width) + 0.5,
    })),
    spiderPoints: hazardPoints(world, ['spider']),
    lanternPoints: hazardPoints(world, ['lantern']),
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
    const hasAvoid = flies[0]?.spiderRecords !== undefined;
    const hasTouch = flies[0]?.touchRecords !== undefined;
    const hasEscape = flies[0]?.escapeRecords !== undefined;
    out[arm] = {
      find: findRate(flies),
      findCI: findInterval(flies, seed),
      approach: approachMedian(flies, radius),
      eatHungry: eatMedian(hungry.flatMap((fly) => fly.bouts)),
      eatSated: eatMedian(sated.flatMap((fly) => fly.bouts)),
      walked: walkedShare(bouts),
      hungerDependence: cohorts.hungry ? hungerDependence(hungry, sated) : null,
      contacts: flies.reduce((sum, fly) => sum + (fly.contacts ?? 0), 0),
      brake: hasBrake ? brakeMedian(hungry.flatMap((fly) => fly.brakeRecords)) : null,
      stay: hasBrake ? stayMedian(bouts) : null,
      avoidSpider: hasAvoid ? avoidFraction(flies.flatMap((fly) => fly.spiderRecords), AVOID_RADIUS) : null,
      avoidLantern: hasAvoid ? avoidFraction(flies.flatMap((fly) => fly.lanternRecords), AVOID_RADIUS) : null,
      // touchTurn is per-fly (the window must not cross a fly boundary), averaged over flies that had an event.
      touch: hasTouch ? (() => {
        const perFly = flies.map((fly) => touchTurn(fly.touchRecords)).filter((v) => v !== null);
        return perFly.length ? perFly.reduce((a, b) => a + b, 0) / perFly.length : null;
      })() : null,
      escape: hasEscape ? escapeMean(flies.flatMap((fly) => fly.escapeRecords)) : null,
    };
  }
  return out;
}

const pct = (x) => `${(x * 100).toFixed(1)} %`;
const num = (x) => (x === null || x === undefined ? 'n/a' : Number.isInteger(x) ? String(x) : x.toFixed(2));

// The table of ADR 003 / contracts/experiment-metrics.md, with the verdict of each expectation.
export function printForagerTable(metrics, seeds) {
  const lines = [];
  const hasWide = Object.values(metrics).some((m) => m.brake !== null || m.avoidSpider !== null);
  const header = 'arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds';
  lines.push(hasWide
    ? `${header}   brake  stay   avoid(spider/lantern)   touch   escape(in/out)`
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
        + `${m.avoidSpider === null ? 'n/a' : pct(m.avoidSpider)}/${m.avoidLantern === null ? 'n/a' : pct(m.avoidLantern)}`.padEnd(24)
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
      pass: wide.avoidLantern !== null && base.avoidLantern !== null && wide.avoidLantern <= base.avoidLantern,
      values: `wide ${pct(wide.avoidLantern ?? 0)}, baseline ${pct(base.avoidLantern ?? 0)}`,
    });
    out.push({
      metric: 'avoid danger', expectation: 'measured only (sign depends on hop count, not gated -- ADR 007 Annex A5)',
      pass: null, values: `wide ${pct(wide.avoidSpider ?? 0)}, baseline ${pct(base.avoidSpider ?? 0)}`,
    });
  }
  out.push({ metric: 'touch', expectation: 'measured only (no threshold in the spec); positive predicted toward the touched side',
    pass: null, values: num(wide.touch) });
  out.push({ metric: 'stay', expectation: `measured only, against v1-11k`, pass: null,
    values: `wide ${num(wide.stay)}, v1-11k ${num(v1eleven?.stay)}` });
  out.push({ metric: 'escape (telemetry)', expectation: 'reported only, excluded from the behaviour claims (ADR 007 D17)',
    pass: null, values: `inside ${num(wide.escape?.inside)}, outside ${num(wide.escape?.outside)}` });
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
  return out;
}

export { bootstrapCI };
