// Energy, eating and flower stock (ADR 003 W1–W2, FR-022–FR-026): energy stays in [0, 1], a fly eats only when all three
// W2 conditions hold, stock stays in [0, full], and an empty flower gives no taste and no odour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metabolise, eat, canEat, hunger } from '../public/js/fly/energy.js';
import { createFood } from '../public/js/fly/food.js';
import { senseBilateral } from '../public/js/fly/stimulus.js';

const CFG = { eatSpeed: 0.5, feedThreshold: 0.5, sated: 0.9 };
const CONFIG = { food: { stock: 1, consumeRate: 0.2, regrowth: 0.02 } };
const world = () => ({ width: 10, height: 10, stimulusCells: new Map([[5 * 10 + 5, 'flower']]) });

test('metabolise and eat keep energy in [0, 1]', () => {
  assert.equal(metabolise(0.005, 1, 0.01), 0);
  assert.equal(eat(0.99, 1, 0.2), 1);
  assert.ok(Math.abs(metabolise(0.5, 0.05, 0.01) - (0.5 - 0.0005)) < 1e-12);
  assert.equal(hunger(0.3), 0.7);
});

test('a fly eats only when the flower has stock, the fly is slow, and feed is above threshold', () => {
  const ok = { stock: 1, speed: 0.1, feed: 0.9 };
  assert.equal(canEat(ok, CFG), true);
  assert.equal(canEat({ ...ok, stock: 0 }, CFG), false, 'no stock');
  assert.equal(canEat({ ...ok, speed: 0.5 }, CFG), false, 'too fast (speed must be below eatSpeed)');
  assert.equal(canEat({ ...ok, feed: 0.5 }, CFG), false, 'feed at threshold is not above it');
});

test('the flower stock stays in [0, full] when consumed and regrown', () => {
  const food = createFood(world(), CONFIG);
  food.consume(5, 5, 5);
  assert.equal(food.stockAt(5, 5), 0);
  food.regrow(1000);
  assert.equal(food.stockAt(5, 5), 1, 'regrowth stops at full');
});

test('regrowth skips the flower that is being eaten', () => {
  const food = createFood(world(), CONFIG);
  food.consume(5, 5, 0.5);
  food.regrow(10, 5 * 10 + 5);
  assert.equal(food.stockAt(5, 5), 0.5);
});

test('an empty flower gives no taste and no odour', () => {
  const food = createFood(world(), CONFIG);
  food.consume(5, 5, 1);
  assert.equal(food.fraction(5, 5), 0);
  const { left, right } = senseBilateral(food.points(), { x: 5.5, y: 5.5, heading: 0 },
    { radius: 8, gain: 1, max: 1, resting: 0, antennaOffset: 0.5 });
  assert.deepEqual([left, right], [0, 0]);
});
