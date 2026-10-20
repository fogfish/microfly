// Logic grid and scene objects, built from the world definition. Pure: no DOM.
//
// The scene is drawn at native art size (compose.js). The logic grid is CELL_PX squares and holds
// only what the fly needs: water, blocked cells, edibles and dangers. A placed object sits at a
// continuous position in cells; its cell is the one under its foot point.

import { scatterPlacements } from './scatter.js';
import { waterField, cellWater, distanceAt } from './water.js';
import { mapPlan, mapLogic } from './sketch-map.js';
import { edibleLook } from './edible-style.js';

export const CELL_PX = 32;

// Scatter keeps out of the shore band, which has its own decor (shore.js, FR-030).
export const SHORE_CLEARANCE_PX = 12;

// A scattered sprite is solid when its class is a decorative object a fly can bump into (spec FR-016,
// research.md R7: "tree, rock, tent, bone/skull piece, or other non-food, non-water placement"). plant and
// terrain stay non-solid ground flourish (meadow-flowers scatter has always worked this way).
const SOLID_SCATTER_CLASSES = new Set(['bush', 'tree', 'rock', 'prop']);

// Food: one or more units per size class, every class present (spec 009 FR-001, BUG-001). Each edible names its
// sprite in the world file, so the art is data; this table is only the check that a sprite belongs to its kind
// (validate.js, FR-019).
export const FOOD_SPRITE_IDS = {
  small: 'trees-plant-005',   // red_flower_plant
  medium: 'jungle-plant-010',
  large: 'jungle-plant-015',
};
// Sprites removed from every world (FR-009). No scatter or shore rule may place them.
export const REMOVED_SPRITE_IDS = ['jungle-plant-016', 'jungle-plant-017', 'jungle-bush-018'];
// Dangers are the spider stand-in and the lantern (BUG-003: campfire logs are not a danger).
export const DANGER_SPRITES = {
  spider: 'jungle-prop-005',
  lantern: 'jungle-prop-006',
};
export const EDIBLE_KINDS = Object.keys(FOOD_SPRITE_IDS);
// Art a sketch map never places as scenery: food art and removed art (contracts/world-format-sketch-map.md §7).
export const DECOR_FORBIDDEN = new Set([...Object.values(FOOD_SPRITE_IDS), ...REMOVED_SPRITE_IDS]);
export const DANGER_KINDS = Object.keys(DANGER_SPRITES);

function pointInPolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function outlineContains(outline, x, y) {
  if (outline.ellipse) {
    const { cx, cy, rx, ry } = outline.ellipse;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return pointInPolygon(outline.polygon, x, y);
}

export function outlineBounds(outline) {
  if (outline.ellipse) {
    const { cx, cy, rx, ry } = outline.ellipse;
    return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
  }
  const xs = outline.polygon.map((p) => p[0]);
  const ys = outline.polygon.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// Cells whose centre lies inside the outline. Returns Uint8Array of cols × rows.
export function rasterizeOutline(outline, cols, rows) {
  const mask = new Uint8Array(cols * rows);
  const b = outlineBounds(outline);
  const x0 = Math.max(0, Math.floor(b.minX));
  const x1 = Math.min(cols - 1, Math.floor(b.maxX));
  const y0 = Math.max(0, Math.floor(b.minY));
  const y1 = Math.min(rows - 1, Math.floor(b.maxY));
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (outlineContains(outline, cx + 0.5, cy + 0.5)) mask[cy * cols + cx] = 1;
    }
  }
  return mask;
}

// Draw order: lower on the map (larger y, the foot point) is drawn last, so it covers what is above.
export function depthOrder(objects) {
  return [...objects].sort((a, b) => a.y - b.y);
}

export function cellIndex(x, y, cols) {
  return Math.floor(y) * cols + Math.floor(x);
}

// Logic water: a cell is water when the drawn water covers its centre (FR-016, BUG-002).
export function waterMask(config) {
  const { cols, rows } = config.grid;
  return cellWater(waterField(config), cols, rows);
}

// Every placed object in the scene: explicit objects, grove trees, scatter, and edible and danger art.
// catalog: from indexCatalog. The config must have passed validateConfig and validateArt.
export function buildScene(config, catalog) {
  const { cols, rows } = config.grid;
  const field = waterField(config);
  const water = cellWater(field, cols, rows);
  const idOf = (ref) => catalog.lookup(ref).sprite.id;
  const classOf = (id) => catalog.sprites.get(id).class;
  const objects = [];

  for (const o of config.objects ?? []) {
    objects.push({ sprite: idOf(o.sprite), x: o.x, y: o.y, solid: o.solid === true });
  }

  for (const grove of config.groves ?? []) {
    for (const tree of grove.trees) {
      objects.push({
        sprite: idOf(tree.sprite),
        x: grove.centre[0] + tree.dx,
        y: grove.centre[1] + tree.dy,
        solid: true,
        group: grove.id,
      });
    }
  }

  for (const rule of config.scatter ?? []) {
    const placed = scatterPlacements({
      seed: rule.seed,
      density: rule.density,
      clearings: rule.clearings,
      sprites: rule.sprites.map(idOf),
      area: rasterizeOutline(rule.area, cols, rows),
      water,
      cols,
      rows,
    });
    for (const p of placed) {
      if (distanceAt(field, p.x, p.y) < SHORE_CLEARANCE_PX) continue;
      objects.push({ ...p, solid: SOLID_SCATTER_CLASSES.has(classOf(p.sprite)), group: rule.id });
    }
  }

  for (const e of config.edibles ?? []) {
    objects.push({ sprite: idOf(e.sprite), x: e.x, y: e.y, solid: false, kind: e.kind,
      ...edibleLook(config.edibleStyle, e.kind, null, idOf) });
  }

  for (const d of config.dangers ?? []) {
    objects.push({ sprite: DANGER_SPRITES[d.kind], x: d.x, y: d.y, solid: false, kind: d.kind });
  }

  return { cols, rows, water, objects };
}

// The logic grid: water and solid objects block; edible and danger kinds per cell.
// edibleSize holds, per cell, the food unit's sprite size in tiles: max(w, h) / CELL_PX (spec 009 research R1). Zero
// where there is no edible. The odour reach of a unit is flies.stimulus.radius × this size (contracts/odour-reach §1).
// forestEdge: 1 where the cell's centre falls inside an edgeForest ground area, else 0 (contracts/world-format-
// sketch-map.md §2); a fly may walk through it — only the danger odour is special about it, not walkability.
// Returns { cols, rows, cellPx, water, blocked, edible, edibleSize, edibleScent, danger, forestEdge, objects }.
export function buildLogic(config, catalog) {
  if (config.map !== undefined) return buildMapLogic(config, catalog);
  const scene = buildScene(config, catalog);
  const { cols, rows, water, objects } = scene;
  const count = cols * rows;

  const blocked = new Uint8Array(water);
  for (const o of objects) {
    if (o.solid) blocked[cellIndex(o.x, o.y, cols)] = 1;
  }
  const { edible, edibleSize, edibleScent, danger } = foodAndDanger(config, catalog, count, cols);

  const forestEdge = new Uint8Array(count);
  for (const area of config.ground ?? []) {
    if (area.kind !== 'edgeForest') continue;
    const mask = rasterizeOutline(area.outline, cols, rows);
    for (let i = 0; i < count; i++) if (mask[i]) forestEdge[i] = 1;
  }

  return { cols, rows, cellPx: CELL_PX, water, blocked, edible, edibleSize, edibleScent, danger, forestEdge, objects };
}

// A world with a `map` section (contracts/world-format-sketch-map.md §7, BUG-002): water, blocked cells and the
// edge-forest band come from the sketch map's plan (world/sketch-map.js); edibles and dangers are the world's own.
function buildMapLogic(config, catalog) {
  const { cols, rows } = config.grid;
  const count = cols * rows;
  const plan = mapPlan(config, catalog, DECOR_FORBIDDEN);
  const { water, blocked, forestEdge, objects } = mapLogic(plan, cols, rows);
  const idOf = (ref) => catalog.lookup(ref).sprite.id;
  for (const e of config.edibles ?? []) {
    // The ground area under the unit picks its marker (edible-style.js); the plan's area map is in scene px.
    const area = plan.areaOf[Math.round(e.y * CELL_PX) * plan.W + Math.round(e.x * CELL_PX)];
    const areaName = plan.areas.find((a) => a.index === area)?.name ?? null;
    objects.push({ sprite: idOf(e.sprite), x: e.x, y: e.y, solid: false, kind: e.kind,
      ...edibleLook(config.edibleStyle, e.kind, areaName, idOf) });
  }
  for (const d of config.dangers ?? []) {
    objects.push({ sprite: DANGER_SPRITES[d.kind], x: d.x, y: d.y, solid: false, kind: d.kind });
  }
  const { edible, edibleSize, edibleScent, danger } = foodAndDanger(config, catalog, count, cols);
  const heatQuiet = heatQuietMask(config, plan, cols, rows);
  return { cols, rows, cellPx: CELL_PX, water, blocked, edible, edibleSize, edibleScent, danger, forestEdge, objects, heatQuiet };
}

// flies.heatQuiet (optional): the cells whose centre lies inside a named ground area take no heat (heat-field.js).
// The test is the area's own outline (E < 1 in its box, before the land clip), so the water pools inside a swamp are
// quiet too. Null when the world names none, so a world without the key keeps its heat unchanged.
function heatQuietMask(config, plan, cols, rows) {
  const names = config.flies?.heatQuiet;
  if (!names || names.length === 0) return null;
  const quiet = new Uint8Array(cols * rows);
  for (const area of plan.areas) {
    if (!names.includes(area.name)) continue;
    const { x0, y0, x1, y1 } = area.box;
    const bw = x1 - x0;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const px = Math.floor((cx + 0.5) * CELL_PX);
        const py = Math.floor((cy + 0.5) * CELL_PX);
        if (px < x0 || px >= x1 || py < y0 || py >= y1) continue;
        if (area.E[(py - y0) * bw + (px - x0)] < 1) quiet[cy * cols + cx] = 1;
      }
    }
  }
  return quiet;
}

// edibleSize holds, per cell, the food unit's sprite size in tiles: max(w, h) / CELL_PX (spec 009 research R1).
// edibleScent (contracts/world-config-v3-learning.md, ADR 011): the flower's declared scent, or null when absent.
function foodAndDanger(config, catalog, count, cols) {
  const edible = new Array(count).fill(null);
  const edibleSize = new Float32Array(count);
  const edibleScent = new Array(count).fill(null);
  for (const e of config.edibles ?? []) {
    const idx = cellIndex(e.x, e.y, cols);
    edible[idx] = e.kind;
    const { w, h } = catalog.lookup(e.sprite).sprite;
    edibleSize[idx] = Math.max(w, h) / CELL_PX;
    edibleScent[idx] = e.scent ?? null;
  }
  const danger = new Array(count).fill(null);
  for (const d of config.dangers ?? []) danger[cellIndex(d.x, d.y, cols)] = d.kind;
  return { edible, edibleSize, edibleScent, danger };
}
