// Escape physics (ADR 007 W10, D17): off by default; one move of `distance` tiles per `cooldown` while enabled,
// above threshold and off cooldown; blocked at the first non-walkable cell, exactly like any other move.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, applyEscape } from '../public/js/fly/body.js';

const open = { isWalkable: () => true, width: 100, height: 100 };
const escapeConfig = { enabled: true, threshold: 0.5, distance: 1.5, cooldown: 2 };

test('no move while env.escape is undefined (v1/11K call sites), regardless of drive value', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  applyEscape(body, { escape: 0.9 }, { dt: 0.05, ...open });
  assert.equal(body.x, 50);
  assert.equal(body.y, 50);
});

test('no move while env.escape.enabled is false, regardless of drive value', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  const env = { dt: 0.05, ...open, escape: { ...escapeConfig, enabled: false } };
  for (let t = 0; t < 10; t++) applyEscape(body, { escape: 0.99 }, env);
  assert.equal(body.x, 50);
  assert.equal(body.y, 50);
});

test('no move while the drive is at or below threshold', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  const env = { dt: 0.05, ...open, escape: escapeConfig };
  applyEscape(body, { escape: escapeConfig.threshold }, env);
  assert.equal(body.x, 50);
});

test('exactly one move of distance tiles when enabled, above threshold and off cooldown', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  const env = { dt: 0.05, ...open, escape: escapeConfig };
  applyEscape(body, { escape: 0.9 }, env);
  assert.ok(Math.abs(body.x - (50 + escapeConfig.distance)) < 1e-9, `moved to ${body.x}`);
  assert.equal(body.y, 50);
});

test('no second move until cooldown seconds have elapsed', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  const env = { dt: 0.05, ...open, escape: escapeConfig };
  applyEscape(body, { escape: 0.9 }, env); // triggers, cooldown set to 2s
  const afterFirst = body.x;
  const ticksPerCooldown = escapeConfig.cooldown / env.dt;
  for (let t = 0; t < ticksPerCooldown - 1; t++) applyEscape(body, { escape: 0.9 }, env);
  assert.equal(body.x, afterFirst, 'no second move before cooldown elapses');
  applyEscape(body, { escape: 0.9 }, env); // cooldown has now elapsed
  assert.ok(Math.abs(body.x - (afterFirst + escapeConfig.distance)) < 1e-6, `second move landed at ${body.x}`);
});

test('a move is blocked at the first non-walkable cell (pick)', () => {
  // A diagonal heading so the blocked x-axis move still allows the y-only candidate through (pick's fallback).
  const body = createBody({ x: 50, y: 50, heading: Math.PI / 4 });
  const blocked = { isWalkable: (cx, cy) => cx < 51, width: 100, height: 100 };
  const env = { dt: 0.05, ...blocked, escape: escapeConfig };
  applyEscape(body, { escape: 0.9 }, env);
  assert.equal(body.x, 50, 'the full and x-only candidates are both blocked, so x does not move');
  assert.ok(body.y > 50, `the y-only candidate should still move, got ${body.y}`);
});
