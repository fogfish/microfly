// Layer state: off by default, toggled immutably, and never reached by the simulation (FR-002, FR-010, SC-006).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { LAYERS, initialLayers, toggleLayer } from '../public/js/world/layers.js';

test('every layer is off on load', () => {
  assert.deepEqual(initialLayers(), { odour: false });
  assert.deepEqual(LAYERS.map((l) => l.id), ['odour']);
});

test('toggleLayer flips the layer and does not mutate its input', () => {
  const s0 = initialLayers();
  const s1 = toggleLayer(s0, 'odour');
  assert.deepEqual(s0, { odour: false });
  assert.deepEqual(s1, { odour: true });
  assert.deepEqual(toggleLayer(s1, 'odour'), { odour: false });
});

test('an unknown layer id leaves the values unchanged', () => {
  const s0 = { odour: true };
  const s1 = toggleLayer(s0, 'danger');
  assert.deepEqual(s1, { odour: true });
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
