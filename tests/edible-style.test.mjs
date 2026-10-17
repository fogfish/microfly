// edibleStyle (public/js/world/edible-style.js, specs/009-food-odour-recalibration/contracts/world-format-v3.md): the
// ground marker under each food unit follows the ground area it stands on, and the small flower is drawn larger.
// Visual only, so the logic grid, the food field and the flower stock do not change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic, DECOR_FORBIDDEN } from '../public/js/world/layout.js';
import { planMap } from '../public/js/world/sketch-map.js';
import { edibleLook } from '../public/js/world/edible-style.js';
import { validateConfig, validateArt } from '../public/js/world/validate.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const { catalog } = indexCatalog(JSON.parse(read('../public/assets/atlas/catalog.json')));
const load = (file) => JSON.parse(read(`../public/world/${file}`));
const config = load('world.json');
const resolve = (ref) => catalog.lookup(ref).sprite.id;
const GRASS = resolve('trees/light_meadow_patch_a');
const SAND = resolve('beach/sand_splat');

test('the marker follows the ground area, and the grass marker is the default', () => {
  const style = config.edibleStyle;
  assert.deepEqual(edibleLook(style, 'medium', null, resolve), { marker: { sprite: GRASS, width: 128 }, scale: 1 });
  assert.deepEqual(edibleLook(style, 'medium', 'dunes', resolve), { marker: { sprite: SAND, width: 96 }, scale: 1 });
  assert.equal(edibleLook(style, 'small', null, resolve).scale, 1.5);
  assert.deepEqual(edibleLook(undefined, 'small', 'dunes', resolve), { marker: null, scale: 1 });
});

test('the layout gives every food unit its marker and the small flower its scale', () => {
  const logic = buildLogic(config, catalog);
  const foods = logic.objects.filter((o) => o.kind !== undefined && ['small', 'medium', 'large'].includes(o.kind));
  assert.ok(foods.length > 0);
  for (const f of foods) {
    assert.ok(f.marker && (f.marker.sprite === GRASS || f.marker.sprite === SAND), `no marker on ${f.kind} at ${f.x},${f.y}`);
    assert.equal(f.scale, f.kind === 'small' ? 1.5 : 1);
  }
});

test('a food unit on the dunes gets the sand marker', () => {
  // Cell (52.5, 33.5) is on the dunes in world.json (scene px 2442, 1072); a unit placed there must take the sand marker.
  const c = JSON.parse(JSON.stringify(config));
  c.edibles.push({ kind: 'medium', sprite: 'jungle-plant-010', x: 52.5, y: 33.5 });
  const plan = planMap(c, catalog, DECOR_FORBIDDEN);
  const area = plan.areaOf[Math.round(33.5 * 32) * plan.W + Math.round(52.5 * 32)];
  assert.equal(plan.areas.find((a) => a.index === area)?.name, 'dunes', 'test cell is not on the dunes');
  const placed = buildLogic(c, catalog).objects.find((o) => o.x === 52.5 && o.y === 33.5);
  assert.equal(placed.marker.sprite, SAND);
});

test('a malformed edibleStyle is refused, and names its entry', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.edibleStyle = { marker: { 'no-such-area': { sprite: 'trees/light_meadow_patch_a', width: 0 } }, scale: { tiny: 9 } };
  const paths = validateConfig(c).map((e) => e.path);
  assert.ok(paths.includes('edibleStyle.marker.no-such-area'));
  assert.ok(paths.includes('edibleStyle.marker.no-such-area.width'));
  assert.ok(paths.includes('edibleStyle.scale.tiny'));
});

test('an edibleStyle marker sprite that does not resolve names its entry', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.edibleStyle.marker.dunes.sprite = 'beach/no_such_splat';
  assert.deepEqual(validateArt(c, catalog).map((e) => e.path), ['edibleStyle.marker.dunes']);
});
