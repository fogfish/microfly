// Point positions for the brain's neurons (specs/006-fly-status-panel/research.md R6). Pure.
// Neurons with a soma are centred and scaled uniformly into a unit cube (the largest extent maps to 2),
// so the dataset's proportions survive. A snapshot brain draws only those neurons (somaPositions, FR-030).
// Every neuron of a toy brain is placed on a sphere from a seeded PRNG (neuronPositions), so the layout
// is stable between reloads.

import { createPrng } from '../world/prng.js';

const SPHERE_RADIUS = 1;

// The indices of the neurons that have a soma, in index order. A snapshot brain draws only these (FR-030).
export function drawnNeurons(neurons) {
  const out = [];
  neurons.forEach((neuron, i) => {
    if (neuron.soma != null) out.push(i);
  });
  return out;
}

// A snapshot brain's drawn neurons only (FR-030, BUG-001): { drawn, positions }, where drawn is the index of each
// point and positions holds 3 values per drawn neuron, in the same order. Same cube as neuronPositions.
export function somaPositions(neurons) {
  const drawn = drawnNeurons(neurons);
  const { centre, scale } = somaFrame(drawn.map((i) => neurons[i].soma));
  const positions = new Float32Array(3 * drawn.length);
  drawn.forEach((i, k) => {
    for (let axis = 0; axis < 3; axis++) positions[3 * k + axis] = (neurons[i].soma[axis] - centre[axis]) * scale;
  });
  return { drawn, positions };
}

// neurons: [{ soma: [x, y, z] | null }] in index order. Returns Float32Array of 3 × neurons.length.
// Used for toy brains (no soma at all). A neuron without a soma gets a seeded point on the sphere.
export function neuronPositions(neurons, seed) {
  const out = new Float32Array(3 * neurons.length);
  const somas = neurons.filter((n) => n.soma != null).map((n) => n.soma);
  const { centre, scale } = somaFrame(somas);
  const rand = createPrng(seed).next;

  neurons.forEach((neuron, i) => {
    if (neuron.soma != null) {
      for (let axis = 0; axis < 3; axis++) out[3 * i + axis] = (neuron.soma[axis] - centre[axis]) * scale;
      return;
    }
    // Uniform direction on the sphere: z uniform in [-1, 1], azimuth uniform in [0, 2π).
    const z = 2 * rand() - 1;
    const phi = 2 * Math.PI * rand();
    const ring = Math.sqrt(1 - z * z) * SPHERE_RADIUS;
    out[3 * i] = ring * Math.cos(phi);
    out[3 * i + 1] = ring * Math.sin(phi);
    out[3 * i + 2] = z * SPHERE_RADIUS;
  });
  return out;
}

// The centre of the soma bounding box and the factor that makes its largest extent 2.
function somaFrame(somas) {
  if (somas.length === 0) return { centre: [0, 0, 0], scale: 1 };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const soma of somas) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], soma[axis]);
      max[axis] = Math.max(max[axis], soma[axis]);
    }
  }
  const centre = min.map((lo, axis) => (lo + max[axis]) / 2);
  const extent = Math.max(...max.map((hi, axis) => hi - min[axis]));
  return { centre, scale: extent > 0 ? 2 / extent : 1 };
}
