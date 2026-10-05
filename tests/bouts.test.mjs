// Eating bouts (ADR 003 W2, FR-024): a bout starts on the first eating tick and ends on the first tick without eating,
// and it records why it ended (empty, sated or walked). A fly whose feed falls below threshold stops eating and moves off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBout, updateBout, closeBout } from '../public/js/fly/energy.js';

const CFG = { sated: 0.9, feedThreshold: 0.5 };

test('a bout counts its eating ticks', () => {
  let bout = startBout('5,5');
  bout = updateBout(bout);
  bout = updateBout(bout);
  assert.equal(bout.ticks, 2);
  assert.equal(bout.cell, '5,5');
});

test('a bout ends as empty when the flower has no stock', () => {
  const closed = closeBout({ cell: 'c', ticks: 4 }, { stock: 0, energy: 0.2, feed: 0.9 }, CFG);
  assert.deepEqual(closed, { cell: 'c', ticks: 4, endedBy: 'empty' });
});

test('a bout ends as sated when energy reached the sated level and feed is low', () => {
  const closed = closeBout({ cell: 'c', ticks: 9 }, { stock: 0.6, energy: 0.92, feed: 0.4 }, CFG);
  assert.equal(closed.endedBy, 'sated');
});

test('a bout ends as walked otherwise', () => {
  const closed = closeBout({ cell: 'c', ticks: 3 }, { stock: 0.6, energy: 0.4, feed: 0.2 }, CFG);
  assert.equal(closed.endedBy, 'walked');
});
