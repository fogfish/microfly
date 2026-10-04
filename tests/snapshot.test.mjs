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
  new DataView(out.buffer).setUint32(4, 2, true);
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

test('rejects an unsupported format version', () => {
  const bytes = fixture();
  new DataView(bytes.buffer).setUint32(4, 3, true);
  assert.throws(() => parseSnapshot(toBuffer(bytes)), {
    message: 'unsupported snapshot version 3; this build supports 2',
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
