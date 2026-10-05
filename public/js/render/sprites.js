// Turns sprite sources into drawable entries: { source, sx, sy, sw, sh, w, h, anchor }.
// Atlas form: a rectangle of an atlas image, from the catalogue (world/catalog.js).
// Pixel form: a small grid (the fly sprites) rendered once into an offscreen canvas at 1 px per cell.

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

  return { source: canvas, sx: 0, sy: 0, sw: canvas.width, sh: canvas.height, w: canvas.width, h: canvas.height, anchor: { x: 0, y: 0 } };
}

// catalog: from indexCatalog. assetsRoot: the folder that holds the atlas files (assets/).
// pixelSprites: the `sprites` section of world.json (pixel form only).
// Returns { sprites: Map<id, entry>, errors }. Every catalogue sprite is in the map, keyed by id.
export async function loadSprites(catalog, assetsRoot, pixelSprites = {}) {
  const sprites = new Map();
  const errors = [];

  const images = await Promise.all(
    catalog.atlases.map(async (atlas, index) => {
      try {
        return await loadImage(new URL(atlas.file, assetsRoot).href);
      } catch (e) {
        errors.push({ path: `atlas.atlases[${index}]`, message: e.message });
        return null;
      }
    }),
  );

  for (const [id, s] of catalog.sprites) {
    const img = images[s.atlas.index];
    if (img === null || img === undefined) continue;
    const a = s.atlas;
    sprites.set(id, { source: img, sx: a.x, sy: a.y, sw: a.w, sh: a.h, w: s.w, h: s.h, anchor: s.anchor });
  }

  for (const [id, sprite] of Object.entries(pixelSprites)) {
    if (sprite.pixels !== undefined) sprites.set(id, renderPixels(sprite));
  }

  return { sprites, errors };
}
