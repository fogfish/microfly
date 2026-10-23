// Pure camera math: pan, zoom at the cursor, clamp to the world. No DOM.
// State: { x, y, zoom } in world px and screen px per world px.
//
// Zoom is continuous. Each wheel event multiplies it by a small factor (input.js), so zoom changes
// in small proportional steps and trackpads stay smooth. The zoom-out floor is the zoom at which the
// entire world fits the viewport (floorZoom), so zooming out always ends on a full view.
// This departs from the integer-only rule of research R5 (005). Pixel art stays sharp because the
// renderer copies with smoothing off; an art pixel is then a fractional number of device pixels.

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
  // The default zoom is the configured one, or the fit zoom when the world is larger than the view.
  cam.zoom = clampZoom(cam, Math.min(zoom.default, fitZoom(cam)));
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

// Multiply zoom by factor (> 1 zooms in, < 1 zooms out), keeping the world point under (sx, sy)
// fixed. The result is clamped to the floor and the maximum.
export function zoomAt(cam, factor, sx, sy) {
  const wx = cam.x + sx / cam.zoom;
  const wy = cam.y + sy / cam.zoom;
  cam.zoom = clampZoom(cam, cam.zoom * factor);
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
  cam.zoom = clampZoom(cam, cam.zoom);
  cam.x = cx - viewportWidth / (2 * cam.zoom);
  cam.y = cy - viewportHeight / (2 * cam.zoom);
  clamp(cam);
  return cam;
}

// The smallest zoom that still shows the whole world. The config minimum applies when it is
// smaller (a viewport larger than the world), so the floor is never above it.
export function floorZoom(cam) {
  return Math.min(cam.minZoom, fitZoom(cam));
}

// The zoom at which the whole world fits the viewport, on the tighter axis.
function fitZoom(cam) {
  return Math.min(cam.viewportWidth / cam.worldWidthPx, cam.viewportHeight / cam.worldHeightPx);
}

function clampZoom(cam, zoom) {
  return Math.min(cam.maxZoom, Math.max(floorZoom(cam), zoom));
}

function clamp(cam) {
  cam.zoom = clampZoom(cam, cam.zoom);
  cam.x = clampAxis(cam.x, cam.worldWidthPx, cam.viewportWidth, cam.zoom);
  cam.y = clampAxis(cam.y, cam.worldHeightPx, cam.viewportHeight, cam.zoom);
}

// If the world fits in the view, centre it. Otherwise keep the view inside it.
function clampAxis(pos, worldPx, viewPx, zoom) {
  const span = viewPx / zoom;
  if (span >= worldPx) return (worldPx - span) / 2;
  return Math.min(Math.max(pos, 0), worldPx - span);
}
