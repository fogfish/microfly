// Water field (BUG-002, FR-028, SC-004): a natural waterline from the signed distance S.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWaterField, cellWater, bodyKind, distanceAt } from '../js/world/water.js';

const pond = { id: 'pond', outline: { blob: { cx: 8, cy: 6, rx: 2.6, ry: 1.9, wobble: 0.11, harmonics: 4 } } };
const lake = { id: 'lake', outline: { blob: { cx: 30, cy: 10, rx: 6.5, ry: 4, wobble: 0.2, harmonics: 6 } } };
const world = { cols: 40, rows: 20, seed: 1990, bodies: [pond, lake] };
const field = buildWaterField(world);
const water = (x, y) => field.S[y * field.W + x] < 0;

test('the same seed gives the same field', () => {
  const again = buildWaterField(world);
  assert.deepEqual(again.S, field.S);
  assert.deepEqual(again.Wsh, field.Wsh);
});

test('S is negative at a body centre and positive far from it', () => {
  assert.ok(distanceAt(field, 8, 6) < -20);
  assert.ok(distanceAt(field, 30, 10) < -60);
  assert.ok(distanceAt(field, 18, 2) > 40);
  assert.ok(distanceAt(field, 1, 18) > 40);
});

// Longest straight run of waterline, along each of the four edge directions.
function longestStraightRun() {
  const { W, H } = field;
  let best = 0;
  const run = (len) => (best = Math.max(best, len));
  for (let y = 1; y < H - 1; y++) {
    let top = 0;
    let bottom = 0;
    for (let x = 0; x < W; x++) {
      top = water(x, y) && !water(x, y - 1) ? top + 1 : (run(top), 0);
      bottom = water(x, y) && !water(x, y + 1) ? bottom + 1 : (run(bottom), 0);
    }
  }
  for (let x = 1; x < W - 1; x++) {
    let left = 0;
    let right = 0;
    for (let y = 0; y < H; y++) {
      left = water(x, y) && !water(x - 1, y) ? left + 1 : (run(left), 0);
      right = water(x, y) && !water(x + 1, y) ? right + 1 : (run(right), 0);
    }
  }
  return best;
}

test('the waterline has no straight run longer than 24 px', () => {
  assert.ok(longestStraightRun() <= 24, `longest run ${longestStraightRun()} px`);
});

test('the waterline has no square corner (two straight edges of 6 px or more meeting)', () => {
  const { W, H } = field;
  const L = 6;
  const straight = (x, y, dx, dy, ex, ey) => {
    for (let k = 0; k < L; k++) {
      const px = x + dx * k;
      const py = y + dy * k;
      if (!water(px, py) || water(px + ex, py + ey)) return false;
    }
    return true;
  };
  for (let y = L + 1; y < H - L - 1; y++) {
    for (let x = L + 1; x < W - L - 1; x++) {
      if (!water(x, y)) continue;
      // An edge along x (land above or below) meeting an edge along y (land left or right) at (x, y)
      for (const [dx, ey] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
        for (const [dy, ex] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
          const corner = straight(x, y, dx, 0, 0, ey) && straight(x, y, 0, dy, ex, 0) && !water(x + ex, y + ey);
          assert.ok(!corner, `square corner at ${x}, ${y}`);
        }
      }
    }
  }
});

test('the shore width varies along the shore, within 4 to 11 px', () => {
  const widths = [];
  for (let k = 0; k < field.S.length; k++) if (field.S[k] >= 0 && field.S[k] < 1) widths.push(field.Wsh[k]);
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  assert.ok(min >= 4 && max <= 11, `${min} to ${max}`);
  assert.ok(max - min > 2, 'the band must not have a constant width');
});

test('logic water cells are the cells whose centre is drawn as water', () => {
  const cells = cellWater(field, world.cols, world.rows);
  for (let cy = 0; cy < world.rows; cy++) {
    for (let cx = 0; cx < world.cols; cx++) {
      assert.equal(cells[cy * world.cols + cx], water(cx * 32 + 16, cy * 32 + 16) ? 1 : 0);
    }
  }
  assert.ok(cells.reduce((a, v) => a + v, 0) > 20);
});

test('each body knows its kind and its shoreline length', () => {
  assert.deepEqual(field.bodies.map((b) => b.kind), ['pond', 'lake']);
  assert.ok(field.bodies[0].perimeter > 300 && field.bodies[0].perimeter < 900, `${field.bodies[0].perimeter}`);
  assert.ok(field.bodies[1].perimeter > field.bodies[0].perimeter * 2);
  assert.equal(bodyKind({ rx: 1, ry: 0.7, wobble: 0.1, harmonics: 4 }), null, 'too small for a pond');
});
