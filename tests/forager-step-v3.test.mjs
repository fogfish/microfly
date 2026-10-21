// End-to-end synchronous "v3" tick (sense → brain.step → decode → body-layer → motor), parallel to
// forager-step-wide.test.mjs, confirming the decoder and body layer are wired into the per-tick path
// (stepForagerFlyV3) and not just unit-testable in isolation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFood } from '../public/js/fly/food.js';
import { forageEnvWide, stepForagerFlyV3 } from '../public/js/fly/forager-step-wide.js';
import { createDecoderState, parseDecoder } from '../public/js/fly/decoder.js';
import { initBodyLayerFly } from '../public/js/fly/body-layer.js';

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
const FLOWER_IDX = 10 * WIDTH + 11;

function world() {
  const stimulusCells = new Map([[FLOWER_IDX, { kind: 'small', reach: 6 }]]);
  return {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: (cx, cy) => stimulusCells.has(cy * WIDTH + cx),
    stimulusCells, dangerCells: new Map(),
  };
}

const F = {
  tickHz: 20,
  body: {
    maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
    sites: { antenna: { forward: 0, lateral: 0.5 }, mouth: { forward: 0, lateral: 0 }, 'front-leg': { forward: 0.5, lateral: 0.25 } },
    escape: { enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 },
  },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, consumption: true },
  stimuli: {
    'odour:food': { from: 'edibles', scaleBy: 'stock', radius: 6 },
    'odour:danger': { from: 'dangers', kinds: ['spider'], radius: 4 },
    heat: { from: 'dangers', kinds: ['lantern'], radius: 3 },
    taste: { from: 'edibles', scaleBy: 'stock', contact: true },
    touch: { from: 'blocked', contact: true },
  },
};

const LOCOMOTION = { baseSpeed: 0.6, speedGain: 0, maxSpeed: 3, surgeGain: 0, wander: 0, turnGain: 1.5, castGain: 0, castMin: 1, castMax: 1 };
const BODY_LAYER_CFG = { locomotion: LOCOMOTION, escape: { enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 }, backup: { threshold: 2, ticks: 5 } };

function env() {
  const w = world();
  const flowers = createFood(w, F);
  return { ...forageEnvWide(F, w, flowers, capabilities()), flowers, foodConfig: F.food, energyConfig: F.body.energy };
}

function decoderFixture() {
  const file = {
    format: 'decoder', version: 1,
    snapshot: { file: 'x.brain', sha256: 'abc' },
    lif: {}, probe: { seeds: [1], heldBack: 2, ticks: 10, rule: 'D27' },
    pools: {
      'side.odour-food.L': [0], 'side.odour-food.R': [1],
      'drive.odour-food': [0, 1],
      forward: [2],
    },
    valence: { 'odour-food': 'approach' },
    homeostasis: { rest: {} },
    provenance: {},
  };
  return parseDecoder(file, 'p', { sha256: 'abc', neuronCount: 10, senses: ['odour-food'] });
}

// A fake brain whose step() fires neuron 0 (the left food-selective pool) whenever the left food input is
// present, exercising the real wire: sense → spikes → decodeTick → stepBodyLayer, not a mocked decode.
function fakeBrain() {
  let tick = 0;
  return {
    step({ inputs }) {
      const leftFood = inputs[INPUT_IDS.indexOf('odour-food-left')];
      const rightFood = inputs[INPUT_IDS.indexOf('odour-food-right')];
      const spikes = [];
      if (leftFood > rightFood) spikes.push(0);
      else if (rightFood > leftFood) spikes.push(1);
      return { tick: tick++, inputs: Float32Array.from(inputs), outputs: new Float32Array(6), spikes: Uint32Array.from(spikes.sort()) };
    },
  };
}

function freshFly(x, y) {
  const fly = { body: { x, y, heading: 0, cell: `${Math.floor(x)},${Math.floor(y)}`, contacts: 0 }, tick: 0, energy: 0.5, bout: null, bouts: [], eating: false };
  initBodyLayerFly(fly, 1);
  return fly;
}

test('stepForagerFlyV3 wires sense, brain, decode and body-layer into one tick', () => {
  const e = env();
  const decoder = decoderFixture();
  const fly = freshFly(9.5, 10.5); // west of the flower (FLOWER_IDX at x=11, y=10)
  const state = createDecoderState(decoder, e.inputChannels);
  const result = stepForagerFlyV3(fly, e, fakeBrain(), state, decoder, BODY_LAYER_CFG);
  assert.ok(result.decoded.senses['odour-food'], 'the decoded signal for odour-food must be present');
  assert.equal(fly.tick, 1, 'the tick counter must advance exactly once');
});

test('a food source on the fly\'s left makes the decoded side_food positive and the fly turns left', () => {
  const e = env();
  const decoder = decoderFixture();
  // East-facing fly, flower to the northeast (closer to the left/antenna-offset side): left antenna reads more.
  const fly = freshFly(9.5, 11.5);
  const state = createDecoderState(decoder, e.inputChannels);
  const { decoded } = stepForagerFlyV3(fly, e, fakeBrain(), state, decoder, BODY_LAYER_CFG);
  assert.ok(decoded.senses['odour-food'].side > 0, `expected positive side, got ${decoded.senses['odour-food'].side}`);
  assert.ok(fly.body.heading < 0, `expected the fly to turn left (heading < 0), got ${fly.body.heading}`);
});
