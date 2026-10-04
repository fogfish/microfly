// Fly world: blocked map, fruit cells, and spawn (research R9, R10). Pure: no DOM.

import { createPrng } from '../world/prng.js';
import { createBody } from './body.js';
import { resolveFlies } from './fly-config.js';

const SPAWN_ATTEMPTS = 200;
const GOLDEN = 0x9e3779b1;
// Spawn draws must not replay the terrain and object placement stream (same config.seed), or the
// first draws land on the cells that were just placed as scenery. See research R9.
const SPAWN_SALT = 0x51ed270b;

// grid and objects come from generateTerrain and placeObjects. config must be validated.
export function buildWorld(config, grid, objects) {
  const { width, height } = config.world;
  const fruit = new Set(resolveFlies(config).stimulus.objects);

  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < grid.length; i++) {
    if (config.terrain[grid[i]].walkable !== true) blocked[i] = 1;
  }

  const stimulusCells = new Map();
  for (const o of objects) {
    const idx = o.y * width + o.x;
    if (o.kind === 'scenery') blocked[idx] = 1;
    if (fruit.has(o.ruleId)) stimulusCells.set(idx, o);
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
