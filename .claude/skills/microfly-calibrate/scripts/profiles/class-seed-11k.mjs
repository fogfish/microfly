// Profile for the class-seeded forager brain (ADR 006, container v4, lif-v1.js via fly-brain-v1.js -- W6: "None
// of these change. This is the point of lesson 6."). Like v1.mjs, this brain has no per-neuron `group` field, so
// it gates on one pseudo-region, "all" (contracts/calibration-profile.md). Its grid starts from v1's calibrated
// LIF block (same weight rule, postFractionAbsolute) and widens it with the mechanisms branch 013 found it had
// never varied -- inhibitoryScale (already in v1's grid), a paired adaptation axis and thresholdJitter -- plus
// branch 013's corrected gates (BUG-002: output exempt from the rest/ceiling gate, a per-step rate basis).

import { sensoryValue } from '../../../../../public/js/fly/stimulus.js';

export const profile = {
  id: 'class-seed-11k',
  label: 'Class-seeded forager brain (ADR 006, 11K, container v4)',
  worldPath: 'world/world-forager-11k.json',
  brainVersion: 'v1',

  prepareContext() {}, // no per-region bookkeeping needed (single pseudo-region, like v1.mjs)
  regionNames: ['all'],
  regionFractions(spikes, ctx) {
    return { all: spikes.length / ctx.snapshot.neuronCount };
  },
  // Same correction as v1.mjs: main's lif-v1.js has no `groupScaleOf` (ADR 006 W6 keeps the LIF core and
  // runner unchanged; group gain belongs to a brain generation this feature does not build).
  appliedScale(net, neuronIndex) {
    return net.outputOverride[neuronIndex] ? net.outputScaleOf[neuronIndex] : net.params.synapticScale;
  },

  // v1's own grid (profiles/v1.mjs), widened per ADR 006 "Calibration protocol" point 3 with inhibitoryScale's
  // range, a paired [tauAdapt, adaptStep] adaptation axis (branch 013's convention: pairs its two parameters the
  // way v1's own `noise` axis already pairs noiseAmplitude/noiseBulkScale) and thresholdJitter.
  axes: {
    synapticScale: [10, 15, 20, 30, 40, 50],
    inhibitoryScale: [1, 1.5, 2, 2.5, 3],
    noise: [[0, 1], [0.1, 0], [0.2, 0], [0.3, 0]],
    tauSyn: [0],
    stimulus: [[0.02, 0.1], [0.02, 0.25], [0.02, 1]],
    adapt: [[0, 0], [20, 0.05], [50, 0.05], [100, 0.1]],
    thresholdJitter: [0, 0.1, 0.2],
  },
  scaleAxis: 'synapticScale',
  // ADR 006 "Calibration protocol" point 2: start from v1's calibrated LIF block, because the weight rule is
  // the same (postFractionAbsolute). tauAdapt/adaptStep are v1's own held-from-first-calibration values
  // (public/world/README.md), carried here as the adaptation pair's reference point.
  referencePoint() {
    return {
      synapticScale: 25, inhibitoryScale: 1, noise: [0.1, 0], tauSyn: 0, stimulus: [0.02, 0.25],
      adapt: [20, 0.05], thresholdJitter: 0,
    };
  },
  // This brain has no group field to gain against (like v1.mjs); classify finds nothing extra to widen.
  groupGainAxisFor() {
    return null;
  },

  // Branch 013's corrected gates (BUG-002), carried over as properties of the calibration tool, not of the
  // withdrawn 15K brain: output is exempt from the rest/ceiling gate (A2 fits its gain regardless, and output
  // neurons have no outgoing edges), and the ceiling is scored on a per-step rate so it means the same thing
  // across stepsPerTick values.
  gates: {
    restFloor: 0.002,
    restCeiling: 0.1,
    ceilingExemptGroups: ['output'],
    rateBasis: 'perStep',
    odourGroups: ['all'],
    odourGain: 2,
    neighbours: 0.5,
  },

  brainOf(point) {
    const [noiseAmplitude, noiseBulkScale] = point.noise;
    const [tauAdapt, adaptStep] = point.adapt;
    return {
      lif: {
        synapticScale: point.synapticScale, inhibitoryScale: point.inhibitoryScale,
        noiseAmplitude, noiseBulkScale, tauSyn: point.tauSyn,
        tauAdapt, adaptStep, thresholdJitter: point.thresholdJitter,
      },
    };
  },

  // Same six channels as v1 (odour-left/right, taste-left/right), matched by id, not position (the lesson
  // v2.mjs already recorded against v1.mjs's original, position-based version — carried forward here).
  conditions(point, ctx) {
    const inputs = ctx.capabilities.channels.inputs;
    const [resting, gain] = point.stimulus;
    const value = (intensity) => sensoryValue(intensity, gain, ctx.f.stimulus.max, resting);
    const rest = value(0);
    const vectorOf = (assign) => {
      const v = new Float32Array(inputs.length);
      inputs.forEach((ch, k) => { v[k] = assign(ch) ?? rest; });
      return v;
    };
    return {
      rest: vectorOf(() => rest),
      odour: vectorOf((ch) => (ch.id.startsWith('odour') ? value(0.5) : 0)),
      left: vectorOf((ch) => (ch.id === 'odour-left' ? value(0.8) : (ch.id === 'odour-right' ? rest : 0))),
      right: vectorOf((ch) => (ch.id === 'odour-right' ? value(0.8) : (ch.id === 'odour-left' ? rest : 0))),
      taste: vectorOf((ch) => (ch.id.startsWith('taste') ? value(0.5) : (ch.id.startsWith('odour') ? value(0.5) : 0))),
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
    const at = (id) => runs.find((r) => r.s === scale[id]);
    return {
      outputScale: scale,
      drives: Object.fromEntries(Object.keys(scale).map((id) => [id, { odour: at(id).odour[id], taste: at(id).taste[id] }])),
    };
  },

  odourRadius(f) {
    return f.stimulus.radius;
  },

  // Not yet independently measured for this brain (ADR 006 Annex A6 estimates ~0.1-0.25 ms/step, ~2.2x v1's
  // measured 0.05-0.11 ms/step from edge count alone); scaled from v1.mjs's own documented estimate by that ratio
  // until a live run records the real cost (calibrate.mjs's --budget-minutes check; recorded, not hidden, if the
  // real number differs, per AGENTS.md "Working on brains").
  estimateRegimePointMs() {
    return (12500 / 5) * 2.2;
  },
  estimateWorldCandidateMs(seedCount, ticks) {
    return (29200 / 5) * 2.2 * (ticks / 300) * seedCount;
  },
};
