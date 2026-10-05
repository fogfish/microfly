// Fly body (research R6, R8). Pure: no DOM. Position is continuous, in tiles.
//
// env: {
//   dt,                      1 / tickHz, seconds per brain tick
//   maxSpeed, turnRate,      from config.flies.body
//   width, height,           world size in tiles
//   isWalkable(cx, cy),      true when the cell may be entered (bounds already checked)
//   isStimulusCell(cx, cy),  true when the cell holds a fruit (contact is counted on entry)
// }

const cellKey = (cx, cy) => `${cx},${cy}`;

export function createBody({ x, y, heading }) {
  return { x, y, heading, cell: cellKey(Math.floor(x), Math.floor(y)), contacts: 0 };
}

// motor: { left, right } in [0, 1]. Mutates and returns body.
export function stepBody(body, motor, env) {
  const v = env.maxSpeed * (motor.left + motor.right) / 2;
  const omega = env.turnRate * (motor.right - motor.left);
  const heading = body.heading + omega * env.dt;
  const dx = Math.cos(heading) * v * env.dt;
  const dy = Math.sin(heading) * v * env.dt;

  const next = pick(body.x, body.y, dx, dy, env);
  body.heading = heading;
  body.x = next.x;
  body.y = next.y;

  const cx = Math.floor(body.x);
  const cy = Math.floor(body.y);
  const key = cellKey(cx, cy);
  if (key !== body.cell) {
    body.cell = key;
    if (env.isStimulusCell(cx, cy)) body.contacts++;
  }
  return body;
}

// Returns the first candidate position that is free: full, then x only, then y only, else stay.
function pick(x, y, dx, dy, env) {
  if (free(x + dx, y + dy, env)) return { x: x + dx, y: y + dy };
  if (free(x + dx, y, env)) return { x: x + dx, y };
  if (free(x, y + dy, env)) return { x, y: y + dy };
  return { x, y };
}

function free(x, y, env) {
  if (x < 0 || y < 0 || x >= env.width || y >= env.height) return false;
  return env.isWalkable(Math.floor(x), Math.floor(y));
}

// Forager motion (ADR 003 W4). The turn sign is fixed by the sign test in tests/forager-body.test.mjs: the fly's left
// is (sin θ, −cos θ) (stimulus.js), and increasing the heading turns the fly right, so a turnLeft drive lowers it.
export const FORAGER_TURN_SIGN = -1;

// drives: { turnLeft, turnRight, forward, backward } in [0, 1]. Speed is set by forward − backward (clamped to
// [−1, 1]); the heading changes by the turn difference. Sets body.speed (tiles per second, the distance moved over dt)
// for the eating rule (W2). Mutates and returns body.
export function stepForagerBody(body, drives, env) {
  const drive = Math.min(1, Math.max(-1, drives.forward - drives.backward));
  const v = env.maxSpeed * drive;
  const omega = env.turnRate * FORAGER_TURN_SIGN * (drives.turnLeft - drives.turnRight);
  const heading = body.heading + omega * env.dt;
  const dx = Math.cos(heading) * v * env.dt;
  const dy = Math.sin(heading) * v * env.dt;

  const next = pick(body.x, body.y, dx, dy, env);
  body.speed = Math.hypot(next.x - body.x, next.y - body.y) / env.dt;
  body.heading = heading;
  body.x = next.x;
  body.y = next.y;

  const cx = Math.floor(body.x);
  const cy = Math.floor(body.y);
  const key = cellKey(cx, cy);
  if (key !== body.cell) {
    body.cell = key;
    if (env.isStimulusCell(cx, cy)) body.contacts++;
  }
  return body;
}
