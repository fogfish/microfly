// L13 noiseClassScale (contracts/lif-v1-noise-class.md). G1/G9: null is a no-op, bit-identical to the same
// parameters without the key. A declared class takes noiseAmplitude × its scale in place of noiseBulkScale; input
// pools keep the full amplitude; an unknown class is a named error.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, step, resolveParams } from '../public/js/brain/lif-v1.js';

// Synthetic test fixture, labelled as such: 0 is a sensory input, 1-2 are KCs, 3 is an ALPN, 4 is classless.
const TOY = {
  neuronCount: 5,
  edges: [
    { pre: 0, post: 3, weight: 0.4 },
    { pre: 3, post: 1, weight: 0.3 },
    { pre: 3, post: 2, weight: 0.3 },
    { pre: 1, post: 4, weight: 0.2 },
  ],
  inputNeurons: [0],
  neuronClass: ['olfactory', 'Kenyon_Cell', 'Kenyon_Cell', 'ALPN', null],
};

function spikeTrain(params, steps = 400) {
  const net = createNetwork(TOY, params, 7);
  const drive = new Float64Array(TOY.neuronCount);
  drive[0] = 0.08;
  const out = [];
  for (let t = 0; t < steps; t++) { step(net, drive); out.push(Array.from(net.spikes).join('')); }
  return out;
}

test('G9: noiseClassScale null gives spikes identical to the same parameters without the key', () => {
  const base = { noiseAmplitude: 0.3, noiseBulkScale: 0.5 };
  assert.deepEqual(spikeTrain({ ...base, noiseClassScale: null }), spikeTrain(base));
});

test('a declared class takes amplitude × scale; inputs keep the amplitude; others keep the bulk scale', () => {
  const net = createNetwork(TOY, { noiseAmplitude: 0.2, noiseBulkScale: 0.5, noiseClassScale: { Kenyon_Cell: 0, ALPN: 2 } }, 1);
  assert.deepEqual(Array.from(net.noiseOf), [0.2, 0, 0, 0.4, 0.1]);
});

test('an input neuron of a declared class keeps the full amplitude', () => {
  const net = createNetwork(TOY, { noiseAmplitude: 0.2, noiseBulkScale: 0.5, noiseClassScale: { olfactory: 0 } }, 1);
  assert.equal(net.noiseOf[0], 0.2);
});

test('same seed, same parameters: identical spikes with noiseClassScale set', () => {
  const p = { noiseAmplitude: 0.3, noiseBulkScale: 0.5, noiseClassScale: { Kenyon_Cell: 0 } };
  assert.deepEqual(spikeTrain(p), spikeTrain(p));
});

test('rejects a non-object noiseClassScale', () => {
  for (const bad of [[], 3, 'x']) {
    assert.throws(() => resolveParams({ noiseClassScale: bad }), /LIF parameter "noiseClassScale" must be null or an object/);
  }
});

test('rejects a non-finite or negative class scale, naming the class', () => {
  for (const bad of [-1, Infinity, NaN, '1']) {
    assert.throws(() => resolveParams({ noiseClassScale: { ALPN: bad } }), /LIF parameter "noiseClassScale.ALPN" must be a number of 0 or more/);
  }
});

test('createNetwork rejects a class absent from the graph, naming it', () => {
  assert.throws(() => createNetwork(TOY, { noiseAmplitude: 0.1, noiseClassScale: { MBON: 0 } }, 1), /E-LIF-NOISE: class "MBON" is not in the snapshot/);
});
