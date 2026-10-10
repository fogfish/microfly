// ADR 006: resolveBrainVersion is unaffected by v2; v2 defaults merge correctly (flies.body.sites/escape,
// flies.stimuli, brain.input); a v2/non-v5-snapshot mismatch is refused, naming both versions (spec
// Acceptance Scenario 2 of US5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveBrainVersion, resolveFlies } from '../public/js/fly/fly-config.js';
import { checkBrainVersion } from '../public/js/brain/snapshot.js';

const WORLD = JSON.parse(readFileSync(fileURLToPath(new URL('../public/world/world.json', import.meta.url)), 'utf8'));
const V2_WORLD_PATH = fileURLToPath(new URL('../public/world/world-forager-15k.json', import.meta.url));

test('resolveBrainVersion is unaffected by this feature: absent is still mock/v0, explicit v1 still kept', () => {
  assert.equal(resolveBrainVersion({ neuronCount: 40 }), 'mock');
  assert.equal(resolveBrainVersion({ snapshot: 'brains/x.brain' }), 'v0');
  assert.equal(resolveBrainVersion({ version: 'v1', snapshot: 'brains/f.brain' }), 'v1');
  assert.equal(resolveBrainVersion({ version: 'v2', snapshot: 'brains/f15k.brain' }), 'v2');
});

test('v2 is accepted by validate.js, listed alongside mock/v0/v1', () => {
  const withBrain = (brain) => ({ ...WORLD, flies: { ...WORLD.flies, brain } });
  const messages = (brain) => validateConfig(withBrain(brain)).map((e) => `${e.path} ${e.message}`);
  assert.ok(messages({ version: 'v9', snapshot: 'brains/f.brain' })
    .includes('flies.brain.version must be one of "mock", "v0", "v1", "v2"'));
});

test('the shipped world-forager-15k.json validates with no errors', () => {
  const config = JSON.parse(readFileSync(V2_WORLD_PATH, 'utf8'));
  assert.deepEqual(validateConfig(config), []);
});

test('v2 defaults merge: body.escape gets its ADR 006 W8 defaults, body.sites/stimuli pass through', () => {
  const config = JSON.parse(readFileSync(V2_WORLD_PATH, 'utf8'));
  const f = resolveFlies(config);
  assert.equal(f.brain.version, 'v2');
  assert.deepEqual(f.body.sites, { antenna: 0.5, mouth: 0, 'front-leg': 0.4 });
  assert.deepEqual(f.body.escape, { threshold: 0.5, distance: 1.5, cooldown: 2 });
  assert.ok(f.stimuli['odour:food']);
  assert.equal(f.brain.input.encoding, 'poisson');
});

test('body.sites/body.escape/stimuli are absent for a v1 world (no default forced on it)', () => {
  const f = resolveFlies(JSON.parse(readFileSync(
    fileURLToPath(new URL('../public/world/world-forager.json', import.meta.url)), 'utf8')));
  assert.equal(f.brain.version, 'v1');
  assert.equal(f.body.sites, undefined);
  assert.equal(f.body.escape, undefined);
  assert.equal(f.stimuli, undefined);
});

test('a mismatch names both versions: v2 needs a version 5 snapshot', () => {
  assert.throws(() => checkBrainVersion('v2', 4, 'brains/forager-brain.brain'), {
    message: 'flies.brain.version "v2" needs a version 5 snapshot; brains/forager-brain.brain is version 4',
  });
  assert.doesNotThrow(() => checkBrainVersion('v2', 5, 'brains/forager-brain-15k.brain'));
});
