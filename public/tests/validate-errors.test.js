import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../js/world/catalog.js';
import { validateConfig, validateArt } from '../js/world/validate.js';
import { bodyKind } from '../js/world/water.js';

// The tile sections are exercised on a tile-world fixture; the shipped worlds use a sketch map instead (spec 014
// BUG-002, contracts/world-format-sketch-map.md §7).
const load = () => JSON.parse(readFileSync(new URL('./fixtures/world-tile.json', import.meta.url), 'utf8'));
const shipped = () => JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
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

// Only the spot errors: the one-unit-per-kind rule (spec 009 FR-001) also fires for an extra unit.
const spotErrors = (c) => validateConfig(c).filter((e) => e.path.startsWith('edibles['));

// (24.5, 11.5) sits inside lake-joy's centre (grid.waterBodies[0], cx 24 cy 11), the sketch map's water (spec 014).
test('a food unit placed on water is refused', () => {
  const c = load();
  c.edibles.push({ kind: 'small', sprite: 'red_flower_plant', x: 36.5, y: 8.5 });
  assert.deepEqual(spotErrors(c).map((e) => e.path), [`edibles[${c.edibles.length - 1}]`]);
});

test('a danger placed on water is refused', () => {
  const c = load();
  c.dangers = [{ kind: 'spider', x: 36.5, y: 8.5 }];
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`dangers[${c.dangers.length - 1}]`]);
});

test('a fire danger is refused: campfire logs are not a danger', () => {
  const c = load();
  c.dangers = [{ kind: 'fire', x: 2.5, y: 2.5 }];
  assert.deepEqual(validateConfig(c).map((e) => e.path), [`dangers[${c.dangers.length - 1}].kind`]);
});

test('an unknown edible kind is refused', () => {
  const c = load();
  c.edibles.push({ kind: 'apple', sprite: 'red_flower_plant', x: 2.5, y: 2.5 });
  assert.deepEqual(spotErrors(c).map((e) => e.path), [`edibles[${c.edibles.length - 1}].kind`]);
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

// The sketch's two lakes, Lake Joy and Lake Byte, joined by a river and divided by a dry crossing
// (spec 014 FR-011/FR-022, research.md R1/R6/R11, BUG-001).
test('the shipped world has two lakes (Lake Joy and Lake Byte, spec 014; WORLD-SPEC §4, BUG-002)', () => {
  const ids = shipped().map.water.bodies.map((b) => b.id);
  for (const id of ['lake-joy', 'lake-byte', 'river-north', 'river-south']) assert.ok(ids.includes(id), id);
});

test('a shore field on a water body is refused, since every shore is the grass shore style', () => {
  const c = load();
  c.waterBodies[0].shore = 'ring96';
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['waterBodies[0].shore']);
});
