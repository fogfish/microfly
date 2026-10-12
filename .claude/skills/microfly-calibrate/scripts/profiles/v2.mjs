// Profile for the 15K cautious forager brain (ADR 006, container v5, lif-v1.js via fly-brain-v2.js). Supplies
// everything engine.mjs needs that is specific to this brain generation: where its world/snapshot live, its grid
// axes (ADR 006's own stated starting grid, "Calibration protocol"), its per-group gates (L10), and how to build
// a brain config and a probe input vector from one grid point. Validated interactively against the real
// `forager-brain-15k.brain` (2026-10-10): see specs/013-forager-brain-15k-lif-v2/calibration.md.

import { REGIONS } from '../../../../../public/js/ui/panel/counts.js';
import { regionTotals, regionFractionsOf } from '../../../../../scripts/forager-arms.mjs';

// BUG-003 (ADR 006 Amendment 2026-10-11, A6): L11's original synapticScale (0.04 = 0.275 mV / 7 mV) quoted Shiu et
// al. 2024's synaptic weight without finishing their own conversion to net charge -- the weight is a step on their
// model's intermediate decaying variable `g` (tauSyn 5 ms), which then drains into `v` over t_mbr (20 ms), so the
// net charge per synapse is w * tau / t_mbr = 0.275 * 5 / 20 = 0.06875 mV, i.e. 0.06875 / 7 ~= 0.0098, not 0.0393.
const L11 = { dt: 1, tau: 20, refractorySteps: 2, tauSyn: 5, synapticScale: 0.0098 };

// ADR 006 Annex A6, 15K row: 0.188-0.939 ms per LIF step, scaled here by stepsPerTick for a per-tick estimate.
// Measured directly this session (2026-10-10, Apple-class laptop): ~1.0-1.3s per probe condition per seed at
// stepsPerTick 10, i.e. ~10-13s per A1 grid point (5 conditions x 3 seeds); used by calibrate.mjs's cost estimate.
// BUG-002's settle gate (A5 item 7) adds one probeSettle() call per point -- warmup + 2*PROBE_TICKS against the
// 5 conditions' warmup + PROBE_TICKS each, i.e. (5*200 + 350) / (5*200) =~ 1.35x -- scaled in here as an estimate
// only; not re-measured against a live run yet.
const MEASURED_MS_PER_REGIME_POINT_AT_STEPS10 = 12500 * 1.35;

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
  // BUG-003 (A6): re-centred on the corrected L11 synapticScale (0.0098, was 0.0393's rounding to 0.04) at
  // x{1/4,1/2,1} -- numerically close to the already-widened range above, so the 2026-10-10 finding still stands.
  // Also widens the search to the LIF mechanisms that damp an all-or-nothing ignition cliff instead of a global
  // excitatory scale alone, none of which any `--stage=auto` run has ever varied: `inhibitoryScale` (L8, a
  // multiplier on recurrent inhibition), `adapt` (paired [tauAdapt, adaptStep], L2 -- the shipped v1 brain's own
  // baseline already uses tauAdapt 20/adaptStep 0.05, ADR 006 Annex A6) and `thresholdJitter` (L3, per-neuron
  // threshold spread). `adapt` pairs its two parameters the same way v1's own `noise` axis pairs
  // noiseAmplitude/noiseBulkScale (profiles/v1.mjs), instead of crossing them independently.
  axes: {
    synapticScale: [0.00245, 0.0049, 0.0098],
    tauSyn: [2, 5],
    inputRateHigh: [0.08, 0.15, 0.3],
    stepsPerTick: [5, 10],
    groupGain: [{}],
    inhibitoryScale: [1, 1.5, 2, 3],
    adapt: [[0, 0], [50, 0.05], [100, 0.05], [200, 0.05]],
    thresholdJitter: [0, 0.1, 0.2],
  },
  scaleAxis: 'synapticScale',
  // classify's phase-0 scan needs a wider, lower range than the fine grid above to tell "stuck at every scale
  // we'd actually ship" from "just needs the fine grid's own scale axis moved down" -- measured interactively
  // (2026-10-10): at 0.002 (20x below the old L11), vnc/dn/central/output are already quiet, only `al` stays
  // ignited. BUG-003 (A6): re-anchored on the corrected L11 synapticScale, same relative spacing.
  classifyScan: [0.00245, 0.0049, 0.0098, 0.0196, 0.0392],
  referencePoint() {
    return {
      synapticScale: L11.synapticScale, tauSyn: L11.tauSyn, inputRateHigh: 0.15, stepsPerTick: 10, groupGain: {},
      inhibitoryScale: 1, adapt: [0, 0], thresholdJitter: 0,
    };
  },
  // classifyRegions widens this axis with a per-region groupGain entry when a region is "stuck" (ADR 006 L10).
  groupGainAxisFor(stuckRegions) {
    if (stuckRegions.length === 0) return [{}];
    const values = [0.3, 0.1, 0.03, 0.01];
    const entries = [{}];
    for (const region of stuckRegions) for (const v of values) entries.push({ [region]: v });
    return entries;
  },

  // ADR 006 Amendment 2026-10-11 (A5, BUG-002): `output` is exempt from the rest/ceiling gate entirely (A2 fits
  // its gain regardless, and output neurons have no outgoing edges to affect anything else, D3); the ≥ 0.002
  // rest floor applies to `input` only (the other groups' zero-basal-firing regime is the one L11 itself cites
  // from Shiu et al. 2024); `rateBasis: 'perStep'` scores a per-LIF-step rate, not the raw per-tick union, so the
  // 0.1 ceiling means the same thing at stepsPerTick 5 and 10; `lateralMin` is a new steering gate (no candidate
  // with near-zero odour-side steering should pass); `settleGroups`/`settleCondition` is the new A1 settle check
  // (activity must return within the ceiling once the clamped `odour` condition is released).
  gates: {
    restFloor: 0.002,
    restCeiling: 0.1,
    floorGroups: ['input'],
    ceilingExemptGroups: ['output'],
    rateBasis: 'perStep',
    odourGroups: ['al', 'central'],
    odourGain: 1.2,
    lateralMin: 0.05,
    settleGroups: ['input', 'al', 'vnc', 'dn', 'central'],
    settleCondition: 'odour',
    neighbours: 0.5,
    // User decision 2026-10-11 (specs/013 calibration.md): the regime sweep's viable low-scale window
    // (synapticScale ~0.0012-0.00245) has feedContrast pinned at exactly 0 throughout -- the feed output never
    // discriminates taste from odour there, a separate, still-open problem. Movement (brake/lateral/gain) is
    // prioritised; feed is still recorded on every row but no longer blocks a candidate's A1 pass.
    requireFeed: false,
  },

  brainOf(point) {
    const [tauAdapt, adaptStep] = point.adapt ?? [0, 0];
    return {
      lif: {
        ...L11,
        synapticScale: point.synapticScale,
        tauSyn: point.tauSyn,
        groupGain: point.groupGain ?? {},
        inhibitoryScale: point.inhibitoryScale ?? 1,
        tauAdapt,
        adaptStep,
        thresholdJitter: point.thresholdJitter ?? 0,
      },
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
      // BUG-002 item 4: combined with food odour, matching v1's own `taste` condition (profiles/v1.mjs) — brake/
      // feed then read as "mouth taste added to an approaching fly's odour drive", not "taste with no odour
      // present", which only shows a fly has nothing to brake because it was never driving forward to begin with.
      taste: vectorOf(inputs, (ch) => (ch.sense === 'taste:mouth' || ch.sense === 'odour:food' ? 0.5 : 0)),
    };
  },

  readoutScales: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192],
  // A5 item 6 (BUG-002): nothing required the fitted forward gain to leave zero drive with no stimulus present,
  // so a quiet brain could still be fitted to walk at rest. `restDriveMax` bounds `|r.rest.forward|`; scales that
  // fail it are dropped from the forward-target search when at least one scale still passes it.
  restDriveMax: 0.05,
  fitReadout(runs, forwardTarget, ctx) {
    const closest = (pool, fn, target) => pool.reduce((a, b) => (Math.abs(fn(b) - target) < Math.abs(fn(a) - target) ? b : a)).s;
    const feedThreshold = ctx.f.food.feedThreshold;
    const atRest = runs.filter((r) => Math.abs(r.rest.forward) < this.restDriveMax);
    const restOk = atRest.length > 0;
    const forwardPool = restOk ? atRest : runs;
    const scale = {
      forward: closest(forwardPool, (r) => r.odour.forward, forwardTarget),
      backward: closest(runs, (r) => r.odour.backward, 0.05),
      'turn-left': closest(runs, (r) => r.odour['turn-left'], 0.3),
      'turn-right': closest(runs, (r) => r.odour['turn-right'], 0.3),
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
      restOk,
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
