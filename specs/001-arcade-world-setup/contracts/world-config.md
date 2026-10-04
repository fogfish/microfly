# Contract: World Config (format `arcade-world`, version 1)

**File**: `public/world/world.json` (default). The app loads this path. A different file can be chosen with `?world=<path under public/>`.

**Consumers**: the browser app (`public/js/main.js`). **Producers**: a human editing JSON. Future features may add fields only under a new `version`.

**Versioning rule**: The app accepts only `version: 1`. Any other value is rejected with a clear message. Adding an optional field is allowed within version 1 if the app ignores it when absent. Renaming or removing a field, or changing its meaning, needs `version: 2`.

## Top-level shape

```jsonc
{
  "format": "arcade-world",          // required, exact string
  "version": 1,                      // required, exact integer
  "name": "Meadow Arcade",           // optional, display only
  "seed": 1990,                      // required, integer 0..4294967295

  "world": {
    "width": 100,                    // required, cells, 1..512
    "height": 100,                   // required, cells, 1..512
    "tileSize": 16                   // optional, source px per cell, 8..64, default 16
  },

  "camera": {
    "zoom": { "min": 0.5, "max": 4, "default": 2 }   // required; 0 < min <= default <= max
  },

  "sprites": { /* id -> Sprite, see below */ },
  "terrain": [ /* TerrainType, see below */ ],
  "terrainLayers": [ /* optional, applied in order */ ],
  "objects": [ /* optional ObjectRule, applied in order */ ]
}
```

## Sprite

Each sprite id maps to one of two forms.

**Sheet form** (a rectangle from an image under `public/`):

```json
"tree-oak": { "sheet": "assets/terrain/roguelike-16.png", "x": 16, "y": 32, "w": 16, "h": 16 }
```

**Pixels form** (inline pixel art, at most 32×32):

```json
"fire": {
  "pixels": [
    "....r.....",
    "...rr.....",
    "..rroo....",
    ".rroyy....",
    ".royyy....",
    "..yyw.....",
    "..........",
    ".........."
  ],
  "palette": { "r": "#d62828", "o": "#f77f00", "y": "#fcbf49", "w": "#ffffff" }
}
```

Rules: `.` is always transparent and must not appear in `palette`. All rows have the same length. Every other character must be in `palette`.

## Terrain

```json
{ "id": "grass", "name": "Grass", "sprite": "grass", "walkable": true, "base": true }
```

Exactly one terrain entry has `"base": true`. Ids are unique. `walkable` is recorded for later features; rendering ignores it.

## Terrain layers (optional)

Applied in array order after the base fill. Each layer may only overwrite the cells whose terrain is listed in `on`.

Blobs (round patches with a random radius):

```json
{ "shape": "blobs", "terrain": "water", "count": 6, "radius": [3, 7], "on": ["grass"] }
```

Noise (organic patches where seeded value noise crosses a threshold):

```json
{ "shape": "noise", "terrain": "rock", "threshold": 0.82, "scale": 9, "on": ["grass"] }
```

Field rules: `terrain` and every entry in `on` must be existing terrain ids. `count` is an integer ≥ 0. `radius` is `[min, max]` with `1 <= min <= max`. `threshold` is between 0 and 1. `scale` is ≥ 2.

## Tile groups (optional, BUG-001)

`groups` is keyed by terrain id. A group draws a terrain as an overlay on the base terrain, with edge tiles chosen from the cell's neighbours. The group is only used for terrain that is not `base`.

```json
"groups": {
  "rock": {
    "fill": "rock",
    "edges": { "N": "rock-n", "E": "rock-e", "S": "rock-s", "W": "rock-w", "NE": "rock-ne", "NW": "rock-nw", "SE": "rock-se", "SW": "rock-sw", "NS": "rock-ns", "EW": "rock-ew", "NESW": "rock-all" }
  }
}
```

- `fill` is required and must be a sprite id. It is drawn when no neighbour is open.
- `edges` keys are the open sides: `N`, `E`, `S`, `W` and their combinations. A side is open when the neighbour has a different terrain.
- A missing edge key falls back to `fill`. Open-side masks with no tile of their own use a fallback (see `autotile.js`).
- Adding `groups` is optional. Per the versioning rule above, the app ignores it when absent. Whether it stays in version 1 is an open question (see plan.md, Tile Groups).

## Objects (optional)

Scatter rules placed after terrain. Each rule places up to `count` instances.

```json
{
  "id": "apple",
  "kind": "edible",
  "sprite": "apple",
  "count": 40,
  "allowedTerrain": ["grass"],
  "minSpacing": 2
}
```

Field rules:

- `kind` is one of `scenery`, `edible`, `danger`.
- `allowedTerrain` has at least one terrain id. A cell is valid only if its terrain is listed.
- `minSpacing` is the minimum distance in cells to any other placed object. `0` means no spacing rule.
- Placement stops after a bounded number of attempts per instance. The shortfall is reported in the generation report and in the browser console.

## Default content (version 1 `world.json`)

| Kind | Ids (count) | Notes |
|------|-------------|-------|
| Terrain | `grass` (base), `water`, `rock` | Water is laid by 6 blobs (radius 3–7), rock by noise (threshold 0.82, scale 9). Trees are objects on grass, not a terrain type |
| Scenery objects | `tree` (300), `rock-small` (60), `bush` (120) | All on grass only, `minSpacing` 1 |
| Edible | `apple` (40), `cherry` (40), `honey` (25) | All on grass only. `minSpacing` 2, 2 and 3 |
| Danger | `fire` (12), `spider` (20) | On grass only. `minSpacing` 4 and 3. With seed 1990, `fire` places 10 of 12 and the console logs the shortfall |

Sprite art: terrain and scenery are rectangles of `assets/terrain/roguelike-16.png` (Kenney, CC0). Fruit, honey, fire and spider are inline `pixels` sprites. Tile coordinates are in `public/assets/ATTRIBUTION.md`.

Water cells never hold objects, because every default object rule lists grass only (FR-016).

## Example

```json
{
  "format": "arcade-world",
  "version": 1,
  "seed": 1990,
  "world": { "width": 100, "height": 100, "tileSize": 16 },
  "camera": { "zoom": { "min": 0.5, "max": 4, "default": 2 } },
  "sprites": {
    "grass": { "sheet": "assets/terrain/roguelike-16.png", "x": 0, "y": 0, "w": 16, "h": 16 },
    "water": { "sheet": "assets/terrain/roguelike-16.png", "x": 0, "y": 16, "w": 16, "h": 16 },
    "rock":  { "sheet": "assets/terrain/roguelike-16.png", "x": 32, "y": 48, "w": 16, "h": 16 },
    "tree":  { "sheet": "assets/terrain/roguelike-16.png", "x": 16, "y": 32, "w": 16, "h": 16 },
    "apple": { "pixels": ["....g.....", "...gg.....", "..rrrr....", ".rrwrrr...", ".rrrrrr...", ".rrrrrr...", "..rrrr....", "...rr....."],
               "palette": { "r": "#e63946", "w": "#f1faee", "g": "#2a9d8f" } }
  },
  "terrain": [
    { "id": "grass", "sprite": "grass", "walkable": true, "base": true },
    { "id": "water", "sprite": "water", "walkable": false },
    { "id": "rock",  "sprite": "rock",  "walkable": false }
  ],
  "terrainLayers": [
    { "shape": "blobs", "terrain": "water", "count": 6, "radius": [3, 7], "on": ["grass"] },
    { "shape": "noise", "terrain": "rock", "threshold": 0.82, "scale": 9, "on": ["grass"] }
  ],
  "objects": [
    { "id": "tree",  "kind": "scenery", "sprite": "tree",  "count": 300, "allowedTerrain": ["grass"], "minSpacing": 1 },
    { "id": "apple", "kind": "edible",  "sprite": "apple", "count": 40,  "allowedTerrain": ["grass"], "minSpacing": 2 }
  ]
}
```

The example is abridged. The shipped `world.json` also defines `cherry`, `honey`, `fire`, `spider`, `rock-small` and `bush`.

## Errors

The app reports every error at once, each with a `path`, and renders no world. Message wording:

| Situation | Message (example) |
|-----------|-------------------|
| Missing file | `Could not load world.json (HTTP 404)` |
| Invalid JSON | `world.json is not valid JSON: <parser message>` |
| Wrong format or version | `unsupported version 2; this app supports 1` |
| Unknown reference | `objects[1].sprite: unknown sprite "frogg"` |
| Out of range | `world.width: must be an integer from 1 to 512` |
| Pixel grid mismatch | `sprites.fire.pixels[3]: row length 9, expected 10` |
| Sheet out of bounds | `sprites.tree.sheet: rectangle 16,32 16×16 is outside the 256×256 image` |
