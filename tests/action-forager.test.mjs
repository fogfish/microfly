// The forager action label (ADR 003 W4): Idle, Forward, Backward, Turn left or Turn right, from the named drives, with the
// thresholds ACTION_IDLE_SUM and ACTION_STRAIGHT_DIFF. A turnLeft drive turns the fly to its left (FORAGER_TURN_SIGN).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forageAction, ACTION_IDLE_SUM } from '../public/js/fly/action.js';

const drives = (d) => ({ turnLeft: 0, turnRight: 0, forward: 0, backward: 0, feed: 0, ...d });

test('no drive is Idle', () => {
  assert.equal(forageAction(drives({})), 'Idle');
  assert.equal(forageAction(drives({ feed: 1 })), 'Idle', 'feeding alone does not move the fly');
});

test('forward and backward drives give Forward and Backward', () => {
  assert.equal(forageAction(drives({ forward: 0.8 })), 'Forward');
  assert.equal(forageAction(drives({ backward: 0.8 })), 'Backward');
});

test('a turn difference gives Turn left or Turn right, and the turn is named before the walk', () => {
  assert.equal(forageAction(drives({ turnLeft: 0.8 })), 'Turn left');
  assert.equal(forageAction(drives({ turnRight: 0.8 })), 'Turn right');
  assert.equal(forageAction(drives({ turnLeft: 0.8, forward: 0.8 })), 'Turn left');
});

test('a turn below the straight threshold is not a turn', () => {
  assert.equal(forageAction(drives({ turnLeft: 0.05, turnRight: 0.02, forward: 0.8 })), 'Forward');
  assert.ok(ACTION_IDLE_SUM > 0);
});
