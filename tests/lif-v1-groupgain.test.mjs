// groupGain (L10, contracts/lif-v1-groupgain.md). G16: no-op with groupGain: {} or graph.neuronGroup absent
// (also appended to lif-v1.test.mjs per the plan's Phase 2 ordering). G17: only edges into a listed group are
// scaled. G18: resolveParams rejects a malformed groupGain before any network is built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, step, resolveParams } from '../public/js/brain/lif-v1.js';

test('G16: groupGain {} is a no-op, identical to groupGain absent entirely', () => {
  const graph = { neuronCount: 3, edges: [{ pre: 0, post: 1, weight: 0.5 }, { pre: 0, post: 2, weight: 0.5 }], neuronGroup: { 1: 'al', 2: 'vnc' } };
  const withEmpty = createNetwork(graph, { groupGain: {}, synapticScale: 1 }, 1);
  const absent = createNetwork(graph, { synapticScale: 1 }, 1);
  const ext = Float64Array.of(2, 0, 0);
  for (let t = 0; t < 50; t++) {
    step(withEmpty, ext.slice());
    step(absent, ext.slice());
    for (let i = 0; i < 3; i++) {
      assert.equal(withEmpty.v[i], absent.v[i], `potential of neuron ${i} differs at step ${t}`);
      assert.equal(withEmpty.spikes[i], absent.spikes[i], `spike of neuron ${i} differs at step ${t}`);
    }
  }
});

test('G16: a graph with no neuronGroup is unaffected by a non-empty groupGain', () => {
  const graph = { neuronCount: 2, edges: [{ pre: 0, post: 1, weight: 0.5 }] };
  const withGain = createNetwork(graph, { groupGain: { al: 0.1 }, synapticScale: 1 }, 1);
  const without = createNetwork(graph, { synapticScale: 1 }, 1);
  const ext = Float64Array.of(2, 0);
  for (let t = 0; t < 50; t++) {
    step(withGain, ext.slice());
    step(without, ext.slice());
    assert.equal(withGain.v[1], without.v[1], `potential differs at step ${t}`);
    assert.equal(withGain.spikes[1], without.spikes[1], `spike differs at step ${t}`);
  }
});

test('G17: only edges into a neuron of a listed group are scaled', () => {
  // One presynaptic neuron (0) drives two equal-weight targets: 1 is in group "al", 2 has no group.
  const graph = {
    neuronCount: 3,
    edges: [{ pre: 0, post: 1, weight: 0.1 }, { pre: 0, post: 2, weight: 0.1 }],
    neuronGroup: { 1: 'al' },
  };
  const run = (overrides) => {
    const net = createNetwork(graph, overrides, 1);
    const ext = new Float64Array(3);
    let alCount = 0;
    let otherCount = 0;
    for (let t = 0; t < 300; t++) {
      ext[0] = 2.0; // drives neuron 0 to spike every time its refractory period allows
      step(net, ext);
      alCount += net.spikes[1];
      otherCount += net.spikes[2];
    }
    return { alCount, otherCount };
  };
  const scaled = run({ synapticScale: 10, groupGain: { al: 0.1 } });
  assert.ok(scaled.alCount < scaled.otherCount,
    `al-group spikes ${scaled.alCount} should be below the ungrouped neuron's ${scaled.otherCount}`);
  const baseline = run({ synapticScale: 10, groupGain: {} });
  assert.equal(baseline.alCount, baseline.otherCount, 'with groupGain {} both targets behave identically');
});

test('G17: a group with gain 1 matches the ungrouped case exactly', () => {
  const graph = {
    neuronCount: 3,
    edges: [{ pre: 0, post: 1, weight: 0.1 }, { pre: 0, post: 2, weight: 0.1 }],
    neuronGroup: { 1: 'vnc' },
  };
  const net = createNetwork(graph, { synapticScale: 10, groupGain: { vnc: 1 } }, 1);
  const ext = new Float64Array(3);
  for (let t = 0; t < 100; t++) {
    ext[0] = 2.0;
    step(net, ext);
    assert.equal(net.v[1], net.v[2], `potentials should match at step ${t} (vnc gain 1)`);
  }
});

test('G18: resolveParams rejects a groupGain that is not a plain object, or whose values are invalid', () => {
  const message = 'LIF parameter "groupGain" must be a map of region name to a number 0 or more';
  assert.throws(() => resolveParams({ groupGain: -1 }), { message });
  assert.throws(() => resolveParams({ groupGain: 'x' }), { message });
  assert.throws(() => resolveParams({ groupGain: [1, 2] }), { message });
  assert.throws(() => resolveParams({ groupGain: null }), { message });
  assert.throws(() => resolveParams({ groupGain: { al: -1 } }), { message });
  assert.throws(() => resolveParams({ groupGain: { al: 'x' } }), { message });
  assert.throws(() => resolveParams({ groupGain: { al: NaN } }), { message });
});
