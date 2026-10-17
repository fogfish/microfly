// Image fly sprites (public/js/render/sprites.js, specs/009-food-odour-recalibration/contracts/fly-sprite.md §6): a
// sprite may name a .png under the public root instead of a pixel grid. The demo world draws its flies from the
// rotated fly art, which faces up so the renderer's heading turn (spec 017 BUG-001) applies to it unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const demo = JSON.parse(readFileSync(new URL('../public/world/world-forager-demo.json', import.meta.url), 'utf8'));
const asset = new URL('../public/assets/fly/fly.png', import.meta.url);

test('the demo flies draw from the image asset, and every fly sprite the sexes name is an image', () => {
  for (const name of ['fly-female', 'fly-female-baseline', 'fly-male', 'fly-male-baseline']) {
    assert.deepEqual(demo.sprites[name], { image: 'fly/fly.png', size: 64 }, name);
  }
});

test('the fly asset exists and is a 256 × 256 PNG, drawn at 64 × 64 px on the map', () => {
  assert.ok(existsSync(asset), 'public/assets/fly/fly.png is missing');
  const head = readFileSync(asset).subarray(0, 24);
  assert.equal(head.readUInt32BE(16), 256, 'width');
  assert.equal(head.readUInt32BE(20), 256, 'height');
});

test('an image sprite must name a .png file', () => {
  const c = JSON.parse(JSON.stringify(demo));
  c.sprites['fly-female'] = { image: 'assets/fly/fly.jpg' };
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['sprites.fly-female.image']);
});

test('a pixel sprite still needs its pixel grid', () => {
  const c = JSON.parse(JSON.stringify(demo));
  c.sprites['fly-female'] = { palette: {} };
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['sprites.fly-female']);
});

test('an image sprite size must be a whole number of px from 1 to 512', () => {
  const c = JSON.parse(JSON.stringify(demo));
  c.sprites['fly-female'] = { image: 'fly/fly.png', size: 0 };
  assert.deepEqual(validateConfig(c).map((e) => e.path), ['sprites.fly-female.size']);
});
