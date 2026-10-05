// Shore decor (BUG-002, FR-030, SC-004): grass-style decor placed from the signed distance S.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shorePlacements, GRASS_RULES, REED_SOURCES } from '../js/world/shore.js';
import { waterField, distanceAt } from '../js/world/water.js';

const load = () => JSON.parse(readFileSync(new URL('../world/world.json', import.meta.url), 'utf8'));
const config = load();
const shore = shorePlacements(config);
const field = waterField(config);
const PX = 32;

test('placement is deterministic', () => {
  assert.deepEqual(shorePlacements(load()), shore);
});

test('every water body of the shipped world has shore decor', () => {
  for (const b of config.waterBodies) assert.ok(shore.some((p) => p.body === b.id), b.id);
});

test('decor stands across the waterline at least once in every 100 px of shoreline', () => {
  for (const body of field.bodies) {
    const straddling = shore.filter((p) => p.body === body.id && Math.abs(distanceAt(field, p.x, p.y) + 1) <= 4);
    const want = Math.floor(body.perimeter / 100);
    assert.ok(straddling.length >= want, `${body.id}: ${straddling.length} items on the waterline, want ${want}`);
  }
});

test('decor sits in its rule band', () => {
  const rules = new Map(GRASS_RULES.map((r) => [r.name, r]));
  for (const p of shore) {
    const rule = rules.get(p.rule);
    const k = Math.round(p.y * PX) * field.W + Math.round(p.x * PX);
    const s = field.S[k];
    if (rule.s) assert.ok(s >= rule.s[0] && s <= rule.s[1], `${p.rule} at S ${s}`);
    else assert.ok(s >= 0 && s / field.Wsh[k] >= rule.t[0] && s / field.Wsh[k] <= rule.t[1], `${p.rule} at S ${s}`);
  }
});

test('no item is rotated, beach-plant-001 is never used, and reed sprites only appear cut into reed beds', () => {
  for (const p of shore) {
    assert.equal(p.rot, undefined);
    assert.notEqual(p.sprite, 'beach-plant-001');
    if (p.kind === 'sprite') assert.ok(!REED_SOURCES.includes(p.sprite), p.sprite);
    else assert.ok(REED_SOURCES.includes(p.reed.source));
  }
});

test('a pond has at most one reed bed', () => {
  for (const body of field.bodies.filter((b) => b.kind === 'pond')) {
    const beds = shore.filter((p) => p.body === body.id && p.kind === 'reedbed');
    assert.ok(beds.length <= 1, `${body.id} has ${beds.length} reed beds`);
  }
});

test('only waterline items stand in water, and they carry a ripple ring', () => {
  for (const p of shore.filter((q) => q.wet)) {
    assert.ok(p.ripple, `${p.rule} stands in water without a ripple`);
    assert.ok(distanceAt(field, p.x, p.y) >= -5, `${p.rule} is too far into the water`);
  }
});
