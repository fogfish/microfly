// Fruit stimulus (contracts/fly-config.md, research R4). Pure: no DOM.

// One source's contribution at distance d: linear, 0 at radius. Shared with the odour layer (specs/007-odor-layer R1).
export function falloff(d, radius) {
  return radius > 0 ? Math.max(0, 1 - d / radius) : 0;
}

// points: [{x, y}] cell centres in tiles. Sums the falloff of every point.
export function fruitIntensity(points, x, y, radius) {
  let sum = 0;
  for (const p of points) {
    sum += falloff(Math.hypot(p.x - x, p.y - y), radius);
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
      sum += falloff(Math.hypot(p.x - at.x, p.y - at.y), stimulus.radius) * (p.fraction ?? 1);
    }
    return sensoryValue(sum, stimulus.gain, stimulus.max, stimulus.resting);
  };
  return { left: sample(left), right: sample(right) };
}
