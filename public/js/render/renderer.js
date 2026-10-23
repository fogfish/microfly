// Draws the composed scene and the flies on a 2D canvas.
//
// The scene is one bitmap (world/compose.js), so each frame copies a window of it. Overlays (canvases
// the size of the scene, such as the odour heatmap) are copied with the same window. Flies are drawn
// on top, centred on their continuous position in cells. Zoom is continuous (camera.js), so an art
// pixel is usually a fraction of a device pixel. The window is copied with smoothing off to keep edges sharp (research R5).

import { CELL_PX } from '../world/layout.js';

// The ring's colour is the --fly-selected token (style.css). Used when the token is absent.
const DEFAULT_SELECTED = '#ffffff';
// Ring gap beyond the sprite's half size, and its minimum radius, in CSS px. A zoomed-out sprite can be tiny.
const RING_GAP_PX = 3;
const RING_MIN_PX = 6;

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

  // state: { camera, scene, flies, overlays, selectedId }. scene is the composed canvas. camera.x, y are in scene px.
  // overlays: canvases of the scene's size, drawn between the scene and the flies.
  // selectedId: the fly to mark with a ring, drawn over the flies so it stays visible.
  function render({ camera, scene, flies = [], overlays = [], selectedId = null }) {
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
      // dw/dh: the drawn size of an image sprite (render/sprites.js), else the sprite's own pixel size
      const w = Math.round((s.dw ?? s.sw) * scale);
      const h = Math.round((s.dh ?? s.sh) * scale);
      ctx.save();
      ctx.translate(toDeviceX(f.body.x), toDeviceY(f.body.y));
      ctx.rotate((f.body.heading ?? 0) + Math.PI / 2);
      ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, -Math.round(w / 2), -Math.round(h / 2), w, h);
      ctx.restore();
    }

    const selected = selectedId === null ? undefined : flies.find((f) => f.id === selectedId);
    if (selected) {
      const s = sprites.get(selected.sprite);
      const half = Math.max(s.dw ?? s.sw, s.dh ?? s.sh) / 2;
      const radius = Math.max(RING_MIN_PX, half + RING_GAP_PX) * dpr;
      const colour = getComputedStyle(canvas).getPropertyValue('--fly-selected').trim() || DEFAULT_SELECTED;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      ctx.beginPath();
      ctx.arc(toDeviceX(selected.body.x), toDeviceY(selected.body.y), radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  return { resize, render };
}
