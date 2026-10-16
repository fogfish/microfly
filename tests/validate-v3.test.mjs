// World format version 3 (specs/009-food-odour-recalibration/contracts/world-format-v3.md §1–§3, §6; FR-001, FR-009,
// FR-018, FR-019). Written before the migration: the shipped-world test fails until the world files are version 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, validateArt } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';

const load = (file) => JSON.parse(readFileSync(new URL(`../public/world/${file}`, import.meta.url), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL('../public/assets/atlas/catalog.json', import.meta.url), 'utf8')));
const everything = (c) => [...validateConfig(c), ...validateArt(c, catalog)];
const SHIPPED = ['world.json', 'world-forager.json', 'world-forager-11k.json', 'world-connectome.json', 'world-antennal-lobe.json'];

test('refuses version 2 and names the version found and the one expected', () => {
  const c = load('world.json');
  c.version = 2;
  const errors = validateConfig(c);
  assert.deepEqual(errors.map((e) => e.path), ['version']);
  assert.match(errors[0].message, /unsupported version 2; this app supports 3/);
});

test('refuses "flower" by name as an unknown edible kind', () => {
  const c = load('world.json');
  c.edibles[0].kind = 'flower';
  const errors = everything(c);
  const hit = errors.find((e) => e.path === 'edibles[0].kind');
  assert.ok(hit, 'no error on edibles[0].kind');
  assert.match(hit.message, /"flower" is not an edible kind/);
});

test('refuses an edible without a sprite', () => {
  const c = load('world.json');
  delete c.edibles[0].sprite;
  assert.ok(validateConfig(c).some((e) => e.path === 'edibles[0].sprite'));
});

test('refuses an edible whose sprite is not in the catalogue', () => {
  const c = load('world.json');
  c.edibles[0].sprite = 'no-such-sprite';
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), ['edibles[0].sprite']);
});

test('refuses a food sprite on the wrong kind', () => {
  const c = load('world.json');
  c.edibles[0].sprite = 'jungle-plant-015';
  c.edibles[0].kind = 'small';
  assert.ok(validateArt(c, catalog).some((e) => e.path === 'edibles[0].sprite'));
});

test('refuses a world missing an edible of some kind', () => {
  const c = load('world.json');
  c.edibles = c.edibles.slice(0, 2);
  assert.ok(validateConfig(c).some((e) => e.path === 'edibles'));
});

test('accepts more than one edible of the same kind (FR-001, BUG-001)', () => {
  const c = load('world.json');
  const extraSmall = c.edibles.find((e) => e.kind === 'small');
  c.edibles.push({ ...extraSmall, x: extraSmall.x + 1, y: extraSmall.y });
  assert.deepEqual(validateConfig(c), []);
});

// The sketch map's scatter lists (contracts/world-format-sketch-map.md §7, spec 014 BUG-002) replace the tile
// world's scatter rules; the same art rules hold for them.
test('refuses a food sprite in scatter (FR-019)', () => {
  const c = load('world.json');
  c.map.meadow.mix[0][1].push('jungle-plant-015');
  const hit = validateArt(c, catalog).find((e) => e.path.startsWith('map.meadow.mix['));
  assert.ok(hit, 'no error on the scatter rule');
  assert.match(hit.message, /food sprite/);
});

test('refuses a removed sprite in scatter (FR-009)', () => {
  const c = load('world.json');
  c.map.areaScatter[0].sprites.push('jungle-plant-016');
  const hit = validateArt(c, catalog).find((e) => e.path.startsWith('map.areaScatter['));
  assert.ok(hit, 'no error on the scatter rule');
  assert.match(hit.message, /removed/);
});

test('accepts a yellow flower in scatter as decor (FR-010)', () => {
  const c = load('world.json');
  c.map.meadow.mix[0][1] = ['trees-plant-001', 'trees-plant-002', 'trees/yellow_flowers_cluster'];
  assert.deepEqual(validateArt(c, catalog), []);
});

for (const file of SHIPPED) {
  test(`accepts the shipped world ${file} (format and art)`, () => {
    assert.deepEqual(everything(load(file)), []);
  });
}

test('world-forager-bad.json passes the format check; it fails on its snapshot version at run time', () => {
  const errors = everything(load('world-forager-bad.json'));
  assert.deepEqual(errors.filter((e) => e.path === 'version' || e.path === 'format'), []);
});

// US3 (spec FR-002): the class-seeded brain is reached only by a new world file; flies.brain.version keeps
// taking only mock/v0/v1. A world naming the new (version 4) snapshot under v0 is refused the same way
// world-forager-bad.json already is, not because of anything specific to this brain.
test('world-forager-11k-bad.json passes the format check; it fails on its snapshot version at run time', () => {
  const errors = everything(load('world-forager-11k-bad.json'));
  assert.deepEqual(errors.filter((e) => e.path === 'version' || e.path === 'format'), []);
});
