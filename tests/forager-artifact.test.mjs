// The committed forager brain (public/brains/forager-brain.brain, extracted from MaleCNS v1.0 by the extractor,
// ADR 003 Gate A). Skipped when the file is absent, so a checkout without the artifact still runs the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const FILE = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));
const SKIP = existsSync(FILE) ? false : 'public/brains/forager-brain.brain is absent (run the extractor, see quickstart.md)';

function load() {
  const b = readFileSync(FILE);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

test('the forager artifact parses as a version 4 forager brain', { skip: SKIP }, () => {
  const snap = load();
  assert.equal(snap.version, 4);
  assert.equal(snap.kind, 'forager');
  assert.ok(snap.neuronCount >= 2000 && snap.neuronCount <= 6000, `neuron count ${snap.neuronCount} is outside [2000, 6000]`);
});

test('every output pool receives an incoming edge', { skip: SKIP }, () => {
  const snap = load();
  const received = new Set(snap.targets);
  for (const channel of snap.capabilities.channels.outputs) {
    for (const neuron of channel.neurons) {
      assert.ok(received.has(neuron), `output ${channel.id} neuron ${neuron} receives no edge`);
    }
  }
});

test('every non-output neuron has sign plus or minus one, and sign-zero outputs have no outgoing edge', { skip: SKIP }, () => {
  const snap = load();
  snap.manifest.neurons.forEach((neuron, i) => {
    if (neuron.role === 'output') {
      if (neuron.sign === 0) {
        assert.equal(snap.offsets[i], snap.offsets[i + 1], `sign-zero output ${i} has an outgoing edge`);
      }
    } else {
      assert.ok(neuron.sign === 1 || neuron.sign === -1, `neuron ${i} (${neuron.role}) has sign ${neuron.sign}`);
    }
  });
});

test('the odour pools are side-matched (equal left and right sizes)', { skip: SKIP }, () => {
  const { channels } = load().capabilities;
  const size = (id) => channels.inputs.find((ch) => ch.id === id).neurons.length;
  assert.equal(size('odour-left'), size('odour-right'));
});
