// Forager motion (ADR 003 W4): v = maxSpeed × clamp(forward − backward, −1, 1); ω = turnRate × s × (turnLeft − turnRight).
// The sign s is fixed by the sign test: a source on the fly's left, with a turnLeft-only drive, must bring the heading
// toward it. The fly's left is (sin θ, −cos θ), as in stimulus.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, stepBody, stepForagerBody, FORAGER_TURN_SIGN } from '../public/js/fly/body.js';
import { antennaPoints } from '../public/js/fly/stimulus.js';

const open = { isWalkable: () => true, isStimulusCell: () => false, width: 100, height: 100 };
const env = { ...open, dt: 0.05, maxSpeed: 3, turnRate: 4 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

test('the forward speed is maxSpeed times the clamped forward minus backward drive', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  stepForagerBody(body, { forward: 1, backward: 0, turnLeft: 0, turnRight: 0 }, env);
  assert.ok(Math.abs(body.x - (50 + 3 * 0.05)) < 1e-12, `moved ${body.x - 50}`);
  const fast = createBody({ x: 50, y: 50, heading: 0 });
  stepForagerBody(fast, { forward: 5, backward: 0, turnLeft: 0, turnRight: 0 }, env);
  assert.ok(Math.abs(fast.x - (50 + 3 * 0.05)) < 1e-12, 'a drive above 1 is clamped to 1');
  const back = createBody({ x: 50, y: 50, heading: 0 });
  stepForagerBody(back, { forward: 0, backward: 1, turnLeft: 0, turnRight: 0 }, env);
  assert.ok(back.x < 50, 'backward moves against the heading');
});

test('the turn rate is turnRate times the sign times the turn difference', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  stepForagerBody(body, { forward: 0, backward: 0, turnLeft: 1, turnRight: 0 }, env);
  assert.ok(Math.abs(body.heading - FORAGER_TURN_SIGN * 4 * 0.05) < 1e-12);
  const none = createBody({ x: 50, y: 50, heading: 0 });
  stepForagerBody(none, { forward: 0, backward: 0, turnLeft: 0.5, turnRight: 0.5 }, env);
  assert.equal(none.heading, 0, 'equal left and right turns do not turn the fly');
});

test('the sign is -1: a turnLeft-only drive turns the fly toward its own left', () => {
  assert.equal(FORAGER_TURN_SIGN, -1);
  const fly = { x: 50, y: 50, heading: 0 };
  const source = antennaPoints(fly, 5).left; // five tiles to the fly's left
  const body = createBody(fly);
  const bearing = (b) => Math.atan2(source.y - b.y, source.x - b.x);
  const before = Math.abs(wrap(body.heading - bearing(body)));
  for (let t = 0; t < 10; t++) stepForagerBody(body, { forward: 0, backward: 0, turnLeft: 1, turnRight: 0 }, env);
  const after = Math.abs(wrap(body.heading - bearing(body)));
  assert.ok(after < before, `turning left should bring the heading toward the source (${before} → ${after})`);
});

test('the v0 tank step is unchanged by the forager step', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  stepBody(body, { left: 0.5, right: 0.5 }, env);
  assert.ok(Math.abs(body.x - (50 + 3 * 0.5 * 0.05)) < 1e-12);
});
