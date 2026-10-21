// The food odour overlay follows the flowers that flies sense (spec 018 follow-up). createLiveFoodField evaluates the
// world's sense kernels once and combines them with the live fractions; it must agree with foodFieldAt cell for cell,
// before and after a flower is eaten, and the flower table must say when its levels moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFood } from '../public/js/fly/food.js';
import { createLiveFoodField, foodFieldAt, foodKernel } from '../public/js/world/food-field.js';

const W = 12;
const H = 12;
const cell = (cx, cy) => cy * W + cx;
const world = () => ({
  width: W,
  height: H,
  stimulusCells: new Map([[cell(3, 3), { kind: 'small', reach: 0 }], [cell(8, 7), { kind: 'medium', reach: 0 }]]),
});
const units = [
  { cellX: 3, cellY: 3, kernel: foodKernel({ unitX: 3.5, unitY: 3.5, seed: 11 }) },
  { cellX: 8, cellY: 7, kernel: foodKernel({ unitX: 8.5, unitY: 7.5, seed: 29 }) },
];
const CONFIG = { food: { stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, consumption: true } };

function assertMatchesSensing(field, flowers) {
  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      // Float32 storage, so compare to float32 precision.
      assert.ok(Math.abs(field.values[cy * W + cx] - foodFieldAt(units, flowers, cx, cy)) < 1e-6, `cell ${cx},${cy}`);
    }
  }
}

test('the live field equals what a fly senses at every cell, at full stock', () => {
  const flowers = createFood(world(), CONFIG);
  const field = createLiveFoodField(units, W, H).fieldFor(flowers);
  assertMatchesSensing(field, flowers);
  assert.ok(field.values[cell(3, 3)] > 0);
});

test('eating a flower lowers the live field at that flower, and still equals sensing', () => {
  const flowers = createFood(world(), CONFIG);
  const live = createLiveFoodField(units, W, H);
  const before = live.fieldFor(flowers).values[cell(3, 3)];
  flowers.consume(3, 3, 0.5);
  const after = live.fieldFor(flowers);
  assert.ok(after.values[cell(3, 3)] < before, 'the overlay fades as the flower is eaten');
  assertMatchesSensing(after, flowers);
});

test('a fully depleted flower disappears from the live field', () => {
  const flowers = createFood(world(), CONFIG);
  flowers.consume(3, 3, 1);
  const field = createLiveFoodField(units, W, H).fieldFor(flowers);
  assertMatchesSensing(field, flowers);
});

test('the version moves when a flower level changes, and stays put when nothing does', () => {
  const flowers = createFood(world(), CONFIG);
  const v0 = flowers.version;
  flowers.regrow(1);
  assert.equal(flowers.version, v0, 'a full flower does not regrow: no change');
  flowers.consume(3, 3, 0.2);
  assert.ok(flowers.version > v0, 'eating moves the version');
});

test('a capacity-model flower moves the version when eaten', () => {
  const flowers = createFood(world(), { food: { ...CONFIG.food, capacity: { small: 1, medium: 2, large: 3 } } });
  const v0 = flowers.version;
  flowers.consume(3, 3, 0.1);
  assert.ok(flowers.version > v0);
});
