// ADR 001 Stage 2 metric: toy flies against a random-walk baseline, in the same world, over seeds.
// Usage: npm run experiment   (or node scripts/compare-baseline.mjs --verbose)
//
// This is a metric, not a test gate (research R12). It exits 0 with a verdict, and exits 1 only
// when world.json is invalid or has no flies section.

import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';
import { generateTerrain, placeObjects } from '../public/js/world/generate.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { createBaselineMotor } from '../public/js/fly/baseline.js';
import { stepBody } from '../public/js/fly/body.js';
import { senseAt } from '../public/js/fly/stimulus.js';

const verbose = process.argv.includes('--verbose');
const config = JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));

if (!config.flies) {
  console.error('world.json has no "flies" section; nothing to compare');
  process.exit(1);
}

// The comparison always runs toy flies, so the brain is validated even if world.json says baseline
const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
const errors = validateConfig(expConfig);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path || 'world.json'}: ${message}`);
  process.exit(1);
}

const f = resolveFlies(expConfig);
const grid = generateTerrain(config);
const { objects } = placeObjects(config, grid);
const world = buildWorld(config, grid, objects);

// Same stimulus source as the browser (fly-host.js)
const points = [...world.stimulusCells.keys()].map((idx) => ({
  x: (idx % world.width) + 0.5,
  y: Math.floor(idx / world.width) + 0.5,
}));
const env = {
  dt: 1 / f.tickHz,
  maxSpeed: f.body.maxSpeed,
  turnRate: f.body.turnRate,
  width: world.width,
  height: world.height,
  isWalkable: world.walkable,
  isStimulusCell: world.isStimulusCell,
};
const senseOf = (body) => senseAt(points, body.x, body.y, f.stimulus);

function runToy(state, ticks) {
  const brain = createFlyBrain(f.brain, state.brainSeed);
  const stats = { leftSum: 0, rightSum: 0, leftSpikes: 0, rightSpikes: 0 };
  for (let t = 0; t < ticks; t++) {
    const out = brain.step(senseOf(state.body));
    stepBody(state.body, { left: out.left, right: out.right }, env);
    stats.leftSum += out.left;
    stats.rightSum += out.right;
    stats.leftSpikes += brain.net.spikes[1];
    stats.rightSpikes += brain.net.spikes[2];
  }
  return stats;
}

function runBaseline(state, ticks) {
  const motor = createBaselineMotor(state.brainSeed);
  for (let t = 0; t < ticks; t++) stepBody(state.body, motor.next(), env);
}

const { seeds, ticks } = f.experiment;
const rows = [];

for (const seed of seeds) {
  // Each experiment seed is a complete flies.seed. The terrain and objects stay fixed.
  const seeded = { ...expConfig, flies: { ...expConfig.flies, seed } };
  const toy = spawnFlies(seeded, world, 'toy');
  const baseline = spawnFlies(seeded, world, 'baseline');

  const toyStats = toy.map((state) => ({ id: state.id, ...runToy(state, ticks) }));
  for (const state of baseline) runBaseline(state, ticks);

  rows.push({
    seed,
    toy: toy.reduce((sum, s) => sum + s.body.contacts, 0),
    baseline: baseline.reduce((sum, s) => sum + s.body.contacts, 0),
    toyStats,
  });
}

const totals = rows.reduce((a, r) => ({ toy: a.toy + r.toy, baseline: a.baseline + r.baseline }), { toy: 0, baseline: 0 });
const diff = totals.toy - totals.baseline;
const verdict = diff > 0 ? 'toy > baseline' : 'toy <= baseline';

console.log(`world seed ${config.seed}, ${f.count} flies per kind, ${ticks} ticks per fly, ` +
  `${f.brain.neuronCount} neurons, tickHz ${f.tickHz}`);
console.log('');
console.log('seed   toy contacts   baseline contacts');
for (const r of rows) {
  console.log(`${String(r.seed).padEnd(6)} ${String(r.toy).padEnd(14)} ${r.baseline}`);
}
console.log(`${'total'.padEnd(6)} ${String(totals.toy).padEnd(14)} ${totals.baseline}`);
console.log('');
console.log(`toy - baseline: ${diff >= 0 ? '+' : ''}${diff}   verdict: ${verdict}`);

if (verbose) {
  console.log('');
  console.log('per toy fly (mean motor rate over the run, and ticks on which each motor neuron spiked):');
  for (const r of rows) {
    for (const s of r.toyStats) {
      console.log(
        `  seed ${r.seed}  fly ${s.id}  ` +
        `mean LEFT ${(s.leftSum / ticks).toFixed(3)}  mean RIGHT ${(s.rightSum / ticks).toFixed(3)}  ` +
        `LEFT spiked ${s.leftSpikes} ticks  RIGHT spiked ${s.rightSpikes} ticks`,
      );
    }
  }
}
