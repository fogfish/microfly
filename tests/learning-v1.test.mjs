// learning-v1 reader and group resolver (contracts/learning-v1.md, ADR 011).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseLearning, resolveLearningGroups } from '../public/js/brain/learning.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const SNAPSHOT = { sha256: 'abc123' };

function validFile(overrides = {}) {
  return {
    format: 'learning', version: 1,
    snapshot: { file: 'forager-brain-mb.brain', sha256: 'abc123' },
    groups: {
      kc: { class: 'Kenyon_Cell' },
      reward: { class: 'DAN', typePrefixes: ['PAM'] },
      punish: { class: 'DAN', typePrefixes: ['PPL1'] },
    },
    mbon: [
      { type: 'MBON01', role: 'avoid', cite: 'Owald et al. 2015' },
      { type: 'MBON11', role: 'approach', cite: 'Aso et al. 2014' },
    ],
    references: {},
    ...overrides,
  };
}

function manifest(entries) {
  return entries.map((e, i) => ({ index: i, bodyId: 100 + i, type: null, class: null, ...e }));
}

test('rejects a format or version other than "learning"/1', () => {
  assert.throws(
    () => parseLearning(validFile({ format: 'decoder' }), 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-FORMAT: x.learning.json must have format "learning" and version 1' },
  );
  assert.throws(
    () => parseLearning(validFile({ version: 2 }), 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-FORMAT: x.learning.json must have format "learning" and version 1' },
  );
});

test('rejects a snapshot.sha256 mismatch, quoting expected and got', () => {
  const file = validFile({ snapshot: { file: 'x.brain', sha256: 'different' } });
  assert.throws(
    () => parseLearning(file, 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-SNAPSHOT: x.learning.json was built for a different snapshot (expected abc123, got different)' },
  );
});

test('rejects an mbon role outside approach/avoid', () => {
  const file = validFile({ mbon: [{ type: 'MBON99', role: 'sideways', cite: 'x' }] });
  assert.throws(
    () => parseLearning(file, 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-ROLE: x.learning.json mbon "MBON99" has an invalid role "sideways"' },
  );
});

test('rejects a repeated mbon type', () => {
  const file = validFile({
    mbon: [
      { type: 'MBON01', role: 'avoid', cite: 'a' },
      { type: 'MBON01', role: 'approach', cite: 'b' },
    ],
  });
  assert.throws(
    () => parseLearning(file, 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-ROLE: x.learning.json repeats mbon type "MBON01"' },
  );
});

test('rejects an mbon entry with no citation', () => {
  const file = validFile({ mbon: [{ type: 'MBON01', role: 'avoid', cite: '' }] });
  assert.throws(
    () => parseLearning(file, 'x.learning.json', SNAPSHOT),
    { message: 'E-LEARN-CITE: x.learning.json mbon "MBON01" has no citation' },
  );
});

test('accepts a valid file and returns it unchanged', () => {
  const file = validFile();
  assert.equal(parseLearning(file, 'x.learning.json', SNAPSHOT), file);
});

test('resolveLearningGroups: resolves each group to ascending indices', () => {
  const neurons = manifest([
    { class: 'Kenyon_Cell', bodyId: 300 },
    { class: 'Kenyon_Cell', bodyId: 200 },
    { class: 'DAN', type: 'PAM01', bodyId: 400 },
    { class: 'DAN', type: 'PPL101', bodyId: 500 },
    { class: 'MBON', type: 'MBON01', bodyId: 600 },
    { class: 'MBON', type: 'MBON11', bodyId: 700 },
    { class: 'MBON', type: 'MBON99', bodyId: 800 },
  ]);
  const resolved = resolveLearningGroups(validFile(), neurons);
  assert.deepEqual(Array.from(resolved.kc), [0, 1]);
  assert.deepEqual(Array.from(resolved.reward), [2]);
  assert.deepEqual(Array.from(resolved.punish), [3]);
  assert.deepEqual(Array.from(resolved.avoid), [4]);
  assert.deepEqual(Array.from(resolved.approach), [5]);
  assert.deepEqual(resolved.unlisted, ['MBON99']);
});

test('resolveLearningGroups: E-LEARN-GROUP-EMPTY names the empty group', () => {
  const neurons = manifest([{ class: 'Kenyon_Cell', bodyId: 300 }]);
  assert.throws(
    () => resolveLearningGroups(validFile(), neurons, 'x.learning.json'),
    { message: 'E-LEARN-GROUP-EMPTY: x.learning.json group "reward" resolves to no neuron' },
  );
});

test('the shipped forager-brain-mb.learning.json resolves against the shipped snapshot, every group non-empty', () => {
  const buf = readFileSync('public/brains/forager-brain-mb.brain');
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const snap = parseSnapshot(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const file = JSON.parse(readFileSync('public/brains/forager-brain-mb.learning.json', 'utf8'));
  const parsed = parseLearning(file, 'forager-brain-mb.learning.json', { sha256 });
  const resolved = resolveLearningGroups(parsed, snap.manifest.neurons, 'forager-brain-mb.learning.json');
  for (const name of ['kc', 'reward', 'punish', 'approach', 'avoid']) {
    assert.ok(resolved[name].length >= 1, `group ${name} must be non-empty`);
  }
  // Every MBON type the sidecar doesn't list ends up in unlisted (matches T009's "unverified" list).
  assert.ok(resolved.unlisted.length >= 1);
});
