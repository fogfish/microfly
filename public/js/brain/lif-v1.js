// Leaky integrate-and-fire core, version 1 (contracts/lif-v1.md; ADR 003 L1–L5). No DOM, no workers.
// Pure: the same graph, parameters, drive and seed give the same spike train. With the default parameters
// the update is exactly lif-v0.js (guarantee G1), so every mechanism below is off unless a config sets it.

import { createPrng } from '../world/prng.js';

export const LIF_V1_DEFAULTS = Object.freeze({
  dt: 1.0,                // simulation time per step (time units)
  tau: 20.0,              // membrane time constant (time units)
  vRest: 0.0,             // resting potential
  vReset: 0.0,            // potential after a spike
  vThreshold: 1.0,        // firing threshold
  refractorySteps: 2,     // steps silent after a spike
  synapticScale: 0.2,     // potential added per unit of edge weight
  tauSyn: 0,              // synaptic current time constant (L1); 0 is the delta synapse
  tauAdapt: 0,            // adaptation time constant (L2); 0 is no adaptation
  adaptStep: 0,           // adaptation increase per spike (L2)
  thresholdJitter: 0,     // fraction of threshold spread per neuron, in [0, 1) (L3)
  stepsPerTick: 1,        // LIF steps per world tick (L5); read by the runner, the core ignores it
});

// Merges overrides into LIF_V1_DEFAULTS and checks them. Throws an Error naming the parameter.
export function resolveParams(overrides = {}) {
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(LIF_V1_DEFAULTS, key)) throw new Error(`unknown LIF parameter "${key}"`);
  }
  const p = { ...LIF_V1_DEFAULTS, ...overrides };
  if (!(p.dt > 0)) throw new Error('LIF parameter "dt" must be greater than 0');
  if (!(p.tau > 0)) throw new Error('LIF parameter "tau" must be greater than 0');
  if (!Number.isInteger(p.refractorySteps) || p.refractorySteps < 0) {
    throw new Error('LIF parameter "refractorySteps" must be an integer of 0 or more');
  }
  if (!(p.vThreshold > p.vReset)) throw new Error('LIF parameter "vThreshold" must be greater than vReset');
  if (!(p.tauSyn >= 0)) throw new Error('LIF parameter "tauSyn" must be 0 or more');
  if (!(p.tauAdapt >= 0)) throw new Error('LIF parameter "tauAdapt" must be 0 or more');
  if (!(p.adaptStep >= 0)) throw new Error('LIF parameter "adaptStep" must be 0 or more');
  if (!(p.thresholdJitter >= 0 && p.thresholdJitter < 1)) {
    throw new Error('LIF parameter "thresholdJitter" must be from 0 to less than 1');
  }
  if (!(Number.isInteger(p.stepsPerTick) && p.stepsPerTick >= 1 && p.stepsPerTick <= 20)) {
    throw new Error('LIF parameter "stepsPerTick" must be an integer from 1 to 20');
  }
  return Object.freeze(p);
}

// Accepts the toy form { neuronCount, edges } or the CSR form { neuronCount, offsets, targets, weights }.
// seed is the fly's brain seed; it is used only for thresholdJitter.
export function createNetwork(graph, overrides = {}, seed = 0) {
  const params = resolveParams(overrides);
  const n = graph.neuronCount;
  const csr = graph.offsets !== undefined ? graph : toCsr(graph);
  // L3: one draw per neuron in index order, and none when the jitter is 0.
  const threshold = new Float64Array(n).fill(params.vThreshold);
  if (params.thresholdJitter > 0) {
    const rand = createPrng(seed).next;
    for (let i = 0; i < n; i++) {
      threshold[i] = params.vThreshold * (1 + params.thresholdJitter * (2 * rand() - 1));
    }
  }
  return {
    params, n,
    offsets: csr.offsets,
    targets: csr.targets,
    weights: csr.weights,
    v: new Float64Array(n).fill(params.vRest),
    refractory: new Int32Array(n),
    input: new Float64Array(n),   // synaptic input delivered on the next step (the arrivals of the last step)
    spikes: new Uint8Array(n),    // spikes emitted by the last step
    threshold,                    // per-neuron firing threshold (L3)
    syn: new Float64Array(n),     // synaptic current (L1), used only when tauSyn > 0
    adapt: new Float64Array(n),   // adaptation variable (L2), used only when tauAdapt > 0
    spare: new Float64Array(n),   // the buffer the next step's arrivals are written to (swapped, not reallocated)
  };
}

// Groups an edge list by presynaptic neuron, preserving the input order within each neuron (as lif-v0).
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

// external: Float64Array(n) of drive for this step (zeros if none).
// With tauSyn = 0 and tauAdapt = 0 the update is lif-v0's, in its order (the off path, G1).
export function step(net, external) {
  const { params: p, n, v, refractory, input, spikes, offsets, targets, weights, threshold, syn, adapt } = net;
  const nextInput = net.spare;
  nextInput.fill(0);
  const delta = p.tauSyn > 0;
  const adaptive = p.tauAdapt > 0;
  const decaySyn = delta ? Math.exp(-p.dt / p.tauSyn) : 0;
  const decayAdapt = adaptive ? Math.exp(-p.dt / p.tauAdapt) : 0;
  spikes.fill(0);
  for (let i = 0; i < n; i++) {
    // L1: the arrivals of this step are low-pass filtered; the delta synapse passes them straight through.
    let drive = input[i];
    if (delta) {
      syn[i] = syn[i] * decaySyn + input[i] * (1 - decaySyn);
      drive = syn[i];
    }
    if (adaptive) adapt[i] *= decayAdapt;

    if (refractory[i] > 0) { refractory[i]--; continue; }
    const leak = (p.dt / p.tau) * (p.vRest - v[i]);
    v[i] += adaptive ? leak + drive + external[i] - adapt[i] : leak + drive + external[i];
    if (v[i] >= threshold[i]) {
      v[i] = p.vReset;
      refractory[i] = p.refractorySteps;
      spikes[i] = 1;
      if (adaptive) adapt[i] += p.adaptStep;
      for (let k = offsets[i]; k < offsets[i + 1]; k++) {
        nextInput[targets[k]] += weights[k] * p.synapticScale;
      }
    }
  }
  net.input = nextInput;
  net.spare = input;
}
