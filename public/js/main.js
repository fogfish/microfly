// Bootstrap: load config, validate, load sprites, then start the world.
// On any error, show the error panel and draw nothing.

import { loadWorldConfig } from './config/load-world.js';
import { validateConfig } from './world/validate.js';
import { generateTerrain, placeObjects } from './world/generate.js';
import { loadSprites } from './render/sprites.js';
import { createCamera, resize as resizeCamera } from './render/camera.js';
import { createRenderer } from './render/renderer.js';
import { attachInput } from './render/input.js';
import { showErrors, hideErrors } from './ui/error-panel.js';
import { buildWorld, spawnFlies } from './fly/fly-world.js';
import { startFlies } from './fly/fly-host.js';
import { renderFlyPanel } from './ui/fly-panel.js';

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

  const { sprites, errors: spriteErrors } = await loadSprites(loaded.config.sprites, APP_ROOT);
  if (spriteErrors.length > 0) return fail(spriteErrors);

  startWorld({ config: loaded.config, sprites });
}

function startWorld({ config, sprites }) {
  hideErrors();

  const canvas = document.getElementById('world');
  const { width, height } = config.world;
  const tileSize = config.world.tileSize ?? 16;

  const grid = generateTerrain(config);
  const { objects, report } = placeObjects(config, grid);
  for (const [id, missing] of Object.entries(report.shortfall)) {
    console.warn(`object rule "${id}": placed ${report.placed[id]}, ${missing} short of count`);
  }
  // Sorted by y so that objects lower on the screen draw over those above
  objects.sort((a, b) => a.y - b.y);

  // Tile groups indexed by terrain index, so the renderer looks them up per cell
  const groups = config.terrain.map((t) => config.groups?.[t.id]);
  const base = config.terrain.findIndex((t) => t.base === true);

  // world.flies is added below, after the flies are spawned
  const world = { width, height, tileSize, grid, terrain: config.terrain, groups, base, objects };
  const camera = createCamera({
    worldWidthPx: width * tileSize,
    worldHeightPx: height * tileSize,
    zoom: config.camera.zoom,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
  });

  const renderer = createRenderer(canvas, sprites);
  renderer.resize(innerWidth, innerHeight);

  let frame = 0;
  const requestDraw = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render({ camera, world });
    });
  };

  // Flies are optional. Without a `flies` section the world is exactly as feature 001.
  const panel = document.getElementById('fly-panel');
  let records = [];
  let selectedId = null;

  const updateFlyPanel = () => renderFlyPanel(panel, records, selectedId, (id) => {
    selectedId = id;
    updateFlyPanel();
  });
  const onFlyUpdate = () => {
    requestDraw();
    updateFlyPanel();
  };

  if (config.flies !== undefined) {
    try {
      const flyWorld = buildWorld(config, grid, objects);
      const flies = spawnFlies(config, flyWorld);
      world.flies = flies;
      records = startFlies({ config, world: flyWorld, flies, onUpdate: onFlyUpdate });
    } catch (e) {
      console.error(`flies: ${e.message}`);
      panel.textContent = `Flies could not start: ${e.message}`;
    }
  }

  // Click selects the nearest fly within one tile. Clicking empty ground clears the selection.
  const onWorldClick = (tileX, tileY) => {
    let best = null;
    let bestDistance = 1;
    for (const r of records) {
      const d = Math.hypot(r.state.body.x - tileX, r.state.body.y - tileY);
      if (d < bestDistance) {
        best = r;
        bestDistance = d;
      }
    }
    selectedId = best ? best.state.id : null;
    updateFlyPanel();
  };

  attachInput(canvas, camera, requestDraw, { onClick: onWorldClick, tileSize });

  window.addEventListener('resize', () => {
    renderer.resize(innerWidth, innerHeight);
    resizeCamera(camera, innerWidth, innerHeight);
    requestDraw();
  });

  requestDraw();
  updateFlyPanel();
}

boot().catch((e) => fail([{ path: '', message: e.message }]));
