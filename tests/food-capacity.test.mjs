// Food resource capacity and recovery (spec 018 US2, contracts/world-config-food-feeding.md, data-model.md): a flower of
// kind small/medium/large starts with 1/2/3 units. Eating drains it continuously; it does not regrow while partly
// eaten; once empty it returns to full after flies.food.recovery seconds. Pure: no DOM, no workers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFood } from '../public/js/fly/food.js';

const idx = (cx, cy) => cy * 10 + cx;
const world = () => ({
  width: 10,
  height: 10,
  stimulusCells: new Map([
    [idx(2, 2), { kind: 'small', reach: 0 }],
    [idx(5, 5), { kind: 'medium', reach: 0 }],
    [idx(7, 7), { kind: 'large', reach: 0 }],
  ]),
});
const CAPACITY = { small: 1, medium: 2, large: 3 };
const config = (extra = {}) => ({
  food: { stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, capacity: CAPACITY, ...extra },
});

test('each kind starts with its declared capacity, at full fraction', () => {
  const food = createFood(world(), config());
  assert.equal(food.stockAt(2, 2), 1, 'small');
  assert.equal(food.stockAt(5, 5), 2, 'medium');
  assert.equal(food.stockAt(7, 7), 3, 'large');
  assert.equal(food.fraction(2, 2), 1);
  assert.equal(food.fraction(5, 5), 1);
  assert.equal(food.fraction(7, 7), 1);
});

test('eating drains the flower continuously, so it dims while it is being eaten', () => {
  const food = createFood(world(), config());
  food.consume(5, 5, 0.2 * 0.05);
  assert.ok(Math.abs(food.fraction(5, 5) - (1 - 0.01 / 2)) < 1e-12, 'a medium flower lost 0.01 of its 2 units');
});

test('a partly eaten flower does not regrow, however long it waits', () => {
  const food = createFood(world(), config());
  food.consume(5, 5, 0.5);
  food.regrow(1000);
  assert.equal(food.stockAt(5, 5), 1.5, 'still 0.5 units down');
  assert.equal(food.fraction(5, 5), 0.75);
});

test('a small flower is empty when its single unit is eaten, and stays empty for the recovery time', () => {
  const food = createFood(world(), config({ recovery: 30 }));
  food.consume(2, 2, 1);
  assert.equal(food.stockAt(2, 2), 0);
  assert.equal(food.fraction(2, 2), 0);
  food.regrow(29);
  assert.equal(food.fraction(2, 2), 0, 'still recovering after 29 s');
  food.regrow(1);
  assert.equal(food.fraction(2, 2), 1, 'full after 30 s');
  assert.equal(food.stockAt(2, 2), 1);
});

test('a medium flower empties after its two units, and a large one after three', () => {
  const food = createFood(world(), config());
  food.consume(5, 5, 1.9);
  assert.ok(food.stockAt(5, 5) > 0, 'not empty yet');
  food.consume(5, 5, 0.2);
  assert.equal(food.stockAt(5, 5), 0);
  food.consume(7, 7, 2.9);
  assert.ok(food.stockAt(7, 7) > 0, 'large not empty yet');
  food.consume(7, 7, 1);
  assert.equal(food.stockAt(7, 7), 0);
});

test('an empty flower is not drained further, and a custom recovery time is honoured', () => {
  const food = createFood(world(), config({ recovery: 60 }));
  food.consume(2, 2, 1);
  food.consume(2, 2, 1);
  food.regrow(59);
  assert.equal(food.fraction(2, 2), 0);
  food.regrow(1);
  assert.equal(food.fraction(2, 2), 1);
});

test('recovery 0 returns an empty flower to full on the next regrow', () => {
  const food = createFood(world(), config({ recovery: 0 }));
  food.consume(2, 2, 1);
  food.regrow(0.05);
  assert.equal(food.fraction(2, 2), 1);
});

test('points() reports the capacity fraction, so the odour field fades while the flower is eaten', () => {
  const food = createFood(world(), config());
  food.consume(5, 5, 1);
  const p = food.points().find((q) => q.x === 5.5 && q.y === 5.5);
  assert.equal(p.fraction, 0.5);
});

// Every fly calls regrow() once per tick, so a table shared by N flies must advance by one tick of time per tick, not N.
test('with 3 sharing flies, an empty flower recovers after 30 s of world time, not 10 s', () => {
  const food = createFood(world(), { food: { ...config().food, recovery: 30 } }, { sharers: 3 });
  food.consume(2, 2, 1);
  const dt = 0.05;
  for (let tick = 0; tick < 599; tick++) for (let fly = 0; fly < 3; fly++) food.regrow(dt);
  assert.equal(food.fraction(2, 2), 0, 'still recovering at 29.95 s');
  for (let fly = 0; fly < 3; fly++) food.regrow(dt);
  assert.equal(food.fraction(2, 2), 1, 'full at 30 s');
});

test('with 3 sharing flies, a legacy flower regrows at its regrowth rate per second of world time', () => {
  const food = createFood(world(), { food: { stock: 1, regrowth: 0.02, consumeRate: 0.2, sated: 0.9 } }, { sharers: 3 });
  food.consume(5, 5, 0.5);
  for (let tick = 0; tick < 20; tick++) for (let fly = 0; fly < 3; fly++) food.regrow(0.05);
  assert.ok(Math.abs(food.stockAt(5, 5) - (0.5 + 0.02)) < 1e-9, `got ${food.stockAt(5, 5)}`);
});
