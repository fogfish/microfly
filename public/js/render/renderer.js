// Draws the visible part of the world on a 2D canvas.
//
// Layers, bottom to top:
//   1. Base terrain. Opaque fill on every visible cell, so no transparent
//      pixel ever shows the page background (BUG-001).
//   2. Group overlays. Terrain with a group is drawn with the edge tile picked
//      from its neighbours (autotile.js), so transparent edge pixels reveal the base.
//   3. Objects, sorted by y, drawn at their own sprite size, centred in their
//      cell and bottom-aligned.
//
// Every cell edge is rounded to a whole device pixel, so neighbouring tiles
// share an exact boundary and no seam shows at any zoom.

import { openMask, pickEdge } from '../world/autotile.js';

export function createRenderer(canvas, sprites) {
  const ctx = canvas.getContext('2d');
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;

  function resize(width, height) {
    dpr = window.devicePixelRatio || 1;
    cssWidth = width;
    cssHeight = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  // state: { camera, world: { width, height, tileSize, grid, terrain, groups, base, objects } }
  //   groups[terrainIndex] is { fill, edges } with sprite ids, or undefined
  //   objects must already be sorted by y
  function render({ camera, world }) {
    const { width, height, tileSize: ts, grid, terrain, groups, base, objects } = world;
    const z = camera.zoom;
    const left = camera.x;
    const top = camera.y;

    // Draw in device pixels so each rounded edge lands on an exact pixel
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = z * dpr;
    const toDeviceX = (wx) => Math.round((wx - left) * scale);
    const toDeviceY = (wy) => Math.round((wy - top) * scale);

    const draw = (s, dx0, dy0, dx1, dy1) => {
      ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, dx0, dy0, dx1 - dx0, dy1 - dy0);
    };

    const x0 = Math.max(0, Math.floor(left / ts));
    const y0 = Math.max(0, Math.floor(top / ts));
    const x1 = Math.min(width - 1, Math.floor((left + cssWidth / z) / ts));
    const y1 = Math.min(height - 1, Math.floor((top + cssHeight / z) / ts));

    const baseSprite = sprites.get(terrain[base].sprite);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        draw(baseSprite, toDeviceX(x * ts), toDeviceY(y * ts), toDeviceX((x + 1) * ts), toDeviceY((y + 1) * ts));
      }
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = grid[y * width + x];
        if (t === base) continue;
        const group = groups[t];
        const spriteId = group ? pickEdge(group, openMask(grid, width, height, x, y)) : terrain[t].sprite;
        draw(sprites.get(spriteId), toDeviceX(x * ts), toDeviceY(y * ts), toDeviceX((x + 1) * ts), toDeviceY((y + 1) * ts));
      }
    }

    // Margin of one cell: a sprite drawn in a cell may rise above it
    for (const o of objects) {
      if (o.x < x0 - 1 || o.x > x1 + 1 || o.y < y0 - 1 || o.y > y1 + 1) continue;
      const s = sprites.get(o.sprite);
      const dx0 = toDeviceX(o.x * ts + (ts - s.sw) / 2);
      const dy0 = toDeviceY((o.y + 1) * ts - s.sh);
      const dx1 = dx0 + Math.round(s.sw * scale);
      const dy1 = dy0 + Math.round(s.sh * scale);
      draw(s, dx0, dy0, dx1, dy1);
    }
  }

  return { resize, render };
}
