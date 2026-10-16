# Phase 0 Research: Sketch-Based World Map

Each item resolves one open technical question behind the spec's functional requirements. The spec itself
left no `[NEEDS CLARIFICATION]` markers; these are implementation-level decisions a plan must still make
before data-model/contracts can be written precisely.

## R1 — Grid size and tile scale

**Decision**: Keep `CELL_PX = 32` (unchanged) and size the grid to **64 cols × 40 rows** (2560 × 1280
scene px), aspect ratio 1.6:1.

**Rationale**: `CELL_PX = 32` already equals one fly sprite's full size (`world/README.md`: "Fly sprites
are 32 × 32 pixels (one map cell)"), so "proportional to the size of fly" is satisfied by leaving the
tile-to-fly ratio exactly as every shipped map already has it — the request is about the map's overall
footprint, not the tile unit. The sketch's own aspect ratio (≈1.79:1) and feature count (two land masses
split by water, an edge-forest ring 2-3 tiles thick on every side, a mountain/dune/lava-equivalent band,
and enough room for 8-10 food-trail clusters spaced so neighbouring footprints touch) need more area than
the current 48×32 (1536 px) forager map, but not an order of magnitude more — the simulation's per-tick
cost does not depend on grid size (fly sensing reads the declared channels' sites, not the whole grid), so
the only cost of a larger grid is one-time field-build work at load, same order of magnitude as today.
64×40 gives ~78% more area than 48×32 while staying square-tractable for the edge-forest ring (2-3 tiles)
plus two falloff rings (2 more tiles) without eating the walkable interior.

**Alternatives considered**:
- Keep 48×32 and compress the sketch — rejected: the sketch's two-lake divide and edge-forest ring would
  leave almost no interior, failing FR-011 (dry corridor) and FR-014 (touching food footprints) for lack
  of room.
- Scale `CELL_PX` down (smaller tiles, same pixel budget) — rejected: breaks "proportional to fly size"
  (FR-018), since the fly sprite is a fixed 32×32 px asset; shrinking the tile would make the fly cover
  multiple tiles, changing the sensing and collision model for every existing world.

## R2 — Ring-distance field algorithm for danger and heat

**Decision**: A single-purpose, 8-connected multi-source breadth-first search (BFS) over the boolean
per-cell source mask (edge-forest cells for danger, water cells for heat — water's boolean mask already
exists as `cellWater()` in `world/water.js`), producing an integer tile-step distance per cell, capped at
3 (2 = last non-zero ring, 3 = "beyond", mapped to 0). Intensity = `[1, 0.5, 0.25, 0][min(distance, 3)]`.

**Rationale**: The spec's language ("the forest itself", "neighbor tile", "second neighbor tile") is
explicitly a discrete, tile-grid notion, not a continuous radius. The existing point-sum model in
`fly/stimulus.js` (`senseDistance`/`fruitIntensity`: sum of `falloff(d, radius)` over every source point)
is wrong for a *contiguous* source like a lake shoreline or a forest ring: summing the linear falloff of
every nearby source cell would push values past the intended 50%/25% levels well before the cap, because
many source cells sit within radius of the same sensed point (a shoreline has dozens of water cells near
any one tile, where a handful of standalone "danger" objects today have only one or two). A nearest-source
distance field (what one BFS from all source cells at once gives directly) is the only shape that reads
exactly "100% on the source, 50% one step out, 25% two steps out" regardless of how large or convoluted
the source region is — this is the same reason the shoreline's own visual edge is already built from a
distance transform (`water.js`'s `S` field), not from summed per-pixel contributions. BFS (not the
existing Euclidean EDT in `water.js`) is used because the requirement is explicitly in *tile* steps, and a
multi-source 8-connected BFS gives Chebyshev tile-step distance directly and cheaply (O(cols×rows)),
without the sub-pixel/odd-polygon ambiguity a continuous distance transform would need to be rounded back
to discrete tile rings.

**Alternatives considered**:
- Reuse the summed point-falloff model with the per-cell "reach" set to 2 — rejected per the overshoot
  problem above (verified by hand: a tile adjacent to a 10-cell straight shoreline would sum roughly
  10 × 0.5-ish contributions, clamped at 1.0 instead of the required 0.5).
- Reuse `water.js`'s continuous Euclidean EDT (`S`, already computed for every world with water) for heat,
  rounding `S / CELL_PX` to the nearest tile-step — rejected: `S` is signed sub-pixel distance to a wobbly,
  noise-roughened *visual* shoreline, not to the logical water *cell* grid (`cellWater()`); the two can
  disagree by up to a tile near a concave stretch of shore, which would make "neighbor tile" not mean the
  literal 8-connected neighbour cell. A dedicated cell-grid BFS keeps the simulated meaning and the visual
  art independent, matching how `cellWater()` already exists specifically to give fly logic a tile-grid
  answer separate from the pixel-precise art.

## R3 — New sense sources: `water` and `forestEdge`

**Decision**: Extend `flies.stimuli[sense].from` (today `edibles` | `dangers` | `blocked`,
`world/validate.js` `STIMULUS_SOURCES`) with two new values, `water` and `forestEdge`. Each is sampled
through a new **field** mode, alongside the two existing modes (point-sum `radius`, boolean `contact`) in
`fly/stimulus.js`'s `senseDeclared`: a sense spec carrying `field: true` looks up the precomputed per-cell
intensity (R2) at `floor(at.x), floor(at.y)` through a new `sampler.fieldAt(cx, cy)`, mirroring the
existing `sampler.contactAt(cx, cy)` touch path exactly. `samplerFor` in `forager-step-wide.js` gains two
branches building `fieldAt` from the danger field and the heat field respectively.

**Rationale**: Constitution VI requires the stimulus-to-sense mapping to live in data, not hard-coded
world code — this is exactly the existing `flies.stimuli` declaration mechanism, just pointed at a new
kind of source. Keeping `dangers`/`edibles`/`blocked` and their samplers untouched means no existing world
or test that still uses them (if any, outside the shipped forager-wide world) breaks; the two new sources
are additive. The shipped `world-forager-wide.json`'s `odour:danger`/`heat` entries change from
`{"from": "dangers", "kinds": [...], "radius": ...}` to `{"from": "forestEdge"}` /
`{"from": "water"}` — no `radius` or `kinds` needed since the field is already stepped and the source mask
is unambiguous.

**Alternatives considered**:
- Model edge-forest and water cells as very many individual "danger"/"heat" point objects and reuse the
  existing `dangers` sampler — rejected: this is the overshoot problem from R2 restated, and it would
  require materialising thousands of synthetic point objects for a 64×40 shoreline, which is both slower
  and not declarative (the "objects" wouldn't be real map content, just a hack to drive the old sampler).

## R4 — Food odour: irregular, stepped, per-unit field

**Decision**: Each food unit gets a precomputed per-cell kernel over its own bounding region: ring 0 (the
unit's own cell and its 8 immediate neighbours, i.e. Chebyshev distance ≤ 1) = 1.0; each ring beyond that
steps down by 0.1 per Chebyshev step, using a noise-roughened distance (`fbm`/`vnoise` from `world/water.js`,
the same primitives the shoreline edge already uses) in place of the raw Chebyshev distance, so the ring
boundary is organic rather than a perfect square. Multiple units' kernels combine by **maximum**, not sum,
scaled per-unit by the unit's current stock fraction (today's `p.fraction`) before the max. The combined
per-cell field feeds both the fly's bilateral sampling (replacing today's point-sum `fruitIntensity` for
the `odour:food` sense) and the visualization overlay (replacing today's `odour-field.js`).

**Rationale**: FR-012/FR-013 require an exact 3×3 full-strength core and a roughly-10%-per-ring falloff
with a non-circular, non-square outline — a closed-form radius-based falloff (today's `falloff(d, radius)`,
linear in Euclidean distance) cannot produce a stepped, irregular shape at all, so a precomputed per-cell
kernel is required regardless of the overshoot question. Combining overlapping units by maximum (not sum)
is what FR-014 ("footprints touch or overlap") implies without over-specifying: two touching footprints
should read as one continuous trail at the level of whichever unit is closer, not as a value exceeding
either unit's own peak. Stock-fraction scaling stays dynamic (applied at sample time, not baked into the
static kernel) because a unit's stock changes during a run (depletion/regrowth) while its shape does not.

**Alternatives considered**:
- Keep the existing point-sum model and only add a 3×3 "boost" near each unit — rejected: cannot produce
  the required irregular, non-circular falloff shape, and summing many units' falloffs in the touching
  zone (FR-014) would overshoot the same way R2's rejected alternative does.
- Sum (not max) the per-unit kernels, clamped to 1 — rejected: in the deliberately-overlapping "gently
  touches" zones (FR-014) this would flatten most of the connecting trail to the 1.0 cap, erasing the
  gradient a fly is supposed to follow (FR-015/SC-004), which defeats the point of a *followable* trail.

## R5 — Edge-forest representation

**Decision**: Add `edgeForest` as a new allowed `ground` area `kind` (today `meadow` | `darkGrass` |
`cobble` | `gravel`, `world/validate.js` `SURFACE_KINDS`), painted as a border band in the new world's
`ground` list. `buildLogic` (`world/layout.js`) gains a `forestEdge` boolean array, parallel to its
existing `water` array, set from cells whose ground area is `edgeForest`. Dense tree placement over that
band (groves/scatter, already-existing mechanisms) gives it its visual "deep forest" look; R2's danger
field is built from the `forestEdge` mask.

**Rationale**: This reuses the existing ground-area/patch mechanism (`ground.js`) exactly as `meadow` or
`darkGrass` already work, so no new world-config concept is introduced — only a new enum value and a new
derived boolean array, the same shape `water` already has. "Only the edge forest casts danger odour"
(FR-008) is enforced structurally: interior tree placements (groves/scatter elsewhere on the map) are not
part of the `edgeForest` ground areas, so they are simply absent from the `forestEdge` mask and the danger
field by construction — no separate "is this tree on the edge" check is needed per-object.

**Alternatives considered**:
- Infer "edge" purely from grid position (outermost N columns/rows), with no explicit ground kind —
  rejected: the sketch's forest border is not a perfect rectangle in general (it follows the sketch's own
  outline), and a position-only rule couldn't describe that; an explicit ground area keeps the forest's
  shape sketch-faithful (FR-001) and reuses existing outline shapes (ellipse/polygon) already supported.

## R6 — Guaranteed dry corridor across the water divide

**Decision**: No new runtime logic. The corridor is a property of the authored `waterBodies` outlines in
the new world geometry: the land strip crossing the sketch's water divide is drawn with every cell at
Chebyshev tile-distance ≥ 3 from the nearest water cell (R2's danger-field-style BFS over `cellWater()`
gives 0 heat at distance ≥ 3). This is checked, not built, by a new world-generation test asserting zero
heat-field value and walkability along at least one route between the two sketch-divided areas.
*(Bugfix: 2026-10-15 — BUG-001)* Once R11's river body is added, "nearest water cell" includes the
river's rasterised cells, not just the two lakes' — the corridor's ≥3-tile-step rule is unchanged, but the
corridor must now also clear the river's banks, and R11 renders the corridor itself as `swamp` ground
rather than the plain terrain this decision originally implied.

**Rationale**: FR-011 is a geometry constraint on where water is drawn, not a new mechanism — the heat
field (R2) already makes "zero heat" and "≥ 3 tiles from any water cell" the same statement. Enforcing it
in the map's authored geometry (keeping the corridor wide relative to the lake shapes, per the sketch)
and verifying it with a test is simpler than adding a special-cased "crossing" object or field.

**Alternatives considered**:
- A dedicated "crossing" tile kind that forces zero heat regardless of distance — rejected: this would let
  a corridor sit closer than 3 tiles from water while still reading as safe, which contradicts "every
  water tile... neighbor... second neighbor" being the *only* heat rule (FR-009/FR-010); a true geometric
  gap is more faithful to the spec and needs no exception path.

## R7 — Universal touch for decorations

**Decision**: No new sensing mechanism. The `touch` sense already reads `from: "blocked"` directly off
world walkability (`world/layout.js` `buildLogic`'s `blocked` array, which already folds in every object
with `solid: true` plus every water cell). The work here is authoring-side: every decorative object placed
on the new map (explicit `objects`, grove trees, scatter) is given `solid: true` (explicit objects and
grove trees already default to/require this; scatter objects already default `solid` from sprite class —
extended, where needed, so every decoration class used on the new map, not only `bush`, resolves to solid).
A new `public/tests/layout.test.js` case asserts every object placed by the new map resolves `solid: true`.

**Rationale**: FR-016 ("every decorative object... registers touch") is already true by construction for
any solid object, since `touch` already samples `blocked` generically — this was built for exactly this
purpose in the wide-I/O world (ADR 007 W8). The only gap is making sure the *new map's* decorations are
consistently marked solid; no sensing code changes.

**Alternatives considered**:
- Add a new `from: "decor"` sense source separate from `blocked` — rejected: would duplicate exactly what
  `blocked` already is for solid, non-water objects, with no behavioural difference, violating Simplicity.

## R8 — Four independent visualization overlays

**Decision**: `world/layers.js`'s `LAYERS` grows from one entry (`odour`) to four: `odour-food`,
`odour-danger`, `odour-heat`, `grid`. `initialLayers`/`toggleLayer` are already generic over the `LAYERS`
list, so no change there. `main.js` builds and caches one field-paint canvas per odour layer (food, danger,
heat — each from its own field builder) plus one grid-line canvas (drawn directly from `config.grid`,
no field needed), and composes whichever of the four are currently on, same pattern as today's single
`odourCanvas`. `render/heatmap.js` gains per-channel colour ramps (new `--odour-food-*`, `--odour-danger-*`,
`--odour-heat-*` CSS tokens, falling back sensibly if undefined) so the three odour layers are visually
distinct, and a small pure `gridLines(cols, rows, cellPx)` canvas painter. The World tab's single checkbox
becomes four, one per `LAYERS` entry (already how `panel.js` would iterate a list, since `LAYERS` already
drives the existing single checkbox generically).

**Rationale**: FR-019/FR-020/SC-006 ask for four independently switchable overlays; `layers.js` was already
built generically over a list specifically so more layers could be added later (its own comment: "turning
a layer on or off cannot change the simulation" — still true here, since overlays only ever read already-
built fields). Reusing `heatmap.js`'s existing ramp-from-CSS-token mechanism keeps overlay styling in CSS
(themeable, no JS colour constants to touch per theme) exactly as the current single layer already does.

**Alternatives considered**:
- One combined overlay with a channel selector (radio button) instead of four checkboxes — rejected: the
  spec explicitly asks for independent on/off per channel and for combinations to be visible together
  (FR-020, "all four on or all four off"), which a single-selection control cannot express.

## R9 — Sketch elements excluded or substituted

**Decision**: Title banner, legend/symbol box and animal/NPC figures from the sketch are not placed on the
map at all (no matching atlas class exists for any of them, and the spec explicitly excludes them).
Buildings are placed using only `jungle-prop-004` (`canvas_tent`) and the existing bone/skull prop family
(`beach-prop-027` `cow_skull`, `beach-prop-029` `ribcage`, `beach-prop-032`/`033` `bone_a`/`bone_b`,
`beach-prop-034` `bone_ring_arch`, `beach-prop-035` `animal_skull`, etc.), clustered at each sketched
building's location. The bridge location is drawn as plain walkable ground-area art (no new sprite),
continuing the corridor from R6 if the bridge and the water-divide crossing coincide, as they do in the
sketch. ~~Sketch terrain with no atlas equivalent (the sketch's lava zone) is substituted with the closest
available terrain kind (`gravel`/rock-outcrop art) at the same outline and location, per spec Assumption.~~
**Reversed by R11** *(Bugfix: 2026-10-15 — BUG-001)*: the sketch's desert-family regions (dunes, rocky
desert, lava) are omitted from the map entirely, not substituted — spec FR-025 now overrides the
Assumption this sentence was based on.

**Rationale**: Directly satisfies FR-002 through FR-004 ~~and FR-005~~ *(FR-005's substitution rule, as
narrowed by BUG-001, no longer covers the lava-zone case this rationale originally cited — see R11)*;
`canvas_tent` and the bone/skull family are confirmed present in `public/assets/atlas/catalog.json` (class
`prop`), so no new art is needed.

**Alternatives considered**: None — the spec is explicit enough here that this is a direct restatement,
not a choice between options.

## R10 — Rollout to every shipped, runnable world

**Decision**: The new `ground`/`waterBodies`/`objects`/`groves`/`scatter`/`edibles` block (everything
spec.md's "World Geography" and "Food Odour Area" entities cover) is copied into `world.json`,
`world-connectome.json`, `world-antennal-lobe.json`, `world-forager.json`, `world-forager-11k.json` and
`world-forager-wide.json`. Each file's own `flies`, `experiment`, `grid.cellPx`/`grid.cols`/`grid.rows`
(now the R1 dimensions, shared), `seed`, and brain-specific sections (snapshot path, LIF block,
`flies.stimuli` for the `v2` world) are otherwise left as they are today, except that `world-forager-wide.json`'s
`odour:danger`/`heat` entries are rewritten per R3, and its `dangers` list (now unused — nothing reads it
once `odour:danger`/`heat` no longer declare `from: "dangers"`) is removed. The deliberately-broken
`*-bad.json` fixtures (`world-forager-bad.json`, `world-forager-11k-bad.json`, `world-forager-wide-bad.json`)
are left exactly as they are — their only purpose is to exercise the version/kind mismatch refusal path
(`world/README.md`), which is orthogonal to map content.

**Rationale**: Matches FR-021 and the spec's Assumptions. Keeping each world's own brain/experiment
sections untouched avoids re-triggering calibration work (out of scope — `AGENTS.md`: "behaviour comes
from the brain," config/LIF changes are a separate, recorded decision) while still giving every fly the
same new geography.

**Alternatives considered**:
- Factor the shared map block into one file the other worlds reference — rejected: the current format has
  no include/reference mechanism, and introducing one is a world-format contract change far larger than
  this feature needs (constitution VII, Simplicity); copying the block is what the existing six files
  already do for today's map.

## R11 — River, swamp and desert exclusion *(Bugfix: 2026-10-15 — BUG-001)*

**Decision**: `world_map.jpg` is the same reference picture `zrpg-art/examples/WORLD-SPEC.md`'s
`world.js` already builds into catalogue sprites — that document is an already-reviewed reading of this
exact sketch, not a different source. Three of its ground rules are now inherited into this feature's map
rather than re-derived independently:
1. **River** (WORLD-SPEC §1.7, §4): the sketch's river — entering the map at the top edge, through Lake
   Joy, past the lake-to-lake connector, through Lake Byte, out the bottom edge — is authored as a new
   `waterBodies[].outline.river` body (contract §6, `data-model.md`), in addition to the two `blob` lakes.
   A river `path` point may fall outside the grid (`y < 0` above the top row, `y ≥ rows` below the bottom
   row) exactly as WORLD-SPEC's "It starts above the canvas" / "It ends below the canvas" describes; this
   is what makes the river cross the map's outer edge rather than terminate inside it.
2. **Swamp** (WORLD-SPEC §1.6, §4 "Joy → swamp", "Swamp pools"): the land strip connecting the two lakes
   (R6's dry corridor, where the sketch's bridge sits) is authored as a `ground` area of the new `swamp`
   kind (contract §6) instead of plain `meadow`/`darkGrass`, with pool-and-reed scatter over it — it is
   still land (R6's ≥3-tile-from-water rule still makes it zero-heat), just a different ground kind and
   decoration set.
3. **Edge-forest gap**: WORLD-SPEC §7's border-forest rule explicitly "Leave[s] gaps where the rivers
   cross the top and bottom edges." The `edgeForest` areas authored at the river's two edge crossings
   (north and south) are cut back so the crossing cells are not part of any `edgeForest` outline — without
   this, `forestEdge[k]` would be `1` exactly where the sketch shows a river, not a forest, reading
   maximum danger odour on a crossing the sketch draws as safe open water (spec FR-024).

Conversely, WORLD-SPEC's desert-family ground rules (§5 `dunes`/`desert`, §7 "Cacti only grow in the
desert") are **not** inherited: the user has asked to skip the sketch's dunes, rocky desert and lava
regions outright. This reverses R9's "substitute the lava zone with the closest available terrain"
decision (spec FR-025) — those regions, and their R9-era `gravel-dunes`/`gravel-lava-zone` ground areas
and rock-substitute objects, are removed from `world.json` rather than replaced with anything.

**Second pass, same day**: the river/swamp/forest-gap work above was first implemented with positions and
shapes invented independently (new, arbitrary centre/path coordinates), not actually taken from
WORLD-SPEC's own numbers — which is what "inherit lakes, river and swamp from it" asked for. The lakes,
both rivers and the swamp were re-authored from WORLD-SPEC's reference-px coordinates, converted into
this grid's cells (`sketch-map-authoring-notes.md`'s Conversion section has the factors and the full
per-feature table). The WORLD-SPEC-derived gap between the two lakes (≈4 cells edge-to-edge) turned out
too tight for microfly's coarser 32 px-cell, 3-tile zero-heat abstraction to hold reliably across every
seed this map ships with — each lake's `cy` is nudged ≈1.3–1.6 cells further from the other to restore a
margin that holds for both shipped seeds (2026, 1990), and `slime-hills-scatter`'s `rx` is narrowed
further (6 → 4.5) for the same reason as before. The two WORLD-SPEC river segments feeding Lake Joy
("North river" and "Joy → swamp") are merged into one `river-north` body (same direction, same lake); the
eight separate "swamp pools" are too small to qualify as a `pond`-range water body under this project's
existing `BODY_RANGES` schema and are represented as `swamp` ground + reed scatter only, not as water.

**Rationale**: `world_map.jpg` already has an authoritative, design-reviewed reading as catalogue sprites
("design review... rejected" any deviation per WORLD-SPEC §1); re-deriving the same sketch's water/forest
geometry from scratch (as R6/R9 originally did, before this bugfix) risks exactly the kind of drift
BUG-001 found — two isolated lake blobs with a generic land gap, instead of one continuous river joined to
both lakes by swamp, and a uniform rectangular forest band with no river gap. Reusing the reference
design's river/swamp/gap treatment for the features the user named keeps this map consistent with that
prior review instead of inventing a second, divergent interpretation of the same picture. The desert
exclusion is a direct, explicit user instruction ("skip the deserts"), not a design judgement call.

**Alternatives considered**:
- Model the river as a second, very elongated `blob` per segment instead of a new `river` outline kind —
  rejected: a `blob`'s shape is `r(θ) = 1 + Σ a_k·sin(kθ+φ_k)` around one centre, which cannot express a
  winding path of varying width the way the sketch's river bends between the lakes; it would also fight
  R1's "same tile-to-fly scale" by requiring an unnaturally large `rx`/`ry` to cover the river's length.
- Keep the lake-to-lake connector as plain land (today's R6 choice) and only add the river's north/south
  segments — rejected: the sketch draws the connector itself as part of the same continuous river/wetland
  feature (reeds and a boat are visible there), and WORLD-SPEC treats it as swamp specifically, not as an
  unrelated gap between two disconnected water features; splitting it out would still leave the map
  diverging from the reference reading for the one piece the user explicitly named ("swamp").
- Substitute the dunes/lava regions with a different (non-desert) atlas terrain instead of omitting them —
  rejected: the user's instruction is to skip them, not to re-skin them; omission is the direct reading of
  "skip the deserts," and FR-025 states it that way.
