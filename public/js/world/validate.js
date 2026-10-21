// Validates a parsed world.json (format version 3, spec 009 contracts/world-format-v3.md). Pure: no DOM, no fetch.
// validateConfig(config) checks structure and geometry. validateArt(config, catalog) checks sprite
// references against the atlas catalogue. Both return an array of { path, message }; empty means valid.
// Paths name the section and the entry, e.g. objects[3].

import { resolveParams, LIF_DEFAULTS } from '../brain/lif-v0.js';
import { resolveParams as resolveParamsV1, LIF_V1_DEFAULTS } from '../brain/lif-v1.js';
import { validateCapabilities } from '../brain/capabilities.js';
import {
  cellIndex, EDIBLE_KINDS, DANGER_KINDS, CELL_PX, FOOD_SPRITE_IDS, REMOVED_SPRITE_IDS, rasterizeOutline, buildLogic,
} from './layout.js';
import { buildWaterField, waterField, cellWater, bodyKind, BODY_RANGES } from './water.js';
import { DEFAULT_MARKER } from './edible-style.js';
const FORMAT = 'arcade-world';
const VERSION = 3;
// edgeForest (contracts/world-format-sketch-map.md §1): the border ring whose cells are the only source of
// danger odour; a rendering-only patch kind otherwise, like meadow/darkGrass/cobble/gravel. swamp
// (contracts/world-format-sketch-map.md §6, BUG-001): wet ground joining two water bodies, also
// rendering-only.
const SURFACE_KINDS = ['meadow', 'darkGrass', 'cobble', 'gravel', 'edgeForest', 'swamp'];
const GROVE_MIN = 4;
const GROVE_MAX = 12;
const MAX_SPRITE_SIDE = 32;
const SEED_MAX = 4294967295;
const BRAIN_VERSIONS = ['mock', 'v0', 'v1', 'v2', 'v3'];
// v2 and v3 both run the wide-I/O interface generation (flies.body.sites, flies.stimuli, flies.body.escape);
// v3 additionally needs flies.brain.decoder, flies.body.locomotion/backup (contracts/world-config-v3.md).
const WIDE_IO_VERSIONS = ['v2', 'v3'];
// flies.stimuli[sense].from (contracts/world-config-wide-io.md, contracts/stimuli-field-sources.md): "edibles"/
// "dangers" sample a world object list; "blocked" (touch) reads world walkability directly, with no object list;
// "water"/"forestEdge" read the heat/danger field (contracts/world-format-sketch-map.md §3) at the channel's site.
// "events" (contracts/world-config-v3-learning.md, ADR 011): a world-event stimulus, read from the fly's own
// body state and the food table, never from another fly.
const STIMULUS_SOURCES = ['edibles', 'dangers', 'blocked', 'water', 'forestEdge', 'events'];
// edibles[i].scent (contracts/world-config-v3-learning.md, ADR 011): orthogonal to kind (size/capacity).
const SCENTS = ['fruit', 'floral'];
// kinds/scaleBy/radius are meaningless once the field itself fixes the falloff shape (contracts/stimuli-field-sources.md §2).
const FIELD_ONLY_SOURCES = ['water', 'forestEdge'];
// flies.stimuli[s].events (contracts/world-config-v3-learning.md): fixed names, plus "eat:<scent>" for each
// declared scent.
const EVENT_NAMES = ['eat', 'escape', 'heatContact'];
function isValidEvent(name) {
  if (EVENT_NAMES.includes(name)) return true;
  const m = /^eat:(.+)$/.exec(name);
  return m !== null && SCENTS.includes(m[1]);
}

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

  // A sketch map (contracts/world-format-sketch-map.md §7, BUG-002) replaces the tile sections; its water is checked
  // against the food in validateArt, once the catalogue is loaded, so here no cell is water yet.
  const water = config.map !== undefined
    ? validateMap(config, err)
    : validateTileSections(config, { cols, rows, inGrid }, err);

  // Food is one or more units per size class, every class present (spec 009 FR-001, BUG-001). Each names its
  // sprite (contract §2). Several units of the same kind MAY be placed near each other (FR-020).
  const edibles = validateList(config.edibles, 'edibles', err);
  edibles.forEach((e, i) => {
    validateSpot(e, `edibles[${i}]`, EDIBLE_KINDS, 'edible', inGrid, water, cols, err);
    if (!isText(e?.sprite)) err(`edibles[${i}].sprite`, 'is required: the food sprite for this kind');
    if (e?.scent !== undefined && !SCENTS.includes(e.scent)) {
      err(`edibles[${i}].scent`, 'must be "fruit" or "floral"');
    }
  });
  if (!EDIBLE_KINDS.every((k) => edibles.some((e) => e?.kind === k))) {
    err('edibles', `must hold at least one unit of each kind: ${EDIBLE_KINDS.join(', ')}`);
  }
  validateList(config.dangers, 'dangers', err).forEach((d, i) => {
    validateSpot(d, `dangers[${i}]`, DANGER_KINDS, 'danger', inGrid, water, cols, err);
  });
  validateEdibleStyle(config, err);

  if (config.flies !== undefined) validateFlies(config.flies, config, err);

  return errors;
}

// The tile sections of a world without a sketch map: ground, waterBodies, objects, groves, scatter.
// Returns the logic water mask.
function validateTileSections(config, { cols, rows, inGrid }, err) {
  const groundAreas = validateList(config.ground, 'ground', err);
  groundAreas.forEach((area, i) => {
    const path = `ground[${i}]`;
    checkId(area, path, err);
    if (!SURFACE_KINDS.includes(area?.kind)) err(`${path}.kind`, `must be one of ${SURFACE_KINDS.join(', ')}`);
    validateOutline(area?.outline, `${path}.outline`, err);
  });
  // The edge of the world is a deep forest (spec US2, contracts/world-format-sketch-map.md §1): at least one
  // edgeForest area's rasterised cells must touch every side of the grid.
  if (!edgeForestTouchesEveryside(groundAreas, cols, rows)) {
    err('ground', 'must include an edgeForest area touching every side of the map');
  }

  const bodies = validateList(config.waterBodies, 'waterBodies', err);
  const validBodies = [];
  bodies.forEach((body, i) => {
    const path = `waterBodies[${i}]`;
    checkId(body, path, err);
    const outlineKind = validateWaterOutline(body?.outline, `${path}.outline`, err);
    if (!outlineKind) return;
    // Every shore is the grass shore style (BUG-002), so a per-body choice is refused.
    if (body.shore !== undefined) err(`${path}.shore`, 'is not used; every shore is the grass shore style (remove this field)');
    // Rivers aren't pond/lake range-checked (contracts/world-format-sketch-map.md §6, BUG-001) — only a
    // blob's size/shape is constrained to the art pack's pond/lake ranges.
    if (outlineKind === 'blob' && bodyKind(body.outline.blob) === null) {
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

  return water;
}

// The sketch map section (contracts/world-format-sketch-map.md §7). Structure only: sprite references are checked
// in validateArt. Returns an all-land mask (the plan needs the catalogue; validateArt checks food against water).
const MAP_TILE_SECTIONS = ['ground', 'waterBodies', 'objects', 'groves', 'scatter'];
const MAP_BODY_KINDS = ['blob', 'island', 'river'];
function validateMap(config, err) {
  const map = config.map;
  const { cols, rows } = config.grid;
  for (const key of MAP_TILE_SECTIONS) {
    if (config[key] !== undefined) err(key, 'is replaced by "map"; a world has either a sketch map or tile sections');
  }
  if (!isObject(map)) {
    err('map', 'must be an object');
    return new Uint8Array(cols * rows);
  }
  const nums = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
  const refs = (v, path) => {
    if (!Array.isArray(v) || v.length === 0 || !v.every(isText)) err(path, 'must be a non-empty list of sprite names ("sheet/name")');
  };
  const list = (v, path) => validateList(v, path, err);
  if (!nums(map.reference, 2) || !(map.reference[0] > 0 && map.reference[1] > 0)) {
    err('map.reference', 'must be [width, height] of the sketch in px');
  }
  if (map.seed !== undefined && !isInt(map.seed, 1, SEED_MAX)) err('map.seed', `must be an integer from 1 to ${SEED_MAX}`);

  if (!isObject(map.water)) err('map.water', 'must be an object with seed, density and bodies');
  else {
    if (!isInt(map.water.seed, 0, SEED_MAX)) err('map.water.seed', `must be an integer from 0 to ${SEED_MAX}`);
    if (!(isNum(map.water.density) && map.water.density >= 0)) err('map.water.density', 'must be a number of at least 0');
    list(map.water.bodies, 'map.water.bodies').forEach((b, i) => {
      const path = `map.water.bodies[${i}]`;
      if (!MAP_BODY_KINDS.includes(b?.kind)) return err(`${path}.kind`, `must be one of ${MAP_BODY_KINDS.join(', ')}`);
      if (b.kind === 'river') {
        const ok = Array.isArray(b.path) && b.path.length >= 2 && b.path.every((p) => nums(p, 2)) && nums(b.width, 2);
        if (!ok) err(path, 'a river needs path [[x, y], …] (2 or more points) and width [from, to]');
      } else if (!(isNum(b.x) && isNum(b.y) && b.rx > 0 && b.ry > 0)) {
        err(path, 'a blob or island needs numeric x and y and positive rx and ry');
      }
    });
  }

  const grounds = list(map.grounds, 'map.grounds');
  const names = new Set();
  grounds.forEach((g, i) => {
    const path = `map.grounds[${i}]`;
    if (!isText(g?.name)) err(`${path}.name`, 'must be a non-empty string');
    else if (names.has(g.name)) err(`${path}.name`, `"${g.name}" is used twice`);
    else names.add(g.name);
    if (!isText(g?.tex)) err(`${path}.tex`, 'must be a sprite name ("sheet/name")');
    if (!Array.isArray(g?.blobs) || g.blobs.length === 0 || !g.blobs.every((b) => nums(b, 4) && b[2] > 0 && b[3] > 0)) {
      err(`${path}.blobs`, 'must be a non-empty list of [x, y, rx, ry] ellipses');
    }
  });
  const area = (name, path) => {
    if (!names.has(name)) err(path, `must name a map ground area (${[...names].join(', ')})`);
  };
  if (map.beach !== undefined) area(map.beach, 'map.beach');
  list(map.decals, 'map.decals').forEach((d, i) => {
    const path = `map.decals[${i}]`;
    area(d?.area, `${path}.area`);
    refs(d?.sprites, `${path}.sprites`);
    if (!isInt(d?.max, 0, 10000) || !isNum(d?.inset) || !isNum(d?.waterMargin)) err(path, 'needs integer max and numeric inset and waterMargin');
  });

  if (!isObject(map.roads)) err('map.roads', 'must be an object with texture, textureRows, worn and paths');
  else {
    if (!isText(map.roads.texture) || !isText(map.roads.worn)) err('map.roads', 'texture and worn must be sprite names');
    if (!isInt(map.roads.textureRows, 1, 1024)) err('map.roads.textureRows', 'must be a positive integer');
    list(map.roads.paths, 'map.roads.paths').forEach((r, i) => {
      if (!(isNum(r?.w) && r.w > 0) || !Array.isArray(r?.pts) || r.pts.length < 2 || !r.pts.every((p) => nums(p, 2))) {
        err(`map.roads.paths[${i}]`, 'needs a positive width w and pts [[x, y], …] (2 or more points)');
      }
    });
  }

  const B = map.border;
  if (!isObject(B) || !['left', 'right', 'top', 'bottom', 'rag', 'step', 'fill'].every((k) => isNum(B[k]))
    || !(B.step > 0) || !(B.fill >= 0 && B.fill <= 1)) {
    err('map.border', 'needs numeric left, right, top, bottom, rag, a positive step and a fill from 0 to 1');
  } else {
    list(B.gaps, 'map.border.gaps').forEach((g, i) => {
      if (!(Array.isArray(g) && g.length === 3 && isNum(g[0]) && isNum(g[1]) && ['top', 'bottom'].includes(g[2]))) {
        err(`map.border.gaps[${i}]`, 'must be [from x, to x, "top" | "bottom"]');
      }
    });
    // Dead edge forest (contracts/world-format-sketch-map.md §7): the named area, a non-empty list of dead tree
    // sprites, and the blend distance in reference px over which the live forest fades into the dead one.
    if (B.dead !== undefined) {
      const named = (map.grounds ?? []).some((g) => g?.name === B.dead?.area);
      if (!named) err('map.border.dead.area', 'must name a map.grounds entry');
      if (!Array.isArray(B.dead?.trees) || B.dead.trees.length === 0 || !B.dead.trees.every(isText)) {
        err('map.border.dead.trees', 'must be a non-empty list of sprite names ("sheet/name")');
      }
      if (!(isNum(B.dead?.blend) && B.dead.blend > 0)) err('map.border.dead.blend', 'must be a positive number of reference px');
      if (B.dead?.density !== undefined && !(isNum(B.dead.density) && B.dead.density >= 0 && B.dead.density <= 1)) {
        err('map.border.dead.density', 'must be a number from 0 to 1 (the chance of a dead tree inside the area)');
      }
    }
  }
  refs(map.trees, 'map.trees');
  refs(map.peaks, 'map.peaks');
  list(map.groves, 'map.groves').forEach((g, i) => {
    if (!(isNum(g?.x) && isNum(g?.y) && g.rx > 0 && g.ry > 0)) err(`map.groves[${i}]`, 'needs numeric x and y and positive rx and ry');
  });
  list(map.mountains, 'map.mountains').forEach((m, i) => {
    if (!(isNum(m?.x) && isNum(m?.y) && m.rx > 0 && m.ry > 0 && isInt(m.n, 0, 1000))) {
      err(`map.mountains[${i}]`, 'needs numeric x and y, positive rx and ry and an integer count n');
    }
  });
  list(map.keepOut, 'map.keepOut').forEach((b, i) => {
    if (!nums(b, 4)) err(`map.keepOut[${i}]`, 'must be a box [x0, y0, x1, y1]');
  });
  list(map.objects, 'map.objects').forEach((o, i) => {
    if (!(Array.isArray(o) && o.length === 3 && isText(o[0]) && isNum(o[1]) && isNum(o[2]))) {
      err(`map.objects[${i}]`, 'must be ["sheet/name", x, y]');
    }
  });
  list(map.areaScatter, 'map.areaScatter').forEach((a, i) => {
    const path = `map.areaScatter[${i}]`;
    area(a?.area, `${path}.area`);
    refs(a?.sprites, `${path}.sprites`);
    if (!isInt(a?.max, 0, 10000) || !isNum(a?.spacing) || !isNum(a?.waterMargin)) err(path, 'needs integer max and numeric spacing and waterMargin');
  });
  const M = map.meadow;
  if (!isObject(M) || !isInt(M.tries, 0, 100000) || !isInt(M.max, 0, 10000) || !isNum(M.spacing) || !nums(M.box, 4)
    || !Array.isArray(M.mix) || M.mix.length === 0) {
    err('map.meadow', 'needs integer tries and max, numeric spacing, a box [x0, y0, x1, y1] and a mix');
  } else {
    M.mix.forEach((m, i) => {
      if (!(Array.isArray(m) && m.length === 2 && isNum(m[0]))) return err(`map.meadow.mix[${i}]`, 'must be [share, ["sheet/name", …]]');
      refs(m[1], `map.meadow.mix[${i}][1]`);
    });
  }
  if (!isObject(map.finish) || !['warm', 'glow', 'vignette'].every((k) => isText(map.finish[k]))) {
    err('map.finish', 'needs warm, glow and vignette colours');
  }
  return new Uint8Array(cols * rows);
}

// Every sprite reference of a sketch map, as [ref, path] (contracts/world-format-sketch-map.md §7).
function mapRefs(map) {
  const out = [];
  const each = (v, path) => (Array.isArray(v) ? v : []).forEach((r, i) => out.push([r, `${path}[${i}]`]));
  (map.grounds ?? []).forEach((g, i) => {
    out.push([g?.tex, `map.grounds[${i}].tex`]);
    if (g?.tex2 !== undefined) out.push([g.tex2, `map.grounds[${i}].tex2`]);
  });
  (map.decals ?? []).forEach((d, i) => each(d?.sprites, `map.decals[${i}].sprites`));
  out.push([map.roads?.texture, 'map.roads.texture'], [map.roads?.worn, 'map.roads.worn']);
  each(map.trees, 'map.trees');
  each(map.border?.dead?.trees, 'map.border.dead.trees');
  each(map.peaks, 'map.peaks');
  (map.objects ?? []).forEach((o, i) => out.push([Array.isArray(o) ? o[0] : undefined, `map.objects[${i}]`]));
  (map.areaScatter ?? []).forEach((a, i) => each(a?.sprites, `map.areaScatter[${i}].sprites`));
  (map.meadow?.mix ?? []).forEach((m, i) => each(Array.isArray(m) ? m[1] : undefined, `map.meadow.mix[${i}][1]`));
  return out;
}

// Art references against the catalogue. catalog is from indexCatalog.
// edibleStyle (edible-style.js): optional. Marker keys are "default" or a ground area name, each with a sprite and a
// positive width in px; scale keys are edible kinds with a factor from 0.25 to 4. Sprites resolve in validateArt.
function validateEdibleStyle(config, err) {
  const st = config.edibleStyle;
  if (st === undefined) return;
  if (!isObject(st)) return err('edibleStyle', 'must be an object with marker and scale');
  const areas = new Set([DEFAULT_MARKER, ...(config.map?.grounds ?? []).map((g) => g?.name), ...(config.ground ?? []).map((g) => g?.name)]);
  for (const [area, m] of Object.entries(st.marker ?? {})) {
    if (!areas.has(area)) err(`edibleStyle.marker.${area}`, `must be "${DEFAULT_MARKER}" or a ground area name`);
    if (!isObject(m) || !isText(m.sprite)) err(`edibleStyle.marker.${area}.sprite`, 'must be a sprite name ("sheet/name")');
    if (!(isNum(m?.width) && m.width > 0)) err(`edibleStyle.marker.${area}.width`, 'must be a positive width in px');
  }
  for (const [kind, f] of Object.entries(st.scale ?? {})) {
    if (!EDIBLE_KINDS.includes(kind)) err(`edibleStyle.scale.${kind}`, `must be one of ${EDIBLE_KINDS.join(', ')}`);
    if (!(isNum(f) && f >= 0.25 && f <= 4)) err(`edibleStyle.scale.${kind}`, 'must be a factor from 0.25 to 4');
  }
}

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

  for (const [area, m] of Object.entries(config.edibleStyle?.marker ?? {})) check(m?.sprite, `edibleStyle.marker.${area}`);
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

  // A sketch map: every reference resolves and none is food or removed art; then, with the plan built, food and
  // dangers must sit on land (the same check validateConfig makes for tile worlds).
  if (isObject(config.map)) {
    for (const [ref, path] of mapRefs(config.map)) {
      if (!isText(ref)) errors.push({ path, message: 'must be a sprite name ("sheet/name")' });
      else checkScatter(ref, path);
    }
    // The plan resolves every sprite, so it is built only once every reference (food art included) has resolved.
    if (errors.length === 0) {
      const { cols } = config.grid;
      const { water } = buildLogic(config, catalog);
      const onWater = (list, role) => (list ?? []).forEach((o, i) => {
        if (isNum(o?.x) && isNum(o?.y) && water[cellIndex(o.x, o.y, cols)]) {
          errors.push({ path: `${role}s[${i}]`, message: `is on water; ${role}s must sit on land` });
        }
      });
      onWater(config.edibles, 'edible');
      onWater(config.dangers, 'danger');
    }
  }
  return errors;
}

// True when the union of every edgeForest area's rasterised cells touches row 0, row rows-1, column 0 and
// column cols-1 (contracts/world-format-sketch-map.md §1). Invalid areas (bad outline) are skipped; a bad
// outline is already reported by the ground-area validation loop.
function edgeForestTouchesEveryside(groundAreas, cols, rows) {
  const sides = { top: false, bottom: false, left: false, right: false };
  for (const area of groundAreas) {
    if (area?.kind !== 'edgeForest') continue;
    if (!isObject(area.outline) || (!isObject(area.outline.ellipse) && !Array.isArray(area.outline.polygon))) continue;
    const mask = rasterizeOutline(area.outline, cols, rows);
    for (let x = 0; x < cols; x++) {
      if (mask[x]) sides.top = true;
      if (mask[(rows - 1) * cols + x]) sides.bottom = true;
    }
    for (let y = 0; y < rows; y++) {
      if (mask[y * cols]) sides.left = true;
      if (mask[y * cols + cols - 1]) sides.right = true;
    }
  }
  return sides.top && sides.bottom && sides.left && sides.right;
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
  // An image sprite names a PNG under the assets root (public/assets/) and carries no pixel grid (render/sprites.js).
  if (isObject(sprite) && 'image' in sprite) {
    if (!isText(sprite.image) || !sprite.image.endsWith('.png')) err(`${path}.image`, 'must be the path of a .png file');
    if (sprite.size !== undefined && !isInt(sprite.size, 1, 512)) err(`${path}.size`, 'must be an integer from 1 to 512 (px)');
    return;
  }
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

// A water body outline is a wobbly ellipse (FR-028, BUG-002) or a winding river path (BUG-001,
// contracts/world-format-sketch-map.md §6), in cells. Returns 'blob', 'river', or false when invalid.
function validateWaterOutline(outline, path, err) {
  const b = isObject(outline) ? outline.blob : undefined;
  if (isObject(b)) {
    const ok = isNum(b.cx) && isNum(b.cy) && isNum(b.rx) && b.rx > 0 && isNum(b.ry) && b.ry > 0
      && isNum(b.wobble) && b.wobble >= 0 && isInt(b.harmonics, 1, 12);
    if (!ok) err(path, 'blob needs numeric cx and cy, positive rx and ry, a wobble of 0 or more and 1 to 12 harmonics');
    return ok ? 'blob' : false;
  }
  const r = isObject(outline) ? outline.river : undefined;
  if (isObject(r)) {
    const pathOk = Array.isArray(r.path) && r.path.length >= 2
      && r.path.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]));
    const widthOk = Array.isArray(r.width) && r.width.length === 2 && r.width.every((w) => isNum(w) && w > 0);
    const noiseOk = r.widthNoise === undefined || (isNum(r.widthNoise) && r.widthNoise >= 0);
    const ok = pathOk && widthOk && noiseOk;
    if (!ok) err(path, 'river needs a path of at least 2 [x, y] points and a width of [w0, w1], both positive');
    return ok ? 'river' : false;
  }
  err(path, 'must be {"blob": {"cx", "cy", "rx", "ry", "wobble", "harmonics"}} or {"river": {"path", "width"}}; ellipse and polygon water is no longer drawn');
  return false;
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
  // flies.heatQuiet (heat-field.js): ground areas the heat ring does not reach. Needs a sketch map, which names them.
  if (flies.heatQuiet !== undefined) {
    const grounds = new Set((config.map?.grounds ?? []).map((g) => g?.name));
    if (!Array.isArray(flies.heatQuiet) || !flies.heatQuiet.every((n) => grounds.has(n))) {
      err('flies.heatQuiet', 'must be a list of ground area names from map.grounds');
    }
  }

  if (flies.sprite === undefined) err('flies.sprite', 'is required');
  else if (!hasSprite(flies.sprite)) err('flies.sprite', `unknown sprite "${flies.sprite}"`);
  if (flies.baselineSprite !== undefined && !hasSprite(flies.baselineSprite)) {
    err('flies.baselineSprite', `unknown sprite "${flies.baselineSprite}"`);
  }
  // Per-fly sex (contracts/fly-sprite.md §2, BUG-002): picks the fly-female/fly-male (and baseline) pair per
  // fly instead of the one fly.sprite/baselineSprite pair. Declared in data (constitution VI), not chosen in code.
  if (flies.sex !== undefined) validateFlySex(flies.sex, flies.count ?? 6, hasSprite, err);

  // The brain version is resolved early (duplicating validateFlyBrain's own inference): flies.body.sites,
  // flies.stimuli and flies.body.escape (contracts/world-config-wide-io.md) are all gated on it being "v2".
  const brainVersionGuess = BRAIN_VERSIONS.includes(flies.brain?.version) ? flies.brain.version
    : (flies.brain?.snapshot !== undefined ? 'v0' : 'mock');

  validateFlyBody(flies.body, err, brainVersionGuess);
  validateFlyFood(flies.food, err);
  // v2/v3 sense generically from flies.stimuli (contracts/world-config-wide-io.md), not the old singular
  // flies.stimulus (v0/v1's antenna gain/max/resting/radius), so the two are mutually exclusive by version.
  if (WIDE_IO_VERSIONS.includes(brainVersionGuess)) validateFlyStimuliWide(flies.stimuli, err);
  else validateFlyStimulus(flies.stimulus, edible, err);

  // flies.modulators.hunger.threshold (D32, contracts/world-config-v3.md): a world-config override, optional
  // for every version (absent keeps today's linear gain curve, research.md §6).
  validateModulatorsHunger(flies.modulators, err);

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

function validateFlyBody(body, err, version) {
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

  // flies.body.sites (v2/v3; contracts/world-config-wide-io.md).
  if (WIDE_IO_VERSIONS.includes(version)) validateBodySites(body.sites, err);

  // flies.body.escape (v2/v3; contracts/world-config-wide-io.md). Present under any other version is refused.
  if (body.escape !== undefined && !WIDE_IO_VERSIONS.includes(version)) {
    err('flies.body.escape', 'is only for version "v2" or "v3"');
  } else if (WIDE_IO_VERSIONS.includes(version)) {
    validateFlyEscape(body.escape, err);
  }

  // flies.body.locomotion/backup (v3 only, required; contracts/world-config-v3.md).
  if (body.locomotion !== undefined && version !== 'v3') {
    err('flies.body.locomotion', 'cannot be set for version "' + version + '"');
  } else if (version === 'v3') {
    if (body.locomotion === undefined) err('flies.body.locomotion', 'is required for version "v3"');
    else validateBodyLocomotion(body.locomotion, err);
  }
  // flies.body.motor (v3 only, optional; contracts/world-config-v3.md, spec 017 BUG-004).
  if (body.motor !== undefined && version !== 'v3') {
    err('flies.body.motor', 'cannot be set for version "' + version + '"');
  } else if (body.motor !== undefined) {
    validateBodyMotor(body.motor, err);
  }
  // flies.body.crossWater (v3 only, optional; contracts/world-config-v3.md, spec 017 BUG-003).
  if (body.crossWater !== undefined && version !== 'v3') {
    err('flies.body.crossWater', 'cannot be set for version "' + version + '"');
  } else if (body.crossWater !== undefined && typeof body.crossWater !== 'boolean') {
    err('flies.body.crossWater', 'must be true or false');
  }
  if (body.backup !== undefined && version !== 'v3') {
    err('flies.body.backup', 'cannot be set for version "' + version + '"');
  } else if (version === 'v3') {
    if (body.backup === undefined) err('flies.body.backup', 'is required for version "v3"');
    else validateBodyBackup(body.backup, err);
  }
}

// flies.body.locomotion (v3 only, required; contracts/world-config-v3.md, W12/W13).
function validateBodyLocomotion(locomotion, err) {
  if (!isObject(locomotion)) {
    err('flies.body.locomotion', 'must be an object');
    return;
  }
  const path = (key) => `flies.body.locomotion.${key}`;
  if (!(isNum(locomotion.baseSpeed) && locomotion.baseSpeed > 0)) err(path('baseSpeed'), 'must be a number greater than 0');
  if (!(isNum(locomotion.speedGain) && locomotion.speedGain >= 0)) err(path('speedGain'), 'must be a number of 0 or more');
  if (!(isNum(locomotion.maxSpeed) && locomotion.maxSpeed > 0)) err(path('maxSpeed'), 'must be a number greater than 0');
  if (!(isNum(locomotion.surgeGain) && locomotion.surgeGain >= 0)) err(path('surgeGain'), 'must be a number of 0 or more');
  if (!(isNum(locomotion.wander) && locomotion.wander >= 0)) err(path('wander'), 'must be a number of 0 or more');
  if (!(isNum(locomotion.turnGain) && locomotion.turnGain >= 0)) err(path('turnGain'), 'must be a number of 0 or more');
  if (!(isNum(locomotion.castGain) && locomotion.castGain >= 0)) err(path('castGain'), 'must be a number of 0 or more');
  const castMinOk = isNum(locomotion.castMin) && locomotion.castMin >= 0;
  const castMaxOk = isNum(locomotion.castMax) && locomotion.castMax >= 0;
  if (!castMinOk) err(path('castMin'), 'must be a number of 0 or more');
  if (!castMaxOk) err(path('castMax'), 'must be a number of 0 or more');
  if (castMinOk && castMaxOk && locomotion.castMin > locomotion.castMax) {
    err(path('castMin'), 'must be at most castMax');
  }
}

// flies.body.motor (v3 only, optional; spec 017 BUG-004): every key required, each a number greater than 0.
function validateBodyMotor(motor, err) {
  if (!isObject(motor)) {
    err('flies.body.motor', 'must be an object');
    return;
  }
  for (const key of ['maxTurnRate', 'escapeTurnRate', 'maxAccel', 'sprintSpeed']) {
    if (!(isNum(motor[key]) && motor[key] > 0)) err(`flies.body.motor.${key}`, 'must be a number greater than 0');
  }
}

// flies.body.backup (v3 only, required; contracts/world-config-v3.md, W14).
function validateBodyBackup(backup, err) {
  if (!isObject(backup)) {
    err('flies.body.backup', 'must be an object');
    return;
  }
  if (!(isNum(backup.threshold) && backup.threshold >= 0 && backup.threshold <= 1)) {
    err('flies.body.backup.threshold', 'must be a number from 0 to 1');
  }
  if (!isInt(backup.ticks, 1, 100000)) err('flies.body.backup.ticks', 'must be a positive integer');
}

// flies.modulators.hunger.threshold (D32, contracts/world-config-v3.md): optional for every version.
function validateModulatorsHunger(modulators, err) {
  if (modulators === undefined) return;
  if (!isObject(modulators)) {
    err('flies.modulators', 'must be an object');
    return;
  }
  // Each key is a snapshot modulator id ("hunger", "hunger-taste"). Whether the snapshot declares it is a runtime
  // check (fly-brain-v1.js); the snapshot is not known here.
  for (const [id, mod] of Object.entries(modulators)) {
    if (!isObject(mod)) {
      err(`flies.modulators.${id}`, 'must be an object');
      continue;
    }
    if (mod.threshold !== undefined && id !== 'hunger') {
      err(`flies.modulators.${id}.threshold`, 'is only for "hunger" (the hunger signal itself)');
    } else if (mod.threshold !== undefined && !(isNum(mod.threshold) && mod.threshold >= 0 && mod.threshold < 1)) {
      err('flies.modulators.hunger.threshold', 'must be a number from 0 to less than 1');
    }
    // D32: [gainMin, gainMax] replaces the snapshot's gain for this modulator, without re-extraction.
    if (mod.gain !== undefined) {
      const ok = Array.isArray(mod.gain) && mod.gain.length === 2 && mod.gain.every((g) => isNum(g) && g >= 0)
        && mod.gain[0] <= mod.gain[1];
      if (!ok) err(`flies.modulators.${id}.gain`, 'must be [gainMin, gainMax], numbers of 0 or more, gainMin ≤ gainMax');
    }
  }
}

// flies.stimuli (v2 only; contracts/world-config-wide-io.md): one entry per sense a forager-wide snapshot
// declares. Shape only is checked here; "missing sense declared by a channel" is a runtime check at snapshot
// load (the snapshot's declaration is not known at static world-config validation time).
function validateFlyStimuliWide(stimuli, err) {
  if (!isObject(stimuli)) {
    err('flies.stimuli', 'must be an object');
    return;
  }
  for (const [sense, spec] of Object.entries(stimuli)) {
    const path = `flies.stimuli.${sense}`;
    if (!isObject(spec)) {
      err(path, 'must be an object with from');
      continue;
    }
    if (!STIMULUS_SOURCES.includes(spec.from)) {
      err(`${path}.from`, `must be one of ${STIMULUS_SOURCES.map((s) => `"${s}"`).join(', ')}`);
    }
    if (spec.kinds !== undefined && !(Array.isArray(spec.kinds) && spec.kinds.length > 0 && spec.kinds.every(isText))) {
      err(`${path}.kinds`, 'must be a non-empty list of strings');
    }
    // scents (contracts/world-config-v3-learning.md, ADR 011): with from:"edibles", restricts the field to
    // flowers of the listed scent(s) (W15 normalisation unchanged).
    if (spec.scents !== undefined && !(Array.isArray(spec.scents) && spec.scents.length > 0 && spec.scents.every((s) => SCENTS.includes(s)))) {
      err(`${path}.scents`, `must be a non-empty list of ${SCENTS.map((s) => `"${s}"`).join(', ')}`);
    }
    if (spec.scaleBy !== undefined && spec.scaleBy !== 'stock') err(`${path}.scaleBy`, 'must be "stock"');
    if (spec.radius !== undefined && !(isNum(spec.radius) && spec.radius > 0)) {
      err(`${path}.radius`, 'must be a number greater than 0');
    }
    if (spec.contact !== undefined && typeof spec.contact !== 'boolean') err(`${path}.contact`, 'must be true or false');
    // Sensory filters (spec 017 BUG-003; ADR 010 Part L "declared stimulus contrast gain, off by default").
    if (spec.interpolate !== undefined && typeof spec.interpolate !== 'boolean') err(`${path}.interpolate`, 'must be true or false');
    if (spec.contrast !== undefined) {
      const c = spec.contrast;
      const ok = isObject(c) && isNum(c.common) && c.common >= 0 && isNum(c.gain) && c.gain >= 0;
      if (!ok) err(`${path}.contrast`, 'must be { common, gain }, numbers of 0 or more');
    }
    // The field already fixes the falloff shape (contracts/stimuli-field-sources.md §2); per-world tuning is refused.
    if (FIELD_ONLY_SOURCES.includes(spec.from)) {
      for (const key of ['kinds', 'scaleBy', 'radius']) {
        if (spec[key] !== undefined) err(path, `must not set ${key} when from is "${spec.from}"`);
      }
    }
    // from: "events" (contracts/world-config-v3-learning.md, ADR 011): a declared reinforcement pair, driven by
    // world events rather than a position/field sample.
    if (spec.from === 'events') {
      if (!(Array.isArray(spec.events) && spec.events.length > 0)) {
        err(`${path}.events`, 'must be a non-empty list of event names');
      } else {
        for (const name of spec.events) {
          if (!isValidEvent(name)) err(`${path}.events`, `unknown event "${name}"`);
        }
      }
      if (spec.pulseTicks !== undefined && !isInt(spec.pulseTicks, 1, 100000)) {
        err(`${path}.pulseTicks`, 'must be a positive integer');
      }
    }
  }
}

// flies.body.sites (v2 only; contracts/world-config-wide-io.md): one entry per body site a forager-wide
// snapshot declares, each a forward/lateral offset in tiles (ADR 007 W9).
function validateBodySites(sites, err) {
  if (!isObject(sites)) {
    err('flies.body.sites', 'must be an object');
    return;
  }
  for (const [site, spec] of Object.entries(sites)) {
    const path = `flies.body.sites.${site}`;
    if (!isObject(spec)) {
      err(path, 'must be an object with forward and lateral');
      continue;
    }
    if (!isNum(spec.forward)) err(`${path}.forward`, 'must be a number');
    if (!isNum(spec.lateral)) err(`${path}.lateral`, 'must be a number');
  }
}

// flies.body.escape (v2 only; contracts/world-config-wide-io.md): off by default (ADR 007 D17/W10).
function validateFlyEscape(escape, err) {
  if (escape === undefined) return;
  if (!isObject(escape)) {
    err('flies.body.escape', 'must be an object');
    return;
  }
  if (escape.enabled !== undefined && typeof escape.enabled !== 'boolean') {
    err('flies.body.escape.enabled', 'must be true or false');
  }
  if (escape.threshold !== undefined && !(isNum(escape.threshold) && escape.threshold >= 0 && escape.threshold <= 1)) {
    err('flies.body.escape.threshold', 'must be a number from 0 to 1');
  }
  if (escape.distance !== undefined && !(isNum(escape.distance) && escape.distance > 0)) {
    err('flies.body.escape.distance', 'must be a number greater than 0');
  }
  if (escape.cooldown !== undefined && !(isNum(escape.cooldown) && escape.cooldown > 0)) {
    err('flies.body.escape.cooldown', 'must be a number greater than 0');
  }
  // escape.tau (spec 017 BUG-003): ticks the decoded alarm is integrated over before the threshold; 1 is none.
  if (escape.tau !== undefined && !(isNum(escape.tau) && escape.tau >= 1)) {
    err('flies.body.escape.tau', 'must be a number of 1 or more');
  }
  // escape.turn (spec 017 BUG-005): the escape turn range, radians, used when the side of the threat is unknown.
  if (escape.turn !== undefined) {
    const t = escape.turn;
    const ok = isObject(t) && isNum(t.min) && isNum(t.max) && t.min >= 0 && t.min <= t.max && t.max <= Math.PI;
    if (!ok) err('flies.body.escape.turn', 'must be { min, max } in radians, 0 ≤ min ≤ max ≤ π');
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
  // feedTau (ADR 011 D53): ticks the decoded feed drive is integrated over before feedThreshold; 1 is none (v3).
  check('feedTau', (v) => isNum(v) && v >= 1, 'must be a number of 1 or more');
  check('stock', (v) => isNum(v) && v > 0, 'must be a number greater than 0');
  check('consumeRate', (v) => isNum(v) && v >= 0, 'must be a number of 0 or more');
  check('regrowth', (v) => isNum(v) && v >= 0, 'must be a number of 0 or more');
  check('sated', (v) => isNum(v) && v >= 0 && v <= 1, 'must be a number from 0 to 1');
  // Eating area (spec 017 BUG-002): Chebyshev radius, in cells, around a flower's cell.
  check('reach', (v) => Number.isInteger(v) && v >= 0 && v <= 3, 'must be a whole number from 0 to 3');
  // ADR 011: off by default (unlimited resources — eating never lowers a flower's stock). On: the existing
  // consumeRate/regrowth/capacity mechanics apply unchanged.
  check('consumption', (v) => typeof v === 'boolean', 'must be true or false');
  // Spec 018 (contracts/world-config-food-feeding.md): hunger-sensitive feeding and food depletion, all optional.
  validateHungerSensitivity(food.hungerSensitivity, err);
  check('feedMotion', (v) => v === 'pause' || v === 'slow', 'must be "pause" or "slow"');
  if (food.feedMotion === 'slow' && food.feedSlowSpeed === undefined) {
    err('flies.food.feedSlowSpeed', 'is required when flies.food.feedMotion is "slow"');
  }
  check('feedSlowSpeed', (v) => isNum(v) && v >= 0, 'must be a number of 0 or more');
  validateFoodCapacity(food.capacity, food.recovery, err);
}

// Spec 018 US1: the hunger at or above which food odour is sensed more strongly, and by how much (>= 1).
function validateHungerSensitivity(hs, err) {
  if (hs === undefined) return;
  if (!isObject(hs)) {
    err('flies.food.hungerSensitivity', 'must be an object with threshold and gain');
    return;
  }
  if (!(isNum(hs.threshold) && hs.threshold >= 0 && hs.threshold < 1)) {
    err('flies.food.hungerSensitivity.threshold', 'must be a number from 0 to less than 1');
  }
  if (!(isNum(hs.gain) && hs.gain >= 1)) err('flies.food.hungerSensitivity.gain', 'must be a number of 1 or more');
}

// Spec 018 US2: completed feedings per resource kind (exactly small, medium and large), and the recovery delay,
// which only has a meaning for the capacity model.
const FOOD_KINDS = ['small', 'medium', 'large'];
function validateFoodCapacity(capacity, recovery, err) {
  if (capacity !== undefined) {
    const ok = isObject(capacity)
      && Object.keys(capacity).every((k) => FOOD_KINDS.includes(k))
      && FOOD_KINDS.every((k) => Number.isInteger(capacity[k]) && capacity[k] >= 1);
    if (!ok) err('flies.food.capacity', 'must have "small", "medium" and "large", each a positive integer');
  }
  if (recovery !== undefined) {
    if (!(isNum(recovery) && recovery >= 0)) err('flies.food.recovery', 'must be a number of 0 or more');
    else if (capacity === undefined) err('flies.food.recovery', 'is only valid when flies.food.capacity is set');
  }
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
    err('flies.brain.version', 'must be "mock", "v0", "v1", "v2" or "v3"');
  }
  const version = BRAIN_VERSIONS.includes(brain.version) ? brain.version : (isSnapshot ? 'v0' : 'mock');
  if (version === 'mock' && isSnapshot) {
    err('flies.brain.snapshot', 'cannot be set for version "mock"');
  }
  if (version !== 'mock' && !isSnapshot && BRAIN_VERSIONS.includes(brain.version)) {
    err('flies.brain.snapshot', `is required for version "${version}"`);
  }

  // flies.brain.decoder (v3 only, required; contracts/decoder-v1.md, contracts/world-config-v3.md).
  if (brain.decoder !== undefined && version !== 'v3') {
    err('flies.brain.decoder', `cannot be set for version "${version}"`);
  } else if (version === 'v3') {
    if (brain.decoder === undefined) err('flies.brain.decoder', 'is required for version "v3"');
    else if (typeof brain.decoder !== 'string' || brain.decoder === '') {
      err('flies.brain.decoder', 'must be a non-empty path to a decoder-v1 file');
    }
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

  // The LIF keys are those of the brain's version: LIF_DEFAULTS for mock and v0, LIF_V1_DEFAULTS for v1 and v2
  // (ADR 007, "Decisions: LIF core and runner" -- v2 runs the identical lif-v1.js/fly-brain-v1.js path).
  if (brain.stepsPerTick !== undefined) {
    if (!['v1', 'v2', 'v3'].includes(version)) err('flies.brain.stepsPerTick', 'is only for version "v1", "v2" or "v3"');
    else if (!isInt(brain.stepsPerTick, 1, 20)) err('flies.brain.stepsPerTick', 'must be an integer from 1 to 20');
  }

  if (brain.lif !== undefined) {
    if (!isObject(brain.lif)) {
      err('flies.brain.lif', 'must be an object of LIF parameters');
      return;
    }
    const defaults = ['v1', 'v2', 'v3'].includes(version) ? LIF_V1_DEFAULTS : LIF_DEFAULTS;
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
      // pathwayGain (L11, ADR 011 D40) and plasticity (L12, ADR 011) are each an object or null; resolveParamsV1
      // below checks their shape.
      if ((key === 'pathwayGain' || key === 'plasticity') && (value === null || isObject(value))) return false;
      return !isNum(value);
    });
    for (const [key] of notNumbers) err(`flies.brain.lif.${key}`, 'must be a number');

    // Range checks (dt > 0, vThreshold > vReset, ...) live in the engine (lif-v0.js, lif-v1.js), so they match it
    if (unknown.length === 0 && notNumbers.length === 0 && !outputScaleShapeInvalid) {
      try {
        if (['v1', 'v2', 'v3'].includes(version)) resolveParamsV1(brain.lif);
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
