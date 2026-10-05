// Mouse input: drag to pan, wheel to step the zoom at the cursor, and click to report a world tile.
// Calls onChange after each camera change so the caller can schedule a redraw.
// options.onClick(tileX, tileY) runs on a press and release within CLICK_SLOP px; needs options.tileSize.

import { panBy, zoomAt } from './camera.js';

const CLICK_SLOP = 4;

export function attachInput(canvas, camera, onChange, options = {}) {
  const { onClick, tileSize } = options;
  let drag = null;
  let press = null;

  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    panBy(camera, e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
    onChange();
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', (e) => {
    if (onClick && press && press.id === e.pointerId) {
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      if (moved < CLICK_SLOP) {
        const rect = canvas.getBoundingClientRect();
        const tileX = (camera.x + (e.clientX - rect.left) / camera.zoom) / tileSize;
        const tileY = (camera.y + (e.clientY - rect.top) / camera.zoom) / tileSize;
        onClick(tileX, tileY);
      }
    }
    press = null;
    endDrag(e);
  });
  canvas.addEventListener('pointercancel', (e) => {
    press = null;
    endDrag(e);
  });

  // Each wheel event moves one integer zoom step. The size of deltaY is ignored.
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const rect = canvas.getBoundingClientRect();
      zoomAt(camera, e.deltaY > 0 ? -1 : 1, e.clientX - rect.left, e.clientY - rect.top);
      onChange();
    },
    { passive: false },
  );
}
