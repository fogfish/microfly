// Spec 017 BUG-001 (specs/017-demo-forager/bugs/BUG-001.md): the v3 demo fly did not smell food, never ate,
// flipped its heading at random and showed no reaction to danger. One regression test per root cause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld } from '../public/js/fly/fly-world.js';
import { createBody } from '../public/js/fly/body.js';
import { initBodyLayerFly, stepBodyLayer } from '../public/js/fly/body-layer.js';
import { parseDecoder, createDecoderState, decodeTick } from '../public/js/fly/decoder.js';
import { createFlyBrain } from '../public/js/brain/fly-brain-v1.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { candidateNeurons } from '../.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs';

const pub = (p) => new URL(`../public/${p}`, import.meta.url);
const loadWorld = (name) => JSON.parse(readFileSync(pub(`world/${name}`), 'utf8'));
const { catalog } = indexCatalog(JSON.parse(readFileSync(pub('assets/atlas/catalog.json'), 'utf8')));

// ---- root cause 1: a v3 world had no stimulus cells (fly-world.js keyed the wide-I/O branch on "v2" only) ----

for (const name of ['world-forager-demo.json', 'world-forager-demo-tilemap.json']) {
  test(`${name}: every declared edible is a stimulus cell with a food-odour unit`, () => {
    const config = loadWorld(name);
    const world = buildWorld(config, buildLogic(config, catalog));
    assert.ok(world.stimulusCells.size > 0, 'a v3 world must have flowers');
    assert.equal(world.foodUnits.length, world.stimulusCells.size);
  });
}

// ---- root cause 2: v3 feeding (D30) ----

const LOCOMOTION = {
  baseSpeed: 0.6, speedGain: 2, maxSpeed: 3, surgeGain: 0.3, wander: 0,
  turnGain: 1.5, castGain: 1, castMin: 0.3, castMax: 1,
};
const CFG = { locomotion: LOCOMOTION, escape: { enabled: true, threshold: 0.4, distance: 1.5, cooldown: 2 }, backup: { threshold: 0.5, ticks: 10 } };

function env(stock = 0) {
  return {
    dt: 0.05, width: 1000, height: 1000,
    isWalkable: () => true,
    isStimulusCell: () => stock > 0,
    flowers: { stockAt: () => stock, cellOf: (cx, cy) => cy * 1000 + cx, consume: () => {}, regrow: () => {} },
    foodConfig: { eatSpeed: 0.5, feedThreshold: 0.1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
    energyConfig: { metabolism: 0.005, intake: 0.2 },
  };
}

function fly(heading = 0) {
  const f = { body: createBody({ x: 10.5, y: 10.5, heading }), energy: 0.3, bout: null, bouts: [], eating: false };
  initBodyLayerFly(f, 1);
  return f;
}

const pool = (drive) => ({ r: drive, rest: 0, drive });
function decoded(named = {}) {
  return {
    senses: { 'odour-food': { drive: 0, side: undefined, weight: 0, trend: 0, valence: 'approach' } },
    named: { forward: pool(0), backward: pool(0), alarm: pool(0), feed: pool(0), ...named },
  };
}

test('D30: on food with feed drive ≥ feedThreshold the fly eats, although baseSpeed exceeds eatSpeed', () => {
  const f = fly();
  const before = f.energy;
  const { eating } = stepBodyLayer(f, decoded({ feed: pool(0.2) }), CFG, env(1));
  assert.equal(eating, true);
  assert.equal(f.body.speed, 0, 'a feeding fly stands still for the tick');
  assert.deepEqual([f.body.x, f.body.y], [10.5, 10.5]);
  assert.ok(f.energy > before - 0.005 * 0.05, 'intake is applied');
});

test('D30: below feedThreshold, or off food, the fly walks on and does not eat', () => {
  assert.equal(stepBodyLayer(fly(), decoded({ feed: pool(0.05) }), CFG, env(1)).eating, false);
  assert.equal(stepBodyLayer(fly(), decoded({ feed: pool(1) }), CFG, env(0)).eating, false);
});

// ---- root cause 3: backing up rewrote the heading by π every tick ----

test('W14: backing up moves the fly backwards and leaves its heading unchanged for the whole run', () => {
  const f = fly(0.3);
  stepBodyLayer(f, decoded({ backward: pool(1) }), CFG, env());
  for (let t = 1; t < CFG.backup.ticks; t++) stepBodyLayer(f, decoded(), CFG, env());
  assert.equal(f.body.heading, 0.3);
  const travelled = CFG.backup.ticks * LOCOMOTION.baseSpeed * 0.05;
  assert.ok(Math.abs(f.body.x - (10.5 - Math.cos(0.3) * travelled)) < 1e-9);
  assert.ok(Math.abs(f.body.y - (10.5 - Math.sin(0.3) * travelled)) < 1e-9);
});

// ---- root cause 4: named pools were read raw, so one coincident spike in a 2-neuron pool fired escape ----

const SNAP = { sha256: 'abc', neuronCount: 12, senses: ['odour-danger'] };
const CHANNELS = [{ id: 'odour-danger-left', side: 'L' }, { id: 'odour-danger-right', side: 'R' }];
function decoderFile(pools) {
  return parseDecoder({
    snapshot: { sha256: 'abc' }, pools, valence: { 'odour-danger': 'avoid' }, homeostasis: { rest: {} },
  }, 'p', SNAP);
}

test('D29: a named pool rate is smoothed (τ = 3) before rest is subtracted', () => {
  const dec = decoderFile({ backward: [0, 1] });
  const state = createDecoderState(dec, CHANNELS);
  state.rest.backward = 0;
  const active = Float32Array.of(1, 1); // a sense is active, so rest stays frozen (D33)
  decodeTick(state, { spikes: new Uint32Array(0), inputs: active }, dec);
  const { named } = decodeTick(state, { spikes: Uint32Array.of(0, 1), inputs: active }, dec);
  assert.ok(Math.abs(named.backward.drive - 1 / 3) < 1e-9, `one all-pool spike after silence reads 1/3, got ${named.backward.drive}`);
});

test('D27 (amended): alarm reads the danger drive pool when the brain has one, not the diluted union', () => {
  const dec = decoderFile({ 'drive.odour-danger': [0, 1], alarm: [0, 1, 2, 3, 4, 5, 6, 7] });
  const state = createDecoderState(dec, CHANNELS);
  state.rest['drive.odour-danger'] = 0;
  state.rest.alarm = 0;
  const { senses, named } = decodeTick(state, { spikes: Uint32Array.of(0, 1), inputs: Float32Array.of(1, 1) }, dec);
  assert.equal(named.alarm.drive, senses['odour-danger'].drive);
  assert.equal(named.alarm.drive, 1);
});

test('D27 (Part L fallback): with no danger drive pool, alarm reads its union', () => {
  const dec = decoderFile({ alarm: [0, 1, 2, 3] });
  const state = createDecoderState(dec, CHANNELS);
  state.rest.alarm = 0;
  const { named } = decodeTick(state, { spikes: Uint32Array.of(0, 1), inputs: Float32Array.of(1, 1) }, dec);
  assert.equal(named.alarm.drive, 0.5);
});

// ---- D32: odour-food gainMin 0, as a world-config gain override ----

const FORAGER = fileURLToPath(pub('brains/forager-brain.brain'));
const SKIP = existsSync(FORAGER) ? false : 'public/brains/forager-brain.brain is absent';
function forager() {
  const b = readFileSync(FORAGER);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

test('D32: flies.modulators.hunger.gain replaces the snapshot gain, so a sated brain gets no food odour', { skip: SKIP }, () => {
  const snap = forager();
  const brain = createFlyBrain({ version: 'v1', snapshot: snap, stepsPerTick: 1, modulators: { hunger: { threshold: 0.4, gain: [0, 1.5] } } }, 7);
  brain.step({ inputs: Float32Array.from([0.6, 0.3, 0.2, 0.1]), hunger: 0.2 });
  const odour = snap.capabilities.channels.inputs.find((ch) => ch.id.startsWith('odour'));
  for (const neuron of odour.neurons) assert.equal(brain.lastDrive[neuron], 0);
});

test('D32: a gain override naming no snapshot modulator is refused', { skip: SKIP }, () => {
  assert.throws(
    () => createFlyBrain({ version: 'v1', snapshot: forager(), modulators: { thirst: { gain: [0, 1] } } }, 7),
    /declares no modulator "thirst"/,
  );
});

test('D32: flies.modulators.<id>.gain is validated', () => {
  const config = loadWorld('world-forager-demo.json');
  const withMods = (modulators) => validateConfig({ ...config, flies: { ...config.flies, modulators } });
  assert.deepEqual(withMods({ hunger: { threshold: 0.4, gain: [0, 1.5] }, 'hunger-taste': { gain: [0.1, 1.5] } }), []);
  assert.ok(withMods({ hunger: { gain: [1.5, 0] } }).some((e) => e.path === 'flies.modulators.hunger.gain'));
  assert.ok(withMods({ hunger: { gain: [-1, 1] } }).some((e) => e.path === 'flies.modulators.hunger.gain'));
  assert.ok(withMods({ 'hunger-taste': { threshold: 0.4 } }).some((e) => e.path === 'flies.modulators.hunger-taste.threshold'));
});

// ---- D27 (amended): readout candidate scope ----

test('C2 candidates: "descending" keeps DNs + named outputs; "non-input" is every neuron outside the input pools', () => {
  const snapshot = {
    manifest: { neurons: [
      { superclass: 'sensory', bodyId: 1 }, { superclass: 'descending_neuron', bodyId: 2 },
      { superclass: 'cb_intrinsic', bodyId: 3 }, { superclass: 'cb_intrinsic', bodyId: 4 },
    ] },
    capabilities: { channels: { inputs: [{ neurons: [0] }], outputs: [{ neurons: [3] }] } },
  };
  assert.deepEqual(candidateNeurons(snapshot).map((c) => c.index), [1, 3]);
  assert.deepEqual(candidateNeurons(snapshot, 'non-input').map((c) => c.index), [1, 2, 3]);
  assert.throws(() => candidateNeurons(snapshot, 'everything'), /unknown candidate scope/);
});

// ---- BUG-002: the eating area and the feed read ----

import { flowerAt } from '../public/js/fly/fly-world.js';

const GRID = { width: 10, height: 10, isStimulusCell: (cx, cy) => (cx === 5 && cy === 5) || (cx === 8 && cy === 5) };

test('flowerAt: reach 0 is the flower cell only; reach 1 is its 3×3 core, nearer flower first', () => {
  assert.equal(flowerAt(GRID, 5, 5, 0), 55);
  assert.equal(flowerAt(GRID, 6, 6, 0), -1);
  assert.equal(flowerAt(GRID, 6, 6, 1), 55);
  assert.equal(flowerAt(GRID, 7, 5, 1), 58, 'the flower at distance 1 wins over none further');
  assert.equal(flowerAt(GRID, 3, 5, 1), -1);
  assert.equal(flowerAt(GRID, 0, 0, 1), -1, 'edges are bounds-checked');
});

test('D30: a fly anywhere in the eating area eats from the flower cell stock', () => {
  const consumed = [];
  const e = env(1);
  e.foodConfig = { ...e.foodConfig, reach: 1 };
  e.isStimulusCell = (cx, cy) => cx === 10 && cy === 10;
  e.flowers = { ...e.flowers, stockAt: (cx, cy) => (cx === 10 && cy === 10 ? 1 : 0), consume: (cx, cy) => consumed.push([cx, cy]) };
  const f = fly();
  f.body.x = 11.5; // one cell east of the flower: inside the 3×3 core
  assert.equal(stepBodyLayer(f, decoded({ feed: pool(0.2) }), CFG, e).eating, true);
  assert.deepEqual(consumed, [[10, 10]]);
});

test('D30 (amended, A2): feed reads the taste-mouth drive pool when the brain has one', () => {
  const snap = { sha256: 'abc', neuronCount: 12, senses: ['taste-mouth'] };
  const dec = parseDecoder({
    snapshot: { sha256: 'abc' }, pools: { 'drive.taste-mouth': [0, 1], feed: [2, 3] }, valence: { 'taste-mouth': 'none' },
    homeostasis: { rest: { 'drive.taste-mouth': 0, feed: 0 } },
  }, 'p', snap);
  const state = createDecoderState(dec, [{ id: 'taste-mouth-left', side: 'L' }, { id: 'taste-mouth-right', side: 'R' }]);
  const { senses, named } = decodeTick(state, { spikes: Uint32Array.of(0, 1), inputs: Float32Array.of(1, 1) }, dec);
  assert.equal(named.feed.drive, senses['taste-mouth'].drive);
  assert.equal(named.feed.drive, 1);
});

test('flies.food.reach is validated', () => {
  const config = loadWorld('world-forager-demo.json');
  const withReach = (reach) => validateConfig({ ...config, flies: { ...config.flies, food: { ...config.flies.food, reach } } });
  assert.deepEqual(withReach(1), []);
  assert.ok(withReach(1.5).some((e) => e.path === 'flies.food.reach'));
  assert.ok(withReach(-1).some((e) => e.path === 'flies.food.reach'));
});

// ---- BUG-003: odour filters, water crossing, heat acts like danger ----

import { bilateralContrast, fieldBilinear } from '../public/js/fly/stimulus.js';

test('fieldBilinear: equals the cell value at a cell centre and blends between centres, clamped at edges', () => {
  const field = { width: 3, height: 1, fieldAt: (cx) => [0, 0.5, 1][cx] };
  assert.equal(fieldBilinear(field, 1.5, 0.5), 0.5);
  assert.equal(fieldBilinear(field, 2.0, 0.5), 0.75);
  assert.equal(fieldBilinear(field, 0.1, 0.5), 0, 'clamped to the first cell, not read off-grid');
});

test('bilateralContrast: lowers the shared level and widens the L/R difference, clamped to [0, 1]', () => {
  const out = bilateralContrast(0.8, 0.7, { common: 0.5, gain: 5 });
  assert.ok(Math.abs(out.left - 0.625) < 1e-9 && Math.abs(out.right - 0.125) < 1e-9);
  assert.deepEqual(bilateralContrast(1, 0, { common: 1, gain: 5 }), { left: 1, right: 0 });
  assert.deepEqual(bilateralContrast(0.4, 0.4, { common: 1, gain: 1 }), { left: 0.4, right: 0.4 }, 'common 1, gain 1 is a no-op');
});

test('crossWater: a v3 fly may move over water cells but still spawns on dry land; off by default', () => {
  const config = loadWorld('world-forager-demo.json');
  const logic = buildLogic(config, catalog);
  const water = logic.water.findIndex((w) => w === 1);
  const at = [water % logic.cols, Math.floor(water / logic.cols)];
  assert.equal(buildWorld(config, logic).walkable(...at), true);
  assert.equal(buildWorld(config, logic).dry(...at), false);
  const off = { ...config, flies: { ...config.flies, body: { ...config.flies.body, crossWater: false } } };
  assert.equal(buildWorld(off, logic).walkable(...at), false);
});

test('crossWater is validated: v3 only, boolean', () => {
  const config = loadWorld('world-forager-demo.json');
  const withBody = (patch) => validateConfig({ ...config, flies: { ...config.flies, body: { ...config.flies.body, ...patch } } });
  assert.ok(withBody({ crossWater: 'yes' }).some((e) => e.path === 'flies.body.crossWater'));
  assert.ok(withBody({ escape: { ...config.flies.body.escape, tau: 0.5 } }).some((e) => e.path === 'flies.body.escape.tau'));
  const stimuli = (spec) => validateConfig({ ...config, flies: { ...config.flies, stimuli: { ...config.flies.stimuli, 'odour:food': spec } } });
  assert.ok(stimuli({ from: 'edibles', contrast: { common: 0.5 } }).some((e) => e.path === 'flies.stimuli.odour:food.contrast'));
  assert.ok(stimuli({ from: 'edibles', interpolate: 1 }).some((e) => e.path === 'flies.stimuli.odour:food.interpolate'));
});

test('D27 (A3): alarm is the larger of the danger and heat drives', () => {
  const snap = { sha256: 'abc', neuronCount: 12, senses: ['odour-danger', 'heat'] };
  const dec = parseDecoder({
    snapshot: { sha256: 'abc' }, pools: { 'drive.odour-danger': [0, 1], 'drive.heat': [2, 3], alarm: [0, 1, 2, 3, 4, 5] },
    valence: { 'odour-danger': 'avoid', heat: 'avoid' }, homeostasis: { rest: { 'drive.odour-danger': 0, 'drive.heat': 0, alarm: 0 } },
  }, 'p', snap);
  const channels = ['odour-danger-left', 'odour-danger-right', 'heat-left', 'heat-right'].map((id) => ({ id, side: id.endsWith('left') ? 'L' : 'R' }));
  const state = createDecoderState(dec, channels);
  const { senses, named } = decodeTick(state, { spikes: Uint32Array.of(2, 3), inputs: Float32Array.of(0, 0, 1, 1) }, dec);
  assert.equal(named.alarm.drive, senses.heat.drive);
  assert.equal(named.alarm.drive, 1);
});

test('W14 escape.tau: the alarm is integrated before the threshold, so one high tick does not escape', () => {
  const cfg = { ...CFG, escape: { ...CFG.escape, threshold: 0.18, tau: 20 } };
  const f = fly();
  stepBodyLayer(f, decoded({ alarm: pool(1) }), cfg, env());
  assert.equal(f.body.escapeCooldown, 0, '1/20 of a full alarm is under the threshold');
  for (let t = 0; t < 5; t++) stepBodyLayer(f, decoded({ alarm: pool(1) }), cfg, env());
  assert.ok(f.body.escapeCooldown > 0, 'a sustained alarm escapes within a few ticks');
});

// ---- BUG-004: the motor stage (flies.body.motor) ----

const MOTOR = { maxTurnRate: 4, escapeTurnRate: 10, maxAccel: 6, sprintSpeed: 3 };
const MCFG = { ...CFG, motor: MOTOR, escape: { ...CFG.escape, threshold: 0.18, tau: 1 } };

test('motor: an escape turns at ≤ escapeTurnRate per second and sprints, never teleports', () => {
  const f = fly(0);
  const e = env();
  let maxTurn = 0;
  let maxStep = 0;
  for (let t = 0; t < 40; t++) {
    const [x, y, h] = [f.body.x, f.body.y, f.body.heading];
    stepBodyLayer(f, decoded({ alarm: pool(t === 0 ? 1 : 0) }), MCFG, e);
    maxTurn = Math.max(maxTurn, Math.abs(f.body.heading - h));
    maxStep = Math.max(maxStep, Math.hypot(f.body.x - x, f.body.y - y));
  }
  assert.ok(maxTurn <= MOTOR.escapeTurnRate * 0.05 + 1e-9, `turn per tick ${maxTurn}`);
  assert.ok(maxStep <= MOTOR.sprintSpeed * 0.05 + 1e-9, `step per tick ${maxStep}`);
  assert.ok(Math.abs(Math.cos(f.body.heading) + 1) < 1e-6, 'it ends facing away (π, no side pool)');
  assert.ok(f.body.x < 10.5 - 1, 'it has run away from where it faced');
});

test('motor: walking speed ramps at ≤ maxAccel, and feeding brakes instead of stopping dead', () => {
  const f = fly(0);
  stepBodyLayer(f, decoded(), MCFG, env());
  assert.ok(Math.abs(f.bodyLayer.velocity - MOTOR.maxAccel * 0.05) < 1e-9, 'one tick of acceleration from rest');
  for (let t = 0; t < 10; t++) stepBodyLayer(f, decoded(), MCFG, env());
  assert.ok(Math.abs(f.bodyLayer.velocity - LOCOMOTION.baseSpeed) < 1e-9, 'settles at baseSpeed');
  const e = env(1);
  stepBodyLayer(f, decoded({ feed: pool(1) }), MCFG, e);
  assert.ok(f.bodyLayer.velocity > 0 && f.bodyLayer.velocity < LOCOMOTION.baseSpeed, 'decelerating, not at 0');
});

test('motor: no eating while an escape sprint runs', () => {
  const f = fly(0);
  stepBodyLayer(f, decoded({ alarm: pool(1) }), MCFG, env());
  assert.ok(f.bodyLayer.sprintLeft > 0);
  assert.equal(stepBodyLayer(f, decoded({ feed: pool(1) }), MCFG, env(1)).eating, false);
});

test('flies.body.motor is validated: v3 only, every key a number > 0', () => {
  const config = loadWorld('world-forager-demo.json');
  const withMotor = (motor) => validateConfig({ ...config, flies: { ...config.flies, body: { ...config.flies.body, motor } } });
  assert.deepEqual(withMotor(MOTOR), []);
  assert.ok(withMotor({ ...MOTOR, maxAccel: 0 }).some((e) => e.path === 'flies.body.motor.maxAccel'));
  assert.ok(withMotor({ maxTurnRate: 4 }).some((e) => e.path === 'flies.body.motor.sprintSpeed'));
});

// ---- BUG-005: escape turn when the threat's side is unknown ----

test('escape.turn: with no side pool the escape heading turns by an angle in [min, max], either way', () => {
  const turn = { min: Math.PI / 2, max: (3 * Math.PI) / 4 };
  const cfg = { ...MCFG, escape: { ...MCFG.escape, turn } };
  const signs = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const f = { body: createBody({ x: 10.5, y: 10.5, heading: 0 }), energy: 0.3, bout: null, bouts: [], eating: false };
    initBodyLayerFly(f, seed);
    stepBodyLayer(f, decoded({ alarm: pool(1) }), cfg, env());
    const angle = f.bodyLayer.sprintHeading;
    assert.ok(Math.abs(angle) >= turn.min - 1e-9 && Math.abs(angle) <= turn.max + 1e-9, `turn ${angle}`);
    signs.add(Math.sign(angle));
  }
  assert.deepEqual([...signs].sort(), [-1, 1], 'both directions occur');
});

test('escape.turn absent: the escape reverses (π), the ADR 010 Edge Case', () => {
  const f = fly(0);
  stepBodyLayer(f, decoded({ alarm: pool(1) }), MCFG, env());
  assert.ok(Math.abs(f.bodyLayer.sprintHeading - Math.PI) < 1e-9);
});

test('escape.turn is validated', () => {
  const config = loadWorld('world-forager-demo.json');
  const withTurn = (turn) => validateConfig({ ...config, flies: { ...config.flies, body: { ...config.flies.body, escape: { ...config.flies.body.escape, turn } } } });
  assert.deepEqual(withTurn({ min: 1, max: 2 }), []);
  assert.ok(withTurn({ min: 2, max: 1 }).some((e) => e.path === 'flies.body.escape.turn'));
  assert.ok(withTurn({ min: 0, max: 4 }).some((e) => e.path === 'flies.body.escape.turn'));
});
