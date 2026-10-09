// Brain container, version 4 (contracts/container-v4.md). The buffer is SYNTHETIC: it is built inside this
// test (3 input channels, 5 output channels, 2 interneurons), and it is never written to public/brains/.
// Each rejection changes one field of this buffer and checks the message the contract names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, sectionTable } from '../public/js/brain/snapshot.js';

const N = 11;
const E = 7;
const HASH = '0'.repeat(64);

// The synthetic forager header, before it is encoded. Neuron roles: inputs 0–3, outputs 4–8, interneurons 9–10.
function manifest() {
  const entry = (index, role, channel, sign) => ({
    index, role, channel, bodyId: 1000 + index, class: 'synthetic', type: `SYN${index}`,
    somaSide: 'L', superclass: null, soma: null, transmitter: 'ach', transmitterConfidence: 0.9,
    sign, flowInput: 1, flowOutput: 1,
  });
  return {
    provenance: {
      datasetRelease: 'synthetic', edgeVariant: 'traced-only', minConfidence: 0.5, configHash: HASH,
      toolVersion: 'test', createdAt: '2026-01-01T00:00:00Z', positionSource: 'synthetic',
    },
    kind: 'forager',
    synapseCap: 65535,
    weightRule: 'postFraction',
    neuronCount: N,
    edgeCount: E,
    neurons: [
      entry(0, 'input', 'odour-left', 1),
      entry(1, 'input', 'odour-left', 1),
      entry(2, 'input', 'odour-right', 1),
      entry(3, 'input', 'taste-left', 1),
      entry(4, 'output', 'turn-left', 1),
      entry(5, 'output', 'turn-right', 1),
      entry(6, 'output', 'forward', 1),
      entry(7, 'output', 'backward', 1),
      entry(8, 'output', 'feed', 0),
      entry(9, 'interneuron', null, 1),
      entry(10, 'interneuron', null, -1),
    ],
    capabilities: {
      signals: ['spikes'],
      channels: {
        inputs: [
          { id: 'odour-left', label: 'Odour left', side: 'L', neurons: [0, 1], range: [0, 1] },
          { id: 'odour-right', label: 'Odour right', side: 'R', neurons: [2], range: [0, 1] },
          { id: 'taste-left', label: 'Taste left', side: 'L', neurons: [3], range: [0, 1] },
        ],
        outputs: [
          { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [4], range: [0, 1], drive: 'turnLeft' },
          { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [5], range: [0, 1], drive: 'turnRight' },
          { id: 'forward', label: 'Forward', side: 'both', neurons: [6], range: [0, 1], drive: 'forward' },
          { id: 'backward', label: 'Backward', side: 'both', neurons: [7], range: [0, 1], drive: 'backward' },
          { id: 'feed', label: 'Feed', side: 'both', neurons: [8], range: [0, 1], drive: 'feed' },
        ],
      },
    },
    modulators: [
      { id: 'hunger', label: 'Hunger', range: [0, 1], gain: [0.5, 1.5], targets: ['odour-left', 'odour-right'] },
      { id: 'hunger-taste', label: 'Hunger taste', source: 'hunger', gain: [0.1, 1.5], targets: ['taste-left'] },
    ],
  };
}

// CSR of the synthetic graph. Weights are sign(pre) × synapses ÷ Σ synapses into post (postFraction).
const CSR = {
  offsets: [0, 1, 2, 3, 4, 4, 4, 4, 4, 4, 6, 7],
  targets: [9, 9, 10, 10, 4, 6, 5],
  weights: [0.6, 0.4, 0.2, 0.8, 1, 1, -1],
  synapses: [3, 2, 1, 4, 5, 2, 2],
};

// Encodes a version 4 buffer. mutate edits the header; csr edits the body arrays; version sets the file version.
function encode({ mutate = () => {}, csr = CSR, version = 4 } = {}) {
  const m = manifest();
  mutate(m);
  // The header holds the section table, and the table depends on the header length: iterate to a fixed point.
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

test('synthetic version 4 buffer parses, with its version, kind and modulators', () => {
  const snap = parseSnapshot(encode());
  assert.equal(snap.version, 4);
  assert.equal(snap.kind, 'forager');
  assert.equal(snap.neuronCount, N);
  assert.equal(snap.edgeCount, E);
  assert.deepEqual(snap.modulators.map((m) => m.id), ['hunger', 'hunger-taste']);
  assert.deepEqual(snap.capabilities.channels.inputs.map((ch) => ch.id), ['odour-left', 'odour-right', 'taste-left']);
});

test('an unknown version is refused with the supported versions named', () => {
  assert.throws(() => parseSnapshot(encode({ version: 5 })), {
    message: 'unsupported snapshot version 5; this build supports 3 and 4',
  });
});

test('an unknown kind is refused', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.kind = 'tank'; } })), {
    message: 'snapshot kind "tank" is not supported',
  });
});

// ADR 005 D4': postFractionAbsolute is a backward-compatible addition alongside postFraction.
test('a weightRule of postFractionAbsolute parses with no error', () => {
  const snap = parseSnapshot(encode({ mutate: (m) => { m.weightRule = 'postFractionAbsolute'; } }));
  assert.equal(snap.manifest.weightRule, 'postFractionAbsolute');
});

test('an unknown weightRule is refused', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.weightRule = 'cap'; } })), {
    message: 'snapshot weight rule "cap" is not supported',
  });
});

test('N1: index must equal position', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[1].index = 5; } })), {
    message: 'snapshot neuron index 5 is not its position 1',
  });
});

test('N2: roles are inputs, then outputs, then interneurons', () => {
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { m.neurons[4].role = 'interneuron'; m.neurons[4].channel = null; },
  })), { message: 'snapshot roles out of order: expected inputs, outputs, then interneurons' });
});

test('N4: sign is -1, 0 or 1, and only outputs may be 0', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[0].sign = 2; } })), {
    message: 'snapshot neuron 0 has sign 2; expected -1, 0 or 1',
  });
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[9].sign = 0; } })), {
    message: 'snapshot neuron 9 has sign 0 but is not an output',
  });
});

test('M1–M3: a modulator must target a declared input and have valid gains', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.modulators[0].targets = ['feed']; } })), {
    message: 'snapshot modulator hunger targets an undeclared input feed',
  });
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.modulators[0].gain = [-1, 1]; } })), {
    message: 'snapshot modulator hunger has a gain that is not two numbers of 0 or more',
  });
});

test('the channel declaration is checked with the forager rules', () => {
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { m.capabilities.channels.outputs.pop(); },
  })), { message: 'snapshot outputs must have exactly one of each forager drive' });
});

test('CSR: a weight must be finite, and input weights of a neuron sum to at most 1 in absolute value', () => {
  assert.throws(() => parseSnapshot(encode({
    csr: { ...CSR, weights: [Number.NaN, 0.4, 0.2, 0.8, 1, 1, -1] },
  })), { message: 'snapshot CSR is inconsistent: a weight is not finite' });
  assert.throws(() => parseSnapshot(encode({
    csr: { ...CSR, weights: [0.9, 0.9, 0.2, 0.8, 1, 1, -1] },
  })), { message: 'snapshot CSR is inconsistent: input weights into a neuron exceed 1 in absolute sum' });
});

test('a version 4 buffer with the version 3 role names is refused, not read partly', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[0].role = 'sensory'; } })),
    { message: 'snapshot roles out of order: expected inputs, outputs, then interneurons' });
});
