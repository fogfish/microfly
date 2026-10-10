// ADR 006 W6: resolveDeclaredStimulus resolves every one of the six senses correctly from a test
// flies.stimuli/flies.body.sites; a snapshot channel naming an undeclared sense fails world start-up with a
// named error (not a silent zero) — checked at the world-config layer (validate.js) since that is where a
// world-declared sense (not a snapshot channel) is validated; the undeclared-sense-at-runtime check lives in
// fly-host.js's loadSnapshot path (world-forager-15k-bad.json-style fixtures, tests/world-validate-v2.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeclaredStimulus, sitePoint, SITE_LATERAL } from '../public/js/fly/stimulus.js';

const BODY_SITES = { antenna: 0.5, mouth: 0, 'front-leg': 0.4 };

function channel(sense, site, side) {
  return { sense, site, side };
}

test('sitePoint offsets forward along heading, and laterally for L/R', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const centre = sitePoint(fly, 'mouth', 'both', BODY_SITES);
  assert.ok(Math.abs(centre.x - 10) < 1e-9 && Math.abs(centre.y - 10) < 1e-9);
  const ahead = sitePoint(fly, 'front-leg', 'both', BODY_SITES);
  assert.ok(Math.abs(ahead.x - 10.4) < 1e-9);
  const left = sitePoint(fly, 'antenna', 'L', BODY_SITES);
  const right = sitePoint(fly, 'antenna', 'R', BODY_SITES);
  assert.ok(Math.abs(left.y - right.y) > 0, 'left and right must differ laterally');
  // The fly's left is (sin θ, −cos θ) (stimulus.js's antennaPoints convention); at heading 0 that is −y.
  assert.ok(Math.abs((left.y - 10) + SITE_LATERAL) < 1e-9);
});

test('touch is binary: 1 when the site cell is not walkable, else 0', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const open = { isWalkable: () => true };
  const blocked = { isWalkable: () => false };
  assert.equal(resolveDeclaredStimulus(channel('touch', 'front-leg', 'L'), fly, {}, BODY_SITES, open), 0);
  assert.equal(resolveDeclaredStimulus(channel('touch', 'front-leg', 'L'), fly, {}, BODY_SITES, blocked), 1);
});

test('odour:food sums falloff over the declared edible points, scaled by fraction', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const fliesStimuli = { 'odour:food': { from: 'edibles', radius: 6 } };
  const env = { ediblePoints: () => [{ x: 12, y: 10, reach: 6, fraction: 1 }] };
  const value = resolveDeclaredStimulus(channel('odour:food', 'antenna', 'L'), fly, fliesStimuli, BODY_SITES, env);
  assert.ok(value > 0 && value <= 1, `expected a positive falloff value, got ${value}`);
});

test('odour:danger and heat read from dangerPoints, filtered by kind', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const fliesStimuli = {
    'odour:danger': { from: 'dangers', kinds: ['spider'], radius: 4 },
    heat: { from: 'dangers', kinds: ['lantern'], radius: 3 },
  };
  const calls = [];
  const env = {
    dangerPoints: (kinds) => {
      calls.push(kinds);
      return kinds?.includes('spider') ? [{ x: 11, y: 10, fraction: 1 }] : [];
    },
  };
  const danger = resolveDeclaredStimulus(channel('odour:danger', 'antenna', 'L'), fly, fliesStimuli, BODY_SITES, env);
  assert.ok(danger > 0);
  const heat = resolveDeclaredStimulus(channel('heat', 'antenna', 'L'), fly, fliesStimuli, BODY_SITES, env);
  assert.equal(heat, 0);
  assert.deepEqual(calls, [['spider'], ['lantern']]);
});

test('taste:mouth and taste:leg read from edibles at their own site', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const fliesStimuli = {
    'taste:mouth': { from: 'edibles', radius: 6 },
    'taste:leg': { from: 'edibles', radius: 6 },
  };
  const env = { ediblePoints: () => [{ x: 10.4, y: 10, reach: 6, fraction: 0.5 }] };
  const mouth = resolveDeclaredStimulus(channel('taste:mouth', 'mouth', 'L'), fly, fliesStimuli, BODY_SITES, env);
  const leg = resolveDeclaredStimulus(channel('taste:leg', 'front-leg', 'L'), fly, fliesStimuli, BODY_SITES, env);
  assert.ok(leg > mouth, `front-leg (closer to the point) should read higher than mouth: leg=${leg}, mouth=${mouth}`);
});
