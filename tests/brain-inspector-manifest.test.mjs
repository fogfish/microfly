// The committed brain manifest is valid, and every listed brain parses with the reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { validateManifest } from '../public/brains/js/model.js';

const BRAINS = fileURLToPath(new URL('../public/brains/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${BRAINS}brains.json`, 'utf8'));

test('brains.json passes validateManifest', () => {
  assert.deepEqual(validateManifest(manifest), []);
});

test('every listed brain parses with the snapshot reader', () => {
  for (const { file } of manifest.brains) {
    const b = readFileSync(`${BRAINS}${file}`);
    assert.doesNotThrow(() => parseSnapshot(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), file);
  }
});
