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
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';
import { senseAt } from '../public/js/fly/stimulus.js';
import { spawnFlies } from '../public/js/fly/fly-world.js';
import {
  approachMedian, bootstrapCI, eatMedian, findInterval, findRate, hungerDependence, walkedShare,
} from '../public/js/fly/metrics.js';
import { createPrng } from '../public/js/world/prng.js';

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
  for (let t = 0; t < ctx.ticks; t++) {
    stepBody(state.body, motor.next(), ctx.env);
    if (firstContactTick === null && ctx.world.isStimulusCell(Math.floor(state.body.x), Math.floor(state.body.y))) {
      firstContactTick = t;
    }
  }
  return { found: firstContactTick !== null, startDistance: start, firstContactTick, bouts: [] };
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

  for (const seed of seeds) {
    const seeded = { ...expConfig, flies: { ...expConfig.flies, seed } };
    for (const arm of arms) {
      const bucket = result[arm];
      if (arm === 'baseline') {
        for (const state of spawnFlies(seeded, world, 'baseline')) bucket.flies.push(runBaselineFly(state, ctx));
        continue;
      }
      if (arm === 'v1' || arm === 'random-matched') {
        const brainConfig = arm === 'v1'
          ? { ...f.brain, snapshot }
          : { ...f.brain, snapshot: rewire(snapshot, seed + 1) };
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
    out[arm] = {
      find: findRate(flies),
      findCI: findInterval(flies, seed),
      approach: approachMedian(flies, radius),
      eatHungry: eatMedian(hungry.flatMap((fly) => fly.bouts)),
      eatSated: eatMedian(sated.flatMap((fly) => fly.bouts)),
      walked: walkedShare(bouts),
      hungerDependence: cohorts.hungry ? hungerDependence(hungry, sated) : null,
      contacts: flies.reduce((sum, fly) => sum + (fly.contacts ?? 0), 0),
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
  return out;
}

export { bootstrapCI };
