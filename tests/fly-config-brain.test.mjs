// The brain choice in config (FR-002, FR-003; contracts/world-config-forager.md): version inference, the explicit
// versions, the refusals, and the version mismatch of a world and its snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveBrainVersion, resolveFlies } from '../public/js/fly/fly-config.js';
import { checkBrainVersion } from '../public/js/brain/snapshot.js';

const world = JSON.parse(readFileSync(fileURLToPath(new URL('../public/world/world.json', import.meta.url)), 'utf8'));
const withBrain = (brain) => ({ ...world, flies: { ...world.flies, brain } });
const messages = (brain) => validateConfig(withBrain(brain)).map((e) => `${e.path} ${e.message}`);

test('an absent version is mock without a snapshot and v0 with one', () => {
  assert.equal(resolveBrainVersion({ neuronCount: 40 }), 'mock');
  assert.equal(resolveBrainVersion({ snapshot: 'brains/x.brain' }), 'v0');
  assert.equal(resolveFlies(withBrain({ neuronCount: 40 })).brain.version, 'mock');
});

test('an explicit v1 is kept, and the resolved brain carries its version', () => {
  assert.equal(resolveBrainVersion({ version: 'v1', snapshot: 'brains/f.brain' }), 'v1');
});

test('an unknown version is refused with the contract message', () => {
  assert.ok(messages({ version: 'v9', snapshot: 'brains/f.brain' })
    .includes('flies.brain.version must be "mock", "v0", "v1" or "v2"'));
});

test('a snapshot with version "mock" is refused, and v1 needs a snapshot', () => {
  assert.ok(messages({ version: 'mock', snapshot: 'brains/f.brain' })
    .includes('flies.brain.snapshot cannot be set for version "mock"'));
  assert.ok(messages({ version: 'v1', neuronCount: 40 })
    .includes('flies.brain.snapshot is required for version "v1"'));
});

test('a v1 world naming a version 3 file is a mismatch, and a v0 world naming a version 4 file is one too', () => {
  assert.throws(() => checkBrainVersion('v1', 3, 'forager', 'brains/smallest-functional-brain.brain'), {
    message: 'flies.brain.version "v1" needs a version 4 snapshot; brains/smallest-functional-brain.brain is version 3',
  });
  assert.throws(() => checkBrainVersion('v0', 4, null, 'brains/forager-brain.brain'), {
    message: 'flies.brain.version "v0" needs a version 3 snapshot; brains/forager-brain.brain is version 4',
  });
  assert.doesNotThrow(() => checkBrainVersion('v1', 4, 'forager', 'brains/forager-brain.brain'));
  assert.doesNotThrow(() => checkBrainVersion('mock', 3, null, 'brains/x.brain'));
});

test('a v2 world naming a "forager" snapshot (or vice versa) is a kind mismatch', () => {
  assert.throws(() => checkBrainVersion('v2', 4, 'forager', 'brains/forager-brain-11k.brain'), {
    message: 'flies.brain.version "v2" needs a "forager-wide" snapshot; brains/forager-brain-11k.brain is kind "forager"',
  });
  assert.throws(() => checkBrainVersion('v1', 4, 'forager-wide', 'brains/forager-brain-wide.brain'), {
    message: 'flies.brain.version "v1" needs a "forager" snapshot; brains/forager-brain-wide.brain is kind "forager-wide"',
  });
  assert.doesNotThrow(() => checkBrainVersion('v2', 4, 'forager-wide', 'brains/forager-brain-wide.brain'));
});
