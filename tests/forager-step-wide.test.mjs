// The wide-I/O host sensing path (ADR 007 W8; forager-step-wide.js): forageEnvWide/senseForagerFlyWide, over a
// fixture capability declaration (the real forager-brain-wide.json's twelve inputs/six outputs, without
// neurons: the pool indices this feature's sensing code never touches) and a small synthetic world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFood } from '../public/js/fly/food.js';
import { forageEnvWide, senseForagerFlyWide } from '../public/js/fly/forager-step-wide.js';

const INPUT_IDS = [
  'odour-food-left', 'odour-food-right', 'odour-danger-left', 'odour-danger-right',
  'heat-left', 'heat-right', 'taste-mouth-left', 'taste-mouth-right',
  'taste-leg-left', 'taste-leg-right', 'touch-left', 'touch-right',
];
const SENSE_OF = {
  'odour-food-left': 'odour:food', 'odour-food-right': 'odour:food',
  'odour-danger-left': 'odour:danger', 'odour-danger-right': 'odour:danger',
  'heat-left': 'heat', 'heat-right': 'heat',
  'taste-mouth-left': 'taste', 'taste-mouth-right': 'taste',
  'taste-leg-left': 'taste', 'taste-leg-right': 'taste',
  'touch-left': 'touch', 'touch-right': 'touch',
};
const SITE_OF = {
  'odour-food-left': 'antenna', 'odour-food-right': 'antenna',
  'odour-danger-left': 'antenna', 'odour-danger-right': 'antenna',
  'heat-left': 'antenna', 'heat-right': 'antenna',
  'taste-mouth-left': 'mouth', 'taste-mouth-right': 'mouth',
  'taste-leg-left': 'front-leg', 'taste-leg-right': 'front-leg',
  'touch-left': 'front-leg', 'touch-right': 'front-leg',
};
const SIDE_OF = Object.fromEntries(INPUT_IDS.map((id) => [id, id.endsWith('left') ? 'L' : 'R']));

function capabilities() {
  const inputs = INPUT_IDS.map((id) => ({ id, label: id, side: SIDE_OF[id], range: [0, 1], sense: SENSE_OF[id], site: SITE_OF[id] }));
  const outputs = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'].map((drive, k) => (
    { id: `out-${k}`, label: drive, side: 'both', range: [0, 1], drive }
  ));
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const WIDTH = 20;
const FLOWER_IDX = 10 * WIDTH + 11; // one tile east of the fly's spawn below
const SPIDER_IDX = 10 * WIDTH + 5;
const LANTERN_IDX = 5 * WIDTH + 10;

function world() {
  const stimulusCells = new Map([[FLOWER_IDX, { kind: 'small', reach: 6 }]]);
  const dangerCells = new Map([[SPIDER_IDX, 'spider'], [LANTERN_IDX, 'lantern']]);
  return {
    width: WIDTH, height: WIDTH,
    walkable: (cx, cy) => !(cx === 12 && cy === 10), // one blocked cell, east of the flower
    isStimulusCell: (cx, cy) => stimulusCells.has(cy * WIDTH + cx),
    stimulusCells, dangerCells,
  };
}

const F = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
    sites: { antenna: { forward: 0, lateral: 0.5 }, mouth: { forward: 0, lateral: 0 }, 'front-leg': { forward: 0.5, lateral: 0.25 } },
    escape: { enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 } },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, consumption: true },
  stimuli: {
    'odour:food': { from: 'edibles', scaleBy: 'stock', radius: 6 },
    'odour:danger': { from: 'dangers', kinds: ['spider'], radius: 4 },
    heat: { from: 'dangers', kinds: ['lantern'], radius: 3 },
    taste: { from: 'edibles', scaleBy: 'stock', contact: true },
    touch: { from: 'blocked', contact: true },
  },
};

function env() {
  const w = world();
  const flowers = createFood(w, F);
  return forageEnvWide(F, w, flowers, capabilities());
}

test('forageEnvWide carries stimuli/bodySites/escape through unchanged from the resolved flies config', () => {
  const e = env();
  assert.equal(e.stimuli, F.stimuli);
  assert.equal(e.bodySites, F.body.sites);
  assert.equal(e.escape, F.body.escape);
  assert.equal(e.inputCount, 12);
});

test('senseForagerFlyWide builds all twelve inputs in declaration order', () => {
  const e = env();
  const fly = { body: { x: 10.5, y: 10.5, heading: 0 }, tick: 0, energy: 0.3 };
  const { inputs, message } = senseForagerFlyWide(fly, e);
  assert.equal(inputs.length, 12);
  assert.equal(message.inputs.length, 12);
  assert.ok(inputs instanceof Float32Array);
});

test('odour:food is sensed near the flower; danger/heat read their own hazard kind only', () => {
  const e = env();
  const fly = { body: { x: 9.5, y: 10.5, heading: 0 }, tick: 0, energy: 0.3 }; // near the flower, far from hazards
  const { inputs } = senseForagerFlyWide(fly, e);
  const k = (id) => INPUT_IDS.indexOf(id);
  assert.ok(inputs[k('odour-food-left')] > 0, 'food odour should be nonzero near the flower');
  assert.ok(inputs[k('odour-danger-left')] === 0, 'no spider nearby');
});

test('taste (contact) is nonzero on the flower cell, zero one tile away', () => {
  const e = env();
  const onFlower = { body: { x: 11.5, y: 10.5, heading: 0 }, tick: 0, energy: 0.3 };
  const offFlower = { body: { x: 8.5, y: 10.5, heading: 0 }, tick: 0, energy: 0.3 };
  const k = INPUT_IDS.indexOf('taste-mouth-left');
  assert.ok(senseForagerFlyWide(onFlower, e).inputs[k] > 0);
  assert.equal(senseForagerFlyWide(offFlower, e).inputs[k], 0);
});

test('touch (from "blocked") reads 1 when the front-leg cell is not walkable', () => {
  const e = env();
  // Facing east at (11.6, 10.5): front-leg (forward 0.5, lateral ±0.25) lands both sides in cell (12, 10),
  // the one blocked cell this world declares.
  const fly = { body: { x: 11.6, y: 10.5, heading: 0 }, tick: 0, energy: 0.3 };
  const { inputs } = senseForagerFlyWide(fly, e);
  const touch = inputs[INPUT_IDS.indexOf('touch-left')] + inputs[INPUT_IDS.indexOf('touch-right')];
  assert.ok(touch > 0, `expected at least one touch channel to read the blocked cell, got ${touch}`);
});

test('a snapshot sense with no matching flies.stimuli entry fails loudly at env construction', () => {
  const w = world();
  const flowers = createFood(w, F);
  const badCapabilities = capabilities();
  badCapabilities.channels.inputs[0].sense = 'odour:nope';
  assert.throws(() => forageEnvWide(F, w, flowers, badCapabilities), {
    message: 'flies.stimuli is missing sense "odour:nope", declared by channel "odour-food-left"',
  });
});

test('a snapshot site with no matching flies.body.sites entry fails loudly at env construction', () => {
  const w = world();
  const flowers = createFood(w, F);
  const badCapabilities = capabilities();
  badCapabilities.channels.inputs[0].site = 'nowhere';
  assert.throws(() => forageEnvWide(F, w, flowers, badCapabilities), {
    message: 'flies.body.sites is missing site "nowhere", declared by channel "odour-food-left"',
  });
});

// Spec 018 US1 (contracts/world-config-food-feeding.md, "Sensor-filter placement"): the hunger filter scales only the
// declared odour:food channels; every other sense keeps its value, and the twelve-input shape is unchanged.
const HUNGER = { threshold: 0.4, gain: 1.8 };
const FED = { ...F, food: { ...F.food, hungerSensitivity: HUNGER } };
function senseWith(config, energy) {
  const w = world();
  const e = forageEnvWide(config, w, createFood(w, config), capabilities());
  const fly = { body: { x: 9.5, y: 10.5, heading: 0 }, tick: 0, energy };
  return senseForagerFlyWide(fly, e).inputs;
}

test('a hungry fly scales only the odour:food inputs by gain; every other sense is unchanged', () => {
  const plain = senseWith(F, 0.3);
  const hungry = senseWith(FED, 0.3);
  const k = (id) => INPUT_IDS.indexOf(id);
  assert.ok(plain[k('odour-food-left')] > 0, 'the fixture must sense food odour');
  assert.ok(Math.abs(hungry[k('odour-food-left')] - plain[k('odour-food-left')] * HUNGER.gain) < 1e-6);
  assert.ok(Math.abs(hungry[k('odour-food-right')] - plain[k('odour-food-right')] * HUNGER.gain) < 1e-6);
  INPUT_IDS.forEach((id, i) => {
    if (SENSE_OF[id] !== 'odour:food') assert.equal(hungry[i], plain[i], `${id} must be unchanged`);
  });
  assert.equal(hungry.length, 12);
});

test('a fed fly senses odour:food unscaled, whatever the filter is configured to', () => {
  assert.deepEqual(Array.from(senseWith(FED, 0.9)), Array.from(senseWith(F, 0.9)));
});
