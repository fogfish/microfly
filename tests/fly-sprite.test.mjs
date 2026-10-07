// The fly sprites are 32 × 32 pixel grids (specs/009-food-odour-recalibration/contracts/fly-sprite.md §1–§3, §5;
// FR-013, FR-014, FR-016, FR-021; BUG-002). Reads the shipped world files, so the art a visitor sees is the art checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SHIPPED = ['world.json', 'world-forager.json', 'world-connectome.json', 'world-antennal-lobe.json', 'world-forager-bad.json'];
const load = (file) => JSON.parse(readFileSync(new URL(`../public/world/${file}`, import.meta.url), 'utf8'));
const SPRITE_IDS = ['fly-female', 'fly-female-baseline', 'fly-male', 'fly-male-baseline'];
const SEXES = ['female', 'male'];

for (const file of SHIPPED) {
  test(`${file}: all four fly sprites are 32 rows of 32 characters, every character in the palette`, () => {
    const c = load(file);
    for (const name of SPRITE_IDS) {
      const { pixels, palette } = c.sprites[name];
      assert.equal(pixels.length, 32, `${name} rows`);
      for (const row of pixels) {
        assert.equal(row.length, 32, `${name} row length`);
        for (const ch of row) assert.ok(ch === '.' || Object.hasOwn(palette, ch), `${name}: "${ch}" not in palette`);
      }
    }
  });

  for (const sex of SEXES) {
    test(`${file}: fly-${sex}-baseline has the same pixels as fly-${sex}, and a different palette (FR-016)`, () => {
      const c = load(file);
      assert.deepEqual(c.sprites[`fly-${sex}-baseline`].pixels, c.sprites[`fly-${sex}`].pixels);
      assert.notDeepEqual(c.sprites[`fly-${sex}-baseline`].palette, c.sprites[`fly-${sex}`].palette);
    });
  }

  test(`${file}: fly-female and fly-male have different shapes (FR-021)`, () => {
    const c = load(file);
    assert.notDeepEqual(c.sprites['fly-female'].pixels, c.sprites['fly-male'].pixels);
  });

  test(`${file}: wings project laterally, at roughly a right angle to the body axis (FR-014, BUG-002)`, () => {
    // The body (head/thorax/abdomen) sits in the middle columns; a wing pixel far from the body's columns,
    // on a row near the thorax, is the signature of wings projecting sideways rather than running lengthwise
    // down the body (the previous art's bug).
    const c = load(file);
    for (const sex of SEXES) {
      const { pixels } = c.sprites[`fly-${sex}`];
      const thoraxRow = pixels[10];
      assert.ok(thoraxRow[2] === 'w' || thoraxRow[3] === 'w', `fly-${sex}: no wing pixel near the left edge at the thorax row`);
      assert.ok(thoraxRow[28] === 'w' || thoraxRow[29] === 'w', `fly-${sex}: no wing pixel near the right edge at the thorax row`);
    }
  });

  test(`${file}: flies.sex has one "female"/"male" entry per fly, and the sprite/baselineSprite point at fly-female (FR-021)`, () => {
    const c = load(file);
    const { flies } = c;
    assert.equal(flies.sprite, 'fly-female');
    assert.equal(flies.baselineSprite, 'fly-female-baseline');
    assert.equal(flies.sex.length, flies.count);
    for (const s of flies.sex) assert.ok(SEXES.includes(s), `unexpected sex "${s}"`);
  });
}
