// Region activity (ADR 006 L10; contracts/panel-sections-v2.md): the requires.groups gate, and the per-region
// activity computation the section renders. The section itself touches the DOM directly (document.createElement,
// as outputs.js/action.js/inputs.js already do) and so, like them, is exercised by the browser Run check
// (AGENTS.md, T081) rather than a Node DOM-less test; what is tested here in Node is everything that does not
// need a DOM: the registry's groups requirement, and counts.js's regionActivity computation (one row per
// declared region, in order), which the section's mount/update calls directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRequirementMet, selectSections } from '../public/js/ui/panel/registry.js';
import { regionActivitySection } from '../public/js/ui/panel/sections/region-activity.js';
import { regionActivity, REGIONS } from '../public/js/ui/panel/counts.js';

const V2_CAPABILITIES = { channels: { inputs: [], outputs: [] }, signals: ['spikes'], groups: ['input', 'output', 'al', 'vnc', 'dn', 'central'] };
const V1_CAPABILITIES = { channels: { inputs: [{ id: 'a' }], outputs: [{ id: 'b' }] }, signals: ['spikes'] };

test('requires.groups is met only when the declaration carries a non-empty groups list', () => {
  assert.equal(isRequirementMet({ groups: true }, V2_CAPABILITIES), true);
  assert.equal(isRequirementMet({ groups: true }, V1_CAPABILITIES), false);
  assert.equal(isRequirementMet({ groups: true }, { groups: [] }), false);
});

test('the region-activity section is selected for a v2-shaped (groups-bearing) declaration, not for v0/v1', () => {
  const sections = [regionActivitySection];
  assert.deepEqual(selectSections(sections, V2_CAPABILITIES), [regionActivitySection]);
  assert.deepEqual(selectSections(sections, V1_CAPABILITIES), []);
});

test('regionActivity returns one row per declared region, in REGIONS order, with the right fraction', () => {
  // neurons 0-1 input, 2 output, 3 al, 4-5 vnc, 6 dn, 7-9 central; neurons 0,2,3,4,6,7 spiked.
  const groups = ['input', 'input', 'output', 'al', 'vnc', 'vnc', 'dn', 'central', 'central', 'central'];
  const counts = Uint32Array.from([1, 0, 1, 1, 1, 0, 1, 1, 0, 0]);
  const result = regionActivity(counts, groups);
  assert.deepEqual(result.map((r) => r.region), REGIONS);
  const byRegion = Object.fromEntries(result.map((r) => [r.region, r]));
  assert.deepEqual(byRegion.input, { region: 'input', active: 1, total: 2, fraction: 0.5 });
  assert.deepEqual(byRegion.output, { region: 'output', active: 1, total: 1, fraction: 1 });
  assert.deepEqual(byRegion.vnc, { region: 'vnc', active: 1, total: 2, fraction: 0.5 });
  assert.ok(Math.abs(byRegion.central.fraction - 1 / 3) < 1e-9);
});

test('regionActivity returns no rows for a declaration with no groups at all (v0/v1)', () => {
  assert.deepEqual(regionActivity(new Uint32Array(3), []), []);
});
