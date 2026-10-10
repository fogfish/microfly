// worker-core.js's handleV1 generalisation (research.md R7): a protocol-v3 message now reads msg.brain.version
// instead of hard-coding 'v1', and checks the container version against snapshot.js's own checkBrainVersion map
// instead of a local `=== 4` check. A v2 brain over protocol v3 now works, and a v1 message still resolves to
// v1 exactly as before. Runs on the extracted artifacts; skipped when either is absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as P3 from '../public/js/brain/protocol-v3.js';
import { createWorkerCore } from '../public/js/brain/worker-core.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const V1_FILE = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));
const V2_FILE = fileURLToPath(new URL('../public/brains/forager-brain-15k.brain', import.meta.url));
const SKIP_V1 = existsSync(V1_FILE) ? false : 'public/brains/forager-brain.brain is absent';
const SKIP_V2 = existsSync(V2_FILE) ? false : 'public/brains/forager-brain-15k.brain is absent';
const SKIP = SKIP_V1 || SKIP_V2;

function snap(file) {
  const b = readFileSync(file);
  return parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

test('a protocol-v3 init with brain.version "v2" and a container-v5 snapshot starts and senses correctly', { skip: SKIP }, () => {
  const core = createWorkerCore();
  const snapshot = snap(V2_FILE);
  const { reply: readyReply } = core.handle(P3.init({
    flyId: 'fly-v2', seed: 1, brain: { version: 'v2', snapshot, stepsPerTick: 1 },
  }));
  assert.equal(readyReply.type, 'ready');
  assert.equal(readyReply.neuronCount, snapshot.neuronCount);

  const inputs = new Float32Array(snapshot.capabilities.channels.inputs.length);
  const { reply: motorReply } = core.handle(P3.sense({ tick: 0, inputs, state: { hunger: 0.3 } }));
  assert.equal(motorReply.type, 'motor');
  assert.equal(motorReply.outputs.length, snapshot.capabilities.channels.outputs.length);
});

test('a protocol-v3 init with brain.version "v2" naming a v4 (not v5) snapshot is refused, naming both versions', { skip: SKIP }, () => {
  const core = createWorkerCore();
  const { reply } = core.handle(P3.init({
    flyId: 'fly-v2-bad', seed: 1, brain: { version: 'v2', snapshot: snap(V1_FILE), stepsPerTick: 1 },
  }));
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /needs a version 5 snapshot/);
  assert.match(reply.message, /version 4/);
});

test('regression: brain.version "v1" with a container-v4 snapshot still resolves to v1 exactly as before', { skip: SKIP }, () => {
  const core = createWorkerCore();
  const snapshot = snap(V1_FILE);
  const { reply: readyReply } = core.handle(P3.init({
    flyId: 'fly-v1', seed: 1, brain: { version: 'v1', snapshot, stepsPerTick: 1 },
  }));
  assert.equal(readyReply.type, 'ready');
  assert.equal(readyReply.neuronCount, snapshot.neuronCount);

  const inputs = new Float32Array(snapshot.capabilities.channels.inputs.length);
  const { reply: motorReply } = core.handle(P3.sense({ tick: 0, inputs, state: { hunger: 0.3 } }));
  assert.equal(motorReply.type, 'motor');
  assert.equal(motorReply.outputs.length, snapshot.capabilities.channels.outputs.length);
});

test('regression: brain.version "v1" naming a v5 (not v4) snapshot is refused, naming both versions', { skip: SKIP }, () => {
  const core = createWorkerCore();
  const { reply } = core.handle(P3.init({
    flyId: 'fly-v1-bad', seed: 1, brain: { version: 'v1', snapshot: snap(V2_FILE), stepsPerTick: 1 },
  }));
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /needs a version 4 snapshot/);
  assert.match(reply.message, /version 5/);
});
