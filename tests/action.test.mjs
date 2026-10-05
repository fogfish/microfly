// The action label from the two drive values (data-model.md, Action).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionLabel } from '../public/js/fly/action.js';

test('both drives near zero is Idle', () => {
  assert.equal(actionLabel(0, 0), 'Idle');
  assert.equal(actionLabel(0.04, 0.04), 'Idle');
});

test('equal drives are Forward', () => {
  assert.equal(actionLabel(0.6, 0.6), 'Forward');
});

test('a stronger left drive is Turn right, and a stronger right drive is Turn left', () => {
  assert.equal(actionLabel(0.9, 0.2), 'Turn right');
  assert.equal(actionLabel(0.2, 0.9), 'Turn left');
});

test('the thresholds sit at 0.1, for both the sum and the difference', () => {
  // Clear points on each side, so float rounding at exactly 0.1 does not matter.
  assert.equal(actionLabel(0.04, 0.05), 'Idle');
  assert.equal(actionLabel(0.06, 0.06), 'Forward');
  assert.equal(actionLabel(0.4, 0.31), 'Forward');
  assert.equal(actionLabel(0.4, 0.29), 'Turn right');
  assert.equal(actionLabel(0.29, 0.4), 'Turn left');
});
