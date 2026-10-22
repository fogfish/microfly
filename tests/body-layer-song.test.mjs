// W17 (ADR 012 R12): the song integrator and fly.singing. The integrator is
// song ← song + (max(0, r(song) − rest) − song) / tau (named.song.drive is already that max(0, r − rest));
// fly.singing is true while song ≥ threshold. Pure function tests against a minimal fake env/flowers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody } from '../public/js/fly/body.js';
import { initBodyLayerFly, stepBodyLayer } from '../public/js/fly/body-layer.js';

const LOCOMOTION = {
  baseSpeed: 0.6, speedGain: 2, maxSpeed: 3, surgeGain: 0.3, wander: 0,
  turnGain: 1.5, castGain: 1, castMin: 0.3, castMax: 1,
};
const ESCAPE = { enabled: true, threshold: 0.5, distance: 1.5, cooldown: 2 };
const BACKUP = { threshold: 0.5, ticks: 10 };
const SONG = { threshold: 0.3, tau: 5 };

function fakeFlowers() {
  return { stockAt: () => 0, cellOf: (cx, cy) => cy * 1000 + cx, consume: () => {}, regrow: () => {} };
}

function fakeEnv() {
  return {
    dt: 0.05, width: 1000, height: 1000,
    isWalkable: () => true,
    isStimulusCell: () => false,
    flowers: fakeFlowers(),
    foodConfig: { eatSpeed: 0.5, feedThreshold: 0.5, consumeRate: 0.2, regrowth: 0.02 },
    energyConfig: { metabolism: 0.005, intake: 0.2 },
  };
}

function freshFly(heading = 0) {
  const fly = { body: createBody({ x: 10, y: 10, heading }), energy: 0.5, bout: null, bouts: [], eating: false };
  initBodyLayerFly(fly, 1);
  return fly;
}

const EMPTY_SENSE = { drive: 0, side: undefined, weight: 0, trend: 0, valence: 'none' };
function decoded(songDrive) {
  return {
    senses: { 'odour-food': { ...EMPTY_SENSE, valence: 'approach' } },
    named: {
      forward: { r: 0, rest: 0, drive: 0 }, backward: { r: 0, rest: 0, drive: 0 },
      alarm: { r: 0, rest: 0, drive: 0 }, feed: { r: 0, rest: 0, drive: 0 },
      song: { r: songDrive, rest: 0, drive: songDrive },
    },
  };
}

test('W17 is off when flies.body.song is absent: song stays 0, singing stays false, even with a driven song pool', () => {
  const fly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP }; // no song key
  for (let i = 0; i < 10; i++) stepBodyLayer(fly, decoded(1), cfg, fakeEnv());
  assert.equal(fly.bodyLayer.song, 0);
  assert.equal(fly.singing, false);
});

test('the integrator rises toward the driven rate and fly.singing becomes true at threshold', () => {
  const fly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP, song: SONG };
  let sawSinging = false;
  for (let i = 0; i < 40; i++) {
    stepBodyLayer(fly, decoded(1), cfg, fakeEnv());
    if (fly.singing) { sawSinging = true; break; }
  }
  assert.ok(sawSinging, 'expected fly.singing to become true once song crosses threshold');
  assert.ok(fly.bodyLayer.song >= SONG.threshold);
});

test('the integrator follows song ← song + (max(0, r − rest) − song) / tau exactly, one step at a time', () => {
  const fly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP, song: SONG };
  let expected = 0;
  for (const drive of [0.5, 0.5, 0.8, 0.2, 0]) {
    stepBodyLayer(fly, decoded(drive), cfg, fakeEnv());
    expected = expected + (Math.max(0, drive - 0) - expected) / SONG.tau;
    assert.ok(Math.abs(fly.bodyLayer.song - expected) < 1e-9, `expected ${expected}, got ${fly.bodyLayer.song}`);
  }
});

test('song falls back toward 0 and fly.singing becomes false once it drops below threshold', () => {
  const fly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP, song: SONG };
  for (let i = 0; i < 40; i++) stepBodyLayer(fly, decoded(1), cfg, fakeEnv());
  assert.equal(fly.singing, true);
  for (let i = 0; i < 40; i++) stepBodyLayer(fly, decoded(0), cfg, fakeEnv());
  assert.equal(fly.singing, false);
  assert.ok(fly.bodyLayer.song < SONG.threshold);
});

test('singing changes no heading or speed (drawing only)', () => {
  const singingFly = freshFly();
  const quietFly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP, song: SONG };
  for (let i = 0; i < 40; i++) stepBodyLayer(singingFly, decoded(1), cfg, fakeEnv());
  for (let i = 0; i < 40; i++) stepBodyLayer(quietFly, decoded(0), cfg, fakeEnv());
  assert.equal(singingFly.singing, true);
  assert.equal(quietFly.singing, false);
  assert.ok(Math.abs(singingFly.body.heading - quietFly.body.heading) < 1e-9);
  assert.ok(Math.abs(singingFly.body.speed - quietFly.body.speed) < 1e-9);
});

test('a brain with no song pool at all (named.song absent) leaves song at 0 and singing false', () => {
  const fly = freshFly();
  const cfg = { locomotion: LOCOMOTION, escape: ESCAPE, backup: BACKUP, song: SONG };
  const noSongDecoded = decoded(0);
  delete noSongDecoded.named.song;
  for (let i = 0; i < 10; i++) stepBodyLayer(fly, noSongDecoded, cfg, fakeEnv());
  assert.equal(fly.bodyLayer.song, 0);
  assert.equal(fly.singing, false);
});
