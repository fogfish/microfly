// Body layer (ADR 010 Part E, W12–W14). v3 only. Pure function tests against a minimal fake env/flowers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody } from '../public/js/fly/body.js';
import { initBodyLayerFly, stepBodyLayer } from '../public/js/fly/body-layer.js';
import { createFood } from '../public/js/fly/food.js';

const LOCOMOTION = {
  baseSpeed: 0.6, speedGain: 2, maxSpeed: 3, surgeGain: 0.3, wander: 0,
  turnGain: 1.5, castGain: 1, castMin: 0.3, castMax: 1,
};
const ESCAPE = { enabled: true, threshold: 0.5, distance: 1.5, cooldown: 2 };
const BACKUP = { threshold: 0.5, ticks: 10 };

function fakeFlowers() {
  return {
    stockAt: () => 0,
    cellOf: (cx, cy) => cy * 1000 + cx,
    consume: () => {},
    regrow: () => {},
  };
}

function fakeEnv(overrides = {}) {
  return {
    dt: 0.05, width: 1000, height: 1000,
    isWalkable: () => true,
    isStimulusCell: () => false,
    flowers: fakeFlowers(),
    foodConfig: { eatSpeed: 0.5, feedThreshold: 0.5, consumeRate: 0.2, regrowth: 0.02 },
    energyConfig: { metabolism: 0.005, intake: 0.2 },
    ...overrides,
  };
}

function freshFly(heading = 0) {
  const fly = { body: createBody({ x: 10, y: 10, heading }), energy: 0.5, bout: null, bouts: [], eating: false };
  initBodyLayerFly(fly, 1);
  return fly;
}

const EMPTY_SENSE = { drive: 0, side: undefined, weight: 0, trend: 0, valence: 'none' };
function decoded(overrides = {}) {
  return {
    senses: { 'odour-food': { ...EMPTY_SENSE, valence: 'approach' }, ...overrides.senses },
    named: { forward: { r: 0, rest: 0, drive: 0 }, backward: { r: 0, rest: 0, drive: 0 }, alarm: { r: 0, rest: 0, drive: 0 }, feed: { r: 0, rest: 0, drive: 0 }, ...overrides.named },
  };
}

test('W12: the fly walks at baseSpeed with zero drive and no trend', () => {
  const fly = freshFly();
  const env = fakeEnv();
  stepBodyLayer(fly, decoded(), { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  assert.ok(Math.abs(fly.body.speed - LOCOMOTION.baseSpeed) < 1e-9, `expected baseSpeed, got ${fly.body.speed}`);
});

test('W12: speed is clamped at maxSpeed', () => {
  const fly = freshFly();
  const env = fakeEnv();
  const d = decoded({ named: { forward: { r: 1, rest: 0, drive: 1 } } });
  stepBodyLayer(fly, d, { locomotion: { ...LOCOMOTION, speedGain: 100 }, escape: ESCAPE, backup: BACKUP }, env);
  assert.ok(fly.body.speed <= LOCOMOTION.maxSpeed, `speed ${fly.body.speed} should be clamped to maxSpeed`);
});

test('W12: a rising approach trend surges speed above the base formula', () => {
  const fly = freshFly();
  const env = fakeEnv();
  const base = decoded();
  const surging = decoded({ senses: { 'odour-food': { ...EMPTY_SENSE, valence: 'approach', trend: 1 } } });
  const flyBase = freshFly();
  stepBodyLayer(flyBase, base, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, fakeEnv());
  stepBodyLayer(fly, surging, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  assert.ok(fly.body.speed > flyBase.body.speed, `surging speed ${fly.body.speed} should exceed base ${flyBase.body.speed}`);
});

test('W13: a left-side food source (approach, side > 0) turns the fly left (heading decreases)', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({ senses: { 'odour-food': { drive: 0.5, side: 0.8, weight: 0.9, trend: 0, valence: 'approach' } } });
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  assert.ok(fly.body.heading < 0, `expected a left turn (heading < 0), got ${fly.body.heading}`);
});

test('W13: a right-side food source (approach, side < 0) turns the fly right (heading increases)', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({ senses: { 'odour-food': { drive: 0.5, side: -0.8, weight: 0.9, trend: 0, valence: 'approach' } } });
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  assert.ok(fly.body.heading > 0, `expected a right turn (heading > 0), got ${fly.body.heading}`);
});

test('W13: klinotaxis alone carries steering when a sense has no side pool (side absent)', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  // side is absent (undefined): tropotaxis contributes 0, but a nonzero trend still shapes cast (speed/noise),
  // and heading does not move from tropotaxis for this sense.
  const d = decoded({ senses: { 'odour-food': { drive: 0.5, side: undefined, weight: 0.9, trend: 0.5, valence: 'approach' } } });
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  // With wander 0, heading change comes only from `turn`, which is 0 when side is absent.
  assert.equal(fly.body.heading, 0);
});

test('W14: escape jumps away from the side a danger pool points to', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({ senses: { 'odour-danger': { drive: 0.5, side: 0.9, weight: 0.9, trend: 0, valence: 'avoid' } }, named: { alarm: { r: 0.9, rest: 0, drive: 0.9 } } });
  const before = { x: fly.body.x, y: fly.body.y };
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  const moved = Math.hypot(fly.body.x - before.x, fly.body.y - before.y);
  assert.ok(moved > 1, `expected an escape jump, moved only ${moved}`);
  // Danger on the left (side > 0) from heading 0 (east): escaping away means turning right (south, +y).
  assert.ok(fly.body.y > before.y, `expected to jump south (away from left danger), y went from ${before.y} to ${fly.body.y}`);
});

test('W14: escape falls back to backward when neither side pool exists', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({ named: { alarm: { r: 0.9, rest: 0, drive: 0.9 } } });
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  // Backward from heading 0 is heading PI; the escape jump moves along the (possibly re-set) heading.
  assert.ok(Math.abs(fly.body.heading - Math.PI) < 1e-9, `expected heading PI (backward), got ${fly.body.heading}`);
});

test('W14: the no-drive.odour-danger-pool fallback (alarm from the named escape pool + drive.heat) still triggers an escape', () => {
  // ADR 010 Part L / spec Edge Case: when C2 finds no reliable drive.odour-danger pool, decoder-engine.mjs writes
  // `alarm` as the union of the named escape output and drive.heat alone (decoder-engine.mjs lines 252-263) —
  // body-layer.js never sees which pools fed `alarm`, so the escape trigger (named.alarm.drive) and the jump
  // direction (escapeHeading's side fallback chain) must still work with no `odour-danger` sense present at all.
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({
    senses: { heat: { drive: 0.6, side: 0.9, weight: 0.9, trend: 0, valence: 'avoid' } },
    named: { alarm: { r: 0.9, rest: 0, drive: 0.9 } },
  });
  const before = { x: fly.body.x, y: fly.body.y };
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }, env);
  const moved = Math.hypot(fly.body.x - before.x, fly.body.y - before.y);
  assert.ok(moved > 1, `expected an escape jump, moved only ${moved}`);
  // Heat on the left (side > 0) from heading 0 (east): escaping away means turning right (south, +y), same
  // convention as the odour-danger case above — escapeHeading falls back to heat's side when odour-danger is absent.
  assert.ok(fly.body.y > before.y, `expected to jump south (away from left heat), y went from ${before.y} to ${fly.body.y}`);
});

test('W14: backing up reverses for backup.ticks ticks', () => {
  const fly = freshFly(0);
  const env = fakeEnv();
  const d = decoded({ named: { backward: { r: 0.9, rest: 0, drive: 0.9 } } });
  const before = { x: fly.body.x, y: fly.body.y };
  stepBodyLayer(fly, d, { locomotion: LOCOMOTION, escape: { ...ESCAPE, enabled: false }, backup: BACKUP }, env);
  assert.equal(fly.bodyLayer.backupTicksLeft, BACKUP.ticks - 1);
  // Moved backward (negative x direction from heading 0 reversed to PI).
  assert.ok(fly.body.x < before.x, `expected to move backward (x decreasing), got ${fly.body.x} from ${before.x}`);
});

// Spec 018 US2/US3 (contracts/world-config-food-feeding.md, "Motor-control placement"): a real food table with one
// small flower under the fly at (10, 10). `food` is merged into flies.food (capacity, recovery, feedMotion, …).
const FLOWER = 10 * 1000 + 10;
function feedingEnv(food = {}) {
  const w = { width: 1000, height: 1000, stimulusCells: new Map([[FLOWER, { kind: 'small', reach: 0 }]]) };
  const foodConfig = { eatSpeed: 0.5, feedThreshold: 0.5, sated: 0.9, consumeRate: 0.2, regrowth: 0.02, stock: 1, consumption: true, ...food };
  return fakeEnv({
    isStimulusCell: (cx, cy) => cy * 1000 + cx === FLOWER,
    flowers: createFood(w, { food: foodConfig }),
    foodConfig,
  });
}
const FEED_ON = decoded({ named: { feed: { r: 1, rest: 0, drive: 1 } } });
const CFG = { locomotion: LOCOMOTION, escape: { ...ESCAPE, enabled: false }, backup: BACKUP };

test('spec 018 US3: feedMotion "pause" (the default) holds the feeding fly at speed 0 for the whole bout', () => {
  for (const food of [{}, { feedMotion: 'pause' }]) {
    const fly = freshFly();
    const env = feedingEnv(food);
    for (let t = 0; t < 10; t++) {
      stepBodyLayer(fly, FEED_ON, CFG, env);
      assert.equal(fly.body.speed, 0, `eating tick ${t} with ${JSON.stringify(food)}`);
    }
  }
});

test('spec 018 US3: feedMotion "slow" holds the feeding fly at feedSlowSpeed for the whole bout', () => {
  const fly = freshFly();
  const env = feedingEnv({ feedMotion: 'slow', feedSlowSpeed: 0.1 });
  for (let t = 0; t < 10; t++) {
    stepBodyLayer(fly, FEED_ON, CFG, env);
    assert.ok(Math.abs(fly.body.speed - 0.1) < 1e-9, `eating tick ${t}: speed ${fly.body.speed}`);
  }
});

test('spec 018 US3: normal locomotion resumes the tick the bout closes, for both feed motions', () => {
  for (const food of [{ feedMotion: 'pause' }, { feedMotion: 'slow', feedSlowSpeed: 0.1 }]) {
    const fly = freshFly();
    const env = feedingEnv(food);
    stepBodyLayer(fly, FEED_ON, CFG, env);
    stepBodyLayer(fly, decoded(), CFG, env);
    assert.ok(Math.abs(fly.body.speed - LOCOMOTION.baseSpeed) < 1e-9, `${JSON.stringify(food)}: speed ${fly.body.speed}`);
  }
});

// Spec 018 US2: with capacity, eating drains a flower continuously, as the legacy model does; a partly eaten flower is
// not refilled by the body layer, and an empty one is charged nothing more.
test('spec 018 US2: with capacity, the body layer drains the flower while the fly feeds, no lump at bout close', () => {
  const fly = freshFly();
  const env = feedingEnv({ capacity: { small: 1, medium: 2, large: 3 }, recovery: 30 });
  for (let t = 0; t < 60; t++) stepBodyLayer(fly, FEED_ON, CFG, env);
  assert.ok(Math.abs(env.flowers.stockAt(10, 10) - (1 - 60 * 0.2 * 0.05)) < 1e-9, 'drained by consumeRate × dt per tick');
  stepBodyLayer(fly, decoded(), CFG, env);
  assert.equal(fly.bouts.at(-1).endedBy, 'sated', 'energy reached satiation, so the bout closes sated');
  assert.ok(Math.abs(env.flowers.stockAt(10, 10) - 0.4) < 1e-9, 'no extra charge at close');
});

// ADR 011 D53 (contracts/world-config-v3-learning.md "flies.food.feedTau"): the eating reflex integrates the decoded
// feed drive over feedTau ticks before comparing it with feedThreshold, as escape.tau does for alarm (BUG-003).
const FEED_OFF = decoded({ named: { feed: { r: 0, rest: 0, drive: 0 } } });

test('D53: without feedTau the reflex gates on the drive itself, so one quiet tick ends the bout', () => {
  const fly = freshFly();
  const env = feedingEnv({ feedThreshold: 0.1 });
  assert.equal(stepBodyLayer(fly, FEED_ON, CFG, env).eating, true);
  assert.equal(stepBodyLayer(fly, FEED_OFF, CFG, env).eating, false);
  assert.equal(fly.bodyLayer.feed, 0, 'tau 1 takes the drive itself');
});

test('D53: with feedTau a bout outlasts a drive that falls silent, and ends once the integral decays', () => {
  const fly = freshFly();
  const env = feedingEnv({ feedThreshold: 0.1, feedTau: 10 });
  // One tick of drive 1 lifts the integral to 1/10 = feedThreshold, so the fly eats on that tick.
  assert.equal(stepBodyLayer(fly, FEED_ON, CFG, env).eating, true);
  for (let t = 0; t < 5; t++) stepBodyLayer(fly, FEED_ON, CFG, env);
  const peak = fly.bodyLayer.feed;
  // The drive drops to 0 (the taste pool adapts, L2): the integral decays by (1 − 1/10) per tick.
  let held = 0;
  while (stepBodyLayer(fly, FEED_OFF, CFG, env).eating) held++;
  assert.equal(held, Math.floor(Math.log(0.1 / peak) / Math.log(0.9)), 'eats until peak × 0.9^k < feedThreshold');
  assert.ok(held > 0, 'the bout holds through the silent drive');
  assert.equal(fly.bouts.length, 1, 'one bout, not one per tick');
});

test('D53: the integral starts from 0, so a weak drive below feedThreshold never starts a bout', () => {
  const fly = freshFly();
  const env = feedingEnv({ feedThreshold: 0.1, feedTau: 10 });
  const weak = decoded({ named: { feed: { r: 0.05, rest: 0, drive: 0.05 } } });
  for (let t = 0; t < 200; t++) assert.equal(stepBodyLayer(fly, weak, CFG, env).eating, false, `tick ${t}`);
});
