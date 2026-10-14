// Escape physics end to end (ADR 007 W10), through forageEnvWide/applyForagerMotor (not body-escape.test.mjs's
// isolated applyEscape unit test): a fixture motor reply whose escape drive stays above threshold for several
// ticks moves the fly exactly once per cooldown, at the world's tickHz; with flies.body.escape.enabled false,
// the same drive sequence never moves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { initForagerFly, applyForagerMotor } from '../public/js/fly/forager-step.js';
import { forageEnvWide } from '../public/js/fly/forager-step-wide.js';

const DRIVES = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'];

function capabilities() {
  const inputs = [
    { id: 'odour-food-left', label: 'L', side: 'L', range: [0, 1], sense: 'odour:food', site: 'antenna' },
    { id: 'odour-food-right', label: 'R', side: 'R', range: [0, 1], sense: 'odour:food', site: 'antenna' },
  ];
  const outputs = DRIVES.map((drive, k) => ({ id: `out-${k}`, label: drive, side: 'both', range: [0, 1], drive }));
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const WIDTH = 30;
function world() {
  return {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: () => false,
    stimulusCells: new Map(),
    dangerCells: new Map(),
  };
}

function flyConfig(escapeEnabled) {
  return {
    tickHz: 20,
    body: {
      maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
      sites: { antenna: { forward: 0, lateral: 0.5 }, mouth: { forward: 0, lateral: 0 }, 'front-leg': { forward: 0.5, lateral: 0.25 } },
      escape: { enabled: escapeEnabled, threshold: 0.5, distance: 1.5, cooldown: 2 },
    },
    food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
    stimuli: {
      'odour:food': { from: 'edibles', scaleBy: 'stock', radius: 6 },
    },
  };
}

// A motor reply holding escape above threshold and every other drive neutral/zero.
function escapeMotor() {
  const outputs = Float32Array.from(DRIVES, (d) => (d === 'escape' ? 0.9 : 0));
  return { inputs: new Float32Array(2), outputs, spikes: new Uint32Array(0) };
}

function runTicks(escapeEnabled, ticks) {
  const f = flyConfig(escapeEnabled);
  const w = world();
  const flowers = createFood(w, f);
  const env = forageEnvWide(f, w, flowers, capabilities());
  const fly = { id: 0, tick: 0, body: createBody({ x: 10.5, y: 10.5, heading: 0 }) };
  initForagerFly(fly, f.body.energy.initial);
  const positions = [{ x: fly.body.x, y: fly.body.y }];
  for (let t = 0; t < ticks; t++) {
    applyForagerMotor(fly, escapeMotor(), env);
    positions.push({ x: fly.body.x, y: fly.body.y });
  }
  return positions;
}

test('exactly one move per cooldown worth of ticks, at the configured tickHz', () => {
  const tickHz = 20;
  const cooldownTicks = 2 * tickHz; // flies.body.escape.cooldown is 2 seconds, at dt = 1/20 s
  const positions = runTicks(true, cooldownTicks + 10);
  const moves = [];
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(positions[i].x - positions[i - 1].x) > 1e-9) moves.push(i);
  }
  assert.equal(moves.length, 2, `expected exactly two moves, got moves at ${moves}`);
  assert.equal(moves[0], 1, 'the first tick above threshold, off cooldown, triggers immediately');
  assert.equal(moves[1] - moves[0], cooldownTicks, `moves should be exactly ${cooldownTicks} ticks apart, got ${moves[1] - moves[0]}`);
});

test('zero moves for the same drive sequence when flies.body.escape.enabled is false', () => {
  const positions = runTicks(false, 100);
  for (let i = 1; i < positions.length; i++) {
    assert.ok(Math.abs(positions[i].x - positions[i - 1].x) < 1e-9, `unexpected move at tick ${i}`);
  }
});
