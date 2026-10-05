// Draws the composed scene and the flies on a 2D canvas.
//
// The scene is one bitmap (world/compose.js), so each frame copies a window of it. Flies are drawn
// on top, centred on their continuous position in cells. Zoom is an integer, so every art pixel is
// a whole number of device pixels, and the window is copied with smoothing off (research R5).

import { CELL_PX } from '../world/layout.js';

export function createRenderer(canvas, sprites) {
  const ctx = canvas.getContext('2d');
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;

  // Sets the drawing buffer for a CSS box of width × height. The box itself comes from the CSS grid.
  function resize(width, height) {
    dpr = window.devicePixelRatio || 1;
    cssWidth = width;
    cssHeight = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  // state: { camera, scene, flies }. scene is the composed canvas. camera.x, y are in scene px.
  function render({ camera, scene, flies = [] }) {
    const z = camera.zoom;
    const scale = z * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Whole source pixels, so the copy starts on an art pixel. The sub-pixel rest is moved on screen.
    const sx = Math.max(0, Math.floor(camera.x));
    const sy = Math.max(0, Math.floor(camera.y));
    const sw = Math.min(scene.width - sx, Math.ceil(cssWidth / z) + 1);
    const sh = Math.min(scene.height - sy, Math.ceil(cssHeight / z) + 1);
    const dx = Math.round((sx - camera.x) * scale);
    const dy = Math.round((sy - camera.y) * scale);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(scene, sx, sy, sw, sh, dx, dy, Math.round(sw * scale), Math.round(sh * scale));
    }

    const toDeviceX = (wx) => Math.round((wx * CELL_PX - camera.x) * scale);
    const toDeviceY = (wy) => Math.round((wy * CELL_PX - camera.y) * scale);

    for (const f of flies) {
      const s = sprites.get(f.sprite);
      const x0 = toDeviceX(f.body.x) - Math.round((s.sw * scale) / 2);
      const y0 = toDeviceY(f.body.y) - Math.round((s.sh * scale) / 2);
      ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, x0, y0, Math.round(s.sw * scale), Math.round(s.sh * scale));
    }
  }

  return { resize, render };
}
