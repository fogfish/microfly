// Constitution V: the toy network is unchanged. The recorded trace must match tick by tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runToyGolden } from './golden-drive.mjs';

const golden = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/toy-golden.json', import.meta.url)), 'utf8'));

test('toy brain reproduces the golden trace tick by tick', () => {
  const trace = runToyGolden();
  assert.equal(trace.left.length, golden.left.length);
  for (let t = 0; t < golden.left.length; t++) {
    assert.equal(trace.left[t], golden.left[t], `left differs at tick ${t}`);
    assert.equal(trace.right[t], golden.right[t], `right differs at tick ${t}`);
    assert.deepEqual(trace.spikes[t], golden.spikes[t], `spikes differ at tick ${t}`);
  }
});
