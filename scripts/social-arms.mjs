// The social experiment runner (ADR 012; contracts/social-experiment.md). Lockstep over one shared fly roster
// per seed: every arm runs the same spawn, the same sexes and one shared body-layer config object. Node 20+,
// no browser.
//
// Arms:
//   social        the shipped snapshot and decoder
//   ablated       lesion(snapshot, the four social input channels): same decoder, every other weight unchanged
//   random-graph  rewire(snapshot, 0x52470001) with its own C2-derived decoder (forager-brain-social.rg.decoder.json)
//   random-walk   baseline motor, no brain
//
// Usage:
//   node scripts/social-arms.mjs --world=world/world-forager-social.json --seeds=held-out|calibration|<n,n,...>
//     [--ticks=<n>] --arms=social,ablated,random-graph,random-walk [--no-social-stimuli] --out=<path>

import { readFileSync, writeFileSync } from 'node:fs';
import { validateConfig } from '../public/js/world/validate.js';
import { indexCatalog } from '../public/js/world/catalog.js';
import { buildLogic } from '../public/js/world/layout.js';
import { buildWorld, flowerAt, spawnFlies } from '../public/js/fly/fly-world.js';
import { resolveFlies } from '../public/js/fly/fly-config.js';
import { parseSnapshot } from '../public/js/brain/snapshot.js';
import { createFlyBrain } from '../public/js/brain/fly-brain.js';
import { createFood } from '../public/js/fly/food.js';
import { createBaselineMotor } from '../public/js/fly/baseline.js';
import { stepBody } from '../public/js/fly/body.js';
import { initForagerFly } from '../public/js/fly/forager-step.js';
import { initBodyLayerFly } from '../public/js/fly/body-layer.js';
import { contactWithId, sitePoint } from '../public/js/fly/stimulus.js';
import { createDecoderState } from '../public/js/fly/decoder.js';
import { forageEnvWide, refreshConspecifics, stepForagerFlyV3 } from '../public/js/fly/forager-step-wide.js';
import {
  findRate, approachMedian, feedArrivalWithin, escapeOrTurnWithin, bootstrapCI, median, contactEvents, songBouts,
} from '../public/js/fly/metrics.js';
import { rewire } from './forager-arms.mjs';

export { rewire };

export const WEB = new URL('../public/', import.meta.url);
export const SOCIAL_INPUT_CHANNELS = [
  'odour-conspecific-left', 'odour-conspecific-right', 'contact-pheromone-left', 'contact-pheromone-right',
];
export const RANDOM_GRAPH_SEED = 0x52470001;
// ADR 007 Acceptance, Gate C metric 8: the fraction-of-ticks-near-a-hazard radius, fixed regardless of a
// sense's own declared falloff radius (same constant forager-arms.mjs uses).
const AVOID_RADIUS = 1.5;

// Contract: "ablated: lesion(snapshot, [...]): every out-edge weight of those input neurons set to 0, indices
// kept, same decoder." Never mutates the shared snapshot in place — a fresh weights array, same offsets/targets.
export function lesion(snapshot, channelIds) {
  const wanted = new Set(channelIds);
  const channels = snapshot.capabilities.channels.inputs.filter((ch) => wanted.has(ch.id));
  const missing = [...wanted].filter((id) => !channels.some((ch) => ch.id === id));
  if (missing.length) throw new Error(`lesion: unknown input channel(s) ${missing.join(', ')}`);
  const weights = new snapshot.weights.constructor(snapshot.weights);
  for (const ch of channels) {
    for (const pre of ch.neurons) {
      for (let k = snapshot.offsets[pre]; k < snapshot.offsets[pre + 1]; k++) weights[k] = 0;
    }
  }
  return { ...snapshot, weights };
}

function nearestFlower(points, x, y) {
  let best = Infinity;
  for (const p of points) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
}

// world/validate.js's own held-out-overlap rule (scripts/compare-baseline.mjs's existing pattern).
function resolveSeeds(f, seedsArg) {
  if (seedsArg === 'calibration') return f.experiment.seeds;
  if (seedsArg === 'held-out') {
    if (f.experiment.heldOut === undefined) throw new Error('experiment.heldOut is not set in the world');
    const overlap = f.experiment.heldOut.filter((s) => f.experiment.seeds.includes(s));
    if (overlap.length) throw new Error(`held-out seeds overlap the calibration seeds: ${overlap.join(', ')}`);
    return f.experiment.heldOut;
  }
  return seedsArg.split(',').map(Number);
}

// Loads the world and its brain assets. noSocialStimuli (R15, the food/danger regression check) neutralises
// every sex's social emission to 0 rather than deleting the from:"flies" stimuli entries: forageEnvWide
// requires a matching flies.stimuli entry for every snapshot channel, so the signal is silenced, not removed.
export function loadWorld(worldPath, { noSocialStimuli = false, arms = [] } = {}) {
  const config = JSON.parse(readFileSync(new URL(worldPath, WEB), 'utf8'));
  if (noSocialStimuli) {
    for (const sex of Object.keys(config.flies.sexes ?? {})) {
      if (sex === 'default') continue;
      const emits = config.flies.sexes[sex].emits ?? {};
      config.flies.sexes[sex] = { ...config.flies.sexes[sex], emits: Object.fromEntries(Object.keys(emits).map((k) => [k, 0])) };
    }
  }
  const expConfig = { ...config, flies: { ...config.flies, mode: 'toy' } };
  const errors = validateConfig(expConfig);
  if (errors.length) throw new Error(errors.map(({ path, message }) => `${path || 'world'}: ${message}`).join('; '));
  const f = resolveFlies(expConfig);
  const { catalog } = indexCatalog(JSON.parse(readFileSync(new URL(config.atlas, WEB), 'utf8')));
  const world = buildWorld(config, buildLogic(config, catalog));
  const bytes = readFileSync(new URL(f.brain.snapshot, WEB));
  const snapshot = parseSnapshot(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const decoder = JSON.parse(readFileSync(new URL(f.brain.decoder, WEB), 'utf8'));
  // The random-graph decoder sidecar is its own file, next to the snapshot, and only needed when that arm is
  // actually requested — a world with no such sidecar (e.g. the MB brain, which never ran a social-style
  // random-graph C2) can still run every other arm.
  const rgDecoder = arms.includes('random-graph')
    ? JSON.parse(readFileSync(new URL(f.brain.snapshot.replace(/\.brain$/, '.rg.decoder.json'), WEB), 'utf8'))
    : undefined;
  return { config, expConfig, f, world, snapshot, decoder, rgDecoder };
}

function armBrainAssets(arm, { snapshot, decoder, rgDecoder }) {
  if (arm === 'social') return { snapshot, decoder };
  if (arm === 'ablated') return { snapshot: lesion(snapshot, SOCIAL_INPUT_CHANNELS), decoder };
  if (arm === 'random-graph') return { snapshot: rewire(snapshot, RANDOM_GRAPH_SEED), decoder: rgDecoder };
  throw new Error(`armBrainAssets: "${arm}" is not a brain arm`);
}

// One tick's social record for one fly (research.md R14; world-config-v3-social.md Telemetry), read directly
// off the live conspecifics table — no protocol round-trip (ADR 012: "world sensing on the main thread").
function socialRecordOf(fly, env, legSite, bodyRadius) {
  let nn = null;
  for (const c of env.conspecifics) {
    if (c.id === fly.id || !c.alive) continue;
    const d = Math.hypot(c.x - fly.body.x, c.y - fly.body.y);
    if (nn === null || d < nn.distance) nn = { distance: d, heading: c.heading, sex: c.sex, dx: c.x - fly.body.x, dy: c.y - fly.body.y };
  }
  const nnAhead = nn ? Math.cos(fly.body.heading) * nn.dx + Math.sin(fly.body.heading) * nn.dy > 0 : null;
  let contactWith = null;
  let contactSide = null;
  if (legSite) {
    const cwL = contactWithId(sitePoint(fly.body, legSite, 'L'), env.conspecifics, fly.id, bodyRadius);
    const cwR = cwL === null ? contactWithId(sitePoint(fly.body, legSite, 'R'), env.conspecifics, fly.id, bodyRadius) : null;
    contactWith = cwL ?? cwR;
    contactSide = cwL !== null ? 'L' : (cwR !== null ? 'R' : null);
  }
  const contactSex = contactWith !== null ? env.conspecifics.find((c) => c.id === contactWith)?.sex ?? null : null;
  return {
    nnDistance: nn ? nn.distance : null, nnHeading: nn ? nn.heading : null, nnAhead, nnSex: nn ? nn.sex : null,
    heading: fly.body.heading, contactWith, contactSide, contactSex, singing: Boolean(fly.singing),
  };
}

// Runs every fly of one arm, one seed, lockstep: refresh the conspecific table once a tick, then step every
// fly in id order (contract: "the order of stepping does not matter", since every fly reads the table built
// before any of them stepped). Returns { socialRecords: Fly[][], forager: Fly[] } (per-fly arrays).
function runArmSeed(arm, seed, ctx) {
  const { f, world, expConfig, bodyLayerCfg, points, pointsByScent, foodReach, dangerAt, ticks } = ctx;
  const seeded = { ...expConfig, flies: { ...expConfig.flies, seed } };
  const flies = spawnFlies(seeded, world, 'toy');
  const flowers = createFood(world, f);
  const legSite = f.body.sites?.['front-leg'];

  let env;
  let brains;
  let decoderStates;
  let armDecoder;
  if (arm === 'random-walk') {
    env = {
      dt: 1 / f.tickHz, maxSpeed: f.body.maxSpeed, turnRate: f.body.turnRate, width: world.width, height: world.height,
      isWalkable: world.walkable, isStimulusCell: world.isStimulusCell, conspecifics: [],
    };
    brains = flies.map((fly) => createBaselineMotor(fly.brainSeed));
  } else {
    const { snapshot: armSnapshot, decoder: decoderFile } = armBrainAssets(arm, ctx);
    armDecoder = decoderFile;
    const capabilities = armSnapshot.capabilities;
    env = { ...forageEnvWide(f, world, flowers, capabilities), flowers, foodConfig: f.food, energyConfig: f.body.energy };
    // D32/learning (forager-arms.mjs runV3Cohort): plasticity needs its own parsed learning groups regardless
    // of whether brainConfig.learning is passed, so it is turned off here rather than left half-wired — this
    // runner measures the declared senses' steering effect, not the learning mechanism (out of scope, ADR 011).
    const brainConfig = { ...f.brain, snapshot: armSnapshot, version: 'v3', modulators: f.modulators };
    delete brainConfig.learning;
    if (brainConfig.lif) brainConfig.lif = { ...brainConfig.lif, plasticity: null };
    brains = flies.map((fly) => createFlyBrain(brainConfig, fly.brainSeed));
    decoderStates = flies.map(() => createDecoderState(decoderFile, capabilities.channels.inputs));
    for (const fly of flies) initBodyLayerFly(fly, fly.brainSeed);
  }
  for (const fly of flies) initForagerFly(fly, f.body.energy.initial);

  const socialRecords = flies.map(() => []);
  const forager = flies.map((fly) => ({
    startDistance: nearestFlower(points, fly.body.x, fly.body.y),
    firstContactTick: null, bouts: [],
    scent: Object.fromEntries(Object.keys(pointsByScent).map((scent) => [scent, {
      startDistance: nearestFlower(pointsByScent[scent], fly.body.x, fly.body.y), firstContactTick: null,
    }])),
    feedRecords: [], dangerRecords: dangerAt ? [] : undefined,
  }));

  for (let t = 0; t < ticks; t++) {
    refreshConspecifics(env, flies);
    flies.forEach((fly, i) => {
      if (arm === 'random-walk') stepBody(fly.body, brains[i].next(), env);
      else stepForagerFlyV3(fly, env, brains[i], decoderStates[i], armDecoder, bodyLayerCfg);

      socialRecords[i].push(socialRecordOf(fly, env, legSite, f.body.bodyRadius));

      const cx = Math.floor(fly.body.x);
      const cy = Math.floor(fly.body.y);
      const idx = flowerAt(world, cx, cy, foodReach);
      const onFlower = idx >= 0 && flowers.stockAt(idx % world.width, Math.floor(idx / world.width)) > 0;
      const scentHere = idx >= 0 ? flowers.scentAt(idx % world.width, Math.floor(idx / world.width)) : null;
      forager[i].feedRecords.push({ onFlower, eating: Boolean(fly.eating) });
      if (forager[i].firstContactTick === null && onFlower) forager[i].firstContactTick = t;
      if (scentHere && forager[i].scent[scentHere] && forager[i].scent[scentHere].firstContactTick === null) {
        forager[i].scent[scentHere].firstContactTick = t;
      }
      forager[i].dangerRecords?.push({ distance: dangerAt.distanceAt(fly.body.x, fly.body.y) });
    });
  }

  const flySex = flies.map((fly) => fly.sex);
  return { socialRecords, forager, flySex };
}

// Pools findRate/approachMedian/feedArrivalWithin/escapeOrTurnWithin over every fly of every seed (R15's
// "forager" block), plus the seed-level bootstrap CI for find rate.
function foragerBlock(seedResults, seedList, radius, dangerRadius) {
  const flies = seedResults.flatMap((r) => r.forager).map((fly) => ({ ...fly, found: fly.firstContactTick !== null }));
  const find = findRate(flies);
  const findCI = bootstrapCI(flies.map((f) => (f.firstContactTick !== null ? 1 : 0)), seedList[0] ?? 0);
  const feeding = flies.reduce((acc, f) => {
    const r = feedArrivalWithin(f.feedRecords);
    return { arrivals: acc.arrivals + r.arrivals, fed: acc.fed + r.fed };
  }, { arrivals: 0, fed: 0 });
  const scentNames = Object.keys(flies[0]?.scent ?? {});
  const approach = {};
  for (const scent of scentNames) {
    approach[scent] = approachMedian(flies.map((f) => ({
      startDistance: f.scent[scent].startDistance, firstContactTick: f.scent[scent].firstContactTick,
    })), radius);
  }
  let escape = null;
  if (flies[0]?.dangerRecords) {
    escape = flies.reduce((acc, f) => {
      const r = escapeOrTurnWithin(f.dangerRecords, dangerRadius);
      return { encounters: acc.encounters + r.encounters, resolved: acc.resolved + r.resolved };
    }, { encounters: 0, resolved: 0 });
    escape.rate = escape.encounters ? escape.resolved / escape.encounters : null;
  }
  return {
    find: { rate: find.rate, found: find.found, count: find.count, ci95: findCI },
    feeding: { rate: feeding.arrivals ? feeding.fed / feeding.arrivals : null, ...feeding },
    approach,
    escape,
  };
}

const R14_METRIC_NAMES = ['nnMedian', 'timeNear', 'contactRate', 'contactDuration', 'followingIndex', 'songPerContact'];

// One seed's pooled value for every research R14 metric, over a roster of flies (each { sex, records }),
// optionally restricted to the ticks/events whose *other* fly carries `otherSexFilter` (research R14 "Sex
// split"). contactEvents/songBouts are run-length-encoded per fly's own tick sequence, so they are computed
// per fly first and only their already-discrete results are pooled across the roster — concatenating raw
// per-tick records across flies before run-length encoding would splice two flies' events together at the
// join.
function pooledSeedMetrics(flies, radius, tickHz, otherSexFilter = null) {
  const nnRecords = flies.flatMap((f) => f.records).filter((r) => !otherSexFilter || r.nnSex === otherSexFilter);
  const perFly = flies.map((f) => ({
    events: contactEvents(f.records).filter((e) => !otherSexFilter || e.otherSex === otherSexFilter),
    bouts: songBouts(f.records), records: f.records,
  }));
  const events = perFly.flatMap((f) => f.events);
  const totalMinutes = flies.reduce((s, f) => s + f.records.length, 0) / tickHz / 60;
  const songDuring = perFly.reduce((s, f) => s + f.bouts.filter(
    (b) => f.events.some((e) => b.onset >= e.onset && b.onset < e.onset + e.duration),
  ).length, 0);
  const nnValid = nnRecords.filter((r) => r.nnDistance !== null);
  const nnNear = nnValid.filter((r) => r.nnDistance <= radius);
  const followingValues = nnNear.map((r) => (r.nnAhead ? Math.cos(r.heading - r.nnHeading) : 0));
  return {
    nnMedian: median(nnValid.map((r) => r.nnDistance)),
    timeNear: nnValid.length ? nnNear.length / nnValid.length : null,
    contactRate: totalMinutes > 0 ? events.length / totalMinutes : null,
    contactDuration: events.length ? events.reduce((s, e) => s + e.duration, 0) / events.length : null,
    followingIndex: followingValues.length ? followingValues.reduce((a, b) => a + b, 0) / followingValues.length : null,
    songPerContact: events.length ? songDuring / events.length : null,
  };
}

// The alone-tick song rate (research R14's third song figure) is not split by sex — "alone" has no other fly
// to tag — so it is reported once, pooled per seed the same way.
function pooledSeedSongAlone(flies, radius) {
  let aloneTicks = 0;
  let aloneOnsets = 0;
  for (const f of flies) {
    const bouts = songBouts(f.records);
    aloneTicks += f.records.filter((r) => r.nnDistance === null || r.nnDistance > radius).length;
    aloneOnsets += bouts.filter((b) => {
      const r = f.records[b.onset];
      return r === undefined || r.nnDistance === null || r.nnDistance > radius;
    }).length;
  }
  return aloneTicks > 0 ? aloneOnsets / aloneTicks : null;
}

// research.md R14: "Confidence intervals come from metrics.js bootstrapCI, over seeds." One pooled value per
// seed (every metric, overall and per other-sex), then a 95% bootstrap interval resampling over the N seeds —
// never over individual flies, which would treat the 6 flies of one seed as 6 independent draws instead of one.
function socialBlock(seedResults, seedList, radius, tickHz) {
  const bySeed = seedResults.map((r) => r.socialRecords.map((records, i) => ({ sex: r.flySex[i], records })));
  const sexes = [...new Set(bySeed.flat().map((f) => f.sex))];
  const seed0 = seedList[0] ?? 0;

  // A seed where the metric never occurred (e.g. zero contact events that seed) gives null, not a true 0 —
  // dropped before bootstrapping rather than coerced to 0, so a "mean contact duration" reads as "conditional
  // on a contact happening", not diluted by seeds where none did (contactRate/timeNear are well-defined every
  // seed in a fixed-size roster, so they are never null in practice, but the same rule costs nothing to apply).
  const ciOf = (values) => {
    const defined = values.filter((v) => v !== null && v !== undefined);
    if (defined.length === 0) return { mean: null, ci95: [null, null], seedsWithData: 0, seeds: values.length };
    return {
      mean: defined.reduce((a, b) => a + b, 0) / defined.length,
      ci95: bootstrapCI(defined, seed0 >>> 0),
      seedsWithData: defined.length, seeds: values.length,
    };
  };
  const metricSeries = (pickFn) => R14_METRIC_NAMES.map((name) => [name, pickFn(name)]);

  const overallPerSeed = bySeed.map((flies) => pooledSeedMetrics(flies, radius, tickHz));
  const metrics = Object.fromEntries(metricSeries((name) => ciOf(overallPerSeed.map((m) => m[name]))));
  metrics.songPerTickAlone = ciOf(bySeed.map((flies) => pooledSeedSongAlone(flies, radius)));

  const bySex = {};
  for (const sex of sexes) {
    const perSeed = bySeed.map((flies) => pooledSeedMetrics(flies, radius, tickHz, sex));
    bySex[sex] = Object.fromEntries(metricSeries((name) => ciOf(perSeed.map((m) => m[name]))));
  }
  return { metrics, bySex };
}

export function runSocialArms({ worldPath, seedsArg, ticksArg, arms, noSocialStimuli = false }) {
  const { config, expConfig, f, world, snapshot, decoder, rgDecoder } = loadWorld(worldPath, { noSocialStimuli, arms });
  const seeds = resolveSeeds(f, seedsArg);
  const ticks = ticksArg ?? f.experiment.ticks;
  const bodyLayerCfg = { locomotion: f.body.locomotion, escape: f.body.escape, backup: f.body.backup, motor: f.body.motor, song: f.body.song };
  const points = [...world.stimulusCells.keys()].map((idx) => ({ x: (idx % world.width) + 0.5, y: Math.floor(idx / world.width) + 0.5 }));
  const scents = new Set([...world.stimulusCells.values()].map((c) => c.scent).filter(Boolean));
  const pointsByScent = Object.fromEntries([...scents].map((scent) => [
    scent,
    [...world.stimulusCells.entries()].filter(([, c]) => c.scent === scent)
      .map(([idx]) => ({ x: (idx % world.width) + 0.5, y: Math.floor(idx / world.width) + 0.5 })),
  ]));
  const dangerSpec = f.stimuli?.['odour:danger'];
  const dangerAt = dangerSpec && world.dangerField
    ? { distanceAt: (x, y) => world.dangerField.distance[Math.floor(y) * world.width + Math.floor(x)] }
    : null;
  const foodReach = f.food?.reach ?? 0;
  const approachRadius = f.stimuli?.['odour:food-a']?.radius ?? f.stimuli?.['odour:food']?.radius ?? 3;

  const ctx = { f, world, expConfig, snapshot, decoder, rgDecoder, bodyLayerCfg, points, pointsByScent, foodReach, dangerAt, ticks };
  const resultsByArm = {};
  for (const arm of arms) {
    const seedResults = seeds.map((seed) => runArmSeed(arm, seed, ctx));
    const social = noSocialStimuli ? null : socialBlock(seedResults, seeds, 2, f.tickHz);
    resultsByArm[arm] = {
      forager: foragerBlock(seedResults, seeds, approachRadius, AVOID_RADIUS),
      metrics: social?.metrics ?? null,
      bySex: social?.bySex ?? null,
    };
  }
  return { world: worldPath, seeds, ticks, arms: resultsByArm, noSocialStimuli };
}

function fmtPct(v) { return v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}%`; }
function fmtNum(v) { return v === null || v === undefined ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(3)); }

export function renderResultsMarkdown(result) {
  const lines = [`# Social experiment: \`${result.world}\``, '', `Seeds: ${JSON.stringify(result.seeds)}, ${result.ticks} ticks.`, ''];
  for (const [arm, data] of Object.entries(result.arms)) {
    lines.push(`## ${arm}`, '');
    lines.push(`Find: ${fmtPct(data.forager.find.rate)} [${fmtPct(data.forager.find.ci95[0])}, ${fmtPct(data.forager.find.ci95[1])}], feeding ${fmtPct(data.forager.feeding.rate)}`);
    for (const [scent, a] of Object.entries(data.forager.approach)) {
      lines.push(`Approach (${scent}): median ${fmtNum(a.median)} ticks, ${a.included} included / ${a.excluded} excluded`);
    }
    if (data.forager.escape) lines.push(`Danger escape-or-turn within window: ${fmtPct(data.forager.escape.rate)} (${data.forager.escape.resolved}/${data.forager.escape.encounters})`);
    if (data.metrics) {
      const m = data.metrics;
      lines.push(
        `Time near (<=2 tiles): ${fmtPct(m.timeNear.mean)} [${fmtPct(m.timeNear.ci95[0])}, ${fmtPct(m.timeNear.ci95[1])}]`,
        `Contact rate (per minute): ${fmtNum(m.contactRate.mean)} [${fmtNum(m.contactRate.ci95[0])}, ${fmtNum(m.contactRate.ci95[1])}]`,
        `nnMedian: ${fmtNum(m.nnMedian.mean)}, contactDuration: ${fmtNum(m.contactDuration.mean)}, followingIndex: ${fmtNum(m.followingIndex.mean)}`,
        `songPerContact: ${fmtNum(m.songPerContact.mean)}, songPerTickAlone: ${fmtNum(m.songPerTickAlone.mean)}`,
      );
      for (const [sex, s] of Object.entries(data.bySex)) {
        lines.push(`  by other-sex=${sex}: nnMedian ${fmtNum(s.nnMedian.mean)}, timeNear ${fmtPct(s.timeNear.mean)}, contactRate ${fmtNum(s.contactRate.mean)}, following ${fmtNum(s.followingIndex.mean)}, song/contact ${fmtNum(s.songPerContact.mean)}`);
      }
    }
    lines.push('');
  }
  if (!result.noSocialStimuli && result.arms.social && result.arms['random-graph'] && result.arms['random-walk']) {
    const s = result.arms.social.metrics;
    const rg = result.arms['random-graph'].metrics;
    const rw = result.arms['random-walk'].metrics;
    const beats = (a, b) => a.ci95[0] !== null && b.ci95[1] !== null && a.ci95[0] > b.ci95[1];
    lines.push(
      '## SC-004 verdict', '',
      `social time-near beats random-graph: ${beats(s.timeNear, rg.timeNear)}, beats random-walk: ${beats(s.timeNear, rw.timeNear)}`,
      `social contact-rate beats random-graph: ${beats(s.contactRate, rg.contactRate)}, beats random-walk: ${beats(s.contactRate, rw.contactRate)}`,
    );
    if (result.arms.ablated) {
      const ab = result.arms.ablated.metrics;
      lines.push(`ablated time-near also beats random-walk: ${beats(ab.timeNear, rw.timeNear)} (if true, the effect is not shown to be pheromonal)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const worldPath = arg('world', 'world/world-forager-social.json');
  const seedsArg = arg('seeds', 'calibration');
  const ticksArg = arg('ticks');
  const armsArg = arg('arms', 'social,ablated,random-graph,random-walk');
  const outArg = arg('out');
  const noSocialStimuli = process.argv.includes('--no-social-stimuli');
  const arms = armsArg.split(',');

  const result = runSocialArms({
    worldPath, seedsArg, ticksArg: ticksArg !== undefined ? Number(ticksArg) : undefined, arms,
    noSocialStimuli,
  });
  const md = renderResultsMarkdown(result);
  console.log(md);
  if (outArg) {
    writeFileSync(outArg, `${JSON.stringify(result, null, 2)}\n`);
    const mdPath = outArg.replace(/\.json$/, '.md');
    if (mdPath !== outArg) writeFileSync(mdPath, `${md}\n`);
    console.log(`\nwritten to ${outArg}${mdPath !== outArg ? ` and ${mdPath}` : ''}`);
  }
}

// Only run the CLI when this file is the Node entry point, not when it is imported for its exports (tests,
// the microfly-calibrate skill, this file's own quickstart examples).
if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  main();
}
