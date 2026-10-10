// US3 (spec Acceptance Scenarios 1-2): danger odour and heat measurably change steering output from the
// no-danger-odour/no-heat baseline (reported with sign, not required to beat the random walk — ADR 006 Gate C);
// both at once each still read their own nonzero input channel (Edge Cases). A wiring check on the real
// extracted brain; the avoidMetric itself (public/js/fly/metrics.js) is a separate pure function, tested in
// tests/metrics-v2.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelIndex, fixture, newFly, OUTPUT_DRIVES, SKIP } from './forager-v2-fixture.mjs';
import { resolveDeclaredStimulus } from '../public/js/fly/stimulus.js';

const WARMUP = 50;
const WINDOW = 400;

function meanSteering(seed, inputs) {
  const { brain } = newFly(seed);
  for (let t = 0; t < WARMUP; t++) brain.step({ inputs, hunger: 0.5 });
  const sums = new Float64Array(OUTPUT_DRIVES.length);
  for (let t = 0; t < WINDOW; t++) {
    const out = brain.step({ inputs, hunger: 0.5 });
    for (let k = 0; k < sums.length; k++) sums[k] += out.outputs[k];
  }
  return Array.from(sums, (s) => s / WINDOW);
}

test('danger odour measurably changes steering output from the no-danger baseline', { skip: SKIP }, () => {
  const { snapshot } = fixture();
  const n = snapshot.capabilities.channels.inputs.length;
  const zero = new Float32Array(n);
  const dangerLeft = channelIndex('odour:danger', 'L');
  assert.ok(dangerLeft >= 0, 'odour:danger-left channel must be declared');
  const withDanger = new Float32Array(n);
  withDanger[dangerLeft] = 1;

  const baseline = meanSteering(3, zero);
  const changed = meanSteering(3, withDanger);
  const steeringChanged = OUTPUT_DRIVES.some((_, k) => Math.abs(changed[k] - baseline[k]) > 1e-6);
  assert.ok(steeringChanged, `steering outputs should change with danger odour present: ${changed} vs ${baseline}`);
});

test('heat measurably changes steering output from the no-heat baseline', { skip: SKIP }, () => {
  const { snapshot } = fixture();
  const n = snapshot.capabilities.channels.inputs.length;
  const zero = new Float32Array(n);
  const heatLeft = channelIndex('heat', 'L');
  assert.ok(heatLeft >= 0, 'heat-left channel must be declared');
  const withHeat = new Float32Array(n);
  withHeat[heatLeft] = 1;

  const baseline = meanSteering(4, zero);
  const changed = meanSteering(4, withHeat);
  const steeringChanged = OUTPUT_DRIVES.some((_, k) => Math.abs(changed[k] - baseline[k]) > 1e-6);
  assert.ok(steeringChanged, `steering outputs should change with heat present: ${changed} vs ${baseline}`);
});

test('danger odour and heat near a fly at once each report their own nonzero channel value', () => {
  const { f } = fixture();
  const fly = { x: 20, y: 20, heading: 0 };
  const env = {
    dangerPoints: (kinds) => (kinds?.includes('spider') ? [{ x: 21, y: 20, fraction: 1 }]
      : kinds?.includes('lantern') ? [{ x: 20, y: 21, fraction: 1 }] : []),
  };
  const danger = resolveDeclaredStimulus({ sense: 'odour:danger', site: 'antenna', side: 'L' }, fly, f.stimuli, f.body.sites, env);
  const heat = resolveDeclaredStimulus({ sense: 'heat', site: 'antenna', side: 'L' }, fly, f.stimuli, f.body.sites, env);
  assert.ok(danger > 0, `odour:danger should read nonzero, got ${danger}`);
  assert.ok(heat > 0, `heat should read nonzero, got ${heat}`);
});
