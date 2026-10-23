// Mouse input: drag to pan, wheel to zoom at the cursor, and click to report a world tile.
// Calls onChange after each camera change so the caller can schedule a redraw.
// options.onClick(tileX, tileY) runs on a press and release within CLICK_SLOP px; needs options.tileSize.

import { panBy, zoomAt } from './camera.js';

const CLICK_SLOP = 4;
// Zoom per wheel pixel, as an exponent: one 100 px mouse notch zooms by about 1.16. Trackpads send many
// small deltas, so each event is smooth. A single event is capped so one large delta cannot jump the zoom.
const WHEEL_ZOOM_RATE = 0.0015;
const WHEEL_DELTA_CAP = 200;
const PX_PER_LINE = 16;

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

  // Each wheel event multiplies the zoom by a factor that follows deltaY. Scrolling down zooms out.
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.deltaMode === 1 ? e.deltaY * PX_PER_LINE : e.deltaY;
      const capped = Math.max(-WHEEL_DELTA_CAP, Math.min(WHEEL_DELTA_CAP, px));
      zoomAt(camera, Math.exp(-capped * WHEEL_ZOOM_RATE), e.clientX - rect.left, e.clientY - rect.top);
      onChange();
    },
    { passive: false },
  );
}
