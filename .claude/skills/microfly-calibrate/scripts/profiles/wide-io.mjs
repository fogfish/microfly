// Profile for the wide-I/O forager brain (ADR 007, container v4 kind "forager-wide", lif-v1.js via
// fly-brain-v1.js -- "Decisions: LIF core and runner": v2 runs the identical core unchanged). Like the 11K
// profile, this brain has no per-neuron `group` field, so it gates on one pseudo-region, "all". Channels are
// read generically from ctx.capabilities.channels.inputs by id (ADR 007 D15's twelve ids), not by position,
// following the 11K profile's own convention -- this brain's channel count has tripled (4 -> 12), so a
// position-based profile would silently misalign the moment the declaration order changed.
//
// A1's clamped probe vectors are built directly here (fixed max 1, resting 0: every forager-wide channel's own
// declared range), not from flies.stimulus/stimuli -- the probe drives the LIF network with a hand-built
// Float32Array (engine.mjs's probe()), never through the world's declared-sense sampler, so this profile has
// no dependency on flies.stimuli/body.sites at all.
//
// axes/gates below are the 11K profile's own grid, carried over as the documented ADR 007 "Calibration
// protocol" starting point (point 2: "start from the 11K world's calibrated LIF block, because the weight rule
// is the same"). The real A1 pool-probe grid (brake/feed/back/avoid/touch directions) and the A2
// outputScale.escape fit run in their own /microfly-calibrate session (research.md R11) -- this profile is the
// skeleton that session wires into, not a finished calibration.

export const profile = {
  id: 'wide-io',
  label: 'Wide-I/O forager brain (ADR 007, v2, container v4 kind "forager-wide")',
  worldPath: 'world/world-forager-wide.json',
  brainVersion: 'v2',
  // scripts/forager-arms.mjs's runForagerArms dispatches stage=world's per-tick run on an arm NAME ("wide"/"v1"/
  // "random-matched"/...), a namespace distinct from flies.brain.version above -- v1.mjs/class-seed-11k.mjs's
  // brainVersion ('v1') happens to double as a valid arm name, but 'v2' does not (forager-arms.mjs only
  // recognises the literal string "wide" for this brain), so this profile must name it explicitly or
  // engine.mjs's runWorldStage silently falls through to the unrelated v0-style fallback arm (found 2026-10-14).
  armName: 'wide',

  prepareContext() {}, // no per-region bookkeeping needed (single pseudo-region, like v1.mjs/class-seed-11k.mjs)
  regionNames: ['all'],
  regionFractions(spikes, ctx) {
    return { all: spikes.length / ctx.snapshot.neuronCount };
  },
  // v2 runs the plain lif-v1.js core (no groupScaleOf field): same correction as v1.mjs/class-seed-11k.mjs.
  appliedScale(net, neuronIndex) {
    return net.outputOverride[neuronIndex] ? net.outputScaleOf[neuronIndex] : net.params.synapticScale;
  },

  // The 11K profile's own grid (ADR 006 "Calibration protocol" point 3), carried over verbatim as the starting
  // search space (ADR 007 "Calibration protocol" point 2). Widened only if the A1 regime sweep finds this brain
  // needs an axis the 11K brain did not.
  axes: {
    synapticScale: [10, 15, 20, 30, 40, 50],
    inhibitoryScale: [1, 1.5, 2, 2.5, 3],
    noise: [[0, 1], [0.1, 0], [0.2, 0], [0.3, 0]],
    tauSyn: [0],
    stimulus: [[0, 0.5], [0, 1]],
    adapt: [[0, 0], [20, 0.05], [50, 0.05], [100, 0.1]],
    thresholdJitter: [0, 0.1, 0.2],
  },
  scaleAxis: 'synapticScale',
  // ADR 007 "Calibration protocol" point 2: start from the 11K world's own calibrated LIF block (same weight
  // rule, postFractionAbsolute). point.stimulus here is [resting, gain] against this profile's fixed max 1,
  // not flies.stimulus's (absent for "v2" worlds) resting/gain/max.
  referencePoint() {
    return {
      synapticScale: 9, inhibitoryScale: 1.5, noise: [0.1, 0], tauSyn: 0, stimulus: [0, 0.5],
      adapt: [50, 0.05], thresholdJitter: 0.1,
    };
  },
  // No group field to gain against (like v1.mjs/class-seed-11k.mjs); classify finds nothing extra to widen
  // until an A1 run shows a region stuck across the whole synapticScale range.
  groupGainAxisFor() {
    return null;
  },

  // Branch 013's corrected gates (BUG-002), carried over from class-seed-11k.mjs: output exempt from the
  // rest/ceiling gate, ceiling scored on a per-step rate so it is comparable across stepsPerTick values.
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

  // engine.mjs's regime()/readout() need exactly rest/odour/taste/left/right (the shared, version-agnostic
  // condition names every profile provides); the remaining entries (legTaste, heatLeft, touchLeft, dangerLeft)
  // are this brain's own A1 pool probes (ADR 007 "Calibration protocol" point 1: brake, feed, back, avoid,
  // touch), read by the calibration session's own extension of A1, not by the generic engine.
  conditions(point, ctx) {
    const inputs = ctx.capabilities.channels.inputs;
    const [resting, gain] = point.stimulus;
    const max = 1; // every forager-wide channel's own declared range (channel-declaration-v5.md)
    const value = (intensity) => Math.min(max, Math.max(0, resting + gain * intensity));
    const rest = value(0);
    const mid = value(0.5);
    const high = value(0.8);
    const vectorOf = (assign) => {
      const v = new Float32Array(inputs.length);
      inputs.forEach((ch, k) => { v[k] = assign(ch) ?? rest; });
      return v;
    };
    const sense = (prefix) => (ch) => ch.id.startsWith(prefix);
    return {
      rest: vectorOf(() => rest),
      // "odour" / "taste": the shared condition names engine.mjs's regime()/readout() read directly.
      odour: vectorOf((ch) => (sense('odour-food')(ch) ? mid : undefined)),
      taste: vectorOf((ch) => (sense('taste')(ch) || sense('odour-food')(ch) ? mid : undefined)),
      left: vectorOf((ch) => (ch.id === 'odour-food-left' ? high : (ch.id === 'odour-food-right' ? rest : undefined))),
      right: vectorOf((ch) => (ch.id === 'odour-food-right' ? high : (ch.id === 'odour-food-left' ? rest : undefined))),
      // This brain's own A1 pool probes (ADR 007 "Calibration protocol" point 1), for the session that extends
      // A1 beyond engine.mjs's generic regime(): brake/feed (mouth taste + food odour vs. food odour alone),
      // back (leg taste alone), avoid (heat-left alone), touch (touch-left alone), danger (recorded, not gated).
      odourFoodPlusMouth: vectorOf((ch) => (sense('odour-food')(ch) || sense('taste-mouth')(ch) ? mid : undefined)),
      legTaste: vectorOf((ch) => (sense('taste-leg')(ch) ? mid : undefined)),
      heatLeft: vectorOf((ch) => (ch.id === 'heat-left' ? high : (ch.id === 'heat-right' ? rest : undefined))),
      touchLeft: vectorOf((ch) => (ch.id === 'touch-left' ? high : (ch.id === 'touch-right' ? rest : undefined))),
      dangerLeft: vectorOf((ch) => (ch.id === 'odour-danger-left' ? high : (ch.id === 'odour-danger-right' ? rest : undefined))),
    };
  },

  // A2 (engine.mjs's readout()) only ever probes rest/odour/taste per scale (the generic three), so escape's
  // fit -- like forward/backward/turn-left/turn-right/feed -- is chosen from those three conditions only; the
  // touch-specific escape probe this brain would ideally want is this profile's own A1 extension, not A2's.
  readoutScales: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192],
  fitReadout(runs, forwardTarget, ctx) {
    const closest = (fn, target) => runs.reduce((a, b) => (Math.abs(fn(b) - target) < Math.abs(fn(a) - target) ? b : a)).s;
    const feedThreshold = ctx.f.food.feedThreshold;
    const scale = {
      forward: closest((r) => r.odour.forward, forwardTarget),
      backward: closest((r) => r.odour.backward, 0.05),
      'turn-left': closest((r) => r.odour['turn-left'], 0.3),
      'turn-right': closest((r) => r.odour['turn-right'], 0.3),
      // Escape carries no behaviour claim (ADR 007 D17); fit to a small, arbitrary operating point like
      // backward's, purely so the panel/experiment has a non-degenerate range to show.
      escape: closest((r) => r.odour.escape, 0.05),
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

  // No single flies.stimulus.radius for "v2" (contracts/world-config-wide-io.md); odour:food's own declared
  // radius is this brain's nearest equivalent (used only for the Gate C "approach" metric's far-start cutoff).
  odourRadius(f) {
    return f.stimuli['odour:food']?.radius ?? 6;
  },

  // Not yet independently measured for this brain. The 11K brain's own estimate (~0.1-0.25 ms/step) is a
  // reasonable starting point: same topology rule, same neuron count (11,000), ~2 % more edges (458,562 vs
  // 448,322, Annex A4) -- scaled by that ratio until a live run records the real cost (calibrate.mjs's
  // --budget-minutes check; recorded, not hidden, if the real number differs, per AGENTS.md).
  estimateRegimePointMs() {
    return (12500 / 5) * 2.2 * (458562 / 448322);
  },
  estimateWorldCandidateMs(seedCount, ticks) {
    return (29200 / 5) * 2.2 * (458562 / 448322) * (ticks / 300) * seedCount;
  },
};
