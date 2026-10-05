// One tick of the pure forager loop (forager-step.js): the same state gives the same result, and every tick produces
// a protocol 3 sense and a protocol 3 motor. Runs on the extracted artifact; skipped when absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createBody } from '../public/js/fly/body.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnv, initForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';

const FILE = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));
const SKIP = existsSync(FILE) ? false : 'public/brains/forager-brain.brain is absent';

const CONFIG = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.01, intake: 0.2 } },
  stimulus: { radius: 8, gain: 1, max: 1, resting: 0.2, antennaOffset: 0.5 },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
};

const WIDTH = 40;
const FLOWER = 10 * WIDTH + 12;
function world() {
  return {
    width: WIDTH,
    height: WIDTH,
    walkable: () => true,
    isStimulusCell: (cx, cy) => cy * WIDTH + cx === FLOWER,
    stimulusCells: new Map([[FLOWER, 'flower']]),
  };
}

function snapshot() {
  const b = readFileSync(FILE);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

function run(ticks) {
  const snap = snapshot();
  const w = world();
  const flowers = createFood(w, CONFIG);
  const env = forageEnv(CONFIG, w, flowers, snap.capabilities);
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 2 }, 4242);
  const fly = { id: 0, tick: 0, body: createBody({ x: 9.5, y: 10.5, heading: 0 }), brainSeed: 4242 };
  initForagerFly(fly, CONFIG.body.energy.initial);
  const messages = [];
  const entries = [];
  for (let t = 0; t < ticks; t++) {
    const { sense, motor, entry } = stepForagerFly(fly, env, brain);
    messages.push(sense, motor);
    entries.push(entry);
  }
  return { messages, entries, fly };
}

test('the same state gives the same result for every tick', { skip: SKIP }, () => {
  const a = run(30);
  const b = run(30);
  assert.deepEqual(a.entries, b.entries);
  assert.deepEqual(a.fly.body, b.fly.body);
});

test('every tick produces a protocol 3 sense and a protocol 3 motor', { skip: SKIP }, () => {
  const { messages } = run(10);
  for (let i = 0; i < messages.length; i += 2) {
    assert.equal(messages[i].v, 3);
    assert.equal(messages[i].type, 'sense');
    assert.equal(messages[i + 1].v, 3);
    assert.equal(messages[i + 1].type, 'motor');
  }
});
