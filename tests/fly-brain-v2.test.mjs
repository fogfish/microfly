// "v2" dispatches to the unchanged v1 runner (ADR 007, "Decisions: LIF core and runner"): fly-brain.js maps it
// to createV1FlyBrain, which runs any snapshot generically over its declared channel count. Tested against a
// small synthetic forager-wide fixture (two inputs, six outputs), not the real dataset snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { parseSnapshot, sectionTable, checkBrainVersion } from '../public/js/brain/snapshot.js';

const N = 10;
const E = 2;

function manifest() {
  const entry = (index, role, channel, sign) => ({
    index, role, channel, bodyId: 3000 + index, class: 'synthetic', type: `SYN${index}`,
    somaSide: 'L', superclass: null, soma: null, transmitter: 'ach', sign, origin: null,
  });
  return {
    provenance: {
      datasetRelease: 'synthetic', edgeVariant: 'traced-only', configHash: '0'.repeat(64),
      toolVersion: 'test', createdAt: '2026-01-01T00:00:00Z', positionSource: 'synthetic',
    },
    kind: 'forager-wide',
    selection: 'classSeed',
    admission: 'allTraced',
    minSynapses: 5,
    synapseCap: 65535,
    weightRule: 'postFractionAbsolute',
    neuronCount: N,
    edgeCount: E,
    neurons: [
      entry(0, 'input', 'odour-food-left', 1),
      entry(1, 'input', 'odour-food-right', 1),
      entry(2, 'output', 'turn-left', 1),
      entry(3, 'output', 'turn-right', 1),
      entry(4, 'output', 'forward', 1),
      entry(5, 'output', 'backward', 1),
      entry(6, 'output', 'feed', 0),
      entry(7, 'output', 'escape', 0),
      entry(8, 'interneuron', null, 1),
      entry(9, 'interneuron', null, -1),
    ],
    capabilities: {
      signals: ['spikes'],
      channels: {
        inputs: [
          { id: 'odour-food-left', label: 'Food odour left', side: 'L', neurons: [0], range: [0, 1], sense: 'odour:food', site: 'antenna' },
          { id: 'odour-food-right', label: 'Food odour right', side: 'R', neurons: [1], range: [0, 1], sense: 'odour:food', site: 'antenna' },
        ],
        outputs: [
          { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [2], range: [0, 1], drive: 'turnLeft' },
          { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [3], range: [0, 1], drive: 'turnRight' },
          { id: 'forward', label: 'Forward', side: 'both', neurons: [4], range: [0, 1], drive: 'forward' },
          { id: 'backward', label: 'Backward', side: 'both', neurons: [5], range: [0, 1], drive: 'backward' },
          { id: 'feed', label: 'Feed', side: 'both', neurons: [6], range: [0, 1], drive: 'feed' },
          { id: 'escape', label: 'Escape', side: 'both', neurons: [7], range: [0, 1], drive: 'escape' },
        ],
      },
    },
    modulators: [],
  };
}

function encode() {
  const m = manifest();
  let headerLength = 0;
  for (let pass = 0; pass < 4; pass++) {
    const { table } = sectionTable(headerLength, N, E);
    headerLength = (new TextEncoder().encode(JSON.stringify({ ...m, sections: table })).length + 7) & ~7;
  }
  const layout = sectionTable(headerLength, N, E);
  const header = new TextEncoder().encode(JSON.stringify({ ...m, sections: layout.table }).padEnd(headerLength, ' '));
  const out = new Uint8Array(layout.end);
  const view = new DataView(out.buffer);
  out.set([0x4d, 0x46, 0x42, 0x52]);
  view.setUint32(4, 4, true);
  view.setUint32(8, headerLength, true);
  out.set(header, 12);
  const { offsets, targets, weights, synapses } = layout.table;
  [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2].forEach((v, i) => view.setUint32(offsets.byteOffset + 4 * i, v, true));
  [8, 9].forEach((v, i) => view.setUint32(targets.byteOffset + 4 * i, v, true));
  [1, 1].forEach((v, i) => view.setFloat32(weights.byteOffset + 4 * i, v, true));
  [5, 5].forEach((v, i) => view.setUint16(synapses.byteOffset + 2 * i, v, true));
  return out.buffer;
}

const INPUTS = Float32Array.of(0.5, 0.2);

test('"v2" dispatches to the v1 runner, same shape as "v1"', () => {
  const snap = parseSnapshot(encode());
  const brain = createFlyBrain({ version: 'v2', snapshot: snap, stepsPerTick: 1 }, 7);
  const out = brain.step({ inputs: INPUTS, hunger: 0.3 });
  assert.equal(out.outputs.length, 6);
  assert.deepEqual(
    snap.capabilities.channels.outputs.map((ch) => ch.drive),
    ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'],
  );
  assert.ok(out.spikes instanceof Uint32Array);
  assert.equal(out.steps, 1);
});

test('the same seed and inputs give the same outputs, same seed twice', () => {
  const snap = parseSnapshot(encode());
  const run = () => {
    const brain = createFlyBrain({ version: 'v2', snapshot: snap, stepsPerTick: 2 }, 42);
    const trace = [];
    for (let t = 0; t < 20; t++) trace.push(Array.from(brain.step({ inputs: INPUTS, hunger: 0.4 }).outputs));
    return trace;
  };
  assert.deepEqual(run(), run());
});

test('"v2" and "v1" give the same trace on the identical snapshot shape (same createV1FlyBrain under the hood)', () => {
  const snap = parseSnapshot(encode());
  const foragerSnap = { ...snap, kind: 'forager' }; // v1 only needs kind "forager" to pass the version gate
  const run = (version, s) => {
    const brain = createFlyBrain({ version, snapshot: s, stepsPerTick: 2 }, 42);
    const trace = [];
    for (let t = 0; t < 20; t++) trace.push(Array.from(brain.step({ inputs: INPUTS, hunger: 0.4 }).outputs));
    return trace;
  };
  // v2 and v1 run the identical runner/core (ADR 007): same snapshot shape, same seed, same trace.
  assert.deepEqual(run('v2', snap), run('v1', foragerSnap));
});

test('checkBrainVersion: a "v2" world naming a "forager" snapshot (or a "v1" world naming "forager-wide") is refused', () => {
  const snap = parseSnapshot(encode());
  assert.throws(() => createFlyBrain({ version: 'v1', snapshot: { ...snap, kind: 'forager-wide' } }, 7),
    { message: /needs a "forager" snapshot/ });
});

test('checkBrainVersion kind cross-check, both directions', () => {
  assert.throws(() => checkBrainVersion('v2', 4, 'forager', 'brains/x.brain'), { message: /needs a "forager-wide" snapshot/ });
  assert.throws(() => checkBrainVersion('v1', 4, 'forager-wide', 'brains/x.brain'), { message: /needs a "forager" snapshot/ });
});
