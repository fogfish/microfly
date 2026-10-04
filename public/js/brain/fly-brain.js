// Two-channel toy network (ADR 001 Annex A, research R5). Pure: no DOM, no workers.
// Neuron 0 is the sensory input, neuron 1 drives LEFT, neuron 2 drives RIGHT.
// Each motor output is an exponential moving average of its spike rate.

import { createPrng } from '../world/prng.js';
import { addMotorDrive, randomGraph } from './graph.js';
import { createNetwork, step as lifStep } from './lif.js';

const SENSORY = 0;
const LEFT = 1;
const RIGHT = 2;

// Defaults match contracts/fly-config.md. The host also validates these before sending.
export const BRAIN_DEFAULTS = Object.freeze({
  neuronCount: 40,
  outDegree: 4,
  inhibitoryFraction: 0.2,
  motorSmoothing: 0.05,
  telemetry: [0, 1, 2],
});

export function createFlyBrain(brainConfig, seed) {
  const cfg = { ...BRAIN_DEFAULTS, ...brainConfig };
  const { neuronCount, motorSmoothing, telemetry } = cfg;

  const graph = addMotorDrive(randomGraph({
    neuronCount,
    outDegree: cfg.outDegree,
    inhibitoryFraction: cfg.inhibitoryFraction,
    rand: createPrng(seed).next,
  }), { sensory: SENSORY, motors: [LEFT, RIGHT] });
  const net = createNetwork(graph, brainConfig.lif ?? {});
  const external = new Float64Array(neuronCount);

  let ticks = 0;
  let left = 0;
  let right = 0;

  // Runs one brain tick. tick is this step's index, counting from 0.
  function step(sensoryValue) {
    external[SENSORY] = sensoryValue;
    lifStep(net, external);

    left += motorSmoothing * (net.spikes[LEFT] - left);
    right += motorSmoothing * (net.spikes[RIGHT] - right);

    const selected = new Uint8Array(telemetry.length);
    telemetry.forEach((neuron, k) => { selected[k] = net.spikes[neuron]; });

    return { tick: ticks++, sensory: sensoryValue, left, right, selected };
  }

  return { net, neuronCount, step };
}
