// US5 Acceptance Scenario 2: flies.brain.version "v2" naming world-forager-15k-bad.json's container-v4
// snapshot refuses to start, the error message names both versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { parseSnapshot, checkBrainVersion } from '../public/js/brain/snapshot.js';

const BAD_WORLD = fileURLToPath(new URL('../public/world/world-forager-15k-bad.json', import.meta.url));
const V1_BRAIN = fileURLToPath(new URL('../public/brains/forager-brain.brain', import.meta.url));

test('world-forager-15k-bad.json passes config validation (the mismatch is a run-time snapshot-version check)', () => {
  const config = JSON.parse(readFileSync(BAD_WORLD, 'utf8'));
  assert.deepEqual(validateConfig(config), []);
  assert.equal(config.flies.brain.version, 'v2');
  assert.equal(config.flies.brain.snapshot, 'brains/forager-brain.brain');
});

test('loading its named snapshot and checking it against "v2" refuses, naming both versions', () => {
  const b = readFileSync(V1_BRAIN);
  const snap = parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  assert.equal(snap.version, 4);
  assert.throws(() => checkBrainVersion('v2', snap.version, 'brains/forager-brain.brain'), {
    message: 'flies.brain.version "v2" needs a version 5 snapshot; brains/forager-brain.brain is version 4',
  });
});
