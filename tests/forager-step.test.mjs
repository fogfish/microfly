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
import { applyForagerMotor, forageEnv, initForagerFly, senseForagerFly, stepForagerFly } from '../public/js/fly/forager-step.js';

const FILE = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));
const SKIP = existsSync(FILE) ? false : 'public/brains/forager-brain.brain is absent';

const CONFIG = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.01, intake: 0.2 } },
  stimulus: { radius: 8, gain: 1, max: 1, resting: 0.2, antennaOffset: 0.5 },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, consumption: true },
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

// Spec 018 US1 (contracts/world-config-food-feeding.md, "Sensor-filter placement"): a hungry fly's food-odour inputs
// are scaled by hungerSensitivity.gain; taste and the input shape are untouched. Sense-only: no brain, no snapshot.
const SENSE_CFG = { tickHz: 20, body: { maxSpeed: 3, turnRate: 4 }, stimulus: { gain: 1, max: 1, resting: 0, antennaOffset: 0.5 } };
const HUNGER = { threshold: 0.4, gain: 1.8 };
// One constant-odour unit on the flower at (12, 10): both antennae and the taste cell sample that flower.
const SENSE_UNITS = [{ cellX: 12, cellY: 10, kernel: () => 0.5 }];
function senseEnv(hungerSensitivity) {
  const w = world();
  return {
    foodUnits: SENSE_UNITS,
    flowers: createFood(w, { food: CONFIG.food }),
    isStimulusCell: w.isStimulusCell,
    stimulus: SENSE_CFG.stimulus,
    foodConfig: hungerSensitivity === undefined ? {} : { hungerSensitivity },
  };
}
function senseFly(energy) {
  return { id: 0, tick: 0, body: createBody({ x: 12.5, y: 10.5, heading: 0 }), energy };
}

test('without hungerSensitivity, the sense does not depend on hunger', () => {
  const hungry = senseForagerFly(senseFly(0.3), senseEnv());
  const sated = senseForagerFly(senseFly(0.9), senseEnv());
  assert.ok(hungry.inputs[0] > 0, 'the fixture must sense food odour');
  assert.deepEqual(Array.from(hungry.inputs), Array.from(sated.inputs));
});

test('a hungry fly (hunger at or above the threshold) senses food odour scaled by gain', () => {
  const plain = senseForagerFly(senseFly(0.3), senseEnv());
  const hungry = senseForagerFly(senseFly(0.3), senseEnv(HUNGER));
  assert.ok(Math.abs(hungry.inputs[0] - plain.inputs[0] * HUNGER.gain) < 1e-6, 'left odour × gain');
  assert.ok(Math.abs(hungry.inputs[1] - plain.inputs[1] * HUNGER.gain) < 1e-6, 'right odour × gain');
});

test('a fed fly (hunger below the threshold) senses food odour unscaled', () => {
  const plain = senseForagerFly(senseFly(0.9), senseEnv());
  const fed = senseForagerFly(senseFly(0.9), senseEnv(HUNGER));
  assert.deepEqual(Array.from(fed.inputs), Array.from(plain.inputs));
});

test('the filter keeps the four inputs in order and leaves taste unscaled', () => {
  const hungry = senseForagerFly(senseFly(0.3), senseEnv(HUNGER));
  assert.equal(hungry.inputs.length, 4);
  assert.equal(hungry.inputs[2], 1, 'taste on the flower is unscaled');
  assert.equal(hungry.inputs[3], 1, 'taste on the flower is unscaled');
  assert.equal(hungry.message.inputs.length, 4);
});

// Spec 018 US2 (contracts/world-config-food-feeding.md, "Motor-control placement"): with flies.food.capacity, a
// feeding bout charges one unit when it closes 'sated' or 'empty', never while eating and never when it closes
// 'walked'; without capacity the continuous consumeRate drain is unchanged. applyForagerMotor, one tick at a time.
const FEED_DRIVES = ['forward', 'backward', 'turnLeft', 'turnRight', 'feed'];
const FEED_CAPS = { channels: { inputs: [], outputs: FEED_DRIVES.map((drive) => ({ drive })) } };
function feedEnv(food) {
  const w = { ...world(), stimulusCells: new Map([[FLOWER, { kind: 'small', reach: 0 }]]) };
  const config = { ...CONFIG, food: { ...CONFIG.food, ...food } };
  return forageEnv(config, w, createFood(w, config), FEED_CAPS);
}
function feedTick(fly, env, feed) {
  const outputs = Float32Array.from(FEED_DRIVES.map((d) => (d === 'feed' ? feed : 0)));
  return applyForagerMotor(fly, { inputs: Float32Array.of(), outputs, spikes: [] }, env);
}
function feedFly() {
  return initForagerFly({ id: 0, tick: 0, body: createBody({ x: 12.5, y: 10.5, heading: 0 }) }, CONFIG.body.energy.initial);
}
const CAPACITY = { capacity: { small: 1, medium: 2, large: 3 }, recovery: 30 };

test('without capacity, feeding keeps the continuous consumeRate drain', () => {
  const env = feedEnv({});
  const fly = feedFly();
  feedTick(fly, env, 1);
  assert.ok(Math.abs(env.flowers.stockAt(12, 10) - (1 - CONFIG.food.consumeRate * env.dt)) < 1e-12);
});

// Spec 018 US2 (contracts/world-config-food-feeding.md): with flies.food.capacity, eating drains a flower continuously,
// as the legacy model does, until it is empty; the bout then closes 'empty', and the flower stays empty for recovery.
test('with capacity, eating drains a small flower continuously and it is empty after one unit is eaten', () => {
  const env = feedEnv(CAPACITY);
  const fly = feedFly();
  for (let t = 0; t < 20; t++) feedTick(fly, env, 1);
  assert.ok(Math.abs(env.flowers.stockAt(12, 10) - (1 - 20 * CONFIG.food.consumeRate * env.dt)) < 1e-9, 'drained while eaten');
  for (let t = 0; t < 100; t++) feedTick(fly, env, 1);
  assert.equal(env.flowers.stockAt(12, 10), 0, 'empty after its one unit');
  feedTick(fly, env, 1);
  assert.equal(fly.bouts.at(-1).endedBy, 'empty');
  assert.equal(env.flowers.fraction(12, 10), 0, 'stays empty while it recovers');
});
