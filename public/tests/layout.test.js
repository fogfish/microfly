import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { buildLogic, cellIndex } from '../js/world/layout.js';

const config = JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));
const logic = buildLogic(config, catalog);
const N = config.grid.cols * config.grid.rows;

test('water cells are blocked', () => {
  assert.ok(logic.water.some((v) => v === 1), 'the shipped world has water');
  for (let i = 0; i < N; i++) {
    if (logic.water[i]) assert.equal(logic.blocked[i], 1, `water cell ${i} must be blocked`);
  }
});

test('a solid object blocks the cell under its foot point', () => {
  const tree = config.objects.find((o) => o.solid);
  assert.equal(logic.blocked[cellIndex(tree.x, tree.y, logic.cols)], 1);
});

test('the masks are the same size as the grid', () => {
  assert.equal(logic.water.length, N);
  assert.equal(logic.blocked.length, N);
  assert.equal(logic.edible.length, N);
  assert.equal(logic.danger.length, N);
});

test('edibles and dangers are recorded per cell and never on water', () => {
  for (const e of config.edibles) {
    const i = cellIndex(e.x, e.y, logic.cols);
    assert.equal(logic.edible[i], e.kind);
    assert.equal(logic.water[i], 0);
  }
  for (const d of config.dangers) {
    const i = cellIndex(d.x, d.y, logic.cols);
    assert.equal(logic.danger[i], d.kind);
    assert.equal(logic.water[i], 0);
  }
});
