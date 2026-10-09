// Calibration of the forager brain's LIF settings (ADR 003 Q5; T096; ADR 005 recalibration protocol). Runs the main
// cohort of the v1 arm over the CALIBRATION seeds (experiment.seeds), never the held-out seeds, for each setting of
// a small grid. Prints one row per setting and writes the table with --json=<file>. The chosen setting is recorded
// in specs/008-hungry-forager-brain/calibration.md with the reason.
//
// ADR 005 extends the grid with outputScale (as a uniform multiplier of the shipped per-channel map),
// noiseAmplitude (L7), and stimulus.resting (D6) — the weight-rule change (postFractionAbsolute) makes every
// prior synapticScale/outputScale number stale, since the weights behind them are no longer uniformly near 1.
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
import { forageEnv, initForagerFly, stepForagerFly, driveValues } from '../public/js/fly/forager-step.js';
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

// The grid. Every other setting is the world file's value. Each entry is { lif, stimulus } overrides.
// outputScale.forward is swept on its own (BUG-002's per-channel independence); feed/backward/turn-* stay at
// their shipped absolute values — tauAdapt/adaptStep also stay at their shipped values (protocol step 3).
const SHIPPED_OUTPUT_SCALE = { feed: 30, forward: 2, backward: 5, 'turn-left': 5, 'turn-right': 5 };

// 2026-10-09 recalibration pass (ADR 005): this region (synapticScale ~125-175, outputScale.forward ~3-5,
// noiseAmplitude ~0.1-0.2, resting 0.05) is the best found so far on calibration seeds, but no point in it has
// passed held-out validation yet (specs/008-hungry-forager-brain/calibration.md, 2026-10-09 entry) — eat bouts
// are short (~2 ticks) even at noiseAmplitude: 0, pointing at the new weight distribution's heterogeneity
// (D4') rather than L7 noise as the destabilizer. Left here as the next starting point, not a validated default.
const GRID = [];
for (const synapticScale of [125, 150, 175]) {
  for (const forward of [3, 4, 5]) {
    for (const noiseAmplitude of [0.1, 0.2]) {
      for (const resting of [0.05]) {
        GRID.push({
          lif: {
            synapticScale, noiseAmplitude,
            outputScale: { ...SHIPPED_OUTPUT_SCALE, forward },
          },
          stimulus: { resting },
          label: { synapticScale, outputMult: forward, noiseAmplitude, resting },
        });
      }
    }
  }
}

// One setting over the calibration seeds: the main cohort only. Returns the counts that decide the choice.
// far-forward/far-feed and near-forward/near-feed (ADR 004 Annex A.2; ADR 005 recalibration protocol step 2(a)):
// the mean forward/feed drive while the fly is away from food ("far") vs standing on a stocked stimulus cell
// ("near") — the saturation diagnostic that shows whether the principal pathway has headroom below the firing
// ceiling, or sits pinned near 1.0 regardless of distance to food.
function evaluate(lif, stimulus = {}) {
  const brainConfig = { ...f.brain, snapshot, version: 'v1', lif: { ...f.brain.lif, ...lif } };
  const fRun = { ...f, stimulus: { ...f.stimulus, ...stimulus } };
  const flies = [];
  const sat = { farForward: 0, farFeed: 0, farCount: 0, nearForward: 0, nearFeed: 0, nearCount: 0 };
  for (const seed of fRun.experiment.seeds) {
    const seeded = { ...config, flies: { ...config.flies, seed } };
    const flowers = createFood(world, fRun);
    const env = forageEnv(fRun, world, flowers, snapshot.capabilities);
    for (const state of spawnFlies(seeded, world, 'toy')) {
      const brain = createFlyBrain(brainConfig, state.brainSeed);
      initForagerFly(state, f.body.energy.initial);
      let first = null;
      for (let t = 0; t < ticks; t++) {
        const { motor } = stepForagerFly(state, env, brain);
        const drives = driveValues(motor.outputs, env.drives);
        const cx = Math.floor(state.body.x);
        const cy = Math.floor(state.body.y);
        const near = world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0;
        if (near) {
          sat.nearForward += drives.forward ?? 0;
          sat.nearFeed += drives.feed ?? 0;
          sat.nearCount++;
        } else {
          sat.farForward += drives.forward ?? 0;
          sat.farFeed += drives.feed ?? 0;
          sat.farCount++;
        }
        if (first === null && near) first = t;
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
    'far-forward': sat.farCount ? sat.farForward / sat.farCount : null,
    'far-feed': sat.farCount ? sat.farFeed / sat.farCount : null,
    'near-forward': sat.nearCount ? sat.nearForward / sat.nearCount : null,
    'near-feed': sat.nearCount ? sat.nearFeed / sat.nearCount : null,
  };
}

const rows = [];
const fmt = (v) => (v === null ? '   -  ' : v.toFixed(3).padStart(6));
console.log(`calibration on seeds ${f.experiment.seeds.join(', ')} (main cohort, ${ticks} ticks)`);
console.log('scale outMult noise resting | found/flies  find   bouts  eat ticks  far-fwd far-feed near-fwd near-feed');
for (const [index, point] of GRID.entries()) {
  if (index % shardN !== shardK) continue;
  const { lif, stimulus, label } = point;
  const r = evaluate(lif, stimulus);
  rows.push({ lif, stimulus, ...r });
  console.log(`${String(label.synapticScale).padStart(5)} ${String(label.outputMult).padStart(7)} ${String(label.noiseAmplitude).padStart(5)} `
    + `${String(label.resting).padStart(7)} | ${String(r.found).padStart(5)}/${r.flies}  ${(r.find * 100).toFixed(1).padStart(5)} %`
    + `  ${String(r.bouts).padStart(5)}  ${String(r.eatTicks).padStart(8)}  ${fmt(r['far-forward'])}  ${fmt(r['far-feed'])}`
    + `  ${fmt(r['near-forward'])}  ${fmt(r['near-feed'])}`);
}
if (jsonPath) {
  writeFileSync(jsonPath, `${JSON.stringify({ seeds: f.experiment.seeds, ticks, shard: [shardK, shardN], rows }, null, 2)}\n`);
  console.log(`written to ${jsonPath}`);
}
