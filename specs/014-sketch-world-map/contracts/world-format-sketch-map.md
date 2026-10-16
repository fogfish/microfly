# Contract: World Definition — `edgeForest` Ground Kind and Logic Grid

**Amends**: [specs/005-world-tileset-environment/contracts/world-format.md](../../005-world-tileset-environment/contracts/world-format.md),
[specs/009-food-odour-recalibration/contracts/world-format-v3.md](../../009-food-odour-recalibration/contracts/world-format-v3.md).
Format stays **version 3** — this is an additive, backward-compatible change: every world file valid
under version 3 today stays valid (no existing field is removed, renamed or made stricter).

**Bugfix**: 2026-10-15 — BUG-001 added §6 (`river` `waterBodies` outline, `swamp` ground kind). Still
additive/backward-compatible — version stays 3. See [../bugs/BUG-001.md](../bugs/BUG-001.md).

## 1. New `ground` area kind: `edgeForest`

```json
{ "id": "edge-forest-north", "kind": "edgeForest", "outline": { "polygon": [...] } }
```

- `SURFACE_KINDS` (`public/js/world/validate.js`) becomes `['meadow', 'darkGrass', 'cobble', 'gravel', 'edgeForest']`.
- An `edgeForest` area's `outline` (ellipse or polygon, same shape as any other ground area) marks cells
  that are logically deep forest and, structurally, the only source of danger odour (spec FR-006/FR-008).
- **New validation rule**: at least one `edgeForest` area MUST exist, and the union of its rasterised cells
  MUST include at least one cell on every side of the grid boundary (row 0, row `rows-1`, column 0, column
  `cols-1`) — "the edge of the world is a deep forest." Message:
  `ground must include an edgeForest area touching every side of the map`.
- `ground.js`'s `PATCH_TILES` gains an `edgeForest` entry (dense-canopy tree/terrain sprites) for the art
  layer; this is a rendering detail, not part of this contract's validation surface.

## 2. Logic grid: `forestEdge`

`buildLogic` (`public/js/world/layout.js`) returns a new field, parallel to the existing `water`:

```js
// Returns { cols, rows, cellPx, water, blocked, edible, edibleSize, danger, forestEdge, objects }
```

- `forestEdge`: `Uint8Array(cols × rows)`, row-major, 1 where the cell's centre falls inside an
  `edgeForest` ground area, else 0. Same construction pattern as `water` (via `rasterizeOutline`).
- `forestEdge` cells are **not** added to `blocked` — a fly can walk through edge forest; only the danger
  *odour* is special about it, not its walkability. (If a future world wants edge forest to also block
  movement, that is a separate `objects`/`solid` placement, unrelated to this field.)

## 3. Danger and heat fields (new modules, pure, no DOM)

```js
// public/js/world/danger-field.js
export function dangerField({ forestEdge, cols, rows })
  // → { cols, rows, distance: Uint8Array, intensity: Float32Array }

// public/js/world/heat-field.js
export function heatField({ water, cols, rows })
  // → { cols, rows, distance: Uint8Array, intensity: Float32Array }
```

- `distance[k]`: 8-connected multi-source BFS tile-step distance from the nearest `true` cell in the input
  mask, capped at 3 (`3` means "3 or more steps away").
- `intensity[k] = [1, 0.5, 0.25, 0][distance[k]]`.
- `intensity[k] === 1` for every source cell itself (`forestEdge[k]` or `water[k]` true), `0.5` one
  8-connected step away, `0.25` two steps away, `0` beyond (spec FR-007/FR-009/FR-010, SC-002/SC-003).
- A cell that is itself a source (`forestEdge[k]` or `water[k]` true) always has `distance[k] === 0`,
  regardless of any other nearby source — there is only one mask per field, so no cross-field interaction.
- Pure functions: same `forestEdge`/`water` input always gives the same output; no randomness, no DOM.

**Tests** (`tests/danger-field.test.mjs`, `tests/heat-field.test.mjs`, new):
- A single-cell source gives `1` at that cell, `0.5` at every 8-connected neighbour, `0.25` at every cell
  exactly 2 steps away, `0` at 3 steps away.
- A multi-cell contiguous source (a straight or curved line of `true` cells, as a shoreline or forest ring
  would be) gives **exactly** `0.5` one step out along its whole length, not more — this is the regression
  test for the overshoot problem the point-sum model would have had (research.md R2).
- Determinism: same mask → same output, called twice.
- `distance`/`intensity` arrays are `cols × rows` long, row-major, matching `water`/`forestEdge`.

## 4. Food field (new module, pure, no DOM)

```js
// public/js/world/food-field.js
export function foodKernel({ unitX, unitY, seed })
  // → function(cx, cy) → number in [0, 1], the unit's own static shape, Chebyshev-ring-stepped by 0.1
  //   per ring beyond the 3×3 core, ring boundaries roughened by seeded noise (fbm/vnoise, world/water.js)

export function foodField({ units, cols, rows })
  // units: [{ x, y, seed, stockFraction }]
  // → { cols, rows, values: Float32Array }  -- max over units of foodKernel(unit)(cx, cy) × unit.stockFraction
```

- `foodKernel` support is bounded (effectively 0 beyond ~10 rings); cells outside every unit's support
  read `0`.
- At a unit's own cell and its 8 immediate neighbours (the 3×3 core), `foodKernel(...)(cx, cy) === 1`
  regardless of noise (spec FR-012 is exact, not approximate, for the core).
- Beyond the core, the per-ring step is **approximately** 0.1 (`1 - 0.1 × roughened-ring-index`, where the
  roughened ring index is the Chebyshev ring index perturbed by noise in roughly `[-0.4, 0.4]` so the
  contour is irregular, not `0.1` to the decimal) — spec FR-013 itself says "reduces by 10%... has to be a
  random shape," i.e. approximate by design.
- `foodField`'s combination rule is `max`, not sum (research.md R4) — verified by a test placing two units
  close enough that their cores would overlap under a naive sum and asserting the combined peak stays 1,
  not 2.

**Tests** (`tests/food-field.test.mjs`, new, replaces the now-superseded falloff-shape assertions in
`tests/odour-food.test.mjs` while keeping its placement/sprite/kind checks):
- 3×3 core is exactly 1 for every unit, every seed.
- The footprint's outline (cells where value first drops below 1) is not a perfect square or circle for at
  least one tested seed (an irregularity sanity check — e.g. the set of boundary cells is not identical to
  the Chebyshev-distance-1 ring).
- Two units placed so their supports overlap: the combined field's value in the overlap is `max`, not
  `sum`, of the two kernels (regression test for research.md R4's rejected alternative).
- Stock fraction scaling: halving a unit's `stockFraction` halves its own kernel's contribution but never
  increases another unit's.

## 5. Failure messages (new, this contract)

- `ground must include an edgeForest area touching every side of the map` — world-load validation
  (§1).
- Existing failure message conventions (`world/validate.js`'s `err(path, message)` shape) are reused; no
  new message format is introduced.

## 6. `river` water outline and `swamp` ground kind (BUG-001)

```json
{ "id": "world-river", "outline": { "river": { "path": [[33.5, -2], [34.6, 10.1], [32.1, 17.4], [30.8, 28.0], [32.0, 41]], "width": [2.2, 2.6] } } }
{ "id": "lake-swamp", "kind": "swamp", "outline": { "polygon": [...] } }
```

- `waterBodies[].outline` gains a `river` alternative to `blob`: `{ path: [[x, y], …], width: [w0, w1], widthNoise?: number }`, all in cell units — `path` has ≥ 2 points, `width` has exactly 2 positive entries. Modelled on `zrpg-art/examples/WATER-SPEC.md` §3.2's `river` body kind, scaled from reference px to cells.
- `water.js`'s `buildWaterField` gains a `riverDistance(river, seed)` sibling to `bodyDistance(blob, ...)`: sample a Catmull-Rom spline through `path` (reference: ~2 reference-px steps, scaled to cell-fraction steps here), linearly interpolate `width` by arc length, and compute the signed distance to the union of discs of that radius along the spline, by the same mask → `edt`/`edt` (water/land) pipeline `bodyDistance` already uses. A `path` point may lie outside the grid (`y < 0` or `y ≥ rows`, etc.) — WATER-SPEC's "it starts above the canvas" case — and is valid; `bodyBox`'s padding/clipping logic already handles a body box extending past the world.
- A `river` body's `bodyKind` (`water.js`) classification returns `'river'` (new); `BODY_RANGES` is unaffected — rivers aren't pond/lake-range-checked.
- `SURFACE_KINDS` (`public/js/world/validate.js`) gains `'swamp'`, alongside `edgeForest` from §1: `['meadow', 'darkGrass', 'cobble', 'gravel', 'edgeForest', 'swamp']`.
- `ground.js`'s `PATCH_TILES` gains a `swamp` entry (wet, dark, reed-scattered ground art) — a rendering detail, not part of this contract's validation surface, same as `edgeForest`'s entry in §1.
- `swamp` is an ordinary `SURFACE_KINDS` member with no special validation rule of its own (unlike `edgeForest`'s boundary-touching rule in §1) — it participates in R6/FR-011's zero-heat-crossing check only in that its cells must still be ≥ 3 tile-steps from every water cell (now including river cells) for the crossing to read zero heat.
- **Edge-forest gap**: §1's "touches every side of the grid boundary" rule for `edgeForest` is unchanged structurally, but where a `river` body's `path` crosses the grid boundary, the `edgeForest` area(s) authored at that boundary MUST leave the crossing cells (and their immediate neighbours) outside the `edgeForest` outline, so `forestEdge[k]` is `0` there (spec FR-024). This is an authoring constraint on `world.json`'s `ground`/`waterBodies` content, not a new validator rule — there is no general way to validate "the forest has a gap in the right place" without hard-coding this map's specific geometry into `validate.js`.

**Tests** (extends `tests/water-corridor.test.mjs`, new cases):
- A `river` outline's rasterised cells are all `water[k] === 1` in `buildLogic`'s output, same as a `blob`'s.
- The zero-heat corridor test (already asserts ≥3 tiles from the two lake `blob`s) is extended to assert ≥3 tiles from the river's cells too, over the shipped `world.json`.
- A `path` point outside the grid does not throw and does not affect cells far from the river (padding/clipping regression, mirroring `blob`'s existing out-of-grid tolerance).

## 7. The `map` section: the art pack's reference world map (BUG-002)

**Bugfix**: 2026-10-15 — BUG-002. Still version 3 and additive: a world without `map` is read exactly as before
(§1–§6). See [../bugs/BUG-002.md](../bugs/BUG-002.md).

A world declares **either** a `map` section **or** the tile sections (`ground`, `waterBodies`, `objects`,
`groves`, `scatter`). Having both is refused: `<section> is replaced by "map"; a world has either a sketch map or
tile sections`. `edibles`, `dangers`, `flies` and the rest are unchanged.

`map` is the data block of `zrpg-art/examples/world.js` (WORLD-SPEC.md), authored in **reference px** of the sketch:

| Key | Meaning (WORLD-SPEC §) |
|---|---|
| `reference` | `[width, height]` of the sketch, e.g. `[1376, 768]` (§2) |
| `seed` | layout variation, default 1; the reference's "New variation" seed |
| `water` | `{ seed, density, bodies }`; bodies are `blob`, `island` (`x, y, rx, ry, wobble, harmonics`) or `river` (`path, width [from, to], widthNoise`) (§4) |
| `grounds` | organic areas `{ name, tex, tex2?, tex2At?, soft?, mud?, wet?, rim?, blobs: [[x, y, rx, ry], …] }` (§5) |
| `beach` | the ground area with no shore decor and no road (§4, §6) |
| `decals` | `{ area, max, inset, waterMargin, sprites }`: ground decals on an area (§5) |
| `roads` | `{ texture, textureRows, worn, paths: [{ w, pts }] }`: trampled-grass trails (§6) |
| `border` | `{ left, right, top, bottom, rag, step, fill, gaps: [[from x, to x, "top" \| "bottom"]] }`: the edge forest band (§7) |
| `trees`, `groves`, `keepOut` | tree sprites, grove ellipses, boxes with no trees or scatter (§7) |
| `peaks`, `mountains` | rock sprites and `{ x, y, rx, ry, n }` clusters (§7) |
| `objects` | `["sheet/name", x, y]` hand-placed region objects (§7) |
| `areaScatter` | `{ area, max, spacing, waterMargin, onRoads?, sprites }` (§7) |
| `meadow` | `{ tries, max, spacing, box, mix: [[share, sprites], …] }` (§7) |
| `finish` | `{ warm, glow, vignette }` colours (§8) |

Sprites are `"sheet/name"` (unique in the catalogue; ids move when the art pack regenerates). Food art
(`FOOD_SPRITE_IDS`) and removed art (`REMOVED_SPRITE_IDS`) are refused anywhere in `map` and are filtered out of
the built-in shore decor.

**Scale.** The world keeps its grid. A reference x scales by `sx = cols·32 / reference[0]`, a y by
`sy = rows·32 / reference[1]`, and a length (river and road width, spacing, rag) by `√(sx·sy)`. Distances the
reference gives in world px (tree step 44, jitter, water margins, meadow spacing) are sprite-scale and are not scaled.

**Logic grid** (`world/sketch-map.js` `mapLogic`, used by `buildLogic`):

- `water`: 1 where the drawn water (signed distance S < 0) covers the cell centre.
- `blocked`: water, plus the foot cell of every solid map sprite (class `tree`, `bush`, `rock`, `prop`) on the
  grid. Shore decor is drawn, not solid. No solid sprite stands in the 3 × 3 eating square of an edible.
- `forestEdge`: 1 where the cell centre lies in the border band (outside the river gaps) and is not water. It
  feeds the danger field of §3 unchanged.
- `edible`, `edibleSize`, `danger`: from `edibles` / `dangers`, as before.

**Validation**: `validateConfig` checks the structure of `map`; `validateArt` resolves every sprite, refuses food
and removed art, and, once every reference resolves, refuses an edible or danger on a water cell.

**Rendering** (`world/sketch-paint.js`): grass, shore bands, water at t = 0 and shore decor; ground areas;
roads; sprites (map scenery, food, dangers) sorted by foot y; warm grade, sun glow and vignette. Static.
