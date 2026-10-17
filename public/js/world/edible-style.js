// Edible presentation (world config `edibleStyle`, specs/009-food-odour-recalibration/contracts/world-format-v3.md):
// a ground marker under each food unit, chosen by the ground area the unit stands on, and a draw scale per kind.
// Visual only: the logic grid, the odour and the flower stock are the same with or without it. Pure: no DOM.
//
//   edibleStyle: {
//     marker: { default: { sprite, width }, <ground area name>: { sprite, width } },
//     scale:  { <edible kind>: factor }
//   }

export const DEFAULT_MARKER = 'default';

// The marker and draw scale of one food unit. areaName: the ground area under the unit, or null (grass or no area).
// resolve(ref): the catalogue id of a sprite reference. Without a style, a unit is drawn as before.
export function edibleLook(style, kind, areaName, resolve) {
  if (!style) return { marker: null, scale: 1 };
  const m = (areaName && style.marker?.[areaName]) || style.marker?.[DEFAULT_MARKER] || null;
  return {
    marker: m ? { sprite: resolve(m.sprite), width: m.width } : null,
    scale: style.scale?.[kind] ?? 1,
  };
}

// Draws a food marker centred on the cell centre (cx, cy) in px, on a 2D context. sprites: the render Map.
export function drawFoodMarker(ctx, sprites, marker, cx, cy) {
  const m = sprites.get(marker.sprite);
  const w = marker.width;
  const h = Math.round((w * m.sh) / m.sw);
  ctx.drawImage(m.source, m.sx, m.sy, m.sw, m.sh, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}

// Draws a sprite whose foot point is (x, y) px, scaled by factor: the sprite and its anchor both grow by it.
export function drawScaledSprite(ctx, sprites, id, x, y, factor) {
  const s = sprites.get(id);
  ctx.drawImage(s.source, s.sx, s.sy, s.sw, s.sh, Math.round(x - s.anchor.x * factor), Math.round(y - s.anchor.y * factor),
    Math.round(s.sw * factor), Math.round(s.sh * factor));
}
