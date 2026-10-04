// Fly body: motion, turning, blocked cells, sliding, bounds, and contact counting on entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, stepBody } from '../public/js/fly/body.js';

const W = 10;
const H = 10;
function env({ blocked = [], stimulus = [] } = {}) {
  const b = new Set(blocked);
  const s = new Set(stimulus);
  const key = (cx, cy) => `${cx},${cy}`;
  return {
    dt: 1,
    maxSpeed: 1,
    turnRate: 1,
    width: W,
    height: H,
    isWalkable: (cx, cy) => !b.has(key(cx, cy)),
    isStimulusCell: (cx, cy) => s.has(key(cx, cy)),
  };
}

test('forward motion with equal motors moves along the heading', () => {
  const body = createBody({ x: 5.5, y: 5.5, heading: 0 });
  stepBody(body, { left: 1, right: 1 }, env());
  assert.ok(Math.abs(body.x - 6.5) < 1e-9);
  assert.ok(Math.abs(body.y - 5.5) < 1e-9);
});

test('unequal motors turn the fly and move it at half speed', () => {
  const body = createBody({ x: 5.5, y: 5.5, heading: 0 });
  stepBody(body, { left: 0, right: 1 }, env());
  assert.ok(Math.abs(body.heading - 1) < 1e-9, 'heading changes by turnRate × (R − L) × dt');
  assert.ok(Math.hypot(body.x - 5.5, body.y - 5.5) < 1, 'speed is maxSpeed × (L + R) / 2 = 0.5');
});

test('a blocked cell stops the fly', () => {
  const body = createBody({ x: 5.5, y: 5.5, heading: 0 });
  stepBody(body, { left: 1, right: 1 }, env({ blocked: ['6,5'] }));
  assert.equal(body.x, 5.5);
  assert.equal(body.y, 5.5);
});

test('sliding: when the diagonal and the x move are blocked, the fly moves in y', () => {
  const body = createBody({ x: 5.5, y: 5.5, heading: Math.PI / 4 });
  stepBody(body, { left: 1, right: 1 }, env({ blocked: ['6,6', '6,5'] }));
  assert.equal(body.x, 5.5);
  assert.ok(body.y > 5.5, `y should advance, got ${body.y}`);
});

test('world bounds clamp: the fly does not leave the world', () => {
  const body = createBody({ x: 0.5, y: 0.5, heading: Math.PI });
  stepBody(body, { left: 1, right: 1 }, env());
  assert.equal(body.x, 0.5);
  assert.ok(Math.abs(body.y - 0.5) < 1e-9);
});

test('contacts increase once per entry into a stimulus cell, not while staying in it', () => {
  const e = env({ stimulus: ['7,5'] });
  const body = createBody({ x: 5.5, y: 5.5, heading: 0 });
  stepBody(body, { left: 1, right: 1 }, e); // 6.5, cell 6
  assert.equal(body.contacts, 0);
  stepBody(body, { left: 1, right: 1 }, e); // 7.5, cell 7: entry
  assert.equal(body.contacts, 1);
  stepBody(body, { left: 0, right: 0 }, e); // still in cell 7
  stepBody(body, { left: 0, right: 0 }, e);
  assert.equal(body.contacts, 1);
  stepBody(body, { left: 1, right: 1 }, e); // 8.5, cell 8: leaves
  assert.equal(body.contacts, 1);
  body.heading = Math.PI;
  stepBody(body, { left: 1, right: 1 }, e); // 7.5, cell 7 again: a second entry
  assert.equal(body.contacts, 2);
});
