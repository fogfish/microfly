#!/usr/bin/env node
// CLI entry point for the microfly-calibrate skill. One deterministic program, no agent in the loop while it
// runs: the skill asks a human a few questions, then launches this with the chosen flags (regime/classify/auto in
// the foreground, world in the background via `nohup`/`run_in_background`), and this prints its own progress and
// writes a checkpoint + a final report so the result is readable without having watched it run.
//
// node calibrate.mjs --version=<profile-id> --stage=regime|classify|auto|world [flags...]
// --version selects a scripts/profiles/<id>.mjs module (e.g. v1, class-seed-11k) -- a different axis from
// the worker-protocol/container "version" (v0/v1) used elsewhere in this project.
// node calibrate.mjs --help
//
// See profiles/README (this file's --help) for the full flag list. Every stage writes JSON checkpoints under
// --out and skips recomputing one that already exists, so a killed run can be re-invoked with the same flags to
// pick up where it left off.

import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../../../../public/js/world/validate.js';
import { indexCatalog } from '../../../../public/js/world/catalog.js';
import { buildLogic } from '../../../../public/js/world/layout.js';
import { buildWorld } from '../../../../public/js/fly/fly-world.js';
import { resolveFlies } from '../../../../public/js/fly/fly-config.js';
import { parseSnapshot } from '../../../../public/js/brain/snapshot.js';
import {
  classifyRegions, ensureDir, fmt, readCheckpoint, readout, regime, robustCandidates, runRegimeGrid,
  runWorldStage, writeCheckpoint,
} from './engine.mjs';

const HELP = `
microfly-calibrate CLI (deterministic, no agent needed while running)

Usage:
  node calibrate.mjs --version=<profile-id> --stage=<regime|classify|auto|world> [flags]
  node calibrate.mjs --help

Required:
  --version=<profile-id>    Brain generation profile (scripts/profiles/<id>.mjs, e.g. v1,
                            class-seed-11k). See "Extending to a new brain profile" in SKILL.md to add one.

Stage (default: auto):
  --stage=regime            A1 only, over the full grid (or --axes override). Cheap; safe interactively.
  --stage=classify          Phase 0+1: scan --scale-axis alone, report which regions never quiet down.
  --stage=auto              classify -> regime (widened with any classified groupGain axis) -> robustness -> A2.
                            Stops before stage=world on purpose (a human reviews candidates first).
  --stage=world             B: the expensive stage. Needs --from (one or more "auto"/"regime" checkpoints) and
                            an explicit --budget-minutes. Never runs held-out seeds.

Common flags:
  --world=<path>            Override the profile's default world config (relative to public/).
  --out=<dir>               Checkpoint + report directory (default: runs/<version>-<timestamp> next to this file).
  --json=<path>             Explicit checkpoint path for this stage (default: <out>/<stage>.json).
  --axes=<json>             Merge into the profile's default grid axes, e.g. '{"synapticScale":[0.01,0.02]}'.
  --shard=k/n               Run every n-th grid point starting at k (0-based), for running shards in parallel.
  --budget-minutes=<N>      Soft cap for regime/classify/auto (warns past it); HARD requirement for world (refused
                            without it). The CLI estimates cost before running and trims --top to fit when it can.
  --dry-run                 Print the plan and the cost estimate, then exit. Runs nothing.

Stage=world only:
  --from=<path>[,<path>]    Checkpoint(s) from stage=regime/auto to take candidates from.
  --top=<N>                 Number of robust candidates to try (default 3; each tried at every forward-target x
                            motor-smoothing combination below).
  --ticks=<N>               Ticks per run (default: the world config's own experiment.ticks).
  --forward-targets=<csv>   Default 0.3,0.5.
  --motor-smoothing=<csv>   Default 0.05,0.02.
  --force                   Run past the budget estimate instead of auto-trimming --top or refusing.

Stage=classify only:
  --scale-axis=<name>       Default: the profile's own scaleAxis.
  --scan=<csv>              Values to scan (default: the profile's axes[scaleAxis]).
`;

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) out[a.slice(2)] = true;
    else out[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || process.argv.length <= 2) {
  console.log(HELP);
  process.exit(0);
}

const version = args.version;
if (!version || /[^a-z0-9-]/.test(version)) {
  console.error(`--version must name a scripts/profiles/<id>.mjs module, got ${JSON.stringify(version)}`);
  process.exit(1);
}
let profile;
try {
  ({ profile } = await import(`./profiles/${version}.mjs`));
} catch (e) {
  console.error(`--version=${version} has no scripts/profiles/${version}.mjs: ${e.message}`);
  process.exit(1);
}

const stage = args.stage ?? 'auto';
const [shardK, shardN] = (args.shard ?? '0/1').split('/').map(Number);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = args.out ?? new URL(`../runs/${version}-${timestamp}/`, import.meta.url).pathname;
const jsonPath = args.json ?? `${outDir.replace(/\/$/, '')}/${stage}.json`;
const budgetMinutes = args['budget-minutes'] !== undefined ? Number(args['budget-minutes']) : null;
const axesOverride = JSON.parse(args.axes ?? '{}');

ensureDir(outDir.replace(/\/$/, ''));

// --- load world + snapshot (shared by every stage) ---------------------------------------------------------
const webRoot = new URL('../../../../public/', import.meta.url);
const worldPath = args.world ?? profile.worldPath;
const config = JSON.parse(readFileSync(new URL(worldPath, webRoot), 'utf8'));
const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
const errors = validateConfig(expConfig);
if (errors.length > 0) {
  for (const { path, message } of errors) console.error(`${path}: ${message}`);
  process.exit(1);
}
const f = resolveFlies(expConfig);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, webRoot), 'utf8')));
if (validateArt(config, catalog).length > 0) process.exit(1);
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, webRoot));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const capabilities = snapshot.capabilities;
const ctx = { f, world, expConfig, snapshot, capabilities };
profile.prepareContext(ctx);

console.log(`microfly-calibrate: ${profile.label}, stage=${stage}, world=${worldPath}`);

// --- cost estimate / budget check ---------------------------------------------------------------------------
function cartesianSize(axes) {
  return Object.values(axes).reduce((n, values) => n * values.length, 1);
}
function checkBudget(estimatedMinutes, hardRequired) {
  console.log(`Estimated cost: ~${fmt(estimatedMinutes, 1)} minutes.`);
  if (hardRequired && budgetMinutes === null) {
    console.error('stage=world needs an explicit --budget-minutes (this stage is the hours-scale one). Refusing to run.');
    process.exit(1);
  }
  if (budgetMinutes !== null && estimatedMinutes > budgetMinutes && !args.force) {
    return false; // caller decides how to react (trim, or refuse)
  }
  return true;
}

if (stage === 'regime') {
  const axes = { ...profile.axes, ...axesOverride };
  const gridSize = Math.ceil(cartesianSize(axes) / shardN);
  const perPointMs = profile.estimateRegimePointMs(profile.referencePoint());
  const ok = checkBudget((gridSize * perPointMs) / 60000, false);
  if (!ok) {
    console.error(`Over budget (--budget-minutes=${budgetMinutes}). Narrow --axes, add --shard, or pass --force.`);
    process.exit(1);
  }
  if (args['dry-run']) { console.log(`${gridSize} grid points would run. Dry run, stopping.`); process.exit(0); }

  const existing = readCheckpoint(jsonPath);
  if (existing) {
    console.log(`Checkpoint already exists at ${jsonPath} (${existing.rows.length} rows) — not recomputing. Delete it to rerun.`);
    process.exit(0);
  }
  let done = 0;
  const rowsSoFar = [];
  const { rows } = runRegimeGrid(profile, ctx, axes, {
    shardK, shardN,
    onRow: (r, index, total) => {
      done++;
      rowsSoFar.push(r);
      console.log(`[${done}/${gridSize}] ${JSON.stringify(r.point)} rest=${JSON.stringify(Object.fromEntries(Object.entries(r.rest).map(([k, v]) => [k, Number(v.toFixed(3))])))} `
        + `brake=${fmt(r.brake)} feedC=${fmt(r.feedContrast)} -> ${r.pass ? 'PASS' : r.fails.join(',')}`);
      writeCheckpoint(jsonPath, { stage, axes, rows: rowsSoFar }); // incremental: safe to kill at any point
    },
  });
  console.log(`${rows.filter((r) => r.pass).length}/${rows.length} pass. Checkpoint: ${jsonPath}`);
} else if (stage === 'classify') {
  const scaleAxis = args['scale-axis'] ?? profile.scaleAxis;
  const scan = args.scan ? JSON.parse(`[${args.scan}]`) : (profile.classifyScan ?? profile.axes[scaleAxis]);
  const { stuck, rows } = classifyRegions({ ...profile, scaleAxis }, ctx, scan);
  for (const r of rows) {
    console.log(`${scaleAxis}=${JSON.stringify(r.point[scaleAxis])} rest=${JSON.stringify(Object.fromEntries(Object.entries(r.rest).map(([k, v]) => [k, Number(v.toFixed(3))])))} -> ${r.pass ? 'PASS' : r.fails.join(',')}`);
  }
  console.log(`Stuck regions (ignited at every scanned ${scaleAxis}): ${stuck.length ? stuck.join(', ') : '(none)'}`);
  writeCheckpoint(jsonPath, { stage, scaleAxis, scan, stuck, rows });
} else if (stage === 'auto') {
  const scan = profile.classifyScan ?? profile.axes[profile.scaleAxis];
  console.log(`Phase 0+1: classifying regions over ${profile.scaleAxis} = ${JSON.stringify(scan)}`);
  const { stuck, rows: scanRows } = classifyRegions(profile, ctx, scan);
  console.log(`Stuck regions: ${stuck.length ? stuck.join(', ') : '(none)'}`);

  const groupGainAxis = profile.groupGainAxisFor(stuck);
  const axes = {
    ...profile.axes,
    ...(groupGainAxis && !axesOverride.groupGain ? { groupGain: groupGainAxis } : {}),
    ...axesOverride,
  };
  const gridSize = Math.ceil(cartesianSize(axes) / shardN);
  const perPointMs = profile.estimateRegimePointMs(profile.referencePoint());
  const ok = checkBudget((gridSize * perPointMs) / 60000, false);
  if (!ok) {
    console.error(`Phase 2 grid (${gridSize} points) is over budget (--budget-minutes=${budgetMinutes}). `
      + 'Narrow --axes or pass --force.');
    process.exit(1);
  }
  if (args['dry-run']) { console.log(`${gridSize} phase-2 grid points would run. Dry run, stopping.`); process.exit(0); }

  console.log(`Phase 2: regime grid over ${JSON.stringify(axes)}, ${gridSize} points`);
  let done = 0;
  const rowsSoFar = [];
  const { rows } = runRegimeGrid(profile, ctx, axes, {
    shardK, shardN,
    onRow: (r) => {
      done++;
      rowsSoFar.push(r);
      console.log(`[${done}/${gridSize}] ${JSON.stringify(r.point)} -> ${r.pass ? 'PASS' : r.fails.join(',')}`);
      writeCheckpoint(jsonPath, { stage, scan: scanRows, stuck, axes, rows: rowsSoFar });
    },
  });

  const forwardTargets = (args['forward-targets'] ?? '0.3,0.5').split(',').map(Number);
  const top = Number(args.top ?? 3);
  const robust = robustCandidates(profile, axes, rows, top);
  console.log(`${rows.filter((r) => r.pass).length}/${rows.length} pass A1, ${robust.length} robust (>= ${profile.gates.neighbours * 100}% of axis-neighbours also pass).`);
  const fitted = robust.map((r) => ({
    point: r.point,
    regime: { rest: r.rest, odour: r.odour, brake: r.brake, feedContrast: r.feedContrast, lateral: r.lateral },
    readouts: forwardTargets.map((forwardTarget) => ({ forwardTarget, ...readout(profile, ctx, r.point, forwardTarget) })),
  }));
  for (const c of fitted) {
    console.log(`Candidate ${JSON.stringify(c.point)}: brake=${fmt(c.regime.brake)} feedC=${fmt(c.regime.feedContrast)}`);
  }
  writeCheckpoint(jsonPath, { stage, scan: scanRows, stuck, axes, rows, robust: fitted });
  console.log(`Checkpoint: ${jsonPath}`);
  console.log(fitted.length
    ? `${fitted.length} candidate(s) found. Review them, then (if worth the cost) run --stage=world --from=${jsonPath} --budget-minutes=<N>.`
    : 'No A1-passing, robust candidate found with this grid. Widen --axes (e.g. a lower synapticScale range) and rerun -- this result itself is the finding to record, per AGENTS.md.');
} else if (stage === 'world') {
  if (!args.from) { console.error('--stage=world needs --from=<regime-or-auto checkpoint path>[,<path>...]'); process.exit(1); }
  const fromFiles = args.from.split(',').map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const fromRows = fromFiles.flatMap((file) => file.rows ?? []);
  // Robustness must be judged against the axes the checkpoint was actually generated with, not the profile's
  // current defaults (which may have changed since) -- each checkpoint records its own `axes` for exactly this.
  const axes = { ...fromFiles[0]?.axes, ...axesOverride };
  const top = Number(args.top ?? 3);
  const robust = robustCandidates(profile, axes, fromRows, top);
  if (robust.length === 0) {
    console.error('No robust A1-passing candidate in --from. Nothing to run.');
    process.exit(1);
  }
  const forwardTargets = (args['forward-targets'] ?? '0.3,0.5').split(',').map(Number);
  const motorSmoothing = (args['motor-smoothing'] ?? '0.05,0.02').split(',').map(Number);
  let candidates = robust.flatMap((r) => forwardTargets.flatMap((forwardTarget) => motorSmoothing.map((ms) => ({ point: r.point, forwardTarget, motorSmoothing: ms }))));
  const ticks = Number(args.ticks ?? f.experiment.ticks ?? 3000);
  const perCandidateMs = profile.estimateWorldCandidateMs(f.experiment.seeds.length, ticks);
  let estimatedMinutes = (candidates.length * perCandidateMs) / 60000;
  console.log(`Estimated cost: ~${fmt(estimatedMinutes, 1)} minutes for ${candidates.length} candidates.`);
  if (budgetMinutes === null) {
    console.error('stage=world needs an explicit --budget-minutes. Refusing to run.');
    process.exit(1);
  }
  if (estimatedMinutes > budgetMinutes && !args.force) {
    const maxCandidates = Math.max(1, Math.floor((budgetMinutes * 60000) / perCandidateMs));
    if (maxCandidates < candidates.length) {
      console.log(`Trimming to the top ${maxCandidates} candidate(s) (by robustness) to fit --budget-minutes=${budgetMinutes}.`);
      candidates = candidates.slice(0, maxCandidates);
      estimatedMinutes = (candidates.length * perCandidateMs) / 60000;
    }
  }
  if (args['dry-run']) { console.log(`${candidates.length} candidate(s) would run, ~${fmt(estimatedMinutes, 1)} min. Dry run, stopping.`); process.exit(0); }

  console.log(`Stage B: ${candidates.length} candidate(s), ${f.experiment.seeds.length} calibration seeds, ${ticks} ticks each.`);
  const completed = [];
  const result = runWorldStage(profile, ctx, candidates, {
    ticks,
    onCandidate: (row, base) => {
      completed.push(row);
      console.log(`${JSON.stringify(row.brain.lif)} fwd=${row.forwardTarget} ms=${row.motorSmoothing}`);
      console.log(`  find ${fmt(row.metrics.find.rate * 100, 1)}% (random-walk ${fmt(base.find.rate * 100, 1)}%)`);
      // Incremental: safe to kill between candidates without losing the ones already run.
      writeCheckpoint(jsonPath, { stage, seeds: f.experiment.seeds, ticks, baseline: base, rows: completed });
    },
  });
  writeCheckpoint(jsonPath, { stage, ...result });
  console.log(`Checkpoint: ${jsonPath}`);
} else {
  console.error(`--stage must be one of regime, classify, auto, world; got ${JSON.stringify(stage)}`);
  process.exit(1);
}
