// Held-out seeds (contracts/experiment-metrics.md): experiment.heldOut is 30 seeds and must not overlap the calibration
// seeds experiment.seeds. The message names the overlapping seeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';

const world = JSON.parse(readFileSync(fileURLToPath(new URL('../public/world/world.json', import.meta.url)), 'utf8'));
const withExperiment = (experiment) => ({ ...world, flies: { ...world.flies, experiment } });
const messages = (experiment) => validateConfig(withExperiment(experiment)).map((e) => `${e.path} ${e.message}`);
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('a held-out list of 30 seeds that do not overlap the calibration seeds is valid', () => {
  assert.deepEqual(messages({ seeds: [1, 2, 3], ticks: 10, heldOut: range(100, 129) }), []);
});

test('the held-out list must have 30 seeds', () => {
  assert.ok(messages({ seeds: [1], heldOut: range(100, 110) })
    .includes('flies.experiment.heldOut must be a list of 30 distinct integers from 0 to 4294967295'));
});

test('the held-out seeds must not overlap the calibration seeds, and the message names them', () => {
  const heldOut = [7, 101, ...range(110, 137)]; // 30 seeds; 7 and 101 are calibration seeds
  const seeds = [7, 8, 101];
  assert.ok(messages({ seeds, heldOut }).includes('flies.experiment.heldOut overlaps flies.experiment.seeds: 7, 101'));
});
