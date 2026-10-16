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
  const tree = logic.objects.find((o) => o.solid && o.x >= 0 && o.y >= 0 && o.x < logic.cols && o.y < logic.rows);
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
  // world.json no longer carries a point-source dangers list (research.md R10); this loop is a no-op for it
  // and still covers any world fixture that does.
  for (const d of config.dangers ?? []) {
    const i = cellIndex(d.x, d.y, logic.cols);
    assert.equal(logic.danger[i], d.kind);
    assert.equal(logic.water[i], 0);
  }
});

// Every decoration placed on the new map registers touch (spec FR-016, research.md R7): a tree, bush, rock or
// prop (explicit object, grove tree or scatter alike) must resolve solid in buildLogic's blocked array. Edibles
// (which carry "kind") are food markers, not decoration; plant-class ground flourish (e.g. the meadow/starting-
// area flower scatter) is not a "tree, rock, tent, bone/skull piece" either and stays non-solid, as it always has.
const SOLID_DECOR_CLASSES = new Set(['bush', 'tree', 'rock', 'prop']);
test('every decoration placed by world.json resolves solid: true in buildLogic(...).blocked', () => {
  for (const o of logic.objects) {
    if (o.kind !== undefined) continue;
    if (!SOLID_DECOR_CLASSES.has(catalog.sprites.get(o.sprite).class)) continue;
    // The sketch map's border forest overhangs the edge (WORLD-SPEC §7): a foot point off the grid has no cell
    if (o.x < 0 || o.y < 0 || o.x >= logic.cols || o.y >= logic.rows) continue;
    const i = cellIndex(o.x, o.y, logic.cols);
    assert.equal(o.solid, true, `object "${o.sprite}" at (${o.x}, ${o.y}) is not solid`);
    assert.equal(logic.blocked[i], 1, `object "${o.sprite}" at (${o.x}, ${o.y}) does not block its cell`);
  }
});
