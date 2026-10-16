// Fly world: blocked cells, stimulus cells, and spawn, read from the logic grid (world/layout.js). Pure: no DOM.

import { createPrng } from '../world/prng.js';
import { createBody } from './body.js';
import { resolveFlies } from './fly-config.js';
import { EDIBLE_KINDS } from '../world/layout.js';
import { dangerField } from '../world/danger-field.js';
import { heatField } from '../world/heat-field.js';
import { foodKernel } from '../world/food-field.js';

const SPAWN_ATTEMPTS = 200;
const GOLDEN = 0x9e3779b1;
// Spawn draws must not replay the terrain and object placement stream (same config.seed), or the
// first draws land on the cells that were just placed as scenery. See research R9.
const SPAWN_SALT = 0x51ed270b;

// logic comes from buildLogic (world/layout.js). config must be validated.
// Stimulus cells are the edible cells whose kind is named in flies.stimulus.objects. Each carries its odour reach:
// reach = flies.stimulus.radius × the unit's sprite size in tiles (spec 009, contracts/odour-reach.md §1, §3).
// For "v2" (contracts/world-config-wide-io.md): there is no flies.stimulus.objects list — every edible kind is a
// stimulus cell — and the reach multiplier is flies.stimuli["odour:food"].radius (default 1, the bare sprite
// size) rather than flies.stimulus.radius, since the old singular stimulus section does not apply to "v2".
export function buildWorld(config, logic) {
  const { cols: width, rows: height } = logic;
  const f = resolveFlies(config);
  const isWide = f.brain?.version === 'v2';
  const wanted = isWide ? new Set(EDIBLE_KINDS) : new Set(f.stimulus.objects);
  const foodRadius = isWide ? (f.stimuli['odour:food']?.radius ?? 1) : f.stimulus.radius;

  const blocked = logic.blocked;
  const stimulusCells = new Map();
  for (let idx = 0; idx < logic.edible.length; idx++) {
    const kind = logic.edible[idx];
    if (kind !== null && wanted.has(kind)) {
      stimulusCells.set(idx, { kind, reach: foodRadius * logic.edibleSize[idx] });
    }
  }
  // Danger cells (ADR 007 W8, contracts/world-config-wide-io.md: odour:danger and heat read from here by
  // kind), parallel to stimulusCells. Unconditional: harmless for every v0/v1 world, which never reads it.
  const dangerCells = new Map();
  for (let idx = 0; idx < logic.danger.length; idx++) {
    const kind = logic.danger[idx];
    if (kind !== null) dangerCells.set(idx, kind);
  }

  const walkable = (cx, cy) => blocked[cy * width + cx] === 0;
  const isStimulusCell = (cx, cy) => stimulusCells.has(cy * width + cx);

  // Danger/heat fields (ADR 007 W8, contracts/world-format-sketch-map.md §3): built once per world load from
  // the edge-forest/water masks, never from flies.stimuli — the same field feeds the odour:danger/heat sense
  // and the matching overlay (data-model.md "Relationships"). Harmless for a world with no edgeForest/water.
  const danger = dangerField({ forestEdge: logic.forestEdge, cols: width, rows: height });
  const heat = heatField({ water: logic.water, cols: width, rows: height });

  // One cached kernel per food unit (research.md R4): the shape is static (units never move), so it is built
  // once here; the stock fraction that scales it is read live at sense time (fly/food.js createFood), via
  // world/food-field.js's foodFieldAt, by whoever has the fly's live flowers table (forager-step.js/-wide.js).
  const foodUnits = [...stimulusCells].map(([idx]) => {
    const cellX = idx % width;
    const cellY = Math.floor(idx / width);
    const unitX = cellX + 0.5;
    const unitY = cellY + 0.5;
    const seed = (Math.imul(idx + 1, 0x9e3779b1) ^ (config.seed ?? 0)) >>> 0;
    return { cellX, cellY, kernel: foodKernel({ unitX, unitY, seed }) };
  });

  return {
    width, height, blocked, stimulusCells, dangerCells, walkable, isStimulusCell,
    dangerField: danger, heatField: heat, foodUnits,
  };
}

// The odour sources: [{x, y, reach}] cell centres of the stimulus cells, in tiles, with the reach in cells.
export function stimulusPoints(world) {
  return [...world.stimulusCells].map(([idx, { reach }]) => ({
    x: (idx % world.width) + 0.5,
    y: Math.floor(idx / world.width) + 0.5,
    reach,
  }));
}

// Hazard positions (ADR 007 W8, contracts/world-config-wide-io.md flies.stimuli[sense].kinds): world dangers
// filtered by kind, cell centres in tiles, parallel to stimulusPoints for edibles. Each sense's own radius
// (flies.stimuli[sense].radius) supplies the falloff reach, so no reach is attached here.
export function hazardPoints(world, kinds) {
  const wanted = new Set(kinds);
  const points = [];
  for (const [idx, kind] of world.dangerCells) {
    if (wanted.has(kind)) {
      points.push({ x: (idx % world.width) + 0.5, y: Math.floor(idx / world.width) + 0.5 });
    }
  }
  return points;
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
    const sex = f.sex?.[i];
    const sprite = sex !== undefined
      ? (mode === 'baseline' ? `fly-${sex}-baseline` : `fly-${sex}`)
      : (mode === 'baseline' ? f.baselineSprite : f.sprite);
    out.push({
      id: i,
      mode,
      sprite,
      brainSeed: (f.seed + (i + 1) * GOLDEN) >>> 0,
      body: createBody({ x: cell.cx + 0.5, y: cell.cy + 0.5, heading }),
      motor: { left: 0, right: 0 },
      sensory: 0,
      tick: 0,
    });
  }
  return out;
}
