// Profile for the forager brain (ADR 003/004/005, container v4, lif-v1.js via fly-brain-v1.js). This version's
// calibration already concluded (specs/008-hungry-forager-brain/calibration.md, adopted 2026-10-05/09) — this
// profile exists so the generic engine has a second, independently-verifiable case (known ground truth) and so a
// re-calibration (a dataset release change, a new candidate mechanism) does not need new tooling. v1 has no
// per-neuron `group` field (container v4 predates ADR 006 L10), so it gates on one pseudo-region, "all".

import { sensoryValue } from '../../../../../public/js/fly/stimulus.js';

export const profile = {
  id: 'v1',
  label: 'Forager brain (ADR 003-005, container v4)',
  worldPath: 'world/world-forager.json',
  brainVersion: 'v1',

  prepareContext() {}, // no per-region bookkeeping needed (single pseudo-region)
  regionNames: ['all'],
  regionFractions(spikes, ctx) {
    return { all: spikes.length / ctx.snapshot.neuronCount };
  },
  // Corrected against main's actual lif-v1.js (lif-v1.js:204): the net has no `groupScaleOf` (that is a
  // per-neuron group-gain field from the withdrawn 15K brain's generation, never shipped on this brain's
  // runner, ADR 006 W6); the applied scale is the plain synapticScale unless an output override wins.
  appliedScale(net, neuronIndex) {
    return net.outputOverride[neuronIndex] ? net.outputScaleOf[neuronIndex] : net.params.synapticScale;
  },

  // ADR 005 Annex B's own grid (specs/008-hungry-forager-brain/calibration.md, 2026-10-09 second-pass entry).
  axes: {
    synapticScale: [10, 15, 20, 30, 40, 50],
    inhibitoryScale: [1, 1.5, 2, 2.5, 3],
    noise: [[0, 1], [0.1, 0], [0.2, 0], [0.3, 0]],
    tauSyn: [0],
    stimulus: [[0.02, 0.1], [0.02, 0.25], [0.02, 1]],
  },
  scaleAxis: 'synapticScale',
  referencePoint() {
    return { synapticScale: 25, inhibitoryScale: 1, noise: [0.1, 0], tauSyn: 0, stimulus: [0.02, 0.25] };
  },
  // v1 has no per-neuron group to target with its own gain (L10 postdates this brain generation): the base grid
  // already searches the mechanisms ADR 005 found necessary (inhibitoryScale, noise), so "classify" finds nothing
  // extra to widen for this profile.
  groupGainAxisFor() {
    return null;
  },

  gates: {
    restFloor: 0.002,
    restCeiling: 0.1,
    odourGroups: ['all'],
    odourGain: 2,
    neighbours: 0.5,
  },

  brainOf(point) {
    const [noiseAmplitude, noiseBulkScale] = point.noise;
    return { lif: { synapticScale: point.synapticScale, inhibitoryScale: point.inhibitoryScale, noiseAmplitude, noiseBulkScale, tauSyn: point.tauSyn } };
  },

  // v1's 4 fixed channels (odour-left/right, taste-left/right), matched by id rather than position so a future
  // re-declaration does not silently misalign (unlike the original calibrate-forager.mjs this profile replaces).
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

  // Not independently measured this session (v1's original 2026-10-05/09 runs did not record wall-clock cost);
  // scaled from ADR 006 Annex A6's measured step-cost ratio against the 15K profile's own measured constant
  // (v1 ms/step 0.05-0.11 vs 15K's 0.19-0.94, roughly a 5x ratio) -- a documented estimate, not a measurement.
  estimateRegimePointMs() {
    return 12500 / 5;
  },
  estimateWorldCandidateMs(seedCount, ticks) {
    return (29200 / 5) * (ticks / 300) * seedCount;
  },
};
