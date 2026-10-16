// Heat odour ring field (contracts/world-format-sketch-map.md §3, research.md R2): the same shape as
// danger-field.js, sourced from water instead of edge forest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatField } from '../public/js/world/heat-field.js';

const COLS = 10;
const ROWS = 10;
const at = (x, y) => y * COLS + x;

test('a single-cell source gives 1/0.5/0.25/0 at distance 0/1/2/3', () => {
  const water = new Uint8Array(COLS * ROWS);
  water[at(5, 5)] = 1;
  const { intensity } = heatField({ water, cols: COLS, rows: ROWS });
  assert.equal(intensity[at(5, 5)], 1);
  assert.equal(intensity[at(6, 5)], 0.5);
  assert.equal(intensity[at(6, 6)], 0.5);
  assert.equal(intensity[at(7, 5)], 0.25);
  assert.equal(intensity[at(8, 5)], 0);
});

test('a contiguous multi-cell source gives exactly 0.5 one step out along its whole length (no overshoot)', () => {
  const water = new Uint8Array(COLS * ROWS);
  for (let x = 0; x < COLS; x++) water[at(x, 4)] = 1;
  const { intensity } = heatField({ water, cols: COLS, rows: ROWS });
  for (let x = 0; x < COLS; x++) {
    assert.equal(intensity[at(x, 4)], 1);
    assert.equal(intensity[at(x, 5)], 0.5);
    assert.equal(intensity[at(x, 3)], 0.5);
  }
});

test('determinism: the same mask gives the same output, called twice', () => {
  const water = new Uint8Array(COLS * ROWS);
  water[at(3, 3)] = 1;
  const a = heatField({ water, cols: COLS, rows: ROWS });
  const b = heatField({ water, cols: COLS, rows: ROWS });
  assert.deepEqual([...a.distance], [...b.distance]);
  assert.deepEqual([...a.intensity], [...b.intensity]);
});

test('distance and intensity arrays are cols × rows long, row-major', () => {
  const water = new Uint8Array(COLS * ROWS);
  const { distance, intensity } = heatField({ water, cols: COLS, rows: ROWS });
  assert.equal(distance.length, COLS * ROWS);
  assert.equal(intensity.length, COLS * ROWS);
});
