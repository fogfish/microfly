// Random topology: fixed out-degree, no self or repeated edges, Dale's law, seeded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomGraph } from '../public/js/brain/graph.js';
import { createPrng } from '../public/js/world/prng.js';

const build = (seed, opts = {}) =>
  randomGraph({
    neuronCount: 40,
    outDegree: 4,
    inhibitoryFraction: 0.2,
    rand: createPrng(seed).next,
    ...opts,
  });

test('each neuron has exactly outDegree distinct targets', () => {
  const { edges } = build(1);
  for (let pre = 0; pre < 40; pre++) {
    const posts = edges.filter((e) => e.pre === pre).map((e) => e.post);
    assert.equal(posts.length, 4);
    assert.equal(new Set(posts).size, 4, `neuron ${pre} has repeated targets`);
  }
});

test('no self-edges', () => {
  assert.ok(build(2).edges.every((e) => e.pre !== e.post));
});

test("Dale's law: all outgoing edges of a neuron share one sign, and both signs occur", () => {
  const { edges } = build(3, { inhibitoryFraction: 0.5 });
  const signByPre = new Map();
  for (const e of edges) {
    assert.ok(e.weight === 1 || e.weight === -1);
    if (!signByPre.has(e.pre)) signByPre.set(e.pre, e.weight);
    assert.equal(e.weight, signByPre.get(e.pre), `neuron ${e.pre} mixes signs`);
  }
  assert.ok(new Set(signByPre.values()).size === 2, 'expected both excitatory and inhibitory neurons');
});

test('the same seed gives the same edge list, a different seed gives a different one', () => {
  assert.deepEqual(build(7).edges, build(7).edges);
  assert.notDeepEqual(build(7).edges, build(8).edges);
});

test('outDegree >= neuronCount throws the exact message', () => {
  assert.throws(
    () => build(1, { neuronCount: 4, outDegree: 4 }),
    { message: 'outDegree must be less than neuronCount' },
  );
});

test('addMotorDrive: the sensory neuron is excitatory and drives each motor, without repeated edges', async () => {
  const { addMotorDrive } = await import('../public/js/brain/graph.js');
  const g = addMotorDrive(build(11, { inhibitoryFraction: 1 }), { sensory: 0, motors: [1, 2] });
  const fromSensory = g.edges.filter((e) => e.pre === 0);
  assert.ok(fromSensory.every((e) => e.weight === 1), 'sensory edges must be excitatory');
  for (const m of [1, 2]) assert.equal(fromSensory.filter((e) => e.post === m).length, 1, `one edge 0 → ${m}`);
  assert.equal(new Set(fromSensory.map((e) => e.post)).size, fromSensory.length, 'no repeated targets');
  assert.deepEqual(g.edges.filter((e) => e.pre !== 0), build(11, { inhibitoryFraction: 1 }).edges.filter((e) => e.pre !== 0));
});
