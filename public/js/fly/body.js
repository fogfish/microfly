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
