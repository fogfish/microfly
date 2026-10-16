# Phase 1 Data Model: Sketch-Based World Map

Entities from spec.md's Key Entities, made concrete against the existing world-config/logic-grid shape
(`public/js/world/validate.js`, `layout.js`, `water.js`) and the research decisions in `research.md`.

**Bugfix**: 2026-10-15 — BUG-001 added the `river` `waterBodies` outline kind and the `swamp` `ground`
kind (below), and reversed R9's "substitute the lava zone with gravel" decision — desert-family terrain
is now omitted, not substituted. See [bugs/BUG-001.md](bugs/BUG-001.md).

## World Geography

The shared map, authored once and copied into every shipped world file (R10).

| Field | Shape | Notes |
|---|---|---|
| `grid.cols`, `grid.rows` | integers | 64 × 40 (R1). `grid.cellPx` stays 32, unchanged. |
| `ground` | list of `{ id, kind, outline }` | `kind` gains `edgeForest` alongside existing `meadow`/`darkGrass`/`cobble`/`gravel` (R5), and now also `swamp` (BUG-001): wet, reedy ground connecting the sketch's two lakes, rendered with dedicated `PATCH_TILES` art (`ground.js`), not plain `meadow`/`darkGrass`. An `edgeForest` area's outline follows the sketch's forest border, not necessarily the grid's rectangle edge, and leaves a gap where the sketch's river crosses that border (BUG-001, spec FR-024). |
| `waterBodies` | list of `{ id, outline: { blob } }` or `{ id, outline: { river } }` *(BUG-001)* | `blob` unchanged (`cx, cy, rx, ry, wobble, harmonics`). New `river` outline: `{ path: [[x, y], …], width: [w0, w1], widthNoise? }`, cell-unit coordinates, modelled on `zrpg-art/examples/WATER-SPEC.md` §3.2's `river` body kind (Catmull-Rom spline through `path`, width linearly interpolated start→end along arc length, stamped as a disc per sample) — rasterised into the same padded mask/exact-distance-transform pipeline `water.js` already runs for `blob`, so `cellWater`/heat-field sourcing need no change once the mask includes river cells. The sketch's water is the two lakes plus one river running edge-to-edge through both of them (not just "one or more bodies" of unspecified shape); the swamp strip between the lakes (R6's dry corridor) stays land, routed so every one of its cells is ≥3 tiles from **every** water body including the river. |
| `objects` | list of `{ id, sprite, x, y, solid }` | Building stand-ins (`jungle-prop-004` tent, bone/skull props) and any other explicit single placements. `solid: true` on every decorative placement (R7). |
| `groves`, `scatter` | unchanged shapes | Used for dense edge-forest tree cover and other scattered decoration (mountains-as-rock, swamp reeds/pools, etc.). ~~dune vegetation, etc. — substituted terrain per R9 where the sketch has no atlas match~~ *(Bugfix: 2026-10-15 — BUG-001)*: desert-family scatter (dune vegetation, lava substitutes) is removed, not placed — see `research.md` R9's reversal. |
| `edibles` | list of `{ sprite, x, y, kind }` | Food item placements (see **Food Odour Area** below); positions chosen so footprints touch (FR-014). |
| `dangers` | **removed** from the new map (R10) | No longer read once `odour:danger`/`heat` stop declaring `from: "dangers"` (R3). Spider/lantern props, if present at all, are ordinary `objects` with `solid: true` (touch only). |

**Validation rules** (extends `world/validate.js`):
- `SURFACE_KINDS` gains `'edgeForest'` and, *(BUG-001)*, `'swamp'`.
- A new rule requires at least one `ground` area of kind `edgeForest` whose cells, unioned, lie on (or
  touch) the grid's outer boundary — "the edge of the world is a deep forest" (spec US2).
- A new rule (test-level, not necessarily a hard validator error) asserts a walkable, zero-heat route
  exists between every pair of areas the water divides (R6) — implemented as a `public/tests` connectivity
  test over the shipped map, mirroring the existing `tests/odour-food.test.mjs` SC-003 connectivity check
  pattern, rather than a generic validator rule (the "two areas" concept is specific to this map's water
  layout, not a general world-format requirement). *(BUG-001: this route now also has to clear the river's
  banks, not just the two lakes' shorelines.)*
- *(BUG-001)* `waterBodies[].outline.river.path` MUST have at least 2 points, and `width` MUST have
  exactly 2 positive entries (`[w0, w1]`) — same shape of check `validate.js` already runs on `blob`'s
  `rx`/`ry`.

**Derived logic-grid fields** (`layout.js` `buildLogic`, extends existing `{ water, blocked, edible,
edibleSize, danger, objects }`):

| Field | Shape | Derivation |
|---|---|---|
| `forestEdge` | `Uint8Array(cols × rows)` | 1 where the cell's ground area has `kind: "edgeForest"`, else 0. Parallel to the existing `water` array. |

## Danger Odour Field

| Field | Shape | Derivation |
|---|---|---|
| `distance` | `Uint8Array(cols × rows)` | Multi-source 8-connected BFS tile-step distance from `forestEdge` cells, capped at 3 (R2). |
| `intensity` | `Float32Array(cols × rows)` | `[1, 0.5, 0.25, 0][distance[k]]`. |

- Built once per world load (pure function, no DOM), from `logic.forestEdge`.
- Sampled by the fly's `odour:danger` sense (when declared) via the new `field` mode (R3), at the
  channel's declared body site, nearest-cell lookup (`floor(x), floor(y)`), same as the existing `touch`
  `contactAt` lookup.
- Sampled by the danger overlay (R8) at sub-cell resolution for painting (same per-cell value repeated
  across the cell's pixels — no sub-cell interpolation, since the field is itself a step function).

## Heat Odour Field

Identical shape and derivation to the Danger Odour Field, source mask `logic.water` (already exists) in
place of `forestEdge`. Sampled by the `heat` sense and the heat overlay the same way. *(BUG-001: once
`waterBodies` includes the river, `logic.water` includes its cells automatically — no change to this
field's derivation, only to what counts as a source cell upstream in `water.js`/`cellWater`.)*

## Food Odour Area / Food Odour Field

| Concept | Shape | Derivation |
|---|---|---|
| Per-unit kernel | function `(cell) → [0, 1]` | For a unit at cell `(ux, uy)`: Chebyshev distance `d` to `(ux, uy)`, roughened by seeded noise (`fbm`/`vnoise`, R4); `d ≤ 1` → `1.0` (the 3×3 core, FR-012); beyond that, `max(0, 1 - 0.1 × roughened-ring-index)` (FR-013). Kernel support (where it's non-zero) is bounded — roughly 9-10 rings, matching "reduces by 10%... down to zero." |
| Combined field | `Float32Array(cols × rows)` | `max` over every food unit's `kernel(cell) × stockFraction(unit)` (R4), evaluated at load for the overlay and per-sample for the fly (stock fraction changes at runtime; the kernel shape itself is cached per unit since units don't move). |

- Replaces today's point-sum `fruitIntensity`/`odourField` path for the `odour:food` sense and the food
  overlay. The bilateral taste/leg-taste senses, which already use `contact`/`scaleBy: "stock"` against
  the `edibles` point list directly (not the odour field), are unaffected.
- **Validation/placement rule**: food units are placed so every unit's footprint (kernel support) touches
  or overlaps at least one other unit's footprint, and the touching graph over all units is connected
  (FR-014/FR-015) — checked by a connectivity test over the combined field, analogous to the existing
  `tests/odour-food.test.mjs` SC-003 check.

## Decorative Object

Not a new structural entity — an existing `objects`/grove-tree/scatter placement with `solid: true`
(R7). Listed here because spec.md names it as a Key Entity: a tree, rock, tent, bone/skull piece, or any
other non-food, non-water placement that must resolve `solid: true` in `buildLogic`'s `blocked` array, so
the existing `touch` (`from: "blocked"`) sense reports contact on it.

## Visualization Overlay

| Field | Shape | Derivation |
|---|---|---|
| `LAYERS` | `[{ id, label }]` | `world/layers.js`, grows from `[{ id: 'odour', ... }]` to four entries: `odour-food`, `odour-danger`, `odour-heat`, `grid` (R8). |
| Layer state | `{ [id]: boolean }` | `initialLayers()`/`toggleLayer()` — unchanged functions, now operating over 4 ids instead of 1. All start `false` (existing FR-002 of spec 007, carried forward). |
| Per-layer canvas | `HTMLCanvasElement \| null` | `odour-food`/`odour-danger`/`odour-heat` each paint their field through `render/heatmap.js`'s `paintField` with a distinct CSS-token ramp; `grid` paints cell-boundary lines directly from `config.grid`, no field dependency. Built/cached lazily the first time its layer is switched on, same pattern as today's single `odourCanvas` (`main.js`). |

## Relationships

- **World Geography** is the input to every field (`forestEdge` → Danger Field, `water` → Heat Field,
  `edibles` → Food Field) and to the Decorative Object touch check.
- **Danger/Heat/Food Fields** are each sampled two ways: by the fly's declared senses (`fly/stimulus.js`,
  main thread, pre-worker) and by the matching **Visualization Overlay** layer (`main.js`/`heatmap.js`) —
  both read the same field-building function, so the overlay always shows exactly what a fly would sense
  at that point (continuing the invariant `world/odour-field.js`'s header comment already states for food).
- **Visualization Overlay** state is purely local UI state (`world/layers.js`'s existing header comment:
  "nothing under fly/ or brain/ imports it... turning a layer on or off cannot change the simulation") —
  unchanged by this feature, just generalised from one layer to four.
