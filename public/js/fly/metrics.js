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

// Metric 9. Touch: mean turn toward the touched side over the `window` ticks following a one-sided touch event (a
// tick whose touchLeft or touchRight input exceeds 0, but not both): turnLeft − turnRight after a left touch, its
// negative after a right touch, so > 0 is toward the touched side for either side. BUG-001 (spec 013): it used to
// average turnLeft − turnRight for both sides, which measured the fly's left bias, not its touch response.
// records: [{ touchLeft, touchRight, turnLeft, turnRight }], one per tick, in order. Null when no touch event
// occurred (nothing to average).
export function touchTurn(records, window = 10) {
  const deltas = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const oneSided = (r.touchLeft > 0) !== (r.touchRight > 0);
    if (!oneSided) continue;
    const side = r.touchLeft > 0 ? 1 : -1;
    for (let k = i + 1; k <= Math.min(i + window, records.length - 1); k++) {
      deltas.push(side * (records[k].turnLeft - records[k].turnRight));
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

// Part K, v3-style arms (ADR 010, spec.md SC-002/SC-003). These reuse only the per-tick records every v3-style
// cohort already collects (dangerRecords/heatRecords: [{ distance }]; onFlower/eating pairs) — no new instrumentation.

// K2. The fraction of arrivals at food (a tick where onFlower goes false -> true) followed by an eating tick
// within `window` ticks (SC-002: "at least 80% ... within 50 ticks"). records: one fly's [{ onFlower, eating }],
// one per tick, in tick order — call once per fly (never flatMap across flies: a window must not cross a fly
// boundary, the same rule touchTurn (metric 9) already follows) and pool the returned { arrivals, fed } counts.
export function feedArrivalWithin(records, window = 50) {
  let arrivals = 0;
  let fed = 0;
  for (let i = 0; i < records.length; i++) {
    const prevOnFlower = i > 0 ? records[i - 1].onFlower : false;
    if (prevOnFlower || !records[i].onFlower) continue;
    arrivals++;
    for (let k = i; k <= Math.min(i + window, records.length - 1); k++) {
      if (records[k].eating) { fed++; break; }
    }
  }
  return { rate: arrivals ? fed / arrivals : null, arrivals, fed };
}

// K4. The fraction of hazard-ring encounters (a tick where distance goes from > radius to <= radius) followed,
// within `window` ticks, by the fly leaving the ring again (distance > radius) — "escape or turn away" (SC-003:
// "at least 90% ... within 20 ticks"), read off the same distance trace avoidFraction (K5/K6) already uses: both
// an escape jump and a steering turn-away show up as the fly leaving the ring, so no separate escape flag is
// needed. records: one fly's [{ distance }], one per tick, in tick order — call once per fly (never flatMap
// across flies, same boundary rule as feedArrivalWithin above) and pool the returned { encounters, resolved } counts.
export function escapeOrTurnWithin(records, radius, window = 20) {
  let encounters = 0;
  let resolved = 0;
  for (let i = 0; i < records.length; i++) {
    const prevIn = i > 0 ? records[i - 1].distance <= radius : false;
    if (prevIn || records[i].distance > radius) continue;
    encounters++;
    for (let k = i + 1; k <= Math.min(i + window, records.length - 1); k++) {
      if (records[k].distance > radius) { resolved++; break; }
    }
  }
  return { rate: encounters ? resolved / encounters : null, encounters, resolved };
}

// ---- ADR 012 research.md R14: social metrics. The caller (scripts/social-arms.mjs) computes the per-tick
// neighbour geometry once, directly off the live fly table it already holds in its lockstep loop, and hands
// each fly its own per-tick record array (the same "never flatMap across flies" rule as above, because contact
// and song are run-length-encoded over the tick sequence — merging two flies' arrays would splice their events
// together at the join). records: one fly's own
//   [{ nnDistance, nnHeading, nnAhead, nnSex, heading, contactWith, contactSide, contactSex, singing }]
// one entry per tick, in tick order. nnDistance/nnHeading/nnSex describe the nearest live other fly (null when
// none); nnAhead is true when that neighbour lies in this fly's own forward half-plane. contactWith is the
// touched fly's id (null when none), contactSide 'L'/'R', contactSex its sex.

// The nnDistance series, one fly's own records (the ticks with no live neighbour kept as null, not dropped,
// so the series stays index-aligned with records for a caller that wants to cross-reference a tick).
export function nnDistances(records) {
  return records.map((r) => r.nnDistance);
}

// The median nearest-neighbour distance over ticks with a live neighbour.
export function nnMedian(records) {
  return median(nnDistances(records).filter((d) => d !== null));
}

// The fraction of ticks (with a live neighbour) at nnDistance <= radius tiles (default 2, research R14).
export function timeNear(records, radius = 2) {
  const valid = records.filter((r) => r.nnDistance !== null);
  return valid.length ? valid.filter((r) => r.nnDistance <= radius).length / valid.length : null;
}

// Contact events: a run of ticks with the same contactWith id. Each event is
// { onset, duration, otherId, side, otherSex }, read from the tick that opens the run.
export function contactEvents(records) {
  const events = [];
  let open = null;
  records.forEach((r, t) => {
    if (r.contactWith !== null && r.contactWith !== undefined) {
      if (!open) open = { onset: t, duration: 0, otherId: r.contactWith, side: r.contactSide ?? null, otherSex: r.contactSex ?? null };
      open.duration += 1;
    } else if (open) {
      events.push(open);
      open = null;
    }
  });
  if (open) events.push(open);
  return events;
}

// Contact-event onsets per simulated minute (research R14 "Contact rate").
export function contactRate(records, tickHz) {
  const minutes = records.length / tickHz / 60;
  return minutes > 0 ? contactEvents(records).length / minutes : null;
}

// Mean contact-event length, in ticks.
export function contactDuration(records) {
  const events = contactEvents(records);
  return events.length ? events.reduce((s, e) => s + e.duration, 0) / events.length : null;
}

// Over ticks with a live neighbour at nnDistance <= radius, the mean of cos(heading - nnHeading), zeroed on
// ticks where the neighbour is not ahead of this fly (research R14): near 1 for a follower directly behind a
// leader heading the same way, near 0 on average for an independent random walk.
export function followingIndex(records, radius = 2) {
  const values = records
    .filter((r) => r.nnDistance !== null && r.nnDistance <= radius)
    .map((r) => (r.nnAhead ? Math.cos(r.heading - r.nnHeading) : 0));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// Song bouts: a run of ticks with singing true. Each bout is { onset, duration }.
export function songBouts(records) {
  const bouts = [];
  let open = null;
  records.forEach((r, t) => {
    if (r.singing) {
      if (!open) open = { onset: t, duration: 0 };
      open.duration += 1;
    } else if (open) {
      bouts.push(open);
      open = null;
    }
  });
  if (open) bouts.push(open);
  return bouts;
}

// Song-bout onsets during a contact event / contact events (one fly), against song-bout onsets per tick alone
// (nnDistance null or > radius) — research R14 "Song per contact". events/bouts may be precomputed (so a
// caller pooling across flies, e.g. by sex, can filter the event list once and reuse it for both figures).
export function songPerContact(records, radius = 2, events = contactEvents(records), bouts = songBouts(records)) {
  const duringAnyEvent = (onset) => events.some((e) => onset >= e.onset && onset < e.onset + e.duration);
  const perContact = events.length ? bouts.filter((b) => duringAnyEvent(b.onset)).length / events.length : null;
  const aloneTicks = records.filter((r) => r.nnDistance === null || r.nnDistance > radius).length;
  const aloneOnsets = bouts.filter((b) => {
    const r = records[b.onset];
    return r === undefined || r.nnDistance === null || r.nnDistance > radius;
  }).length;
  const perTickAlone = aloneTicks > 0 ? aloneOnsets / aloneTicks : null;
  return { perContact, perTickAlone };
}

// Pools the metrics above across a roster of flies, overall and split by the *other* fly's sex tag (research
// R14 "Sex split"). flies: [{ sex, records }], each records the fly's own per-tick array (as above).
export function socialSummary(flies, { radius = 2, tickHz = 20 } = {}) {
  const perFly = flies.map(({ sex, records }) => {
    const events = contactEvents(records);
    const bouts = songBouts(records);
    const minutes = records.length / tickHz / 60;
    return {
      sex,
      nnMedian: nnMedian(records),
      timeNear: timeNear(records, radius),
      contactRate: minutes > 0 ? events.length / minutes : null,
      contactDuration: events.length ? events.reduce((s, e) => s + e.duration, 0) / events.length : null,
      followingIndex: followingIndex(records, radius),
      song: songPerContact(records, radius, events, bouts),
    };
  });

  const bySex = {};
  for (const sex of new Set(flies.map((f) => f.sex))) {
    const nnPool = flies.flatMap(({ records }) => records.filter((r) => r.nnSex === sex));
    const minutesTotal = flies.reduce((s, { records }) => s + records.length, 0) / tickHz / 60;
    const perFlyEvents = flies.map(({ records }) => ({
      records, events: contactEvents(records).filter((e) => e.otherSex === sex), bouts: songBouts(records),
    }));
    const eventsPool = perFlyEvents.flatMap((f) => f.events);
    const songDuringPool = perFlyEvents.flatMap(({ bouts, events }) => bouts.filter(
      (b) => events.some((e) => b.onset >= e.onset && b.onset < e.onset + e.duration),
    ));
    bySex[sex] = {
      nnMedian: median(nnPool.map((r) => r.nnDistance)),
      timeNear: nnPool.length ? nnPool.filter((r) => r.nnDistance <= radius).length / nnPool.length : null,
      contactRate: minutesTotal > 0 ? eventsPool.length / minutesTotal : null,
      contactDuration: eventsPool.length ? eventsPool.reduce((s, e) => s + e.duration, 0) / eventsPool.length : null,
      followingIndex: nnPool.filter((r) => r.nnDistance <= radius).length
        ? nnPool.filter((r) => r.nnDistance <= radius)
            .reduce((s, r) => s + (r.nnAhead ? Math.cos(r.heading - r.nnHeading) : 0), 0)
          / nnPool.filter((r) => r.nnDistance <= radius).length
        : null,
      songPerContact: eventsPool.length ? songDuringPool.length / eventsPool.length : null,
    };
  }
  return { perFly, bySex };
}
