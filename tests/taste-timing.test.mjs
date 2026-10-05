// Taste and eating come from the same cell in one tick (BUG-002). The taste input is read before the body moves, so
// eating in that tick must use the same cell: a fly that steps onto a flower this tick does not eat on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';

const CONFIG = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.1, metabolism: 0.005, intake: 0.2 } },
  stimulus: { radius: 8, gain: 1, max: 1, resting: 0.2, antennaOffset: 0.5 },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
};
const CAPABILITIES = {
  channels: {
    inputs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    outputs: ['turnLeft', 'turnRight', 'forward', 'backward', 'feed'].map((drive) => ({ id: drive, drive })),
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

// Always feeds, and walks with a slow forward drive, so the fly is slow enough to eat once it is on the flower.
const brain = {
  step() {
    return { inputs: Float32Array.of(0, 0, 0, 0), outputs: Float32Array.of(0, 0, 0.05, 0, 1), spikes: new Uint32Array(0) };
  },
};

test('a fly that steps onto a flower in the tick does not eat on it that tick; it eats from the next tick', () => {
  const w = world();
  const flowers = createFood(w, CONFIG);
  const env = forageEnv(CONFIG, w, flowers, CAPABILITIES);
  // Just left of the flower's cell edge: one slow tick (0.15 tiles/s × 0.05 s) carries the fly into the flower cell.
  const start = { x: 9.999, y: 10.5 };
  const fly = { id: 0, tick: 0, body: createBody({ ...start, heading: 0 }), brainSeed: 1 };
  initForagerFly(fly, 0.1);
  const first = stepForagerFly(fly, env, brain).entry;
  assert.equal(first.eating, false, 'taste was sensed off the flower, so there is no eating on this tick');
  assert.equal(flowers.stockAt(10, 10), 1, 'the flower is not consumed on the tick of arrival');
  const second = stepForagerFly(fly, env, brain).entry;
  assert.equal(second.eating, true, 'on the flower, the fly eats');
  assert.ok(flowers.stockAt(10, 10) < 1, 'the flower is consumed on the eating tick, so its taste was above 0');
});
