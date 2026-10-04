# Data Model: Arcade World Setup

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

The persisted entity is the world config (`public/world/world.json`). Everything else is computed in memory at load time. The field-level contract is in [contracts/world-config.md](contracts/world-config.md). This file describes the entities and their rules.

## Entities

### WorldConfig (persisted, one file)

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `format` | string | yes | Must equal `"arcade-world"` |
| `version` | integer | yes | Must equal `1` for this release |
| `seed` | integer | yes | 0 to 2³²−1. Same seed and config give the same world (FR-013) |
| `name` | string | no | Display only |
| `world` | WorldSize | yes | See below |
| `camera` | CameraConfig | yes | See below |
| `sprites` | map of id → Sprite | yes | Ids unique. Every sprite referenced by a terrain or object must exist |
| `terrain` | list of TerrainType | yes | At least one. Ids unique. Exactly one entry has `base: true` |
| `terrainLayers` | list of TerrainLayer | no | Applied in order after the base terrain |
| `objects` | list of ObjectRule | no | Applied in order after terrain |

### WorldSize

| Field | Type | Rule |
|-------|------|------|
| `width` | integer | 1 to 512 cells |
| `height` | integer | 1 to 512 cells |
| `tileSize` | integer | Source tile size in pixels, 8 to 64. Default 16 |

### CameraConfig

| Field | Type | Rule |
|-------|------|------|
| `zoom.min` | number | > 0 |
| `zoom.max` | number | ≥ `zoom.min` |
| `zoom.default` | number | Within `[min, max]` |

### Sprite

Exactly one of two forms:

| Form | Fields | Rule |
|------|--------|------|
| Sheet | `sheet` (path under `public/`), `x`, `y`, `w`, `h` (pixels) | Rectangle must lie inside the image. The image is loaded once |
| Pixels | `pixels` (list of strings, all the same length), `palette` (map char → CSS colour; `.` is always transparent) | Rows and columns ≥ 1, at most 32×32. Every char in `pixels` must appear in `palette` or be `.` |

### TerrainType

| Field | Type | Rule |
|-------|------|------|
| `id` | string | Unique. Used by layers and rules |
| `name` | string | Display / documentation only |
| `sprite` | sprite id | Must exist in `sprites` |
| `walkable` | boolean | Used later by flies. Recorded now, no effect on rendering |
| `base` | boolean | Optional. Exactly one terrain must be `base: true` |

### TerrainLayer

Modifies the terrain grid after the base fill. Two forms, chosen by `shape`:

| Shape | Fields | Meaning |
|-------|--------|---------|
| `blobs` | `terrain` (id), `count` (int ≥ 0), `radius` (`[min, max]` cells), `on` (list of terrain ids it may replace) | Places `count` round blobs using seeded PRNG |
| `noise` | `terrain` (id), `threshold` (0–1), `scale` (cells, ≥ 2), `on` (list) | Replaces cells where seeded value noise ≥ `threshold` |

`on` is the list of terrain ids the layer may overwrite. Water is laid first, then rocks and trees, so a rock never replaces water.

### ObjectRule

A scatter rule. Each rule places `count` objects.

| Field | Type | Rule |
|-------|------|------|
| `id` | string | Unique |
| `kind` | `"scenery"` \| `"edible"` \| `"danger"` | Used for grouping and future behaviour. Renderer draws all kinds the same way |
| `sprite` | sprite id | Must exist in `sprites` |
| `count` | integer ≥ 0 | Target number of instances |
| `allowedTerrain` | list of terrain ids | At least one. A cell is valid only if its terrain is in this list (FR-016) |
| `minSpacing` | integer ≥ 0 | Minimum distance in cells to another object of any rule. Default 0 |

### Generated world (in memory)

| Entity | Shape | Source |
|--------|-------|--------|
| `TerrainGrid` | `Uint16Array(width × height)` of terrain indices | `generate()` |
| `PlacedObject` | `{ ruleId, kind, sprite, x, y }` (cell coordinates) | `generate()` |
| `GenerationReport` | `{ placed: { [ruleId]: n }, shortfall: { [ruleId]: n } }` | `generate()`. Shortfall lists rules that could not reach `count` |

### ValidationError (in memory)

| Field | Type | Meaning |
|-------|------|---------|
| `path` | string | Location in the config, for example `terrain[2].sprite` |
| `message` | string | Human-readable reason |

### Camera (in memory, runtime state)

| Field | Type | Meaning |
|-------|------|---------|
| `x`, `y` | number | World-pixel position at the canvas top-left |
| `zoom` | number | Screen pixels per world pixel, within `[zoom.min, zoom.max]` |

Camera state is not persisted. Each page load starts at `zoom.default`, centred on the world.

## Relationships

```text
WorldConfig 1 ── 1 WorldSize
WorldConfig 1 ── 1 CameraConfig
WorldConfig 1 ── * Sprite            (keyed by id)
WorldConfig 1 ── * TerrainType       (keyed by id, exactly one base)
WorldConfig 1 ── * TerrainLayer      (applied in order)
WorldConfig 1 ── * ObjectRule        (applied in order)

TerrainType   * ── 1 Sprite
ObjectRule    * ── 1 Sprite
ObjectRule    * ── * TerrainType     (via allowedTerrain)
TerrainLayer  * ── 1 TerrainType     (via terrain)
TerrainLayer  * ── * TerrainType     (via on)
```

## Validation rules (summary)

1. `format` and `version` are checked first. If either is wrong, stop with one error.
2. Each id (sprite, terrain, rule) is unique within its list.
3. Every reference (`sprite`, `terrain`, `allowedTerrain`, `on`) points to an existing id.
4. Exactly one terrain has `base: true`.
5. Numeric ranges: sizes, zoom, counts, thresholds, spacing.
6. Pixel grids are rectangular, within 32×32, and every character is in the palette.
7. Sheet rectangles lie inside the image. (Checked after the image loads. Load errors are reported with path `sprites.<id>.sheet`.)

Validation runs on the parsed JSON before generation. A config that fails any rule produces no world, only the error panel (FR-015).

## State transitions

None. The config is loaded once per page load. The world is generated once from it. Only the camera changes at runtime.
