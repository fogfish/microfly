// Body layer (nerve-cord stand-in), ADR 010 Part E, W12–W14. `flies.brain.version === "v3"` only. Pure: no DOM,
// no workers, no stimulus reads — every input here is a decoded brain signal (decoder.js's decodeTick) or a
// declared locomotion/escape/backup config (contracts/world-config-v3.md). Never reads the stimulus directly
// (constitution VI).

import { pick, cellKey, applyEscape } from './body.js';
import { flowerAt } from './fly-world.js';
import { createPrng } from '../world/prng.js';
import { eat, closeBout, metabolise, startBout, updateBout } from './energy.js';

// v_p (W13): the sign a sense's declared valence contributes to steering.
const VALENCE_SIGN = { approach: 1, avoid: -1, none: 0 };

// Sign fix for this codebase's heading convention (body.js: "increasing the heading turns the fly right", the
// same sign test FORAGER_TURN_SIGN resolves for stepForagerBody). side_p > 0 means the brain's L-selective pool
// (named "side.<pair>.L" at calibration, D27) is firing more — i.e. the stimulus is on the fly's left — so an
// approach sense (v_p = +1) with side_p > 0 must turn the heading down (left), not up.
const TURN_SIGN = -1;

// Per-fly mutable state the body layer owns, alongside fly.body (W14's escapeCooldown lives on body itself,
// reused from body.js). seed: the fly's own brain seed, so wander noise is reproducible (ADR 010 L7-style).
export function initBodyLayerFly(fly, seed) {
  fly.body.escapeCooldown = 0;
  fly.bodyLayer = {
    rand: createPrng(seed).next, backupTicksLeft: 0, alarm: 0,
    // flies.food.feedTau (ADR 011 D53): the integrated feed drive the eating reflex compares with feedThreshold.
    feed: 0,
    // Motor stage (BUG-004): current signed speed, and the escape sprint in progress (distance left, heading).
    velocity: 0, sprintLeft: 0, sprintHeading: 0, sprintTicks: 0,
  };
  return fly;
}

// Σ_p v_p·ℓ_p · f(sense_p) over every declared sense, skipping a sense whose f(sense_p) is absent (no side pool).
// ℓ_p (ADR 011, decoder.js's learnedGain) is undefined for every non-food pair and whenever learning is off, so
// it defaults to 1 there; it is always > 0, so it scales v_p's magnitude without ever changing its sign.
function sumByValence(senses, f) {
  let total = 0;
  for (const pair of Object.keys(senses)) {
    const sense = senses[pair];
    const v = (VALENCE_SIGN[sense.valence] ?? 0) * (sense.learnedGain ?? 1);
    const value = f(sense);
    if (value === undefined) continue;
    total += v * value;
  }
  return total;
}

// W12 + W13: heading and speed for one tick, from the decoded senses and the declared locomotion config.
// Returns { heading, speed }; does not move the body (the caller applies dx/dy via pick, as body.js does).
function walk(body, state, senses, named, cfg, dt) {
  const forward = named.forward ?? { r: 0, rest: 0, drive: 0 };
  // W13: tropotaxis (L/R comparison, weighted by how strongly the sense is driven) plus klinotaxis (the sense's
  // own trend, always defined — carries steering alone when a sense has no side pool, Edge Case).
  const turn = TURN_SIGN * cfg.turnGain * sumByValence(senses, (s) => (s.side === undefined ? undefined : s.weight * s.side));
  const signedTrend = sumByValence(senses, (s) => s.trend);
  const cast = clamp(1 - cfg.castGain * signedTrend, cfg.castMin, cfg.castMax);
  const noise = 2 * state.rand() - 1;
  const heading = body.heading + (turn + cfg.wander * cast * noise) * dt;

  // W12: baseSpeed > 0 means the fly walks without being driven; forward drive adds to it; a rising approach
  // trend surges speed further.
  const speed = clamp(cfg.baseSpeed + cfg.speedGain * (forward.drive), 0, cfg.maxSpeed)
    * (1 + cfg.surgeGain * Math.max(0, signedTrend));
  return { heading, speed };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Motor stage (spec 017 BUG-004; ADR 010 Amendment A4), flies.body.motor: the body follows the commanded heading
// and speed as legs do, not at once. The heading turns towards its target by at most turnRate · dt (maxTurnRate,
// or escapeTurnRate during an escape sprint), the shorter way round; the signed speed moves towards its target by at
// most maxAccel · dt. Forward speed is scaled by cos(heading error), so a fly facing away from its target turns
// before it runs (an escape does not first sprint towards the danger). Reads only the body's own state.
// motor: { maxTurnRate, escapeTurnRate, maxAccel, sprintSpeed }.
const SPRINT_MAX_TICKS = 100; // an escape blocked by walls ends after 5 s at 20 ticks/s, never runs on forever

function motorStep(body, state, target, motor, env) {
  const { dt } = env;
  const rate = target.turnRate ?? motor.maxTurnRate;
  const error = Math.atan2(Math.sin(target.heading - body.heading), Math.cos(target.heading - body.heading));
  const turn = clamp(error, -rate * dt, rate * dt);
  body.heading += turn;
  const remaining = error - turn;
  const wanted = target.speed > 0 ? target.speed * Math.max(0, Math.cos(remaining)) : target.speed;
  state.velocity += clamp(wanted - state.velocity, -motor.maxAccel * dt, motor.maxAccel * dt);

  const dx = Math.cos(body.heading) * state.velocity * dt;
  const dy = Math.sin(body.heading) * state.velocity * dt;
  const next = pick(body.x, body.y, dx, dy, env);
  const moved = Math.hypot(next.x - body.x, next.y - body.y);
  body.speed = moved / dt;
  body.x = next.x;
  body.y = next.y;

  if (state.sprintLeft > 0) {
    state.sprintTicks++;
    state.sprintLeft -= moved;
    if (state.sprintTicks >= SPRINT_MAX_TICKS) state.sprintLeft = 0;
  }
}

// W14 (escape): the heading to escape along when alarm fires — away from whichever side pool exists (danger, then
// heat). When neither exists the side is unknown: with escape.turn { min, max } (radians; spec 017 BUG-005) the fly
// turns by an angle drawn uniformly from [min, max], left or right at random, from its own seeded stream. A reversal
// pointed the fly at a threat beside or behind it, and every escape looked the same. Without escape.turn: backward
// (the opposite of the current heading, the ADR 010 Edge Case).
function escapeHeading(body, senses, state, turn) {
  const side = senses['odour-danger']?.side ?? senses['heat']?.side;
  if (side === undefined) {
    if (!turn) return body.heading + Math.PI;
    const angle = turn.min + (turn.max - turn.min) * state.rand();
    return body.heading + (state.rand() < 0.5 ? -angle : angle);
  }
  // side > 0: danger on the left: turn right (TURN_SIGN's own +heading-is-right convention) to escape away.
  return body.heading + (side > 0 ? -TURN_SIGN : TURN_SIGN) * Math.PI / 2;
}

// One whole v3 tick: decode is already done (decoder.js); this applies W12–W14 and the body physics, mirroring
// applyForagerMotor's shape (forager-step.js) so fly-host.js's call site stays uniform across versions.
// decoded: decoder.js's decodeTick return, { senses, named }. cfg: { locomotion, escape, backup }.
// env: { dt, width, height, isWalkable, isStimulusCell, flowers, foodConfig, energyConfig }.
export function stepBodyLayer(fly, decoded, cfg, env) {
  const { senses, named } = decoded;
  const body = fly.body;
  const state = fly.bodyLayer;
  const { flowers, foodConfig, energyConfig, dt } = env;

  // D30: the fly eats when it stands on food and r(feed) − rest(feed) ≥ feedThreshold. No hunger override (hunger
  // acts only through the brain's input, D32) and no speed gate: v1/v2's canEat requires speed < eatSpeed, but the
  // W12 body always walks at ≥ baseSpeed, so under that gate a v3 fly could never eat (spec 017 BUG-001). Instead,
  // the nerve-cord stand-in halts walking for the tick the brain feeds, as a fly stands still while it extends its
  // proboscis. "On food" is the flower's eating area (flies.food.reach, fly-world.js flowerAt; spec 017 BUG-002),
  // decided where the fly stands before it moves; the flower's own cell holds the stock.
  // flies.food.feedTau (ticks, default 1 = no integration; ADR 011 D53): the reflex integrates the decoded feed
  // drive before comparing it with feedThreshold, as escape.tau does for alarm (BUG-003). The taste-mouth pool
  // adapts within ~10 ticks of contact (L2), so a per-tick gate on its rate ended every bout after a few ticks.
  // tau 1 takes the drive itself, so a world without the key is bit-for-bit unchanged.
  const feedTau = foodConfig.feedTau ?? 1;
  const feedDrive = (named.feed ?? { drive: 0 }).drive;
  state.feed = feedTau === 1 ? feedDrive : (state.feed ?? 0) + (feedDrive - (state.feed ?? 0)) / feedTau;
  const feed = { drive: state.feed };
  const flower = flowerAt(env, Math.floor(body.x), Math.floor(body.y), foodConfig.reach ?? 0);
  const fx = flower < 0 ? Math.floor(body.x) : flower % env.width;
  const fy = flower < 0 ? Math.floor(body.y) : Math.floor(flower / env.width);
  const eating = flower >= 0 && flowers.stockAt(fx, fy) > 0 && feed.drive >= foodConfig.feedThreshold
    && !(cfg.motor !== undefined && state.sprintLeft > 0);

  // W14 (backing up): a run in progress continues; otherwise the backward drive may start one. Not while feeding,
  // nor during an escape sprint (motor stage).
  const sprinting = cfg.motor !== undefined && state.sprintLeft > 0;
  const backward = named.backward ?? { drive: 0 };
  let backingUp = !eating && !sprinting && state.backupTicksLeft > 0;
  if (!eating && !sprinting && !backingUp && cfg.backup && backward.drive >= cfg.backup.threshold) {
    backingUp = true;
    state.backupTicksLeft = cfg.backup.ticks;
  }
  if (backingUp) state.backupTicksLeft--;

  // The commands for this tick: a target heading and a signed target speed (negative walks backwards, facing the
  // same way: spec 017 BUG-001 removed the per-tick heading flip).
  let target;
  if (sprinting) {
    target = { heading: state.sprintHeading, speed: cfg.motor.sprintSpeed, turnRate: cfg.motor.escapeTurnRate };
  } else if (eating) {
    // Spec 018 US3 (contracts/world-config-food-feeding.md): a feeding fly pauses (speed 0, the default) or holds
    // flies.food.feedSlowSpeed for the whole bout. The brain decided to feed; only the body's speed changes here.
    target = { heading: body.heading, speed: foodConfig.feedMotion === 'slow' ? foodConfig.feedSlowSpeed : 0 };
  } else if (backingUp) {
    target = { heading: body.heading, speed: -cfg.locomotion.baseSpeed };
  } else {
    target = walk(body, state, senses, named, cfg.locomotion, dt);
  }

  if (cfg.motor) {
    motorStep(body, state, target, cfg.motor, env);
  } else {
    // No motor stage (flies.body.motor absent): commands apply at once, the pre-BUG-004 behaviour.
    const dx = Math.cos(target.heading) * target.speed * dt;
    const dy = Math.sin(target.heading) * target.speed * dt;
    const next = pick(body.x, body.y, dx, dy, env);
    body.speed = target.speed < 0 ? Math.hypot(next.x - body.x, next.y - body.y) / dt : target.speed;
    body.heading = target.heading;
    body.x = next.x;
    body.y = next.y;
  }

  const cx = Math.floor(body.x);
  const cy = Math.floor(body.y);
  const key = cellKey(cx, cy);
  if (key !== body.cell) {
    body.cell = key;
    if (env.isStimulusCell(cx, cy)) body.contacts++;
  }

  // W14 (escape), pointed away from the declared danger/heat side first.
  // escape.tau (ticks, default 1 = no integration): the reflex integrates the decoded alarm before comparing it with
  // the threshold, so a network-wide burst does not trigger it (spec 017 BUG-003; calibration.md alarm-slow probe).
  const alarmDrive = named.alarm?.drive ?? 0;
  state.alarm += (alarmDrive - state.alarm) / (cfg.escape?.tau ?? 1);
  const willEscape = cfg.escape?.enabled && state.alarm > cfg.escape.threshold && (body.escapeCooldown ?? 0) <= 0;
  if (cfg.motor) {
    // Motor stage (spec 017 BUG-004): the escape is a motor programme, not a teleport. The brain's alarm decides
    // when; the body turns towards the escape heading at escapeTurnRate and sprints until it has covered
    // escape.distance (the trigger, threshold and cooldown are unchanged).
    body.escapeCooldown = Math.max(0, (body.escapeCooldown ?? 0) - dt);
    if (willEscape) {
      state.sprintHeading = escapeHeading(body, senses, state, cfg.escape.turn);
      state.sprintLeft = cfg.escape.distance;
      state.sprintTicks = 0;
      body.escapeCooldown = cfg.escape.cooldown;
    }
  } else {
    if (willEscape) body.heading = escapeHeading(body, senses, state, cfg.escape.turn);
    applyEscape(body, { escape: state.alarm }, { ...env, escape: cfg.escape });
  }

  if (eating) {
    flowers.consume(fx, fy, foodConfig.consumeRate * dt);
    fly.energy = eat(fly.energy, dt, energyConfig.intake);
  }
  const cell = flowers.cellOf(fx, fy);
  fly.energy = metabolise(fly.energy, dt, energyConfig.metabolism);
  flowers.regrow(dt, eating ? cell : null);

  if (eating) {
    fly.bout = fly.bout ? updateBout(fly.bout) : updateBout(startBout(cell));
  } else if (fly.bout) {
    fly.bouts.push(closeBout(fly.bout, { stock: flowers.stockAt(fx, fy), energy: fly.energy, feed: feed.drive }, foodConfig));
    fly.bout = null;
  }
  fly.eating = eating;

  // ADR 011 (contracts/world-config-v3-learning.md "events"): the fly's own outcome this tick, for a
  // reinforcement:reward/punish stimulus to read next tick (senseForagerFlyWide/updateEventPulses, read-only —
  // the body layer itself never reads the stimulus).
  return { eating, ateScent: eating ? (flowers.scentAt?.(fx, fy) ?? null) : null, escapeStarted: willEscape };
}
