// One tick of a wide-I/O forager fly (ADR 007 W8-W10; contracts/world-config-wide-io.md). Pure: no DOM, no
// workers. Parallel to forager-step.js's v1 pair: senseForagerFly/forageEnv there is NOT edited by this feature
// (research.md R8) — every input channel here reads its declared `sense`/`site` generically instead of the
// hard-coded four-channel antenna/mouth layout. `applyForagerMotor`/`initForagerFly`/`driveValues` (the motor and
// body-physics side) are shared unchanged between v1 and v2; only the sensing/env side has a wide-I/O twin.

import * as P3 from '../brain/protocol-v3.js';
import { bilateralContrast, senseDeclared, sitePoint } from './stimulus.js';
import { flowerAt, hazardPoints } from './fly-world.js';
import { hunger as hungerOf, odourGain } from './energy.js';
import { foodFieldAt } from '../world/food-field.js';
import { decodeTick } from './decoder.js';
import { stepBodyLayer } from './body-layer.js';

// The sampler for one declared sense (ADR 007 W8, contracts/world-config-wide-io.md, contracts/stimuli-field-
// sources.md §4): "edibles" reads the shared flower table (field food odour, taste/contact alike), filtered by
// the sense's declared `scents` if any (contracts/world-config-v3-learning.md, ADR 011); "dangers" reads static
// hazard points, filtered by the sense's declared kinds; "blocked" (touch) reads world walkability directly,
// with no point list; "water"/"forestEdge" read the heat/danger field at the site's own cell.
// Out-of-bounds (cx, cy) reads 0, the same safe default contactAt already implies off-grid.
// reach: flies.food.reach, the eating area (fly-world.js flowerAt). Taste contact is read over the same area the
// fly can eat in, so the mouth tastes a flower wherever it can feed on it (spec 017 BUG-002); 0 keeps v2's
// own-cell contact.
function samplerFor(spec, world, flowers, reach = 0) {
  if (spec.from === 'edibles') {
    // scents (contracts/world-config-v3-learning.md, ADR 011): restricts the odour field to flowers of the
    // listed scent(s); taste/contact senses read every flower regardless (no scents key on a taste channel).
    const units = spec.scents ? (world.foodUnits ?? []).filter((u) => spec.scents.includes(u.scent)) : (world.foodUnits ?? []);
    return {
      points: () => (spec.scents ? flowers.points().filter((p) => spec.scents.includes(p.scent)) : flowers.points()),
      contactAt: (cx, cy) => {
        const idx = flowerAt(world, cx, cy, reach);
        return idx < 0 ? 0 : flowers.fraction(idx % world.width, Math.floor(idx / world.width));
      },
      fieldAt: (cx, cy) => foodFieldAt(units, flowers, cx, cy),
      width: world.width,
      height: world.height,
    };
  }
  if (spec.from === 'dangers') {
    const points = hazardPoints(world, spec.kinds ?? []);
    return { points: () => points, contactAt: () => 0 };
  }
  if (spec.from === 'blocked') {
    return { points: () => [], contactAt: (cx, cy) => (world.walkable(cx, cy) ? 0 : 1) };
  }
  if (spec.from === 'water') {
    return {
      points: () => [],
      contactAt: () => 0,
      fieldAt: (cx, cy) => world.heatField?.intensity[cy * world.width + cx] ?? 0,
      width: world.width,
      height: world.height,
    };
  }
  if (spec.from === 'forestEdge') {
    return {
      points: () => [],
      contactAt: () => 0,
      fieldAt: (cx, cy) => world.dangerField?.intensity[cy * world.width + cx] ?? 0,
      width: world.width,
      height: world.height,
    };
  }
  throw new Error(`flies.stimuli source "${spec.from}" is not supported`);
}

// Sources whose sense is always read through the field mode (contracts/stimuli-field-sources.md §3). "edibles" is
// field mode only for the "odour:food" sense specifically (taste keeps its contact mode) and only when the spec
// carries no radius — a world may still declare the legacy point-sum odour:food (radius set) for backward
// compatibility (the contract's own header: "the existing radius/contact sensing modes are unchanged and still
// supported"). `spec.field` is not a world-config key (research.md R3); it is derived here, per call, so the
// shared `f.stimuli` object itself (env.stimuli) is never mutated.
const FIELD_SOURCES = new Set(['water', 'forestEdge']);
// odour:food-a/food-b (ADR 011): the per-scent senses the field-mode fast path also applies to; samplerFor's
// fieldAt already filters world.foodUnits by spec.scents, so field mode stays correct per scent.
const FOOD_FIELD_SENSES = new Set(['odour:food', 'odour:food-a', 'odour:food-b']);
function declaredSpec(sense, spec) {
  if (spec.contact || spec.field) return spec;
  if (FIELD_SOURCES.has(spec.from)) return { ...spec, field: true };
  if (spec.from === 'edibles' && FOOD_FIELD_SENSES.has(sense) && spec.radius === undefined) return { ...spec, field: true };
  return spec;
}

// env: forageEnvWide(...). f: the resolved flies section, carrying stimuli/body.sites/body.escape for "v2"
// (fly-config.js). capabilities: the snapshot's v5 declaration; its inputs carry sense/site, its outputs name
// the six drives. Every declared sense/site is checked against flies.stimuli/flies.body.sites once, here, before
// any fly starts (spec FR-018's edge case) — not lazily inside the per-tick sense function.
export function forageEnvWide(f, world, flowers, capabilities) {
  const inputs = capabilities.channels.inputs;
  const samplers = {};
  for (const ch of inputs) {
    if (Object.hasOwn(samplers, ch.sense)) continue;
    const spec = f.stimuli[ch.sense];
    if (!spec) throw new Error(`flies.stimuli is missing sense "${ch.sense}", declared by channel "${ch.id}"`);
    samplers[ch.sense] = samplerFor(spec, world, flowers, f.food?.reach ?? 0);
  }
  for (const ch of inputs) {
    if (!f.body.sites[ch.site]) {
      throw new Error(`flies.body.sites is missing site "${ch.site}", declared by channel "${ch.id}"`);
    }
  }
  return {
    dt: 1 / f.tickHz,
    maxSpeed: f.body.maxSpeed,
    turnRate: f.body.turnRate,
    width: world.width,
    height: world.height,
    isWalkable: world.walkable,
    isStimulusCell: world.isStimulusCell,
    stimuli: f.stimuli,
    bodySites: f.body.sites,
    escape: f.body.escape,
    samplers,
    inputChannels: inputs,
    energyConfig: f.body.energy,
    foodConfig: f.food,
    flowers,
    drives: capabilities.channels.outputs.map((ch) => ch.drive),
    inputCount: inputs.length,
  };
}

// The sense for this tick: one value per declared input channel, built generically from its sense/site
// (ADR 007 W8/W9), in declaration order. Returns { inputs, hunger, message } like senseForagerFly.
export function senseForagerFlyWide(fly, env) {
  const inputs = env.inputChannels;
  const values = new Float32Array(inputs.length);
  inputs.forEach((ch, k) => {
    const spec = declaredSpec(ch.sense, env.stimuli[ch.sense]);
    const site = env.bodySites[ch.site];
    const at = sitePoint(fly.body, site, ch.side);
    values[k] = senseDeclared(spec, at, env.samplers[ch.sense]);
  });
  // Spec 018 US1 (contracts/world-config-food-feeding.md): a hungry fly senses food odour more strongly. Only the
  // odour:food channels are scaled, before the L/R contrast below; every other sense is untouched.
  const gain = odourGain(hungerOf(fly.energy), env.foodConfig.hungerSensitivity);
  if (gain !== 1) {
    inputs.forEach((ch, k) => {
      if (ch.sense === 'odour:food') values[k] *= gain;
    });
  }
  // flies.stimuli[sense].contrast: applied to each L/R pair of one sense at one site, after both are sampled.
  inputs.forEach((ch, k) => {
    const contrast = env.stimuli[ch.sense].contrast;
    if (!contrast || ch.side !== 'L') return;
    const r = inputs.findIndex((o) => o.sense === ch.sense && o.site === ch.site && o.side === 'R');
    if (r < 0) return;
    const out = bilateralContrast(values[k], values[r], contrast);
    values[k] = out.left;
    values[r] = out.right;
  });
  const hunger = hungerOf(fly.energy);
  return { inputs: values, hunger, message: P3.sense({ tick: fly.tick, inputs: values, state: { hunger } }) };
}

// One whole tick with a synchronous brain: sense, brain step, motor, apply (shared applyForagerMotor).
export function stepForagerFlyWide(fly, env, brain, applyForagerMotor) {
  const { inputs, hunger, message: sense } = senseForagerFlyWide(fly, env);
  const out = brain.step({ inputs, hunger });
  const motor = P3.motor({ tick: fly.tick, inputs: out.inputs, outputs: out.outputs, spikes: out.spikes });
  const entry = applyForagerMotor(fly, motor, env);
  return { sense, motor, entry };
}

// One whole "v3" tick with a synchronous brain: sense (the same wide-io generation as v2), brain step, decode
// (decoder.js D29), body layer (body-layer.js W12–W14). Parallel to stepForagerFlyWide, for the calibration CLI
// and forager-arms.mjs — fly-host.js's live worker path calls decodeTick/stepBodyLayer itself (research.md §2),
// since it is driven by worker messages rather than a synchronous brain.step() call.
export function stepForagerFlyV3(fly, env, brain, decoderState, decoderFile, bodyLayerCfg) {
  const { inputs, hunger, message: sense } = senseForagerFlyWide(fly, env);
  const out = brain.step({ inputs, hunger });
  const motor = P3.motor({ tick: fly.tick, inputs: out.inputs, outputs: out.outputs, spikes: out.spikes });
  const decoded = decodeTick(decoderState, { spikes: motor.spikes, inputs: motor.inputs }, decoderFile);
  const { eating } = stepBodyLayer(fly, decoded, bodyLayerCfg, env);
  fly.tick++;
  return { sense, motor, decoded, entry: { tick: fly.tick - 1, inputs: motor.inputs, eating, spikes: motor.spikes, outputs: motor.outputs } };
}
