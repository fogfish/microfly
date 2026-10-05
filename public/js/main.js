// Bootstrap: load config → validate → load catalogue and sprites → compose → start the renderer.
// On any error, show the error panel and draw nothing (FR-021).
// main.js also owns the visual layers (specs/007-odor-layer): the odour heatmap is drawn over the scene
// when its switch in the World tab is on. The simulation never sees the layer state.

import { loadWorldConfig } from './config/load-world.js';
import { validateConfig, validateArt } from './world/validate.js';
import { loadCatalog } from './world/catalog.js';
import { buildLogic, CELL_PX } from './world/layout.js';
import { groundPlan } from './world/ground.js';
import { shorePlacements } from './world/shore.js';
import { composeScene } from './world/compose.js';
import { loadSprites } from './render/sprites.js';
import { createCamera, resize as resizeCamera } from './render/camera.js';
import { createRenderer } from './render/renderer.js';
import { attachInput } from './render/input.js';
import { showErrors, hideErrors } from './ui/error-panel.js';
import { buildWorld, spawnFlies, stimulusPoints } from './fly/fly-world.js';
import { loadSnapshot, startFlies } from './fly/fly-host.js';
import { resolveFlies } from './fly/fly-config.js';
import { initialLayers, toggleLayer } from './world/layers.js';
import { odourField } from './world/odour-field.js';
import { parseRamp, paintField } from './render/heatmap.js';
import { renderPanel, updatePanelValues } from './ui/panel/panel.js';
import { SECTIONS } from './ui/panel/sections/index.js';
import { initialTab, nextTab } from './ui/panel/tabs.js';

// The status panel refreshes this often while flies run (specs/006 FR-012, amended in specs/007).
const PANEL_INTERVAL_MS = 200;

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
  const flies = loaded.config.flies;
  if (flies !== undefined && (flies.mode ?? 'toy') === 'toy' && flies.brain?.snapshot !== undefined) {
    try {
      snapshot = await loadSnapshot(flies.brain, APP_ROOT);
    } catch (e) {
      return fail([{ path: 'flies.brain.snapshot', message: e.message }]);
    }
  }

  startWorld({ config: loaded.config, catalog, sprites, snapshot });
}

function startWorld({ config, catalog, sprites, snapshot }) {
  hideErrors();

  const canvas = document.getElementById('world');
  const logic = buildLogic(config, catalog);
  const scene = composeScene({
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

  // Odour layer: off on load. The field and its canvas are built the first time the layer is turned on;
  // flowers never move, so they are not rebuilt (only repainted when the theme changes).
  const stimulus = config.flies !== undefined ? resolveFlies(config).stimulus : { radius: 0, gain: 0, max: 0 };
  const odourPoints = odourSources(config, logic);
  const legend = odourPoints.length > 0 ? { max: stimulus.max } : null;
  let layers = initialLayers();
  let odourFieldCache = null;
  let odourCanvas = null;
  const paintOdour = () => paintField(odourFieldCache, parseRamp(getComputedStyle(document.documentElement)));
  const ensureOdour = () => {
    if (odourFieldCache) return;
    try {
      odourFieldCache = odourField({
        points: odourPoints,
        stimulus,
        cols: config.grid.cols,
        rows: config.grid.rows,
        samplesPerCell: CELL_PX,
      });
      odourCanvas = paintOdour();
    } catch (e) {
      console.error(`odour layer: ${e.message}`);
      odourCanvas = null;
    }
  };

  let frame = 0;
  const requestDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const overlays = layers.odour && odourCanvas ? [odourCanvas] : [];
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
    if (layers.odour) ensureOdour();
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
      renderPanel(panel, records, selectedId, selectFly, SECTIONS, tab, switchTab, { layers, onLayer: toggle, legend });
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
      records = startFlies({ config, world: flyWorld, flies, onUpdate: onFlyUpdate, snapshot });
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

  // The heatmap colours come from CSS tokens, so a theme change repaints the cached field.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!odourFieldCache) return;
    try {
      odourCanvas = paintOdour();
    } catch (e) {
      console.error(`odour layer: ${e.message}`);
    }
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

// The odour sources of the world: [{x, y}] cell centres, or [] without flies (no stimulus is declared).
function odourSources(config, logic) {
  if (config.flies === undefined) return [];
  try {
    return stimulusPoints(buildWorld(config, logic));
  } catch (e) {
    console.error(`odour layer: ${e.message}`);
    return [];
  }
}

boot().catch((e) => fail([{ path: '', message: e.message }]));
