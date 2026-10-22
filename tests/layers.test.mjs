// Layer state: off by default, toggled immutably, and never reached by the simulation (FR-002, FR-010, SC-006).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { LAYERS, initialLayers, toggleLayer } from '../public/js/world/layers.js';

const ALL_OFF = {
  'odour-food': false, 'odour-danger': false, 'odour-heat': false, 'odour-conspecific': false, grid: false,
};

test('every layer is off on load', () => {
  assert.deepEqual(initialLayers(), ALL_OFF);
  assert.deepEqual(LAYERS.map((l) => l.id), ['odour-food', 'odour-danger', 'odour-heat', 'odour-conspecific', 'grid']);
});

test('toggleLayer flips one layer and does not mutate its input, independently of the others', () => {
  const s0 = initialLayers();
  const s1 = toggleLayer(s0, 'odour-danger');
  assert.deepEqual(s0, ALL_OFF);
  assert.deepEqual(s1, { ...ALL_OFF, 'odour-danger': true });
  assert.deepEqual(toggleLayer(s1, 'odour-danger'), ALL_OFF);
});

test('any combination of layers may be on at once (FR-020)', () => {
  let s = initialLayers();
  for (const id of ['odour-food', 'odour-heat', 'grid']) s = toggleLayer(s, id);
  assert.deepEqual(s, { ...ALL_OFF, 'odour-food': true, 'odour-heat': true, grid: true });
});

test('an unknown layer id leaves the values unchanged', () => {
  const s0 = { ...ALL_OFF, 'odour-food': true };
  const s1 = toggleLayer(s0, 'danger');
  assert.deepEqual(s1, s0);
  assert.notEqual(s1, s0);
});

test('no fly or brain module imports the layer state or the odour field', () => {
  for (const dir of ['fly', 'brain']) {
    const url = new URL(`../public/js/${dir}/`, import.meta.url);
    for (const name of readdirSync(url)) {
      if (!name.endsWith('.js')) continue;
      const src = readFileSync(new URL(name, url), 'utf8');
      assert.ok(!src.includes('world/layers.js'), `${dir}/${name} imports world/layers.js`);
      assert.ok(!src.includes('odour-field.js'), `${dir}/${name} imports odour-field.js`);
    }
  }
});
