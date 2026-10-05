// Brain dispatcher. Chooses the brain stack by flies.brain.version (contracts/world-config-forager.md):
// "mock" and "v0" (or no version) run the v0 runner in fly-brain-v0.js; "v1" runs the forager runner in
// fly-brain-v1.js. Callers import from here, so the choice of stack is made in one place.

import { createFlyBrain as createV0FlyBrain, BRAIN_DEFAULTS } from './fly-brain-v0.js';
import { createFlyBrain as createV1FlyBrain } from './fly-brain-v1.js';

export { BRAIN_DEFAULTS };

// Version absent: a world with a snapshot is v0, a world without one is mock (spec FR-002).
export function createFlyBrain(brainConfig, seed) {
  const version = brainConfig.version ?? (brainConfig.snapshot !== undefined ? 'v0' : 'mock');
  if (version === 'mock' || version === 'v0') return createV0FlyBrain(brainConfig, seed);
  if (version === 'v1') return createV1FlyBrain({ ...brainConfig, version }, seed);
  throw new Error(`brain version "${version}" is not available in this build`);
}
