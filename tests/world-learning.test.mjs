// World config v3 learning additions (contracts/world-config-v3-learning.md, ADR 011): edibles[i].scent,
// flies.stimuli[s].scents, and the scent-filtered field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnvWide, senseForagerFlyWide, updateEventPulses } from '../public/js/fly/forager-step-wide.js';

const load = (file) => JSON.parse(readFileSync(new URL(`../public/world/${file}`, import.meta.url), 'utf8'));

test('rejects an edibles[i].scent value other than "fruit"/"floral"', () => {
  const c = load('world.json');
  c.edibles[0].scent = 'minty';
  const errors = validateConfig(c);
  const hit = errors.find((e) => e.path === 'edibles[0].scent');
  assert.ok(hit, 'no error on edibles[0].scent');
  assert.equal(hit.message, 'must be "fruit" or "floral"');
});

test('accepts "fruit" and "floral" on edibles[i].scent', () => {
  const c = load('world.json');
  c.edibles[0].scent = 'fruit';
  assert.equal(validateConfig(c).some((e) => e.path === 'edibles[0].scent'), false);
});

test('rejects a flies.stimuli[s].scents value other than "fruit"/"floral"', () => {
  const c = load('world-forager-wide.json');
  c.flies.stimuli['odour:food'] = { ...c.flies.stimuli['odour:food'], scents: ['minty'] };
  const errors = validateConfig(c);
  const hit = errors.find((e) => e.path === 'flies.stimuli.odour:food.scents');
  assert.ok(hit, 'no error on flies.stimuli.odour:food.scents');
});

// ---- scent-filtered field (forager-step-wide.js samplerFor) ----

const INPUT_IDS = ['food-a-left', 'food-a-right', 'food-b-left', 'food-b-right'];
const SENSE_OF = {
  'food-a-left': 'odour:food-a', 'food-a-right': 'odour:food-a',
  'food-b-left': 'odour:food-b', 'food-b-right': 'odour:food-b',
};
const SIDE_OF = { 'food-a-left': 'L', 'food-a-right': 'R', 'food-b-left': 'L', 'food-b-right': 'R' };

function capabilities() {
  const inputs = INPUT_IDS.map((id) => ({ id, label: id, side: SIDE_OF[id], range: [0, 1], sense: SENSE_OF[id], site: 'antenna' }));
  return { signals: ['spikes'], channels: { inputs, outputs: [] } };
}

const WIDTH = 20;
const FRUIT_IDX = 10 * WIDTH + 5;
const FLORAL_IDX = 10 * WIDTH + 15;

function scentedWorld() {
  const stimulusCells = new Map([
    [FRUIT_IDX, { kind: 'small', reach: 6, scent: 'fruit' }],
    [FLORAL_IDX, { kind: 'small', reach: 6, scent: 'floral' }],
  ]);
  const foodUnits = [...stimulusCells].map(([idx, cell]) => ({
    cellX: idx % WIDTH, cellY: Math.floor(idx / WIDTH),
    kernel: (cx, cy) => (Math.max(Math.abs(cx - (idx % WIDTH)), Math.abs(cy - Math.floor(idx / WIDTH))) <= 1 ? 1 : 0),
    scent: cell.scent,
  }));
  return {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: (cx, cy) => stimulusCells.has(cy * WIDTH + cx),
    stimulusCells, dangerCells: new Map(), foodUnits,
  };
}

const F_SCENTED = {
  tickHz: 20,
  body: { maxSpeed: 3, turnRate: 4, sites: { antenna: { forward: 0, lateral: 0 } } },
  food: { reach: 0 },
  stimuli: {
    'odour:food-a': { from: 'edibles', scents: ['fruit'], scaleBy: 'stock', interpolate: true },
    'odour:food-b': { from: 'edibles', scents: ['floral'], scaleBy: 'stock', interpolate: true },
  },
};

test('a scent-filtered field reads 0 at a flower of the other scent, normalised to [0, 1]', () => {
  const w = scentedWorld();
  const flowers = createFood(w, { food: { stock: 1, regrowth: 0 } });
  const e = forageEnvWide(F_SCENTED, w, flowers, capabilities());
  const atFruit = { body: { x: 5.5, y: 10.5, heading: 0 }, tick: 0, energy: 1 };
  const atFloral = { body: { x: 15.5, y: 10.5, heading: 0 }, tick: 0, energy: 1 };

  const k = (id) => INPUT_IDS.indexOf(id);
  const fruitSample = senseForagerFlyWide(atFruit, e).inputs;
  assert.ok(fruitSample[k('food-a-left')] > 0, 'odour:food-a should read the fruit flower');
  assert.equal(fruitSample[k('food-b-left')], 0, 'odour:food-b must read 0 at a fruit-only flower');
  assert.ok(fruitSample[k('food-a-left')] <= 1 && fruitSample[k('food-a-left')] >= 0);

  const floralSample = senseForagerFlyWide(atFloral, e).inputs;
  assert.ok(floralSample[k('food-b-left')] > 0, 'odour:food-b should read the floral flower');
  assert.equal(floralSample[k('food-a-left')], 0, 'odour:food-a must read 0 at a floral-only flower');
  assert.ok(floralSample[k('food-b-left')] <= 1 && floralSample[k('food-b-left')] >= 0);
});

// flies.brain.lif.pathwayGain (L11, ADR 011 D40): an object of routes in a world config, shape checked by lif-v1.js.
test('the learning world validates with its declared pathwayGain', () => {
  assert.deepEqual(validateConfig(load('world-forager-learning.json')), []);
});

test('rejects a world pathwayGain whose route names both a class and a type', () => {
  const c = load('world-forager-learning.json');
  c.flies.brain.lif.pathwayGain = { routes: [{ from: 'Kenyon_Cell', fromType: 'KCg-m', to: 'ALPN', gain: 1 }] };
  const hit = validateConfig(c).find((e) => e.path === 'flies.brain.lif');
  assert.ok(hit, 'no error on flies.brain.lif');
  assert.equal(hit.message, 'LIF parameter "pathwayGain" must be null or an object with routes');
});

test('rejects a world pathwayGain that is neither an object nor null', () => {
  const c = load('world-forager-learning.json');
  c.flies.brain.lif.pathwayGain = 3;
  const hit = validateConfig(c).find((e) => e.path === 'flies.brain.lif');
  assert.ok(hit, 'no error on flies.brain.lif');
  assert.equal(hit.message, 'LIF parameter "pathwayGain" must be null or an object with routes');
});

// ---- flies.stimuli[s].events (contracts/world-config-v3-learning.md, ADR 011) ----

test('rejects an unknown flies.stimuli[s].events value', () => {
  const c = load('world-forager-learning.json');
  c.flies.stimuli['reinforcement:punish'] = { ...c.flies.stimuli['reinforcement:punish'], events: ['party'] };
  const errors = validateConfig(c);
  const hit = errors.find((e) => e.path === 'flies.stimuli.reinforcement:punish.events');
  assert.ok(hit, 'no error on flies.stimuli.reinforcement:punish.events');
  assert.equal(hit.message, 'unknown event "party"');
});

test('accepts every declared event name, including eat:<scent>', () => {
  assert.deepEqual(validateConfig(load('world-forager-learning.json')), []);
  assert.deepEqual(validateConfig(load('world-forager-learning-tilemap.json')), []);
});

test('an eat:<scent> pulse lasts exactly pulseTicks ticks and then returns to 0', () => {
  const env = {
    stimuli: { 'reinforcement:punish': { from: 'events', events: ['eat:floral'], pulseTicks: 4 } },
    inputChannels: [],
  };
  const fly = {};
  updateEventPulses(fly, env, { eating: true, ateScent: 'floral', escapeStarted: false, inputs: [] });
  const on = [];
  for (let t = 0; t < 6; t++) {
    on.push(fly.eventPulses['reinforcement:punish'] > 0);
    updateEventPulses(fly, env, { eating: false, ateScent: null, escapeStarted: false, inputs: [] });
  }
  assert.deepEqual(on, [true, true, true, true, false, false]);
});

test('eating a flower of a different scent does not fire an eat:<scent> pulse', () => {
  const env = {
    stimuli: { 'reinforcement:punish': { from: 'events', events: ['eat:floral'], pulseTicks: 4 } },
    inputChannels: [],
  };
  const fly = {};
  updateEventPulses(fly, env, { eating: true, ateScent: 'fruit', escapeStarted: false, inputs: [] });
  assert.equal(fly.eventPulses['reinforcement:punish'], 0);
});

test('escape and heatContact events fire their own pair independently of eat', () => {
  const env = {
    stimuli: { 'reinforcement:punish': { from: 'events', events: ['escape', 'heatContact'], pulseTicks: 3 } },
    inputChannels: [{ id: 'heat-left', sense: 'heat' }, { id: 'heat-right', sense: 'heat' }],
  };
  const fly = {};
  updateEventPulses(fly, env, { eating: false, ateScent: null, escapeStarted: true, inputs: [0, 0] });
  assert.equal(fly.eventPulses['reinforcement:punish'], 3);

  const fly2 = {};
  updateEventPulses(fly2, env, { eating: false, ateScent: null, escapeStarted: false, inputs: [0.95, 0.95] });
  assert.equal(fly2.eventPulses['reinforcement:punish'], 3);

  const fly3 = {};
  updateEventPulses(fly3, env, { eating: false, ateScent: null, escapeStarted: false, inputs: [0, 0] });
  assert.equal(fly3.eventPulses['reinforcement:punish'], 0);
});
