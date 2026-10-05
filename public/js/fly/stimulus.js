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
