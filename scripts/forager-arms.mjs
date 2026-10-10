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
import { forageEnv, forageEnvV2, initForagerFly, stepForagerFly, stepForagerFlyV2 } from '../public/js/fly/forager-step.js';
import { senseAt } from '../public/js/fly/stimulus.js';
import { spawnFlies, dangerPoints } from '../public/js/fly/fly-world.js';
import {
  approachMedian, avoidMetric, bootstrapCI, brakeMetric, eatMedian, escapeMetric, findInterval, findRate,
  hungerDependence, restMetric, touchMetric, walkedShare,
} from '../public/js/fly/metrics.js';
import { createPrng } from '../public/js/world/prng.js';
import { REGIONS } from '../public/js/ui/panel/counts.js';

const COHORT_ENERGY = { hungry: 0.1, sated: 0.9 };
const DANGER_KINDS = ['spider', 'lantern'];

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

// Distance from a point to the nearest flower cell centre (tiles), or Infinity without flowers.
function nearestFlower(points, x, y) {
  let best = Infinity;
  for (const p of points) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

// One fly of a v0-style arm (mock, v0, random-matched for v0): the v0 runner drives the body; find is contact.
// ticks carries only distanceToDanger, the one Gate C field that is meaningful with no v2 declaration at all
// (avoidMetric is positional, not brain-dependent — ADR 006 Gate C compares every arm, including the nulls).
function runV0Fly(state, brainConfig, ctx) {
  const brain = createFlyBrain(brainConfig, state.brainSeed);
  const start = nearestFlower(ctx.points, state.body.x, state.body.y);
  let firstContactTick = null;
  const ticks = [];
  for (let t = 0; t < ctx.ticks; t++) {
    const out = brain.step(senseAt(ctx.points, state.body.x, state.body.y, ctx.f.stimulus));
    stepBody(state.body, { left: out.left, right: out.right }, ctx.env);
    if (firstContactTick === null && ctx.world.isStimulusCell(Math.floor(state.body.x), Math.floor(state.body.y))) {
      firstContactTick = t;
    }
    ticks.push({ distanceToDanger: distanceToDangers(ctx, state.body.x, state.body.y) });
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [], ticks };
}

function runBaselineFly(state, ctx) {
  const motor = createBaselineMotor(state.brainSeed);
  const start = nearestFlower(ctx.points, state.body.x, state.body.y);
  let firstContactTick = null;
  const ticks = [];
  for (let t = 0; t < ctx.ticks; t++) {
    stepBody(state.body, motor.next(), ctx.env);
    if (firstContactTick === null && ctx.world.isStimulusCell(Math.floor(state.body.x), Math.floor(state.body.y))) {
      firstContactTick = t;
    }
    ticks.push({ distanceToDanger: distanceToDangers(ctx, state.body.x, state.body.y) });
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [], ticks };
}

// ADR 006 Gate C: per-region neuron totals of a v2/random-matched snapshot, for restMetric's per-tick fraction.
// Exported for scripts/calibrate-forager-v2.mjs's A1 regime probe (ADR 006's per-group rest/odour gates, L10).
export function regionTotals(snapshot) {
  const totals = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (const neuron of snapshot.manifest.neurons) if (neuron.group in totals) totals[neuron.group]++;
  return totals;
}

// The fraction of each region's neurons present in `spikes` (one tick's union of spikes, forager-step.js).
export function regionFractionsOf(spikes, totals, groupOf) {
  const active = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (const n of spikes) {
    const g = groupOf[n];
    if (g in active) active[g]++;
  }
  const out = {};
  for (const r of REGIONS) if (totals[r] > 0) out[r] = active[r] / totals[r];
  return out;
}

// Distance (tiles) from (x, y) to the nearest danger of each kind, or Infinity without one.
function distanceToDangers(ctx, x, y) {
  const out = {};
  for (const kind of DANGER_KINDS) {
    let best = Infinity;
    for (const p of ctx.dangerPointsByKind[kind]) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
    out[kind] = best;
  }
  return out;
}

// The flies of one v2 cohort (ADR 006). Each tick's record carries the fields public/js/fly/metrics.js's new
// Gate C metrics (brake, touch, escape, rest) read, plus avoid's distanceToDanger (shared with every arm).
function runV2Cohort(seeded, cohortEnergy, brainConfig, ctx) {
  const flowers = createFood(ctx.world, ctx.f);
  const env = forageEnvV2(ctx.f, ctx.world, flowers, ctx.capabilities);
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  const totals = regionTotals(ctx.snapshotForRegions);
  const groupOf = ctx.snapshotForRegions.manifest.neurons.map((n) => n.group);
  const inputs = ctx.capabilities.channels.inputs;
  const mouthIdx = inputs.flatMap((ch, k) => (ch.sense === 'taste:mouth' ? [k] : []));
  const touchIdx = inputs.flatMap((ch, k) => (ch.sense === 'touch' ? [k] : []));
  const outputs = ctx.capabilities.channels.outputs;
  const forwardK = outputs.findIndex((ch) => ch.drive === 'forward');

  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    const ticks = [];
    for (let t = 0; t < ctx.ticks; t++) {
      const { sense, entry } = stepForagerFlyV2(state, env, brain);
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      if (firstContactTick === null && ctx.world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0) {
        firstContactTick = t;
      }
      const distanceToDanger = distanceToDangers(ctx, state.body.x, state.body.y);
      const mouthTaste = mouthIdx.reduce((sum, k) => sum + sense.inputs[k], 0);
      const touch = touchIdx.reduce((sum, k) => sum + sense.inputs[k], 0);
      const stimulusPresent = Array.from(sense.inputs).some((v) => v > 0);
      ticks.push({
        forward: entry.drives.forward ?? 0,
        mouthTaste,
        hungry: entry.hunger > 0.5,
        touch,
        escaped: entry.escaped === true,
        nearDanger: Math.min(distanceToDanger.spider, distanceToDanger.lantern) <= 1.5,
        distanceToDanger,
        stimulusPresent,
        regionActivity: regionFractionsOf(entry.spikes, totals, groupOf),
      });
    }
    return {
      found: firstContactTick !== null, startDistance: start, firstContactTick,
      bouts: state.bouts, contacts: state.body.contacts, ticks,
    };
  });
}

// The flies of one v1 cohort share one flower table, as the browser does. Each fly is run to the end of the run.
function runV1Cohort(seeded, cohortEnergy, brainConfig, ctx) {
  const flowers = createFood(ctx.world, ctx.f);
  const env = forageEnv(ctx.f, ctx.world, flowers, ctx.capabilities);
  const flies = spawnFlies(seeded, ctx.world, 'toy');
  return flies.map((state) => {
    const brain = createFlyBrain(brainConfig, state.brainSeed);
    initForagerFly(state, cohortEnergy);
    const start = nearestFlower(ctx.points, state.body.x, state.body.y);
    let firstContactTick = null;
    const ticks = [];
    for (let t = 0; t < ctx.ticks; t++) {
      stepForagerFly(state, env, brain);
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      if (firstContactTick === null && ctx.world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0) {
        firstContactTick = t;
      }
      ticks.push({ distanceToDanger: distanceToDangers(ctx, state.body.x, state.body.y) });
    }
    return {
      found: firstContactTick !== null, startDistance: start, firstContactTick,
      bouts: state.bouts, contacts: state.body.contacts, ticks,
    };
  });
}

// Runs every arm over the seeds. Returns { rows, arms } where rows is one entry per seed and arms the metrics per arm.
export function runForagerArms({ f, world, expConfig, snapshot, v0Snapshot, arms, seeds, ticks, capabilities }) {
  // The v0 arm runs the small snapshot (version 3) with the v0 runner, passed as v0Snapshot. It is not the forager one.
  if (arms.includes('v0') && (v0Snapshot === undefined || v0Snapshot.version !== 3)) {
    throw new Error('the v0 arm needs the small snapshot (version 3), brains/smallest-functional-brain.brain');
  }
  const ctx = {
    f,
    world,
    ticks,
    capabilities,
    snapshotForRegions: snapshot,
    dangerPointsByKind: Object.fromEntries(DANGER_KINDS.map((kind) => [kind, dangerPoints(world, [kind])])),
    points: [...world.stimulusCells.keys()].map((idx) => ({
      x: (idx % world.width) + 0.5,
      y: Math.floor(idx / world.width) + 0.5,
    })),
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
  const isV2World = f.brain?.version === 'v2';

  for (const seed of seeds) {
    const seeded = { ...expConfig, flies: { ...expConfig.flies, seed } };
    for (const arm of arms) {
      const bucket = result[arm];
      if (arm === 'baseline') {
        for (const state of spawnFlies(seeded, world, 'baseline')) bucket.flies.push(runBaselineFly(state, ctx));
        continue;
      }
      if (arm === 'v1' || arm === 'v2' || arm === 'random-matched') {
        // random-matched rewires whichever snapshot this world's brain.version actually uses (ADR 006: "the
        // size-matched random-graph arm is generated against the v2 brain's neuron/edge count exactly as they
        // already are for v1").
        const useV2 = arm === 'v2' || (arm === 'random-matched' && isV2World);
        const runCohort = useV2 ? runV2Cohort : runV1Cohort;
        const version = useV2 ? 'v2' : 'v1';
        const brainConfig = arm === 'random-matched'
          ? { ...f.brain, snapshot: rewire(snapshot, seed + 1) }
          : { ...f.brain, snapshot };
        for (const [cohort, energy] of [['main', f.body.energy.initial], ['hungry', COHORT_ENERGY.hungry], ['sated', COHORT_ENERGY.sated]]) {
          const flies = runCohort(seeded, energy, { ...brainConfig, version }, ctx);
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

// The metrics of each arm, from the flies of its main cohort and its hungry and sated cohorts. The ADR 006
// Gate C metrics (brake, avoid, touch, escape, rest) read every fly's per-tick log (runV0Fly/runBaselineFly/
// runV1Cohort carry distanceToDanger only; runV2Cohort carries the full set every metric needs).
export function armMetrics(arms, result, radius, seed, tickHz = 20) {
  const out = {};
  for (const arm of Object.keys(result)) {
    const { flies, cohorts } = result[arm];
    const hungry = cohorts.hungry ?? [];
    const sated = cohorts.sated ?? [];
    const bouts = [...hungry, ...sated].flatMap((fly) => fly.bouts);
    const ticks = flies.flatMap((fly) => fly.ticks ?? []);
    out[arm] = {
      find: findRate(flies),
      findCI: findInterval(flies, seed),
      approach: approachMedian(flies, radius),
      eatHungry: eatMedian(hungry.flatMap((fly) => fly.bouts)),
      eatSated: eatMedian(sated.flatMap((fly) => fly.bouts)),
      walked: walkedShare(bouts),
      hungerDependence: cohorts.hungry ? hungerDependence(hungry, sated) : null,
      contacts: flies.reduce((sum, fly) => sum + (fly.contacts ?? 0), 0),
      // Avoid is positional: every arm's ticks carry distanceToDanger.
      avoidSpider: ticks.length ? avoidMetric(ticks, 'spider') : null,
      avoidLantern: ticks.length ? avoidMetric(ticks, 'lantern') : null,
      // Brake, touch, escape and rest need the v2 declaration (mouthTaste/touch/escaped/regionActivity);
      // absent for mock/v0/v1/baseline ticks, so these read null for them (printed as n/a, not 0 — FR-028).
      brake: ticks.some((t) => t.mouthTaste !== undefined) ? brakeMetric(ticks) : null,
      touch: ticks.some((t) => t.touch !== undefined) ? touchMetric(ticks) : null,
      escape: ticks.some((t) => t.escaped !== undefined) ? escapeMetric(ticks, tickHz) : null,
      rest: ticks.some((t) => t.regionActivity !== undefined) ? restMetric(ticks) : null,
    };
  }
  return out;
}

const pct = (x) => `${(x * 100).toFixed(1)} %`;
const num = (x) => (x === null || x === undefined ? 'n/a' : Number.isInteger(x) ? String(x) : x.toFixed(2));

// The table of ADR 003 / contracts/experiment-metrics.md, with the verdict of each expectation.
export function printForagerTable(metrics, seeds) {
  const lines = [];
  lines.push('arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds');
  for (const [arm, m] of Object.entries(metrics)) {
    const [lo, hi] = m.findCI;
    lines.push(
      `${arm.padEnd(16)} ${pct(m.find.rate).padEnd(8)} [${pct(lo)}, ${pct(hi)}]`.padEnd(48)
      + `${num(m.approach.median).padEnd(10)}`
      + `${num(m.eatHungry)}/${num(m.eatSated)}`.padEnd(18)
      + `${m.walked === undefined ? 'n/a' : pct(m.walked)}`.padEnd(9)
      + `${m.hungerDependence === null ? 'n/a' : pct(m.hungerDependence)}`.padEnd(12)
      + `${m.contacts}`.padEnd(10)
      + `${seeds}`,
    );
  }
  return lines.join('\n');
}

// ADR 006 Gate C's five new metrics, one table, every arm (FR-028: a metric that does not pass is still
// printed, with the run that produced it).
export function printGateCTable(metrics) {
  const lines = [];
  lines.push('arm              brake   avoid(spider) avoid(lantern)  touch   escape(near/away per min)  rest (per region)');
  for (const [arm, m] of Object.entries(metrics)) {
    const rest = m.rest ? Object.entries(m.rest).map(([r, v]) => `${r}=${v === null ? 'n/a' : v.toFixed(3)}`).join(' ') : 'n/a';
    lines.push(
      `${arm.padEnd(16)} ${num(m.brake).padEnd(8)}`
      + `${m.avoidSpider === null ? 'n/a' : pct(m.avoidSpider)}`.padEnd(15)
      + `${m.avoidLantern === null ? 'n/a' : pct(m.avoidLantern)}`.padEnd(16)
      + `${m.touch === null ? 'n/a' : pct(m.touch)}`.padEnd(8)
      + `${m.escape ? `${m.escape.near.toFixed(2)}/${m.escape.away.toFixed(2)}` : 'n/a'}`.padEnd(28)
      + rest,
    );
  }
  return lines.join('\n');
}

// The expectations of Gate C. Each is printed as PASS or FAIL with its values. Nothing is adjusted to pass.
export function verdicts(metrics) {
  const v1 = metrics.v1;
  const base = metrics.baseline;
  const out = [];
  if (v1 && base) {
    out.push({ metric: 'find', expectation: 'v1 find rate exceeds the random walk',
      pass: v1.find.rate > base.find.rate, values: `v1 ${pct(v1.find.rate)}, baseline ${pct(base.find.rate)}` });
  }
  if (v1) {
    out.push({ metric: 'eat', expectation: 'median bout is longer for hungry starts than for sated starts',
      pass: v1.eatHungry !== null && v1.eatSated !== null && v1.eatHungry > v1.eatSated,
      values: `hungry ${num(v1.eatHungry)}, sated ${num(v1.eatSated)} ticks` });
    out.push({ metric: 'hunger dependence', expectation: 'find rate is higher for hungry starts',
      pass: v1.hungerDependence !== null && v1.hungerDependence > 0, values: pct(v1.hungerDependence) });
    out.push({ metric: 'approach', expectation: 'measured (no threshold in the spec)', pass: null,
      values: `median ${num(v1.approach.median)} ticks, ${v1.approach.included} included, ${v1.approach.excluded} excluded` });
    out.push({ metric: 'leave', expectation: 'measured (no threshold in the spec)', pass: null,
      values: `walked ${pct(v1.walked)}` });
  }
  // ADR 006 SC-007: v2's brake ratio must be < 1 and lower than the size-matched random-graph arm's. The one
  // Gate C expectation with a required pass; avoid/touch/escape/rest are measurements (FR-028).
  const v2 = metrics.v2;
  const matched = metrics['random-matched'];
  if (v2) {
    const pass = v2.brake !== null && matched?.brake !== undefined
      && v2.brake < 1 && (matched.brake === null || v2.brake < matched.brake);
    out.push({ metric: 'brake', expectation: 'v2 brake ratio < 1 and lower than the random-graph arm (SC-007)',
      pass, values: `v2 ${num(v2.brake)}, random-matched ${num(matched?.brake)}` });
  }
  return out;
}

export { bootstrapCI };
