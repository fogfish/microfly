// ADR 001 Stage 2 metric, extended for ADR 002 (research R9). Runs the arms over the same world and seeds:
//   toy            random toy brain from flies.brain (the shared settings, 40 neurons by default)
// Usage: node scripts/compare-baseline.mjs [--world=world/world-connectome.json] [--verbose]
//   nature         connectome snapshot from flies.brain.snapshot (only when it is set)
//   random-matched size-matched random toy brain (only when the snapshot is set)
//   baseline       random walk, no brain
// Usage: npm run experiment   (or node scripts/compare-baseline.mjs --verbose)
//
// This is a metric, not a test gate (research R12). It exits 0 with a verdict, and exits 1 only
// when world.json or the snapshot is invalid, or world.json has no flies section.

import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain, BRAIN_DEFAULTS } from '../public/js/brain/fly-brain.js';
import { parseSnapshot, matchedRandomBrain } from '../public/js/brain/snapshot.js';
import { createBaselineMotor } from '../public/js/fly/baseline.js';
import { stepBody } from '../public/js/fly/body.js';
import { senseAt } from '../public/js/fly/stimulus.js';

const verbose = process.argv.includes('--verbose');
// --world=world/world-connectome.json compares the snapshot world; the default is world.json.
const worldArg = process.argv.find((a) => a.startsWith('--world='))?.slice('--world='.length) ?? 'world/world.json';
const worldUrl = new URL(`../public/${worldArg}`, import.meta.url);
const webRoot = new URL('../public/', import.meta.url);
const config = JSON.parse(readFileSync(worldUrl, 'utf8'));

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
const artErrors = validateArt(expConfig, indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8'))).catalog);
if (artErrors.length > 0) {
  for (const { path, message } of artErrors) console.error(`${path || 'world.json'}: ${message}`);
  process.exit(1);
}
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8')));
const logic = buildLogic(config, catalog);
const world = buildWorld(config, logic);

// The snapshot is read the same way as the browser reads it: parsed once, checked against telemetry
let snapshot = null;
const snapshotPath = f.brain.snapshot;
if (snapshotPath !== undefined) {
  try {
    const bytes = readFileSync(new URL(snapshotPath, webRoot));
    snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  } catch (e) {
    console.error(`flies.brain.snapshot: snapshot ${snapshotPath} is not usable: ${e.message}`);
    process.exit(1);
  }
  for (const neuron of f.brain.telemetry) {
    if (neuron >= snapshot.neuronCount) {
      console.error(`flies.brain.telemetry ${neuron} is not below the snapshot's neuronCount ${snapshot.neuronCount}`);
      process.exit(1);
    }
  }
}

// Shared settings for every toy-style brain: no snapshot, no size (those come from the arm)
const { snapshot: _unused, ...shared } = f.brain ?? {};
const toyBrain = { ...BRAIN_DEFAULTS, ...shared };

// Brain configs per arm. Nature and random-matched exist only when the world names a snapshot.
const arms = [{ name: 'toy', brain: toyBrain }];
if (snapshot) {
  arms.push({ name: 'nature', brain: { ...shared, snapshot } });
  arms.push({ name: 'random-matched', brain: matchedRandomBrain(snapshot.manifest, shared) });
}

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

// Runs one brain fly. Returns the readout firing counts, used for the silent-brain check.
function runBrain(state, brainConfig, ticks) {
  const brain = createFlyBrain(brainConfig, state.brainSeed);
  const stats = { leftSpikes: 0, rightSpikes: 0 };
  for (let t = 0; t < ticks; t++) {
    const out = brain.step(senseOf(state.body));
    stepBody(state.body, { left: out.left, right: out.right }, env);
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
  const row = { seed, arms: {}, firing: {} };

  for (const arm of arms) {
    // Same seed and world give the same start positions and brain seeds for every arm.
    const flies = spawnFlies(seeded, world, 'toy');
    let spikes = { leftSpikes: 0, rightSpikes: 0 };
    for (const state of flies) {
      const s = runBrain(state, arm.brain, ticks);
      spikes = { leftSpikes: spikes.leftSpikes + s.leftSpikes, rightSpikes: spikes.rightSpikes + s.rightSpikes };
    }
    row.arms[arm.name] = flies.reduce((sum, s) => sum + s.body.contacts, 0);
    row.firing[arm.name] = spikes;
  }

  const baseline = spawnFlies(seeded, world, 'baseline');
  for (const state of baseline) runBaseline(state, ticks);
  row.arms.baseline = baseline.reduce((sum, s) => sum + s.body.contacts, 0);

  rows.push(row);
}

const armNames = [...arms.map((a) => a.name), 'baseline'];
const totals = Object.fromEntries(armNames.map((name) => [name, rows.reduce((sum, r) => sum + r.arms[name], 0)]));
const diff = (a, b) => totals[a] - totals[b];
const sign = (n) => `${n >= 0 ? '+' : ''}${n}`;

console.log(`world seed ${config.seed}, ${f.count} flies per arm, ${ticks} ticks per fly, tickHz ${f.tickHz}`);
if (snapshot) {
  const h = snapshot.manifest.provenance;
  console.log(`snapshot ${snapshotPath}: ${snapshot.neuronCount} neurons, ${snapshot.edgeCount} edges ` +
    `(${h.datasetRelease}, created ${h.createdAt})`);
}
console.log('');
console.log(`seed   ${armNames.map((n) => n.padEnd(15)).join('')}`);
for (const r of rows) {
  console.log(`${String(r.seed).padEnd(6)} ${armNames.map((n) => String(r.arms[n]).padEnd(15)).join('')}`);
}
console.log(`${'total'.padEnd(6)} ${armNames.map((n) => String(totals[n]).padEnd(15)).join('')}`);
console.log('');
if (snapshot) {
  console.log(`nature - random-matched: ${sign(diff('nature', 'random-matched'))}`);
  console.log(`nature - toy:            ${sign(diff('nature', 'toy'))}`);
}
for (const arm of arms) {
  console.log(`${arm.name} - baseline: ${sign(diff(arm.name, 'baseline'))}`);
}
const verdict = diff('toy', 'baseline') > 0 ? 'toy > baseline' : 'toy <= baseline';
console.log(`verdict: ${verdict}`);

// Firing rate per readout per arm: a silent readout is visible here (plan Risks).
console.log('');
console.log('readout firing rate (spikes per fly-tick, all seeds):');
const flyTicks = seeds.length * f.count * ticks;
for (const arm of arms) {
  const left = rows.reduce((sum, r) => sum + r.firing[arm.name].leftSpikes, 0);
  const right = rows.reduce((sum, r) => sum + r.firing[arm.name].rightSpikes, 0);
  console.log(`  ${arm.name.padEnd(16)} LEFT ${(left / flyTicks).toFixed(4)}  RIGHT ${(right / flyTicks).toFixed(4)}`);
}

if (verbose) {
  console.log('');
  console.log('per arm and seed, fruit contacts (see the table above for totals)');
  for (const r of rows) console.log(`  seed ${r.seed}: ${JSON.stringify(r.arms)}`);
}
