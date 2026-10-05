// Spike counts over the last 20 ticks (data-model.md, ActivityState; panel-sections.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeCount, windowCounts } from '../public/js/ui/panel/counts.js';

const tick = (spikes) => ({ spikes: Uint32Array.from(spikes) });

test('only the last 20 entries of the history count', () => {
  const history = [];
  for (let t = 0; t < 25; t++) history.push(tick(t < 5 ? [0] : [1]));
  const counts = windowCounts(history, 3);
  assert.equal(counts[0], 0);
  assert.equal(counts[1], 20);
  assert.equal(counts[2], 0);
});

test('a short history counts everything it has', () => {
  const counts = windowCounts([tick([0, 2]), tick([2])], 3);
  assert.deepEqual([...counts], [1, 0, 2]);
});

test('activeCount is the number of neurons with a spike in the window', () => {
  assert.equal(activeCount(Uint32Array.from([0, 3, 0, 1])), 2);
  assert.equal(activeCount(new Uint32Array(5)), 0);
});
