// Shared setup for the forager-v2-*.test.mjs integration tests: the real extracted 15K brain and world, loaded
// once per process. Skipped (SKIP is a truthy string) when the brain artifact is absent.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { createBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { buildWorld } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { forageEnvV2, initForagerFly } from '../public/js/fly/forager-step.js';

const BRAIN_FILE = fileURLToPath(new URL('../public/brains/forager-brain-15k.brain', import.meta.url));
const WORLD_FILE = fileURLToPath(new URL('../public/world/world-forager-15k.json', import.meta.url));
const CATALOG_FILE = fileURLToPath(new URL('../public/assets/atlas/catalog.json', import.meta.url));

export const SKIP = existsSync(BRAIN_FILE) ? false : 'public/brains/forager-brain-15k.brain is absent';

let cached = null;

export function fixture() {
  if (cached) return cached;
  const worldConfig = JSON.parse(readFileSync(WORLD_FILE, 'utf8'));
  const { catalog } = indexCatalog(JSON.parse(readFileSync(CATALOG_FILE, 'utf8')));
  const logic = buildLogic(worldConfig, catalog);
  const world = buildWorld(worldConfig, logic);
  const f = resolveFlies(worldConfig);
  const flowers = createFood(world, f);
  const b = readFileSync(BRAIN_FILE);
  const snapshot = parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const env = forageEnvV2(f, world, flowers, snapshot.capabilities);
  cached = { f, world, flowers, snapshot, env };
  return cached;
}

// A fresh fly and brain at (x, y), facing east, seeded for reproducibility.
export function newFly(seed, { x = 20, y = 20, energy = 0.1 } = {}) {
  const { f, snapshot } = fixture();
  const brain = createFlyBrain({ ...f.brain, snapshot }, seed);
  const fly = { id: 0, tick: 0, body: createBody({ x, y, heading: 0 }), brainSeed: seed };
  initForagerFly(fly, energy);
  return { fly, brain };
}

// The index of a declared input channel by sense+side, for building a constant-input vector by hand.
export function channelIndex(sense, side) {
  const { snapshot } = fixture();
  return snapshot.capabilities.channels.inputs.findIndex((ch) => ch.sense === sense && ch.side === side);
}

export const OUTPUT_DRIVES = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'];
