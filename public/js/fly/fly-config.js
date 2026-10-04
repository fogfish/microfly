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
    brain: mode === 'toy' ? { ...BRAIN_DEFAULTS, ...f.brain } : null,
    experiment: {
      seeds: f.experiment?.seeds ?? [f.seed ?? config.seed],
      ticks: f.experiment?.ticks ?? 3000,
    },
  };
}
