// One tick of a forager fly (ADR 003 W1–W4; contracts/worker-protocol-v3.md). Pure: no DOM, no workers.
// The browser host and the experiment script run the same functions. The browser sends the sense message to the
// worker and applies the motor reply; the experiment calls stepForagerFly with a synchronous brain.

import * as P3 from '../brain/protocol-v3.js';
import { stepForagerBody } from './body.js';
import { senseBilateral } from './stimulus.js';
import { canEat, closeBout, eat, hunger as hungerOf, metabolise, startBout, updateBout } from './energy.js';

// env: forageEnv(...). f: the resolved flies section (tickHz, body, stimulus, food, energy).
// capabilities: the snapshot's declaration; its outputs name the drives.
export function forageEnv(f, world, flowers, capabilities) {
  return {
    dt: 1 / f.tickHz,
    maxSpeed: f.body.maxSpeed,
    turnRate: f.body.turnRate,
    width: world.width,
    height: world.height,
    isWalkable: world.walkable,
    isStimulusCell: world.isStimulusCell,
    stimulus: f.stimulus,
    energyConfig: f.body.energy,
    foodConfig: f.food,
    flowers,
    drives: capabilities.channels.outputs.map((ch) => ch.drive),
    inputCount: capabilities.channels.inputs.length,
  };
}

// The per-fly state a forager fly adds to the body (W1, W2): energy, the open bout, closed bouts, and the flags the
// panel shows.
export function initForagerFly(fly, initialEnergy) {
  fly.energy = initialEnergy;
  fly.bout = null;
  fly.bouts = [];
  fly.eating = false;
  return fly;
}

// The sense for this tick: odour from two antenna samples (W3), and taste on a flower, both legs on the same cell.
// Returns { inputs, hunger, message } where message is the protocol 3 sense.
export function senseForagerFly(fly, env) {
  const { left, right } = senseBilateral(env.flowers.points(), fly.body, env.stimulus);
  const cx = Math.floor(fly.body.x);
  const cy = Math.floor(fly.body.y);
  const taste = env.isStimulusCell(cx, cy) ? env.flowers.fraction(cx, cy) : 0;
  const inputs = Float32Array.of(left, right, taste, taste);
  const hunger = hungerOf(fly.energy);
  return { inputs, hunger, message: P3.sense({ tick: fly.tick, inputs, state: { hunger } }) };
}

// The drive values of a motor reply, by name (W4).
export function driveValues(outputs, drives) {
  const values = {};
  drives.forEach((name, k) => { values[name] = outputs[k]; });
  return values;
}

// Applies one motor reply: the body moves (W4), the fly eats if W2 holds, energy and the flower change, and the bout is
// updated. Returns the history entry for the panel.
// Eating uses the cell the fly stood on when it sensed taste (senseForagerFly, before the move), so the taste input and
// the eating of one tick always come from the same flower (BUG-002). The body moves after that cell is read.
export function applyForagerMotor(fly, motor, env) {
  const drives = driveValues(motor.outputs, env.drives);
  const { dt, flowers, foodConfig, energyConfig } = env;
  const cx = Math.floor(fly.body.x);
  const cy = Math.floor(fly.body.y);
  stepForagerBody(fly.body, drives, env);

  const cell = flowers.cellOf(cx, cy);
  const stock = flowers.stockAt(cx, cy);
  const eating = canEat({ stock, speed: fly.body.speed, feed: drives.feed ?? 0 }, foodConfig);

  if (eating) {
    flowers.consume(cx, cy, foodConfig.consumeRate * dt);
    fly.energy = eat(fly.energy, dt, energyConfig.intake);
  }
  fly.energy = metabolise(fly.energy, dt, energyConfig.metabolism);
  flowers.regrow(dt, eating ? cell : null);

  if (eating) {
    fly.bout = fly.bout ? updateBout(fly.bout) : updateBout(startBout(cell));
  } else if (fly.bout) {
    fly.bouts.push(closeBout(fly.bout, {
      stock: flowers.stockAt(cx, cy), energy: fly.energy, feed: drives.feed ?? 0,
    }, foodConfig));
    fly.bout = null;
  }
  fly.eating = eating;

  const entry = {
    tick: fly.tick,
    inputs: motor.inputs,
    hunger: hungerOf(fly.energy),
    energy: fly.energy,
    speed: fly.body.speed,
    eating,
    outputs: motor.outputs,
    spikes: motor.spikes,
    drives,
  };
  fly.tick++;
  return entry;
}

// One whole tick with a synchronous brain: sense, brain step, motor, apply. Returns the protocol 3 sense and motor
// messages and the history entry.
export function stepForagerFly(fly, env, brain) {
  const { inputs, hunger, message: sense } = senseForagerFly(fly, env);
  const out = brain.step({ inputs, hunger });
  const motor = P3.motor({ tick: fly.tick, inputs: out.inputs, outputs: out.outputs, spikes: out.spikes });
  const entry = applyForagerMotor(fly, motor, env);
  return { sense, motor, entry };
}
