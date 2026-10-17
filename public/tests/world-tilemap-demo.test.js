// world-forager-demo-tilemap.json (Story 4, R5/K8): the second demo map, hand-authored tile sections
// (ground/waterBodies/objects/groves/scatter), structurally distinct from world-forager-demo.json's sketch
// `map` block (contracts/world-format-sketch-map.md) — buildLogic (world/layout.js) dispatches on `config.map`,
// so the two configs exercise different code paths, not just different numbers. Same conventions as
// ground.test.js/water.test.js/scatter.test.js: validate, then build the actual logic grid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../js/world/validate.js';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic } from '../js/world/layout.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../world/${name}`, import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));

test('world-forager-demo-tilemap.json has no validation errors', () => {
  assert.deepEqual(validateConfig(load('world-forager-demo-tilemap.json')), []);
});

test('the tilemap config uses hand-authored tile sections, not the sketch-map plan (structurally distinct from the first map)', () => {
  const tilemap = load('world-forager-demo-tilemap.json');
  const sketch = load('world-forager-demo.json');
  assert.equal(tilemap.map, undefined, 'the tilemap config must not declare a sketch `map` block');
  assert.ok(Array.isArray(tilemap.ground) && tilemap.ground.length > 0, 'the tilemap config must declare ground areas');
  assert.ok(sketch.map !== undefined, 'the first map must still be the sketch-map format (regression guard)');
});

test('buildLogic generates a walkable grid at the declared size, with water, blocked cells, edibles and dangers', () => {
  const config = load('world-forager-demo-tilemap.json');
  const logic = buildLogic(config, catalog);
  const { cols, rows } = config.grid;
  assert.equal(logic.cols, cols);
  assert.equal(logic.rows, rows);
  assert.equal(logic.water.length, cols * rows);
  assert.equal(logic.blocked.length, cols * rows);

  const walkableCount = [...logic.blocked].filter((b) => b === 0).length;
  assert.ok(walkableCount > 0, 'the generated grid must have at least some walkable cells');

  const edibleCells = logic.edible.filter((kind) => kind !== null);
  const dangerCells = logic.danger.filter((kind) => kind !== null);
  assert.equal(edibleCells.length, config.edibles.length);
  assert.equal(dangerCells.length, config.dangers.length);
});

test('the same seed gives the same generated grid (determinism)', () => {
  const config = load('world-forager-demo-tilemap.json');
  const a = buildLogic(config, catalog);
  const b = buildLogic(config, catalog);
  assert.deepEqual([...a.water], [...b.water]);
  assert.deepEqual([...a.blocked], [...b.blocked]);
});
