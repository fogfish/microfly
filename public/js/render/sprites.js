// Turns sprite config into drawable sources.
// Sheet form: a rectangle of an image, loaded once per URL.
// Pixel form: a grid rendered once into an offscreen canvas at 1 px per cell.

const imageCache = new Map();

function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`could not load image ${url}`));
        img.src = url;
      }),
    );
  }
  return imageCache.get(url);
}

function renderPixels(sprite) {
  const rows = sprite.pixels;
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');

  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = sprite.palette[ch];
      ctx.fillRect(x, y, 1, 1);
    }
  });

  return { source: canvas, sx: 0, sy: 0, sw: canvas.width, sh: canvas.height };
}

// Returns { sprites: Map<id, { source, sx, sy, sw, sh }>, errors }
export async function loadSprites(spriteConfig, baseUrl) {
  const sprites = new Map();
  const errors = [];

  await Promise.all(
    Object.entries(spriteConfig).map(async ([id, sprite]) => {
      if (sprite.sheet === undefined) {
        sprites.set(id, renderPixels(sprite));
        return;
      }

      const path = `sprites.${id}.sheet`;
      try {
        const img = await loadImage(new URL(sprite.sheet, baseUrl).href);
        const inside =
          sprite.x + sprite.w <= img.naturalWidth && sprite.y + sprite.h <= img.naturalHeight;
        if (!inside) {
          errors.push({
            path,
            message: `rectangle ${sprite.x},${sprite.y} ${sprite.w}×${sprite.h} is outside the ${img.naturalWidth}×${img.naturalHeight} image`,
          });
          return;
        }
        sprites.set(id, { source: img, sx: sprite.x, sy: sprite.y, sw: sprite.w, sh: sprite.h });
      } catch (e) {
        errors.push({ path, message: e.message });
      }
    }),
  );

  return { sprites, errors };
}
