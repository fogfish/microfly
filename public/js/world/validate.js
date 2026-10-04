// Validates a parsed world.json. Pure: no DOM, no fetch.
// Returns an array of { path, message }. An empty array means valid.

import { resolveParams, LIF_DEFAULTS } from '../brain/lif.js';

const FORMAT = 'arcade-world';
const VERSION = 1;
const KINDS = ['scenery', 'edible', 'danger'];
const SHAPES = ['blobs', 'noise'];
const MAX_SPRITE_SIDE = 32;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

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

  if (!isInt(config.seed, 0, 4294967295)) {
    err('seed', 'must be an integer from 0 to 4294967295');
  }

  validateWorld(config.world, err);
  validateCamera(config.camera, err);

  const sprites = isObject(config.sprites) ? config.sprites : null;
  if (!sprites) {
    err('sprites', 'must be an object');
  } else {
    for (const [id, sprite] of Object.entries(sprites)) {
      validateSprite(id, sprite, err);
    }
  }

  const hasSprite = (id) => sprites !== null && Object.hasOwn(sprites, id);
  const terrainIds = validateTerrain(config.terrain, hasSprite, err);
  validateTerrainLayers(config.terrainLayers, terrainIds, err);
  validateGroups(config.groups, terrainIds, hasSprite, err);
  validateObjects(config.objects, hasSprite, terrainIds, err);

  if (config.flies !== undefined) validateFlies(config.flies, config, err);

  return errors;
}

function validateWorld(world, err) {
  if (!isObject(world)) {
    err('world', 'must be an object');
    return;
  }
  if (!isInt(world.width, 1, 512)) err('world.width', 'must be an integer from 1 to 512');
  if (!isInt(world.height, 1, 512)) err('world.height', 'must be an integer from 1 to 512');
  if (world.tileSize !== undefined && !isInt(world.tileSize, 8, 64)) {
    err('world.tileSize', 'must be an integer from 8 to 64');
  }
}

function validateCamera(camera, err) {
  const zoom = isObject(camera) ? camera.zoom : undefined;
  if (!isObject(zoom)) {
    err('camera.zoom', 'must be an object with min, max and default');
    return;
  }
  const minOk = isNum(zoom.min) && zoom.min > 0;
  const maxOk = isNum(zoom.max) && minOk && zoom.max >= zoom.min;
  if (!minOk) err('camera.zoom.min', 'must be a number greater than 0');
  if (!maxOk) err('camera.zoom.max', 'must be a number not less than min');
  if (!isNum(zoom.default) || !minOk || !maxOk || zoom.default < zoom.min || zoom.default > zoom.max) {
    err('camera.zoom.default', 'must be a number between min and max');
  }
}

function validateSprite(id, sprite, err) {
  const path = `sprites.${id}`;
  if (!isObject(sprite)) {
    err(path, 'must be an object');
    return;
  }

  if ('sheet' in sprite) {
    if (typeof sprite.sheet !== 'string' || sprite.sheet === '') {
      err(`${path}.sheet`, 'must be a non-empty path');
    }
    for (const key of ['x', 'y']) {
      if (!isInt(sprite[key], 0, Number.MAX_SAFE_INTEGER)) err(`${path}.${key}`, 'must be an integer of 0 or more');
    }
    for (const key of ['w', 'h']) {
      if (!isInt(sprite[key], 1, Number.MAX_SAFE_INTEGER)) err(`${path}.${key}`, 'must be an integer of 1 or more');
    }
    return;
  }

  if ('pixels' in sprite) {
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
      if (row.length !== cols) {
        err(rowPath, `row length ${row.length}, expected ${cols}`);
      }
      for (const ch of row) {
        if (ch !== '.' && !Object.hasOwn(sprite.palette, ch)) {
          err(rowPath, `character "${ch}" is not in the palette`);
          break;
        }
      }
    });
    return;
  }

  err(path, 'must have either "sheet" or "pixels"');
}

// Returns the Set of valid terrain ids
function validateTerrain(terrain, hasSprite, err) {
  const ids = new Set();
  if (!Array.isArray(terrain) || terrain.length === 0) {
    err('terrain', 'must be a non-empty list');
    return ids;
  }

  let bases = 0;
  terrain.forEach((t, i) => {
    const path = `terrain[${i}]`;
    if (!isObject(t)) {
      err(path, 'must be an object');
      return;
    }
    if (typeof t.id !== 'string' || t.id === '') {
      err(`${path}.id`, 'must be a non-empty string');
    } else if (ids.has(t.id)) {
      err(`${path}.id`, `duplicate terrain id "${t.id}"`);
    } else {
      ids.add(t.id);
    }
    if (!hasSprite(t.sprite)) err(`${path}.sprite`, `unknown sprite "${t.sprite}"`);
    if (t.base === true) {
      bases++;
    } else if (t.base !== undefined && t.base !== false) {
      err(`${path}.base`, 'must be true or false');
    }
  });

  if (bases !== 1) {
    err('terrain', `exactly one terrain must have "base": true; found ${bases}`);
  }
  return ids;
}

function validateTerrainLayers(layers, terrainIds, err) {
  if (layers === undefined) return;
  if (!Array.isArray(layers)) {
    err('terrainLayers', 'must be a list');
    return;
  }

  layers.forEach((layer, i) => {
    const path = `terrainLayers[${i}]`;
    if (!isObject(layer)) {
      err(path, 'must be an object');
      return;
    }
    if (!terrainIds.has(layer.terrain)) err(`${path}.terrain`, `unknown terrain "${layer.terrain}"`);
    validateTerrainRefs(layer.on, `${path}.on`, terrainIds, err);

    if (!SHAPES.includes(layer.shape)) {
      err(`${path}.shape`, 'must be "blobs" or "noise"');
    } else if (layer.shape === 'blobs') {
      if (!isInt(layer.count, 0, Number.MAX_SAFE_INTEGER)) err(`${path}.count`, 'must be an integer of 0 or more');
      const [min, max] = Array.isArray(layer.radius) ? layer.radius : [];
      if (!isInt(min, 1, Number.MAX_SAFE_INTEGER) || !isInt(max, 1, Number.MAX_SAFE_INTEGER) || min > max) {
        err(`${path}.radius`, 'must be [min, max] with 1 <= min <= max');
      }
    } else {
      if (!isNum(layer.threshold) || layer.threshold < 0 || layer.threshold > 1) {
        err(`${path}.threshold`, 'must be a number from 0 to 1');
      }
      if (!isNum(layer.scale) || layer.scale < 2) err(`${path}.scale`, 'must be a number of 2 or more');
    }
  });
}

// Tile groups (BUG-001). Optional. Keys are terrain ids. Each group has a fill
// sprite and optional edge sprites keyed by open-side names (see autotile.js).
const EDGE_KEYS = ['N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW', 'NS', 'EW', 'NESW'];

function validateGroups(groups, terrainIds, hasSprite, err) {
  if (groups === undefined) return;
  if (!isObject(groups)) {
    err('groups', 'must be an object keyed by terrain id');
    return;
  }
  for (const [terrainId, group] of Object.entries(groups)) {
    const path = `groups.${terrainId}`;
    if (!terrainIds.has(terrainId)) {
      err(path, `unknown terrain "${terrainId}"`);
      continue;
    }
    if (!isObject(group)) {
      err(path, 'must be an object with a fill sprite');
      continue;
    }
    if (!hasSprite(group.fill)) err(`${path}.fill`, `unknown sprite "${group.fill}"`);
    if (group.edges === undefined) continue;
    if (!isObject(group.edges)) {
      err(`${path}.edges`, 'must be an object keyed by edge name');
      continue;
    }
    for (const [key, spriteId] of Object.entries(group.edges)) {
      if (!EDGE_KEYS.includes(key)) err(`${path}.edges.${key}`, `unknown edge "${key}"`);
      if (!hasSprite(spriteId)) err(`${path}.edges.${key}`, `unknown sprite "${spriteId}"`);
    }
  }
}

function validateObjects(rules, hasSprite, terrainIds, err) {
  if (rules === undefined) return;
  if (!Array.isArray(rules)) {
    err('objects', 'must be a list');
    return;
  }

  const ids = new Set();
  rules.forEach((rule, i) => {
    const path = `objects[${i}]`;
    if (!isObject(rule)) {
      err(path, 'must be an object');
      return;
    }
    if (typeof rule.id !== 'string' || rule.id === '') {
      err(`${path}.id`, 'must be a non-empty string');
    } else if (ids.has(rule.id)) {
      err(`${path}.id`, `duplicate object id "${rule.id}"`);
    } else {
      ids.add(rule.id);
    }
    if (!KINDS.includes(rule.kind)) err(`${path}.kind`, 'must be "scenery", "edible" or "danger"');
    if (!hasSprite(rule.sprite)) err(`${path}.sprite`, `unknown sprite "${rule.sprite}"`);
    if (!isInt(rule.count, 0, Number.MAX_SAFE_INTEGER)) err(`${path}.count`, 'must be an integer of 0 or more');
    validateTerrainRefs(rule.allowedTerrain, `${path}.allowedTerrain`, terrainIds, err, true);
    if (rule.minSpacing !== undefined && !isInt(rule.minSpacing, 0, Number.MAX_SAFE_INTEGER)) {
      err(`${path}.minSpacing`, 'must be an integer of 0 or more');
    }
  });
}

// Optional `flies` section (contracts/fly-config.md). Defaults are applied by fly/fly-config.js.
const FLY_MODES = ['toy', 'baseline'];
const SEED_MAX = 4294967295;
// Edible rules that are not fruit. The spec's stimulus is fruit only, so honey is excluded.
const NON_FRUIT = new Set(['honey']);

function validateFlies(flies, config, err) {
  if (!isObject(flies)) {
    err('flies', 'must be an object');
    return;
  }

  const hasSprite = (id) => isObject(config.sprites) && Object.hasOwn(config.sprites, id);
  const edible = new Set(
    (config.objects ?? []).filter((r) => r.kind === 'edible' && !NON_FRUIT.has(r.id)).map((r) => r.id),
  );

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

  validateFlyBody(flies.body, err);
  validateFlyStimulus(flies.stimulus, edible, err);

  // The brain is ignored in baseline mode, so it is only checked for toy flies
  if ((flies.mode ?? 'toy') === 'toy') validateFlyBrain(flies.brain, err);

  validateFlyExperiment(flies.experiment, err);
}

function validateFlyBody(body, err) {
  if (!isObject(body)) {
    err('flies.body', 'must be an object with maxSpeed and turnRate');
    return;
  }
  if (!(isNum(body.maxSpeed) && body.maxSpeed > 0)) err('flies.body.maxSpeed', 'must be a number greater than 0');
  if (!(isNum(body.turnRate) && body.turnRate > 0)) err('flies.body.turnRate', 'must be a number greater than 0');
}

function validateFlyStimulus(stimulus, edible, err) {
  if (!isObject(stimulus)) {
    err('flies.stimulus', 'must be an object');
    return;
  }
  if (!Array.isArray(stimulus.objects) || stimulus.objects.length === 0) {
    err('flies.stimulus.objects', 'must be a non-empty list of edible object ids');
  } else {
    stimulus.objects.forEach((id, i) => {
      if (!edible.has(id)) err(`flies.stimulus.objects[${i}]`, `"${id}" is not an edible object rule`);
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

  // A snapshot brain takes its size from the file, so toy-only settings are a conflict (contracts/integration.md §1).
  const snapshot = brain.snapshot;
  const isSnapshot = snapshot !== undefined;
  if (isSnapshot) {
    if (typeof snapshot !== 'string' || snapshot === '') {
      err('flies.brain.snapshot', 'must be a non-empty path to a .brain file');
    }
    for (const key of ['neuronCount', 'outDegree', 'inhibitoryFraction']) {
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

  // A snapshot's neuronCount is only known after the file is read, so the host checks the bounds then.
  const telemetry = brain.telemetry ?? [0, 1, 2];
  const upper = isSnapshot ? Number.MAX_SAFE_INTEGER : (neuronsOk ? n - 1 : -1);
  const telemetryOk =
    Array.isArray(telemetry) &&
    telemetry.every((t) => isInt(t, 0, upper)) &&
    new Set(telemetry).size === telemetry.length;
  if (!telemetryOk) {
    const bound = isSnapshot ? 'the snapshot neuronCount - 1' : (neuronsOk ? n - 1 : 'neuronCount - 1');
    err('flies.brain.telemetry', `must be a list of unique integers from 0 to ${bound}`);
  }

  if (brain.lif !== undefined) {
    if (!isObject(brain.lif)) {
      err('flies.brain.lif', 'must be an object of LIF parameters');
      return;
    }
    const entries = Object.entries(brain.lif);
    const unknown = entries.filter(([key]) => !Object.hasOwn(LIF_DEFAULTS, key));
    const notNumbers = entries.filter(([key, value]) => Object.hasOwn(LIF_DEFAULTS, key) && !isNum(value));
    for (const [key] of unknown) err('flies.brain.lif', `unknown LIF parameter "${key}"`);
    for (const [key] of notNumbers) err(`flies.brain.lif.${key}`, 'must be a number');

    // Range checks (dt > 0, vThreshold > vReset, ...) live in lif.js, so they match the engine
    if (unknown.length === 0 && notNumbers.length === 0) {
      try {
        resolveParams(brain.lif);
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
}

function validateTerrainRefs(list, path, terrainIds, err, nonEmpty = false) {
  if (!Array.isArray(list) || (nonEmpty && list.length === 0)) {
    err(path, nonEmpty ? 'must be a list with at least one terrain id' : 'must be a list of terrain ids');
    return;
  }
  for (const id of list) {
    if (!terrainIds.has(id)) err(path, `unknown terrain "${id}"`);
  }
}
