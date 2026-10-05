// Leaky integrate-and-fire core. No DOM, no workers, no hidden constants.
// Pure: the same graph, parameters and drive give the same spike train.

export const LIF_DEFAULTS = Object.freeze({
  dt: 1.0,             // simulation time per step (time units)
  tau: 20.0,           // membrane time constant (time units)
  vRest: 0.0,          // resting potential
  vReset: 0.0,         // potential after a spike
  vThreshold: 1.0,     // firing threshold
  refractorySteps: 2,  // steps silent after a spike
  synapticScale: 0.2,  // potential added per unit of edge weight
});

// Merges overrides into LIF_DEFAULTS and checks them. Throws an Error naming the parameter.
export function resolveParams(overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(LIF_DEFAULTS, key)) throw new Error(`unknown LIF parameter "${key}"`);
  }
  const p = { ...LIF_DEFAULTS, ...overrides };
  if (!(p.dt > 0)) throw new Error('LIF parameter "dt" must be greater than 0');
  if (!(p.tau > 0)) throw new Error('LIF parameter "tau" must be greater than 0');
  if (!Number.isInteger(p.refractorySteps) || p.refractorySteps < 0) {
    throw new Error('LIF parameter "refractorySteps" must be an integer of 0 or more');
  }
  if (!(p.vThreshold > p.vReset)) throw new Error('LIF parameter "vThreshold" must be greater than vReset');
  return Object.freeze(p);
}

// Accepts the toy form { neuronCount, edges } or the CSR form { neuronCount, offsets, targets, weights }
// from a brain snapshot. Both are stored as CSR, keeping each neuron's edges in input order, so the
// toy spike train is the same as the edge-list version it replaces (tests/lif-golden.test.mjs).
export function createNetwork(graph, overrides = {}) {
  const params = resolveParams(overrides);
  const n = graph.neuronCount;
  const csr = graph.offsets !== undefined ? graph : toCsr(graph);
  return {
    params, n,
    offsets: csr.offsets,
    targets: csr.targets,
    weights: csr.weights,
    v: new Float64Array(n).fill(params.vRest),
    refractory: new Int32Array(n),
    input: new Float64Array(n),   // synaptic input delivered on the next step
    spikes: new Uint8Array(n),    // spikes emitted by the last step
  };
}

// Groups an edge list by presynaptic neuron, preserving the input order within each neuron.
function toCsr({ neuronCount: n, edges }) {
  const offsets = new Uint32Array(n + 1);
  for (const { pre } of edges) offsets[pre + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  const targets = new Uint32Array(edges.length);
  const weights = new Float64Array(edges.length);
  const fill = offsets.slice(0, n);
  for (const { pre, post, weight } of edges) {
    const k = fill[pre]++;
    targets[k] = post;
    weights[k] = weight;
  }
  return { offsets, targets, weights };
}

// external: Float64Array(n) of sensory drive for this step (zeros if none)
export function step(net, external) {
  const { params: p, n, v, refractory, input, spikes, offsets, targets, weights } = net;
  const nextInput = new Float64Array(n);
  spikes.fill(0);
  for (let i = 0; i < n; i++) {
    if (refractory[i] > 0) { refractory[i]--; continue; }
    v[i] += (p.dt / p.tau) * (p.vRest - v[i]) + input[i] + external[i];
    if (v[i] >= p.vThreshold) {
      v[i] = p.vReset;
      refractory[i] = p.refractorySteps;
      spikes[i] = 1;
      for (let k = offsets[i]; k < offsets[i + 1]; k++) {
        nextInput[targets[k]] += weights[k] * p.synapticScale;
      }
    }
  }
  net.input = nextInput;
}
