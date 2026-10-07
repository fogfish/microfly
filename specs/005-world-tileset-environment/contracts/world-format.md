# Contract: World Definition, Format Version 2

The file `public/world/world.json` is the only input that defines the map. Developers edit it
by hand. The app validates it on load and refuses any version other than `3` (version 2 was superseded by spec 009; see [spec 009 world-format-v3](../../009-food-odour-recalibration/contracts/world-format-v3.md)). Version 3 changes: edibles are `small`, `medium` or `large`, each with a `sprite`; `flower` is refused; scatter and shore decor never use food or removed sprites.

## Top-level keys

```json
{
  "format": "arcade-world",
  "version": 3,
  "name": "Pond Meadow",
  "seed": 1990,
  "grid":  { "cols": 48, "rows": 32, "cellPx": 32 },
  "zoom":  { "min": 1, "max": 4, "default": 2 },
  "atlas": "assets/atlas/catalog.json",
  "ground": [],
  "waterBodies": [],
  "objects": [],
  "groves": [],
  "scatter": [],
  "edibles": [],
  "dangers": [],
  "flies": {}
}
```

## Coordinates

- All positions are in **cells**, continuous numbers. `x = 12.5` is the middle of cell 12.
- Scene art is drawn at native size. `cellPx` is the logic grid's size only.
- Positions refer to the sprite's foot point (`anchor` in the catalogue), not its top-left.

## Pixel sprites

The `sprites` section holds the pixel-form sprites that the atlas does not have: the fly art
(`fly`, `fly-baseline`). `flies.sprite` names one of them.

## Art references

- `sprite` is an atlas `id` (e.g. `"trees-tree-005"`), or a `name` that is unique in the
  catalogue. Unknown references fail validation and name the entry.
- The app reads `atlas` (the catalogue) to resolve each reference. No pixel rectangles are
  copied into `world.json`.

## Water and shores

```json
{
  "id": "pond-north",
  "outline": { "blob": { "cx": 13, "cy": 9.5, "rx": 2.8, "ry": 2.0, "wobble": 0.11, "harmonics": 4 } }
}
```

- A water body `outline` is a `blob` (BUG-002): a wobbly ellipse with centre `cx`, `cy` and
  half-widths `rx`, `ry` in cells, plus `wobble` and `harmonics`, which add bays and headlands
  (art pack WATER-SPEC §3.2). `ellipse` and `polygon` are refused for water; they stay valid for
  `ground` and `scatter` areas.
- Each body must be a **pond** or a **lake** (FR-011). In cells (32 px):

  | Kind | `rx` | `ry / rx` | `wobble` | `harmonics` |
  |---|---|---|---|---|
  | pond | 1.875 to 3.125 (60 to 100 px) | 0.65 to 0.8 | 0.08 to 0.14 | 3 to 5 |
  | lake | 5.625 to 8.125 (180 to 260 px) | 0.55 to 0.65 | 0.14 to 0.24 | 5 to 7 |

  Leave room around each body for the shore band and the north-bank decor (about 1.5 cells).
- The outline's harmonics come from the world `seed` and the body's place in the list, so
  reordering `waterBodies` changes the outlines.
- There is no `shore` field. Every shore is the grass shore style of the art pack's water spec:
  a lush grass band, a mud line, an earth bank face on north banks and shore decor (reed beds,
  waterline stones, tufts, sprigs, ferns, wild flowers), all placed from the signed distance to
  the waterline. A `shore` field fails validation and names the entry.
- Water is always the static frame `water-water-001`, with no drift and fixed foam.
- A logic cell is water when the drawn water covers its centre. Edibles, dangers and solid
  objects may not stand on a water cell. Scatter keeps 12 px clear of the waterline.

## Objects and groves

```json
{ "sprite": "jungle-plant-013", "x": 3.5, "y": 20.0, "solid": false }
{ "sprite": "beach-tree-008", "x": 30.0, "y": 14.0, "solid": true }
```

```json
{
  "id": "grove-east",
  "centre": [36, 22],
  "trees": [
    { "sprite": "trees-tree-002", "dx": -1.5, "dy": 0.0 },
    { "sprite": "trees-tree-005", "dx": 0.5, "dy": 1.0 }
  ]
}
```

- A group must list between 4 and 12 trees.
- `solid: true` blocks the cell under the foot point. Water is never solid for placement.

## Scatter

```json
{
  "id": "meadow-flowers",
  "area": { "ellipse": { "cx": 20, "cy": 16, "rx": 9, "ry": 7 } },
  "sprites": ["trees-plant-005", "jungle-plant-016", "jungle-plant-017"],
  "density": 0.4,
  "clearings": 0.3,
  "seed": 77
}
```

- The same `seed` and definition always give the same layout (FR-018).
- Scatter never places objects on water.
- Scatter never uses the edible flower art `trees-plant-001` to `trees-plant-003` (FR-032).

## Edibles and dangers

```json
{ "kind": "flower", "x": 17.5, "y": 7.5 }
{ "kind": "spider", "x": 10.5, "y": 12.5 }
```

- Allowed kinds: edible `flower` (honey removed, BUG-001); danger `spider`, `lantern` (`fire` removed, BUG-003; a `fire` entry is refused).
- Positions must not be on water. Violations fail validation and name the entry.
- Spread (FR-032, checked by `public/tests/spread.test.js`): each of the 3 × 2 map regions holds
  at least one flower and one danger; flowers are at least 6 cells apart; at least 6 flowers and
  5 dangers; spots stay outside the shore band and off solid cells.

## Flies

The `flies` section keeps its structure. Only the stimulus object list changes:

```json
"stimulus": { "objects": ["flower"], "radius": 3, "gain": 1.0, "max": 1.0, "resting": 0.2 }
```

## Errors

Every error names the top-level section and the entry, for example
`objects[12]: unknown sprite "trees-tree-999"`. The app shows the errors in the error panel and
draws no world (FR-021).
