// Gate C metrics (ADR 003; contracts/experiment-metrics.md). Pure: no DOM, no fetch. Each function reads run records:
//   fly:  { found, startDistance, firstContactTick, startEnergy? }
//   bout: { cell, ticks, endedBy }   (endedBy: 'empty' | 'sated' | 'walked', from energy.js closeBout)

import { createPrng } from '../world/prng.js';

const BOOTSTRAP_ROUNDS = 1000;

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The mean of values, resampled with replacement `BOOTSTRAP_ROUNDS` times from a seeded PRNG. Returns the 2.5 % and 97.5 %
// quantiles of the resampled means. The same seed gives the same interval.
export function bootstrapCI(values, seed, rounds = BOOTSTRAP_ROUNDS) {
  if (values.length === 0) return [0, 0];
  const rand = createPrng(seed).int;
  const means = [];
  for (let r = 0; r < rounds; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[rand(0, values.length - 1)];
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * (rounds - 1))], means[Math.floor(0.975 * (rounds - 1))]];
}

// Metric 1. The share of flies that reached a flower.
export function findRate(flies) {
  const found = flies.filter((f) => f.found).length;
  return { rate: flies.length ? found / flies.length : 0, found, count: flies.length };
}

// The 95 % bootstrap interval of the find rate over flies.
export function findInterval(flies, seed) {
  return bootstrapCI(flies.map((f) => (f.found ? 1 : 0)), seed);
}

// Metric 2. The median tick of the first flower contact, for flies that started more than one odour radius away.
// Flies that never reached a flower are excluded and counted.
export function approachMedian(flies, radius) {
  const far = flies.filter((f) => f.startDistance > radius);
  const reached = far.filter((f) => f.firstContactTick !== null && f.firstContactTick !== undefined);
  return {
    median: median(reached.map((f) => f.firstContactTick)),
    included: reached.length,
    excluded: far.length - reached.length,
  };
}

// Metric 3. The median length of eating bouts, in ticks.
export function eatMedian(bouts) {
  return median(bouts.map((b) => b.ticks));
}

// Metric 4. The share of eating bouts that ended with the fly walking off before the flower was empty.
export function walkedShare(bouts) {
  if (bouts.length === 0) return 0;
  return bouts.filter((b) => b.endedBy === 'walked').length / bouts.length;
}

// Metric 5. The find rate of hungry starts minus the find rate of sated starts.
export function hungerDependence(hungryFlies, satedFlies) {
  return findRate(hungryFlies).rate - findRate(satedFlies).rate;
}
