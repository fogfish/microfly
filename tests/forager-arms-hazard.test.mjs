// BUG-001 (spec 013 FR-028): the avoid and escape-telemetry measurements follow the source each hazard sense reads
// (scripts/forager-arms.mjs hazardLocator): a world field (forestEdge, water) by its tile-step ring, spider/lantern
// points for a `dangers` sense, and n/a (null) when the world has no such source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hazardLocator } from '../scripts/forager-arms.mjs';
import { dangerField } from '../public/js/world/danger-field.js';
import { heatField } from '../public/js/world/heat-field.js';

// 5 × 1 strip: an edge-forest cell at x = 0, water at x = 4, one spider at x = 2.
function stripWorld({ spider = true } = {}) {
  const cols = 5;
  const rows = 1;
  const forestEdge = Uint8Array.of(1, 0, 0, 0, 0);
  const water = Uint8Array.of(0, 0, 0, 0, 1);
  return {
    width: cols, height: rows,
    dangerField: dangerField({ forestEdge, cols, rows }),
    heatField: heatField({ water, cols, rows }),
    dangerCells: new Map(spider ? [[2, 'spider']] : []),
  };
}

test('a forestEdge sense reads the danger field ring, in range where the field is non-zero', () => {
  const at = hazardLocator(stripWorld(), { from: 'forestEdge' }, ['spider']);
  assert.equal(at.distanceAt(1.5, 0.5), 1);
  assert.equal(at.distanceAt(3.5, 0.5), 3);
  assert.equal(at.inRange(2.5, 0.5), true); // ring 2, intensity 0.25
  assert.equal(at.inRange(3.5, 0.5), false); // ring 3, intensity 0
});

test('a water sense reads the heat field, not spider/lantern points', () => {
  const at = hazardLocator(stripWorld(), { from: 'water' }, ['lantern']);
  assert.equal(at.distanceAt(3.5, 0.5), 1);
  assert.equal(at.distanceAt(0.5, 0.5), 3);
});

test('a dangers sense reads its declared kinds within its radius', () => {
  const at = hazardLocator(stripWorld(), { from: 'dangers', kinds: ['spider'], radius: 1 }, []);
  assert.equal(at.distanceAt(2.5, 0.5), 0);
  assert.equal(at.inRange(3.5, 0.5), true);
  assert.equal(at.inRange(4.5, 0.5), false);
});

test('no source in the world gives null (n/a), never a silent 0 %', () => {
  assert.equal(hazardLocator(stripWorld({ spider: false }), { from: 'dangers', kinds: ['spider'] }, []), null);
  assert.equal(hazardLocator(stripWorld(), { from: 'dangers', kinds: ['lantern'] }, []), null);
  assert.equal(hazardLocator(stripWorld(), { from: 'blocked' }, []), null);
});

test('a world with no flies.stimuli (v1) keeps the spider/lantern points', () => {
  const at = hazardLocator(stripWorld(), undefined, ['spider']);
  assert.equal(at.distanceAt(2.5, 0.5), 0);
});
