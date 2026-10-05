import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic } from '../js/world/layout.js';
import { buildWorld, spawnFlies } from '../js/fly/fly-world.js';

const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));
const load = () => JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));

test('the same definition gives identical layout, scatter and fly spawn, run twice', () => {
  const run = () => {
    const config = load();
    const logic = buildLogic(config, catalog);
    const flies = spawnFlies(config, buildWorld(config, logic));
    return { objects: logic.objects, blocked: [...logic.blocked], flies: flies.map((f) => [f.body.x, f.body.y, f.brainSeed]) };
  };
  assert.deepEqual(run(), run());
});
