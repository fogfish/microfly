// Pure camera math: pan, zoom at the cursor, clamp to the world. No DOM.
// State: { x, y, zoom } in world px and screen px per world px.

export function createCamera({ worldWidthPx, worldHeightPx, zoom, viewportWidth, viewportHeight }) {
  const cam = {
    x: 0,
    y: 0,
    zoom: zoom.default,
    worldWidthPx,
    worldHeightPx,
    minZoom: zoom.min,
    maxZoom: zoom.max,
    viewportWidth,
    viewportHeight,
  };
  cam.x = worldWidthPx / 2 - viewportWidth / (2 * cam.zoom);
  cam.y = worldHeightPx / 2 - viewportHeight / (2 * cam.zoom);
  clamp(cam);
  return cam;
}

// Drag by a screen-space delta. The world moves with the mouse.
export function panBy(cam, dxScreen, dyScreen) {
  cam.x -= dxScreen / cam.zoom;
  cam.y -= dyScreen / cam.zoom;
  clamp(cam);
  return cam;
}

// Multiply zoom by factor, keeping the world point under (sx, sy) fixed
export function zoomAt(cam, factor, sx, sy) {
  const wx = cam.x + sx / cam.zoom;
  const wy = cam.y + sy / cam.zoom;
  cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.zoom * factor));
  cam.x = wx - sx / cam.zoom;
  cam.y = wy - sy / cam.zoom;
  clamp(cam);
  return cam;
}

// New viewport size. The centre of the view is kept.
export function resize(cam, viewportWidth, viewportHeight) {
  const cx = cam.x + cam.viewportWidth / (2 * cam.zoom);
  const cy = cam.y + cam.viewportHeight / (2 * cam.zoom);
  cam.viewportWidth = viewportWidth;
  cam.viewportHeight = viewportHeight;
  cam.x = cx - viewportWidth / (2 * cam.zoom);
  cam.y = cy - viewportHeight / (2 * cam.zoom);
  clamp(cam);
  return cam;
}

function clamp(cam) {
  cam.x = clampAxis(cam.x, cam.worldWidthPx, cam.viewportWidth, cam.zoom);
  cam.y = clampAxis(cam.y, cam.worldHeightPx, cam.viewportHeight, cam.zoom);
}

// If the world fits in the view, centre it. Otherwise keep the view inside it.
function clampAxis(pos, worldPx, viewPx, zoom) {
  const span = viewPx / zoom;
  if (span >= worldPx) return (worldPx - span) / 2;
  return Math.min(Math.max(pos, 0), worldPx - span);
}
