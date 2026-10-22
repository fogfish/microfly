// Profile for the social and pheromone-sense forager brain (ADR 012, v3, same decoder-engine.mjs C1/C2
// pipeline as profiles/forager-mb.mjs). The brain adds odour-conspecific and contact-pheromone to the MB
// brain's existing pairs, plus a song output on pIP10 (research.md R1, R4, R12); every other declared pair
// (odour-food-a/-b, odour-danger, heat, taste-mouth, taste-leg, touch, reinforcement-reward/-punish) is the MB
// brain's own, unchanged.

export const profile = {
  id: 'social-v3',
  label: 'Social and pheromone-sense forager brain (ADR 012, v3, decoder + body layer)',
  worldPath: 'world/world-forager-social.json',
  secondWorldPath: 'world/world-forager-social-tilemap.json',
  brainVersion: 'v3',
  decoderOutPath: 'brains/forager-brain-social.decoder.json',

  // C1 regime: confirm-only, the MB world's shipped LIF block (research R16: "C1 is re-run only to confirm
  // the block"). world-forager-social.json's flies.brain.lif is already that exact block (ADR 011 D40/D41),
  // so this grid is the single point it resolves to, read via `{ ...ctx.f.brain.lif, ...c1.chosen.point }`,
  // the same convention forager-mb.mjs uses. If C1 fails at this point, research R16 says to search the C1
  // grid on calibration seeds instead — this profile's grid stays a single point until that is needed.
  c1: {
    grid: { synapticScale: [5], baselineCurrent: [0] },
    gates: {
      restMin: 0.0001, restMax: 0.001, driveRiseHz: 0.00005, ignitionTicks: 100,
      seeds: [1, 2, 3, 4, 5], ticks: 3000, candidates: 'non-input',
    },
  },

  // C2 decode: the same D27 gates as forager-mb.mjs (unchanged, per contract) — rest/drive thresholds already
  // relaxed to the MB brain's measured noise floor (ADR 011 D42), scale-free gates (sideThreshold,
  // driveSelectivityRatio, reproductionFraction, minSideMembers) at D27's defaults. The condition set is rest,
  // then left-only/right-only/bilateral for every declared pair, including both social pairs — decoder-engine
  // runC2 already loops `declaredPairs(ctx.capabilities)` generically, so social pairs need no extra code
  // (T023 only added the named `song` pool emission).
  c2: {
    // noSidePairs (carried over from forager-mb.mjs, plus one new finding on this brain, 2026-10-21):
    // odour-food-a/b and taste-leg are the MB brain's own three shot-noise pairs. odour-conspecific joins
    // them here because its first C2 run on this brain failed E-DECODE-side.odour-conspecific.R — the held-
    // back seed's right-side candidates flipped sign, the same reproduction failure the other three pairs
    // showed at this brain's activity level (rest 0.0005, about 7-8 of 15349 neurons firing per tick: any
    // pool's per-tick union is single-spike-level shot noise over a 3000-tick window). Declared here rather
    // than retried with a looser threshold (AGENTS.md: a behaviour failure is a finding, not a bug to code
    // around), the same choice forager-mb.mjs already made for its three pairs. contact-pheromone is NOT
    // declared here — its own first C2 run gets a real side-pool attempt.
    gates: {
      seeds: [1, 2, 3, 6, 7], heldBack: 4, ticks: 3000, candidates: 'non-input',
      sideMinRiseHz: 0.00005, driveRiseHz: 0.00005,
      noSidePairs: ['odour-food-a', 'odour-food-b', 'taste-leg', 'odour-conspecific'],
    },
    // valence (research R7): declared from claims.md's linear table plus this C2 run (2026-10-21). The linear
    // probe disagrees with itself for both social pairs (turn-contrast says "toward", backward/escape says
    // "avoid"); C2 adds that odour-conspecific has no reproducible side pool at all (E-DECODE finding,
    // noSidePairs above) and contact-pheromone has a real side pool but no directional evidence beyond the
    // linear probe's own conflict. Neither probe resolves a consistent sign for either pair, so both are
    // `none` (claims.md "Summary", ADR 012 T030). Pre-existing pairs keep the MB decoder's own valence.
    valence: {
      'odour-food-a': 'approach', 'odour-food-b': 'approach', 'odour-danger': 'avoid', heat: 'avoid',
      touch: 'avoid', 'taste-leg': 'approach', 'taste-mouth': 'none',
      'odour-conspecific': 'none', 'contact-pheromone': 'none',
    },
    valenceSource: {
      'odour-conspecific': 'claims.md#odour-conspecific',
      'contact-pheromone': 'claims.md#contact-pheromone',
    },
  },

  // C3 smoke: same convention as demo-v3/forager-mb.
  c3: {
    seeds: [6, 7, 8],
    ticks: 1500,
  },
};
