// World config v3 (contracts/world-config-v3.md): flies.brain.version "v3", flies.brain.decoder,
// flies.body.locomotion/backup, flies.body.escape default true, flies.modulators.hunger.threshold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world-forager-demo.json', import.meta.url), 'utf8'));

function errorsFor(mutate) {
  const c = load();
  mutate(c);
  return validateConfig(c);
}

test('flies.brain.version accepts "v3"', () => {
  const errors = errorsFor(() => {});
  assert.deepEqual(errors.filter((e) => e.path === 'flies.brain.version'), []);
});

test('flies.brain.version rejects an unknown value, quoting every accepted one', () => {
  const errors = errorsFor((c) => { c.flies.brain.version = 'v9'; });
  const hit = errors.find((e) => e.path === 'flies.brain.version');
  assert.ok(hit);
  assert.equal(hit.message, 'must be "mock", "v0", "v1", "v2" or "v3"');
});

test('flies.brain.decoder is required for v3', () => {
  const errors = errorsFor((c) => { delete c.flies.brain.decoder; });
  const hit = errors.find((e) => e.path === 'flies.brain.decoder');
  assert.ok(hit);
  assert.equal(hit.message, 'is required for version "v3"');
});

test('flies.brain.decoder is forbidden for other versions', () => {
  const errors = errorsFor((c) => {
    c.flies.brain.version = 'v2';
    c.flies.brain.decoder = 'brains/x.decoder.json';
  });
  const hit = errors.find((e) => e.path === 'flies.brain.decoder');
  assert.ok(hit);
  assert.equal(hit.message, 'cannot be set for version "v2"');
});

test('flies.body.locomotion is required for v3', () => {
  const errors = errorsFor((c) => { delete c.flies.body.locomotion; });
  assert.ok(errors.some((e) => e.path === 'flies.body.locomotion' && e.message === 'is required for version "v3"'));
});

test('flies.body.backup is required for v3', () => {
  const errors = errorsFor((c) => { delete c.flies.body.backup; });
  assert.ok(errors.some((e) => e.path === 'flies.body.backup' && e.message === 'is required for version "v3"'));
});

test('flies.body.escape.enabled defaults to true for v3 (left unset is valid)', () => {
  const errors = errorsFor((c) => { delete c.flies.body.escape.enabled; });
  assert.deepEqual(errors.filter((e) => e.path.startsWith('flies.body.escape')), []);
});

test('flies.modulators.hunger.threshold must be a number from 0 to less than 1', () => {
  const tooHigh = errorsFor((c) => { c.flies.modulators.hunger.threshold = 1.5; });
  assert.ok(tooHigh.some((e) => e.path === 'flies.modulators.hunger.threshold'));
  const valid = errorsFor((c) => { c.flies.modulators.hunger.threshold = 0.6; });
  assert.deepEqual(valid.filter((e) => e.path === 'flies.modulators.hunger.threshold'), []);
});

test('the shipped world-forager-demo.json has no validation errors', () => {
  assert.deepEqual(errorsFor(() => {}), []);
});
