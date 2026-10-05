// Frame cost of the point cloud's per-frame work for 1,000 neurons (SC-006 budget: under 2 ms).
// Not part of npm test. Run with: node scripts/bench-activity.mjs
// It times the brightness computation and the colour-attribute write, the two steps a frame repeats
// while a neuron is fading. The GPU upload is not measured here.

import { createActivity } from '../public/js/brain/activity.js';

const NEURONS = 1000;
const FRAMES = 600;
const BASE = [0.55, 0.8, 1];

const activity = createActivity(NEURONS);
const brightness = new Float32Array(NEURONS);
const colours = new Float32Array(3 * NEURONS);
const spikes = Uint32Array.from({ length: 40 }, (_, k) => k * 25);

let clock = 0;
const frame = () => {
  if (clock % 50 === 0) activity.recordTick(spikes, clock);
  activity.brightness(clock, brightness);
  for (let n = 0; n < NEURONS; n++) {
    const b = brightness[n];
    colours[3 * n] = BASE[0] * b;
    colours[3 * n + 1] = BASE[1] * b;
    colours[3 * n + 2] = BASE[2] * b;
  }
  clock += 16;
};

for (let i = 0; i < 60; i++) frame();
const start = performance.now();
for (let i = 0; i < FRAMES; i++) frame();
const mean = (performance.now() - start) / FRAMES;

console.log(`${NEURONS} neurons, ${FRAMES} frames: mean ${mean.toFixed(3)} ms per frame (budget 2 ms)`);
process.exitCode = mean < 2 ? 0 : 1;
