// v0 brain runner (ADR 001 Annex A, research R5; ADR 002 for the snapshot). Pure: no DOM, no workers.
// The runner and LIF are the v0 code, kept as they were (lif-v0.js). Selected by flies.brain.version "mock" or "v0"
// through fly-brain.js. Neuron 0 is the sensory input. What the brain exposes is its declaration (capabilities.js): every
// declared output is an exponential moving average of its neuron's spike rate, and the outputs with a
// drive set the body's left and right values.
// Toy brains are random graphs wired from the declaration. A snapshot brain (brainConfig.snapshot, a
// parsed container) is the connectome graph from the file; the seed is not used by it (contracts/integration.md §2).

import { createPrng } from '../world/prng.js';
import { addMotorDrive, randomGraph } from './graph.js';
import { createNetwork, step as lifStep } from './lif-v0.js';
import { TOY_CAPABILITIES, validateCapabilities } from './capabilities.js';

const SENSORY = 0;

// Defaults match contracts/fly-config.md. The host also validates these before sending.
export const BRAIN_DEFAULTS = Object.freeze({
  neuronCount: 40,
  outDegree: 4,
  inhibitoryFraction: 0.2,
  motorSmoothing: 0.05,
});

export function createFlyBrain(brainConfig, seed) {
  if (brainConfig.snapshot !== undefined) return createSnapshotBrain(brainConfig);

  const cfg = { ...BRAIN_DEFAULTS, ...brainConfig };
  const { neuronCount, motorSmoothing } = cfg;
  const capabilities = brainConfig.capabilities ?? TOY_CAPABILITIES;
  const [problem] = validateCapabilities(capabilities, neuronCount, 'brain');
  if (problem) throw new Error(problem);

  const graph = addMotorDrive(randomGraph({
    neuronCount,
    outDegree: cfg.outDegree,
    inhibitoryFraction: cfg.inhibitoryFraction,
    rand: createPrng(seed).next,
  }), { sensory: SENSORY, motors: driveNeurons(capabilities) });
  const net = createNetwork(graph, brainConfig.lif ?? {});
  return runner({ net, neuronCount, motorSmoothing, capabilities });
}

function createSnapshotBrain(brainConfig) {
  const snap = brainConfig.snapshot;
  if (typeof snap === 'string') {
    throw new Error('snapshot must be resolved to a parsed container before the brain is built');
  }
  const { motorSmoothing } = { ...BRAIN_DEFAULTS, ...brainConfig };
  const neuronCount = snap.neuronCount;
  const net = createNetwork(
    { neuronCount, offsets: snap.offsets, targets: snap.targets, weights: snap.weights },
    brainConfig.lif ?? {},
  );
  return runner({ net, neuronCount, motorSmoothing, capabilities: snap.capabilities });
}

// The neurons of the outputs that drive the body, left first (the order the toy graph was wired in).
function driveNeurons(capabilities) {
  const byDrive = Object.fromEntries(capabilities.channels.outputs.filter((ch) => ch.drive).map((ch) => [ch.drive, ch.neuron]));
  return [byDrive.left, byDrive.right];
}

// Returns the indices of the neurons that spiked on this tick, ascending.
function spikeIndices(spikes) {
  let count = 0;
  for (let i = 0; i < spikes.length; i++) if (spikes[i]) count++;
  const out = new Uint32Array(count);
  let k = 0;
  for (let i = 0; i < spikes.length; i++) if (spikes[i]) out[k++] = i;
  return out;
}

// The per-tick loop, shared by both kinds. Only the graph construction differs.
function runner({ net, neuronCount, motorSmoothing, capabilities }) {
  const external = new Float64Array(neuronCount);
  const outputs = capabilities.channels.outputs;
  const outputNeurons = outputs.map((ch) => ch.neuron);
  const average = new Float64Array(outputs.length);
  const leftIndex = outputs.findIndex((ch) => ch.drive === 'left');
  const rightIndex = outputs.findIndex((ch) => ch.drive === 'right');
  let ticks = 0;

  // Runs one brain tick. tick is this step's index, counting from 0.
  function step(sensoryValue) {
    external[SENSORY] = sensoryValue;
    lifStep(net, external);

    for (let k = 0; k < average.length; k++) {
      average[k] += motorSmoothing * (net.spikes[outputNeurons[k]] - average[k]);
    }

    return {
      tick: ticks++,
      sensory: sensoryValue,
      left: average[leftIndex],
      right: average[rightIndex],
      outputs: Float32Array.from(average),
      spikes: spikeIndices(net.spikes),
    };
  }

  return { net, neuronCount, capabilities, step };
}
