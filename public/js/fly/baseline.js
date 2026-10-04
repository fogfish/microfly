// Random-walk baseline motor source (research R7). Pure: no DOM, no worker.
// Same body as a toy fly; the motors are uniform random values instead of a brain.

import { createPrng } from '../world/prng.js';

// Separates the baseline stream from the toy stream for the same fly seed
const BASELINE_SALT = 0xb5297a4d;

export function createBaselineMotor(seed) {
  const rand = createPrng((seed ^ BASELINE_SALT) >>> 0).next;
  return {
    next: () => ({ left: rand(), right: rand() }),
  };
}
