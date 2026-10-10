// US1 (spec Acceptance Scenarios 2-3): a v2 fly's front-leg/touch channels read nonzero before its mouth-taste
// channel does as it nears a flower (a geometric property of the declared body sites, W7 — brain-independent,
// so the body is driven directly here rather than through a brain). T051's find-rate comparison against v1
// needs the calibrated brain (ADR 006's own staged calibration protocol); its measured, uncalibrated result is
// recorded in specs/013-forager-brain-15k-lif-v2/calibration.md rather than asserted here as a pass/fail gate
// (AGENTS.md: "the fix is config or parameters, recorded with the run — do not adjust code to make a number
// pass").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveDeclaredStimulus } from '../public/js/fly/stimulus.js';

const WORLD = JSON.parse(readFileSync(
  fileURLToPath(new URL('../public/world/world-forager-15k.json', import.meta.url)), 'utf8'));

const BODY_SITES = WORLD.flies.body.sites;
const FLIES_STIMULI = WORLD.flies.stimuli;

function channel(sense, site, side) {
  return { sense, site, side };
}

test('leg-taste and touch read nonzero while mouth-taste still reads 0, as a fly approaches a flower head-on', () => {
  // front-leg offset (0.4) is ahead of mouth (0): a flower edible point just past the leg's reach but short of
  // the mouth's exposes the gap directly (both read the same edible points; the difference is purely the site
  // offset, so the leg reads the point as closer / within reach before the mouth does).
  const env = { ediblePoints: () => [{ x: 10.9, y: 10, fraction: 1 }] };

  const approaching = [];
  for (let x = 10.0; x <= 11.0; x += 0.02) {
    const fly = { x, y: 10, heading: 0 };
    approaching.push({
      x,
      mouth: resolveDeclaredStimulus(channel('taste:mouth', 'mouth', 'L'), fly, FLIES_STIMULI, BODY_SITES, env),
      leg: resolveDeclaredStimulus(channel('taste:leg', 'front-leg', 'L'), fly, FLIES_STIMULI, BODY_SITES, env),
    });
  }
  const firstLegNonzero = approaching.findIndex((s) => s.leg > 0);
  const firstMouthNonzero = approaching.findIndex((s) => s.mouth > 0);
  assert.ok(firstLegNonzero >= 0, 'the leg should eventually read nonzero');
  assert.ok(firstMouthNonzero >= 0, 'the mouth should eventually read nonzero');
  assert.ok(firstLegNonzero < firstMouthNonzero,
    `the leg (step ${firstLegNonzero}) should read nonzero before the mouth (step ${firstMouthNonzero})`);
});

test('touch reads nonzero at the first non-walkable leg cell, independent of taste', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const blockedAhead = { isWalkable: (cx) => cx < 10 }; // the front-leg site (x + 0.4) falls on a blocked cell
  const value = resolveDeclaredStimulus(channel('touch', 'front-leg', 'L'), fly, FLIES_STIMULI, BODY_SITES, blockedAhead);
  assert.equal(value, 1);
});
