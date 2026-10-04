// Applies the defaults from contracts/fly-config.md to a validated `flies` section. Pure.
// Call only after validateConfig has passed.

import { BRAIN_DEFAULTS } from '../brain/fly-brain.js';

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
    body: { maxSpeed: f.body.maxSpeed, turnRate: f.body.turnRate },
    stimulus: { resting: 0, ...f.stimulus },
    brain: resolveBrain(mode, f.brain),
    experiment: {
      seeds: f.experiment?.seeds ?? [f.seed ?? config.seed],
      ticks: f.experiment?.ticks ?? 3000,
    },
  };
}

// Toy brains merge every default. A snapshot brain has no toy size, so only the settings that apply
// in both modes get defaults (contracts/integration.md §1).
function resolveBrain(mode, brain) {
  if (mode !== 'toy') return null;
  if (brain?.snapshot === undefined) return { ...BRAIN_DEFAULTS, ...brain };
  return {
    motorSmoothing: BRAIN_DEFAULTS.motorSmoothing,
    telemetry: BRAIN_DEFAULTS.telemetry,
    ...brain,
  };
}
