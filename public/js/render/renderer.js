// Draws the composed scene and the flies on a 2D canvas.
//
// The scene is one bitmap (world/compose.js), so each frame copies a window of it. Overlays (canvases
// the size of the scene, such as the odour heatmap) are copied with the same window. Flies are drawn
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

  // state: { camera, scene, flies, overlays }. scene is the composed canvas. camera.x, y are in scene px.
  // overlays: canvases of the scene's size, drawn between the scene and the flies.
  function render({ camera, scene, flies = [], overlays = [] }) {
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
      for (const overlay of overlays) {
        ctx.drawImage(overlay, sx, sy, sw, sh, dx, dy, Math.round(sw * scale), Math.round(sh * scale));
      }
    }

    const toDeviceX = (wx) => Math.round((wx * CELL_PX - camera.x) * scale);
    const toDeviceY = (wy) => Math.round((wy * CELL_PX - camera.y) * scale);

    // A fly is drawn facing its heading (spec 017 BUG-001). The pixel art faces up (−y, screen north) and the body's
    // heading is 0 east, increasing clockwise on screen (y points down; body.js, stimulus.js), so the sprite turns by
    // heading + π/2. The world physics and the sensing sites already use the heading; only the drawing ignored it.
    for (const f of flies) {
      const s = sprites.get(f.sprite);
      const w = Math.round(s.sw * scale);
      const h = Math.round(s.sh * scale);
      ctx.save();
      ctx.translate(toDeviceX(f.body.x), toDeviceY(f.body.y));
      ctx.rotate((f.body.heading ?? 0) + Math.PI / 2);
      ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, -Math.round(w / 2), -Math.round(h / 2), w, h);
      ctx.restore();
    }
  }

  return { resize, render };
}
