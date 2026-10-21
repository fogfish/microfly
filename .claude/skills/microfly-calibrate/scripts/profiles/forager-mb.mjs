// Profile for the mushroom-body valence-learning forager brain (ADR 011, v3, same decoder-engine.mjs C1/C2/C3
// pipeline as profiles/demo-v3.mjs). The brain adds two non-overlapping food odours (odour-food-a/-b) and two
// teaching pairs (reinforcement-reward/-punish) in place of the wide brain's single odour-food pair; every other
// declared pair (odour-danger, heat, taste-mouth, taste-leg, touch) is unchanged (research.md §1).

export const profile = {
  id: 'forager-mb',
  label: 'Mushroom-body valence-learning forager brain (ADR 011, v3, decoder + body layer)',
  worldPath: 'world/world-forager-learning.json',
  secondWorldPath: 'world/world-forager-learning-tilemap.json',
  brainVersion: 'v3',
  decoderOutPath: 'brains/forager-brain-mb.decoder.json',

  // C1 regime: this grid (measured 2026-10-19, before the regime-gate retry) found no passing point over
  // synapticScale 3-40 / baselineCurrent 0-0.06 (ADR 011 D35b) — but that search predates ADR 011 D40/D41, which
  // fixed the world's own LIF block exactly (synapticScale 5, baselineCurrent 0, tauSyn 3, pathwayGain) to pass
  // Phase 3's KC-code gate. synapticScale/baselineCurrent are no longer free parameters for this brain: widening
  // them again would drift from the one regime the gate actually validated. The grid below is a single point —
  // the shipped values, read from `ctx.f.brain.lif` via `{ ...ctx.f.brain.lif, ...c1.chosen.point }` — so C1 only
  // verifies the sensorimotor behaviour of the gate-passing brain, never re-searches it.
  // D42 (ADR 011, measured 2026-10-20): at the single gate-passing point, every candidate population's rest
  // activity (0.00036) and drive rise (0.00011-0.017 Hz) sit 1-4 orders of magnitude below the original demo-v3
  // gates (rest 0.01-0.10, rise >= 3 Hz) — the same whole-network sparsity D37 already found for the DAN pools,
  // now confirmed everywhere else C1 looks. User decision, 2026-10-20: relax the gates to just above this
  // brain's own measured noise floor, rather than re-opening the LIF search Phase 3 already closed. The absolute
  // thresholds below only filter literal noise; C2's scale-free checks (sideThreshold, driveSelectivityRatio,
  // reproductionFraction on the held-back seed) still have to find genuine, reproducible selectivity for a pool
  // to exist at all.
  c1: {
    grid: { synapticScale: [5], baselineCurrent: [0] },
    gates: {
      restMin: 0.0001, restMax: 0.001, driveRiseHz: 0.00005, ignitionTicks: 100,
      seeds: [1, 2, 3, 4, 5], ticks: 3000, candidates: 'non-input',
    },
  },

  // C2 decode: sideMinRiseHz/driveRiseHz relaxed to match D42's noise floor (same reasoning as c1 above);
  // sideThreshold, driveSelectivityRatio, reproductionFraction and minSideMembers are scale-free, unchanged from
  // demo-v3's defaults. valence covers the senses the body layer steers by (W13); the two teaching pairs
  // (reinforcement-reward/-punish) are not senses and carry no valence entry, matching how the brain treats them
  // as undriven interneurons until Phase 4 (T028/T029) wires an event-driven stimulus to them.
  c2: {
    // noSidePairs (found 2026-10-21): odour-food-a/b and taste-leg's side-pool candidates are single-spike-level
    // events over the whole probe window at this brain's activity level — confirmed by direct measurement
    // (per-candidate selectivity flips sign on the held-back seed for most members) and by widening ticks
    // 3000->8000, which did not change the outcome (scaling a mean count of ~1 spike up proportionally leaves
    // the same relative shot noise). These three pairs decode via drive (weight/trend) alone; their side pools
    // are skipped by declaration rather than discovered by a reproduction failure (decoder-engine.mjs).
    gates: {
      seeds: [1, 2, 3, 6, 7], heldBack: 4, ticks: 3000, candidates: 'non-input',
      sideMinRiseHz: 0.00005, driveRiseHz: 0.00005,
      noSidePairs: ['odour-food-a', 'odour-food-b', 'taste-leg'],
    },
    // touch (ADR 011 D49/D50): originally near-zero everywhere (its `drive`/`trend` were noise, not signal,
    // which with valence 'avoid' produced a spurious steering artifact — set to 'none' as a stopgap). D50 found
    // the real pathway (mechanosensory_tactile -> AN03A008, one hop, weight up to 0.032 into turnLeft/turnRight
    // -- though turnLeft/turnRight themselves are never read by the v3 decoder; what matters is that AN03A008
    // is a "non-input" C2 candidate) and added `pathwayGain`'s touch route (world config) to amplify it. With
    // that route, C2 now builds side.touch.L/.R (12/14 members) -- touch is back to 'avoid', the real signal.
    valence: {
      'odour-food-a': 'approach', 'odour-food-b': 'approach', 'odour-danger': 'avoid', heat: 'avoid',
      touch: 'avoid', 'taste-leg': 'approach', 'taste-mouth': 'none',
    },
  },

  // C3 smoke: same as demo-v3.
  c3: {
    seeds: [6, 7, 8],
    ticks: 1500,
  },
};
