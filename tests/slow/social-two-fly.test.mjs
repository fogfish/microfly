// SC-003: two flies, scripted positions and headings, each ticked through forageEnvWide/senseForagerFlyWide
// with the real social snapshot and the shipped world-forager-social.json. Not a closed-loop run — this
// checks the sensing layer (ADR 012 R8) directly: conspecific odour reads higher on the side nearer the
// other fly, and front-leg contact fires only when that specific leg site lies inside the other fly's body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../../public/js/world/validate.js';
import { indexCatalog } from '../../public/js/world/catalog.js';
import { buildLogic } from '../../public/js/world/layout.js';
import { buildWorld, spawnFlies } from '../../public/js/fly/fly-world.js';
import { resolveFlies } from '../../public/js/fly/fly-config.js';
import { parseSnapshot } from '../../public/js/brain/snapshot.js';
import { createFood } from '../../public/js/fly/food.js';
import { forageEnvWide, refreshConspecifics, senseForagerFlyWide } from '../../public/js/fly/forager-step-wide.js';
import { createPrng } from '../../public/js/world/prng.js';

const WEB = new URL('../../public/', import.meta.url);
const TICKS = 500;

const config = JSON.parse(readFileSync(new URL('world/world-forager-social.json', WEB), 'utf8'));
assert.deepEqual(validateConfig(config), []);
const f = resolveFlies(config);
const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, WEB), 'utf8')));
const world = buildWorld(config, buildLogic(config, catalog));
const bytes = readFileSync(new URL(f.brain.snapshot, WEB));
const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const flowers = createFood(world, f);
const env = forageEnvWide(f, world, flowers, snapshot.capabilities);

const inputs = snapshot.capabilities.channels.inputs;
const idx = (sense, side) => inputs.findIndex((ch) => ch.sense === sense && ch.side === side);
const CONSPECIFIC_L = idx('odour:conspecific', 'L');
const CONSPECIFIC_R = idx('odour:conspecific', 'R');
const CONTACT_L = idx('contact:pheromone', 'L');
const CONTACT_R = idx('contact:pheromone', 'R');
const BODY_RADIUS = f.body.bodyRadius;

const rand = createPrng(2001).next;
const flies = spawnFlies(config, world);
const [A, B] = flies;
A.sex = 'female'; B.sex = 'female'; // both emit fully, isolating the geometry from sex-emission scaling

function place(fly, x, y, heading) {
  fly.body.x = x; fly.body.y = y; fly.body.heading = heading;
}

test('conspecific odour reads higher on the side nearer the other fly, on every sampled tick (SC-003)', () => {
  let checked = 0;
  for (let t = 0; t < TICKS; t++) {
    const heading = rand() * 2 * Math.PI;
    place(A, 30, 20, heading);
    // B placed within radius, off A's midline (never directly ahead/behind, so L != R): a lateral offset
    // of at least 0.5 tiles, at a distance inside the conspecific radius.
    const side = rand() < 0.5 ? 1 : -1;
    const forward = 0.5 + rand() * 1.5;
    const lateral = side * (0.5 + rand() * 1.5);
    // sitePoint's lateral offset (stimulus.js): x += lateral*sin, y -= lateral*cos, for the "L" sign convention.
    const bx = A.body.x + forward * Math.cos(heading) + lateral * Math.sin(heading);
    const by = A.body.y + forward * Math.sin(heading) - lateral * Math.cos(heading);
    place(B, bx, by, 0);
    refreshConspecifics(env, flies);
    const { inputs: vals } = senseForagerFlyWide(A, env);
    const l = vals[CONSPECIFIC_L];
    const r = vals[CONSPECIFIC_R];
    if (l === 0 && r === 0) continue; // out of radius this draw; not a sample of the claim
    checked++;
    // side > 0 (lateral to A's left, stimulus.js convention: left is (sin θ, −cos θ)) means L should read higher.
    if (side > 0) assert.ok(l > r, `tick ${t}: expected L > R with B on the left, got L=${l} R=${r}`);
    else assert.ok(r > l, `tick ${t}: expected R > L with B on the right, got L=${l} R=${r}`);
  }
  assert.ok(checked > TICKS * 0.5, `expected most draws to land in radius, got ${checked}/${TICKS}`);
});

test('front-leg contact fires only on the touching side, on every sampled tick (SC-003)', () => {
  let checked = 0;
  for (let t = 0; t < TICKS; t++) {
    const heading = rand() * 2 * Math.PI;
    place(A, 30, 20, heading);
    // B's centre placed exactly at A's left front-leg site (site forward 0.5, lateral 0.25, well inside
    // bodyRadius), so only A's left contact channel should fire.
    const site = f.body.sites['front-leg'];
    const bx = A.body.x + site.forward * Math.cos(heading) + site.lateral * Math.sin(heading);
    const by = A.body.y + site.forward * Math.sin(heading) - site.lateral * Math.cos(heading);
    place(B, bx, by, rand() * 2 * Math.PI);
    refreshConspecifics(env, flies);
    const { inputs: vals } = senseForagerFlyWide(A, env);
    checked++;
    assert.ok(vals[CONTACT_L] > 0, `tick ${t}: expected A's left contact to fire`);
    assert.equal(vals[CONTACT_R], 0, `tick ${t}: expected A's right contact to stay 0`);
  }
  assert.equal(checked, TICKS);
});

test("B's own contact fires only when B's own leg site is inside A, independent of A's contact", () => {
  const heading = 0;
  place(A, 30, 20, heading);
  const site = f.body.sites['front-leg'];
  // B positioned so A's left site sits inside B's body (same heading as A: both front-leg sites point the
  // same way, so B's own sites land forward of B's centre, away from A).
  const bx = A.body.x + site.forward * Math.cos(heading) + site.lateral * Math.sin(heading);
  const by = A.body.y + site.forward * Math.sin(heading) - site.lateral * Math.cos(heading);
  place(B, bx, by, heading);
  refreshConspecifics(env, flies);

  const { inputs: aVals } = senseForagerFlyWide(A, env);
  assert.ok(aVals[CONTACT_L] > 0, "expected A's left contact to fire (B's centre is at A's left site)");

  const { inputs: bVals } = senseForagerFlyWide(B, env);
  const siteOf = (fly, side) => {
    const lateral = side === 'R' ? -site.lateral : site.lateral;
    return {
      x: fly.body.x + site.forward * Math.cos(fly.body.heading) + lateral * Math.sin(fly.body.heading),
      y: fly.body.y + site.forward * Math.sin(fly.body.heading) - lateral * Math.cos(fly.body.heading),
    };
  };
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  // B's own leg sites, both forward of B's centre (same heading as A), are further than bodyRadius from A.
  assert.ok(dist(siteOf(B, 'L'), A.body) > BODY_RADIUS, "sanity: B's own left site is outside A's body");
  assert.ok(dist(siteOf(B, 'R'), A.body) > BODY_RADIUS, "sanity: B's own right site is outside A's body");
  assert.equal(bVals[CONTACT_L], 0, "B's left contact should not fire: B's own site is outside A");
  assert.equal(bVals[CONTACT_R], 0, "B's right contact should not fire: B's own site is outside A");
});
