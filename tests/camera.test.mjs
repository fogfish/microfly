import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, panBy, zoomAt, resize } from '../public/js/render/camera.js';

const zoom = { min: 1, max: 4, default: 2 };

// 100 cells × 16 px = 1600 world px
const make = (overrides = {}) =>
  createCamera({
    worldWidthPx: 1600,
    worldHeightPx: 1600,
    zoom,
    viewportWidth: 800,
    viewportHeight: 600,
    ...overrides,
  });

test('zoom at the cursor keeps the world point under it fixed', () => {
  const cam = make();
  const sx = 300;
  const sy = 200;
  const before = { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };

  zoomAt(cam, 1, sx, sy);

  const after = { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
  assert.ok(Math.abs(before.x - after.x) < 1e-9);
  assert.ok(Math.abs(before.y - after.y) < 1e-9);
});

test('zoom moves in whole steps and clamps to min and max', () => {
  const step = make();
  zoomAt(step, 1, 0, 0);
  assert.equal(step.zoom, 3);
  const cam = make();
  for (let i = 0; i < 100; i++) zoomAt(cam, -1, 400, 300);
  assert.equal(cam.zoom, zoom.min);

  for (let i = 0; i < 100; i++) zoomAt(cam, 1, 400, 300);
  assert.equal(cam.zoom, zoom.max);
});

test('drag pan moves the view opposite the drag direction', () => {
  const cam = make();
  const x0 = cam.x;
  const y0 = cam.y;

  panBy(cam, 40, 20); // mouse moves right and down

  assert.ok(cam.x < x0, 'view moves left, so the world follows the mouse right');
  assert.ok(cam.y < y0, 'view moves up, so the world follows the mouse down');
  assert.equal(cam.x, x0 - 40 / cam.zoom);
  assert.equal(cam.y, y0 - 20 / cam.zoom);
});

test('pan clamps so the viewport stays inside the world', () => {
  const cam = make();

  panBy(cam, 1e6, 1e6);
  assert.equal(cam.x, 0);
  assert.equal(cam.y, 0);

  panBy(cam, -1e6, -1e6);
  assert.equal(cam.x, 1600 - 800 / cam.zoom);
  assert.equal(cam.y, 1600 - 600 / cam.zoom);
});

test('a world smaller than the viewport is centred', () => {
  const cam = createCamera({
    worldWidthPx: 200,
    worldHeightPx: 100,
    zoom,
    viewportWidth: 800,
    viewportHeight: 600,
  });

  // At zoom 2, the view spans 400 × 300 world px. Centre it on the 200 × 100 world.
  assert.equal(cam.x, (200 - 400) / 2);
  assert.equal(cam.y, (100 - 300) / 2);

  panBy(cam, 500, 500);
  assert.equal(cam.x, (200 - 400) / 2, 'pan does nothing on an axis that fits');
  assert.equal(cam.y, (100 - 300) / 2);
});

test('resize keeps the centre of the view', () => {
  const cam = make();
  const cx = cam.x + cam.viewportWidth / (2 * cam.zoom);
  const cy = cam.y + cam.viewportHeight / (2 * cam.zoom);

  resize(cam, 1000, 700);

  assert.ok(Math.abs(cam.x + 1000 / (2 * cam.zoom) - cx) < 1e-9);
  assert.ok(Math.abs(cam.y + 700 / (2 * cam.zoom) - cy) < 1e-9);
});
