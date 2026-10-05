import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog, loadCatalog } from '../js/world/catalog.js';

const json = JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(json);

test('resolves a sprite by id and by unique name', () => {
  assert.equal(catalog.lookup('jungle-prop-002').sprite.name, 'campfire_logs');
  assert.equal(catalog.lookup('campfire_logs').sprite.id, 'jungle-prop-002');
});

test('rejects an unknown id and names the entry', () => {
  assert.equal(catalog.lookup('trees-tree-999').error, 'unknown sprite "trees-tree-999"');
});

test('refuses a name shared by several sprites and asks for the id', () => {
  assert.match(catalog.lookup('pebble_a').error, /shared by \d+ sprites; use the id/);
});

test('rejects a missing catalogue with a clear error', async () => {
  const { catalog: none, errors } = await loadCatalog(new URL('file:///no/such/catalog.json'));
  assert.equal(none, null);
  assert.equal(errors[0].path, 'atlas');
  assert.match(errors[0].message, /Could not load the art catalogue/);
});

test('rejects a catalogue without sprites', () => {
  const { catalog: none, errors } = indexCatalog({ atlases: [] });
  assert.equal(none, null);
  assert.equal(errors.length, 1);
});
