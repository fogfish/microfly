// Pure model of the brain inspector (public/brains/js/model.js): scene transform, drawable neurons,
// body edges. No DOM and no three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawableNeurons, sceneTransform, toScene, bodyEdges,
  topEdges, filterMinSynapses, validateManifest, brainFromAddress,
} from '../public/brains/js/model.js';

// Builds the parseSnapshot shape from neuron somas and [src, dst, synapses, weight] edges.
function snapshotOf(somas, edges) {
  const n = somas.length;
  const sorted = [...edges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const offsets = new Uint32Array(n + 1);
  for (const [src] of sorted) offsets[src + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  return {
    manifest: { neurons: somas.map((soma) => ({ soma })) },
    neuronCount: n,
    edgeCount: sorted.length,
    offsets,
    targets: Uint32Array.from(sorted, (e) => e[1]),
    synapses: Uint16Array.from(sorted, (e) => e[2]),
    weights: Float32Array.from(sorted, (e) => e[3]),
  };
}

test('sceneTransform centres the bounding box and scales the largest extent to 220', () => {
  const positions = [[0, 0, 0], [10, 0, 0], [0, 4, 0], [10, 4, 2]];
  const transform = sceneTransform(positions);
  assert.deepEqual(transform.centre, [5, 2, 1]);
  assert.equal(transform.scale, 22);
  const low = toScene([0, 0, 0], transform);
  const high = toScene([10, 4, 2], transform);
  assert.equal(Math.max(...low.map((v, i) => Math.abs(high[i] - v))), 220);
  const centre = toScene([5, 2, 1], transform);
  assert.deepEqual(centre.map((v) => Math.abs(v) < 1e-9), [true, true, true]);
});

test('toScene flips the y axis as the reference inspector does', () => {
  const transform = { centre: [0, 0, 0], scale: 2 };
  assert.deepEqual(toScene([1, 3, -1], transform), [2, -6, -2]);
});

test('drawableNeurons keeps the neurons that have a soma', () => {
  const snapshot = snapshotOf([[0, 0, 0], null, [5, 5, 5]], []);
  assert.deepEqual(drawableNeurons(snapshot), [0, 2]);
});

test('bodyEdges returns one entry per CSR edge with source, target, synapses and weight', () => {
  const snapshot = snapshotOf([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [[0, 1, 5, 0.5], [0, 2, 3, -0.25], [1, 2, 1, 1]]);
  const edges = bodyEdges(snapshot);
  assert.deepEqual(Array.from(edges.source), [0, 0, 1]);
  assert.deepEqual(Array.from(edges.target), [1, 2, 2]);
  assert.deepEqual(Array.from(edges.synapses), [5, 3, 1]);
  assert.deepEqual(Array.from(edges.weight), [0.5, -0.25, 1]);
});

test('neurons with no soma are not drawn and their edges are dropped', () => {
  const snapshot = snapshotOf([[0, 0, 0], null, [5, 5, 5]], [[0, 1, 5, 0.5], [0, 2, 3, -0.25], [1, 2, 1, 1]]);
  const edges = bodyEdges(snapshot);
  assert.deepEqual(Array.from(edges.source), [0]);
  assert.deepEqual(Array.from(edges.target), [2]);
  assert.deepEqual(Array.from(edges.synapses), [3]);
});

// Five edges, sorted by source then target: 0→1 (5), 0→2 (3), 1→2 (5), 2→0 (1), 2→1 (5).
const FIVE = [[0, 1, 5, 0.5], [0, 2, 3, 0.25], [1, 2, 5, 0.5], [2, 0, 1, 0.1], [2, 1, 5, 0.5]];
const threeNeurons = () => snapshotOf([[0, 0, 0], [1, 0, 0], [2, 0, 0]], FIVE);

test('topEdges returns min(n, edges) edges, the largest by synapses', () => {
  const snapshot = threeNeurons();
  const top = topEdges(snapshot, 4);
  assert.equal(top.source.length, 4);
  assert.deepEqual(Array.from(top.synapses).sort((a, b) => a - b), [3, 5, 5, 5]);
  assert.equal(topEdges(snapshot, 100).source.length, 5);
});

test('topEdges breaks ties by ascending edge index', () => {
  const top = topEdges(threeNeurons(), 2);
  assert.deepEqual(Array.from(top.source), [0, 1]);
  assert.deepEqual(Array.from(top.target), [1, 2]);
});

test('filterMinSynapses keeps edges with at least the minimum synapse count', () => {
  const filtered = filterMinSynapses(bodyEdges(threeNeurons()), 3);
  assert.deepEqual(Array.from(filtered.synapses), [5, 3, 5, 5]);
  assert.deepEqual(Array.from(filtered.source), [0, 0, 1, 2]);
});

const manifest = () => ({
  format: 'brain-manifest',
  version: 1,
  default: 'a.brain',
  brains: [{ file: 'a.brain', label: 'A' }, { file: 'b.brain', label: 'B' }],
});

test('validateManifest accepts a well-formed manifest', () => {
  assert.deepEqual(validateManifest(manifest()), []);
});

test('validateManifest rejects a wrong format or version', () => {
  assert.match(validateManifest({ ...manifest(), format: 'other' }).join('\n'), /unsupported brain manifest/);
  assert.match(validateManifest({ ...manifest(), version: 2 }).join('\n'), /unsupported brain manifest/);
});

test('validateManifest rejects a default that is not an entry', () => {
  assert.match(validateManifest({ ...manifest(), default: 'c.brain' }).join('\n'), /default/);
});

test('validateManifest rejects a duplicate file', () => {
  const dup = { ...manifest(), brains: [{ file: 'a.brain', label: 'A' }, { file: 'a.brain', label: 'A2' }] };
  assert.match(validateManifest(dup).join('\n'), /duplicate file a\.brain/);
});

test('validateManifest rejects a file with a path separator', () => {
  const nested = { ...manifest(), default: 'sub/a.brain', brains: [{ file: 'sub/a.brain', label: 'A' }] };
  assert.match(validateManifest(nested).join('\n'), /path separator/);
});

test('brainFromAddress takes ?brain= when it is in the manifest, else the default', () => {
  assert.equal(brainFromAddress('?brain=b.brain', manifest()), 'b.brain');
  assert.equal(brainFromAddress('?brain=zzz.brain', manifest()), 'a.brain');
  assert.equal(brainFromAddress('', manifest()), 'a.brain');
});
