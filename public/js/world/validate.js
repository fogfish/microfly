// Validates a parsed world.json. Pure: no DOM, no fetch.
// Returns an array of { path, message }. An empty array means valid.

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

function validateTerrainRefs(list, path, terrainIds, err, nonEmpty = false) {
  if (!Array.isArray(list) || (nonEmpty && list.length === 0)) {
    err(path, nonEmpty ? 'must be a list with at least one terrain id' : 'must be a list of terrain ids');
    return;
  }
  for (const id of list) {
    if (!terrainIds.has(id)) err(path, `unknown terrain "${id}"`);
  }
}
