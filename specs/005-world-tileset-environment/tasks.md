# Tasks: Detailed World Tileset and Diverse Environment

**Input**: Design documents from `specs/005-world-tileset-environment/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/world-format.md, quickstart.md

**Tests**: Included. The plan and quickstart require `node --test public/tests/` for the pure modules (constitution: "Tests" under Development Workflow). Browser checks are manual, per quickstart.md.

**Organization**: Tasks are grouped by user story (US1–US5, from spec.md) so each story can be built and checked on its own.

**Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch. Reopened tasks are marked ⚠️; new tasks T053–T062 are in Phase 8.

**Bugfix**: 2026-10-05 — BUG-002 Updated from bugfix patch. Reopened tasks are marked ⚠️ (reopened — BUG-002); new tasks T063–T075 are in Phase 9.

**Bugfix**: 2026-10-05 — BUG-003 Updated from bugfix patch. Reopened tasks are marked ⚠️ (reopened — BUG-003); new tasks T076–T082 are in Phase 10.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US5, from spec.md. Setup, Foundational and Polish have no story label.
- Paths are repository-relative. The web root is `public/`.

## Path Conventions

- Web app (static, no build): `public/js/`, `public/css/`, `public/world/`, `public/assets/`
- Pure modules (testable under Node): `public/js/world/`, `public/js/fly/`
- Tests: `public/tests/`
- Art (read-only): `public/assets/atlas/` (`atlas-0.png`, `catalog.json`, `OBJECTS.md`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test harness and a clean starting point

- [X] T001 [P] Create `public/tests/smoke.test.js` with one passing `node:test` case, and confirm `node --test public/tests/` runs
- [X] T002 [P] Add `public/world/world.v1.json` as a copy of the current `public/world/world.json`, so the old world stays available for comparison during the switch

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catalogue, version 2 validation, logic grid and fly wiring. These block all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement the catalogue loader in `public/js/world/catalog.js`: fetch `assets/atlas/catalog.json`, index sprites by `id` and by unique `name`, return `{ catalog, errors }`. Missing or invalid catalogue returns a clear error (spec edge case "Art fails to load")
- [X] T004 [P] Switch the sprite source in `public/js/render/sprites.js` to atlas rectangles: resolve each sprite from its `atlas` rect in `atlas/atlas-0.png`. Keep the existing `loadSprites` return shape `{ sprites, errors }`
- [X] T005 Rewrite the schema check in `public/js/world/validate.js` for format version 2: accept `"version": 2`, refuse any other version with a message naming the version (FR-020). Check `grid` (`cols`, `rows`, `cellPx` = 32) and integer `zoom` steps (`min`, `max`, `default`)
- [X] T006 Implement the logic grid builder in `public/js/world/layout.js`: from water bodies, solid objects, edibles and dangers, build `water`, `blocked`, `edible` and `danger` masks on the 32 px grid. Pure, no DOM (data-model.md, Logic Grid)
- [X] T007 Adapt `public/js/fly/fly-world.js` to read the logic grid from `layout.js` (`blocked` mask and edible cells). Keep `spawnFlies` and the spawn salt unchanged
- [X] T008 [P] Reopened and done (BUG-001; fly size, see T060): Create `public/world/world.json` at format version 2: `grid` 48 × 32 × 32, `zoom` 1 to 4 with default 2, `atlas` path, and the `flies` section carried over from the v1 file
- [X] T009 [P] Add `public/tests/catalog.test.js`: resolves an id and a name, rejects an unknown id with the entry named, and rejects a missing catalogue
- [X] T010 [P] Add `public/tests/validate-v2.test.js`: accepts version 2, refuses version 1 with a clear message, refuses a non-integer zoom step
- [X] T011 [P] Add `public/tests/layout.test.js`: water cells are blocked, a solid object blocks its cell, and the masks are the same size as the grid

**Checkpoint**: Foundation ready. The catalogue loads, version 2 is validated, the logic grid and fly world read from `layout.js`.

---

## Phase 3: User Story 1 - See a Detailed, Compact World Sized for Six Flies (Priority: P1) 🎯 MVP

**Goal**: The world is drawn from the new atlas at a compact size. Art is sharp at every integer zoom, with seam-free ground and varied grass.

**Independent Test**: Open the app. All ground is drawn with new art, pixels stay sharp at zoom 1 to 4, no seams appear when panning, grass shows at least three variants, and all six flies are inside the world (spec US1, quickstart §3–4).

### Tests for User Story 1

- [X] T012 [P] [US1] Add `public/tests/ground.test.js`: the same seed gives the same grass variant at every cell, and at least three grass variants appear over the default grid

### Implementation for User Story 1

- [X] T013 [P] [US1] Reopened and done (reopened — BUG-001): Implement ground placement in `public/js/world/ground.js`: a base layer of 32 px grass tiles (`trees-terrain-001`, `trees-terrain-004`, `trees-terrain-005`, `trees-terrain-007`, ~~`rocks2-terrain-004` to `rocks2-terrain-007`~~ `rocks2-terrain-009`, `beach-terrain-011`) chosen by seed (BUG-001: solid tiles removed; see T055), so no large area repeats one tile (FR-004)
- [X] T014 [US1] Add meadow and dark-grass patches to `public/js/world/ground.js`, drawn over the base for each `ground` area in `world.json`, using `trees-terrain-010`, `trees-terrain-012`, `trees-terrain-002` (FR-004)
- [X] T015 [US1] Implement `public/js/world/compose.js`: create one offscreen canvas sized to grid × 32 px, draw the ground, then draw all objects sorted by foot `y`, each placed by its `anchor` (data-model.md, Placed Object)
- [X] T016 [US1] Rewrite `public/js/render/renderer.js`: draw the composed scene bitmap each frame, then the flies on top. Remove the per-cell roguelike drawing and the autotile calls (plan, Decisions; research R6)
- [X] T017 [US1] Update `public/js/render/camera.js`: integer zoom steps only (1, 2, 3, 4), zoom anchored at the cursor, pan clamped to the world edges (FR-009, FR-010, research R5)
- [X] T018 [US1] Update `public/js/render/input.js` so each wheel step moves to the next integer zoom step, not a fractional one
- [X] T019 [US1] Set `image-rendering: pixelated` on the world canvas in `public/css/style.css` (FR-002)
- [X] T020 [US1] Reopened and done (reopened — BUG-001; connectome path does not load, see T061): Wire `public/js/main.js`: load config → validate → load catalogue and sprites → compose → start renderer. On any error, show the error panel and draw nothing (FR-021)
- [X] T021 [US1] Fill the first ground layout in `public/world/world.json`: base grass, two meadow patches and two dark-grass patches, with no water, plants or trees yet

**Checkpoint**: User Story 1 works alone. The world is drawn from the atlas, sharp and seam-free, with six flies inside it.

---

## Phase 4: User Story 2 - Water Bodies with Rocky Shores (Priority: P2)

**Goal**: ~~Static water bodies with shorelines that run water → sand → grass where a sand ring fits, and rock or pebble art otherwise.~~ Static water bodies (one medium lake, 2–3 small ponds) with a natural waterline, grass shore band, bank face and shore decor, after the art pack's WATER-SPEC (BUG-002).

**Independent Test**: Find each water body. The water is still, no seam shows in its texture, and every edge has sand, rock or pebble art with no bare square edge (spec US2).

### Tests for User Story 2

- [X] T022 [P] [US2] Reopened and done (reopened — BUG-002; superseded by T066: shore decor from `S`): Add `public/tests/shore.test.js`: a round outline picks a sand ring, an irregular outline falls back to pebbles, and every border cell has shore art (SC-004)

### Implementation for User Story 2

- [X] T023 [US2] Reopened and done (reopened — BUG-001; sand removed, see T053): Visual spike (research R1): add `public/tests/shore-fit.html`, which draws `beach-terrain-001` and `beach-terrain-002` over `water-water-001` on grass, and record the fit decision in `specs/005-world-tileset-environment/research.md`
- [X] T024 [US2] Reopened and done (reopened — BUG-001; superseded by T053, T054): Implement `public/js/world/shore.js`: for each water outline, choose `ring96`, `ring56` or `pebble` (as set by `shore`, or `auto`), and return the placements. Pure, no DOM
- [X] T025 [US2] Reopened and done (reopened — BUG-002; water filled per logic cell, not clipped to the outline; superseded by T067): Draw water in `public/js/world/compose.js`: fill each basin with the static frame `water-water-001`, clipped to the outline. The water is never animated (FR-005)
- [X] T026 [US2] Reopened and done (reopened — BUG-001; superseded by T054, T056): Draw shores in `public/js/world/compose.js`: sand rings where `shore.js` picked them, otherwise rock, boulder and pebble art along the border with at least three kinds (FR-012)
- [X] T027 [US2] Reopened and done (reopened — BUG-002; 3 × 3-cell pond and polygon lake; superseded by T071): Add two water bodies to `public/world/world.json`: a pond as an `ellipse` and a lake as a `polygon`, with different shapes and sizes (FR-011, contracts/world-format.md)
- [X] T028 [US2] Reopened and done (reopened — BUG-002; water cells must come from `S`; superseded by T069): Block water cells in `public/js/world/layout.js` from the new water bodies, so flies cannot enter them (FR-016)

**Checkpoint**: User Story 2 works alone. Water is static, and every shoreline has shore art.

---

## Phase 5: User Story 3 - Lively Grass with Plants, Flowers and Bushes (Priority: P2)

**Goal**: Open grass dressed with several kinds of plants and bushes, in clusters and clearings, never on water.

**Independent Test**: Look at any grass area of about one screen. At least three kinds of small vegetation are visible, clusters and clearings both appear, and no plant sits on water (spec US3).

### Tests for User Story 3

- [X] T029 [P] [US3] Add `public/tests/scatter.test.js`: the same seed gives the same layout, no object lands on a water cell, and the clearing share is respected within a tolerance

### Implementation for User Story 3

- [X] T030 [US3] Implement `public/js/world/scatter.js`: seeded scatter of sprites inside an area at a given density, with clearings and the water mask as input. Pure, uses `public/js/world/prng.js` (FR-013, FR-018)
- [X] T031 [US3] Feed scatter results into the scene object list in `public/js/main.js` and `public/js/world/compose.js`, sorted with the other objects by foot `y`
- [X] T032 [US3] Add scatter rules to `public/world/world.json`: flowers (`trees-plant-001`, `trees-plant-002`, `trees-plant-003`, `trees-plant-005`), tufts and ferns (`trees-plant-008`, `trees-plant-010`), and bushes (`trees-bush-001`, `trees-bush-002`, `jungle-bush-008`). This gives at least three plant kinds and two bush kinds (FR-013)

**Checkpoint**: User Story 3 works alone. Grass has vegetation in clusters and clearings, and none is on water.

---

## Phase 6: User Story 4 - Standalone Trees and Groves (Priority: P3)

**Goal**: Single trees and two or more groves of 4 to 12 trees, drawn in front-to-back order, with flies never hidden.

**Independent Test**: Count the single trees and groves. Overlapping trees show the nearer tree in front, and flies remain visible near trees (spec US4).

### Tests for User Story 4

- [X] T033 [P] [US4] Add `public/tests/groves.test.js`: a grove with 3 or 13 trees is refused with a message, a grove with 4 to 12 trees expands to placed objects with `solid` set, and the expansion is deterministic

### Implementation for User Story 4

- [X] T034 [US4] Expand groves in `public/js/world/layout.js`: centre plus `dx`, `dy` offsets become placed objects, each tree marked `solid` (contracts/world-format.md, Objects and groves)
- [X] T035 [US4] Add at least five standalone trees to `public/world/world.json` with `solid: true`, using at least three sizes or shapes (for example `trees-tree-001`, `trees-tree-005`, `trees-tree-006`, `beach-tree-008`) (FR-014)
- [X] T036 [US4] Add two groves to `public/world/world.json`, each with 4 to 12 trees of mixed sizes (FR-014)
- [X] T037 [P] [US4] Add `public/tests/depth.test.js`: objects sorted by foot `y` put the lower tree last in the draw order (FR-006)

**Checkpoint**: User Story 4 works alone. Trees and groves stand in the world, overlapping trees order correctly, and flies stay on top.

---

## Phase 7: User Story 5 - Describe the Map Explicitly in the World Definition (Priority: P3)

**Goal**: Edibles and dangers are declared in the definition, placed off water, with clear errors for bad entries. Flies sense honey and flowers.

**Independent Test**: Move one tree and reshape one water body in `world.json`, reload, and see only those changes. Load the same file twice and get identical worlds. Break an entry and read a clear error (spec US5, quickstart §5–7).

### Tests for User Story 5

- [X] T038 [P] [US5] Add `public/tests/validate-errors.test.js`: unknown sprite id names `objects[n]`, a bad outline shape is refused, an edible or danger on water is refused, a `version` of 1 is refused (SC-009)
- [X] T039 [P] [US5] Add `public/tests/determinism.test.js`: the same definition gives identical layout, scatter and fly spawn, run twice (SC-008)

### Implementation for User Story 5

- [X] T040 [US5] Confirm the fruit sprite (research R2): search the atlas catalogue for a small fruit pickup. If none is found, record "no fruit pickup" in `specs/005-world-tileset-environment/research.md` and keep honey and flowers as the edible kinds
- [X] T041 [US5] Reopened and done (reopened — BUG-002; outlines become `blob` with pond and lake size ranges; superseded by T070): Extend `public/js/world/validate.js` with the errors from T038: unknown art names the entry, outlines must be `ellipse` or `polygon`, groves need 4 to 12 trees, and no edible or danger may sit on water (FR-021, FR-015)
- [X] T042 [P] [US5] Reopened and done (reopened — BUG-003; `fire` / `jungle-prop-002` removed, see T076). Reopened and done (reopened — BUG-001; honey removed, see T058): Add the edible and danger kinds to `public/js/world/layout.js`: `honey` (`jungle-prop-001`), `flower` (`trees-plant-001`, `trees-plant-002`, `trees-plant-003`); `fire` (`jungle-prop-002`), `spider` (`jungle-prop-005`), `lantern` (`jungle-prop-006`) (FR-009)
- [X] T043 [US5] Reopened and done (reopened — BUG-003; spots grouped in a few places and fires listed, see T078). Reopened and done (reopened — BUG-001; honey removed, see T058): Add `edibles` and `dangers` lists to `public/world/world.json`: at least two honey pots, four flower spots, two fires, two spider stand-ins and one lantern, all off water (FR-009)
- [X] T044 [US5] Reopened and done (reopened — BUG-001; honey removed, see T058): Change the fly stimulus in `public/world/world.json` to `"objects": ["honey", "flower"]`, and resolve those kinds to cells in `public/js/fly/fly-config.js` and `public/js/fly/fly-world.js`
- [X] T045 [US5] Show the new error messages in `public/js/ui/error-panel.js` when they are raised, and confirm that no partial world is drawn (SC-009)

**Checkpoint**: User Story 5 works alone. The definition is explicit, errors name the entry, and flies react to honey and flowers.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Retire the old generator, attribute the atlas, and run the full validation

- [X] T046 Remove the old generator and its references: `public/js/world/generate.js`, `public/js/world/noise.js`, `public/js/world/autotile.js`. Confirm with a search that nothing imports them
- [X] T047 [P] Update `public/assets/ATTRIBUTION.md`: credit the new atlas and list the sprites the world uses (FR-023)
- [X] T048 [P] Add a short note to `public/world/` on the version 2 format, pointing to `specs/005-world-tileset-environment/contracts/world-format.md`, as the constitution requires docs in the same change
- [X] T049 Run `node --test public/tests/*.test.js` and confirm every test passes (the directory form `node --test public/tests/` fails on Node 25, so the glob form is used; 50 of 50 pass)
- [ ] T050 Run the viewing checks in `specs/005-world-tileset-environment/quickstart.md` §1 and §3 to §7, against `python3 -m http.server`
- [ ] T051 Check load time: the world is ready in under 3 seconds on a laptop (SC-007), and pan and zoom respond in under 100 ms with six flies running
- [ ] T052 Check the browser console for errors with one fly and the full world (constitution, Run check)

---

## Phase 8: BUG-001 Fixes (Art Roles, Shores, Honey, Fly, World Files)

**Purpose**: Apply BUG-001 (`specs/005-world-tileset-environment/bugs/BUG-001.md`). The reopened tasks above (T008, T013, T020, T023, T024, T026, T042, T043, T044) are superseded by these.

- [X] T053 [US2] Remove sand: delete the `ring96` and `ring56` options from `public/js/world/shore.js`, drop `beach-terrain-001` and `beach-terrain-002` from `public/tests/shore-fit.html`, and remove any `shore` value that selects a sand ring from `public/world/world.json` (FR-012, BUG-001)
- [X] T054 [US2] Reopened and done (reopened — BUG-002; raw rotated reed blocks are a WATER-SPEC anti-pattern; superseded by T065): Rewrite `public/js/world/shore.js` as an overlay placer: transition plants `beach-plant-001` and `beach-plant-003` (rotated 0, 90, 180 or 270 degrees where needed) on the grass beside each water border, and decoration plants `beach-plant-013` to `beach-plant-017` nearby. Replace the `PEBBLES` list of `beach-rock-001` to `beach-rock-003`. Depends on T053 (FR-012, FR-024, FR-025)
- [X] T055 [US1] Update `public/js/world/ground.js`: remove `rocks2-terrain-004` to `rocks2-terrain-007`, and add `rocks2-terrain-009` and `beach-terrain-011` as multi-layer ground. Do not place `outcrop_medium_grass` (`rocks2-rock-035`) as ground; it is an overlay placed by T056. Confirm in the viewing check that the sand edge of `beach-terrain-011` does not show (FR-004, FR-024)
- [X] T056 [US1] Reopened and done (reopened — BUG-002; rotation removed (FR-025); superseded by T067, T068): Split layers in `public/js/world/compose.js`: ground layer for terrain; overlay layer sorted by foot `y` for `rock`, `plant`, `bush`, `prop` and `tree` (including `outcrop_medium_grass`); 90-degree rotation for overlays only. Depends on T054 and T055 (FR-006, FR-024, FR-025)
- [X] T057 [US3] Add the flower and bush kinds to the scatter rules in `public/world/world.json`: `jungle-bush-018`, `jungle-plant-016`, `trees-plant-005`, `jungle-plant-010`, `jungle-plant-015` (FR-013)
- [X] T058 [US5] Remove honey: delete `honey` from `public/js/world/layout.js`, from `public/world/world.json` (edibles and stimulus), and from `public/js/fly/fly-config.js`. Edibles are flowers only. Depends on T042 to T044 (FR-009)
- [X] T059 [P] [US5] Update the docs in the same change: `contracts/world-format.md` (shore values, edible kinds, stimulus), `data-model.md` (edible and shore entries), `research.md` (R1 closed, R2 flower-only) and `quickstart.md` (shoreline and edible checks) (constitution: docs in the same change)
- [X] T060 [P] [US1] Resize the fly to 22 × 22 px: replace the 8 × 8 `fly` and `fly-baseline` pixel grids in `public/world/world.json` with 22 × 22 grids, and check the drawn size at zoom 1 to 4 in `public/js/render/renderer.js` (FR-026)
- [X] T061 [US5] Reopened and done (reopened — BUG-002; connectome world needs the new water bodies; superseded by T072): Migrate `public/world/world-connectome.json` to format version 2, keep its connectome section unchanged for the brain, and check that `?world=world/world-connectome.json` loads with no version error (FR-027, SC-011). Depends on T054 to T058
- [X] T062 [P] [US1] Reopened and done (reopened — BUG-002; extended by T073): Add `public/tests/banned-art.test.js`: fails if `rocks2-terrain-004` to `rocks2-terrain-007`, `beach-terrain-001` or `beach-terrain-002` are used, if `beach-rock-001` to `beach-rock-003` are used as shore art, or if `jungle-prop-001` or honey appears in the world or code (SC-010)

## Phase 9: BUG-002 Fixes (Natural Water Bodies)

**Purpose**: Apply BUG-002 (`specs/005-world-tileset-environment/bugs/BUG-002.md`). Water and shores follow the art pack's water spec (`/Users/kolesnik/devel/go/src/github.com/fogfish/zrpg-art/examples/WATER-SPEC.md`, reference `water.js`, recipes `ponds.md`, `lakes.md`), grass shore style, with no animation. The reopened tasks above (T022, T025, T027, T028, T041, T054, T056, T061, T062) are superseded by these.

- [X] T063 [US2] Implement the pure water field in `public/js/world/water.js`, ported from the reference `water.js`: rasterise each `blob` body (cells → px; `r(θ) = 1 + Σ a_k·sin(kθ + φ_k)`) into a mask padded by `PAD = 48`; exact Euclidean distance transform (Felzenszwalb) inside and outside; `S` with seeded fbm edge noise (`edgeRag` 1.2); `Wsh` 4–11 px from low-frequency noise; `U` and `RUN` for the bank face. Randomness from `mulberry32` and hashed value noise on the world seed. Limit work to each body's box plus `PAD`. No DOM (FR-028, FR-031)
- [X] T064 [P] [US2] Add `public/tests/water.test.js`: the same seed gives the same `S`; `S < 0` at a body centre and `S ≥ 0` far from it; the waterline of a pond and a lake has no straight run over 24 px and no 90° corner; `Wsh` varies along the shore (FR-028, SC-004)
- [X] T065 [US2] Rewrite `public/js/world/shore.js` as a decor placer from `S` (WATER-SPEC §6.1) with the grass-style rules of §4.3, in table order: reed beds (`S` −5…1, at most one on each pond), waterline stones `rocks2-rock-013`, `rocks2-rock-011` (ripple), mossy log `jungle-prop-007` (only if the shoreline is at least 900 px), tufts, sprigs, ferns and wild flowers in their `t` bands, with `per100`, `spacing` and `clear` as listed. Returns `{ id | reedBed, x, y, wet, ripple }` with foot points inside the world. No rotation, no `beach-plant-001`. Pure. Depends on T063 (FR-030)
- [X] T066 [P] [US2] Rewrite `public/tests/shore.test.js`: placement is deterministic; at least one item with `S` in −5…3 in every 100 px of shoreline; no item rotated; no `beach-plant-001`; at most one reed bed on a pond (FR-030, SC-004)
- [X] T067 [US2] Replace the per-cell water fill in `public/js/world/compose.js` with the static water pipeline (WATER-SPEC §3.6–3.8, grass style), baked once: ground ▸ lush band `rocks2-terrain-020` with a ragged, Bayer-dithered outer edge ▸ mud line ▸ water layer (`water-water-001` world-aligned pattern, no drift; green tint; dithered shallow steps; bank face from hole-filled `beach-terrain-007` with an earth tint, waterline, bank shadow and rim; one fixed foam phase) clipped to `S < 0`. Remove the 90° rotation path. Depends on T063 (FR-005, FR-012, FR-025, FR-029)
- [X] T068 [US2] Draw shore decor in `public/js/world/compose.js`: cut reed beds from `beach-plant-003` or `beach-plant-002` into a clump (WATER-SPEC §6.3), draw a ripple ring under wet items (§6.2), and merge decor into the overlay pass sorted by foot `y`. Depends on T065, T067 (FR-006, FR-030)
- [X] T069 [US2] Derive logic water from `S` in `public/js/world/layout.js`: a cell is water (blocked) when `S < 0` at its centre. `validate.js`, `scatter.js` and the edible and danger checks use the same mask. Update `public/tests/layout.test.js`. Depends on T063 (FR-016)
- [X] T070 [US5] Validate water bodies in `public/js/world/validate.js`: `outline` is `{ "blob": { cx, cy, rx, ry, wobble, harmonics } }` in cells; `ellipse` and `polygon` are refused with a message naming the entry; each body must fall in the pond or the lake range of FR-011. Update `public/tests/validate-errors.test.js`. Depends on T069 (FR-011, FR-021)
- [X] T071 [US2] Lay out the water in `public/world/world.json`: one medium lake and 2–3 small ponds in the FR-011 ranges, each with room for its shore band and north-bank decor. Move any tree, grove, scatter area, edible or danger that now falls on water or the shore band. Depends on T069, T070 (FR-011, FR-015)
- [X] T072 [US5] Copy the T071 water bodies and moved entries into `public/world/world-connectome.json`, keeping the connectome section unchanged, and check that it loads with no error (SC-011). Depends on T071
- [X] T073 [P] [US1] Extend `public/tests/banned-art.test.js`: fails on any use of `beach-plant-001`, a raw placement of `beach-plant-002` or `beach-plant-003`, any rotated or mirrored sprite, or the animation frames `water-water-002` to `water-water-021` (SC-010)
- [X] T074 [P] [US5] Update the docs in the same change: `contracts/world-format.md` (`blob` outline, sizes, no `shore` field), `data-model.md` (Water Body, Shore, logic water from `S`), `research.md` (R1 decided by WATER-SPEC), `quickstart.md` (shoreline check = WATER-SPEC §8 without the motion items), `public/world/README.md`, and `public/assets/ATTRIBUTION.md` (new shore sprites; water pipeline after `zrpg-art/examples/water.js`) (constitution: docs in the same change)
- [X] T075 Run `node --test public/tests/*.test.js`, then view the default and connectome worlds: one lake and 2–3 ponds, every WATER-SPEC §8 item except motion passes, nothing moves over 30 s, and load stays under 3 s. Depends on T063 to T074 (SC-004, SC-006, SC-007, SC-012). Result: 62 of 62 public tests and 141 of 141 root tests pass; both worlds show one lake and three ponds with no console errors; build is 445 ms in Chrome; the water is baked into the static scene, so only the flies redraw

## Phase 10: BUG-003 Fixes (Spread Edibles and Dangers, No Fire)

**Purpose**: Apply BUG-003 (`specs/005-world-tileset-environment/bugs/BUG-003.md`). Flowers and dangers are spread over the whole map, and `fire` (`jungle-prop-002` campfire logs) is no longer a danger. The reopened tasks above (T042, T043) are superseded by these.

- [X] T076 [US5] Remove `fire` from `DANGER_SPRITES` in `public/js/world/layout.js`, so `DANGER_KINDS` is `spider` and `lantern` and `validate.js` refuses a `fire` entry with a message naming it. Change `public/tests/validate-errors.test.js` to build its danger-on-water case with `spider`, and add a case that `{ "kind": "fire" }` is refused (FR-009, FR-021)
- [X] T077 [P] [US5] Add `public/tests/spread.test.js` for `public/world/world.json` and `public/world/world-connectome.json`: each of the 3 × 2 regions of 16 × 16 cells holds at least one flower and one danger; no two flowers closer than 6 cells; at least 6 flowers and 5 dangers; both `spider` and `lantern` appear; no `fire` entry; `jungle-prop-002` is not a danger sprite; no scatter rule or shore decor uses `trees-plant-001` to `trees-plant-003` (FR-032, SC-013)
- [X] T078 [US5] Re-author `edibles` and `dangers` in `public/world/world.json` to meet FR-032: at least 6 flowers and at least 5 dangers (spiders and lanterns), at least one of each in every region, flowers at least 6 cells apart, all off water, outside the shore band and not on a solid object's cell. Drop both `fire` entries. Depends on T076 (FR-015, FR-032)
- [X] T079 [US3] Remove `trees-plant-001` to `trees-plant-003` from the `meadow-flowers` scatter rule in `public/world/world.json`. Keep at least three vegetation kinds in the world (for example `trees-plant-005`, `jungle-plant-016`, `jungle-plant-017`) (FR-009, FR-013, FR-032)
- [X] T080 [US5] Copy the T078 edibles and dangers and the T079 scatter rule into `public/world/world-connectome.json`, keeping the connectome section unchanged, and check that it loads with no error. Depends on T078, T079 (SC-011, SC-013)
- [X] T081 [P] [US5] Update the docs in the same change: `contracts/world-format.md` (example danger and allowed kinds: `spider`, `lantern`), `data-model.md` (`danger[cell]` enum, strike the `fire` row; flower art matches `layout.js`), `research.md` (R3: fire dropped, no other fire art; the `jungle-prop-002` note), `quickstart.md` (spread check), `public/world/README.md`, and `public/assets/ATTRIBUTION.md` if it lists `jungle-prop-002` (constitution: docs in the same change)
- [X] T082 Run `node --test public/tests/*.test.js` and the root tests, then view the default and connectome worlds: flowers and dangers in every part of the map, no campfire logs as a danger, flies still reach flowers, no console errors. Depends on T076 to T081 (SC-003, SC-011, SC-013). Result: 75 of 75 public tests and 141 of 141 root tests pass; both worlds load with no console errors; 8 flowers and 6 dangers (3 spiders, 3 lanterns), one or more of each in every region. The south-west lantern was moved from (2.5, 26.5) to (11.5, 29.5) because the oak canopy hid it (FR-008)

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories
- **User Stories (Phases 3–7)**: All depend on Foundational
  - US1 is the MVP. Its checkpoint is the first demo
  - US2 and US3 both build on US1's compose step; US4 and US5 build on US2's water mask
- **Polish (Phase N)**: Depends on the stories being complete
- **BUG-002 (Phase 9)**: T063 first; then T064, T065, T067, T069 (T064, T066 and T073 in parallel); T068 after T065 and T067; T070 after T069; T071 after T069 and T070; T072 after T071; T074 any time; T075 last. T050 (viewing checks) runs after T075
- **BUG-003 (Phase 10)**: T076 first; T077, T079 and T081 in parallel with it; T078 after T076; T080 after T078 and T079; T082 last. T050 (viewing checks) runs after T082

### User Story Dependencies

- **US1 (P1)**: After Foundational. No other story needed
- **US2 (P2)**: After US1 (needs `compose.js` and the renderer)
- **US3 (P2)**: After US1 and US2 (scatter uses the water mask)
- **US4 (P3)**: After US1 (trees are objects in the scene). Uses `layout.js` from Foundational
- **US5 (P3)**: After US2 (edibles and dangers avoid water) and US1 (the fly world reads the layout)

### Within Each User Story

- Tests before the code they cover
- Pure modules (`shore.js`, `scatter.js`, `layout.js`) before the drawing in `compose.js`
- `compose.js` before `renderer.js`
- Data in `world.json` after the code that reads it

### Parallel Opportunities

- Setup: T001 and T002
- Foundational: T004, T008, T009, T010, T011 (different files)
- US1: T012 and T013 start together
- US2 and US3 can overlap once US1 is complete, as long as they touch different files
- Tests marked [P] in each story can run in parallel

---

## Parallel Example: User Story 1

```bash
# Start together (different files):
Task: "T012 Add public/tests/ground.test.js"
Task: "T013 Implement ground placement in public/js/world/ground.js"

# After ground.js is in place:
Task: "T014 Add meadow and dark-grass patches to public/js/world/ground.js"
Task: "T015 Implement public/js/world/compose.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: sharp, seam-free grass at zoom 1 to 4, six flies inside the world
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP demo
3. US2 → water and shores
4. US3 → plants and bushes
5. US4 → trees and groves
6. US5 → explicit definition, edibles and dangers
7. Polish → remove the old generator, attribution, full validation

---

## Notes

- [P] tasks = different files, no dependency on an unfinished task
- [Story] label maps each task to its user story for traceability
- The research spike T023 and the fruit check T040 may change the design. Stop and update `research.md` if they do
- Commit after each task or logical group
- Stop at any checkpoint to check the story alone
