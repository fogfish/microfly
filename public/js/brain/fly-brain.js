// Brain dispatcher. Chooses the brain stack by flies.brain.version (contracts/world-config-forager.md,
// contracts/world-config-wide-io.md, contracts/world-config-v3.md): "mock" and "v0" (or no version) run the v0
// runner in fly-brain-v0.js; "v1", "v2" and "v3" all run the forager runner in fly-brain-v1.js unchanged (ADR
// 007 "Decisions: LIF core and runner" — "v2" names the wide-I/O interface generation, not a new core; ADR 010
// D26/Part J — "v3" runs the identical lif-v1.js/fly-brain-v1.js path too). Callers import from here, so the
// choice of stack is made in one place.

import { createFlyBrain as createV0FlyBrain, BRAIN_DEFAULTS } from './fly-brain-v0.js';
import { createFlyBrain as createV1FlyBrain } from './fly-brain-v1.js';

export { BRAIN_DEFAULTS };

// Version absent: a world with a snapshot is v0, a world without one is mock (spec FR-002).
export function createFlyBrain(brainConfig, seed) {
  const version = brainConfig.version ?? (brainConfig.snapshot !== undefined ? 'v0' : 'mock');
  if (version === 'mock' || version === 'v0') return createV0FlyBrain(brainConfig, seed);
  if (version === 'v1' || version === 'v2' || version === 'v3') return createV1FlyBrain({ ...brainConfig, version }, seed);
  throw new Error(`brain version "${version}" is not available in this build`);
}
