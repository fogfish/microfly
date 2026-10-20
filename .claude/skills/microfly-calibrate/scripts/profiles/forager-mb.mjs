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

  // C1 regime: demo-v3's own grid (synapticScale 3-6) gave near-zero drive rise here (measured 2026-10-19: every
  // rise under 0.1 Hz against the 3 Hz gate, at every point). Splitting the wide brain's one 6-type odour-food
  // pool into two 3-type pools roughly halves the ORN count driving each channel, so the same scale that worked
  // for the wide brain under-drives this one. Widened per ADR 010 Part L's documented fallback ("input too weak"
  // -> this is the next lever after the contrast gain, already set in world-forager-learning.json).
  c1: {
    grid: { synapticScale: [6, 10, 15, 20, 30, 40], baselineCurrent: [0, 0.02, 0.04, 0.06] },
    gates: {
      restMin: 0.01, restMax: 0.10, driveRiseHz: 3, ignitionTicks: 100,
      seeds: [1, 2], ticks: 300, candidates: 'non-input',
    },
  },

  // C2 decode: same gate numbers as demo-v3. valence covers the senses the body layer steers by (W13); the two
  // teaching pairs (reinforcement-reward/-punish) are not senses and carry no valence entry, matching how the
  // brain treats them as undriven interneurons until Phase 4 (T028/T029) wires an event-driven stimulus to them.
  c2: {
    gates: { seeds: [1, 2, 3], heldBack: 4, ticks: 400, candidates: 'non-input' },
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
