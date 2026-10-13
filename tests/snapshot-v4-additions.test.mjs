// Container v4 additions (specs/012-class-seeded-forager-brain/contracts/container-v4-additions.md): optional
// header minSynapses/selection/admission/fidelity, optional per-neuron transmitter/origin. The buffer is
// SYNTHETIC, built inside this test (same shape as tests/snapshot-v4.test.mjs), and never written to
// public/brains/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, sectionTable } from '../public/js/brain/snapshot.js';

const N = 11;
const E = 7;
const HASH = '0'.repeat(64);

function manifest() {
  const entry = (index, role, channel, sign, extra = {}) => ({
    index, role, channel, bodyId: 1000 + index, class: 'synthetic', type: `SYN${index}`,
    somaSide: 'L', superclass: null, soma: null, sign, ...extra,
  });
  return {
    provenance: {
      datasetRelease: 'synthetic', edgeVariant: 'traced-only', configHash: HASH,
      toolVersion: 'test', createdAt: '2026-01-01T00:00:00Z', positionSource: 'synthetic',
    },
    kind: 'forager',
    selection: 'classSeed',
    admission: 'allTraced',
    minSynapses: 5,
    synapseCap: 65535,
    weightRule: 'postFractionAbsolute',
    neuronCount: N,
    edgeCount: E,
    neurons: [
      entry(0, 'input', 'odour-left', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(1, 'input', 'odour-left', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(2, 'input', 'odour-right', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(3, 'input', 'taste-left', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(4, 'output', 'turn-left', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(5, 'output', 'turn-right', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(6, 'output', 'forward', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(7, 'output', 'backward', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(8, 'output', 'feed', 1, { transmitter: 'acetylcholine', origin: null }),
      entry(9, 'interneuron', null, 1, { transmitter: 'acetylcholine', origin: 'seed:ALPN' }),
      entry(10, 'interneuron', null, -1, { transmitter: 'gaba', origin: 'fill' }),
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
    modulators: [],
    fidelity: {
      table: { 'odour-L→turn-left': { brain: 1e-7, wholeGraph: 8e-7 } },
      steering: { pass: true, brainContrast: 1e-7, wholeGraphContrast: 8e-7, fraction: 0.13 },
      feeding: { pass: true, brainValue: 3e-6, wholeGraphValue: 4e-6 },
    },
  };
}

const CSR = {
  offsets: [0, 1, 2, 3, 4, 4, 4, 4, 4, 4, 6, 7],
  targets: [9, 9, 10, 10, 4, 6, 5],
  weights: [0.6, 0.4, 0.2, 0.8, 1, 1, -1],
  synapses: [3, 2, 1, 4, 5, 2, 2],
};

function encode({ mutate = () => {}, csr = CSR } = {}) {
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
  view.setUint32(4, 4, true);
  view.setUint32(8, headerLength, true);
  out.set(header, 12);
  const { offsets, targets, weights, synapses } = layout.table;
  csr.offsets.forEach((v, i) => view.setUint32(offsets.byteOffset + 4 * i, v, true));
  csr.targets.forEach((v, i) => view.setUint32(targets.byteOffset + 4 * i, v, true));
  csr.weights.forEach((v, i) => view.setFloat32(weights.byteOffset + 4 * i, v, true));
  csr.synapses.forEach((v, i) => view.setUint16(synapses.byteOffset + 2 * i, v, true));
  return out.buffer;
}

test('a snapshot with every addition present parses, and the fields are reachable from manifest', () => {
  const snap = parseSnapshot(encode());
  assert.equal(snap.manifest.minSynapses, 5);
  assert.equal(snap.manifest.selection, 'classSeed');
  assert.equal(snap.manifest.admission, 'allTraced');
  assert.equal(snap.manifest.fidelity.steering.pass, true);
  assert.equal(snap.manifest.neurons[9].origin, 'seed:ALPN');
  assert.equal(snap.manifest.neurons[10].origin, 'fill');
  assert.equal(snap.manifest.neurons[10].transmitter, 'gaba');
});

test('a snapshot with none of the additions parses exactly as before', () => {
  const snap = parseSnapshot(encode({
    mutate: (m) => {
      delete m.minSynapses; delete m.selection; delete m.admission; delete m.fidelity;
      m.neurons.forEach((n) => { delete n.transmitter; delete n.origin; });
    },
  }));
  assert.equal(snap.manifest.minSynapses, undefined);
  assert.equal(snap.manifest.selection, undefined);
  assert.equal(snap.manifest.fidelity, undefined);
});

test('rule 11: a malformed transmitter is rejected', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[10].transmitter = 7; } })), {
    message: 'snapshot neuron 10 has a malformed transmitter',
  });
});

test('rule 12: a malformed origin is rejected', () => {
  assert.throws(() => parseSnapshot(encode({ mutate: (m) => { m.neurons[10].origin = 7; } })), {
    message: 'snapshot neuron 10 has a malformed origin',
  });
});

test('rule 13: a fidelity object missing a required key is rejected; no fidelity key is valid', () => {
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { m.fidelity = { table: {}, steering: {} }; },
  })), { message: 'snapshot fidelity report is malformed' });
  assert.doesNotThrow(() => parseSnapshot(encode({ mutate: (m) => { delete m.fidelity; } })));
});
