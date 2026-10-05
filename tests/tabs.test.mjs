// Tab state of the fly status panel (spec FR-016).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, initialTab, nextTab } from '../public/js/ui/panel/tabs.js';

test('the panel opens on the world tab', () => {
  assert.equal(initialTab, 'world');
  assert.deepEqual(TABS, ['world', 'fly']);
});

test('selecting a fly moves to the fly tab', () => {
  assert.equal(nextTab('world', { type: 'select' }), 'fly');
  assert.equal(nextTab('fly', { type: 'select' }), 'fly');
});

test('a tab event moves to the named tab', () => {
  assert.equal(nextTab('fly', { type: 'tab', tab: 'world' }), 'world');
  assert.equal(nextTab('world', { type: 'tab', tab: 'fly' }), 'fly');
});

test('a tab event with an unknown name leaves the tab unchanged', () => {
  assert.equal(nextTab('world', { type: 'tab', tab: 'settings' }), 'world');
  assert.equal(nextTab('fly', { type: 'tab' }), 'fly');
});
