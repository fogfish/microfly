// flies.brain.snapshot (contracts/integration.md §1): accepted alone, rejected with toy-only settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';

const load = () => JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
const snapshotBrain = () => ({
  snapshot: 'brains/smallest-functional-brain.brain',
  telemetry: [0, 1, 2],
  motorSmoothing: 0.05,
  lif: { synapticScale: 0.2 },
});

test('a snapshot brain with no toy-only fields validates', () => {
  const c = load();
  c.flies.brain = snapshotBrain();
  assert.deepEqual(validateConfig(c), []);
});

for (const key of ['neuronCount', 'outDegree', 'inhibitoryFraction']) {
  test(`"snapshot" with "${key}" is rejected and the error names both settings`, () => {
    const c = load();
    c.flies.brain = { ...snapshotBrain(), [key]: key === 'neuronCount' ? 40 : key === 'outDegree' ? 4 : 0.2 };
    const errors = validateConfig(c);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].path, 'flies.brain');
    assert.match(errors[0].message, /"snapshot" cannot be combined with/);
    assert.ok(errors[0].message.includes(`"${key}"`), errors[0].message);
  });
}

test('a snapshot that is not a non-empty string is rejected', () => {
  for (const bad of [42, '', null, ['x.brain']]) {
    const c = load();
    c.flies.brain = { ...snapshotBrain(), snapshot: bad };
    const errors = validateConfig(c);
    assert.deepEqual(errors.map((e) => e.path), ['flies.brain.snapshot'], `value ${JSON.stringify(bad)}`);
  }
});

test('the unchanged default toy config still validates', () => {
  assert.deepEqual(validateConfig(load()), []);
});
