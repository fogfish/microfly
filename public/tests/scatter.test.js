import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasterizeOutline } from '../js/world/layout.js';
import { scatterPlacements } from '../js/world/scatter.js';

const cols = 40;
const rows = 30;
const area = rasterizeOutline({ ellipse: { cx: 20, cy: 15, rx: 12, ry: 9 } }, cols, rows);
const water = new Uint8Array(cols * rows);
for (let y = 10; y < 13; y++) for (let x = 17; x < 22; x++) water[y * cols + x] = 1;
const rule = { seed: 77, density: 0.4, clearings: 0.3, sprites: ['a', 'b', 'c'], area, water, cols, rows };

test('the same seed gives the same layout', () => {
  assert.deepEqual(scatterPlacements(rule), scatterPlacements(rule));
});

test('no object lands on a water cell', () => {
  for (const p of scatterPlacements(rule)) {
    assert.equal(water[Math.floor(p.y) * cols + Math.floor(p.x)], 0);
  }
});

test('the clearing share is respected within a tolerance', () => {
  const placed = new Set(scatterPlacements({ ...rule, density: 5 }).map((p) => Math.floor(p.y) * cols + Math.floor(p.x)));
  const cells = [...area.keys()].filter((i) => area[i]);
  const occupied = cells.filter((i) => placed.has(i) || water[i]).length;
  const open = 1 - occupied / cells.length;
  assert.ok(open >= 0.2 && open <= 0.6, `open share ${open.toFixed(2)} is outside 0.2 to 0.6`);
});

test('scatter stays inside its area', () => {
  for (const p of scatterPlacements(rule)) {
    assert.equal(area[Math.floor(p.y) * cols + Math.floor(p.x)], 1);
  }
});
