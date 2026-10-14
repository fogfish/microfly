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

// Gate C additions, wide-I/O brain (ADR 007 Acceptance; contracts/experiment-metrics-wide.md).

// Metric 6. Brake: median raw forward drive with the mouth site on a flower, divided by the median raw forward
// drive off any flower, for hungry-start flies. records: [{ forward, onFlower }], one per tick.
// Null when either side has no samples, or the off-flower median is too close to 0 for the ratio to mean
// anything (a near-zero denominator blows the ratio up to a number with no interpretable magnitude, which is
// noise, not a finding, to report alongside the metrics that do have one).
const BRAKE_DENOMINATOR_FLOOR = 1e-6;
export function brakeMedian(records) {
  const on = median(records.filter((r) => r.onFlower).map((r) => r.forward));
  const off = median(records.filter((r) => !r.onFlower).map((r) => r.forward));
  return (on === null || off === null || Math.abs(off) < BRAKE_DENOMINATOR_FLOOR) ? null : on / off;
}

// Metric 7. Stay: median ticks per closed bout (fly.bouts, unchanged closeBout shape).
export function stayMedian(bouts) {
  return median(bouts.map((b) => b.ticks));
}

// Metric 8. Avoid: the fraction of ticks a fly spends within `radius` tiles of a hazard.
// records: [{ distance }], one per tick (distance to the nearest hazard of one kind).
export function avoidFraction(records, radius) {
  if (records.length === 0) return 0;
  return records.filter((r) => r.distance <= radius).length / records.length;
}

// Metric 9. Touch: mean turnLeft − turnRight over the `window` ticks following a one-sided touch event (a tick
// whose touchLeft or touchRight input exceeds 0, but not both). records: [{ touchLeft, touchRight, turnLeft,
// turnRight }], one per tick, in order. Null when no touch event occurred (nothing to average).
export function touchTurn(records, window = 10) {
  const deltas = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const oneSided = (r.touchLeft > 0) !== (r.touchRight > 0);
    if (!oneSided) continue;
    for (let k = i + 1; k <= Math.min(i + window, records.length - 1); k++) {
      deltas.push(records[k].turnLeft - records[k].turnRight);
    }
  }
  return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
}

// Metric 10 (telemetry only, never gated — ADR 007 D17). Escape: mean escape output drive while within the
// danger radius versus outside it. records: [{ escape, inDanger }], one per tick.
export function escapeMean(records) {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    inside: mean(records.filter((r) => r.inDanger).map((r) => r.escape)),
    outside: mean(records.filter((r) => !r.inDanger).map((r) => r.escape)),
  };
}
