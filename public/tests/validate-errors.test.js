import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { validateConfig, validateArt } from '../js/world/validate.js';
import { bodyKind } from '../js/world/water.js';

const load = () => JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../assets/atlas/catalog.json', import.meta.url), 'utf8')));

test('an unknown sprite id names the object entry', () => {
  const c = load();
  c.objects.push({ sprite: 'trees-tree-999', x: 3, y: 3 });
  const idx = c.objects.length - 1;
  const errors = validateArt(c, catalog);
  assert.deepEqual(errors.map((e) => e.path), [`objects[${idx}]`]);
  assert.match(errors[0].message, /unknown sprite "trees-tree-999"/);
});

test('an unknown sprite in a grove names the tree', () => {
  const c = load();
  c.groves[0].trees[2].sprite = 'nope';
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), ['groves[0].trees[2]']);
});

test('a bad outline shape is refused', () => {
  const c = load();
  c.waterBodies[0].outline = { rectangle: { x: 1, y: 1 } };
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['waterBodies[0].outline']);
});

test('an edible placed on water is refused', () => {
  const c = load();
  c.edibles.push({ kind: 'flower', x: 13.5, y: 9.5 });
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`edibles[${c.edibles.length - 1}]`]);
});

test('a danger placed on water is refused', () => {
  const c = load();
  c.dangers.push({ kind: 'spider', x: 13.5, y: 9.5 });
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`dangers[${c.dangers.length - 1}]`]);
});

test('a fire danger is refused: campfire logs are not a danger', () => {
  const c = load();
  c.dangers.push({ kind: 'fire', x: 2.5, y: 2.5 });
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`dangers[${c.dangers.length - 1}].kind`]);
});

test('an unknown edible kind is refused', () => {
  const c = load();
  c.edibles.push({ kind: 'apple', x: 2.5, y: 2.5 });
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`edibles[${c.edibles.length - 1}].kind`]);
});

test('a version of 1 is refused', () => {
  const c = load();
  c.version = 1;
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['version']);
});

test('a water body smaller than a pond is refused, naming the ranges', () => {
  const c = load();
  c.waterBodies.push({ id: 'speck', outline: { blob: { cx: 40.5, cy: 25.5, rx: 1, ry: 0.7, wobble: 0.1, harmonics: 4 } } });
  const errors = validateConfig(c);
  assert.deepEqual(errors.map((e) => e.path), [`waterBodies[${c.waterBodies.length - 1}].outline`]);
  assert.match(errors[0].message, /neither a pond nor a lake/);
});

test('ellipse and polygon water bodies are refused (BUG-002: water is a blob)', () => {
  const c = load();
  c.waterBodies[0].outline = { ellipse: { cx: 36, cy: 8, rx: 6, ry: 4 } };
  c.waterBodies[1].outline = { polygon: [[10, 8], [16, 8], [14, 11]] };
  const errors = validateConfig(c);
  assert.deepEqual(errors.map((e) => e.path), ['waterBodies[0].outline', 'waterBodies[1].outline']);
  assert.match(errors[0].message, /blob/);
});

test('the shipped world has one lake and two or three ponds (FR-011)', () => {
  const kinds = load().waterBodies.map((b) => bodyKind(b.outline.blob));
  assert.equal(kinds.filter((k) => k === 'lake').length, 1);
  const ponds = kinds.filter((k) => k === 'pond').length;
  assert.ok(ponds >= 2 && ponds <= 3, `${ponds} ponds`);
});

test('a shore field on a water body is refused, since every shore is the grass shore style', () => {
  const c = load();
  c.waterBodies[0].shore = 'ring96';
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['waterBodies[0].shore']);
});
