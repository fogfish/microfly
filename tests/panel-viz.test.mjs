// Geometry for the decoder and learning bars, sparklines and trend glyphs (public/js/ui/panel/viz.js). Pure
// functions only: the DOM builders are exercised through the section tests with a stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_LENGTH, TREND_FLAT, pushSample, percentAt, barFill, sideFill, symmetricScale, sparklinePoints, trendGlyph,
} from '../public/js/ui/panel/viz.js';

test('pushSample keeps the newest HISTORY_LENGTH samples and skips absent values', () => {
  const h = [];
  for (let i = 0; i < HISTORY_LENGTH + 5; i++) pushSample(h, i);
  assert.equal(h.length, HISTORY_LENGTH);
  assert.equal(h[0], 5, 'the oldest five are dropped');
  assert.equal(h[h.length - 1], HISTORY_LENGTH + 4);

  pushSample(h, undefined);
  pushSample(h, null);
  assert.equal(h.length, HISTORY_LENGTH, 'an absent value is not a sample');
});

test('percentAt clamps to the track', () => {
  assert.equal(percentAt(0, -1, 1), 50);
  assert.equal(percentAt(5, 0, 1), 100);
  assert.equal(percentAt(-5, 0, 1), 0);
});

test('barFill runs from the marker to the value', () => {
  assert.deepEqual(barFill(1.5, 0.5, 1.5, 1), { left: 50, width: 50 }, 'above the marker grows right');
  assert.deepEqual(barFill(0.5, 0.5, 1.5, 1), { left: 0, width: 50 }, 'below the marker grows left');
  assert.deepEqual(barFill(0.25, 0, 1, 0), { left: 0, width: 25 }, 'no marker starts at the left end');
});

test('sideFill points toward the stronger side (side > 0 means left stronger)', () => {
  const left = sideFill(0.5);
  assert.equal(left.left, 25, 'fill sits in the left half');
  assert.equal(left.width, 25);

  const right = sideFill(-0.5);
  assert.equal(right.left, 50, 'fill sits in the right half');
  assert.equal(right.width, 25);

  assert.equal(sideFill(undefined), undefined, 'a sense with no side pool has no fill');
  assert.deepEqual(sideFill(0), { left: 50, width: 0 });
});

test('symmetricScale covers the largest magnitude and never drops below the floor', () => {
  assert.equal(symmetricScale([0.2, -0.7, 0.1], 0.05), 0.7);
  assert.equal(symmetricScale([0.01], 0.05), 0.05);
  assert.equal(symmetricScale([], 0.05), 0.05);
});

test('sparklinePoints put the newest sample at the right edge and clamp to the scale', () => {
  const pts = sparklinePoints([0, 1, 2], { width: 100, height: 10, lo: 0, hi: 2 }).split(' ');
  assert.equal(pts.length, 3);
  const last = pts[2].split(',').map(Number);
  assert.equal(last[0], 100, 'newest sample is at the right edge');
  assert.equal(last[1], 0, 'value at the top of the scale is at y = 0');

  const clamped = sparklinePoints([5], { width: 100, height: 10, lo: 0, hi: 2 }).split(',').map(Number);
  assert.equal(clamped[1], 0, 'a value above the scale is drawn at the top, not outside the box');
});

test('trendGlyph shows rising, falling and flat, and nothing when absent', () => {
  assert.equal(trendGlyph(TREND_FLAT + 0.01).cls, 'trend-up');
  assert.equal(trendGlyph(-TREND_FLAT - 0.01).cls, 'trend-down');
  assert.equal(trendGlyph(0).cls, 'trend-flat');
  assert.equal(trendGlyph(undefined).text, '');
});
