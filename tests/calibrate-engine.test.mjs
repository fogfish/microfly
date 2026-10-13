// BUG-002 (ADR 006 Amendment 2026-10-11, A5): unit tests for the microfly-calibrate skill's pure A1 gate logic
// against synthetic regime-table rows, not only against the real brain. Covers the `output` exemption, the
// `input`-only rest floor, the per-step rate conversion, and the steering gate -- the parts of A5 that are pure
// functions of a stored checkpoint row. `feed` (gated on a profile's `taste` condition when `requireFeed` is set,
// fixed directly in profiles/v2.mjs) and the settle gate (`probeSettle`) need a live brain and are exercised by
// `/microfly-calibrate` runs, not a unit fixture. `brake` is dropped as a gate entirely (2026-10-13, see
// specs/012-class-seeded-forager-brain/calibration.md) so there is nothing to unit-test for it either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perStepRateFromUnion, rescoreStoredRow } from '../.claude/skills/microfly-calibrate/scripts/engine.mjs';

const v2Gates = {
  restFloor: 0.002,
  restCeiling: 0.1,
  floorGroups: ['input'],
  ceilingExemptGroups: ['output'],
  rateBasis: 'perStep',
  odourGroups: ['al', 'central'],
  odourGain: 1.2,
  lateralMin: 0.05,
};

const profile = { regionNames: ['input', 'output', 'al', 'vnc', 'dn', 'central'], gates: v2Gates };

function row(overrides) {
  return {
    point: { stepsPerTick: 10 },
    rest: { input: 0.05, output: 0, al: 0, vnc: 0, dn: 0, central: 0 },
    odour: { input: 0.07, output: 0.5, al: 0.3, vnc: 0.2, dn: 0.4, central: 0.3 },
    lateral: 0.2,
    ...overrides,
  };
}

test('perStepRateFromUnion round-trips the union formula it inverts', () => {
  const stepsPerTick = 10;
  const rate = 0.02;
  const union = 1 - (1 - rate) ** stepsPerTick;
  assert.ok(Math.abs(perStepRateFromUnion(union, stepsPerTick) - rate) < 1e-9);
});

test('perStepRateFromUnion makes the ceiling gate agree across stepsPerTick (BUG-002 item 2)', () => {
  const rate = 0.03; // above a 0.1 per-tick-at-steps5 reading but a modest per-step rate
  const unionAt5 = 1 - (1 - rate) ** 5;
  const unionAt10 = 1 - (1 - rate) ** 10;
  assert.notEqual(unionAt5, unionAt10); // the raw per-tick union differs with stepsPerTick...
  const back5 = perStepRateFromUnion(unionAt5, 5);
  const back10 = perStepRateFromUnion(unionAt10, 10);
  assert.ok(Math.abs(back5 - back10) < 1e-9); // ...but the recovered per-step rate does not
});

test('output is exempt from both the rest floor and the ignited ceiling (BUG-002 item 1)', () => {
  const r = rescoreStoredRow(profile, row({ rest: { input: 0.05, output: 0, al: 0, vnc: 0, dn: 0, central: 0 } }));
  assert.ok(!r.partialFails.some((f) => f.endsWith(':output')));
  const ignited = rescoreStoredRow(profile, row({ rest: { input: 0.05, output: 0.9, al: 0, vnc: 0, dn: 0, central: 0 } }));
  assert.ok(!ignited.partialFails.some((f) => f.endsWith(':output')));
});

test('the rest floor applies to input only, not to al/vnc/dn/central (BUG-002 item 3)', () => {
  const silentEverywhereButInput = row({ rest: { input: 0.05, output: 0, al: 0, vnc: 0, dn: 0, central: 0 } });
  const r = rescoreStoredRow(profile, silentEverywhereButInput);
  assert.deepEqual(r.partialFails.filter((f) => f.startsWith('silent:')), []);
  const silentInput = row({ rest: { input: 0, output: 0, al: 0, vnc: 0, dn: 0, central: 0 } });
  const r2 = rescoreStoredRow(profile, silentInput);
  assert.ok(r2.partialFails.includes('silent:input'));
});

test('al/vnc/dn/central still fail the ignited ceiling when over it', () => {
  const r = rescoreStoredRow(profile, row({ rest: { input: 0.05, output: 0, al: 0.9, vnc: 0, dn: 0, central: 0 } }));
  assert.ok(r.partialFails.includes('ignited:al'));
});

test('a near-zero lateral fails the new steering gate (BUG-002 item 5)', () => {
  const quiet = rescoreStoredRow(profile, row({ lateral: 0.01 }));
  assert.ok(quiet.partialFails.includes('lateral'));
  const steering = rescoreStoredRow(profile, row({ lateral: 0.2 }));
  assert.ok(!steering.partialFails.includes('lateral'));
});

test('rescoreStoredRow never claims feed/settle were re-evaluated', () => {
  const r = rescoreStoredRow(profile, row());
  assert.deepEqual(r.notReevaluated, ['feed', 'settle']);
});

test('a profile that does not opt into A5 (v1) keeps the pre-BUG-002 behaviour', () => {
  const v1Profile = {
    regionNames: ['all'],
    gates: { restFloor: 0.002, restCeiling: 0.1, odourGroups: ['all'], odourGain: 2, neighbours: 0.5 },
  };
  const ignited = rescoreStoredRow(v1Profile, { point: {}, rest: { all: 0.5 }, odour: { all: 0.6 }, lateral: 0.2 });
  assert.ok(ignited.partialFails.includes('ignited:all')); // no ceilingExemptGroups -> gated as before
  const silent = rescoreStoredRow(v1Profile, { point: {}, rest: { all: 0 }, odour: { all: 0.01 }, lateral: 0.2 });
  assert.ok(silent.partialFails.includes('silent:all')); // no floorGroups override -> floor still applies everywhere
  assert.ok(!silent.partialFails.includes('lateral')); // no lateralMin set -> steering gate stays off
});
