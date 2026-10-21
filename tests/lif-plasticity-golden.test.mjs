// L11 pathwayGain and L12 plasticity (contracts/lif-v1-plasticity.md, ADR 011). G1/G6: both null is a no-op,
// bit-identical to the same parameters without the keys, on the wide-brain fixture. G7: plasticity on, two runs
// with the same seed give identical spikes and wmod. G8: wmod stays in [wMin, 1]; the snapshot's weights array
// is never written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNetwork, step, resolveParams } from '../public/js/brain/lif-v1.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const BRAIN = fileURLToPath(new URL('../public/brains/forager-brain-mb.brain', import.meta.url));
const SKIP = existsSync(BRAIN) ? false : 'public/brains/forager-brain-mb.brain is absent';

function loadSnapshot() {
  const bytes = readFileSync(BRAIN);
  return parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function graphOf(snap) {
  return {
    neuronCount: snap.neuronCount, offsets: snap.offsets, targets: snap.targets, weights: snap.weights,
    neuronClass: snap.manifest.neurons.map((n) => n.class ?? null),
  };
}

test('G1/G6: pathwayGain null gives spikes identical to the same parameters without the key', { skip: SKIP }, () => {
  const snap = loadSnapshot();
  const graph = graphOf(snap);
  const a = createNetwork(graph, { synapticScale: 10 }, 42);
  const b = createNetwork(graph, { synapticScale: 10, pathwayGain: null }, 42);
  const drive = new Float64Array(snap.neuronCount);
  for (const ch of snap.capabilities.channels.inputs.slice(0, 2)) for (const i of ch.neurons) drive[i] = 1;
  for (let t = 0; t < 50; t++) {
    step(a, drive);
    step(b, drive);
    for (let i = 0; i < snap.neuronCount; i++) {
      assert.equal(b.v[i], a.v[i], `potential of neuron ${i} differs at step ${t}`);
      assert.equal(b.spikes[i], a.spikes[i], `spike of neuron ${i} differs at step ${t}`);
    }
  }
});

test('pathwayGain actually scales the declared route, when set (sanity: not a silent no-op)', { skip: SKIP }, () => {
  const snap = loadSnapshot();
  const graph = graphOf(snap);
  // olfactory->ALPN is the first route research.md §3 names; find one such edge's weight before/after.
  const classes = graph.neuronClass;
  let found = null;
  for (let i = 0; i < snap.neuronCount && !found; i++) {
    if (classes[i] !== 'olfactory') continue;
    for (let k = graph.offsets[i]; k < graph.offsets[i + 1]; k++) {
      if (graph.weights[k] > 0 && classes[graph.targets[k]] === 'ALPN') { found = { i, k }; break; }
    }
  }
  assert.ok(found, 'fixture must contain at least one olfactory->ALPN excitatory edge');
  const base = createNetwork(graph, {}, 1);
  const gained = createNetwork(graph, {
    pathwayGain: { routes: [{ from: 'olfactory', to: 'ALPN', gain: 5 }], otherExcitatoryInto: [], otherGain: 1 },
  }, 1);
  assert.equal(gained.weights[found.k], base.weights[found.k] * 5);
});

test('rejects a non-object pathwayGain', () => {
  assert.throws(() => resolveParams({ pathwayGain: 'nope' }), {
    message: 'LIF parameter "pathwayGain" must be null or an object with routes',
  });
  assert.throws(() => resolveParams({ pathwayGain: { routes: 'nope' } }), {
    message: 'LIF parameter "pathwayGain" must be null or an object with routes',
  });
});

test('rejects a non-finite or negative routes[i].gain', () => {
  assert.throws(() => resolveParams({ pathwayGain: { routes: [{ from: 'a', to: 'b', gain: -1 }] } }), {
    message: 'LIF parameter "pathwayGain.routes[i].gain" must be a number of 0 or more',
  });
  assert.throws(() => resolveParams({ pathwayGain: { routes: [{ from: 'a', to: 'b', gain: NaN }] } }), {
    message: 'LIF parameter "pathwayGain.routes[i].gain" must be a number of 0 or more',
  });
});

test('rejects a non-finite or negative otherGain', () => {
  assert.throws(() => resolveParams({ pathwayGain: { routes: [], otherExcitatoryInto: ['a'], otherGain: -1 } }), {
    message: 'LIF parameter "pathwayGain.routes[i].gain" must be a number of 0 or more',
  });
});

test('rejects a repeated from→to route', () => {
  assert.throws(() => resolveParams({
    pathwayGain: { routes: [{ from: 'a', to: 'b', gain: 1 }, { from: 'a', to: 'b', gain: 2 }] },
  }), { message: 'LIF parameter "pathwayGain" repeats route a→b' });
});

test('createNetwork rejects a route class absent from the snapshot, naming it', { skip: SKIP }, () => {
  const graph = graphOf(loadSnapshot());
  assert.throws(() => createNetwork(graph, {
    pathwayGain: { routes: [{ from: 'no-such-class', to: 'ALPN', gain: 2 }] },
  }, 1), { message: 'E-LIF-PATHWAY: class "no-such-class" is not in the snapshot' });
});

// L11 type selectors (ADR 011 D40): a route end may name a dataset `type` instead of a `class`, for neurons the
// dataset leaves classless (APL). Synthetic test fixture, labelled as such: 0, 1 are KCs, 2 is the classless APL,
// 3 is a PN.
const TYPED_TOY = {
  neuronCount: 4,
  edges: [
    { pre: 0, post: 2, weight: 0.1 },   // KC→APL
    { pre: 0, post: 1, weight: 0.2 },   // KC→KC
    { pre: 3, post: 0, weight: 0.3 },   // PN→KC
    { pre: 2, post: 0, weight: -0.4 },  // APL→KC (inhibitory: never gained)
  ],
  neuronClass: ['Kenyon_Cell', 'Kenyon_Cell', null, 'ALPN'],
  neuronType: ['KCg-m', 'KCg-m', 'APL', 'DM1_lPN'],
};
const weightOf = (net, pre, post) => {
  for (let k = net.offsets[pre]; k < net.offsets[pre + 1]; k++) if (net.targets[k] === post) return net.weights[k];
  return undefined;
};

test('a toType route gains edges into a classless neuron, and only those', () => {
  const net = createNetwork(TYPED_TOY, {
    pathwayGain: { routes: [{ from: 'Kenyon_Cell', toType: 'APL', gain: 30 }] },
  }, 1);
  assert.equal(weightOf(net, 0, 2), 0.1 * 30);
  assert.equal(weightOf(net, 0, 1), 0.2);
  assert.equal(weightOf(net, 3, 0), 0.3);
  assert.equal(weightOf(net, 2, 0), -0.4);
});

test('when two routes match an edge, the first declared wins', () => {
  const net = createNetwork(TYPED_TOY, {
    pathwayGain: { routes: [{ fromType: 'KCg-m', toType: 'APL', gain: 2 }, { from: 'Kenyon_Cell', toType: 'APL', gain: 7 }] },
  }, 1);
  assert.equal(weightOf(net, 0, 2), 0.1 * 2);
});

test('rejects a route end with both or neither of class and type', () => {
  const message = 'LIF parameter "pathwayGain" must be null or an object with routes';
  assert.throws(() => resolveParams({ pathwayGain: { routes: [{ from: 'a', fromType: 'b', to: 'c', gain: 1 }] } }), { message });
  assert.throws(() => resolveParams({ pathwayGain: { routes: [{ to: 'c', gain: 1 }] } }), { message });
});

test('rejects a repeated type route, marking the type end', () => {
  assert.throws(() => resolveParams({
    pathwayGain: { routes: [{ from: 'a', toType: 'APL', gain: 1 }, { from: 'a', toType: 'APL', gain: 2 }] },
  }), { message: 'LIF parameter "pathwayGain" repeats route a→type:APL' });
});

test('createNetwork rejects a route type absent from the graph, naming it', () => {
  assert.throws(() => createNetwork(TYPED_TOY, {
    pathwayGain: { routes: [{ from: 'Kenyon_Cell', toType: 'no-such-type', gain: 2 }] },
  }, 1), { message: 'E-LIF-PATHWAY: type "no-such-type" is not in the snapshot' });
});

// L12 plasticity. Synthetic toy graph: 0,1 KCs; 2 approach MBON; 3 avoid MBON; 4 reward DAN (PAM); 5 punish DAN
// (PPL1). Weights chosen so reward/punish DANs spike readily under drive, and KC→MBON edges are plastic slots.
const LEARNING_TOY = {
  neuronCount: 6,
  edges: [
    { pre: 0, post: 2, weight: 0.5 },  // KC0->approach
    { pre: 0, post: 3, weight: 0.5 },  // KC0->avoid
    { pre: 1, post: 2, weight: 0.4 },  // KC1->approach
    { pre: 1, post: 3, weight: 0.4 },  // KC1->avoid
  ],
  learning: {
    kc: Uint32Array.from([0, 1]),
    reward: Uint32Array.from([4]),
    punish: Uint32Array.from([5]),
    approach: Uint32Array.from([2]),
    avoid: Uint32Array.from([3]),
  },
};

function driveToy(net, { kc = 0, reward = 0, punish = 0 } = {}) {
  const external = new Float64Array(net.n);
  external[0] = kc;
  external[1] = kc;
  external[4] = reward;
  external[5] = punish;
  return external;
}

test('G6: plasticity null gives spikes identical to the same parameters without the key', () => {
  const a = createNetwork(LEARNING_TOY, { vThreshold: 0.5 }, 1);
  const b = createNetwork(LEARNING_TOY, { vThreshold: 0.5, plasticity: null }, 1);
  for (let t = 0; t < 30; t++) {
    const driveA = driveToy(a, { kc: 1, reward: 1 });
    const driveB = driveToy(b, { kc: 1, reward: 1 });
    step(a, driveA);
    step(b, driveB);
    for (let i = 0; i < a.n; i++) {
      assert.equal(b.v[i], a.v[i]);
      assert.equal(b.spikes[i], a.spikes[i]);
    }
  }
});

test('createNetwork rejects plasticity set with no graph.learning', () => {
  assert.throws(() => createNetwork({ neuronCount: 2, edges: [] }, { plasticity: {} }, 1), {
    message: 'E-LEARN-MISSING: plasticity needs learning groups',
  });
});

test('G7: plasticity on, two runs with the same seed give identical spikes and wmod', () => {
  const a = createNetwork(LEARNING_TOY, { vThreshold: 0.5, plasticity: {} }, 7);
  const b = createNetwork(LEARNING_TOY, { vThreshold: 0.5, plasticity: {} }, 7);
  for (let t = 0; t < 200; t++) {
    step(a, driveToy(a, { kc: 1, reward: 1 }));
    step(b, driveToy(b, { kc: 1, reward: 1 }));
  }
  for (let i = 0; i < a.n; i++) assert.equal(b.spikes[i], a.spikes[i]);
  for (let j = 0; j < a.plastic.wmod.length; j++) assert.equal(b.plastic.wmod[j], a.plastic.wmod[j]);
});

test('G8: wmod stays in [wMin, 1], and each createNetwork call gets its own private weights copy', () => {
  const graph = { ...LEARNING_TOY };
  const net = createNetwork(graph, { vThreshold: 0.5, plasticity: { wMin: 0.2 } }, 3);
  const weightsRefBefore = net.weights;
  for (let t = 0; t < 500; t++) step(net, driveToy(net, { kc: 1, reward: 1 }));
  for (const w of net.plastic.wmod) {
    assert.ok(w >= 0.2 - 1e-9 && w <= 1 + 1e-9, `wmod ${w} out of [wMin, 1]`);
  }
  assert.equal(net.weights, weightsRefBefore, 'weights array is mutated in place, not reallocated');
  const net2 = createNetwork(graph, { vThreshold: 0.5 }, 3);
  assert.notEqual(net.weights, net2.weights, 'a second createNetwork call must not share the first\'s weights copy');
});

