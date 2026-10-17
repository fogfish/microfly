// Profile for the demo forager brain (ADR 010, v3, decoder + body layer on the ADR 009 wide brain). Unlike
// profiles/wide-io.mjs (the retired A1/A2/B grid), this profile only names the world/snapshot and the C1–C3
// gate numbers ADR 010 Part H fixes; decoder-engine.mjs's runC1/runC2/runC3 read the 12 declared input pairs and
// named outputs generically from ctx.capabilities.channels (profiles/wide-io.mjs's own convention).

export const profile = {
  id: 'demo-v3',
  label: 'Demo forager brain (ADR 010, v3, decoder + body layer)',
  worldPath: 'world/world-forager-demo.json',
  secondWorldPath: 'world/world-forager-demo-tilemap.json',
  brainVersion: 'v3',
  decoderOutPath: 'brains/forager-brain-wide.decoder.json',

  // C1 regime (ADR 010 Part H): 16 points x 2 seeds x 300 ticks.
  c1: {
    grid: { synapticScale: [3, 4, 5, 6], baselineCurrent: [0, 0.02, 0.04, 0.06] },
    gates: {
      restMin: 0.01, restMax: 0.10, driveRiseHz: 3, ignitionTicks: 100,
      seeds: [1, 2], ticks: 300, candidates: 'non-input',
    },
  },

  // C2 decode (ADR 010 Part H): 19 conditions x 4 seeds (3 + 1 held-back) x 400 ticks.
  c2: {
    // candidates: D27 as amended (spec 017 BUG-001): every non-input neuron, not only DNs. The same rule runs on
    // the random-graph arm's own C2 (Principle III).
    gates: { seeds: [1, 2, 3], heldBack: 4, ticks: 400, candidates: 'non-input' },
    // D28's own worked example valence table.
    valence: {
      'odour-food': 'approach', 'odour-danger': 'avoid', heat: 'avoid',
      touch: 'avoid', 'taste-leg': 'approach', 'taste-mouth': 'none',
    },
  },

  // C3 smoke (ADR 010 Part H): 2 maps x 3 seeds x 1,500 ticks x 2 arms (brain, random walk).
  c3: {
    seeds: [6, 7, 8],
    ticks: 1500,
  },
};
