import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));

test('accepts the shipped version 2 world', () => {
  assert.deepEqual(validateConfig(load()), []);
});

test('refuses version 1 with a message that names the version', () => {
  const c = load();
  c.version = 1;
  const errors = validateConfig(c);
  assert.deepEqual(errors.map((e) => e.path), ['version']);
  assert.match(errors[0].message, /unsupported version 1/);
});

test('refuses a non-integer zoom step', () => {
  const c = load();
  c.zoom.default = 2.5;
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['zoom.default']);
});

test('refuses a grid whose cellPx is not 32', () => {
  const c = load();
  c.grid.cellPx = 16;
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['grid.cellPx']);
});
