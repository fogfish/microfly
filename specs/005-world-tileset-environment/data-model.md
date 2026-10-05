# Data Model: Detailed World Tileset and Diverse Environment

Two layers share one world. The **scene** is drawn at native art size and placed at continuous
coordinates. The **logic grid** is 32 px cells and drives the fly's movement and senses.

## Atlas Sprite (read-only, from `public/assets/atlas/catalog.json`)

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable reference, e.g. `jungle-prop-002`. |
| `name` | string | Readable slug, e.g. `campfire_logs`. Used in `world.json` as an alias when unique. |
| `class` | enum | `tree`, `bush`, `plant`, `rock`, `terrain`, `prop`, `water`. |
| `atlas` | rect | `{index, x, y, w, h}` inside `atlas-N.png`. |
| `anchor` | point | Foot point in sprite pixels. The sprite's base is placed on the world point. |
| `shadow` | bool | Shadow is baked in. Never add another. |
| `w`, `h` | int | Size in art pixels. Not uniform across sprites. |

**Validation**: Every `id` used by the world must exist. Unknown ids fail with the entry name
(FR-021).

## Logic Grid (derived, not stored)

Built by `layout.js` from the declarations.

| Field | Type | Meaning |
|---|---|---|
| `cols`, `rows` | int | Grid size in cells. Default 48 × 32. |
| `cellPx` | int | 32. One logic cell is one 32 px square of the scene. |
| `water` | Uint8 mask | 1 where the drawn water covers the cell centre (`S < 0` there, BUG-002). Blocks movement. |
| `blocked` | Uint8 mask | 1 where a solid object or water sits. Blocks movement. |
| `edible[cell]` | enum or none | `flower` on this cell. Read by the fly stimulus. |
| `danger[cell]` | enum or none | `spider` or `lantern` (`fire` removed, BUG-003). Read by the fly world. |

**Rules**: Trees, bushes, large rocks and water block. Plants, flowers, pebbles and shore art
do not block. Edibles and dangers never occupy a water cell (FR-015).

## Water Body

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique name. |
| `outline` | `blob` in cells | Wobbly ellipse: `cx`, `cy`, `rx`, `ry`, `wobble`, `harmonics` (BUG-002, FR-028). |

**Rules**: Each body is a pond or a lake by its size range (FR-011). The default world has one lake
and 2 to 3 ponds. Its border is always the grass shore style (FR-012).

## Water Field (derived, not stored)

Built by `water.js` from the water bodies and the world seed (BUG-002).

| Field | Type | Meaning |
|---|---|---|
| `S` | Float32 per scene px | Signed distance to the waterline: < 0 in water, >= 0 on land. Roughened by seeded noise. |
| `Wsh` | Float32 per scene px | Local shore band width, 4 to 11 px. |
| `U`, `RUN` | Float32 per scene px | Vertical water run data for the bank face on north banks. |
| `bodies` | list | Per body: `id`, `kind` (pond or lake), box, shoreline length. |

## Shore Decor (derived, not stored)

Placed by `shore.js` from the water field, by the grass rules of WATER-SPEC §4.3. Each item is a
sprite or a reed bed at a foot point in cells, with `wet` and `ripple` flags. Decor does not block.
It joins the overlay layer sorted by foot `y`. No item is rotated or mirrored.

## Ground Area

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique name. |
| `kind` | enum | `grass` (base), `meadow` (light patch), `darkGrass` (dark patch). |
| `outline` | cell polygon or ellipse | Where the patch sits. Outside all areas, base grass applies. |
| `sprites` | list of atlas ids | Ground pieces used for this kind. |

**Rules**: The base is always opaque grass (FR-004, FR-021 from 001). Patches are drawn over
the base, so transparent edges show grass, not the page.

## Placed Object (scene)

| Field | Type | Meaning |
|---|---|---|
| `sprite` | atlas id | What to draw. |
| `x`, `y` | number | Foot point in cells (continuous, e.g. 12.5, 7.0). |
| `footprint` | enum | `solid` (blocks a cell), `none` (decoration). |
| `group` | string, optional | Name of the grove or cluster it belongs to. |

**Drawing**: The scene bitmap places the sprite so that its `anchor` sits at `(x, y)` in cell
units × 32 px. Objects are drawn in ascending `y` (front to back).

## Grove

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique name. |
| `centre` | point (cells) | Centre of the group. |
| `trees` | 4 to 12 placed objects | Trees with `sprite` and `x`, `y` offsets. Mixed sizes or shapes (at least three kinds across the world). |

## Scatter Rule

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique name. |
| `area` | ground area or polygon | Where to scatter. |
| `sprites` | list of atlas ids | Plants and bushes to pick from. |
| `density` | number | Expected objects per cell inside the area. |
| `clearings` | number | Share of the area kept open, 0 to 1. |
| `seed` | int | Stored in the definition so the layout is reproducible (FR-018). |

## Edible and Danger Kinds

| Kind | Role | Sprite | Notes |
|---|---|---|---|
| `flower` | edible | `trees-plant-001/002/003` | Several kinds, one role. Not used by scatter or shore decor (FR-032, BUG-003). |
| ~~`fire`~~ | ~~danger~~ | ~~`jungle-prop-002` campfire_logs~~ | Removed (BUG-003): campfire logs are not a danger. |
| `spider` | danger | `jungle-prop-005` skull_spear_banner | Stand-in; see research R3. |
| `lantern` | danger | `jungle-prop-006` oil_lantern_post | Third danger kind. |

Fruit is not yet a kind (research R2).

## World (root)

| Field | Type | Meaning |
|---|---|---|
| `format` | string | `arcade-world`. |
| `version` | int | `2`. Other versions are refused (FR-020). |
| `name` | string | Display name. |
| `seed` | int | Seed for scatter rules and fly spawn. |
| `grid` | `{cols, rows, cellPx}` | 48, 32, 32. |
| `zoom` | `{min, max, default}` | Integer steps only, e.g. min 1, max 4, default 2 (research R5). |
| `ground` | list of ground areas | Patches over the base. |
| `waterBodies` | list | See Water Body. |
| `objects` | list of placed objects | Scenery and decoration. |
| `groves` | list of groves | Standalone and mid-size groups of trees. |
| `scatter` | list of scatter rules | Plants and bushes. |
| `edibles` | list | Each `{kind, x, y}` in cells, not on water. |
| `dangers` | list | Each `{kind, x, y}` in cells, not on water. Edibles and dangers are spread over the map (FR-032). |
| `flies` | section | Unchanged except `stimulus.objects` now names `honey` and `flower`. |

## Relationships

- A **Water Body** owns a **Shore** and blocks **Logic Grid** cells.
- A **Grove** is a list of **Placed Objects**.
- A **Scatter Rule** creates **Placed Objects** from its seed.
- **Edibles** and **Dangers** are on the **Logic Grid** and never on water.
- **Flies** read the **Logic Grid** for movement and the edible cells for their stimulus.
