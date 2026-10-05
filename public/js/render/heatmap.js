// Paints the odour field as a heatmap (specs/007-odor-layer/contracts/odour-layer.md §4, research R4).
//
// The ramp runs low → mid → high (yellow → orange → red) and is read from the --odour-* CSS tokens, so it
// follows the theme. Alpha rises with intensity up to --odour-alpha, so the terrain stays visible.
// parseRamp and rampColor are pure; paintField needs a browser canvas.

const DEFAULT_RAMP = {
  stops: [
    [255, 214, 10],
    [255, 128, 0],
    [220, 38, 38],
  ],
  maxAlpha: 0.55,
};

// style: anything with getPropertyValue(name), such as getComputedStyle(document.documentElement).
export function parseRamp(style) {
  const stops = ['--odour-low', '--odour-mid', '--odour-high'].map(
    (name, i) => parseTriple(style.getPropertyValue(name)) ?? DEFAULT_RAMP.stops[i],
  );
  const alpha = Number.parseFloat(style.getPropertyValue('--odour-alpha'));
  const maxAlpha = alpha > 0 && alpha <= 1 ? alpha : DEFAULT_RAMP.maxAlpha;
  return { stops, maxAlpha };
}

// "r, g, b" with integer channels in 0..255, or null.
function parseTriple(text) {
  const parts = String(text ?? '').trim().split(/\s*,\s*/);
  if (parts.length !== 3) return null;
  const rgb = parts.map(Number);
  return rgb.every((c) => Number.isInteger(c) && c >= 0 && c <= 255) ? rgb : null;
}

// t in [0, 1] (clamped) → [r, g, b, a] with every channel in 0..255.
export function rampColor(t, ramp) {
  const v = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const [low, mid, high] = ramp.stops;
  const [a, b, u] = v <= 0.5 ? [low, mid, v / 0.5] : [mid, high, (v - 0.5) / 0.5];
  return [
    Math.round(a[0] + (b[0] - a[0]) * u),
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
    Math.floor(255 * ramp.maxAlpha * v), // floor keeps a <= 255 × maxAlpha
  ];
}

// Returns a canvas of field.width × field.height, one pixel per sample.
export function paintField(field, ramp) {
  const canvas = document.createElement('canvas');
  canvas.width = field.width;
  canvas.height = field.height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(field.width, field.height);
  const data = image.data;
  for (let k = 0; k < field.values.length; k++) {
    const t = field.values[k];
    if (t <= 0) continue; // ImageData starts transparent
    const [r, g, b, a] = rampColor(t, ramp);
    data[4 * k] = r;
    data[4 * k + 1] = g;
    data[4 * k + 2] = b;
    data[4 * k + 3] = a;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
