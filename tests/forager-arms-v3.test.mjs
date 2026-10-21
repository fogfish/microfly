// The "v3" and "random-matched-wide-v3" arms (ADR 010 Part K): both run against the same world and the same
// body-layer config OBJECT (reference-equal, not just value-equal) — the mechanical check behind "the body
// layer MUST be identical across every arm" (constitution VI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runForagerArms, armMetrics, verdicts } from '../scripts/forager-arms.mjs';
import { createFood } from '../public/js/fly/food.js';

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
const OUTPUT_DRIVES = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'];

function capabilities() {
  const inputs = INPUT_IDS.map((id, k) => ({ id, label: id, side: SIDE_OF[id], neurons: [k], range: [0, 1], sense: SENSE_OF[id], site: SITE_OF[id] }));
  const outputs = OUTPUT_DRIVES.map((drive, k) => ({ id: `out-${drive}`, label: drive, side: 'both', neurons: [INPUT_IDS.length + k], range: [0, 1], drive }));
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const NEURON_COUNT = INPUT_IDS.length + OUTPUT_DRIVES.length; // 18, no edges: a trivial (never-spiking) graph

function snapshotFixture() {
  return {
    version: 4, kind: 'forager-wide',
    neuronCount: NEURON_COUNT,
    offsets: new Uint32Array(NEURON_COUNT + 1),
    targets: new Uint32Array(0),
    weights: new Float64Array(0),
    capabilities: capabilities(),
  };
}

const WIDTH = 10;
function world() {
  return {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: () => false,
    stimulusCells: new Map(),
    dangerCells: new Map(),
  };
}

const F = {
  tickHz: 20,
  body: {
    maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
    sites: { antenna: { forward: 0, lateral: 0.5 }, mouth: { forward: 0, lateral: 0 }, 'front-leg': { forward: 0.5, lateral: 0.25 } },
    escape: { enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 },
    locomotion: { baseSpeed: 0.3, speedGain: 0, maxSpeed: 3, surgeGain: 0, wander: 0, turnGain: 0, castGain: 0, castMin: 1, castMax: 1 },
    backup: { threshold: 2, ticks: 5 },
  },
  food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9, consumption: true },
  stimuli: {
    'odour:food': { from: 'edibles', scaleBy: 'stock' },
    'odour:danger': { from: 'dangers', kinds: ['spider'] },
    heat: { from: 'dangers', kinds: ['lantern'] },
    taste: { from: 'edibles', scaleBy: 'stock', contact: true },
    touch: { from: 'blocked', contact: true },
  },
  brain: { version: 'v3', lif: {}, stepsPerTick: 1 },
};

function decoderFixture() {
  return { pools: { feed: [12 + 4], forward: [12 + 2], backward: [12 + 3], alarm: [12 + 5] }, valence: {}, homeostasis: { rest: {} } };
}

test('v3 and random-matched-wide-v3 run against the identical bodyLayerCfg object', () => {
  const w = world();
  const snapshot = snapshotFixture();
  const expConfig = { flies: F, seed: 1 };
  const result = runForagerArms({
    f: F, world: w, expConfig, snapshot, capabilities: capabilities(),
    arms: ['v3', 'random-matched-wide-v3'], seeds: [1], ticks: 2,
    decoders: { v3: decoderFixture(), 'random-matched-wide-v3': decoderFixture() },
  });
  assert.ok(result.v3.bodyLayerCfg, 'v3 arm should carry its bodyLayerCfg diagnostic');
  assert.equal(result.v3.bodyLayerCfg, result['random-matched-wide-v3'].bodyLayerCfg, 'the body layer config must be the identical object across arms');
  assert.equal(result.v3.bodyLayerCfg.locomotion, F.body.locomotion, 'must be the world config\'s own locomotion object, not a copy');
});

// T034/T037 (ADR 010 Part K): armMetrics and verdicts wire K1 (find-rate per cohort), K2 (feed within 50 ticks)
// and K4 (escape or turn within 20 ticks) for a v3-style arm, reported against the random walk and, when present,
// the random-matched-wide-v3 arm (K9). This exercises the metric wiring directly on synthetic per-fly records
// (feedRecords/dangerRecords) rather than a full closed-loop run, since the fixture's never-spiking graph above
// produces no real arrivals or encounters to measure.
function syntheticFly({ found, feedRecords, dangerRecords }) {
  return { found, startDistance: 10, firstContactTick: found ? 5 : null, bouts: [], contacts: 0, feedRecords, dangerRecords };
}

test('armMetrics/verdicts: K1/K2/K4 are computed per cohort and reported against the random walk', () => {
  const hungryFed = syntheticFly({
    found: true,
    feedRecords: [{ onFlower: false, eating: false }, { onFlower: true, eating: false }, { onFlower: true, eating: true }],
    dangerRecords: [{ distance: 5 }, { distance: 1 }, { distance: 2 }],
  });
  const hungryUnfed = syntheticFly({
    found: true,
    feedRecords: [{ onFlower: false, eating: false }, { onFlower: true, eating: false }],
    dangerRecords: [{ distance: 1 }, { distance: 1 }],
  });
  const result = {
    v3: { flies: [hungryFed, hungryUnfed], cohorts: { hungry: [hungryFed, hungryUnfed], sated: [syntheticFly({ found: false, feedRecords: [], dangerRecords: [] })] } },
    baseline: { flies: [syntheticFly({ found: false, feedRecords: undefined, dangerRecords: [{ distance: 1 }] })], cohorts: {} },
  };
  const metrics = armMetrics(['v3', 'baseline'], result, 2, 1);

  assert.equal(metrics.v3.feedWithin.arrivals, 2);
  assert.equal(metrics.v3.feedWithin.fed, 1);
  assert.equal(metrics.v3.feedWithin.rate, 0.5);
  assert.equal(metrics.v3.escapeWithin.encounters, 2);
  assert.equal(metrics.v3.escapeWithin.resolved, 1);
  assert.ok(Array.isArray(metrics.v3.findHungryCI));
  assert.ok(Array.isArray(metrics.v3.findSatedCI));

  const out = verdicts(metrics);
  const byMetric = Object.fromEntries(out.map((v) => [v.metric, v]));
  assert.ok('K2 feed within 50 ticks' in byMetric, 'K2 verdict must be reported');
  assert.equal(byMetric['K2 feed within 50 ticks'].pass, false, '50% feed-within is below the 80% SC-002 gate');
  assert.ok('K4 escape or turn within 20 ticks' in byMetric, 'K4 verdict must be reported');
  assert.equal(byMetric['K4 escape or turn within 20 ticks'].pass, false, '50% resolution is below the 90% SC-003 gate');
});

test('runForagerArms refuses a v3-style arm with no decoder supplied', () => {
  const w = world();
  const snapshot = snapshotFixture();
  const expConfig = { flies: F, seed: 1 };
  assert.throws(() => runForagerArms({
    f: F, world: w, expConfig, snapshot, capabilities: capabilities(),
    arms: ['v3'], seeds: [1], ticks: 2,
  }), /needs its own decoder-v1 object/);
});
