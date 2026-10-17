// Pure helpers for the channel rows (panel-sections.md, Channel rows).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { barFraction, centredFraction, groupBySide, pairRows } from '../public/js/ui/panel/channel-rows.js';

test('groupBySide places a both channel under L and under R', () => {
  const groups = groupBySide([
    { id: 'a', side: 'both' },
    { id: 'b', side: 'L' },
    { id: 'c', side: 'R' },
  ]);
  assert.deepEqual(groups.L.map((c) => c.id), ['a', 'b']);
  assert.deepEqual(groups.R.map((c) => c.id), ['a', 'c']);
});

test('groupBySide reads the side of a row through an accessor', () => {
  const groups = groupBySide([{ channel: { side: 'R' }, value: 0.2 }], (row) => row.channel.side);
  assert.equal(groups.R.length, 1);
  assert.equal(groups.L.length, 0);
});

test('barFraction clamps below the minimum and above the maximum', () => {
  assert.equal(barFraction(-0.5, [0, 1]), 0);
  assert.equal(barFraction(3, [0, 1]), 1);
});

test('barFraction is 0.5 at the midpoint of the range', () => {
  assert.equal(barFraction(0.5, [0, 1]), 0.5);
  assert.equal(barFraction(0, [-1, 1]), 0.5);
});

test('centredFraction is 0 at zero and below', () => {
  assert.equal(centredFraction(0, [0, 1]), 0);
  assert.equal(centredFraction(-0.4, [0, 1]), 0);
});

test('centredFraction is 1 at the range maximum and above', () => {
  assert.equal(centredFraction(1, [0, 1]), 1);
  assert.equal(centredFraction(7, [0, 1]), 1);
});

test('centredFraction is 0.5 at half the range maximum', () => {
  assert.equal(centredFraction(0.5, [0, 1]), 0.5);
  assert.equal(centredFraction(1, [0, 2]), 0.5);
});

test('centredFraction ignores the declared minimum, so the zero line stays at the centre', () => {
  assert.equal(centredFraction(0, [0.2, 2]), 0);
  assert.equal(centredFraction(1, [0.2, 2]), 0.5);
});

test('pairRows puts the L and R channels of one signal on one row, L first', () => {
  const rows = pairRows([
    { channel: { id: 'odour-food-left', label: 'Food odour left', side: 'L' }, value: 0.4 },
    { channel: { id: 'odour-food-right', label: 'Food odour right', side: 'R' }, value: 0.1 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Food odour');
  assert.deepEqual(rows[0].parts.map((p) => p.side), ['L', 'R']);
  assert.deepEqual(rows[0].parts.map((p) => p.value), [0.4, 0.1]);
});

test('pairRows pairs a leading left/right token too, as in the motor outputs', () => {
  const rows = pairRows([
    { channel: { id: 'left-motor', label: 'Left motor', side: 'L' }, value: 0.2 },
    { channel: { id: 'right-motor', label: 'Right motor', side: 'R' }, value: 0.3 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Motor');
});

test('pairRows keeps a both channel and an unpaired channel on their own rows, in declaration order', () => {
  const rows = pairRows([
    { channel: { id: 'food-odour', label: 'Food odour', side: 'both' }, value: 0.5 },
    { channel: { id: 'odour-left', label: 'Odour left', side: 'L' }, value: 0.1 },
    { channel: { id: 'feed', label: 'Feed', side: 'R' }, value: 0.7 },
  ]);
  assert.deepEqual(rows.map((r) => r.label), ['Food odour', 'Odour left', 'Feed']);
  assert.deepEqual(rows.map((r) => r.parts.length), [1, 1, 1]);
});

test('pairRows keeps the label of a paired row when no left/right word is present', () => {
  const rows = pairRows([
    { channel: { id: 'turn-left', label: 'Turn', side: 'L' }, value: 0 },
    { channel: { id: 'turn-right', label: 'Turn', side: 'R' }, value: 0 },
  ]);
  assert.equal(rows[0].label, 'Turn');
});
