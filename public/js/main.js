// Bootstrap: load config → validate → load catalogue and sprites → compose → start the renderer.
// On any error, show the error panel and draw nothing (FR-021).
// main.js also owns the visual layers (specs/007-odor-layer, contracts/odour-layer-v2.md): four independent
// overlays (food/danger/heat odour, tile grid) are drawn over the scene when their switch in the World tab is
// on. The simulation never sees the layer state.

import { loadWorldConfig } from './config/load-world.js';
import { validateConfig, validateArt } from './world/validate.js';
import { loadCatalog } from './world/catalog.js';
import { buildLogic, CELL_PX, DECOR_FORBIDDEN } from './world/layout.js';
import { mapPlan } from './world/sketch-map.js';
import { paintMap } from './world/sketch-paint.js';
import { groundPlan } from './world/ground.js';
import { shorePlacements } from './world/shore.js';
import { composeScene } from './world/compose.js';
import { loadSprites } from './render/sprites.js';
import { createCamera, resize as resizeCamera } from './render/camera.js';
import { createRenderer } from './render/renderer.js';
import { attachInput } from './render/input.js';
import { showErrors, hideErrors } from './ui/error-panel.js';
import { buildWorld, spawnFlies } from './fly/fly-world.js';
import { loadDecoderFile, loadLearningFile, loadSnapshot, startFlies } from './fly/fly-host.js';
import { resolveLearningGroups } from './brain/learning.js';
import { initialLayers, toggleLayer } from './world/layers.js';
import { dangerField } from './world/danger-field.js';
import { heatField } from './world/heat-field.js';
import { createLiveFoodField, foodField } from './world/food-field.js';
import { parseRamp, paintField, paintGrid } from './render/heatmap.js';
import { renderPanel, updatePanelValues } from './ui/panel/panel.js';
import { SECTIONS } from './ui/panel/sections/index.js';
import { initialTab, nextTab } from './ui/panel/tabs.js';

// The status panel refreshes this often while flies run (specs/006 FR-012, amended in specs/007).
const PANEL_INTERVAL_MS = 200;
// The first frame of the art pack's water animation; the map is static (spec 014 FR-005).
const WATER_FRAME = 'water-water-001';

// main.js lives in public/js/, so its parent is the web root that holds world/ and assets/
const APP_ROOT = new URL('../', import.meta.url);

function fail(errors) {
  for (const { path, message } of errors) {
    console.error(`${path || 'world.json'}: ${message}`);
  }
  showErrors(errors);
}

async function boot() {
  const loaded = await loadWorldConfig({ root: APP_ROOT });
  if (loaded.errors) return fail(loaded.errors);

  const errors = validateConfig(loaded.config);
  if (errors.length > 0) return fail(errors);

  // The art names are checked once the catalogue is loaded, before any sprite is drawn
  const catalogUrl = new URL(loaded.config.atlas, APP_ROOT);
  const { catalog, errors: catalogErrors } = await loadCatalog(catalogUrl);
  if (catalogErrors.length > 0) return fail(catalogErrors);

  const artErrors = validateArt(loaded.config, catalog);
  if (artErrors.length > 0) return fail(artErrors);

  const { sprites, errors: spriteErrors } = await loadSprites(catalog, new URL('../', catalogUrl), loaded.config.sprites);
  if (spriteErrors.length > 0) return fail(spriteErrors);

  // A snapshot brain is read before anything starts. A bad file shows the error panel and no fly starts.
  let snapshot = null;
  let decoder = null;
  let learning = null;
  let mbon = null;
  const flies = loaded.config.flies;
  if (flies !== undefined && (flies.mode ?? 'toy') === 'toy' && flies.brain?.snapshot !== undefined) {
    try {
      snapshot = await loadSnapshot(flies.brain, APP_ROOT);
    } catch (e) {
      return fail([{ path: 'flies.brain.snapshot', message: e.message }]);
    }
    // decoder-v1 (ADR 010 D28), "v3" only: read and cross-checked against the snapshot before any fly starts.
    if (flies.brain.version === 'v3') {
      try {
        decoder = await loadDecoderFile(flies.brain, APP_ROOT, snapshot);
      } catch (e) {
        return fail([{ path: 'flies.brain.decoder', message: e.message }]);
      }
      // learning-v1 (ADR 011), "v3" only, optional: read and cross-checked before any fly starts.
      try {
        learning = await loadLearningFile(flies.brain, APP_ROOT, snapshot);
        // The MBON approach/avoid groups, resolved once here (not per fly) for decoder.js's learned valence
        // (data-model.md "Learned valence"); the same resolver the worker runs on its own manifest copy.
        if (learning) {
          const groups = resolveLearningGroups(learning, snapshot.neurons);
          mbon = { approach: groups.approach, avoid: groups.avoid };
        }
      } catch (e) {
        return fail([{ path: 'flies.brain.learning', message: e.message }]);
      }
    }
  }

  startWorld({ config: loaded.config, catalog, sprites, snapshot, decoder, learning, mbon });
}

function startWorld({ config, catalog, sprites, snapshot, decoder, learning, mbon }) {
  hideErrors();

  const canvas = document.getElementById('world');
  const logic = buildLogic(config, catalog);
  // A sketch map is painted from its plan (contracts/world-format-sketch-map.md §7, BUG-002), with the food and the
  // dangers drawn among its scenery; a tile world is composed as before.
  const scene = config.map !== undefined
    ? paintMap({
      plan: mapPlan(config, catalog, DECOR_FORBIDDEN),
      sprites,
      objects: logic.objects.filter((o) => o.kind !== undefined),
      waterFrame: WATER_FRAME,
    })
    : composeScene({
      config,
      sprites,
      logic,
      ground: groundPlan(config, catalog),
      shores: shorePlacements(config),
    });

  // The world is the canvas's grid cell, which the CSS sizes beside the panel (or above it on a phone).
  const worldBox = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  const { width, height } = worldBox();

  const camera = createCamera({
    worldWidthPx: scene.width,
    worldHeightPx: scene.height,
    zoom: config.zoom,
    viewportWidth: width,
    viewportHeight: height,
  });

  const renderer = createRenderer(canvas, sprites);
  renderer.resize(width, height);

  // Flies are optional. Without a `flies` section the world is drawn with no fly.
  const panel = document.getElementById('fly-panel');
  let flies = [];
  let records = [];
  let selectedId = null;

  // Four independent overlays (contracts/odour-layer-v2.md §5): off on load. Each odour field and its canvas
  // are built the first time its layer is turned on, same build-once-cache pattern as today's single odour
  // layer; flowers never move, so they are not rebuilt (only repainted when the theme changes). The grid
  // layer needs no field, only config.grid. The overlay always shows exactly what a fly at that point would
  // sense — same field-building functions as fly/fly-world.js uses for sensing (data-model.md "Relationships").
  let layers = initialLayers();
  const legends = {
    'odour-food': (config.edibles ?? []).length > 0 ? { max: 1 } : null,
    'odour-danger': logic.forestEdge.some(Boolean) ? { max: 1 } : null,
    'odour-heat': logic.water.some(Boolean) ? { max: 1 } : null,
  };

  // Expands a {cols, rows, values} per-cell field to a {width, height, values} per-pixel field for paintField:
  // the same value repeated across a cell's pixels, no sub-cell interpolation (data-model.md "Danger Odour Field").
  const expandCellField = ({ cols, rows, values }) => {
    const width = cols * CELL_PX;
    const height = rows * CELL_PX;
    const out = new Float32Array(width * height);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const v = values[cy * cols + cx];
        if (v === 0) continue;
        for (let py = 0; py < CELL_PX; py++) {
          const row = (cy * CELL_PX + py) * width + cx * CELL_PX;
          out.fill(v, row, row + CELL_PX);
        }
      }
    }
    return { width, height, values: out };
  };

  const foodUnits = (config.edibles ?? []).map((e, i) => ({ x: e.x, y: e.y, seed: (i + 1) * 97, stockFraction: 1 }));
  // Food odour follows the flowers that flies sense (spec 018 follow-up): once a forager brain runs, the overlay is the
  // live field of the world's own sense units and the flowers' current levels. Without flies it stays the static field.
  let liveFood = null;
  const FOOD_REPAINT_MS = 250;
  let foodPaintedAt = -Infinity;
  const foodOverlayField = () => (liveFood
    ? liveFood.field.fieldFor(liveFood.flowers)
    : foodField({ units: foodUnits, cols: logic.cols, rows: logic.rows }));
  const overlayCanvas = {};
  const ensureOverlay = {
    'odour-food': () => expandCellField(foodOverlayField()),
    'odour-danger': () => expandCellField({ cols: logic.cols, rows: logic.rows, values: dangerField({ forestEdge: logic.forestEdge, cols: logic.cols, rows: logic.rows }).intensity }),
    'odour-heat': () => expandCellField({ cols: logic.cols, rows: logic.rows, values: heatField({ water: logic.water, cols: logic.cols, rows: logic.rows, quiet: logic.heatQuiet }).intensity }),
  };
  const RAMP_PREFIX = { 'odour-food': '--odour-food', 'odour-danger': '--odour-danger', 'odour-heat': '--odour-heat' };
  const paintOdour = (id, field) => paintField(field, parseRamp(getComputedStyle(document.documentElement), RAMP_PREFIX[id]));
  const odourFieldCache = {};
  const ensureLayer = (id) => {
    if (overlayCanvas[id]) return;
    if (id === 'grid') {
      overlayCanvas.grid = paintGrid(config.grid.cols, config.grid.rows, CELL_PX, getComputedStyle(document.documentElement));
      return;
    }
    try {
      odourFieldCache[id] = ensureOverlay[id]();
      overlayCanvas[id] = paintOdour(id, odourFieldCache[id]);
    } catch (e) {
      console.error(`${id} layer: ${e.message}`);
    }
  };

  // A depleted or regrowing flower changes what flies sense, so the food overlay follows it. Repaints are throttled:
  // a regrowing flower changes every tick.
  // Returns true when it repainted. A timer below calls it too, so a change that lands inside the throttle window (or
  // after the last fly tick) is still painted, instead of waiting for the next draw request.
  const refreshFoodOverlay = (now) => {
    if (!liveFood || !layers['odour-food'] || !overlayCanvas['odour-food']) return false;
    if (liveFood.flowers.version === liveFood.version || now - foodPaintedAt < FOOD_REPAINT_MS) return false;
    foodPaintedAt = now;
    liveFood.version = liveFood.flowers.version;
    try {
      liveFood.painted = foodOverlayField();
      odourFieldCache['odour-food'] = expandCellField(liveFood.painted);
      overlayCanvas['odour-food'] = paintOdour('odour-food', odourFieldCache['odour-food']);
      return true;
    } catch (e) {
      console.error(`odour-food layer: ${e.message}`);
      return false;
    }
  };
  setInterval(() => {
    if (refreshFoodOverlay(performance.now())) requestDraw();
  }, FOOD_REPAINT_MS);

  let frame = 0;
  const requestDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      refreshFoodOverlay(performance.now());
      const overlays = ['odour-food', 'odour-danger', 'odour-heat', 'grid']
        .filter((id) => layers[id] && overlayCanvas[id])
        .map((id) => overlayCanvas[id]);
      renderer.render({ camera, scene, flies, overlays });
    });
  };

  // The list buttons and a click on the world both select through selectFly. Choosing a fly moves to the
  // Fly tab; clearing the selection (a click on empty ground) keeps the current tab.
  let tab = initialTab;
  const selectFly = (id) => {
    selectedId = id;
    if (id !== null) tab = nextTab(tab, { type: 'select' });
    updatePanel();
  };
  const switchTab = (name) => {
    tab = nextTab(tab, { type: 'tab', tab: name });
    updatePanel();
  };
  const toggle = (id) => {
    layers = toggleLayer(layers, id);
    if (layers[id]) ensureLayer(id);
    requestDraw();
    updatePanel();
  };
  // User actions (selection, tab, layer switch) render the panel at once, at most once per frame. This is
  // the structural render: it may build or remove elements (BUG-002, FR-019).
  let panelFrame = 0;
  const updatePanel = () => {
    if (panelFrame) return;
    panelFrame = requestAnimationFrame(() => {
      panelFrame = 0;
      renderPanel(panel, records, selectedId, selectFly, SECTIONS, tab, switchTab, { layers, onLayer: toggle, legends });
    });
  };
  // Flies report every tick, but the panel does not follow each tick. Ticks only mark it stale, and a
  // timer updates its values every PANEL_INTERVAL_MS. The value update changes text, bar widths and point
  // colours in place and builds nothing (BUG-002, FR-019); a status change of the selected fly falls back
  // to the structural render.
  let panelStale = false;
  const onFlyUpdate = () => {
    requestDraw();
    panelStale = true;
  };
  setInterval(() => {
    if (!panelStale || panelFrame) return;
    panelStale = false;
    if (!updatePanelValues(panel, records, selectedId)) updatePanel();
  }, PANEL_INTERVAL_MS);

  if (config.flies !== undefined) {
    try {
      const flyWorld = buildWorld(config, logic);
      flies = spawnFlies(config, flyWorld);
      records = startFlies({
        config,
        world: flyWorld,
        flies,
        onUpdate: onFlyUpdate,
        snapshot,
        decoder,
        learning,
        mbon,
        onFlowers: (flowers) => {
          liveFood = flowers
            ? { field: createLiveFoodField(flyWorld.foodUnits, logic.cols, logic.rows), flowers, version: -1, painted: null }
            : null;
          // Diagnostic (console): microfly.foodLevels() compares each flower's state with the odour overlay's last paint.
          window.microfly = {
            foodLevels: () => {
              if (!liveFood) return 'no forager flies';
              const live = liveFood.field.fieldFor(liveFood.flowers).values;
              return [...flyWorld.stimulusCells].map(([idx, { kind }]) => ({
                x: idx % logic.cols,
                y: Math.floor(idx / logic.cols),
                kind,
                stock: liveFood.flowers.stockAt(idx % logic.cols, Math.floor(idx / logic.cols)),
                fraction: liveFood.flowers.fraction(idx % logic.cols, Math.floor(idx / logic.cols)),
                liveOdour: live[idx],
                paintedOdour: liveFood.painted?.values[idx] ?? null,
                flowersVersion: liveFood.flowers.version,
                paintedVersion: liveFood.version,
              }));
            },
          };
        },
      });
    } catch (e) {
      console.error(`flies: ${e.message}`);
      panel.textContent = `Flies could not start: ${e.message}`;
    }
  }

  // Click selects the nearest fly within one cell. Clicking empty ground clears the selection.
  const onWorldClick = (cellX, cellY) => {
    let best = null;
    let bestDistance = 1;
    for (const r of records) {
      const d = Math.hypot(r.state.body.x - cellX, r.state.body.y - cellY);
      if (d < bestDistance) {
        best = r;
        bestDistance = d;
      }
    }
    selectFly(best ? best.state.id : null);
  };

  attachInput(canvas, camera, requestDraw, { onClick: onWorldClick, tileSize: CELL_PX });

  // The heatmap/grid colours come from CSS tokens, so a theme change repaints every already-built canvas.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const style = getComputedStyle(document.documentElement);
    for (const id of ['odour-food', 'odour-danger', 'odour-heat']) {
      if (!odourFieldCache[id]) continue;
      try {
        overlayCanvas[id] = paintOdour(id, odourFieldCache[id]);
      } catch (e) {
        console.error(`${id} layer: ${e.message}`);
      }
    }
    if (overlayCanvas.grid) overlayCanvas.grid = paintGrid(config.grid.cols, config.grid.rows, CELL_PX, style);
    requestDraw();
  });

  window.addEventListener('resize', () => {
    const size = worldBox();
    renderer.resize(size.width, size.height);
    resizeCamera(camera, size.width, size.height);
    requestDraw();
  });

  requestDraw();
  updatePanel();
}

boot().catch((e) => fail([{ path: '', message: e.message }]));
