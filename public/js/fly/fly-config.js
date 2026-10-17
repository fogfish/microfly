// Applies the defaults from contracts/fly-config.md to a validated `flies` section. Pure.
// Call only after validateConfig has passed.

import { BRAIN_DEFAULTS } from '../brain/fly-brain.js';

// Forager defaults (contracts/world-config-forager.md). The values are starting points until calibration (T096).
export const ENERGY_DEFAULTS = Object.freeze({ initial: 0.3, metabolism: 0.005, intake: 0.2 });
export const FOOD_DEFAULTS = Object.freeze({
  eatSpeed: 0.5, feedThreshold: 0.5, stock: 1.0, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, reach: 0,
  // Hunger-sensitive feeding (spec 018, contracts/world-config-food-feeding.md): pause while feeding by default,
  // and 30 s recovery for a depleted resource (read only when flies.food.capacity is set).
  feedMotion: 'pause', recovery: 30,
});
export const ANTENNA_OFFSET_DEFAULT = 0.5;
// flies.body.escape defaults (contracts/world-config-wide-io.md, ADR 007 W10): off by default.
export const ESCAPE_DEFAULTS = Object.freeze({ enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 });

// flies.body.locomotion/backup defaults (contracts/world-config-v3.md): both required for v3, so these are the
// zero-steering/zero-backup starting points only a malformed world would ever actually use.
export const LOCOMOTION_DEFAULTS = Object.freeze({
  baseSpeed: 0.5, speedGain: 0, maxSpeed: 3, surgeGain: 0, wander: 0, turnGain: 0, castGain: 0, castMin: 1, castMax: 1,
});
export const BACKUP_DEFAULTS = Object.freeze({ threshold: 0.5, ticks: 10 });
// flies.body.escape default (contracts/world-config-v3.md): enabled is true for v3 (W14), false for v2 (ADR 007).
const ESCAPE_DEFAULTS_V3 = Object.freeze({ ...ESCAPE_DEFAULTS, enabled: true });
export const HUNGER_MODULATOR_DEFAULTS = Object.freeze({ threshold: 0.4 });

export function resolveFlies(config) {
  const f = config.flies;
  const mode = f.mode ?? 'toy';
  const brain = resolveBrain(mode, f.brain);
  const isWide = brain?.version === 'v2' || brain?.version === 'v3';
  const isDemo = brain?.version === 'v3';
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
      // flies.body.sites/escape (v2/v3; contracts/world-config-wide-io.md, world-config-v3.md): inert for every
      // other version, since forager-step.js's escape step and forager-step-wide.js's sampler both read them
      // only when set. v3's escape.enabled defaults to true (W14), v2's to false (ADR 007 D17).
      ...(isWide ? { sites: f.body.sites ?? {}, escape: { ...(isDemo ? ESCAPE_DEFAULTS_V3 : ESCAPE_DEFAULTS), ...f.body.escape } } : {}),
      // flies.body.locomotion/backup (v3 only, required; contracts/world-config-v3.md, W12–W14).
      ...(isDemo ? { locomotion: { ...LOCOMOTION_DEFAULTS, ...f.body.locomotion }, backup: { ...BACKUP_DEFAULTS, ...f.body.backup } } : {}),
      // flies.body.crossWater (v3 only, spec 017 BUG-003): the fly may fly over water cells.
      ...(isDemo ? { crossWater: f.body.crossWater === true } : {}),
      // flies.body.motor (v3 only, optional, spec 017 BUG-004): the motor stage. Absent: commands apply at once.
      ...(isDemo && f.body.motor !== undefined ? { motor: { ...f.body.motor } } : {}),
    },
    food: { ...FOOD_DEFAULTS, ...f.food },
    stimulus: { resting: 0, antennaOffset: ANTENNA_OFFSET_DEFAULT, ...f.stimulus },
    // flies.stimuli (v2/v3; contracts/world-config-wide-io.md): the declared sense sources, generic over the
    // snapshot's channel count. Absent (every pre-v2 world) stays undefined, so forageEnv's v1 path is unaffected.
    ...(isWide ? { stimuli: f.stimuli ?? {} } : {}),
    // flies.modulators.hunger.threshold (D32, v3 only; contracts/world-config-v3.md): a pure world-config
    // override, never written to the snapshot (research.md §6).
    ...(isDemo ? { modulators: { ...f.modulators, hunger: { ...HUNGER_MODULATOR_DEFAULTS, ...f.modulators?.hunger } } } : {}),
    brain,
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
