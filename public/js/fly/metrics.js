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

// ADR 006 Gate C metrics (contracts/experiment-metrics-v2.md). Pure functions on per-tick records, the same
// style metrics 1-5 above use on per-run/per-bout records. A failed expectation is still returned as a number
// (or null when there is no data to compute it from); whether it passes is a reporting decision, not this
// function's (AGENTS.md: "the fix is config or parameters, recorded with the run", not a changed metric).

// Brake (SC-007): median forward drive with mouth taste present ÷ median forward drive off any flower, hungry
// flies only. tick: { forward, mouthTaste, hungry }. null when either side has no data.
export function brakeMetric(ticks) {
  const hungry = ticks.filter((t) => t.hungry);
  const on = hungry.filter((t) => t.mouthTaste > 0).map((t) => t.forward);
  const off = hungry.filter((t) => t.mouthTaste === 0).map((t) => t.forward);
  const onMedian = median(on);
  const offMedian = median(off);
  if (onMedian === null || offMedian === null || offMedian === 0) return null;
  return onMedian / offMedian;
}

// Avoid: the fraction of ticks within 1.5 tiles of a danger of `dangerKind`. tick: { distanceToDanger }, a map
// keyed by danger kind (spider, lantern) to the fly's distance in tiles that tick, or undefined/Infinity when
// no danger of that kind is within sensing range. Signing against the random-walk arm is a reporting decision
// (ADR 006 Gate C: "reported with its sign"), not this function's.
const AVOID_RADIUS = 1.5;
export function avoidMetric(ticks, dangerKind) {
  if (ticks.length === 0) return 0;
  const within = ticks.filter((t) => (t.distanceToDanger?.[dangerKind] ?? Infinity) <= AVOID_RADIUS);
  return within.length / ticks.length;
}

// Touch: the fraction of ticks with a blocked move (the touch input nonzero that tick). tick: { touch }.
export function touchMetric(ticks) {
  if (ticks.length === 0) return 0;
  return ticks.filter((t) => t.touch > 0).length / ticks.length;
}

// Escape: events per minute while within the danger radius, and outside it. tick: { escaped, nearDanger }.
// tickHz converts a tick count into minutes.
export function escapeMetric(ticks, tickHz) {
  const rate = (subset) => {
    if (subset.length === 0) return 0;
    const minutes = subset.length / tickHz / 60;
    return minutes > 0 ? subset.filter((t) => t.escaped).length / minutes : 0;
  };
  return {
    near: rate(ticks.filter((t) => t.nearDanger)),
    away: rate(ticks.filter((t) => !t.nearDanger)),
  };
}

// Rest: activity (spike-rate fraction) per region, over ticks with no stimulus present (ADR 005's "quiet and
// reactive" question, answered per region, L10). tick: { stimulusPresent, regionActivity }, regionActivity a
// map of region name (input/output/al/vnc/dn/central) to that region's fraction of neurons that spiked the
// tick. Returns one mean fraction per region named in the ticks, or null for a region with no data.
export function restMetric(ticks) {
  const rest = ticks.filter((t) => !t.stimulusPresent);
  const regions = new Set(rest.flatMap((t) => Object.keys(t.regionActivity ?? {})));
  const out = {};
  for (const region of regions) {
    const values = rest.map((t) => t.regionActivity[region]).filter((v) => v !== undefined);
    out[region] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  return out;
}
