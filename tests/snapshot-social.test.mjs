// Contract test (JS side) for public/brains/forager-brain-social.brain (ADR 012, spec 020). Parses the shipped
// snapshot and checks: channel declaration v6, the four social channels and their senses/sites, a `song`
// output, the disjoint social input pools, and taste-leg membership identical to forager-brain-mb.brain
// (SC-001). Skipped when either shipped file is absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSnapshot } from '../public/js/brain/snapshot.js';

const SOCIAL = fileURLToPath(new URL('../public/brains/forager-brain-social.brain', import.meta.url));
const MB = fileURLToPath(new URL('../public/brains/forager-brain-mb.brain', import.meta.url));
const SKIP = existsSync(SOCIAL) && existsSync(MB) ? false : 'shipped social/mb brain is absent';

function load(path) {
  const buf = readFileSync(path);
  return parseSnapshot(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function poolBodyIds(snapshot, channelIds) {
  const wanted = new Set(channelIds);
  return new Set(
    snapshot.manifest.neurons.filter((n) => wanted.has(n.channel)).map((n) => n.bodyId),
  );
}

test('forager-brain-social.brain declares channel declaration v6', { skip: SKIP }, () => {
  const social = load(SOCIAL);
  assert.equal(social.capabilities.declaration, 6);
});

test('the four social channels carry their declared sense and site', { skip: SKIP }, () => {
  const social = load(SOCIAL);
  const byId = new Map(social.capabilities.channels.inputs.map((ch) => [ch.id, ch]));
  assert.equal(byId.get('odour-conspecific-left').sense, 'odour:conspecific');
  assert.equal(byId.get('odour-conspecific-left').site, 'antenna');
  assert.equal(byId.get('odour-conspecific-right').sense, 'odour:conspecific');
  assert.equal(byId.get('odour-conspecific-right').site, 'antenna');
  assert.equal(byId.get('contact-pheromone-left').sense, 'contact:pheromone');
  assert.equal(byId.get('contact-pheromone-left').site, 'front-leg');
  assert.equal(byId.get('contact-pheromone-right').sense, 'contact:pheromone');
  assert.equal(byId.get('contact-pheromone-right').site, 'front-leg');
});

test('a song output exists and reads real neurons', { skip: SKIP }, () => {
  const social = load(SOCIAL);
  const song = social.capabilities.channels.outputs.find((ch) => ch.id === 'song');
  assert.ok(song, 'expected a song output channel');
  assert.equal(song.drive, 'song');
  assert.ok(song.neurons.length > 0);
});

test('the social input pools are disjoint from each other and from taste-leg', { skip: SKIP }, () => {
  const social = load(SOCIAL);
  const conspecific = poolBodyIds(social, ['odour-conspecific-left', 'odour-conspecific-right']);
  const contact = poolBodyIds(social, ['contact-pheromone-left', 'contact-pheromone-right']);
  const tasteLeg = poolBodyIds(social, ['taste-leg-left', 'taste-leg-right']);
  for (const id of contact) assert.ok(!conspecific.has(id), `bodyId ${id} in both conspecific and contact pools`);
  for (const id of contact) assert.ok(!tasteLeg.has(id), `bodyId ${id} in both contact and taste-leg pools`);
  for (const id of conspecific) assert.ok(!tasteLeg.has(id), `bodyId ${id} in both conspecific and taste-leg pools`);
  assert.ok(conspecific.size > 0 && contact.size > 0 && tasteLeg.size > 0);
});

test('taste-leg membership is identical to forager-brain-mb.brain (SC-001)', { skip: SKIP }, () => {
  const social = load(SOCIAL);
  const mb = load(MB);
  const socialTasteLeg = poolBodyIds(social, ['taste-leg-left', 'taste-leg-right']);
  const mbTasteLeg = poolBodyIds(mb, ['taste-leg-left', 'taste-leg-right']);
  assert.deepEqual([...socialTasteLeg].sort((a, b) => a - b), [...mbTasteLeg].sort((a, b) => a - b));
});
