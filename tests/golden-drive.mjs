// The toy golden procedure, shared by scripts/record-toy-golden.mjs and tests/lif-golden.test.mjs.
// Not a test file: node --test only runs *.test.mjs.
// Toy brain (40 neurons, seed 2834727945), driven by sensory 0.5 for 200 ticks, 0 for 200, 1.0 for 200.

import { createFlyBrain } from '../public/js/brain/fly-brain.js';

export const GOLDEN_SEED = 2834727945;
export const GOLDEN_CONFIG = Object.freeze({
  neuronCount: 40,
  outDegree: 4,
  inhibitoryFraction: 0.2,
  motorSmoothing: 0.05,
});
export const GOLDEN_DRIVE = Object.freeze([
  { value: 0.5, ticks: 200 },
  { value: 0, ticks: 200 },
  { value: 1.0, ticks: 200 },
]);

// Returns { left, right, spikes } with one entry per tick. spikes lists the neurons that spiked that tick.
export function runToyGolden() {
  const brain = createFlyBrain(GOLDEN_CONFIG, GOLDEN_SEED);
  const trace = { left: [], right: [], spikes: [] };
  for (const { value, ticks } of GOLDEN_DRIVE) {
    for (let t = 0; t < ticks; t++) {
      const out = brain.step(value);
      trace.left.push(out.left);
      trace.right.push(out.right);
      trace.spikes.push(Array.from(out.spikes));
    }
  }
  return trace;
}
