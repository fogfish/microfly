// startFlies dispatch (fly-host.js): a "v2" world's forager flies sense through senseForagerFlyWide/
// forageEnvWide, not the v1 functions; a "v1" world is unaffected (regression guard). No real browser: Worker,
// document and requestAnimationFrame are stubbed to the minimum startFlies needs, and the animation loop is
// driven by hand (one captured frame callback) instead of real timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- Minimal browser stubs, installed before importing fly-host.js (it reads `document` at module load for
// the visibility-clock helper, and `Worker`/`requestAnimationFrame` when startFlies runs). ---
let pumpCallback = null;
let workers = [];

class FakeWorker {
  constructor() {
    this.sent = [];
    this.onmessage = null;
    this.onerror = null;
    workers.push(this);
  }

  postMessage(msg) {
    this.sent.push(msg);
  }

  terminate() {}
}

globalThis.document = { hidden: false, addEventListener() {} };
globalThis.requestAnimationFrame = (cb) => { pumpCallback = cb; };
globalThis.Worker = FakeWorker;

const { startFlies } = await import('../public/js/fly/fly-host.js');

const WIDTH = 20;
function world() {
  return {
    width: WIDTH, height: WIDTH,
    walkable: () => true,
    isStimulusCell: () => false,
    stimulusCells: new Map(),
    dangerCells: new Map(),
  };
}

function fly(id = 0) {
  return {
    id, mode: 'toy', sprite: 'fly-female', brainSeed: 7,
    body: { x: 10.5, y: 10.5, heading: 0, cell: '10,10', contacts: 0 },
    motor: { left: 0, right: 0 }, sensory: 0, tick: 0,
  };
}

function wideSnapshot() {
  const inputs = [
    { id: 'odour-food-left', label: 'L', side: 'L', neurons: [0], range: [0, 1], sense: 'odour:food', site: 'antenna' },
    { id: 'odour-food-right', label: 'R', side: 'R', neurons: [1], range: [0, 1], sense: 'odour:food', site: 'antenna' },
  ];
  const outputs = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'].map((drive, k) => (
    { id: `out-${k}`, label: drive, side: 'both', neurons: [2 + k], range: [0, 1], drive }
  ));
  const neuronCount = 8;
  return {
    url: 'snapshot://wide', release: 'synthetic', createdAt: 'now', neuronCount,
    capabilities: { signals: ['spikes'], channels: { inputs, outputs } },
    neurons: Array.from({ length: neuronCount }, () => ({ soma: null, superclass: null, origin: null, transmitter: null, bodyId: null, type: null, class: null })),
    provenance: {}, fidelity: null,
  };
}

function v1Snapshot() {
  const inputs = ['odour-left', 'odour-right', 'taste-left', 'taste-right'].map((id, k) => (
    { id, label: id, side: k % 2 ? 'R' : 'L', neurons: [k], range: [0, 1] }
  ));
  const outputs = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed'].map((drive, k) => (
    { id: `out-${k}`, label: drive, side: 'both', neurons: [4 + k], range: [0, 1], drive }
  ));
  const neuronCount = 9;
  return {
    url: 'snapshot://v1', release: 'synthetic', createdAt: 'now', neuronCount,
    capabilities: { signals: ['spikes'], channels: { inputs, outputs } },
    neurons: Array.from({ length: neuronCount }, () => ({ soma: null, superclass: null, origin: null, transmitter: null, bodyId: null, type: null, class: null })),
    provenance: {}, fidelity: null,
  };
}

// Drives one dispatch pass for a running forager fly and returns the sense message its worker received.
function senseMessageOf(config, snapshot) {
  workers = [];
  pumpCallback = null;
  const records = startFlies({
    config, world: world(), flies: [fly()], onUpdate() {}, snapshot,
  });
  assert.equal(workers.length, 1);
  // The host only dispatches once the worker replies "ready".
  workers[0].onmessage({ data: { type: 'ready' } });
  assert.ok(pumpCallback, 'startFlies should have scheduled a pump via requestAnimationFrame');
  // pump() only dispatches once real time has passed tick 0's due instant (tick 0 >= due 0 otherwise); a short
  // busy-wait stands in for the animation-frame delay a real browser tick would have.
  const until = performance.now() + 60;
  while (performance.now() < until);
  pumpCallback();
  // sent[0] is the init message (posted by startWorker before "ready"); sent[1] is the first sense message.
  assert.equal(workers[0].sent.length, 2, 'an init message, then one sense message, should have been posted');
  return { message: workers[0].sent[1], records };
}

test('a "v2" world dispatches senseForagerFlyWide (12 inputs), not senseForagerFly (4)', () => {
  const config = {
    flies: {
      count: 1, mode: 'toy', tickHz: 20, sprite: 'fly-female',
      body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 },
        sites: { antenna: { forward: 0, lateral: 0.5 } }, escape: { enabled: false, threshold: 0.5, distance: 1.5, cooldown: 2 } },
      food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
      stimuli: { 'odour:food': { from: 'edibles', scaleBy: 'stock', radius: 6 } },
      brain: { version: 'v2', snapshot: 'brains/forager-brain-wide.brain' },
    },
  };
  const { message, records } = senseMessageOf(config, wideSnapshot());
  assert.equal(message.inputs.length, 2, 'this fixture declares two input channels');
  assert.ok(records[0].forager);
  assert.match(records[0].brainLabel, /v2 wide-I\/O/);
});

test('a "v1" world is unaffected: it still dispatches senseForagerFly (regression guard)', () => {
  const config = {
    flies: {
      count: 1, mode: 'toy', tickHz: 20, sprite: 'fly-female',
      body: { maxSpeed: 3, turnRate: 4, energy: { initial: 0.3, metabolism: 0.005, intake: 0.2 } },
      food: { eatSpeed: 0.5, feedThreshold: 0.5, stock: 1, consumeRate: 0.2, regrowth: 0.02, sated: 0.9 },
      stimulus: { radius: 6, gain: 1, max: 1, resting: 0, antennaOffset: 0.5, objects: ['small'] },
      brain: { version: 'v1', snapshot: 'brains/forager-brain.brain' },
    },
  };
  const { message, records } = senseMessageOf(config, v1Snapshot());
  assert.equal(message.inputs.length, 4, 'v1\'s senseForagerFly always builds exactly four inputs');
  assert.ok(records[0].forager);
  assert.match(records[0].brainLabel, /^v1 forager brain/);
});
