// Calibration of the forager brain's LIF settings (ADR 003 Q5; T096). Runs the main cohort of the v1 arm over the
// CALIBRATION seeds (experiment.seeds), never the held-out seeds, for each setting of a small grid. Prints one row per
// setting and writes the table with --json=<file>. The chosen setting is recorded in specs/008-hungry-forager-brain/
// calibration.md with the reason.
//
// Usage: node scripts/calibrate-forager.mjs [--world=world/world-forager.json] [--ticks=3000] [--json=<file>]
//                                            [--shard=k/n]   runs every n-th setting from k (0-based), for parallel runs

import { readFileSync, writeFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';
import { findRate } from '../public/js/fly/metrics.js';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const worldPath = arg('world', 'world/world-forager.json');
const ticks = Number(arg('ticks', '3000'));
const jsonPath = arg('json', null);
const [shardK, shardN] = arg('shard', '0/1').split('/').map(Number);
const webRoot = new URL('../public/', import.meta.url);
const config = JSON.parse(readFileSync(new URL(worldPath, webRoot), 'utf8'));
const errors = validateConfig(config);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path}: ${message}`);
  process.exit(1);
}
const f = resolveFlies(config);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8')));
if (validateArt(config, catalog).length > 0) process.exit(1);
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

// The grid. Every other setting is the world file's value. Each entry is a set of lif overrides.
const GRID = [];
for (const synapticScale of [10, 20, 30, 50]) {
  for (const tauSyn of [0, 5]) {
    for (const adaptation of [{ tauAdapt: 0, adaptStep: 0 }, { tauAdapt: 20, adaptStep: 0.05 }]) {
      GRID.push({ synapticScale, tauSyn, ...adaptation });
    }
  }
}

// One setting over the calibration seeds: the main cohort only. Returns the counts that decide the choice.
function evaluate(lif) {
  const brainConfig = { ...f.brain, snapshot, version: 'v1', lif: { ...f.brain.lif, ...lif } };
  const flies = [];
  for (const seed of f.experiment.seeds) {
    const seeded = { ...config, flies: { ...config.flies, seed } };
    const flowers = createFood(world, f);
    const env = forageEnv(f, world, flowers, snapshot.capabilities);
    for (const state of spawnFlies(seeded, world, 'toy')) {
      const brain = createFlyBrain(brainConfig, state.brainSeed);
      initForagerFly(state, f.body.energy.initial);
      let first = null;
      for (let t = 0; t < ticks; t++) {
        stepForagerFly(state, env, brain);
        const cx = Math.floor(state.body.x);
        const cy = Math.floor(state.body.y);
        if (first === null && world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0) first = t;
      }
      flies.push({ found: first !== null, bouts: state.bouts.length, eatTicks: state.bouts.reduce((s, b) => s + b.ticks, 0) });
    }
  }
  return {
    find: findRate(flies).rate,
    found: flies.filter((x) => x.found).length,
    bouts: flies.reduce((s, x) => s + x.bouts, 0),
    eatTicks: flies.reduce((s, x) => s + x.eatTicks, 0),
    flies: flies.length,
  };
}

const rows = [];
console.log(`calibration on seeds ${f.experiment.seeds.join(', ')} (main cohort, ${ticks} ticks)`);
console.log('synapticScale tauSyn tauAdapt adaptStep | found/flies  find   bouts  eat ticks');
for (const [index, lif] of GRID.entries()) {
  if (index % shardN !== shardK) continue;
  const r = evaluate(lif);
  rows.push({ lif, ...r });
  console.log(`${String(lif.synapticScale).padStart(12)} ${String(lif.tauSyn).padStart(7)} ${String(lif.tauAdapt).padStart(8)} `
    + `${String(lif.adaptStep).padStart(9)} | ${String(r.found).padStart(5)}/${r.flies}  ${(r.find * 100).toFixed(1).padStart(5)} %`
    + `  ${String(r.bouts).padStart(5)}  ${String(r.eatTicks).padStart(8)}`);
}
if (jsonPath) {
  writeFileSync(jsonPath, `${JSON.stringify({ seeds: f.experiment.seeds, ticks, shard: [shardK, shardN], rows }, null, 2)}\n`);
  console.log(`written to ${jsonPath}`);
}
