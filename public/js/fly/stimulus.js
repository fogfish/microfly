// Fruit stimulus (contracts/fly-config.md, research R4). Pure: no DOM.

import { foodFieldAt } from '../world/food-field.js';

// One source's contribution at distance d: linear, 0 at radius. Shared with the odour layer (specs/007-odor-layer R1).
export function falloff(d, radius) {
  return radius > 0 ? Math.max(0, 1 - d / radius) : 0;
}

// points: [{x, y, reach?}] cell centres in tiles. Sums the falloff of every point over its own reach (spec 009,
// contracts/odour-reach.md §2); a point without reach uses the global radius.
export function fruitIntensity(points, x, y, radius) {
  let sum = 0;
  for (const p of points) {
    sum += falloff(Math.hypot(p.x - x, p.y - y), p.reach ?? radius);
  }
  return sum;
}

// Sensory input for neuron 0: clamp(resting + gain × intensity, 0, max).
// resting is the level with no fruit nearby (spec: "sensory input stays at its resting level").
export function sensoryValue(intensity, gain, max, resting = 0) {
  return Math.min(max, Math.max(0, resting + gain * intensity));
}

// The sensory value a fly at (x, y) receives, from the flies.stimulus section.
export function senseAt(points, x, y, stimulus) {
  return sensoryValue(
    fruitIntensity(points, x, y, stimulus.radius),
    stimulus.gain,
    stimulus.max,
    stimulus.resting,
  );
}

// The fly's left, in screen coordinates (y points down): (sin θ, −cos θ). A fly facing east (θ = 0) has its left
// to the north. The turn sign in body.js (FORAGER_TURN_SIGN) is fixed by this convention.
export function antennaPoints(fly, antennaOffset) {
  const sin = Math.sin(fly.heading);
  const cos = Math.cos(fly.heading);
  return {
    left: { x: fly.x + antennaOffset * sin, y: fly.y - antennaOffset * cos },
    right: { x: fly.x - antennaOffset * sin, y: fly.y + antennaOffset * cos },
  };
}

// Bilateral odour (ADR 003 W3): one sample at each antenna. points: [{x, y, fraction}] flower cells, where fraction is
// the stock over the full stock (1 when absent). Each sample is sensoryValue of Σ falloff(d, radius) × fraction.
export function senseBilateral(points, fly, stimulus) {
  const { left, right } = antennaPoints(fly, stimulus.antennaOffset);
  const sample = (at) => {
    let sum = 0;
    for (const p of points) {
      sum += falloff(Math.hypot(p.x - at.x, p.y - at.y), p.reach ?? stimulus.radius) * (p.fraction ?? 1);
    }
    return sensoryValue(sum, stimulus.gain, stimulus.max, stimulus.resting);
  };
  return { left: sample(left), right: sample(right) };
}

// The v1 food-odour path (research.md R4, contracts/world-format-sketch-map.md §4): one antenna sample each,
// read from the irregular stepped food field instead of fruitIntensity's falloff sum. units: [{ cellX, cellY,
// kernel }] (world/fly-world.js, cached once per world load); flowers gives the live stock fraction per unit.
export function senseBilateralField(units, flowers, fly, stimulus) {
  const { left, right } = antennaPoints(fly, stimulus.antennaOffset);
  const sample = (at) => sensoryValue(
    foodFieldAt(units, flowers, Math.floor(at.x), Math.floor(at.y)),
    stimulus.gain,
    stimulus.max,
    stimulus.resting,
  );
  return { left: sample(left), right: sample(right) };
}

// The world position of a declared body site (ADR 007 W8/W9, contracts/world-config-wide-io.md): rotate
// (forward, lateral) by the fly's heading and add it to the body centre. lateral is mirrored per the channel's
// declared side (R negates it); a "both" channel reads lateral 0, generalising antennaPoints (forward 0).
// The same (sin θ, −cos θ) "left" convention as antennaPoints fixes the sign.
export function sitePoint(fly, site, side) {
  const sin = Math.sin(fly.heading);
  const cos = Math.cos(fly.heading);
  const lateral = side === 'R' ? -site.lateral : side === 'both' ? 0 : site.lateral;
  return {
    x: fly.x + site.forward * cos + lateral * sin,
    y: fly.y + site.forward * sin - lateral * cos,
  };
}

// A distance sense at a world point (ADR 007 W8): Σ falloff(d, point.reach ?? radius) × (point.fraction ?? 1),
// clamped to [0, 1] (every declared forager-wide channel's own range).
export function senseDistance(at, points, radius) {
  let sum = 0;
  for (const p of points) {
    sum += falloff(Math.hypot(p.x - at.x, p.y - at.y), p.reach ?? radius) * (p.fraction ?? 1);
  }
  return Math.min(1, sum);
}

// The generic declared-sense sampler (ADR 007 W8, research.md R8; contracts/stimuli-field-sources.md §3): builds
// the one raw value for an input channel from its declared sense's spec (world flies.stimuli[sense]) and a
// sampler built for that sense by the caller (forager-step-wide.js), which already knows whether the sense reads
// world object points (edibles/dangers), world walkability directly (contact, from: "blocked"), or a precomputed
// per-cell field (field, from: "water"/"forestEdge"/food-field-mode "edibles"). `spec.field` is not a world-config
// key; the caller sets it based on `spec.from` before calling this function. `at` is the channel's site point
// (sitePoint), already resolved for the channel's side.
export function senseDeclared(spec, at, sampler) {
  if (spec.contact) return sampler.contactAt(Math.floor(at.x), Math.floor(at.y));
  if (spec.field && spec.interpolate) return fieldBilinear(sampler, at.x, at.y);
  if (spec.field) return sampler.fieldAt(Math.floor(at.x), Math.floor(at.y));
  return senseDistance(at, sampler.points(), spec.radius);
}

// A per-cell field read bilinearly between cell centres (flies.stimuli[sense].interpolate, spec 017 BUG-003). A field
// steps once per tile, and the antennae sit 1 tile apart, so read per cell both often sample one cell and L = R
// whatever the heading. Cells off the grid clamp to the edge. sampler: { fieldAt(cx, cy), width, height }.
export function fieldBilinear(sampler, x, y) {
  const gx = x - 0.5;
  const gy = y - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const cx = (c) => Math.min(sampler.width - 1, Math.max(0, c));
  const cy = (c) => Math.min(sampler.height - 1, Math.max(0, c));
  const at = (i, j) => sampler.fieldAt(cx(i), cy(j));
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

// The bilateral contrast filter (flies.stimuli[sense].contrast, spec 017 BUG-003; ADR 010 Part L "an optional
// declared stimulus contrast gain, off by default"). With m = (L + R) / 2 and d = (L − R) / 2, each side becomes
// clamp(common · m ± gain · d, 0, 1): common < 1 lowers the shared level, so a strong odour does not saturate the
// channel, and gain > 1 widens the L/R difference the body's small antenna span leaves.
export function bilateralContrast(left, right, { common, gain }) {
  const m = (left + right) / 2;
  const d = (left - right) / 2;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  return { left: clamp01(common * m + gain * d), right: clamp01(common * m - gain * d) };
}
