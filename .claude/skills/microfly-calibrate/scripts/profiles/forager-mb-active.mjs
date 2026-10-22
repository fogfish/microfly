// Profile for the "active brain" candidate of the MB valence-learning forager brain (recalibration of
// 2026-10-22, specs/019-mb-valence-learning/recalibration-active.md). Same brain and C1/C2/C3 pipeline as
// forager-mb.mjs, pointed at the candidate world copies and their own decoder file, so the shipped
// forager-mb world and decoder are never written.
//
// C1 gates (measured 2026-10-22): rest 0.0038 at the candidate point, 10x the ss5 brain's 0.00036 but below
// demo-v3's 0.01 floor; population drive rises 0.01-0.06 Hz, far under demo-v3's 3 Hz. Gates chosen for this
// candidate, recorded in recalibration-active.md: rest must sit above the old brain's ceiling (0.001: the brain is
// no longer silent) and below demo-v3's ignition ceiling (0.10); the drive rise keeps D42's noise-floor rule. C2's
// scale-free checks (side selectivity, reproduction on the held-back seed) still decide whether a pool exists.
import { profile as mb } from './forager-mb.mjs';

export const profile = {
  ...mb,
  id: 'forager-mb-active',
  label: 'MB valence-learning forager brain, active-brain candidate (ss15 + L13 noiseClassScale)',
  worldPath: 'world/world-forager-learning-active.json',
  secondWorldPath: 'world/world-forager-learning-tilemap-active.json',
  decoderOutPath: 'brains/forager-brain-mb-active.decoder.json',
  c1: {
    grid: { synapticScale: [15], baselineCurrent: [0] },
    gates: {
      restMin: 0.001, restMax: 0.10, driveRiseHz: 0.00005, ignitionTicks: 100,
      seeds: [1, 2, 3, 4, 5], ticks: 3000, candidates: 'non-input',
    },
  },
};

// C2 gates: forager-mb's sideMinRiseHz/driveRiseHz of 0.00005 Hz (D42) were a noise-floor relaxation for the silent
// ss5 brain. On this candidate they admit neurons whose rise is background noise, which then fail reproduction on
// the held-back seed (measured 2026-10-22: E-DECODE-drive for odour-danger, heat, taste-leg, reinforcement-reward).
// D27's own 3 Hz/2 Hz (tried second) dropped drive.odour-food-a entirely and every heat/touch side pool: KCs rise
// only ~0.4-2 Hz under odour (the regime gate's "active" bar is >= 2 spikes per 100 ticks), so 3 Hz excludes the
// MB odour code. 0.5 Hz sits above this brain's background and below the KC odour response.
profile.c2 = {
  ...mb.c2,
  gates: { ...mb.c2.gates, sideMinRiseHz: 0.5, driveRiseHz: 0.5 },
};
