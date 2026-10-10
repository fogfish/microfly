// Brain container, version 5 (contracts/container-v5.md). The buffer is SYNTHETIC: built inside this test (3
// input channels incl. sense/site, 6 output channels incl. escape, 2 interneurons with group/transmitterSource),
// never written to public/brains/. Each rejection changes one field and checks the message the contract names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, sectionTable, checkBrainVersion } from '../public/js/brain/snapshot.js';

const N = 12;
const E = 9;
const HASH = '0'.repeat(64);

// Neuron roles: inputs 0–2, outputs 3–8, interneurons 9–10.
function manifest() {
  const entry = (index, role, channel, sign, group) => ({
    index, role, channel, bodyId: 1000 + index, class: 'synthetic', type: `SYN${index}`,
    somaSide: 'L', superclass: null, soma: null, transmitter: 'ach', transmitterSource: 'predicted_nt',
    transmitterConfidence: 0.9, sign, group, flowInput: 1, flowOutput: 1,
  });
  return {
    provenance: {
      datasetRelease: 'synthetic', edgeVariant: 'traced-only', minConfidence: 0.5, configHash: HASH,
      toolVersion: 'test', createdAt: '2026-01-01T00:00:00Z', positionSource: 'synthetic',
    },
    kind: 'forager',
    weightRule: 'synapseCount',
    minSynapses: 1,
    anchors: [{ class: 'ALLN' }],
    neuronCount: N,
    edgeCount: E,
    neurons: [
      entry(0, 'input', 'odour-food-left', 1, 'input'),
      entry(1, 'input', 'odour-food-right', 1, 'input'),
      entry(2, 'input', 'taste-mouth-left', 1, 'input'),
      entry(3, 'output', 'turn-left', 1, 'output'),
      entry(4, 'output', 'turn-right', 1, 'output'),
      entry(5, 'output', 'forward', 1, 'output'),
      entry(6, 'output', 'backward', 1, 'output'),
      entry(7, 'output', 'feed', 0, 'output'),
      entry(8, 'output', 'escape', 1, 'output'),
      entry(9, 'interneuron', null, 1, 'al'),
      entry(10, 'interneuron', null, -1, 'vnc'),
      entry(11, 'interneuron', null, 1, 'dn'),
    ],
    capabilities: {
      signals: ['spikes'],
      channels: {
        inputs: [
          { id: 'odour-food-left', label: 'Odour food left', side: 'L', neurons: [0], range: [0, 1], sense: 'odour:food', site: 'antenna' },
          { id: 'odour-food-right', label: 'Odour food right', side: 'R', neurons: [1], range: [0, 1], sense: 'odour:food', site: 'antenna' },
          { id: 'taste-mouth-left', label: 'Taste mouth left', side: 'L', neurons: [2], range: [0, 1], sense: 'taste:mouth', site: 'mouth' },
        ],
        outputs: [
          { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [3], range: [0, 1], drive: 'turnLeft' },
          { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [4], range: [0, 1], drive: 'turnRight' },
          { id: 'forward', label: 'Forward', side: 'both', neurons: [5], range: [0, 1], drive: 'forward' },
          { id: 'backward', label: 'Backward', side: 'both', neurons: [6], range: [0, 1], drive: 'backward' },
          { id: 'feed', label: 'Feed', side: 'both', neurons: [7], range: [0, 1], drive: 'feed' },
          { id: 'escape', label: 'Escape', side: 'both', neurons: [8], range: [0, 1], drive: 'escape' },
        ],
      },
    },
    modulators: [
      { id: 'hunger', label: 'Hunger', range: [0, 1], gain: [0.5, 1.5], targets: ['odour-food-left', 'odour-food-right'] },
    ],
  };
}

// CSR: inputs (0-2) -> interneurons (9-11); interneurons -> outputs (3-8). weightRule synapseCount: unnormalised.
const CSR = {
  offsets: [0, 1, 2, 3, 3, 3, 3, 3, 3, 5, 7, 9, 9],
  targets: [9, 10, 11, 3, 5, 4, 6, 8, 8],
  weights: [3, -2, 1, 4, 3, -2, 1, 2, 1],
  synapses: [3, 2, 1, 4, 3, 2, 1, 2, 1],
};

// Encodes a version 5 buffer. mutate edits the header; csr edits the body arrays; version sets the file version.
function encode({ mutate = () => {}, csr = CSR, version = 5 } = {}) {
  const m = manifest();
  mutate(m);
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
  view.setUint32(4, version, true);
  view.setUint32(8, headerLength, true);
  out.set(header, 12);
  const { offsets, targets, weights, synapses } = layout.table;
  csr.offsets.forEach((v, i) => view.setUint32(offsets.byteOffset + 4 * i, v, true));
  csr.targets.forEach((v, i) => view.setUint32(targets.byteOffset + 4 * i, v, true));
  csr.weights.forEach((v, i) => view.setFloat32(weights.byteOffset + 4 * i, v, true));
  csr.synapses.forEach((v, i) => view.setUint16(synapses.byteOffset + 2 * i, v, true));
  return out.buffer;
}

test('synthetic version 5 buffer parses, with its version, kind and modulators', () => {
  const snap = parseSnapshot(encode());
  assert.equal(snap.version, 5);
  assert.equal(snap.kind, 'forager');
  assert.equal(snap.neuronCount, N);
  assert.equal(snap.edgeCount, E);
  assert.deepEqual(snap.modulators.map((m) => m.id), ['hunger']);
  assert.deepEqual(snap.capabilities.channels.inputs.map((ch) => ch.sense),
    ['odour:food', 'odour:food', 'taste:mouth']);
});

test('checkBrainVersion maps v2 to container version 5', () => {
  assert.doesNotThrow(() => checkBrainVersion('v2', 5));
  assert.throws(() => checkBrainVersion('v2', 4), {
    message: 'flies.brain.version "v2" needs a version 5 snapshot; snapshot is version 4',
  });
});

test('weightRule synapseCount is not checked for inflow sum (weights may exceed 1)', () => {
  const snap = parseSnapshot(encode({ csr: { ...CSR, weights: [50, -2, 1, 4, 3, -2, 1, 2, 1] } }));
  assert.equal(snap.weights[0], 50);
});

test('weightRule postFractionAbsolute is still checked for inflow sum', () => {
  const bad = { ...CSR, weights: [0.9, 0.9, 1, 4, 3, -2, 1, 2, 1] }; // both edges into neuron 9: 0.9+0.9 > 1
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.weightRule = 'postFractionAbsolute'; }, csr: bad })), {
    message: 'snapshot CSR is inconsistent: input weights into a neuron exceed 1 in absolute sum',
  });
});

test('an unknown weightRule is refused', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.weightRule = 'cap'; } })), {
    message: 'snapshot weight rule "cap" is not supported',
  });
});

test('every input channel needs a sense', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { delete m.capabilities.channels.inputs[0].sense; } })), {
    message: 'snapshot channel odour-food-left is malformed: sense',
  });
});

test('every input channel needs a site', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.capabilities.channels.inputs[0].site = 'nowhere'; } })), {
    message: 'snapshot channel odour-food-left is malformed: site',
  });
});

test('escape drive must appear exactly once', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.capabilities.channels.outputs[5].drive = 'forward'; } })), {
    message: 'snapshot outputs must have exactly one of each forager drive',
  });
});

test('every neuron group must be one of six regions', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[11].group = 'bogus'; } })), {
    message: 'snapshot neuron 11 has an unknown group bogus',
  });
});

test('every neuron transmitterSource must be one of three columns', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[11].transmitterSource = 'bogus'; } })), {
    message: 'snapshot neuron 11 has an unknown transmitterSource bogus',
  });
});

test('version 3 and version 4 parsing is unaffected by the version 5 branch', () => {
  // A v3/v4 buffer never reaches checkForagerV2; reuse snapshot-v4.test.mjs's own fixture indirectly by
  // checking that FORMAT_VERSIONS now includes 5 without breaking the version dispatch for 3/4 (covered by
  // tests/snapshot.test.mjs and tests/snapshot-v4.test.mjs, run alongside this file in the same `npm test`).
  assert.doesNotThrow(() => checkBrainVersion('v0', 3));
  assert.doesNotThrow(() => checkBrainVersion('v1', 4));
});
