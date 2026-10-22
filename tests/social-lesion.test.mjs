// T050 (contracts/social-experiment.md): `lesion` zeroes only the listed input channels' out-edge weights,
// and the lockstep loop (refresh-then-step-everyone) gives identical telemetry whichever order the flies step
// in, because every fly senses the same frozen conspecific table built before any of them stepped this tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lesion, SOCIAL_INPUT_CHANNELS, loadWorld } from '../scripts/social-arms.mjs';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { validateConfig } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { createFood } from '../public/js/fly/food.js';
import { initForagerFly } from '../public/js/fly/forager-step.js';
import { initBodyLayerFly } from '../public/js/fly/body-layer.js';
import { createDecoderState } from '../public/js/fly/decoder.js';
import { forageEnvWide, refreshConspecifics, stepForagerFlyV3 } from '../public/js/fly/forager-step-wide.js';

const WEB = new URL('../public/', import.meta.url);

function readSnapshot(path) {
  const bytes = readFileSync(new URL(path, WEB));
  return parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

const snapshot = readSnapshot('brains/forager-brain-social.brain');

test('lesion zeroes only the out-edge weights of the listed channels\' input neurons', () => {
  const lesioned = lesion(snapshot, SOCIAL_INPUT_CHANNELS);

  // Offsets, targets and neuron count are kept exactly (contract: "indices kept").
  assert.equal(lesioned.neuronCount, snapshot.neuronCount);
  assert.deepEqual([...lesioned.offsets], [...snapshot.offsets]);
  assert.deepEqual([...lesioned.targets], [...snapshot.targets]);
  assert.notEqual(lesioned.weights, snapshot.weights); // a fresh array, the original is untouched

  const lesionedNeurons = new Set(
    snapshot.capabilities.channels.inputs.filter((ch) => SOCIAL_INPUT_CHANNELS.includes(ch.id))
      .flatMap((ch) => ch.neurons),
  );
  assert.ok(lesionedNeurons.size > 0);

  let checkedZeroed = 0;
  let checkedUnchanged = 0;
  for (let pre = 0; pre < snapshot.neuronCount; pre++) {
    const from = snapshot.offsets[pre];
    const to = snapshot.offsets[pre + 1];
    if (lesionedNeurons.has(pre)) {
      for (let k = from; k < to; k++) { assert.equal(lesioned.weights[k], 0); checkedZeroed++; }
    } else {
      for (let k = from; k < to; k++) { assert.equal(lesioned.weights[k], snapshot.weights[k]); checkedUnchanged++; }
    }
  }
  assert.ok(checkedZeroed > 0, 'expected at least one zeroed out-edge');
  assert.ok(checkedUnchanged > 0, 'expected at least one unchanged out-edge');
});

test('lesion rejects an unknown channel id', () => {
  assert.throws(() => lesion(snapshot, ['not-a-real-channel']), /unknown input channel/);
});

test('lockstep: swapping the step order of two flies gives identical telemetry', () => {
  const { f, world, expConfig, snapshot: snap, decoder } = loadWorld('world/world-forager-social.json');
  const bodyLayerCfg = { locomotion: f.body.locomotion, escape: f.body.escape, backup: f.body.backup, motor: f.body.motor, song: f.body.song };
  const brainConfig = { ...f.brain, snapshot: snap, version: 'v3', modulators: f.modulators };
  delete brainConfig.learning;
  if (brainConfig.lif) brainConfig.lif = { ...brainConfig.lif, plasticity: null };

  function run(order) {
    const seeded = { ...expConfig, flies: { ...expConfig.flies, seed: 2001 } };
    const flies = spawnFlies(seeded, world, 'toy');
    const flowers = createFood(world, f);
    const env = { ...forageEnvWide(f, world, flowers, snap.capabilities), flowers, foodConfig: f.food, energyConfig: f.body.energy };
    const brains = flies.map((fly) => createFlyBrain(brainConfig, fly.brainSeed));
    const decoderStates = flies.map(() => createDecoderState(decoder, snap.capabilities.channels.inputs));
    for (const fly of flies) { initForagerFly(fly, f.body.energy.initial); initBodyLayerFly(fly, fly.brainSeed); }
    const telemetry = flies.map(() => []);
    for (let t = 0; t < 30; t++) {
      refreshConspecifics(env, flies);
      for (const i of order) {
        const { sense, motor, decoded } = stepForagerFlyV3(flies[i], env, brains[i], decoderStates[i], decoder, bodyLayerCfg);
        telemetry[i].push({ x: flies[i].body.x, y: flies[i].body.y, heading: flies[i].body.heading, outputs: [...motor.outputs], inputs: [...sense.inputs], song: decoded.named.song?.drive ?? null });
      }
    }
    return telemetry;
  }

  const forward = run([0, 1]);
  const reversed = run([1, 0]);
  assert.deepEqual(forward, reversed);
});
