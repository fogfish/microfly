// `from: "flies"` pure helpers (ADR 012 R8, data-model.md "Conspecific odour field"/"Contact"): a moving
// odour source per other fly, and front-leg contact, both read from the live `flies` table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conspecificAt, contactAt } from '../public/js/fly/stimulus.js';

const EMITS_ALL_1 = () => 1;
const EMITS_BY_SEX = (sex) => (sex === 'female' ? 1 : 0);

function fly(id, x, y, { sex = 'female', alive = true } = {}) {
  return { id, x, y, heading: 0, sex, alive };
}

test('conspecificAt is 0 with no other fly', () => {
  const flies = [fly('a', 0, 0)];
  assert.equal(conspecificAt({ x: 0, y: 0 }, flies, 'a', { radius: 3 }, EMITS_ALL_1), 0);
});

test('conspecificAt is 0 for self only (self excluded even when it would otherwise contribute)', () => {
  const flies = [fly('a', 0, 0)];
  assert.equal(conspecificAt({ x: 0.1, y: 0 }, flies, 'a', { radius: 3 }, EMITS_ALL_1), 0);
});

test('conspecificAt grows as distance to the other fly shrinks', () => {
  const far = [fly('a', 0, 0), fly('b', 2.5, 0)];
  const near = [fly('a', 0, 0), fly('b', 0.5, 0)];
  const spec = { radius: 3 };
  const vFar = conspecificAt({ x: 0, y: 0 }, far, 'a', spec, EMITS_ALL_1);
  const vNear = conspecificAt({ x: 0, y: 0 }, near, 'a', spec, EMITS_ALL_1);
  assert.ok(vNear > vFar, `expected nearer fly to give a higher value: near=${vNear} far=${vFar}`);
});

test('conspecificAt is higher on the side of the other fly (sampled at each antenna point)', () => {
  const flies = [fly('a', 0, 0), fly('b', 0, 1)]; // b is "below" a in y
  const spec = { radius: 3 };
  const leftSite = { x: -0.3, y: 0 }; // further from b
  const rightSite = { x: 0.3, y: 0.9 }; // closer to b
  const vLeft = conspecificAt(leftSite, flies, 'a', spec, EMITS_ALL_1);
  const vRight = conspecificAt(rightSite, flies, 'a', spec, EMITS_ALL_1);
  assert.ok(vRight > vLeft, `expected the site nearer b to read higher: left=${vLeft} right=${vRight}`);
});

test('conspecificAt is capped at 1 when several flies stack', () => {
  const flies = [fly('a', 0, 0), fly('b', 0, 0), fly('c', 0, 0), fly('d', 0, 0), fly('e', 0, 0)];
  assert.equal(conspecificAt({ x: 0, y: 0 }, flies, 'a', { radius: 3 }, EMITS_ALL_1), 1);
});

test('conspecificAt scales emission per sex, and a dead fly emits 0', () => {
  const flies = [fly('a', 0, 0), fly('b', 0.5, 0, { sex: 'male' })];
  const spec = { radius: 3 };
  assert.equal(conspecificAt({ x: 0, y: 0 }, flies, 'a', spec, EMITS_BY_SEX), 0, 'male emits 0 under EMITS_BY_SEX');

  const female = [fly('a', 0, 0), fly('b', 0.5, 0, { sex: 'female' })];
  assert.ok(conspecificAt({ x: 0, y: 0 }, female, 'a', spec, EMITS_BY_SEX) > 0, 'female emits under EMITS_BY_SEX');

  const dead = [fly('a', 0, 0), fly('b', 0.1, 0, { alive: false })];
  assert.equal(conspecificAt({ x: 0, y: 0 }, dead, 'a', spec, EMITS_ALL_1), 0, 'a dead fly emits 0');
});

test('contactAt returns 1 x emits inside the radius and 0 outside', () => {
  const flies = [fly('a', 0, 0), fly('b', 0.2, 0)];
  assert.equal(contactAt({ x: 0, y: 0 }, flies, 'a', 0.35, EMITS_ALL_1), 1);

  const far = [fly('a', 0, 0), fly('b', 5, 0)];
  assert.equal(contactAt({ x: 0, y: 0 }, far, 'a', 0.35, EMITS_ALL_1), 0);
});

test('contactAt uses the maximum over flies, not a sum', () => {
  const flies = [fly('a', 0, 0), fly('b', 0.1, 0), fly('c', 0.2, 0)];
  assert.equal(contactAt({ x: 0, y: 0 }, flies, 'a', 0.35, EMITS_ALL_1), 1);
});

test('contactAt excludes self', () => {
  const flies = [fly('a', 0, 0)];
  assert.equal(contactAt({ x: 0, y: 0 }, flies, 'a', 0.35, EMITS_ALL_1), 0);
});

test('contactAt scales by the contacting fly\'s own emission', () => {
  const flies = [fly('a', 0, 0), fly('b', 0.1, 0, { sex: 'male' })];
  assert.equal(contactAt({ x: 0, y: 0 }, flies, 'a', 0.35, EMITS_BY_SEX), 0);
  const female = [fly('a', 0, 0), fly('b', 0.1, 0, { sex: 'female' })];
  assert.equal(contactAt({ x: 0, y: 0 }, female, 'a', 0.35, EMITS_BY_SEX), 1);
});

test('contactAt and conspecificAt both treat a not-yet-spawned fly (alive: false) as emitting nothing', () => {
  const flies = [fly('a', 0, 0), fly('b', 0.1, 0, { alive: false })];
  assert.equal(contactAt({ x: 0, y: 0 }, flies, 'a', 0.35, EMITS_ALL_1), 0);
  assert.equal(conspecificAt({ x: 0, y: 0 }, flies, 'a', { radius: 3 }, EMITS_ALL_1), 0);
});
