// Forager brain runner, version 1 (ADR 003 L4–L5, D5; contracts/lif-v1.md, world-config-forager.md). Pure: no DOM, no
// workers. Built from a parsed version 4 snapshot (snapshot.js), with the LIF core of lif-v1.js.
//
// Input pools: every neuron of input channel c gets clamp(gain_c(h) × value_c, 0, max_c). gain_c(h) is the product of
// the gains of the snapshot's modulators that target c, each g0 + (g1 − g0) × m, where m is h for a range modulator and
// the value of its source for a modulator with a source. The resting level is in value_c (the host sends the sensory
// value with its resting level, see stimulus.js), so the drive has no separate resting term.
// Outputs: each declared output is an exponential moving average of its pool's mean spike rate, updated once per LIF
// step, in declaration order. The rate is bounded by 1 / (refractorySteps + 1) (ADR 003 W4), so the drive is the rate
// over that ceiling, clamped to the declared range: the rate that maps to 1. A tick runs stepsPerTick LIF steps with the
// same drive (L5); its spikes are the union of the spikes of its steps, ascending.

import { createNetwork, step as lifStep } from './lif-v1.js';
import { checkBrainVersion } from './snapshot.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createFlyBrain(brainConfig, seed) {
  const snap = brainConfig.snapshot;
  if (snap === undefined || typeof snap === 'string') {
    throw new Error('the v1 brain needs a parsed version 4 snapshot');
  }
  checkBrainVersion('v1', snap.version, 'snapshot');

  const { neuronCount, offsets, targets, weights, capabilities } = snap;
  const net = createNetwork({ neuronCount, offsets, targets, weights }, brainConfig.lif ?? {}, seed);
  const stepsPerTick = brainConfig.stepsPerTick ?? 1;
  const motorSmoothing = brainConfig.motorSmoothing ?? 0.05;
  const inputs = capabilities.channels.inputs;
  const outputs = capabilities.channels.outputs;
  const modulators = snap.modulators ?? [];
  const lastDrive = new Float64Array(neuronCount);
  const average = new Float64Array(outputs.length);
  const rateCeiling = 1 / (net.params.refractorySteps + 1);
  const seen = new Uint8Array(neuronCount);
  let ticks = 0;

  // The value of a modulator at hunger h: the signal itself for a range modulator, else its source's value.
  function modulatorValue(mod, hunger) {
    if (mod.range !== undefined) return hunger;
    return modulatorValue(modulators.find((m) => m.id === mod.source), hunger);
  }

  // One gain per input channel, from every modulator that targets the channel.
  function channelGains(hunger) {
    return inputs.map((ch) => {
      let gain = 1;
      for (const mod of modulators) {
        if (!mod.targets.includes(ch.id)) continue;
        const [g0, g1] = mod.gain;
        gain *= g0 + (g1 - g0) * modulatorValue(mod, hunger);
      }
      return gain;
    });
  }

  // Runs one brain tick. values: Float32Array with one value per declared input; hunger in [0, 1].
  function step({ inputs: values, hunger }) {
    if (!(typeof hunger === 'number' && hunger >= 0 && hunger <= 1)) {
      throw new Error('hunger must be a number from 0 to 1');
    }
    if (values.length !== inputs.length) {
      throw new Error(`sense.inputs must have ${inputs.length} entries, one per declared input`);
    }

    const gains = channelGains(hunger);
    lastDrive.fill(0);
    inputs.forEach((ch, c) => {
      const drive = clamp(gains[c] * values[c], 0, ch.range[1]);
      for (const neuron of ch.neurons) lastDrive[neuron] = drive;
    });

    seen.fill(0);
    for (let s = 0; s < stepsPerTick; s++) {
      lifStep(net, lastDrive);
      outputs.forEach((ch, k) => {
        let fired = 0;
        for (const neuron of ch.neurons) fired += net.spikes[neuron];
        average[k] += motorSmoothing * (fired / ch.neurons.length - average[k]);
      });
      for (let i = 0; i < neuronCount; i++) if (net.spikes[i]) seen[i] = 1;
    }

    let count = 0;
    for (let i = 0; i < neuronCount; i++) if (seen[i]) count++;
    const spikes = new Uint32Array(count);
    for (let i = 0, k = 0; i < neuronCount; i++) if (seen[i]) spikes[k++] = i;

    const drives = outputs.map((ch, k) => clamp(average[k] / rateCeiling, ch.range[0], ch.range[1]));
    return {
      tick: ticks++,
      inputs: Float32Array.from(values),
      hunger,
      outputs: Float32Array.from(drives),
      spikes,
      steps: stepsPerTick,
    };
  }

  return { net, neuronCount, capabilities, lastDrive, step };
}
