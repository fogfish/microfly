// Applies the defaults from contracts/fly-config.md to a validated `flies` section. Pure.
// Call only after validateConfig has passed.

import { BRAIN_DEFAULTS } from '../brain/fly-brain.js';

// Forager defaults (contracts/world-config-forager.md). The values are starting points until calibration (T096).
export const ENERGY_DEFAULTS = Object.freeze({ initial: 0.3, metabolism: 0.005, intake: 0.2 });
export const FOOD_DEFAULTS = Object.freeze({
  eatSpeed: 0.5, feedThreshold: 0.5, stock: 1.0, consumeRate: 0.2, regrowth: 0.02, sated: 0.9,
});
export const ANTENNA_OFFSET_DEFAULT = 0.5;

export function resolveFlies(config) {
  const f = config.flies;
  const mode = f.mode ?? 'toy';
  return {
    seed: f.seed ?? config.seed,
    count: f.count ?? 6,
    mode,
    tickHz: f.tickHz ?? 20,
    sprite: f.sprite,
    baselineSprite: f.baselineSprite ?? f.sprite,
    // Per-fly sex (contracts/fly-sprite.md §2, BUG-002): picks fly-female/fly-male (and baseline) per fly
    // index. Falls back to the single sprite/baselineSprite above when a world does not declare it.
    sex: f.sex,
    body: {
      maxSpeed: f.body.maxSpeed,
      turnRate: f.body.turnRate,
      energy: { ...ENERGY_DEFAULTS, ...f.body.energy },
    },
    food: { ...FOOD_DEFAULTS, ...f.food },
    stimulus: { resting: 0, antennaOffset: ANTENNA_OFFSET_DEFAULT, ...f.stimulus },
    brain: resolveBrain(mode, f.brain),
    experiment: {
      seeds: f.experiment?.seeds ?? [f.seed ?? config.seed],
      ticks: f.experiment?.ticks ?? 3000,
      ...(f.experiment?.heldOut !== undefined ? { heldOut: f.experiment.heldOut } : {}),
    },
  };
}

// Toy brains merge every default. A snapshot brain has no toy size, so only the settings that apply
// in both modes get defaults (contracts/integration.md §1). The resolved brain always carries its version.
function resolveBrain(mode, brain) {
  if (mode !== 'toy') return null;
  const version = resolveBrainVersion(brain);
  if (brain?.snapshot === undefined) return { ...BRAIN_DEFAULTS, ...brain, version };
  return {
    motorSmoothing: BRAIN_DEFAULTS.motorSmoothing,
    ...brain,
    version,
  };
}

// The brain stack for a brain section (contracts/world-config-forager.md). Absent version: "mock" when there is
// no snapshot, "v0" when there is one (spec FR-002). Existing worlds therefore resolve as before.
export function resolveBrainVersion(brain) {
  if (brain?.version !== undefined) return brain.version;
  return brain?.snapshot === undefined ? 'mock' : 'v0';
}
