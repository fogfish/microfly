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

// The snapshot is read the same way as the browser reads it: parsed once
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
}

// The forager world (flies.brain.version "v1") runs the Gate C comparison (ADR 003; contracts/experiment-metrics.md).
// --brains picks the arms, --seeds=held-out uses experiment.heldOut, --json writes the run record.
const brainsArg = process.argv.find((a) => a.startsWith('--brains='))?.slice('--brains='.length);
const seedsArg = process.argv.find((a) => a.startsWith('--seeds='))?.slice('--seeds='.length);
const jsonArg = process.argv.find((a) => a.startsWith('--json='))?.slice('--json='.length);
const ticksArg = process.argv.find((a) => a.startsWith('--ticks='))?.slice('--ticks='.length);
const forageTicks = ticksArg !== undefined ? Number(ticksArg) : f.experiment.ticks;
if (f.brain?.version === 'v1' || brainsArg?.split(',').includes('v1')) {
  const { runForagerArms, armMetrics, printForagerTable, verdicts } = await import('./forager-arms.mjs');
  const { createHash } = await import('node:crypto');
  const arms = (brainsArg ?? 'mock,v1,random-matched,baseline').split(',');
  if (seedsArg !== undefined && seedsArg !== 'held-out') {
    console.error(`--seeds must be "held-out" or omitted, got "${seedsArg}"`);
    process.exit(1);
  }
  const seeds = seedsArg === 'held-out' ? f.experiment.heldOut : f.experiment.seeds;
  if (seedsArg === 'held-out' && seeds === undefined) {
    console.error('experiment.heldOut is not set in the world');
    process.exit(1);
  }
  const overlap = (f.experiment.heldOut ?? []).filter((s) => (f.experiment.seeds ?? []).includes(s));
  if (seedsArg === 'held-out' && overlap.length > 0) {
    console.error(`held-out seeds overlap the calibration seeds: ${overlap.join(', ')}`);
    process.exit(1);
  }
  // The v0 arm needs the small snapshot (version 3), read from the same root as the world's snapshot.
  let v0Snapshot;
  if (arms.includes('v0')) {
    const small = readFileSync(new URL('brains/smallest-functional-brain.brain', webRoot));
    v0Snapshot = parseSnapshot(small.buffer.slice(small.byteOffset, small.byteOffset + small.byteLength));
  }
  const result = runForagerArms({
    f, world, expConfig, snapshot, v0Snapshot, arms, seeds, ticks: forageTicks,
    capabilities: snapshot.capabilities,
  });
  const metrics = armMetrics(arms, result, f.stimulus.radius, 1);
  console.log(`world ${worldArg}, seeds ${seedsArg === 'held-out' ? 'held-out' : 'calibration'} (${seeds.length}), ` +
    `${f.count} flies per cohort, ${forageTicks} ticks per fly`);
  console.log('');
  console.log(printForagerTable(metrics, seeds.length));
  console.log('');
  for (const v of verdicts(metrics)) {
    const mark = v.pass === null ? 'MEASURED' : v.pass ? 'PASS' : 'FAIL';
    console.log(`${mark.padEnd(9)} ${v.metric.padEnd(18)} ${v.expectation}: ${v.values}`);
  }
  console.log('');
  console.log('contacts are printed for information and do not decide the verdict (FR-028).');
  if (jsonArg) {
    const record = {
      world: { file: worldArg, sha256: createHash('sha256').update(readFileSync(worldUrl)).digest('hex') },
      snapshot: { path: snapshotPath, configHash: snapshot.manifest.provenance.configHash, version: snapshot.version },
      seeds, ticks: forageTicks, arms,
      lif: f.brain.lif ?? {},
      metrics,
    };
    const { writeFileSync } = await import('node:fs');
    writeFileSync(jsonArg, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`run record written to ${jsonArg}`);
  }
  process.exit(0);
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
