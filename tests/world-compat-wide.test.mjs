// US3 (spec FR-001-FR-005): mock, v0, the shipped v1 forager and the 11K brain keep working with no file
// change; a "v2" value is additive. A world naming the wide-I/O snapshot under the wrong brain version is
// refused at snapshot load, naming both the expected and the actual kind (exactly as world-forager-11k-bad.json
// already does for a version mismatch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveBrainVersion, resolveFlies } from '../public/js/fly/fly-config.js';
import { parseSnapshot, checkBrainVersion } from '../public/js/brain/snapshot.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../public/js/fly/fly-world.js';
import { createFood } from '../public/js/fly/food.js';
import { forageEnvWide, senseForagerFlyWide } from '../public/js/fly/forager-step-wide.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';

const load = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/world/${name}`, import.meta.url)), 'utf8'));

const CASES = [
  ['world.json', 'mock'],
  ['world-connectome.json', 'v0'],
  ['world-antennal-lobe.json', 'v0'],
  ['world-forager.json', 'v1'],
  ['world-forager-11k.json', 'v1'],
];

for (const [name, version] of CASES) {
  test(`${name} validates unchanged and its brain resolves to ${version} (regression guard)`, () => {
    const config = load(name);
    assert.deepEqual(validateConfig(config), []);
    assert.equal(resolveBrainVersion(config.flies.brain), version);
    assert.equal(resolveFlies(config).brain.version, version);
  });
}

test('world-forager-wide.json validates and resolves to "v2"', () => {
  const config = load('world-forager-wide.json');
  assert.deepEqual(validateConfig(config), []);
  assert.equal(resolveBrainVersion(config.flies.brain), 'v2');
  assert.equal(resolveFlies(config).brain.version, 'v2');
});

test('world-forager-wide-bad.json passes the format check; it fails on its snapshot kind at run time', () => {
  const config = load('world-forager-wide-bad.json');
  assert.deepEqual(validateConfig(config), []);
  assert.equal(resolveBrainVersion(config.flies.brain), 'v1'); // the 11K world's own version, unedited
});

// contracts/stimuli-field-sources.md §2: kinds/scaleBy/radius are forbidden once from is "water" or "forestEdge".
test('kinds alongside from: "water" fails validation with the new message', () => {
  const config = load('world-forager-wide.json');
  config.flies.stimuli.heat = { from: 'water', kinds: ['lantern'] };
  const errors = validateConfig(config);
  assert.ok(
    errors.some((e) => e.path === 'flies.stimuli.heat' && /must not set kinds when from is "water"/.test(e.message)),
    JSON.stringify(errors),
  );
});

const WIDE_BRAIN = fileURLToPath(new URL('../public/brains/forager-brain-wide.brain', import.meta.url));
const WIDE_SKIP = existsSync(WIDE_BRAIN) ? false : 'public/brains/forager-brain-wide.brain is absent';

// T026/T033 (contracts/stimuli-field-sources.md §4): the shipped world-forager-wide.json declares
// odour:danger/heat as from: "forestEdge"/"water" (no radius); a fly must sense and start with no error.
test('world-forager-wide.json: a fly senses and starts with no error (from: "forestEdge"/"water")', { skip: WIDE_SKIP }, () => {
  const config = load('world-forager-wide.json');
  assert.deepEqual(validateConfig(config), []);
  const { catalog } = indexCatalog(JSON.parse(readFileSync(fileURLToPath(new URL('../public/assets/atlas/catalog.json', import.meta.url)), 'utf8')));
  const f = resolveFlies(config);
  const logic = buildLogic(config, catalog);
  const world = buildWorld(config, logic);
  const flowers = createFood(world, f);
  const bytes = readFileSync(WIDE_BRAIN);
  const snap = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const env = forageEnvWide(f, world, flowers, snap.capabilities);
  const [fly] = spawnFlies(config, world, 'toy');
  const brain = createFlyBrain({ ...f.brain, snapshot: snap, version: 'v2' }, fly.brainSeed);
  assert.doesNotThrow(() => {
    const { inputs } = senseForagerFlyWide(fly, env);
    for (const v of inputs) assert.ok(Number.isFinite(v));
    brain.step({ inputs, hunger: 0 });
  });
});

const BRAIN = fileURLToPath(new URL('../public/brains/forager-brain-wide.brain', import.meta.url));
const SKIP = existsSync(BRAIN) ? false : 'public/brains/forager-brain-wide.brain is absent';

test('loading the real wide-I/O snapshot under "v1" is refused, naming both the expected and actual kind', { skip: SKIP }, () => {
  const bytes = readFileSync(BRAIN);
  const snap = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(snap.kind, 'forager-wide');
  assert.throws(() => checkBrainVersion('v1', snap.version, snap.kind, 'brains/forager-brain-wide.brain'), {
    message: 'flies.brain.version "v1" needs a "forager" snapshot; brains/forager-brain-wide.brain is kind "forager-wide"',
  });
});

test('the reverse mismatch: a "v2" world naming the shipped 11K (kind "forager") snapshot is refused', { skip: SKIP }, () => {
  const file = fileURLToPath(new URL('../public/brains/forager-brain-11k.brain', import.meta.url));
  const bytes = readFileSync(file);
  const snap = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.throws(() => checkBrainVersion('v2', snap.version, snap.kind, 'brains/forager-brain-11k.brain'), {
    message: 'flies.brain.version "v2" needs a "forager-wide" snapshot; brains/forager-brain-11k.brain is kind "forager"',
  });
});
