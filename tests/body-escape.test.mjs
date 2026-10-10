// ADR 006 W8: jumpForagerBody moves distance tiles along the current heading, stopping at the first
// non-walkable cell (reusing the same walkability check every other move already uses); applyForagerMotor's
// cooldown gate suppresses a second jump until the configured cooldown elapses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, jumpForagerBody, resolveBodySites } from '../public/js/fly/body.js';
import { applyForagerMotor, initForagerFly } from '../public/js/fly/forager-step.js';
import { createFood } from '../public/js/fly/food.js';

const open = { isWalkable: () => true, isStimulusCell: () => false, width: 100, height: 100 };

test('jumpForagerBody moves the configured distance along the current heading', () => {
  const body = createBody({ x: 50, y: 50, heading: 0 });
  jumpForagerBody(body, 1.5, open);
  assert.ok(Math.abs(body.x - 51.5) < 1e-9, `moved to x=${body.x}`);
  assert.ok(Math.abs(body.y - 50) < 1e-9);
});

test('jumpForagerBody stops at the first non-walkable cell', () => {
  const wall = { ...open, isWalkable: (cx) => cx < 52 };
  const body = createBody({ x: 50, y: 50, heading: 0 });
  jumpForagerBody(body, 5, wall);
  assert.ok(body.x < 52, `should stop before the wall, got x=${body.x}`);
});

test('a jump at a non-zero heading moves diagonally', () => {
  const body = createBody({ x: 50, y: 50, heading: Math.PI / 2 });
  jumpForagerBody(body, 2, open);
  assert.ok(Math.abs(body.x - 50) < 1e-9);
  assert.ok(Math.abs(body.y - 52) < 1e-9);
});

test('resolveBodySites passes through the declared sites, defaulting to {} when absent', () => {
  assert.deepEqual(resolveBodySites({ sites: { antenna: 0.5, mouth: 0, 'front-leg': 0.4 } }),
    { antenna: 0.5, mouth: 0, 'front-leg': 0.4 });
  assert.deepEqual(resolveBodySites({}), {});
  assert.deepEqual(resolveBodySites(undefined), {});
});

// applyForagerMotor's escape branch (ADR 006 W8, Acceptance Scenarios 2-3 / SC-011): a fly above threshold
// outside cooldown jumps exactly once per tick-above-threshold run; a second above-threshold tick during
// cooldown produces no second jump.
const DRIVES = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'];
const WIDTH = 100;

function escapeFixture() {
  const world = {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: () => false,
    stimulusCells: new Map(),
  };
  const foodConfig = { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 };
  const flowers = createFood(world, { food: foodConfig });
  const env = {
    dt: 0.05, maxSpeed: 3, turnRate: 4, width: WIDTH, height: WIDTH,
    isWalkable: world.walkable, isStimulusCell: world.isStimulusCell,
    energyConfig: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
    foodConfig, flowers, drives: DRIVES,
    escapeConfig: { threshold: 0.5, distance: 1.5, cooldown: 2 }, // cooldown 2s / dt 0.05 = 40 ticks
  };
  const fly = { id: 0, tick: 0, body: createBody({ x: 50, y: 50, heading: 0 }) };
  initForagerFly(fly, env.energyConfig.initial);
  return { fly, env };
}

function outputsFor(values) {
  return Float32Array.from(DRIVES, (name) => values[name] ?? 0);
}

test('a fly above the escape threshold outside cooldown jumps exactly once per tick-above-threshold run', () => {
  const { fly, env } = escapeFixture();
  const motor = { inputs: new Float32Array(1), outputs: outputsFor({ escape: 0.9 }), spikes: new Uint32Array(0) };
  const entry = applyForagerMotor(fly, motor, env);
  assert.equal(entry.escaped, true);
  assert.ok(fly.body.x > 50, `the fly should have jumped forward, x=${fly.body.x}`);
  assert.equal(fly.escapeCooldownTicks, 40);
});

test('a second above-threshold tick during cooldown produces no second jump (SC-011)', () => {
  const { fly, env } = escapeFixture();
  const motor = { inputs: new Float32Array(1), outputs: outputsFor({ escape: 0.9 }), spikes: new Uint32Array(0) };
  applyForagerMotor(fly, motor, env); // first jump
  const xAfterFirst = fly.body.x;
  const entry = applyForagerMotor(fly, motor, env); // still above threshold, but in cooldown
  assert.equal(entry.escaped, false);
  assert.ok(Math.abs(fly.body.x - xAfterFirst) < 1e-9, 'no second jump during cooldown');
});

test('below the escape threshold, the fly never jumps', () => {
  const { fly, env } = escapeFixture();
  const motor = { inputs: new Float32Array(1), outputs: outputsFor({ escape: 0.2 }), spikes: new Uint32Array(0) };
  const entry = applyForagerMotor(fly, motor, env);
  assert.equal(entry.escaped, false);
  assert.equal(fly.body.x, 50);
});

test('escapeConfig absent (a v1 fly) is inert: no escape key, no jump, no error', () => {
  const { fly, env } = escapeFixture();
  delete env.escapeConfig;
  const motor = {
    inputs: new Float32Array(1),
    outputs: Float32Array.from(['turnLeft', 'turnRight', 'forward', 'backward', 'feed'], () => 0),
    spikes: new Uint32Array(0),
  };
  env.drives = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed'];
  const entry = applyForagerMotor(fly, motor, env);
  assert.equal(entry.escaped, false);
  assert.equal(fly.body.x, 50);
});
