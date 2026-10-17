// Brain container, kind "forager-wide" (ADR 007 D20, channel-declaration-v5.md). The buffer is SYNTHETIC: a
// small two-input/six-output header, built inside this test and never written to public/brains/. Also confirms
// a kind "forager" header is unaffected by this feature (regression guard against snapshot-v4.test.mjs) and the
// checkBrainVersion kind cross-check (R2/R3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, sectionTable, checkBrainVersion } from '../public/js/brain/snapshot.js';

const N = 10;
const E = 2;
const HASH = '0'.repeat(64);

// Neuron roles: inputs 0-1 (odour-food-left/right), outputs 2-7 (the six forager-wide drives), interneurons 8-9.
function manifest() {
  const entry = (index, role, channel, sign) => ({
    index, role, channel, bodyId: 2000 + index, class: 'synthetic', type: `SYN${index}`,
    somaSide: 'L', superclass: null, soma: null, transmitter: 'ach', sign, origin: null,
  });
  return {
    provenance: {
      datasetRelease: 'synthetic', edgeVariant: 'traced-only', configHash: HASH,
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
    fidelity: { table: {}, checks: [{ kind: 'contrast', pair: 'odour-food', pass: true, brainValue: 1, wholeGraphValue: 1, fraction: 1 }] },
  };
}

const CSR = { offsets: [0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2], targets: [8, 9], weights: [1, 1], synapses: [5, 5] };

function encode({ mutate = () => {}, csr = CSR, version = 4 } = {}) {
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

test('a synthetic kind "forager-wide" header parses, with its sense/site declaration and six drives', () => {
  const snap = parseSnapshot(encode());
  assert.equal(snap.version, 4);
  assert.equal(snap.kind, 'forager-wide');
  assert.deepEqual(
    snap.capabilities.channels.outputs.map((ch) => ch.drive),
    ['turnLeft', 'turnRight', 'forward', 'backward', 'feed', 'escape'],
  );
  assert.equal(snap.capabilities.channels.inputs[0].sense, 'odour:food');
  assert.equal(snap.capabilities.channels.inputs[0].site, 'antenna');
});

test('a kind "forager" header is unaffected by this feature (regression guard)', () => {
  // A v5-shaped declaration (sense/site, six drives) is never accepted under kind "forager": checkForagerHeader
  // dispatches it to the unedited v4 path (checkForager/validateCapabilitiesV4), which rejects the six-drive
  // output set at R7, never touching checkForagerWide/validateCapabilitiesV5 at all.
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { m.kind = 'forager'; },
  })), { message: 'snapshot outputs must have exactly one of each forager drive' });
});

test('a malformed v5 declaration (missing sense) is rejected with the R9 message', () => {
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { delete m.capabilities.channels.inputs[0].sense; },
  })), { message: 'snapshot channel odour-food-left is malformed: sense' });
});

test('five forager-wide drives (missing escape) is rejected with the R10 message', () => {
  assert.throws(() => parseSnapshot(encode({
    mutate: (m) => { m.neurons[7].role = 'interneuron'; m.neurons[7].channel = null; m.capabilities.channels.outputs.pop(); },
  })), { message: 'snapshot outputs must have exactly one of each forager-wide drive' });
});

test('checkBrainVersion: v1 needs kind "forager", v2 needs kind "forager-wide"', () => {
  assert.throws(() => checkBrainVersion('v1', 4, 'forager-wide', 'brains/forager-brain-wide.brain'), {
    message: 'flies.brain.version "v1" needs a "forager" snapshot; brains/forager-brain-wide.brain is kind "forager-wide"',
  });
  assert.throws(() => checkBrainVersion('v2', 4, 'forager', 'brains/forager-brain-11k.brain'), {
    message: 'flies.brain.version "v2" needs a "forager-wide" snapshot; brains/forager-brain-11k.brain is kind "forager"',
  });
  assert.doesNotThrow(() => checkBrainVersion('v2', 4, 'forager-wide', 'brains/forager-brain-wide.brain'));
  assert.doesNotThrow(() => checkBrainVersion('v1', 4, 'forager', 'brains/forager-brain-11k.brain'));
});

// N6 (container-v4.md, spec 012 BUG-001): an output row with outgoing edges is the mark of a CSR indexed in a
// different order from the neuron records, and is rejected at load instead of running scrambled.
test('an output neuron with an outgoing edge is rejected (N6)', () => {
  // neuron 0 (input) -> 8 stays; neuron 2 (turn-left output) -> 9 replaces neuron 1's edge.
  const csr = { offsets: [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2], targets: [8, 9], weights: [1, 1], synapses: [5, 5] };
  assert.throws(() => parseSnapshot(encode({ csr })), { message: 'snapshot CSR is inconsistent: output neuron 2 has outgoing edges' });
});
