// Profile for the 15K cautious forager brain (ADR 006, container v5, lif-v1.js via fly-brain-v2.js). Supplies
// everything engine.mjs needs that is specific to this brain generation: where its world/snapshot live, its grid
// axes (ADR 006's own stated starting grid, "Calibration protocol"), its per-group gates (L10), and how to build
// a brain config and a probe input vector from one grid point. Validated interactively against the real
// `forager-brain-15k.brain` (2026-10-10): see specs/013-forager-brain-15k-lif-v2/calibration.md.

import { REGIONS } from '../../../../../public/js/ui/panel/counts.js';
import { regionTotals, regionFractionsOf } from '../../../../../scripts/forager-arms.mjs';

const L11 = { dt: 1, tau: 20, refractorySteps: 2, tauSyn: 5, synapticScale: 0.04 };

// ADR 006 Annex A6, 15K row: 0.188-0.939 ms per LIF step, scaled here by stepsPerTick for a per-tick estimate.
// Measured directly this session (2026-10-10, Apple-class laptop): ~1.0-1.3s per probe condition per seed at
// stepsPerTick 10, i.e. ~10-13s per A1 grid point (5 conditions x 3 seeds); used by calibrate.mjs's cost estimate.
const MEASURED_MS_PER_REGIME_POINT_AT_STEPS10 = 12500;

function vectorOf(inputs, assign) {
  const v = new Float32Array(inputs.length);
  inputs.forEach((ch, k) => { v[k] = assign(ch) ?? 0; });
  return v;
}

export const profile = {
  id: 'v2',
  label: 'Cautious forager brain, 15K (ADR 006, container v5)',
  worldPath: 'world/world-forager-15k.json',
  brainVersion: 'v2',

  // Context (world, snapshot, capabilities) is loaded once by calibrate.mjs; this stashes the per-region
  // bookkeeping engine.mjs's probe() needs via ctx.
  prepareContext(ctx) {
    ctx.regionSizes = regionTotals(ctx.snapshot);
    ctx.groupOf = ctx.snapshot.manifest.neurons.map((n) => n.group);
  },
  regionNames: REGIONS.filter((r) => r !== undefined),
  regionFractions(spikes, ctx) {
    return regionFractionsOf(spikes, ctx.regionSizes, ctx.groupOf);
  },
  appliedScale(net, neuronIndex) {
    return net.outputOverride[neuronIndex]
      ? net.outputScaleOf[neuronIndex]
      : net.groupScaleOf[neuronIndex] * net.params.synapticScale;
  },

  // ADR 006's own stated grid, centred on L11: synapticScale x{0.5,1,2,4}, tauSyn {2,5}, input.rate[1]
  // {0.08,0.15,0.3}, stepsPerTick {5,10}. groupGain is {} by default (L10: "gated by evidence") -- `classify`
  // decides, from a scale-only scan, whether any region needs its own entry before this axis is widened.
  // ADR 006 stated this grid centred on L11 (x{0.5,1,2,4} = 0.02-0.16); measured interactively (2026-10-10) that
  // every point in that range is already ignited in most regions (al 40-68%, dn/central/output 10-30%, all over
  // the 10% ceiling), so the fine grid here is widened down to where a scale-only scan actually found a quiet
  // regime (classifyScan below) rather than kept at the ADR's literal starting range -- a finding, recorded here
  // per AGENTS.md, not a deviation hidden in code.
  axes: {
    synapticScale: [0.002, 0.005, 0.01, 0.02],
    tauSyn: [2, 5],
    inputRateHigh: [0.08, 0.15, 0.3],
    stepsPerTick: [5, 10],
    groupGain: [{}],
  },
  scaleAxis: 'synapticScale',
  // classify's phase-0 scan needs a wider, lower range than the fine grid above to tell "stuck at every scale
  // we'd actually ship" from "just needs the fine grid's own scale axis moved down" -- measured interactively
  // (2026-10-10): at 0.002 (20x below L11), vnc/dn/central/output are already quiet, only `al` stays ignited.
  classifyScan: [0.002, 0.005, 0.01, 0.02, 0.04],
  referencePoint() {
    return { synapticScale: L11.synapticScale, tauSyn: L11.tauSyn, inputRateHigh: 0.15, stepsPerTick: 10, groupGain: {} };
  },
  // classifyRegions widens this axis with a per-region groupGain entry when a region is "stuck" (ADR 006 L10).
  groupGainAxisFor(stuckRegions) {
    if (stuckRegions.length === 0) return [{}];
    const values = [0.3, 0.1, 0.03, 0.01];
    const entries = [{}];
    for (const region of stuckRegions) for (const v of values) entries.push({ [region]: v });
    return entries;
  },

  gates: {
    restFloor: 0.002,
    restCeiling: 0.1,
    odourGroups: ['al', 'central'],
    odourGain: 1.2,
    neighbours: 0.5,
  },

  brainOf(point) {
    return {
      lif: { ...L11, synapticScale: point.synapticScale, tauSyn: point.tauSyn, groupGain: point.groupGain ?? {} },
      stepsPerTick: point.stepsPerTick,
      input: { encoding: 'poisson', rate: [0.005, point.inputRateHigh], weight: 1.2 },
    };
  },

  // Generic over the snapshot's declared sense/side (ADR 006 W6) rather than a hard-coded 4-channel layout.
  conditions(point, ctx) {
    const inputs = ctx.capabilities.channels.inputs;
    return {
      rest: vectorOf(inputs, () => 0),
      odour: vectorOf(inputs, (ch) => (ch.sense === 'odour:food' ? 0.5 : 0)),
      left: vectorOf(inputs, (ch) => (ch.sense === 'odour:food' && ch.side === 'L' ? 0.8 : 0)),
      right: vectorOf(inputs, (ch) => (ch.sense === 'odour:food' && ch.side === 'R' ? 0.8 : 0)),
      taste: vectorOf(inputs, (ch) => (ch.sense === 'taste:mouth' ? 0.5 : 0)),
    };
  },

  readoutScales: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192],
  fitReadout(runs, forwardTarget, ctx) {
    const closest = (fn, target) => runs.reduce((a, b) => (Math.abs(fn(b) - target) < Math.abs(fn(a) - target) ? b : a)).s;
    const feedThreshold = ctx.f.food.feedThreshold;
    const scale = {
      forward: closest((r) => r.odour.forward, forwardTarget),
      backward: closest((r) => r.odour.backward, 0.05),
      'turn-left': closest((r) => r.odour['turn-left'], 0.3),
      'turn-right': closest((r) => r.odour['turn-right'], 0.3),
    };
    const below = runs.filter((r) => r.odour.feed < feedThreshold);
    const best = below.reduce((a, b) => (b.taste.feed - b.odour.feed > a.taste.feed - a.odour.feed ? b : a), below[0] ?? runs[0]);
    scale.feed = best.taste.feed - best.odour.feed >= 0.05
      ? best.s
      : (runs.filter((r) => r.odour.feed <= feedThreshold / 2).at(-1) ?? runs[0]).s;
    scale.escape = scale.feed; // no probe condition drives escape directly; reviewed in stage B, not fitted here
    const at = (id) => runs.find((r) => r.s === scale[id]);
    const outputIds = Object.keys(scale);
    return {
      outputScale: scale,
      drives: Object.fromEntries(outputIds.map((id) => [id, { odour: at(id).odour[id], taste: at(id).taste[id] }])),
    };
  },

  odourRadius(f) {
    return f.stimuli?.['odour:food']?.radius ?? 6;
  },

  // Cost model for calibrate.mjs's budget check (measured, not guessed -- see the constant above).
  estimateRegimePointMs(point) {
    return MEASURED_MS_PER_REGIME_POINT_AT_STEPS10 * ((point.stepsPerTick ?? 10) / 10);
  },
  // Measured this session: 1 calibration seed, 3 cohorts, 6 flies/cohort, 300 ticks = ~29.2s.
  estimateWorldCandidateMs(seedCount, ticks) {
    const msPerSeedPer300Ticks = 29200;
    return msPerSeedPer300Ticks * (ticks / 300) * seedCount;
  },
};
