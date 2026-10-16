// Danger odour ring field (contracts/world-format-sketch-map.md §3, research.md R2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dangerField } from '../public/js/world/danger-field.js';

const COLS = 10;
const ROWS = 10;
const at = (x, y) => y * COLS + x;

test('a single-cell source gives 1/0.5/0.25/0 at distance 0/1/2/3', () => {
  const forestEdge = new Uint8Array(COLS * ROWS);
  forestEdge[at(5, 5)] = 1;
  const { intensity } = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  assert.equal(intensity[at(5, 5)], 1, 'the source cell itself');
  assert.equal(intensity[at(6, 5)], 0.5, 'one 8-connected step east');
  assert.equal(intensity[at(5, 6)], 0.5, 'one 8-connected step south');
  assert.equal(intensity[at(6, 6)], 0.5, 'one 8-connected step diagonally');
  assert.equal(intensity[at(7, 5)], 0.25, 'two steps east');
  assert.equal(intensity[at(7, 7)], 0.25, 'two steps diagonally');
  assert.equal(intensity[at(8, 5)], 0, 'three steps east');
  assert.equal(intensity[at(0, 0)], 0, 'far away');
});

test('a contiguous multi-cell source gives exactly 0.5 one step out along its whole length (no overshoot)', () => {
  const forestEdge = new Uint8Array(COLS * ROWS);
  // A straight horizontal line of source cells, y = 4, x = 0..9 (a shoreline/forest-ring stand-in).
  for (let x = 0; x < COLS; x++) forestEdge[at(x, 4)] = 1;
  const { intensity } = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  for (let x = 0; x < COLS; x++) {
    assert.equal(intensity[at(x, 4)], 1, `source cell (${x}, 4)`);
    assert.equal(intensity[at(x, 5)], 0.5, `one step south of (${x}, 4)`);
    assert.equal(intensity[at(x, 3)], 0.5, `one step north of (${x}, 4)`);
  }
  // Nowhere near this contiguous source exceeds 0.5 one step out, regardless of how many source cells are near.
  for (let x = 0; x < COLS; x++) {
    assert.ok(intensity[at(x, 5)] <= 0.5 && intensity[at(x, 3)] <= 0.5);
  }
});

test('determinism: the same mask gives the same output, called twice', () => {
  const forestEdge = new Uint8Array(COLS * ROWS);
  forestEdge[at(2, 2)] = 1;
  forestEdge[at(7, 8)] = 1;
  const a = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  const b = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  assert.deepEqual([...a.distance], [...b.distance]);
  assert.deepEqual([...a.intensity], [...b.intensity]);
});

test('distance and intensity arrays are cols × rows long, row-major', () => {
  const forestEdge = new Uint8Array(COLS * ROWS);
  const { distance, intensity, cols, rows } = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  assert.equal(distance.length, COLS * ROWS);
  assert.equal(intensity.length, COLS * ROWS);
  assert.equal(cols, COLS);
  assert.equal(rows, ROWS);
});

test('no source cells: every cell reads 0', () => {
  const forestEdge = new Uint8Array(COLS * ROWS);
  const { intensity } = dangerField({ forestEdge, cols: COLS, rows: ROWS });
  assert.ok([...intensity].every((v) => v === 0));
});
