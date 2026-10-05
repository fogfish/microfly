// A headless run (no DOM, forager-step.js) of a hungry fly on a flower (ADR 003 W2–W3). The brain is SCRIPTED here, not
// the connectome, so the test checks the body and eating rules alone: the fly eats while it is hungry and slow, eating
// stops when it is full, it leaves before the flower is empty, and a sated fly does not eat the same cell at once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';

const CONFIG = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.1, metabolism: 0.01, intake: 0.2 } },
  stimulus: { radius: 8, gain: 1, max: 1, resting: 0.2, antennaOffset: 0.5 },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
};
const CAPABILITIES = {
  channels: {
    inputs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    outputs: ['turnLeft', 'turnRight', 'forward', 'backward', 'feed']
      .map((drive) => ({ id: drive, drive })),
  },
};
const WIDTH = 20;
const FLOWER = 10 * WIDTH + 10;

function world() {
  return {
    width: WIDTH,
    height: WIDTH,
    walkable: () => true,
    isStimulusCell: (cx, cy) => cy * WIDTH + cx === FLOWER,
    stimulusCells: new Map([[FLOWER, 'flower']]),
  };
}

// A scripted brain (outputs in declaration order: turnLeft, turnRight, forward, backward, feed). While the fly is hungry
// it stands and feeds. Once it is sated it walks forward and stops feeding, so it leaves the flower.
function scriptedBrain() {
  return {
    step({ hunger }) {
      const sated = 1 - hunger >= CONFIG.food.sated;
      const outputs = Float32Array.of(0, 0, sated ? 1 : 0, 0, sated ? 0 : 1);
      return { inputs: Float32Array.of(0, 0, 0, 0), outputs, spikes: new Uint32Array(0) };
    },
  };
}

function headless(ticks, { energy = 0.1, start = { x: 10.5, y: 10.5 } } = {}) {
  const w = world();
  const flowers = createFood(w, CONFIG);
  const env = forageEnv(CONFIG, w, flowers, CAPABILITIES);
  const fly = { id: 0, tick: 0, body: createBody({ ...start, heading: 0 }), brainSeed: 1 };
  initForagerFly(fly, energy);
  const brain = scriptedBrain();
  const log = [];
  for (let t = 0; t < ticks; t++) {
    const { entry } = stepForagerFly(fly, env, brain);
    log.push(entry);
  }
  return { fly, flowers, log };
}

test('a hungry fly on a flower eats, gains energy and lowers the stock', () => {
  const { fly, flowers, log } = headless(10);
  assert.ok(log.some((e) => e.eating), 'the fly should eat');
  assert.ok(fly.energy > 0.1, `energy ${fly.energy} should rise`);
  assert.ok(flowers.stockAt(10, 10) < 1, 'stock should fall');
});

test('eating stops when the fly is full, and the fly leaves before the flower is empty', () => {
  const { fly, flowers, log } = headless(400);
  const lastEating = log.map((e) => e.eating).lastIndexOf(true);
  assert.ok(lastEating >= 0, 'the fly ate');
  assert.ok(lastEating < log.length - 1, 'eating stops');
  assert.ok(flowers.stockAt(10, 10) > 0, 'the flower is not empty');
  assert.ok(fly.bouts.length >= 1, 'a bout was recorded');
  assert.ok(['sated', 'walked'].includes(fly.bouts.at(-1).endedBy));
});

test('a sated fly does not eat the same cell again at once', () => {
  const { fly, log } = headless(400);
  const firstBoutEnd = log.findIndex((e, i) => i > 0 && log[i - 1].eating && !e.eating);
  assert.ok(firstBoutEnd > 0, 'the first bout ended');
  const soon = log.slice(firstBoutEnd, firstBoutEnd + 20);
  assert.ok(soon.every((e) => !e.eating), 'no eating in the 20 ticks after a sated bout');
  assert.ok(fly.energy >= 0.9 || fly.bouts.length > 0);
});
