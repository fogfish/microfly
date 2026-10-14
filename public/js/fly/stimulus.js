// Fruit stimulus (contracts/fly-config.md, research R4). Pure: no DOM.

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

// The generic declared-sense sampler (ADR 007 W8, research.md R8): builds the one raw value for an input
// channel from its declared sense's spec (world flies.stimuli[sense]) and a sampler built for that sense by the
// caller (forager-step-wide.js), which already knows whether the sense reads world object points (edibles/
// dangers) or world walkability directly (contact, from: "blocked"). `at` is the channel's site point
// (sitePoint), already resolved for the channel's side.
export function senseDeclared(spec, at, sampler) {
  if (spec.contact) return sampler.contactAt(Math.floor(at.x), Math.floor(at.y));
  return senseDistance(at, sampler.points(), spec.radius);
}
