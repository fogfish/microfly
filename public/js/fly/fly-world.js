// Fly world: blocked cells, stimulus cells, and spawn, read from the logic grid (world/layout.js). Pure: no DOM.

import { createPrng } from '../world/prng.js';
import { createBody } from './body.js';
import { resolveFlies } from './fly-config.js';

const SPAWN_ATTEMPTS = 200;
const GOLDEN = 0x9e3779b1;
// Spawn draws must not replay the terrain and object placement stream (same config.seed), or the
// first draws land on the cells that were just placed as scenery. See research R9.
const SPAWN_SALT = 0x51ed270b;

// logic comes from buildLogic (world/layout.js). config must be validated.
// Stimulus cells are the edible cells whose kind is named in flies.stimulus.objects.
export function buildWorld(config, logic) {
  const { cols: width, rows: height } = logic;
  const wanted = new Set(resolveFlies(config).stimulus.objects);

  const blocked = logic.blocked;
  const stimulusCells = new Map();
  for (let idx = 0; idx < logic.edible.length; idx++) {
    const kind = logic.edible[idx];
    if (kind !== null && wanted.has(kind)) stimulusCells.set(idx, kind);
  }

  const walkable = (cx, cy) => blocked[cy * width + cx] === 0;
  const isStimulusCell = (cx, cy) => stimulusCells.has(cy * width + cx);

  return { width, height, blocked, stimulusCells, walkable, isStimulusCell };
}

// Returns one FlyState per fly. Throws when a fly has no free cell after SPAWN_ATTEMPTS tries.
// mode defaults to flies.mode; the experiment script passes it to spawn both kinds in one world.
export function spawnFlies(config, world, mode = resolveFlies(config).mode) {
  const f = resolveFlies(config);
  const prng = createPrng((f.seed ^ SPAWN_SALT) >>> 0);
  const out = [];

  for (let i = 0; i < f.count; i++) {
    let cell = null;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS && cell === null; attempt++) {
      const cx = prng.int(0, world.width - 1);
      const cy = prng.int(0, world.height - 1);
      if (world.walkable(cx, cy)) cell = { cx, cy };
    }
    if (cell === null) throw new Error(`no walkable cell for fly ${i}`);

    const heading = prng.next() * 2 * Math.PI;
    out.push({
      id: i,
      mode,
      sprite: mode === 'baseline' ? f.baselineSprite : f.sprite,
      brainSeed: (f.seed + (i + 1) * GOLDEN) >>> 0,
      body: createBody({ x: cell.cx + 0.5, y: cell.cy + 0.5, heading }),
      motor: { left: 0, right: 0 },
      sensory: 0,
      tick: 0,
    });
  }
  return out;
}
