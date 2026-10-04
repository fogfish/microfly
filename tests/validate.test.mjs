import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const load = () =>
  JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));

const paths = (errors) => errors.map((e) => e.path);

test('accepts the shipped world.json', () => {
  assert.deepEqual(validateConfig(load()), []);
});

test('rejects a wrong format', () => {
  const c = load();
  c.format = 'something-else';
  assert.deepEqual(paths(validateConfig(c)), ['format']);
});

test('rejects version 2 with the exact message, and nothing else', () => {
  const c = load();
  c.version = 2;
  assert.deepEqual(validateConfig(c), [
    { path: 'version', message: 'unsupported version 2; this app supports 1' },
  ]);
});

test('rejects world.width of 0', () => {
  const c = load();
  c.world.width = 0;
  assert.deepEqual(paths(validateConfig(c)), ['world.width']);
});

test('rejects an unknown sprite in an object rule', () => {
  const c = load();
  c.objects[0].sprite = 'treee';
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['objects[0].sprite']);
  assert.equal(errors[0].message, 'unknown sprite "treee"');
});

test('rejects a pixel row of the wrong length', () => {
  const c = load();
  c.sprites.apple.pixels[1] = '...sg';
  assert.deepEqual(paths(validateConfig(c)), ['sprites.apple.pixels[1]']);
});

test('rejects a config with no base terrain', () => {
  const c = load();
  c.terrain.forEach((t) => delete t.base);
  assert.deepEqual(paths(validateConfig(c)), ['terrain']);
});

test('rejects a duplicate terrain id', () => {
  const c = load();
  c.terrain[1].id = 'grass';
  // The layer that pointed at "water" now also fails, which is correct
  assert.ok(paths(validateConfig(c)).includes('terrain[1].id'));
});

test('rejects zoom.min greater than zoom.default', () => {
  const c = load();
  c.camera.zoom.min = 3;
  assert.ok(paths(validateConfig(c)).includes('camera.zoom.default'));
});

test('rejects an unknown terrain in terrainLayers', () => {
  const c = load();
  c.terrainLayers[0].terrain = 'lava';
  assert.deepEqual(paths(validateConfig(c)), ['terrainLayers[0].terrain']);
});

test('rejects a negative count', () => {
  const c = load();
  c.objects[0].count = -1;
  assert.deepEqual(paths(validateConfig(c)), ['objects[0].count']);
});

test('rejects a pixel sprite that uses "." in its palette', () => {
  const c = load();
  c.sprites.apple.palette['.'] = '#000000';
  assert.deepEqual(paths(validateConfig(c)), ['sprites.apple.palette']);
});

test('reports every error at once', () => {
  const c = load();
  c.world.width = 0;
  c.objects[0].count = -1;
  c.objects[0].kind = 'flying';
  assert.equal(validateConfig(c).length, 3);
});

test('accepts the shipped rock group', () => {
  assert.deepEqual(validateConfig(load()), []);
});

test('rejects a group for an unknown terrain', () => {
  const c = load();
  c.groups.lava = { fill: 'rock' };
  assert.deepEqual(paths(validateConfig(c)), ['groups.lava']);
});

test('rejects a group whose fill sprite is unknown', () => {
  const c = load();
  c.groups.rock.fill = 'rockk';
  assert.deepEqual(paths(validateConfig(c)), ['groups.rock.fill']);
});

test('rejects an unknown edge name', () => {
  const c = load();
  c.groups.rock.edges.NEE = 'rock-ne';
  assert.deepEqual(paths(validateConfig(c)), ['groups.rock.edges.NEE']);
});

test('rejects an edge that points to an unknown sprite', () => {
  const c = load();
  c.groups.rock.edges.N = 'missing';
  assert.deepEqual(paths(validateConfig(c)), ['groups.rock.edges.N']);
});
