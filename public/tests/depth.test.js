import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthOrder } from '../js/world/layout.js';

test('objects sorted by foot y draw the lower tree last', () => {
  const upper = { sprite: 'trees-tree-005', x: 5, y: 4 };
  const lower = { sprite: 'trees-tree-005', x: 5.5, y: 6 };
  const order = depthOrder([lower, upper]);
  assert.equal(order.at(-1), lower);
  assert.equal(order[0], upper);
});

test('depth order does not change the input list', () => {
  const list = [{ y: 3 }, { y: 1 }];
  depthOrder(list);
  assert.deepEqual(list.map((o) => o.y), [3, 1]);
});
