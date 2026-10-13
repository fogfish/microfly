// Derived capability signals for provenance/fidelity/origin (specs/012-class-seeded-forager-brain
// contracts/panel-provenance-signals.md): three fixture headers, the exact derived `signals` membership for
// each, and that selectSections/unmetSections (registry.js, unchanged) mount/skip the `provenance` section
// accordingly. No DOM: registry.js and withDerivedSignals are both pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDerivedSignals } from '../public/js/brain/capabilities.js';
import { selectSections, unmetSections } from '../public/js/ui/panel/registry.js';
import { provenanceSection } from '../public/js/ui/panel/sections/provenance.js';

const BASE_CAPS = { signals: ['spikes'], channels: { inputs: [], outputs: [] } };

function header({ withProvenance = false, withFidelity = false, withOrigin = false } = {}) {
  const neurons = [{ index: 0, origin: withOrigin ? 'seed:ALPN' : null }];
  const h = { neurons };
  if (withProvenance) { h.minSynapses = 5; h.selection = 'classSeed'; h.admission = 'allTraced'; }
  if (withFidelity) h.fidelity = { table: {}, steering: { pass: true }, feeding: { pass: true } };
  return h;
}

test('a header with all three groups of fields derives all three signals', () => {
  const caps = withDerivedSignals(BASE_CAPS, header({ withProvenance: true, withFidelity: true, withOrigin: true }));
  assert.deepEqual(caps.signals, ['spikes', 'provenance', 'fidelity', 'origin']);
});

test('a header with none of the new fields derives nothing: signals is unchanged', () => {
  const caps = withDerivedSignals(BASE_CAPS, header());
  assert.equal(caps, BASE_CAPS); // same reference: no new object when nothing is derived
  assert.deepEqual(caps.signals, ['spikes']);
});

test('a header with only fidelity derives only "fidelity"', () => {
  const caps = withDerivedSignals(BASE_CAPS, header({ withFidelity: true }));
  assert.deepEqual(caps.signals, ['spikes', 'fidelity']);
});

test('"provenance" is derived when any of minSynapses/selection/admission is present alone', () => {
  assert.deepEqual(withDerivedSignals(BASE_CAPS, { neurons: [], minSynapses: 1 }).signals, ['spikes', 'provenance']);
  assert.deepEqual(withDerivedSignals(BASE_CAPS, { neurons: [], selection: 'forager' }).signals, ['spikes', 'provenance']);
  assert.deepEqual(withDerivedSignals(BASE_CAPS, { neurons: [], admission: 'allTraced' }).signals, ['spikes', 'provenance']);
});

test('"origin" is derived when any neuron has a non-null origin, even if others do not', () => {
  const h = { neurons: [{ origin: null }, { origin: 'fill' }] };
  assert.deepEqual(withDerivedSignals(BASE_CAPS, h).signals, ['spikes', 'origin']);
});

test('the provenance section mounts only when the derived signal is present', () => {
  const noSignal = withDerivedSignals(BASE_CAPS, header());
  const withSignal = withDerivedSignals(BASE_CAPS, header({ withProvenance: true }));
  assert.deepEqual(selectSections([provenanceSection], noSignal), []);
  assert.deepEqual(selectSections([provenanceSection], withSignal), [provenanceSection]);
  // No `unmet` message is declared, so an unmet provenance section is simply absent, not reported.
  assert.deepEqual(unmetSections([provenanceSection], noSignal), []);
});

test('mock/v0/shipped-v1 fixtures (no new fields at all) never select the provenance section', () => {
  const shipped = withDerivedSignals({ signals: ['spikes'], channels: { inputs: [], outputs: [] } },
    { neurons: [{ index: 0 }, { index: 1 }] });
  assert.deepEqual(selectSections([provenanceSection], shipped), []);
});
