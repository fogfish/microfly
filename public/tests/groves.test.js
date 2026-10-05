import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { validateConfig } from '../js/world/validate.js';
import { buildScene } from '../js/world/layout.js';

const config = JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));

const grove = (n) => ({
  id: 'g',
  centre: [20, 20],
  trees: Array.from({ length: n }, (_, i) => ({ sprite: 'trees-tree-005', dx: i * 0.5, dy: 0 })),
});

test('a grove with 3 trees is refused with a message', () => {
  const errors = validateConfig({ ...config, groves: [grove(3)] });
  assert.deepEqual(errors.map((e) => e.path), ['groves[0].trees']);
  assert.match(errors[0].message, /needs 4 to 12 trees; found 3/);
});

test('a grove with 13 trees is refused', () => {
  const errors = validateConfig({ ...config, groves: [grove(13)] });
  assert.deepEqual(errors.map((e) => e.path), ['groves[0].trees']);
});

test('a grove with 4 to 12 trees is accepted', () => {
  for (const n of [4, 12]) {
    assert.deepEqual(validateConfig({ ...config, groves: [grove(n)] }), []);
  }
});

test('a grove expands to placed objects, each marked solid, in the same order every time', () => {
  const c = { ...config, objects: [], scatter: [], edibles: [], dangers: [], groves: [grove(5)] };
  const first = buildScene(c, catalog).objects;
  const second = buildScene(c, catalog).objects;
  assert.equal(first.length, 5);
  assert.ok(first.every((o) => o.solid === true && o.group === 'g'));
  assert.deepEqual(first, second);
  assert.equal(first[0].x, 20);
});
