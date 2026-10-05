// ADR 001 Stage 1 checks: determinism, constant-drive ISI, refractory steps, inhibition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetwork, step } from '../public/js/brain/lif-v0.js';
import { randomGraph } from '../public/js/brain/graph.js';
import { createPrng } from '../public/js/world/prng.js';

const runTrain = (net, drive, steps, neuron = 0) => {
  const external = new Float64Array(net.n);
  const train = [];
  for (let t = 0; t < steps; t++) {
    external[neuron] = drive;
    step(net, external);
    train.push(net.spikes.slice());
  }
  return train;
};

test('same seed and graph give the same spike train', () => {
  const graph = () => randomGraph({ neuronCount: 30, outDegree: 4, inhibitoryFraction: 0.2, rand: createPrng(42).next });
  const a = runTrain(createNetwork(graph()), 0.5, 500);
  const b = runTrain(createNetwork(graph()), 0.5, 500);
  assert.deepEqual(a, b);
  assert.ok(a.some((s) => s.some((x) => x === 1)), 'the run should contain spikes');
});

test('constant drive gives equal inter-spike intervals', () => {
  const net = createNetwork({ neuronCount: 1, edges: [] });
  const times = [];
  const external = new Float64Array(1);
  for (let t = 0; t < 400; t++) {
    external[0] = 0.2;
    step(net, external);
    if (net.spikes[0]) times.push(t);
  }
  assert.ok(times.length >= 4, 'expected several spikes');
  const isis = times.slice(1).map((t, i) => t - times[i]);
  assert.ok(isis.every((x) => x === isis[0]), `ISIs differ: ${isis}`);
});

test('a neuron stays silent for refractorySteps after each spike', () => {
  const net = createNetwork({ neuronCount: 1, edges: [] }, { refractorySteps: 2 });
  const times = [];
  const external = new Float64Array(1);
  for (let t = 0; t < 300; t++) {
    external[0] = 1.0;
    step(net, external);
    if (net.spikes[0]) times.push(t);
  }
  assert.ok(times.length > 3);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] - times[i - 1] > 2, `spikes at ${times[i - 1]} and ${times[i]} are too close`);
  }
});

test('an inhibitory edge lowers downstream firing compared with no edge', () => {
  // Neuron 0 is driven hard and fires. Neuron 1 gets a drive that fires it alone, slowly.
  const count = (weight) => {
    const graph = { neuronCount: 2, edges: weight === null ? [] : [{ pre: 0, post: 1, weight }] };
    const net = createNetwork(graph);
    const external = new Float64Array(2);
    let spikes = 0;
    for (let t = 0; t < 500; t++) {
      external[0] = 0.5;
      external[1] = 0.06;
      step(net, external);
      spikes += net.spikes[1];
    }
    return spikes;
  };
  const none = count(null);
  const inhibitory = count(-1);
  assert.ok(none > 0, 'the post neuron must fire without the edge for the test to mean anything');
  assert.ok(inhibitory < none, `inhibitory ${inhibitory} should be below none ${none}`);
});
