// Channel declaration, version 6 (contracts/channel-declaration-v6.md, ADR 012 R12): v5's R1-R9 and R11
// unchanged, R10 generalised to allow one optional `song` drive. Same messages as
// extract/malecns_brain/capabilities.py's validate_capabilities_v6 (tests/test_capabilities_v6.py).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  validateCapabilitiesV5, validateCapabilitiesV6, FORAGER_WIDE_OPTIONAL_DRIVES,
} from '../public/js/brain/capabilities.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const N = 25;

// A valid twelve-input/seven-output forager-wide declaration with one song drive.
function foragerWideWithSong() {
  const pair = (id, label, side, neuron, sense, site) => (
    { id, label, side, neurons: [neuron], range: [0, 1], sense, site }
  );
  const inputs = [
    pair('odour-food-left', 'Food odour left', 'L', 0, 'odour:food', 'antenna'),
    pair('odour-food-right', 'Food odour right', 'R', 1, 'odour:food', 'antenna'),
    pair('odour-danger-left', 'Danger odour left', 'L', 2, 'odour:danger', 'antenna'),
    pair('odour-danger-right', 'Danger odour right', 'R', 3, 'odour:danger', 'antenna'),
    pair('heat-left', 'Heat left', 'L', 4, 'heat', 'antenna'),
    pair('heat-right', 'Heat right', 'R', 5, 'heat', 'antenna'),
    pair('taste-mouth-left', 'Mouth taste left', 'L', 6, 'taste', 'mouth'),
    pair('taste-mouth-right', 'Mouth taste right', 'R', 7, 'taste', 'mouth'),
    pair('taste-leg-left', 'Leg taste left', 'L', 8, 'taste', 'front-leg'),
    pair('taste-leg-right', 'Leg taste right', 'R', 9, 'taste', 'front-leg'),
    pair('touch-left', 'Touch left', 'L', 10, 'touch', 'front-leg'),
    pair('touch-right', 'Touch right', 'R', 11, 'touch', 'front-leg'),
  ];
  const outputs = [
    { id: 'turn-left', label: 'Turn left', side: 'L', neurons: [12], range: [0, 1], drive: 'turnLeft' },
    { id: 'turn-right', label: 'Turn right', side: 'R', neurons: [13], range: [0, 1], drive: 'turnRight' },
    { id: 'forward', label: 'Forward', side: 'both', neurons: [14], range: [0, 1], drive: 'forward' },
    { id: 'backward', label: 'Backward', side: 'both', neurons: [15], range: [0, 1], drive: 'backward' },
    { id: 'feed', label: 'Feed', side: 'both', neurons: [16], range: [0, 1], drive: 'feed' },
    { id: 'escape', label: 'Escape', side: 'both', neurons: [17], range: [0, 1], drive: 'escape' },
    { id: 'song', label: 'Song', side: 'both', neurons: [18], range: [0, 1], drive: 'song' },
  ];
  return { signals: ['spikes'], channels: { inputs, outputs } };
}

const problem = (decl, neuronCount = N) => {
  const [message = null] = validateCapabilitiesV6(decl, neuronCount);
  return message;
};

const edited = (edit) => {
  const decl = structuredClone(foragerWideWithSong());
  edit(decl);
  return problem(decl);
};

test('one song drive passes', () => {
  assert.deepEqual(validateCapabilitiesV6(foragerWideWithSong(), N), []);
  assert.deepEqual(FORAGER_WIDE_OPTIONAL_DRIVES, ['song']);
});

test('two song drives fail', () => {
  assert.equal(edited((d) => {
    d.channels.outputs.push(
      { id: 'song2', label: 'Song 2', side: 'both', neurons: [19], range: [0, 1], drive: 'song' },
    );
  }), 'snapshot outputs may declare song at most once');
});

test('song without declaration 6 fails v5', () => {
  const [message] = validateCapabilitiesV5(foragerWideWithSong(), N);
  assert.equal(message, 'snapshot outputs must have exactly one of each forager-wide drive');
});

test('a v6 declaration with no song output still validates, like v5', () => {
  const decl = structuredClone(foragerWideWithSong());
  decl.channels.outputs.pop();
  assert.deepEqual(validateCapabilitiesV6(decl, N), []);
  assert.deepEqual(validateCapabilitiesV5(decl, N), []);
});

test('an unknown declaration value is rejected', () => {
  assert.equal(edited((d) => { d.channels.outputs[d.channels.outputs.length - 1].drive = 'courtship'; }),
    'snapshot outputs must have exactly one of each forager-wide drive');
});

test('every shipped forager-wide brain still validates', () => {
  const dir = fileURLToPath(new URL('../public/brains/', import.meta.url));
  const shipped = readdirSync(dir).filter((name) => name.endsWith('.brain'));
  assert.ok(shipped.length > 0, 'expected at least one shipped .brain file');
  let checked = 0;
  for (const name of shipped) {
    const path = fileURLToPath(new URL(`../public/brains/${name}`, import.meta.url));
    if (!existsSync(path)) continue;
    const buf = readFileSync(path);
    const snap = parseSnapshot(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (snap.kind !== 'forager-wide') continue;
    checked += 1;
    const declaration = snap.capabilities.declaration;
    const [message] = declaration === 6
      ? validateCapabilitiesV6(snap.capabilities, snap.neuronCount)
      : validateCapabilitiesV5(snap.capabilities, snap.neuronCount);
    assert.equal(message, undefined, `${name}: ${message}`);
  }
  assert.ok(checked > 0, 'expected at least one shipped forager-wide brain');
});
