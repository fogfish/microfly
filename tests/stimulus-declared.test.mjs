// The generic declared-sense sampler (ADR 007 W8/W9; contracts/world-config-wide-io.md). sitePoint generalises
// antennaPoints to an arbitrary forward/lateral offset; senseDeclared dispatches a distance sense (falloff over
// a point list) or a contact sense (one cell read) by the world's flies.stimuli[sense] spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitePoint, senseDistance, senseDeclared, antennaPoints } from '../public/js/fly/stimulus.js';

const ANTENNA = { forward: 0, lateral: 0.5 };
const MOUTH = { forward: 0, lateral: 0 };
const FRONT_LEG = { forward: 0.5, lateral: 0.25 };

test('antenna site matches antennaPoints exactly (forward 0)', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const { left, right } = antennaPoints(fly, 0.5);
  const l = sitePoint(fly, ANTENNA, 'L');
  const r = sitePoint(fly, ANTENNA, 'R');
  assert.ok(Math.abs(l.x - left.x) < 1e-12 && Math.abs(l.y - left.y) < 1e-12);
  assert.ok(Math.abs(r.x - right.x) < 1e-12 && Math.abs(r.y - right.y) < 1e-12);
});

test('mouth site has no lateral offset, so left and right read the same point (ADR 007 W8, by design)', () => {
  const fly = { x: 10, y: 10, heading: 0.7 };
  const l = sitePoint(fly, MOUTH, 'L');
  const r = sitePoint(fly, MOUTH, 'R');
  assert.ok(Math.abs(l.x - r.x) < 1e-12 && Math.abs(l.y - r.y) < 1e-12);
  assert.ok(Math.abs(l.x - fly.x) < 1e-12 && Math.abs(l.y - fly.y) < 1e-12, 'mouth sits at the body centre');
});

test('a "both" side reads lateral 0, same as mouth (the mechanism does not special-case it away)', () => {
  const fly = { x: 10, y: 10, heading: 0.3 };
  const both = sitePoint(fly, ANTENNA, 'both');
  assert.ok(Math.abs(both.x - fly.x) < 1e-12 && Math.abs(both.y - fly.y) < 1e-12);
});

test('front-leg site reaches a flower before mouth does (ADR 007 W9)', () => {
  const fly = { x: 10, y: 10, heading: 0 }; // facing east
  const flowerAhead = [{ x: 10.5, y: 10, fraction: 1 }]; // 0.5 tiles ahead of the body centre
  const mouthDistance = Math.hypot(flowerAhead[0].x - sitePoint(fly, MOUTH, 'L').x, flowerAhead[0].y - sitePoint(fly, MOUTH, 'L').y);
  const legDistance = Math.hypot(flowerAhead[0].x - sitePoint(fly, FRONT_LEG, 'L').x, flowerAhead[0].y - sitePoint(fly, FRONT_LEG, 'L').y);
  assert.ok(legDistance < mouthDistance, `front-leg (${legDistance}) should be nearer the flower than mouth (${mouthDistance})`);
});

test('senseDeclared: a distance sense sums falloff over the point list, same as senseDistance', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const at = sitePoint(fly, ANTENNA, 'L');
  const points = [{ x: 14, y: 9.5, fraction: 1 }];
  const spec = { from: 'edibles', radius: 6 };
  const sampler = { points: () => points, contactAt: () => 0 };
  assert.equal(senseDeclared(spec, at, sampler), senseDistance(at, points, spec.radius));
  assert.ok(senseDeclared(spec, at, sampler) > 0);
});

test('senseDeclared: a contact sense ignores the point list and reads the sampler\'s cell value', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const at = sitePoint(fly, MOUTH, 'L');
  const spec = { from: 'edibles', scaleBy: 'stock', contact: true };
  const sampler = { points: () => [{ x: 999, y: 999, fraction: 1 }], contactAt: (cx, cy) => (cx === 10 && cy === 10 ? 0.75 : 0) };
  assert.equal(senseDeclared(spec, at, sampler), 0.75);
});

test('senseDeclared: touch (from "blocked") reads 1 on a non-walkable cell, 0 on a walkable one', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const at = sitePoint(fly, FRONT_LEG, 'L');
  const spec = { from: 'blocked', contact: true };
  const cx = Math.floor(at.x);
  const cy = Math.floor(at.y);
  const blocked = { points: () => [], contactAt: (x, y) => (x === cx && y === cy ? 1 : 0) };
  const clear = { points: () => [], contactAt: () => 0 };
  assert.equal(senseDeclared(spec, at, blocked), 1);
  assert.equal(senseDeclared(spec, at, clear), 0);
});

// contracts/stimuli-field-sources.md §3: spec.field dispatches to sampler.fieldAt, untouched.
test('senseDeclared: spec.field reads the sampler\'s fieldAt at the site\'s own cell, untouched', () => {
  const fly = { x: 10, y: 10, heading: 0 };
  const at = sitePoint(fly, ANTENNA, 'L');
  const spec = { from: 'forestEdge', field: true };
  const cx = Math.floor(at.x);
  const cy = Math.floor(at.y);
  const sampler = {
    points: () => [],
    contactAt: () => { throw new Error('must not be called'); },
    fieldAt: (x, y) => (x === cx && y === cy ? 0.5 : 0),
  };
  assert.equal(senseDeclared(spec, at, sampler), 0.5);
});

test('senseDistance clamps the sum to 1', () => {
  const at = { x: 0, y: 0 };
  const points = [{ x: 0, y: 0, fraction: 1 }, { x: 0, y: 0, fraction: 1 }];
  assert.equal(senseDistance(at, points, 4), 1);
});
