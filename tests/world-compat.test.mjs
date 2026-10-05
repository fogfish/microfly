// Existing worlds keep working (FR-005, spec SC-002): the three shipped worlds validate unchanged, and their brains resolve
// to mock, v0 and v0 (contracts/world-config-forager.md, absent version).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveBrainVersion, resolveFlies } from '../public/js/fly/fly-config.js';

const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/world/${name}`, import.meta.url)), 'utf8'));

const CASES = [
  ['world.json', 'mock'],
  ['world-connectome.json', 'v0'],
  ['world-antennal-lobe.json', 'v0'],
];

for (const [name, version] of CASES) {
  test(`${name} validates unchanged and its brain resolves to ${version}`, () => {
    const config = load(name);
    assert.deepEqual(validateConfig(config), []);
    assert.equal(resolveBrainVersion(config.flies.brain), version);
    assert.equal(resolveFlies(config).brain.version, version);
  });
}
