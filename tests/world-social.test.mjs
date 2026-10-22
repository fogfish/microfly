// World config v3 social additions (ADR 012 R8/R9/R10/R12, contracts/world-config-v3-social.md): from:"flies"
// stimuli, flies.sexes, flies.body.bodyRadius/solid/song. Every key is optional and a world declaring none
// loads unchanged (old worlds still validate at the bottom of this file).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';
import { resolveFlies, BODY_RADIUS_DEFAULT } from '../public/js/fly/fly-config.js';
import { forageEnvWide } from '../public/js/fly/forager-step-wide.js';

const load = (name) => JSON.parse(readFileSync(new URL(`../public/world/${name}`, import.meta.url), 'utf8'));
const paths = (errors) => errors.map((e) => e.path);
const messageAt = (errors, path) => errors.find((e) => e.path === path)?.message;

function social() {
  return load('world-forager-social.json');
}

test('the shipped social world validates with no errors', () => {
  assert.deepEqual(validateConfig(social()), []);
});

test('from:"flies" in odour mode, with radius > 0, validates', () => {
  const c = social();
  c.flies.stimuli['odour:conspecific'] = { from: 'flies', radius: 3, contrast: { common: 0.5, gain: 5 } };
  assert.deepEqual(validateConfig(c), []);
});

test('from:"flies" in contact mode validates', () => {
  const c = social();
  c.flies.stimuli['contact:pheromone'] = { from: 'flies', contact: true };
  assert.deepEqual(validateConfig(c), []);
});

test('interpolate with from:"flies" fails with "does not apply to from \\"flies\\""', () => {
  const c = social();
  c.flies.stimuli['odour:conspecific'] = { from: 'flies', radius: 3, interpolate: true };
  const errors = validateConfig(c);
  assert.equal(messageAt(errors, 'flies.stimuli["odour:conspecific"]'), 'interpolate does not apply to from "flies"');
});

test('scaleBy with from:"flies" fails with "does not apply to from \\"flies\\""', () => {
  const c = social();
  c.flies.stimuli['odour:conspecific'] = { from: 'flies', radius: 3, scaleBy: 'stock' };
  const errors = validateConfig(c);
  assert.equal(messageAt(errors, 'flies.stimuli["odour:conspecific"]'), 'scaleBy does not apply to from "flies"');
});

test('flies.sexes.default must be a declared sex', () => {
  const c = social();
  c.flies.sexes = { default: 'nonbinary-moth' };
  const errors = validateConfig(c);
  assert.equal(messageAt(errors, 'flies.sexes.default'), 'must be "female" or "male"');
});

test('flies.sexes.<sex>.emits key must name a declared from:"flies" stimulus', () => {
  const c = social();
  c.flies.sexes = { default: 'female', female: { emits: { 'odour:food-a': 1 } } };
  const errors = validateConfig(c);
  assert.equal(messageAt(errors, 'flies.sexes.female.emits'), '"odour:food-a" is not a declared from:"flies" stimulus');
});

test('flies.sexes.<sex>.emits value must be in [0, 1]', () => {
  const c = social();
  c.flies.sexes = { default: 'female', female: { emits: { 'odour:conspecific': 1.5 } } };
  const errors = validateConfig(c);
  assert.equal(messageAt(errors, 'flies.sexes.female.emits.odour:conspecific'), 'must be a number from 0 to 1');
});

test('flies.sexes.default/female/male all valid, with full emits maps, validates', () => {
  const c = social();
  c.flies.sexes = {
    default: 'female',
    female: { emits: { 'odour:conspecific': 1, 'contact:pheromone': 1 } },
    male: { emits: { 'odour:conspecific': 1, 'contact:pheromone': 0 } },
  };
  assert.deepEqual(validateConfig(c), []);
});

test('an unknown flies.sex[i] fails with \'flies.sex[<i>]: unknown sex "<v>"\'', () => {
  const c = social();
  c.flies.sex = [...c.flies.sex];
  c.flies.sex[0] = 'nonbinary-moth';
  const errors = validateConfig(c);
  assert.deepEqual(paths(errors), ['flies.sex[0]']);
  assert.equal(errors[0].message, 'unknown sex "nonbinary-moth"');
});

test('flies.body.bodyRadius must be a number greater than 0, and defaults to 0.35', () => {
  const c = social();
  c.flies.body.bodyRadius = 0;
  assert.equal(messageAt(validateConfig(c), 'flies.body.bodyRadius'), 'must be a number greater than 0');

  delete c.flies.body.bodyRadius;
  assert.deepEqual(validateConfig(c), []);
  assert.equal(resolveFlies(c).body.bodyRadius, BODY_RADIUS_DEFAULT);
  assert.equal(BODY_RADIUS_DEFAULT, 0.35);
});

test('flies.body.solid must be a boolean, and defaults to false', () => {
  const c = social();
  c.flies.body.solid = 'yes';
  assert.equal(messageAt(validateConfig(c), 'flies.body.solid'), 'must be true or false');

  delete c.flies.body.solid;
  assert.deepEqual(validateConfig(c), []);
  assert.equal(resolveFlies(c).body.solid, false);
});

test('flies.body.song must be {threshold, tau}', () => {
  const c = social();
  c.flies.body.song = { threshold: 0.1 };
  assert.equal(messageAt(validateConfig(c), 'flies.body.song.tau'), 'must be a number greater than 0');

  c.flies.body.song = { threshold: 0.1, tau: 10 };
  assert.deepEqual(validateConfig(c), []);
});

test('flies.body.song needs a snapshot song output', () => {
  const capabilitiesWithSong = {
    channels: {
      inputs: [{ id: 'odour-food-a-left', sense: 'odour:food-a', site: 'antenna', side: 'L' }],
      outputs: [{ id: 'song', drive: 'song' }],
    },
  };
  const capabilitiesNoSong = {
    channels: {
      inputs: [{ id: 'odour-food-a-left', sense: 'odour:food-a', site: 'antenna', side: 'L' }],
      outputs: [{ id: 'turn-left', drive: 'turnLeft' }],
    },
  };
  const f = {
    tickHz: 20, body: { maxSpeed: 1, turnRate: 1, sites: { antenna: { forward: 0, lateral: 0.5 } }, song: { threshold: 0.1, tau: 10 } },
    stimuli: { 'odour:food-a': { from: 'blocked' } }, food: {},
  };
  const world = { width: 10, height: 10, walkable: () => true, isStimulusCell: () => false };
  const flowers = { points: () => [] };

  assert.throws(() => forageEnvWide(f, world, flowers, capabilitiesNoSong), /flies\.body\.song needs a snapshot song output/);
  forageEnvWide(f, world, flowers, capabilitiesWithSong); // does not throw
});

for (const name of ['world-forager.json', 'world-forager-demo.json', 'world-forager-learning.json']) {
  test(`${name} still validates (old worlds are unaffected)`, () => {
    assert.deepEqual(validateConfig(load(name)), []);
  });
}
