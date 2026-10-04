# Tasks: Arcade World Setup

**Input**: Design documents from `/specs/001-arcade-world-setup/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/world-config.md, quickstart.md

**Decision confirmed**: The existing `assets/` folder is not used. Terrain and scenery come from Kenney's CC0 packs (research R1, R2). Fruit, honey, fire and spider sprites are authored inline in `world.json` (research R3). Nothing from `assets/` is copied into `public/`.

**Tests**: The spec does not explicitly ask for TDD. The plan (R8) and the constitution require automated tests for the pure modules (validation, generation, camera). Those test tasks are included. They run with `node --test tests/`. Browser behaviour is verified by the manual steps in `quickstart.md`.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2, US3 = P3) so each story can be built and verified on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Every task names the exact file path it creates or changes

## Path Conventions

Static web app rooted at `public/` (plan.md, Project Structure). Tests at repository root in `tests/`. Root `package.json` for the test script only.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton and asset sourcing. Nothing here depends on the app code.

- [X] T001 Create root `package.json` with `"private": true`, `"type": "module"`, `"scripts": { "test": "node --test tests/" }`, and no dependencies, in `package.json`
- [X] T002 Create the page shell in `public/index.html`: `<meta name="viewport">`, `<link rel="stylesheet" href="css/style.css">`, `<canvas id="world">`, `<div id="error-panel" hidden>`, and `<script type="module" src="js/main.js">`
- [X] T003 [P] Create `public/css/style.css` with colour values as tokens on `:root`, full-viewport canvas, `overflow: hidden` on the body, `cursor: grab` on the canvas and `cursor: grabbing` while dragging, and styling for `#error-panel`, in `public/css/style.css`
- [X] T004 [P] Create `public/assets/ATTRIBUTION.md` with a table of columns Asset, Source URL, Author, Licence, Used by, and a first row for the project-authored sprites (fruit, honey, fire, spider) marked "project-authored, same licence as the repository"
- [X] T005 Download Kenney's CC0 Roguelike/RPG 16×16 pack (source: https://opengameart.org/content/kenney-16x16 or kenney.nl). Save the sheet as `public/assets/terrain/roguelike-16.png`. Find the pixel `x`, `y` of 16×16 tiles for grass, water, rock, tree, bush and small rock. If water or rock is missing, use the Kenney Tiny series instead and note the choice. Record each used tile in `public/assets/ATTRIBUTION.md` _(fixed — BUG-001: tiles now from the groups; see sheet table in ATTRIBUTION.md)_

**Checkpoint**: Skeleton and sheet in place. Coordinates for the terrain sprites are known.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config loading, validation, sprite loading and bootstrap. Every user story loads the world through these modules, so they must be done first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Implement seeded PRNG in `public/js/world/prng.js`: export `createPrng(seed)` using mulberry32, returning `next()` (float in [0, 1)) and `int(min, max)` (inclusive). The seed must be an integer 0 to 4294967295 (data-model: `seed`, "0 to 2³²−1")
- [X] T007 [P] Implement seeded value noise in `public/js/world/noise.js`: export `createValueNoise(prng, scale)` returning `sample(x, y)` in [0, 1). Lattice values are drawn from the PRNG in a fixed order at construction. `scale` must be ≥ 2 cells (data-model: `noise` layer, "`scale` (cells, ≥ 2)")
- [X] T008 Implement `validateConfig(config)` in `public/js/world/validate.js`, returning an array of `{ path, message }`, an empty array meaning valid. Check, quoting data-model.md: `format` must equal `"arcade-world"`; `version` must equal `1` and the message must read `unsupported version X; this app supports 1`; `seed` is an integer `0` to `4294967295`; `world.width` and `world.height` are integers `1` to `512`; `tileSize` is an integer `8` to `64`, default `16`; `camera.zoom`: `0 < min ≤ default ≤ max`; pixel sprites are rectangular, at most 32×32, `.` is never in `palette`, and every other character is in `palette`; exactly one terrain has `base: true`; ids are unique within each list; every reference (`sprite`, `terrain`, `allowedTerrain`, `on`) points to an existing id; `threshold` is `0` to `1`; `radius` is `[min, max]` with `1 ≤ min ≤ max`; `kind` is `scenery`, `edible` or `danger`; `allowedTerrain` has at least one entry; `minSpacing` ≥ 0; `count` ≥ 0. If `format` or `version` is wrong, stop with that one error
- [X] T009 [P] Implement `loadWorldConfig()` in `public/js/config/load-world.js`: default path `world/world.json`, overridable with the `?world=<path>` query parameter. Return `{ config }` on success or `{ errors: [{ path, message }] }` on failure. Messages: `Could not load world.json (HTTP <status>)` for HTTP errors, and `world.json is not valid JSON: <parser message>` for parse errors
- [X] T010 [P] Implement `showErrors(errors)` and `hideErrors()` in `public/js/ui/error-panel.js`. Render each error as its `path` and `message` inside `#error-panel`, using `textContent` only (no HTML from config values)
- [X] T011 Implement `loadSprites(spriteConfig, baseUrl)` in `public/js/render/sprites.js`. Sheet form: load each image once (cache by URL) and check the rectangle lies inside the image; on failure report path `sprites.<id>.sheet`. Pixel form: render the grid once into an offscreen canvas at 1 px per cell, cached. Return `{ sprites: Map<id, { source, sx, sy, sw, sh }>, errors }`. Depends on T008
- [X] T012 Implement bootstrap in `public/js/main.js`: load config (T009), validate (T008), load sprites (T011). If any errors occur, call `showErrors` (T010) and stop, drawing nothing. Otherwise call a `startWorld({ config, sprites })` function, which is a placeholder until T021. Depends on T008–T011

**Checkpoint**: Foundation ready. A broken `world.json` shows the error panel, and a valid one reaches `startWorld`.

---

## Phase 3: User Story 1 - Explore a Retro Arcade World in the Browser (Priority: P1) 🎯 MVP

**Goal**: A pixel-art world with grass, water, rocks and trees is rendered in the browser. The mouse drags to pan and the wheel zooms around the cursor, both clamped to the world bounds.

**Independent Test**: Open the app (quickstart §1). The world shows grass, water, rocks and trees. Drag to every edge, and wheel-zoom in and out with the cursor over a tree. The tree stays under the cursor and zoom stops at the limits (quickstart §3, steps 3.1–3.6).

### Tests for User Story 1 (plan R8)

- [X] T013 [P] [US1] Write `tests/camera.test.mjs`: zoom at the cursor keeps the world point under it fixed; zoom clamps to `min` and `max`; drag pan moves the view opposite the drag direction; pan clamps so the viewport stays inside the world; a world smaller than the viewport is centred. Import from `public/js/render/camera.js`
- [X] T014 [P] [US1] Write `tests/generate.test.mjs` terrain tests: the same config gives an identical grid on two runs; the grid is `width × height`; a `water` layer only overwrites cells listed in its `on` array; `rock` never replaces `water` in the shipped config. Import from `public/js/world/generate.js` and `public/world/world.json`

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement pure camera in `public/js/render/camera.js`: export `createCamera({ worldWidthPx, worldHeightPx, zoom: { min, max, default }, viewportWidth, viewportHeight })` with state `{ x, y, zoom }`. Export `panBy(dxScreen, dyScreen)`, `zoomAt(factor, screenX, screenY)` (the world point under the cursor stays fixed), and `resize(w, h)` (keeps the centre). Clamp zoom to `[min, max]` and the view to the world after every change
- [X] T016 [US1] Create `public/world/world.json` (format version 1) with `format`, `version`, `seed: 1990`, `world` (`width: 100`, `height: 100`, `tileSize: 16`), `camera.zoom` (`min: 0.5`, `max: 4`, `default: 2`), sprites `grass`, `water`, `rock`, `tree`, `rock-small`, `bush` in sheet form using the coordinates from T005, terrain `grass` (base), `water`, `rock`, and terrain layers: blobs for water (`count: 6`, `radius: [3, 7]`, `on: ["grass"]`) and noise for rock (`threshold: 0.82`, `scale: 9`, `on: ["grass"]`). Depends on T005 _(fixed — BUG-001: groups and opaque fills added to world.json)_
- [X] T017 [US1] Implement terrain generation in `public/js/world/generate.js`: export `generateTerrain(config)`, returning a `Uint16Array` of `width × height` terrain indices (index into `config.terrain`). Fill with the base terrain, then apply each `terrainLayers` entry in array order. Blobs place `count` round patches with a PRNG radius, replacing only cells whose terrain is in `on`. Noise replaces cells where `sample ≥ threshold` and the cell is in `on`. Create one PRNG from `config.seed` and draw in a fixed order. Depends on T006, T007, T008 _(fixed — BUG-001: generate.js unchanged, PRNG untouched; edges picked at render from the grid in autotile.js)_
- [X] T018 [US1] Extend `public/js/world/generate.js` with `placeObjects(config, grid)`: for each `objects` rule in order, place up to `count` objects at PRNG-chosen cells whose terrain is in `allowedTerrain` and whose Chebyshev distance to every already placed object is at least `minSpacing`. Use at most 50 attempts per requested instance. Return `{ objects, report: { placed, shortfall } }` with counts per rule `id`. Depends on T017
- [X] T019 [US1] Implement the renderer in `public/js/render/renderer.js`: export `createRenderer(canvas, sprites)` and `render(state)`. Draw only terrain cells and objects that intersect the viewport. Set `imageSmoothingEnabled = false`. Scale the canvas backing store by `devicePixelRatio`. Draw objects after terrain, sorted by `y` (stable) so overlaps look right. Depends on T011, T015, T018 _(fixed — BUG-001: renderer draws the opaque base, then group overlays, rounded to device pixels)_
- [X] T020 [US1] Implement input in `public/js/render/input.js`: pointer down, move and up pan by `panBy`. Wheel calls `zoomAt` with factor `1.1` for `deltaY > 0` (zoom out) and `1 / 1.1` for `deltaY < 0` (zoom in); the magnitude of `deltaY` is ignored. Register the wheel listener with `{ passive: false }` and call `preventDefault`. Request a redraw through `requestAnimationFrame` after each change. Depends on T015
- [X] T021 [US1] Replace the `startWorld` placeholder in `public/js/main.js`: generate terrain and objects from the config, create the camera at `zoom.default` centred on the world, create the renderer and input handlers, and redraw on window resize (`camera.resize`). Clear the error panel with `hideErrors`. Depends on T012, T017–T020
- [X] T022 [US1] Add scenery object rules to `public/world/world.json`: `tree` (`kind: scenery`, `count: 300`, `allowedTerrain: ["grass"]`, `minSpacing: 1`), `rock-small` (`kind: scenery`, `count: 60`, `allowedTerrain: ["grass"]`, `minSpacing: 1`), `bush` (`kind: scenery`, `count: 120`, `allowedTerrain: ["grass"]`, `minSpacing: 1`). Depends on T016

**Checkpoint**: User Story 1 works on its own. The world is visible and navigable with terrain and scenery. Quickstart §1 and §3 pass.

---

## Phase 4: User Story 2 - Find Edible and Dangerous Elements in the World (Priority: P2)

**Goal**: Fruits and honey (edible) and fires and spiders (dangers) appear on grass, and each is visually distinct from the others and from the terrain.

**Independent Test**: Open the app and identify every fruit, honey pot, fire and spider at default zoom. Confirm they differ from one another, and that no object sits on water (quickstart §4).

### Tests for User Story 2

- [X] T023 [P] [US2] Extend `tests/generate.test.mjs` with placement tests: every placed object's terrain is in its `allowedTerrain`; no object is on `water`; every pair of objects of a rule is at least `minSpacing` apart (Chebyshev); a rule whose `count` cannot be met (use a tiny inline config) lists the shortfall in `report.shortfall`

### Implementation for User Story 2

- [X] T024 [P] [US2] Author pixel-form sprites in `public/world/world.json` for `apple`, `cherry`, `honey`, `fire` and `spider`. Each is a rectangular grid of at most 16×16 with `.` as transparent, and each sprite has its own palette. Fire and spider colours must not be used by the edible sprites or by the terrain sprites (research R3)
- [X] T025 [US2] Add edible and danger object rules to `public/world/world.json`: `apple` (`kind: edible`, `count: 40`, `allowedTerrain: ["grass"]`, `minSpacing: 2`), `cherry` (`kind: edible`, `count: 40`, `allowedTerrain: ["grass"]`, `minSpacing: 2`), `honey` (`kind: edible`, `count: 25`, `allowedTerrain: ["grass"]`, `minSpacing: 3`), `fire` (`kind: danger`, `count: 12`, `allowedTerrain: ["grass"]`, `minSpacing: 4`), `spider` (`kind: danger`, `count: 20`, `allowedTerrain: ["grass"]`, `minSpacing: 3`). Depends on T024
- [ ] T026 [US2] Verify readability (quickstart §4): run the app at default zoom and at minimum zoom. If any edible sprite is confused with a danger sprite, or any sprite blends into the terrain, adjust its palette in `public/world/world.json` and repeat. Record the final result in `specs/001-arcade-world-setup/quickstart.md` §4. Depends on T025

**Checkpoint**: User Story 2 works on its own. Edible items and dangers are visible, distinct, and placed only on grass.

---

## Phase 5: User Story 3 - Change the World by Editing a Configuration File (Priority: P3)

**Goal**: The world is driven entirely by `world.json`. Changes take effect on reload, invalid configs show clear errors and never a partial world, and the same config always produces the same world.

**Independent Test**: Change one count in `world.json` (for example, `tree` to `50`), reload, and see fewer trees. Break the config (for example, `version: 2`) and see the exact error message with no world drawn (quickstart §5).

### Tests for User Story 3

- [X] T027 [P] [US3] Write `tests/validate.test.mjs`: accepts `public/world/world.json`; rejects each case with the expected `path`: `format` wrong; `version: 2` with the message `unsupported version 2; this app supports 1`; `world.width: 0`; an unknown sprite in `objects[0].sprite`; a pixel row of the wrong length (`sprites.<id>.pixels[N]`); no base terrain; a duplicate terrain id; `zoom.min > zoom.default`; an unknown terrain in `terrainLayers`; a negative `count`
- [X] T028 [P] [US3] Extend `tests/generate.test.mjs` with reproducibility: the same config and seed give identical grids and objects; a different seed changes the grid (FR-013, SC-006)
- [X] T029 [P] [US3] Add `tests/fixtures/small-world.json` (32×32, one base terrain, one object rule, valid per T008) and a test in `tests/generate.test.mjs` that generates from it. This shows the config is data-driven and not hard-coded to `world.json`

### Implementation for User Story 3

- [X] T030 [US3] In `public/js/main.js`, log each `GenerationReport.shortfall` entry with `console.warn`, giving the rule `id` and the missing count. Depends on T018, T021
- [X] T031 [US3] Confirm the error path in `public/js/main.js` and `public/js/ui/error-panel.js`: on any load, validation or sprite error, `#error-panel` lists every error with its `path`, the canvas is not drawn, and the console shows the same messages. Depends on T010, T012

**Checkpoint**: User Story 3 works on its own. Config edits take effect on reload, errors are clear, and the output is reproducible.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and documentation.

- [X] T032 Run the app from `public/` (`python3 -m http.server 8000`) and confirm no console errors on load (quickstart §1 and constitution run check)
- [X] T033 Run `npm test` and confirm every test passes (quickstart §2). Record the output in the feature notes
- [ ] T034 [P] Walk through quickstart §3, §5, §6 and §7 by hand. Note any step that does not match the expected result in `specs/001-arcade-world-setup/quickstart.md`
- [ ] T035 [P] Performance check (SC-001, SC-003, plan Performance Goals): on a 100×100 world, confirm pan and zoom stay under 16 ms per frame in browser devtools. Load a config with `world.width` and `world.height` of 512 and confirm it renders without errors
- [X] T036 Sync `specs/001-arcade-world-setup/contracts/world-config.md` with the shipped `public/world/world.json`: update the Default content table with the final counts, and note any field that changed during implementation
- [X] T037 [P] Make sure `public/assets/ATTRIBUTION.md` lists every external asset used by `world.json` and the source for each sprite _(fixed — BUG-001: ATTRIBUTION.md has the group table and the coordinates)_

---

## Phase 6: Bugfix BUG-001 — Group-consistent terrain

**Purpose**: Remove dark edge pixels and repeated edge tiles. Source: `specs/001-arcade-world-setup/bugs/BUG-001.md`. Measurements: `.specify/bugs/tile-edge-misalignment/sheet-analysis.md`.

**Bugfix**: 2026-10-04 — BUG-001 Updated from bugfix patch

- [X] T038 [US1] Record the tile groups of `public/assets/terrain/roguelike-16.png` in `public/assets/ATTRIBUTION.md`: one row per group with its name, tile range, role of each tile (fill, edge, corner) and opacity. Source: `sheet-analysis.md` section 1. Mark unconfirmed 3×3 roles `[NEEDS CLARIFICATION]`. Depends on T005
- [X] T039 [US1] Add a `groups` field to `public/world/world.json`: for `grass`, `water` and `rock`, a group with named roles (`fill`, edge, corner) pointing to existing sprite ids, using the rectangles from T038. Depends on T038
- [X] T040 [P] [US1] Extend `public/js/world/validate.js` to check `groups`: every role points to a sprite, each group has one `fill`, roles are unique per group. Add cases to `tests/validate.test.mjs`. Depends on T039
- [X] T041 [US1] Implement `public/js/world/autotile.js` (PURE): export a function that chooses the role for one cell from its 8 neighbours, using only neighbours of the same group. Deterministic, no PRNG draws. Depends on T039
- [X] T042 [US1] Extend `public/js/world/generate.js` so that the role of every cell is returned, using T041. The PRNG draw order must not change, so the seed contract (FR-013) holds. Depends on T017, T041
- [X] T043 [US1] Update `public/js/render/renderer.js`: draw each terrain cell's `fill` tile before its edge or corner tile, so transparent pixels never show the page background. Depends on T019, T042
- [X] T044 [P] [US1] Write `tests/autotile.test.mjs`: no cell has a neighbour from a different group in the shipped config; the pick is identical on two runs; a cell with no same-group neighbour gets the `fill` role. Depends on T041
- [X] T045 [US1] Verify with headless Chrome at zoom 2 and at zoom 1.7 (temporary config, deleted afterwards): no dark outline or repeated edge line inside a rock, water or grass area. Record the result in `bugs/BUG-001.md`. Depends on T043
- [ ] T046 [US1] [SUPERSEDED — BUG-001: device-pixel rounding in renderer.js used instead; confirm, or re-open] Integer zoom snapping in `public/js/render/camera.js`, only if the reporter asks for strict pixel alignment. Do not start until answered. Depends on T045

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T005 gates T016 (terrain coordinates)
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational. This is the MVP
- **User Story 2 (Phase 4)**: Depends on US1 (uses the renderer, placement and `world.json` from US1)
- **User Story 3 (Phase 5)**: Depends on US1 (uses `startWorld`, generation and the report). Its test tasks T027–T029 can start once Foundational is done
- **Polish (Final Phase)**: Depends on all stories being complete
- **Phase 6 (BUG-001)**: Depends on T005, T016, T017 and T019 being reopened and fixed. Re-run T032 and T034 after T045

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational. Independent of US2 and US3
- **US2 (P2)**: Builds on the US1 placement and renderer. Its own content is in `world.json` and its tests
- **US3 (P3)**: Builds on US1 generation and the bootstrap. Its tests can run in parallel with US2

### Within Each User Story

- Tests are written alongside the implementation. They should fail before the code they cover is complete
- Pure modules (camera, generate, validate) before browser code (renderer, input, main)
- `world.json` changes (T016, T022, T024–T025) are sequential, because they edit one file

### Parallel Opportunities

- Setup: T003 and T004 can run alongside T001, T002 and T005
- Foundational: T006, T007, T009 and T010 are different files and can run in parallel. T008 and T011 follow
- US1: T013 and T014 are tests, T015 is the camera. These three can run together. T016 is sequential after T005
- US2: T023 (tests) and T024 (sprite art) can run together
- US3: T027, T028 and T029 can run together

---

## Parallel Example: User Story 1

```bash
# Tests and the pure camera together (different files):
Task: "Write tests/camera.test.mjs ..."             # T013
Task: "Write tests/generate.test.mjs terrain tests" # T014
Task: "Implement pure camera in public/js/render/camera.js" # T015
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (including the Kenney sheet)
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart §1 and §3. The world renders, pans and zooms
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → config loads or shows errors
2. + US1 → navigable world with terrain and trees (MVP)
3. + US2 → edible items and dangers on the map
4. + US3 → config-driven behaviour proven by tests and error handling
5. Polish → final verification and docs

---

## Notes

- `[P]` marks tasks that touch different files and have no open dependency
- `[Story]` labels trace each task to its user story in the spec
- Each user story is complete when its checkpoint passes on its own
- Commit after each task or logical group (the optional git hooks can do this)
- Stop at any checkpoint to validate that story alone
- Avoid: editing `world.json` in parallel, and touching anything in `assets/` at the repository root
