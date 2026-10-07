// Validates a parsed world.json (format version 3, spec 009 contracts/world-format-v3.md). Pure: no DOM, no fetch.
// validateConfig(config) checks structure and geometry. validateArt(config, catalog) checks sprite
// references against the atlas catalogue. Both return an array of { path, message }; empty means valid.
// Paths name the section and the entry, e.g. objects[3].

import { resolveParams, LIF_DEFAULTS } from '../brain/lif-v0.js';
import { resolveParams as resolveParamsV1, LIF_V1_DEFAULTS } from '../brain/lif-v1.js';
import { validateCapabilities } from '../brain/capabilities.js';
import { cellIndex, EDIBLE_KINDS, DANGER_KINDS, CELL_PX, FOOD_SPRITE_IDS, REMOVED_SPRITE_IDS } from './layout.js';
import { buildWaterField, waterField, cellWater, bodyKind, BODY_RANGES } from './water.js';
const FORMAT = 'arcade-world';
const VERSION = 3;
const SURFACE_KINDS = ['meadow', 'darkGrass', 'cobble', 'gravel'];
const GROVE_MIN = 4;
const GROVE_MAX = 12;
const MAX_SPRITE_SIDE = 32;
const SEED_MAX = 4294967295;
const BRAIN_VERSIONS = ['mock', 'v0', 'v1'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isText = (v) => typeof v === 'string' && v !== '';

export function validateConfig(config) {
  const errors = [];
  const err = (path, message) => errors.push({ path, message });

  if (!isObject(config)) {
    err('', 'world.json must contain a JSON object');
    return errors;
  }

  // Format and version are checked first. A wrong value stops validation.
  if (config.format !== FORMAT) {
    err('format', `must be "${FORMAT}"`);
    return errors;
  }
  if (config.version !== VERSION) {
    err('version', `unsupported version ${config.version}; this app supports ${VERSION}`);
    return errors;
  }

  if (!isText(config.name)) err('name', 'must be a non-empty string');
  if (!isInt(config.seed, 0, SEED_MAX)) err('seed', `must be an integer from 0 to ${SEED_MAX}`);
  const grid = validateGrid(config.grid, err);
  validateZoom(config.zoom, err);
  if (!isText(config.atlas)) err('atlas', 'must be the path to the art catalogue, e.g. "assets/atlas/catalog.json"');

  const pixelSprites = config.sprites ?? {};
  if (!isObject(pixelSprites)) {
    err('sprites', 'must be an object of pixel sprites');
  } else {
    for (const [id, sprite] of Object.entries(pixelSprites)) validatePixelSprite(id, sprite, err);
  }

  if (grid === null) return errors;
  const { cols, rows } = grid;
  const inGrid = (x, y) => isNum(x) && isNum(y) && x >= 0 && x < cols && y >= 0 && y < rows;

  validateList(config.ground, 'ground', err).forEach((area, i) => {
    const path = `ground[${i}]`;
    checkId(area, path, err);
    if (!SURFACE_KINDS.includes(area?.kind)) err(`${path}.kind`, `must be one of ${SURFACE_KINDS.join(', ')}`);
    validateOutline(area?.outline, `${path}.outline`, err);
  });

  const bodies = validateList(config.waterBodies, 'waterBodies', err);
  const validBodies = [];
  bodies.forEach((body, i) => {
    const path = `waterBodies[${i}]`;
    checkId(body, path, err);
    if (!validateBlob(body?.outline, `${path}.outline`, err)) return;
    // Every shore is the grass shore style (BUG-002), so a per-body choice is refused.
    if (body.shore !== undefined) err(`${path}.shore`, 'is not used; every shore is the grass shore style (remove this field)');
    if (bodyKind(body.outline.blob) === null) {
      err(`${path}.outline`, `is neither a pond nor a lake; ${rangeText()}`);
      return;
    }
    validBodies.push(body);
  });
  // When every body is valid, this is the same field layout.js uses, so it is built once (cached)
  const field = validBodies.length === bodies.length && isInt(config.seed, 0, SEED_MAX)
    ? waterField(config)
    : buildWaterField({ cols, rows, seed: isInt(config.seed, 0, SEED_MAX) ? config.seed : 0, bodies: validBodies });
  const water = cellWater(field, cols, rows);

  validateList(config.objects, 'objects', err).forEach((o, i) => {
    const path = `objects[${i}]`;
    if (!isText(o?.sprite)) err(`${path}.sprite`, 'must be a sprite id or name');
    if (!inGrid(o?.x, o?.y)) err(path, `x and y must be numbers inside the grid (0 to ${cols} × 0 to ${rows})`);
    if (o?.solid !== undefined && typeof o.solid !== 'boolean') err(`${path}.solid`, 'must be true or false');
    if (inGrid(o?.x, o?.y) && o.solid === true && water[cellIndex(o.x, o.y, cols)]) {
      err(path, 'is a solid object on water; solid objects must sit on land');
    }
  });

  validateList(config.groves, 'groves', err).forEach((g, i) => {
    const path = `groves[${i}]`;
    checkId(g, path, err);
    if (!Array.isArray(g?.centre) || g.centre.length !== 2 || !isNum(g.centre[0]) || !isNum(g.centre[1])) {
      err(`${path}.centre`, 'must be [x, y] in cells');
    }
    if (!Array.isArray(g?.trees) || g.trees.length < GROVE_MIN || g.trees.length > GROVE_MAX) {
      err(`${path}.trees`, `a group needs ${GROVE_MIN} to ${GROVE_MAX} trees; found ${Array.isArray(g?.trees) ? g.trees.length : 0}`);
      return;
    }
    g.trees.forEach((t, j) => {
      if (!isText(t?.sprite)) err(`${path}.trees[${j}].sprite`, 'must be a sprite id or name');
      if (!isNum(t?.dx) || !isNum(t?.dy)) err(`${path}.trees[${j}]`, 'dx and dy must be numbers');
    });
  });

  validateList(config.scatter, 'scatter', err).forEach((s, i) => {
    const path = `scatter[${i}]`;
    checkId(s, path, err);
    validateOutline(s?.area, `${path}.area`, err);
    if (!Array.isArray(s?.sprites) || s.sprites.length === 0 || !s.sprites.every(isText)) {
      err(`${path}.sprites`, 'must be a non-empty list of sprite ids or names');
    }
    if (!(isNum(s?.density) && s.density >= 0 && s.density <= 4)) err(`${path}.density`, 'must be a number from 0 to 4');
    if (!(isNum(s?.clearings) && s.clearings >= 0 && s.clearings <= 1)) err(`${path}.clearings`, 'must be a number from 0 to 1');
    if (!isInt(s?.seed, 0, SEED_MAX)) err(`${path}.seed`, `must be an integer from 0 to ${SEED_MAX}`);
  });

  // Food is one or more units per size class, every class present (spec 009 FR-001, BUG-001). Each names its
  // sprite (contract §2). Several units of the same kind MAY be placed near each other (FR-020).
  const edibles = validateList(config.edibles, 'edibles', err);
  edibles.forEach((e, i) => {
    validateSpot(e, `edibles[${i}]`, EDIBLE_KINDS, 'edible', inGrid, water, cols, err);
    if (!isText(e?.sprite)) err(`edibles[${i}].sprite`, 'is required: the food sprite for this kind');
  });
  if (!EDIBLE_KINDS.every((k) => edibles.some((e) => e?.kind === k))) {
    err('edibles', `must hold at least one unit of each kind: ${EDIBLE_KINDS.join(', ')}`);
  }
  validateList(config.dangers, 'dangers', err).forEach((d, i) => {
    validateSpot(d, `dangers[${i}]`, DANGER_KINDS, 'danger', inGrid, water, cols, err);
  });

  if (config.flies !== undefined) validateFlies(config.flies, config, err);

  return errors;
}

// Art references against the catalogue. catalog is from indexCatalog.
export function validateArt(config, catalog) {
  const errors = [];
  const check = (ref, path) => {
    if (!isText(ref)) return;
    const { error } = catalog.lookup(ref);
    if (error) errors.push({ path, message: error });
  };

  (config.objects ?? []).forEach((o, i) => check(o?.sprite, `objects[${i}]`));
  (config.groves ?? []).forEach((g, i) => (g?.trees ?? []).forEach((t, j) => check(t?.sprite, `groves[${i}].trees[${j}]`)));
  // Food sprites are for food only, and removed sprites are gone from every world (spec 009 FR-009, FR-019).
  // Names and ids are both resolved through the catalogue, so a rule may name a sprite either way.
  const food = new Set(Object.values(FOOD_SPRITE_IDS));
  const checkScatter = (ref, path) => {
    if (!isText(ref)) return;
    const { sprite, error } = catalog.lookup(ref);
    if (error) return errors.push({ path, message: error });
    if (food.has(sprite.id)) errors.push({ path, message: `"${ref}" is a food sprite; food art is only where food is (FR-019)` });
    if (REMOVED_SPRITE_IDS.includes(sprite.id)) errors.push({ path, message: `"${ref}" is a removed sprite (FR-009)` });
  };

  (config.edibles ?? []).forEach((e, i) => {
    if (!isText(e?.sprite)) return;
    const { sprite, error } = catalog.lookup(e.sprite);
    const path = `edibles[${i}].sprite`;
    if (error) return errors.push({ path, message: error });
    const want = FOOD_SPRITE_IDS[e.kind];
    if (want !== undefined && sprite.id !== want) {
      errors.push({ path, message: `"${e.sprite}" is not the food sprite for kind "${e.kind}" (${want})` });
    }
  });
  (config.scatter ?? []).forEach((s, i) => (s?.sprites ?? []).forEach((ref, j) => checkScatter(ref, `scatter[${i}].sprites[${j}]`)));
  return errors;
}

function validateGrid(grid, err) {
  if (!isObject(grid)) {
    err('grid', 'must be an object with cols, rows and cellPx');
    return null;
  }
  let ok = true;
  if (!isInt(grid.cols, 1, 512)) { err('grid.cols', 'must be an integer from 1 to 512'); ok = false; }
  if (!isInt(grid.rows, 1, 512)) { err('grid.rows', 'must be an integer from 1 to 512'); ok = false; }
  if (grid.cellPx !== CELL_PX) { err('grid.cellPx', `must be ${CELL_PX}`); ok = false; }
  return ok ? grid : null;
}

// Zoom steps are whole numbers, so every step is pixel-exact (research R5).
function validateZoom(zoom, err) {
  if (!isObject(zoom)) {
    err('zoom', 'must be an object with min, max and default');
    return;
  }
  const minOk = isInt(zoom.min, 1, 16);
  const maxOk = isInt(zoom.max, 1, 16) && minOk && zoom.max >= zoom.min;
  if (!minOk) err('zoom.min', 'must be an integer from 1 to 16');
  if (!maxOk) err('zoom.max', 'must be an integer not less than min');
  if (!isInt(zoom.default, 1, 16) || !minOk || !maxOk || zoom.default < zoom.min || zoom.default > zoom.max) {
    err('zoom.default', 'must be an integer between min and max');
  }
}

// Pixel-form sprites. They hold the fly art, which the atlas does not have.
function validatePixelSprite(id, sprite, err) {
  const path = `sprites.${id}`;
  if (!isObject(sprite) || !('pixels' in sprite)) {
    err(path, 'must be an object with "pixels" and "palette"');
    return;
  }
  const rows = sprite.pixels;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_SPRITE_SIDE) {
    err(`${path}.pixels`, `must be a list of 1 to ${MAX_SPRITE_SIDE} rows`);
    return;
  }
  if (!isObject(sprite.palette)) {
    err(`${path}.palette`, 'must be an object mapping characters to colours');
    return;
  }
  if (Object.hasOwn(sprite.palette, '.')) {
    err(`${path}.palette`, 'must not contain "." (that character is always transparent)');
  }
  for (const [ch, colour] of Object.entries(sprite.palette)) {
    if (typeof colour !== 'string') err(`${path}.palette.${ch}`, 'must be a colour string');
  }

  const cols = typeof rows[0] === 'string' ? rows[0].length : 0;
  if (cols === 0 || cols > MAX_SPRITE_SIDE) {
    err(`${path}.pixels[0]`, `must be a non-empty row of at most ${MAX_SPRITE_SIDE} characters`);
    return;
  }
  rows.forEach((row, y) => {
    const rowPath = `${path}.pixels[${y}]`;
    if (typeof row !== 'string') {
      err(rowPath, 'must be a string');
      return;
    }
    if (row.length !== cols) err(rowPath, `row length ${row.length}, expected ${cols}`);
    for (const ch of row) {
      if (ch !== '.' && !Object.hasOwn(sprite.palette, ch)) {
        err(rowPath, `character "${ch}" is not in the palette`);
        break;
      }
    }
  });
}

// The entries of a list section. A missing section is an empty list; a non-list is reported once.
function validateList(list, path, err) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) {
    err(path, 'must be a list');
    return [];
  }
  return list;
}

function checkId(entry, path, err) {
  if (!isObject(entry) || !isText(entry.id)) err(`${path}.id`, 'must be a non-empty string');
}

// Returns true when the outline is valid. An outline is an ellipse or a polygon, in cells.
function validateOutline(outline, path, err) {
  if (isObject(outline) && isObject(outline.ellipse)) {
    const e = outline.ellipse;
    const ok = isNum(e.cx) && isNum(e.cy) && isNum(e.rx) && e.rx > 0 && isNum(e.ry) && e.ry > 0;
    if (!ok) err(path, 'ellipse needs numeric cx and cy and positive rx and ry');
    return ok;
  }
  if (isObject(outline) && Array.isArray(outline.polygon)) {
    const pts = outline.polygon;
    const ok = pts.length >= 3 && pts.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]));
    if (!ok) err(path, 'polygon needs at least 3 points, each [x, y] in cells');
    return ok;
  }
  err(path, 'must be {"ellipse": {"cx", "cy", "rx", "ry"}} or {"polygon": [[x, y], ...]}');
  return false;
}

// A water body outline is a wobbly ellipse in cells (FR-028, BUG-002). Returns true when valid.
function validateBlob(outline, path, err) {
  const b = isObject(outline) ? outline.blob : undefined;
  if (!isObject(b)) {
    err(path, 'must be {"blob": {"cx", "cy", "rx", "ry", "wobble", "harmonics"}}; ellipse and polygon water is no longer drawn');
    return false;
  }
  const ok = isNum(b.cx) && isNum(b.cy) && isNum(b.rx) && b.rx > 0 && isNum(b.ry) && b.ry > 0
    && isNum(b.wobble) && b.wobble >= 0 && isInt(b.harmonics, 1, 12);
  if (!ok) err(path, 'blob needs numeric cx and cy, positive rx and ry, a wobble of 0 or more and 1 to 12 harmonics');
  return ok;
}

// The pond and lake ranges, in cells, for the error message (FR-011).
function rangeText() {
  return Object.entries(BODY_RANGES).map(([kind, r]) => {
    const rx = r.rx.map((v) => +(v / CELL_PX).toFixed(2)).join(' to ');
    return `a ${kind} has rx ${rx} cells, ry/rx ${r.ratio.join(' to ')}, wobble ${r.wobble.join(' to ')} and ${r.harmonics.join(' to ')} harmonics`;
  }).join('; ');
}

function validateSpot(spot, path, kinds, role, inGrid, water, cols, err) {
  if (!isObject(spot)) {
    err(path, 'must be an object with kind, x and y');
    return;
  }
  if (!kinds.includes(spot.kind)) {
    const article = /^[aeiou]/.test(role) ? 'an' : 'a';
    err(`${path}.kind`, `"${spot.kind}" is not ${article} ${role} kind; must be ${kinds.map((k) => `"${k}"`).join(', ')}`);
  }
  if (!inGrid(spot.x, spot.y)) {
    err(path, 'x and y must be numbers inside the grid');
    return;
  }
  if (water[cellIndex(spot.x, spot.y, cols)]) {
    err(path, `is on water; ${role}s must sit on land`);
  }
}

// Optional `flies` section (contracts/fly-config.md). Defaults are applied by fly/fly-config.js.
const FLY_MODES = ['toy', 'baseline'];

function validateFlies(flies, config, err) {
  if (!isObject(flies)) {
    err('flies', 'must be an object');
    return;
  }

  const hasSprite = (id) => isObject(config.sprites) && Object.hasOwn(config.sprites, id);
  const edible = new Set(EDIBLE_KINDS);

  if (flies.seed !== undefined && !isInt(flies.seed, 0, SEED_MAX)) {
    err('flies.seed', `must be an integer from 0 to ${SEED_MAX}`);
  }
  if (flies.count !== undefined && !isInt(flies.count, 0, 64)) err('flies.count', 'must be an integer from 0 to 64');
  if (!FLY_MODES.includes(flies.mode ?? 'toy')) err('flies.mode', 'must be "toy" or "baseline"');
  if (flies.tickHz !== undefined && !isInt(flies.tickHz, 1, 60)) err('flies.tickHz', 'must be an integer from 1 to 60');

  if (flies.sprite === undefined) err('flies.sprite', 'is required');
  else if (!hasSprite(flies.sprite)) err('flies.sprite', `unknown sprite "${flies.sprite}"`);
  if (flies.baselineSprite !== undefined && !hasSprite(flies.baselineSprite)) {
    err('flies.baselineSprite', `unknown sprite "${flies.baselineSprite}"`);
  }
  // Per-fly sex (contracts/fly-sprite.md §2, BUG-002): picks the fly-female/fly-male (and baseline) pair per
  // fly instead of the one fly.sprite/baselineSprite pair. Declared in data (constitution VI), not chosen in code.
  if (flies.sex !== undefined) validateFlySex(flies.sex, flies.count ?? 6, hasSprite, err);

  validateFlyBody(flies.body, err);
  validateFlyFood(flies.food, err);
  validateFlyStimulus(flies.stimulus, edible, err);

  // The brain is ignored in baseline mode, so it is only checked for toy flies
  if ((flies.mode ?? 'toy') === 'toy') validateFlyBrain(flies.brain, err);

  validateFlyExperiment(flies.experiment, err);
}

const FLY_SEXES = ['female', 'male'];

function validateFlySex(sex, count, hasSprite, err) {
  if (!Array.isArray(sex) || sex.length !== count) {
    err('flies.sex', `must be an array of ${count} entries ("female" or "male"), one per fly`);
    return;
  }
  const used = new Set();
  sex.forEach((s, i) => {
    if (!FLY_SEXES.includes(s)) err(`flies.sex[${i}]`, 'must be "female" or "male"');
    else used.add(s);
  });
  for (const s of used) {
    if (!hasSprite(`fly-${s}`)) err('flies.sex', `sprite "fly-${s}" is not in sprites`);
    if (!hasSprite(`fly-${s}-baseline`)) err('flies.sex', `sprite "fly-${s}-baseline" is not in sprites`);
  }
}

function validateFlyBody(body, err) {
  if (!isObject(body)) {
    err('flies.body', 'must be an object with maxSpeed and turnRate');
    return;
  }
  if (!(isNum(body.maxSpeed) && body.maxSpeed > 0)) err('flies.body.maxSpeed', 'must be a number greater than 0');
  if (!(isNum(body.turnRate) && body.turnRate > 0)) err('flies.body.turnRate', 'must be a number greater than 0');

  // Energy (v1 only; defaults in fly-config.js). Ignored by v0 worlds, but checked when present.
  if (body.energy !== undefined) {
    const e = body.energy;
    if (!isObject(e)) err('flies.body.energy', 'must be an object with initial, metabolism and intake');
    else {
      if (e.initial !== undefined && !(isNum(e.initial) && e.initial >= 0 && e.initial <= 1)) {
        err('flies.body.energy.initial', 'must be a number from 0 to 1');
      }
      if (e.metabolism !== undefined && !(isNum(e.metabolism) && e.metabolism >= 0)) {
        err('flies.body.energy.metabolism', 'must be a number of 0 or more');
      }
      if (e.intake !== undefined && !(isNum(e.intake) && e.intake >= 0)) {
        err('flies.body.energy.intake', 'must be a number of 0 or more');
      }
    }
  }
}

// Food (v1 only; contracts/world-config-forager.md, flies.food).
function validateFlyFood(food, err) {
  if (food === undefined) return;
  if (!isObject(food)) {
    err('flies.food', 'must be an object');
    return;
  }
  const check = (key, ok, text) => {
    if (food[key] !== undefined && !ok(food[key])) err(`flies.food.${key}`, text);
  };
  check('eatSpeed', (v) => isNum(v) && v > 0, 'must be a number greater than 0');
  check('feedThreshold', (v) => isNum(v) && v >= 0 && v <= 1, 'must be a number from 0 to 1');
  check('stock', (v) => isNum(v) && v > 0, 'must be a number greater than 0');
  check('consumeRate', (v) => isNum(v) && v >= 0, 'must be a number of 0 or more');
  check('regrowth', (v) => isNum(v) && v >= 0, 'must be a number of 0 or more');
  check('sated', (v) => isNum(v) && v >= 0 && v <= 1, 'must be a number from 0 to 1');
}

function validateFlyStimulus(stimulus, edible, err) {
  if (!isObject(stimulus)) {
    err('flies.stimulus', 'must be an object');
    return;
  }
  if (stimulus.antennaOffset !== undefined && !(isNum(stimulus.antennaOffset) && stimulus.antennaOffset >= 0)) {
    err('flies.stimulus.antennaOffset', 'must be a number of 0 or more');
  }
  if (!Array.isArray(stimulus.objects) || stimulus.objects.length === 0) {
    err('flies.stimulus.objects', 'must be a non-empty list of edible object ids');
  } else {
    stimulus.objects.forEach((id, i) => {
      if (!edible.has(id)) err(`flies.stimulus.objects[${i}]`, `"${id}" is not an edible kind`);
    });
  }
  if (!(isNum(stimulus.radius) && stimulus.radius > 0)) err('flies.stimulus.radius', 'must be a number greater than 0');
  if (!(isNum(stimulus.gain) && stimulus.gain >= 0)) err('flies.stimulus.gain', 'must be a number of 0 or more');
  if (!(isNum(stimulus.max) && stimulus.max > 0)) err('flies.stimulus.max', 'must be a number greater than 0');
  const resting = stimulus.resting ?? 0;
  if (!(isNum(resting) && resting >= 0 && (!isNum(stimulus.max) || resting <= stimulus.max))) {
    err('flies.stimulus.resting', 'must be a number from 0 to max');
  }
}

function validateFlyBrain(brain, err) {
  if (brain === undefined) {
    err('flies.brain', 'is required when mode is "toy"');
    return;
  }
  if (!isObject(brain)) {
    err('flies.brain', 'must be an object');
    return;
  }

  // The version selects the brain stack (contracts/world-config-forager.md). Absent: mock, or v0 when a snapshot is given.
  const snapshot = brain.snapshot;
  const isSnapshot = snapshot !== undefined;
  if (brain.version !== undefined && !BRAIN_VERSIONS.includes(brain.version)) {
    err('flies.brain.version', 'must be "mock", "v0" or "v1"');
  }
  const version = BRAIN_VERSIONS.includes(brain.version) ? brain.version : (isSnapshot ? 'v0' : 'mock');
  if (version === 'mock' && isSnapshot) {
    err('flies.brain.snapshot', 'cannot be set for version "mock"');
  }
  if (version !== 'mock' && !isSnapshot && BRAIN_VERSIONS.includes(brain.version)) {
    err('flies.brain.snapshot', `is required for version "${version}"`);
  }

  // A snapshot brain takes its size from the file, so toy-only settings are a conflict (contracts/integration.md §1).
  if (isSnapshot) {
    if (typeof snapshot !== 'string' || snapshot === '') {
      err('flies.brain.snapshot', 'must be a non-empty path to a .brain file');
    }
    for (const key of ['neuronCount', 'outDegree', 'inhibitoryFraction', 'capabilities']) {
      if (brain[key] !== undefined) {
        err('flies.brain', `"snapshot" cannot be combined with "${key}"`);
      }
    }
  }

  const n = brain.neuronCount ?? 40;
  const neuronsOk = isSnapshot || isInt(n, 3, 1000);
  if (!isSnapshot && !neuronsOk) err('flies.brain.neuronCount', 'must be an integer from 3 to 1000');

  if (!isSnapshot) {
    const outDegree = brain.outDegree ?? 4;
    if (neuronsOk && !isInt(outDegree, 1, n - 1)) {
      err('flies.brain.outDegree', `must be an integer from 1 to ${n - 1} (neuronCount - 1)`);
    }

    const inhibitory = brain.inhibitoryFraction ?? 0.2;
    if (!(isNum(inhibitory) && inhibitory >= 0 && inhibitory <= 1)) {
      err('flies.brain.inhibitoryFraction', 'must be a number from 0 to 1');
    }
  }

  const smoothing = brain.motorSmoothing ?? 0.05;
  if (!(isNum(smoothing) && smoothing > 0 && smoothing <= 1)) {
    err('flies.brain.motorSmoothing', 'must be a number greater than 0 and at most 1');
  }

  // Removed in protocol 2: the panel reads the full spike stream, so the telemetry list is gone.
  if (brain.telemetry !== undefined) {
    err('flies.brain.telemetry', 'was removed; the panel reads the full spike stream');
  }

  // An optional declaration for a toy brain (channel-declaration.md). A snapshot brain reads its own.
  if (brain.capabilities !== undefined && !isSnapshot) {
    const [problem] = validateCapabilities(brain.capabilities, neuronsOk ? n : Infinity, 'brain');
    if (problem) err('flies.brain.capabilities', problem);
  }

  // The LIF keys are those of the brain's version: LIF_DEFAULTS for mock and v0, LIF_V1_DEFAULTS for v1.
  if (brain.stepsPerTick !== undefined) {
    if (version !== 'v1') err('flies.brain.stepsPerTick', 'is only for version "v1"');
    else if (!isInt(brain.stepsPerTick, 1, 20)) err('flies.brain.stepsPerTick', 'must be an integer from 1 to 20');
  }

  if (brain.lif !== undefined) {
    if (!isObject(brain.lif)) {
      err('flies.brain.lif', 'must be an object of LIF parameters');
      return;
    }
    const defaults = version === 'v1' ? LIF_V1_DEFAULTS : LIF_DEFAULTS;
    const entries = Object.entries(brain.lif);
    const unknown = entries.filter(([key]) => !Object.hasOwn(defaults, key));
    for (const [key] of unknown) err('flies.brain.lif', `unknown LIF parameter "${key}"`);

    // outputScale (BUG-002) may be a plain object keyed by output-channel id; every other key stays number-only.
    let outputScaleShapeInvalid = false;
    if (Object.hasOwn(brain.lif, 'outputScale') && isObject(brain.lif.outputScale)) {
      for (const [channel, value] of Object.entries(brain.lif.outputScale)) {
        if (!isNum(value)) {
          err(`flies.brain.lif.outputScale.${channel}`, 'must be a number');
          outputScaleShapeInvalid = true;
        }
      }
    }
    const notNumbers = entries.filter(([key, value]) => {
      if (!Object.hasOwn(defaults, key)) return false;
      if (key === 'outputScale' && isObject(value)) return false; // handled above
      return !isNum(value);
    });
    for (const [key] of notNumbers) err(`flies.brain.lif.${key}`, 'must be a number');

    // Range checks (dt > 0, vThreshold > vReset, ...) live in the engine (lif-v0.js, lif-v1.js), so they match it
    if (unknown.length === 0 && notNumbers.length === 0 && !outputScaleShapeInvalid) {
      try {
        if (version === 'v1') resolveParamsV1(brain.lif);
        else resolveParams(brain.lif);
      } catch (e) {
        err('flies.brain.lif', e.message);
      }
    }
  }
}

function validateFlyExperiment(experiment, err) {
  if (experiment === undefined) return;
  if (!isObject(experiment)) {
    err('flies.experiment', 'must be an object');
    return;
  }
  if (experiment.seeds !== undefined) {
    const seeds = experiment.seeds;
    if (!Array.isArray(seeds) || seeds.length === 0 || !seeds.every((s) => isInt(s, 0, SEED_MAX))) {
      err('flies.experiment.seeds', `must be a non-empty list of integers from 0 to ${SEED_MAX}`);
    }
  }
  if (experiment.ticks !== undefined && !isInt(experiment.ticks, 1, 1000000)) {
    err('flies.experiment.ticks', 'must be an integer from 1 to 1000000');
  }
  // The held-out seeds of the comparison (ADR 003 Gate C): 30 distinct seeds, none of them a calibration seed.
  if (experiment.heldOut !== undefined) {
    const held = experiment.heldOut;
    const valid = Array.isArray(held) && held.length === 30 && new Set(held).size === 30
      && held.every((s) => isInt(s, 0, SEED_MAX));
    if (!valid) {
      err('flies.experiment.heldOut', `must be a list of 30 distinct integers from 0 to ${SEED_MAX}`);
    } else if (Array.isArray(experiment.seeds)) {
      const overlap = held.filter((s) => experiment.seeds.includes(s)).sort((a, b) => a - b);
      if (overlap.length > 0) err('flies.experiment.heldOut', `overlaps flies.experiment.seeds: ${overlap.join(', ')}`);
    }
  }
}
