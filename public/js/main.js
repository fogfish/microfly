// Bootstrap: load config → validate → load catalogue and sprites → compose → start the renderer.
// On any error, show the error panel and draw nothing (FR-021).

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
import { buildWorld, spawnFlies } from './fly/fly-world.js';
import { loadSnapshot, startFlies } from './fly/fly-host.js';
import { renderPanel } from './ui/panel/panel.js';
import { SECTIONS } from './ui/panel/sections/index.js';
import { initialTab, nextTab } from './ui/panel/tabs.js';

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

  let frame = 0;
  const requestDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render({ camera, scene, flies });
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
  const updatePanel = () => renderPanel(panel, records, selectedId, selectFly, SECTIONS, tab, switchTab);
  const onFlyUpdate = () => {
    requestDraw();
    updatePanel();
  };

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
