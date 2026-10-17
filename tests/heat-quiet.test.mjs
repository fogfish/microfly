// flies.heatQuiet (public/js/world/heat-field.js, specs/014-sketch-world-map/contracts/world-format-sketch-map.md §3):
// the named ground areas take no heat ring, so a fly can cross them; every other cell keeps its ring intensity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { heatField } from '../public/js/world/heat-field.js';
import { validateConfig } from '../public/js/world/validate.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
const demo = JSON.parse(read('../public/world/world-forager-demo.json'));

test('the swamp takes no heat in the demo world, and the rest of the map keeps its heat', () => {
  const logic = buildLogic(demo, catalog);
  assert.ok(logic.heatQuiet, 'no heat mask built from flies.heatQuiet');
  const quiet = heatField({ water: logic.water, cols: logic.cols, rows: logic.rows, quiet: logic.heatQuiet }).intensity;
  const plain = heatField({ water: logic.water, cols: logic.cols, rows: logic.rows }).intensity;
  let swamp = 0;
  for (let i = 0; i < quiet.length; i++) {
    if (logic.heatQuiet[i]) {
      swamp++;
      assert.equal(quiet[i], 0, `heat left on swamp cell ${i}`);
    } else {
      assert.equal(quiet[i], plain[i], `heat changed off the swamp at cell ${i}`);
    }
  }
  assert.ok(swamp > 0, 'the swamp has no cells in this world');
  const pond = logic.water.reduce((n, w, i) => n + (w && logic.heatQuiet[i] ? 1 : 0), 0);
  assert.ok(pond > 0, 'no swamp pond cell is quiet: the pond would still show the 100% ring');
  assert.ok(plain.some((v, i) => logic.heatQuiet[i] && v > 0), 'the swamp had no heat to remove');
});

test('a world without flies.heatQuiet has no heat mask', () => {
  const c = JSON.parse(JSON.stringify(demo));
  delete c.flies.heatQuiet;
  assert.equal(buildLogic(c, catalog).heatQuiet, null);
});

test('flies.heatQuiet names must be ground areas of the map', () => {
  const c = JSON.parse(JSON.stringify(demo));
  c.flies.heatQuiet = ['no-such-ground'];
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['flies.heatQuiet']);
});
