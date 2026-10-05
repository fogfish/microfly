// The activity counts for a forager brain (FR-033): over the last WINDOW_TICKS ticks of a headless run of the real v1
// brain, the counts line reports active neurons, and some of them are drawn points (a neuron with a soma position).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';
import { WINDOW_TICKS, activeCount, windowCounts } from '../public/js/ui/panel/counts.js';
import { drawnNeurons } from '../public/js/brain/layout.js';

const WEB = new URL('../public/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('world/world-forager.json', WEB), 'utf8'));
const f = resolveFlies(config);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, WEB), 'utf8')));
assert.deepEqual(validateConfig(config), []);
assert.deepEqual(validateArt(config, catalog), []);
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, WEB));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const drawn = drawnNeurons(snapshot.manifest.neurons.map((n) => ({ soma: n.soma ?? null })));

test('the counts line of a forager fly reports active neurons, and some are drawn points', () => {
  const seeded = { ...config, flies: { ...config.flies, seed: f.experiment.heldOut[0] } };
  const flowers = createFood(world, f);
  const env = forageEnv(f, world, flowers, snapshot.capabilities);
  const state = spawnFlies(seeded, world, 'toy')[0];
  const brain = createFlyBrain({ ...f.brain, snapshot, version: 'v1' }, state.brainSeed);
  initForagerFly(state, f.body.energy.initial);
  const history = [];
  for (let t = 0; t < 200; t++) history.push(stepForagerFly(state, env, brain).entry);

  const counts = windowCounts(history, snapshot.neuronCount);
  const active = activeCount(counts);
  assert.ok(active > 0, 'some neurons spike in the window');
  const activeDrawn = [...drawn].filter((n) => counts[n] > 0).length;
  assert.ok(activeDrawn > 0, 'some drawn neurons spike in the window');
  assert.ok(history.length >= WINDOW_TICKS);
});
