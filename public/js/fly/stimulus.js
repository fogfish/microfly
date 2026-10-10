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

// ADR 006 W6/W7: declared senses. A v2 input channel names a `sense` and a body `site`; `flies.stimuli` (plural)
// declares, per sense, which world objects produce it and how it falls off; `flies.body.sites` declares each
// site's forward offset. SITE_LATERAL is the fixed half-spacing a bilateral (side L/R) site samples at, left
// being (sin θ, −cos θ) as antennaPoints already fixes; it is not a world-config knob (W7 declares only the
// forward offset per site).
export const SITE_LATERAL = 0.15;

// The world position a channel's declared site samples at, for a fly facing `fly.heading`. `side` is the
// channel's own 'L'/'R'/'both'; only 'L'/'R' channels get the lateral offset.
export function sitePoint(fly, site, side, bodySites) {
  const forward = bodySites[site] ?? 0;
  const sin = Math.sin(fly.heading);
  const cos = Math.cos(fly.heading);
  const x = fly.x + forward * cos;
  const y = fly.y + forward * sin;
  if (side !== 'L' && side !== 'R') return { x, y };
  const lateral = side === 'L' ? SITE_LATERAL : -SITE_LATERAL;
  return { x: x + lateral * sin, y: y - lateral * cos };
}

// Resolves one declared input channel's value (W6): `touch` is binary (1 when its site's cell is not walkable,
// else 0); every other sense sums falloff(d, radius) × fraction over the stimulus's declared source points
// (env.ediblePoints()/env.dangerPoints(kinds), already filtered and reach-tagged), sampled at the channel's site
// point. fliesStimuli is the world config's flies.stimuli section; bodySites is flies.body.sites. Reuses the
// existing falloff() unchanged (no gain/clamp here — fly-brain-v2.js's input encoding applies gain and clamp).
export function resolveDeclaredStimulus(channel, fly, fliesStimuli, bodySites, env) {
  const point = sitePoint(fly, channel.site, channel.side, bodySites);
  if (channel.sense === 'touch') {
    return env.isWalkable(Math.floor(point.x), Math.floor(point.y)) ? 0 : 1;
  }
  const decl = fliesStimuli[channel.sense];
  const points = decl.from === 'dangers' ? env.dangerPoints(decl.kinds) : env.ediblePoints();
  let sum = 0;
  for (const p of points) {
    sum += falloff(Math.hypot(p.x - point.x, p.y - point.y), decl.radius ?? p.reach) * (p.fraction ?? 1);
  }
  return sum;
}
