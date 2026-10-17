// Every shipped forager snapshot's CSR should be indexed like its neuron records (container-v4 W5), so the input
// drive and the output readout land on the neurons the channels declare. Two checks that need no dataset: declared
// outputs are sinks (ADR 003 D2) when read as the runner reads them, and the stored D13 fidelity table is
// reproduced by propagating the shipped CSR itself. `forager-brain-11k.brain` is known to fail both (the
// class-seeded writer indexed the CSR by bodyId instead of by the written neuron order, spec 012 BUG-001) and is
// deliberately left out here until it is re-extracted and recalibrated in a later spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const FORAGER_SNAPSHOTS = [
  'forager-brain.brain',
  'forager-brain-v1-rules.brain',
  'forager-brain-wide.brain',
];

function load(file) {
  const bytes = readFileSync(new URL(`../public/brains/${file}`, import.meta.url));
  return parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

// D13 (selection_class_seed.py _propagate): r = Σ_{t=1..steps} A^t x0, x0 = 1/|pool| on the pool; the mean of r
// over an output pool.
function probe(snap, pool, outputPool, steps) {
  const { neuronCount: n, offsets, targets, weights } = snap;
  let x = new Float64Array(n);
  for (const k of pool) x[k] = 1 / pool.length;
  const r = new Float64Array(n);
  for (let t = 0; t < steps; t++) {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (x[i] === 0) continue;
      for (let k = offsets[i]; k < offsets[i + 1]; k++) y[targets[k]] += weights[k] * x[i];
    }
    for (let i = 0; i < n; i++) r[i] += y[i];
    x = y;
  }
  return outputPool.reduce((sum, k) => sum + r[k], 0) / outputPool.length;
}

for (const file of FORAGER_SNAPSHOTS) {
  test(`${file}: declared output neurons have no outgoing edge, as the runner reads the CSR`, () => {
    const snap = load(file);
    for (const ch of snap.capabilities.channels.outputs) {
      for (const k of ch.neurons) {
        assert.equal(snap.offsets[k + 1] - snap.offsets[k], 0, `${ch.id} neuron ${k} has outgoing edges`);
      }
    }
  });
}

// The class-seeded snapshots store a per-channel fidelity table (ADR 006 D13, ADR 007 D19). Two turn rows per
// snapshot are enough to show the CSR is the probed graph; the full table costs seconds per row.
for (const [file, rows] of [
  ['forager-brain-wide.brain', ['odour-food-right→turn-right', 'heat-left→turn-right']],
]) {
  test(`${file}: the shipped CSR reproduces its stored fidelity table`, () => {
    const snap = load(file);
    const { table, steps } = snap.manifest.fidelity;
    const inputs = Object.fromEntries(snap.capabilities.channels.inputs.map((ch) => [ch.id, ch.neurons]));
    // The 11K probe pools are merged labels (ADR 006 D13): odour-L/R are the odour-left/right channels.
    inputs['odour-L'] = inputs['odour-left'];
    inputs['odour-R'] = inputs['odour-right'];
    const outputs = Object.fromEntries(snap.capabilities.channels.outputs.map((ch) => [ch.id, ch.neurons]));
    for (const row of rows) {
      const [pool, output] = row.split('→');
      const stored = table[row].brain;
      const value = probe(snap, inputs[pool], outputs[output], steps ?? 8);
      assert.ok(Math.abs(value - stored) <= 1e-6 * Math.abs(stored) + 1e-12, `${row}: CSR ${value} vs stored ${stored}`);
    }
  });
}
