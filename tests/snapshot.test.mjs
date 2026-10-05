// Container contract, JavaScript side (snapshot-format.md). The same fixture and the same
// rejection messages are checked by extract/tests/test_container.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSnapshot, sectionTable } from '../public/js/brain/snapshot.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/synthetic-smallest.brain', import.meta.url));

function fixture() {
  const b = readFileSync(FIXTURE);
  return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const toBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

// Re-encodes the header after `mutate`, moving the body sections. With recompute false the
// section table is kept as it was, so a bad table can be tested.
function rebuild(bytes, mutate, { recompute = true } = {}) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const oldH = view.getUint32(8, true);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + oldH)));
  const oldSections = manifest.sections;
  mutate(manifest);

  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const newH = (json.length + 7) & ~7;
  const { table, end } = sectionTable(newH, manifest.neuronCount, manifest.edgeCount);
  if (recompute) manifest.sections = table;
  const finalJson = new TextEncoder().encode(JSON.stringify(manifest));
  const out = new Uint8Array(end);
  out.set([0x4d, 0x46, 0x42, 0x52]);
  new DataView(out.buffer).setUint32(4, 3, true);
  new DataView(out.buffer).setUint32(8, newH, true);
  out.fill(0x20, 12, 12 + newH);
  out.set(finalJson, 12);
  for (const name of ['offsets', 'targets', 'weights', 'synapses']) {
    const from = oldSections[name];
    const to = table[name];
    out.set(bytes.subarray(from.byteOffset, from.byteOffset + from.byteLength), to.byteOffset);
  }
  return out;
}

const readHeaderLength = (bytes) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(8, true);
const sectionOffset = (bytes, name) => {
  const H = readHeaderLength(bytes);
  const manifest = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + H)));
  return manifest.sections[name].byteOffset;
};

test('parses the synthetic fixture with the counts of the hand-checked selection', () => {
  const snap = parseSnapshot(toBuffer(fixture()));
  assert.equal(snap.neuronCount, 5);
  assert.equal(snap.edgeCount, 4);
  assert.deepEqual([...snap.offsets], [0, 2, 2, 2, 3, 4]);
  assert.deepEqual([...snap.targets], [3, 4, 2, 1]);
  assert.deepEqual([...snap.synapses], [5, 2, 4, 3]);
  assert.equal(snap.weights[3], Math.fround(-0.6));
  assert.deepEqual(snap.manifest.neurons.slice(0, 3).map((n) => n.role), ['sensory', 'left', 'right']);
});

test('rejects bad magic', () => {
  const bytes = fixture();
  bytes[0] = 0x58;
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: 'not a brain snapshot' });
});

test('rejects a file shorter than the prefix', () => {
  assert.throws(() => parseSnapshot(toBuffer(new Uint8Array(8))), { message: 'not a brain snapshot' });
});

test('rejects a version 2 file, which has no capabilities block', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(4, 2, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'unsupported snapshot version 2; this build supports 3',
  });
});

test('rejects an unsupported format version', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(4, 4, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'unsupported snapshot version 4; this build supports 3',
  });
});

test('rejects a truncated header', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(8, 1000000 & ~7, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: 'snapshot header is truncated' });
});

test('rejects a header that is not JSON', () => {
  const bytes = fixture();
  const H = readHeaderLength(bytes);
  bytes.fill(0x7b, 12, 13); // '{' at a position that breaks the document
  bytes.fill(0x21, 13, 12 + H); // '!' everywhere else
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: 'snapshot header is not valid JSON' });
});

test('rejects neurons out of role order', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.neurons[1].role = 'right';
    m.neurons[2].role = 'left';
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot roles out of order: expected sensory, left, right',
  });
});

test('rejects a section that is out of bounds', () => {
  const bytes = rebuild(fixture(), (m) => { m.sections.targets.byteLength += 4; }, { recompute: false });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: 'snapshot section targets is out of bounds' });
});

test('rejects non-monotone offsets', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(sectionOffset(bytes, 'offsets') + 4, 3, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: /^snapshot CSR is inconsistent: / });
});

test('rejects a target outside neuronCount', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(sectionOffset(bytes, 'targets'), 5, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot CSR is inconsistent: a target is outside neuronCount',
  });
});

test('rejects a synapse count of 0', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint16(sectionOffset(bytes, 'synapses'), 0, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot CSR is inconsistent: a synapse count is 0',
  });
});

test('accepts neurons with a soma position and a superclass', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.neurons[0].soma = [1200, 3400, 560];
    m.neurons[0].superclass = 'ascending_neuron';
    m.neurons[4].soma = null;
    m.neurons[4].superclass = null;
  });
  const snap = parseSnapshot(toBuffer(bytes));
  assert.deepEqual(snap.manifest.neurons[0].soma, [1200, 3400, 560]);
  assert.equal(snap.manifest.neurons[0].superclass, 'ascending_neuron');
});

test('accepts neurons with neither soma nor superclass', () => {
  const bytes = rebuild(fixture(), (m) => {
    for (const n of m.neurons) {
      delete n.soma;
      delete n.superclass;
    }
  });
  const snap = parseSnapshot(toBuffer(bytes));
  assert.equal(snap.neuronCount, 5);
  assert.equal(snap.manifest.neurons[0].soma, undefined);
});

test('rejects a soma that is not three integers', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.neurons[3].soma = [1, 2];
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot neuron 3 has a malformed soma position',
  });
});

test('rejects a soma with a non-integer component', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.neurons[1].soma = [1, 2, 'x'];
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot neuron 1 has a malformed soma position',
  });
});

test('rejects a superclass that is not a string', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.neurons[3].superclass = 5;
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot neuron 3 has a malformed superclass',
  });
});

test('returns the declaration of the header', () => {
  const snap = parseSnapshot(toBuffer(fixture()));
  assert.deepEqual(snap.capabilities.signals, ['spikes']);
  assert.deepEqual(snap.capabilities.channels.outputs.map((c) => c.drive), ['left', 'right']);
});

test('rejects a header with no capabilities block', () => {
  const bytes = rebuild(fixture(), (m) => {
    delete m.capabilities;
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), { message: 'snapshot capabilities are missing' });
});

test('rejects a channel with an empty label, named by its id', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.capabilities.channels.inputs[0].label = '';
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot channel food-odour is malformed: label',
  });
});

test('rejects an input that reads a neuron other than 0', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.capabilities.channels.inputs[0].neuron = 1;
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot input channel food-odour must read neuron 0',
  });
});

test('rejects an output that reads a neuron outside neuronCount', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.capabilities.channels.outputs[1].neuron = 5;
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot output channel right-motor references neuron 5 outside neuronCount',
  });
});

test('rejects two left drives', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.capabilities.channels.outputs[1].drive = 'left';
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot outputs must have exactly one left and one right drive',
  });
});

test('rejects an unknown field on a channel', () => {
  const bytes = rebuild(fixture(), (m) => {
    m.capabilities.channels.outputs[0].gain = 2;
  });
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'snapshot channel left-motor has unknown field gain',
  });
});
