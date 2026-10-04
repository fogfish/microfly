// Mouse input: drag to pan, wheel to zoom at the cursor.
// Calls onChange after each camera change so the caller can schedule a redraw.

import { panBy, zoomAt } from './camera.js';

const ZOOM_STEP = 1.1;

export function attachInput(canvas, camera, onChange) {
  let drag = null;

  canvas.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
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
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Magnitude of deltaY is ignored, so a fast wheel does not jump past the limits
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const factor = e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const rect = canvas.getBoundingClientRect();
      zoomAt(camera, factor, e.clientX - rect.left, e.clientY - rect.top);
      onChange();
    },
    { passive: false },
  );
}
