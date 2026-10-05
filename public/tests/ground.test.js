import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { groundPlan, BASE_TILES } from '../js/world/ground.js';

const config = JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));

test('the same seed gives the same grass variant at every cell', () => {
  const a = groundPlan(config, catalog).base;
  const b = groundPlan(config, catalog).base;
  assert.deepEqual(a, b);
  const other = groundPlan({ ...config, seed: config.seed + 1 }, catalog).base;
  assert.notDeepEqual(a, other);
});

test('at least three grass variants appear over the default grid', () => {
  const variants = new Set(groundPlan(config, catalog).base);
  assert.ok(variants.size >= 3, `found ${variants.size}`);
  for (const id of variants) assert.ok(BASE_TILES.includes(id));
});

test('every base tile is a 32 px atlas sprite', () => {
  for (const id of BASE_TILES) {
    const s = catalog.sprites.get(id);
    assert.equal(s.w, 32, id);
    assert.equal(s.h, 32, id);
  }
});
