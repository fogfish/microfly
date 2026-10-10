// Forager brain runner, version 2 (ADR 006 L9, L10; contracts/lif-v1-groupgain.md, world-config-forager-v2.md).
// Pure: no DOM, no workers. Built from a parsed version 5 snapshot (snapshot.js), with the LIF core of lif-v1.js.
//
// Input encoding (L9, world config `brain.input.encoding`): "current" is exactly v1's constant-drive behaviour
// (ADR 003 L4) — every neuron of input channel c gets clamp(gain_c(h) × value_c, 0, max_c) as a continuous
// external current, the same value on every LIF step of the tick. "poisson" instead draws, for every input
// neuron and every LIF step, an independent Bernoulli(p) sample from one dedicated stream, where
// p = r0 + (r1 − r0) × clamp(gain_c(h) × value_c, 0, 1); a drawn spike contributes `weight` to that neuron's
// external input for that one step only, otherwise 0. The stream is seeded from the fly's own seed, salted
// distinctly from lif-v1.js's jitter and noise streams (research.md R5), so the three never correlate by sharing
// a raw seed value; the same seed always gives the same draws (Principle V).
//
// Outputs: the same exponential-moving-average scheme fly-brain-v1.js uses, generalised to however many output
// channels the snapshot declares (6 for this brain, including escape, instead of v1's fixed 5). A tick runs
// stepsPerTick LIF steps with the drive recomputed every step under "poisson" (every step is a fresh draw) or
// held constant under "current" (L5); its spikes are the union of the spikes of its steps, ascending.
//
// graph.neuronGroup (L10) is read from the snapshot's per-neuron `group` field and threaded into lif-v1.js's
// createNetwork, so a world config's `lif.groupGain` can scale edges into a region; with no groupGain this is
// inert (G16).

import { createNetwork, step as lifStep } from './lif-v1.js';
import { checkBrainVersion } from './snapshot.js';
import { createPrng } from '../world/prng.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const INPUT_SALT = 0x8f1b1e9d; // tags the Poisson input stream distinctly from lif-v1.js's own PRNG streams

export function createV2FlyBrain(brainConfig, seed) {
  const snap = brainConfig.snapshot;
  if (snap === undefined || typeof snap === 'string') {
    throw new Error('the v2 brain needs a parsed version 5 snapshot');
  }
  checkBrainVersion('v2', snap.version, 'snapshot');

  const { neuronCount, offsets, targets, weights, capabilities } = snap;
  const neuronGroup = (snap.manifest?.neurons ?? []).map((n) => n.group);
  const net = createNetwork(
    {
      neuronCount, offsets, targets, weights,
      outputNeurons: capabilities.channels.outputs.flatMap((ch) => ch.neurons),
      // BUG-002: channel-grouped membership, so lif-v1.js can resolve a per-channel outputScale.
      outputChannels: capabilities.channels.outputs.map((ch) => ({ id: ch.id, neurons: ch.neurons })),
      // L7′ (ADR 005 Annex B): the sensory pools, so noise can be confined to them (noiseBulkScale).
      inputNeurons: capabilities.channels.inputs.flatMap((ch) => ch.neurons),
      neuronGroup, // L10: per-neuron region, read by lif-v1.js's optional groupGain
    },
    brainConfig.lif ?? {},
    seed,
  );
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

  const encoding = brainConfig.input?.encoding ?? 'current';
  const poisson = encoding === 'poisson';
  const [r0, r1] = poisson ? brainConfig.input.rate : [0, 0];
  const spikeWeight = poisson ? brainConfig.input.weight : 0;
  // L9: one dedicated PRNG stream for the whole input encoding, drawn from in declared-channel, then
  // within-channel-neuron order, every step — never reused for jitter or noise.
  const inputRand = poisson ? createPrng((seed ^ INPUT_SALT) >>> 0).next : undefined;

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
    if (!poisson) {
      // "current" (ADR 003 L4): the same clamped drive on every step of the tick.
      lastDrive.fill(0);
      inputs.forEach((ch, c) => {
        const drive = clamp(gains[c] * values[c], 0, ch.range[1]);
        for (const neuron of ch.neurons) lastDrive[neuron] = drive;
      });
    }
    // "poisson" (L9): the rate per channel is resolved once per tick; the Bernoulli draw itself is per step.
    const rate = poisson ? inputs.map((ch, c) => r0 + (r1 - r0) * clamp(gains[c] * values[c], 0, 1)) : null;

    seen.fill(0);
    for (let s = 0; s < stepsPerTick; s++) {
      if (poisson) {
        lastDrive.fill(0);
        inputs.forEach((ch, c) => {
          for (const neuron of ch.neurons) {
            lastDrive[neuron] = inputRand() < rate[c] ? spikeWeight : 0;
          }
        });
      }
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
