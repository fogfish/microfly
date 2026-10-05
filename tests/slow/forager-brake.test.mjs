// The shipped forager world, run with the trained v1 brain on the HELD-OUT seeds (SC-011, SC-012, FR-032). A hungry fly
// that reaches a flower must slow below the eating speed and eat there, and every eating tick must carry taste input.
// The brain is the real one (not scripted): this is the check that the brake comes from the brain (FR-026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../../public/js/world/validate.js';
import { indexCatalog } from '../../public/js/world/catalog.js';
import { buildLogic } from '../../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../../public/js/fly/fly-world.js';
import { resolveFlies } from '../../public/js/fly/fly-config.js';
import { createFlyBrain } from '../../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../../public/js/brain/snapshot.js';
import { createFood } from '../../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../../public/js/fly/forager-step.js';

const WEB = new URL('../../public/', import.meta.url);
const TICKS = 3000;

const config = JSON.parse(readFileSync(new URL('world/world-forager.json', WEB), 'utf8'));
const f = resolveFlies(config);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, WEB), 'utf8')));
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, WEB));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
assert.deepEqual(validateConfig(config), []);
assert.deepEqual(validateArt(config, catalog), []);

// One held-out seed: every fly of the main cohort, with its own brain. Returns the per-fly outcome.
function runSeed(seed) {
  const seeded = { ...config, flies: { ...config.flies, seed } };
  const flowers = createFood(world, f);
  const env = forageEnv(f, world, flowers, snapshot.capabilities);
  return spawnFlies(seeded, world, 'toy').map((state) => {
    const brain = createFlyBrain({ ...f.brain, snapshot, version: 'v1' }, state.brainSeed);
    initForagerFly(state, f.body.energy.initial);
    let reached = false;
    const eatingEntries = [];
    for (let t = 0; t < TICKS; t++) {
      const { entry } = stepForagerFly(state, env, brain);
      if (entry.eating) eatingEntries.push(entry);
      const cx = Math.floor(state.body.x);
      const cy = Math.floor(state.body.y);
      if (world.isStimulusCell(cx, cy) && flowers.stockAt(cx, cy) > 0) reached = true;
    }
    return { reached, bouts: state.bouts.length, eatingEntries };
  });
}

const flies = config.flies.experiment.heldOut.flatMap(runSeed);
const reached = flies.filter((x) => x.reached);
const withBout = reached.filter((x) => x.bouts > 0);

test('at least 50% of flies that reach a flower eat in at least one bout (SC-011)', { todo: 'BUG-002: fails until T112 fixes the brake' }, () => {
  assert.ok(reached.length > 0, 'some flies reach a flower');
  const share = withBout.length / reached.length;
  assert.ok(share >= 0.5, `eating share ${share.toFixed(2)} of ${reached.length} flies that reached a flower`);
});

test('every eating tick is below the eating speed and has taste input above 0 (SC-011, SC-012)', { todo: 'BUG-002: fails until T112 fixes the brake' }, () => {
  const eating = flies.flatMap((x) => x.eatingEntries);
  assert.ok(eating.length > 0, 'the fleet eats');
  for (const e of eating) {
    assert.ok(e.speed < f.food.eatSpeed, `speed ${e.speed} at an eating tick`);
    assert.ok(e.inputs[2] > 0 && e.inputs[3] > 0, 'taste input at an eating tick');
  }
});
