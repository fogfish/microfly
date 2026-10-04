// Group model of the brain inspector (public/brains/js/model.js): region rule, groups per level,
// group edges and group centroids. No DOM and no three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  regionOf, groupsForLevel, groupEdges, groupCentroids,
} from '../public/brains/js/model.js';

// Builds the parseSnapshot shape from neuron records and [src, dst, synapses, weight] edges.
function snapshotOf(neurons, edges) {
  const n = neurons.length;
  const sorted = [...edges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const offsets = new Uint32Array(n + 1);
  for (const [src] of sorted) offsets[src + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  return {
    manifest: { neurons },
    neuronCount: n,
    edgeCount: sorted.length,
    offsets,
    targets: Uint32Array.from(sorted, (e) => e[1]),
    synapses: Uint16Array.from(sorted, (e) => e[2]),
    weights: Float32Array.from(sorted, (e) => e[3]),
  };
}

const neuron = (fields) => ({
  class: null, superclass: null, type: null, soma: null, ...fields,
});

// 0: ALPN with a position A        1: ALPN without a position
// 2: no class, superclass ol_intrinsic, position B
// 3: no class and no superclass, position C
// 4: ALPN with a position D        5: Glia without a position
const NEURONS = [
  neuron({ class: 'ALPN', type: 'a', soma: [0, 0, 0] }),
  neuron({ class: 'ALPN', type: 'a2', soma: null }),
  neuron({ superclass: 'ol_intrinsic', type: 'b', soma: [10, 0, 0] }),
  neuron({ soma: [0, 10, 0] }),
  neuron({ class: 'ALPN', type: 'd', soma: [4, 4, 4] }),
  neuron({ class: 'Glia', soma: null }),
];
const EDGES = [
  [0, 2, 4, 0.5],    // ALPN → (no class) ol_intrinsic
  [2, 0, 2, -0.25],  // back
  [0, 4, 9, 0.5],    // ALPN → ALPN (self-pair at class level)
  [0, 1, 3, 0.5],    // into a neuron without a position
  [3, 0, 1, 0.5],    // Unannotated → ALPN
  [5, 0, 6, 0.5],    // Glia (no position) → ALPN
];

const find = (groups, name) => groups.find((g) => g.name === name);

test('regionOf follows the prefix rule of data-model section 4', () => {
  assert.equal(regionOf('ol_intrinsic'), 'Optic lobe');
  assert.equal(regionOf('visual_projection'), 'Optic lobe');
  assert.equal(regionOf('cb_intrinsic'), 'Central brain');
  assert.equal(regionOf('vnc_intrinsic'), 'Ventral nerve cord');
  assert.equal(regionOf('ascending_neuron'), 'Brain-VNC pathways');
  assert.equal(regionOf('descending_neuron_tbc'), 'Brain-VNC pathways');
  assert.equal(regionOf('sensory_ascending'), 'Brain-VNC pathways');
  assert.equal(regionOf('ENS'), 'ENS');
  assert.equal(regionOf(null), 'Unannotated');
  assert.equal(regionOf('something_else'), 'Unannotated');
});

test('groupsForLevel makes one group per distinct value at the class level', () => {
  const groups = groupsForLevel(snapshotOf(NEURONS, EDGES), 'class');
  assert.deepEqual(groups.map((g) => g.name).sort(), ['(no class) ol_intrinsic', 'ALPN', 'Glia', 'Unannotated']);
  const alpn = find(groups, 'ALPN');
  assert.deepEqual(alpn.members, [0, 4]);
  assert.equal(alpn.count, 3);
  assert.equal(find(groups, '(no class) ol_intrinsic').count, 1);
});

test('a neuron without a position is counted in its group but is not a member', () => {
  const groups = groupsForLevel(snapshotOf(NEURONS, EDGES), 'class');
  const alpn = find(groups, 'ALPN');
  assert.equal(alpn.count, 3);
  assert.ok(!alpn.members.includes(1));
});

test('the type level names a missing type Untyped and the region level names a missing superclass Unannotated', () => {
  const snapshot = snapshotOf(NEURONS, EDGES);
  assert.ok(find(groupsForLevel(snapshot, 'type'), 'Untyped'));
  // Neurons 0, 1, 3, 4 and 5 have no superclass.
  assert.equal(find(groupsForLevel(snapshot, 'region'), 'Unannotated').count, 5);
});

test('groupEdges sums body synapses between groups and drops self-pairs', () => {
  const edges = groupEdges(snapshotOf(NEURONS, EDGES), 'class');
  const pair = (s, t) => edges.find((e) => e.source === s && e.target === t);
  assert.equal(pair('ALPN', '(no class) ol_intrinsic').synapses, 4);
  assert.equal(pair('(no class) ol_intrinsic', 'ALPN').synapses, 2);
  assert.equal(pair('Unannotated', 'ALPN').synapses, 1);
  assert.equal(pair('Glia', 'ALPN').synapses, 6);
  assert.equal(edges.find((e) => e.source === e.target), undefined);
});

test('groupCentroids puts a group with members at the mean of its member positions', () => {
  const snapshot = snapshotOf(NEURONS, EDGES);
  const groups = groupsForLevel(snapshot, 'class');
  const positions = snapshot.manifest.neurons.map((n) => n.soma);
  const placed = groupCentroids(groups, groupEdges(snapshot, 'class'), positions);
  assert.deepEqual(placed.get('ALPN').centroid, [2, 2, 2]);
  assert.equal(placed.get('ALPN').fromNeighbours, false);
});

test('groupCentroids places a group with no member positions at the weighted mean of its neighbours', () => {
  const snapshot = snapshotOf(NEURONS, EDGES);
  const groups = groupsForLevel(snapshot, 'class');
  const positions = snapshot.manifest.neurons.map((n) => n.soma);
  const placed = groupCentroids(groups, groupEdges(snapshot, 'class'), positions);
  // Glia's only neighbour is ALPN (edge weight 6), so Glia sits at ALPN's centroid.
  assert.deepEqual(placed.get('Glia').centroid, [2, 2, 2]);
  assert.equal(placed.get('Glia').fromNeighbours, true);
});
