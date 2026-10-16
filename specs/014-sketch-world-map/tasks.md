---

description: "Task list template for feature implementation"
---

# Tasks: Sketch-Based World Map

**Input**: Design documents from `/specs/014-sketch-world-map/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The feature's contracts (`contracts/*.md`) explicitly name new/extended test files per change, and `AGENTS.md`'s Contracts rule requires "contract tests on both sides" for any snapshot/protocol/world-config change — this feature's `npm test` + `node --test public/tests/*.test.js` gate is not optional here.

**Organization**: Tasks are grouped by user story (spec.md US1–US7, in priority order P1/P1/P1/P1/P2/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1–US7)
- Every task names its exact file path(s)

## Path Conventions

Single static web app (`plan.md`'s Structure Decision): `public/js/world/`, `public/js/fly/`, `public/js/render/`, `public/js/ui/`, `public/world/`, tests in `tests/` (Node test runner) and `public/tests/` (DOM-free world-generation tests).

**Bugfix**: 2026-10-15 — BUG-001 reopens T001, T015, T019, T031, T032 and T051–T057 (the map-geometry
tasks and their rollout/verification) and adds T060–T067 (Phase 11) for the new `river` outline, `swamp`
ground kind, the edge-forest river gap, and the desert-region removal. See [bugs/BUG-001.md](bugs/BUG-001.md).

---

## Phase 1: Setup

**Purpose**: Turn the sketch into a concrete sketch-to-grid mapping before any JSON is authored.

- [X] T001 ⚠️ Reopened (BUG-001) Create `specs/014-sketch-world-map/sketch-map-authoring-notes.md`: map `world_map.jpg`'s landmasses, water bodies, forest border, mountain/dune/lava regions, building sites and food-cluster sites onto the 64×40 grid chosen in `research.md` R1, and record the exact atlas sprite ids to use for buildings (`jungle-prop-004` canvas_tent) and bone/skull decoration (`beach-prop-027` cow_skull, `beach-prop-029` ribcage, `beach-prop-032`/`beach-prop-033` bone_a/bone_b, `beach-prop-034` bone_ring_arch, `beach-prop-035` animal_skull) per `research.md` R9. **(reopened — BUG-001)**: rewrite the "River Passage / bridge crossing" row for the river + swamp (research.md R11) and drop the "The Dunes"/"Lava Zone" rows per FR-025 instead of recording a substitution for them.

**Checkpoint**: Authors have a concrete coordinate/sprite reference before touching `public/world/world.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, logic-grid and field-builder infrastructure every later story depends on.

**⚠️ CRITICAL**: No user story task may start until this phase is complete.

- [X] T002 Add `'edgeForest'` to `SURFACE_KINDS` and add the rule "ground must include an edgeForest area touching every side of the map" in `public/js/world/validate.js` (contracts/world-format-sketch-map.md §1).
- [X] T003 [P] Add an `edgeForest` entry to `PATCH_TILES` in `public/js/world/ground.js` for edge-forest ground art (contracts/world-format-sketch-map.md §1).
- [X] T004 [P] Add a `forestEdge` boolean array (`Uint8Array(cols × rows)`, parallel to the existing `water` array) to `buildLogic`'s return value in `public/js/world/layout.js` (contracts/world-format-sketch-map.md §2).
- [X] T005 [P] Create `public/js/world/danger-field.js` exporting `dangerField({ forestEdge, cols, rows })`: 8-connected multi-source BFS tile-step distance from `true` cells in `forestEdge`, capped at 3, mapped through `[1, 0.5, 0.25, 0]` to `{ cols, rows, distance, intensity }` (contracts/world-format-sketch-map.md §3, research.md R2).
- [X] T006 [P] Create `public/js/world/heat-field.js` exporting `heatField({ water, cols, rows })`, the same BFS/step algorithm as T005 sourced from `water` instead of `forestEdge` (contracts/world-format-sketch-map.md §3).
- [X] T007 [P] Create `public/js/world/food-field.js` exporting `foodKernel({ unitX, unitY, seed })` (Chebyshev distance ≤ 1 → 1.0 for the 3×3 core; beyond that, `max(0, 1 - 0.1 × roughened-ring-index)` using `fbm`/`vnoise` from `public/js/world/water.js` to roughen the ring boundary) and `foodField({ units, cols, rows })` combining every unit's `kernel(cell) × stockFraction` by **maximum**, not sum (contracts/world-format-sketch-map.md §4, research.md R4).
- [X] T008 [P] Add a `field` sensing mode to `senseDeclared` in `public/js/fly/stimulus.js`: when `spec.field` is set, return `sampler.fieldAt(Math.floor(at.x), Math.floor(at.y))`, alongside the existing `contact` and point-sum (`radius`) modes (contracts/stimuli-field-sources.md §3).
- [X] T009 Extend `STIMULUS_SOURCES` in `public/js/world/validate.js` to `['edibles', 'dangers', 'blocked', 'water', 'forestEdge']` and add the rule forbidding `kinds`/`scaleBy`/`radius` when `from` is `"water"` or `"forestEdge"`, with message `flies.stimuli.${sense} must not set ${key} when from is "${spec.from}"` (contracts/stimuli-field-sources.md §2; depends on T002 — same file).
- [X] T010 [P] Create `tests/danger-field.test.mjs`: single-cell source gives 1/0.5/0.25/0 at distance 0/1/2/3; a contiguous multi-cell source gives exactly 0.5 one step out along its whole length (no overshoot); determinism (contracts/world-format-sketch-map.md §3 Tests; depends on T005).
- [X] T011 [P] Create `tests/heat-field.test.mjs`, the same cases as T010 against `heatField` (depends on T006).
- [X] T012 [P] Create `tests/food-field.test.mjs`: exact 3×3 core; non-circular/non-square footprint outline for at least one seed; `max`-not-`sum` at an overlap; stock-fraction scaling never raises another unit's contribution (contracts/world-format-sketch-map.md §4 Tests; depends on T007).
- [X] T013 [P] Extend `tests/stimulus-declared.test.mjs` with a `spec.field: true` case asserting `senseDeclared` returns exactly `sampler.fieldAt(...)`'s value (contracts/stimuli-field-sources.md §6; depends on T008).

**Checkpoint**: Field builders and the new sensing/validation plumbing exist and are unit-tested in isolation — no world JSON has been touched yet.

---

## Phase 3: User Story 1 - A World Shaped Like My Sketch (Priority: P1) 🎯 MVP

**Goal**: `public/world/world.json` carries new terrain/water geometry reproducing `world_map.jpg`'s shapes, atlas-only, tent/bone buildings, no bridge/title/legend/animal art, sized to the 64×40 grid.

**Independent Test**: Open `?world=world/world.json`, compare the rendered map to `world_map.jpg` side by side (spec SC-001).

### Implementation for User Story 1

- [X] T014 [US1] In `public/world/world.json`, set `grid` to `{ "cols": 64, "rows": 40, "cellPx": 32 }` and update `name` to describe the new sketch-based map (research.md R1).
- [X] T015 [US1] ⚠️ Reopened (BUG-001) Author `ground` areas (including at least one `edgeForest` area touching every grid side, satisfying T002's rule) and `waterBodies` outlines in `public/world/world.json` reproducing the sketch's landmass and water shapes and relative positions, using T001's sketch-to-grid mapping. **(reopened — BUG-001)**: add the sketch's river as a `waterBodies[].outline.river` body (contract §6, depends on T060) entering/exiting the grid's edges through both lakes; add a `swamp` ground area (depends on T061) connecting the two lakes in place of the plain-land corridor; cut the `edge-forest-north`/`edge-forest-south` outlines back so the river's two edge crossings are not part of any `edgeForest` area (FR-024); remove the `gravel-dunes`/`gravel-lava-zone` ground areas per FR-025.
- [X] T016 [US1] Author the sketch's bridge location in `public/world/world.json` as plain walkable ground-area terrain (part of T015's outlines) — place no bridge sprite there.
- [X] T017 [US1] Place building stand-ins in `public/world/world.json`'s `objects` list at each sketched building location, using only `jungle-prop-004` and the bone/skull props from T001, each with `"solid": true`.
- [X] T018 [US1] Place edge-forest tree cover (`groves`/`scatter` entries) over the `edgeForest` ground areas authored in T015, for visual forest density.
- [X] T019 [US1] ⚠️ Reopened (BUG-001) ~~Place terrain substitutes for sketch regions with no atlas equivalent (e.g. the sketch's lava zone) in `public/world/world.json`'s `ground`/`scatter`/`objects`, using the closest available terrain/rock art at the sketch's outline and location (research.md R9).~~ **(reopened — BUG-001, supersedes the struck text)**: remove the `gravel-dunes`/`gravel-lava-zone` ground areas and their `dunes-arch`/`lava-zone-rock-1`/`lava-zone-ore` objects from `public/world/world.json` entirely — per FR-025/research.md R11, the sketch's desert-family regions (dunes, rocky desert, lava) are omitted, not substituted.
- [X] T020 [US1] Review `public/world/world.json` end to end and confirm no title banner, legend/symbol box, or animal/NPC sprite is placed anywhere (spec FR-002).
- [X] T021 [US1] Run `node --test public/tests/*.test.js` against `public/world/world.json` (validation/art/ground/water/layout suites) and fix any failures.
- [ ] T022 [US1] Serve the app (`cd public && python3 -m http.server 8000`), open `http://localhost:8000/?world=world/world.json`, and visually confirm the map matches `world_map.jpg`'s terrain/water shapes and relative positions with no console errors (spec SC-001).

**Checkpoint**: User Story 1 is independently testable — `world.json` loads and renders the sketch-shaped map.

---

## Phase 4: User Story 2 - Danger Only Comes From the Forest's Edge (Priority: P1)

**Goal**: The `odour:danger` sense reads the edge-forest ring field (100/50/25% over three tile-steps), sourced only from `forestEdge`.

**Independent Test**: Sample the danger field over `world-forager-wide.json`'s map and confirm the 100/50/25%/0% shape (spec SC-002) — independent of whether any overlay displays it.

### Implementation for User Story 2

- [X] T023 [US2] Build `world.dangerField` once per world load (in whichever module assembles the wide-I/O `world` object passed to `forageEnvWide`, e.g. `public/js/fly/fly-world.js`) from `logic.forestEdge` via T005's `dangerField()`.
- [X] T024 [US2] Add a `'forestEdge'` branch to `samplerFor` in `public/js/fly/forager-step-wide.js` returning `{ points: () => [], contactAt: () => 0, fieldAt: (cx, cy) => world.dangerField.intensity[cy * world.width + cx] ?? 0 }` (contracts/stimuli-field-sources.md §4).
- [X] T025 [US2] Update `public/world/world-forager-wide.json`'s `flies.stimuli["odour:danger"]` to `{ "from": "forestEdge" }`, removing `kinds` and `radius`.
- [X] T026 [P] [US2] Extend `tests/world-compat-wide.test.mjs` with a case loading a world whose `odour:danger` declares `from: "forestEdge"` and asserting a fly starts with no error.
- [X] T027 [US2] Run `npm test` and confirm, by sampling `dangerField(...)` over `world-forager-wide.json`'s `logic.forestEdge`, that danger reads 100%/50%/25%/0% at tile-steps 0/1/2/3+ from edge forest and 0% over any non-edge forest patch (spec SC-002).

**Checkpoint**: User Story 2 is independently testable via T026/T027, regardless of US6's overlay work.

---

## Phase 5: User Story 3 - Water Radiates Heat, But There's Always a Dry Way Across (Priority: P1)

**Goal**: The `heat` sense reads the water field (100/50/25% over three tile-steps), and the sketch's water divide has a guaranteed zero-heat land crossing.

**Independent Test**: Sample the heat field over `world-forager-wide.json`'s map for the 100/50/25% shape, and confirm a walkable zero-heat route between the two areas `world.json`'s water divides (spec SC-003).

### Implementation for User Story 3

- [X] T028 [US3] Build `world.heatField` once per world load (same module as T023) from `logic.water` via T006's `heatField()`.
- [X] T029 [US3] Add a `'water'` branch to `samplerFor` in `public/js/fly/forager-step-wide.js` returning `{ points: () => [], contactAt: () => 0, fieldAt: (cx, cy) => world.heatField.intensity[cy * world.width + cx] ?? 0 }` (contracts/stimuli-field-sources.md §4).
- [X] T030 [US3] Update `public/world/world-forager-wide.json`'s `flies.stimuli.heat` to `{ "from": "water" }`, removing `kinds` and `radius`.
- [X] T031 [US3] ⚠️ Reopened (BUG-001) Verify, using T006's `heatField()` against `public/world/world.json`'s authored geometry (T015), that every cell along the water-divide crossing is at Chebyshev tile-distance ≥ 3 from every water cell (zero heat); adjust the crossing's outline in `public/world/world.json` if it is not (research.md R6). **(reopened — BUG-001)**: "every water cell" now includes T015's river cells, not just the two lakes — re-verify against the corrected geometry (depends on T063).
- [X] T032 [P] [US3] ⚠️ Reopened (BUG-001) Create `tests/water-corridor.test.mjs` asserting a walkable, zero-heat route exists between the two areas `world.json`'s water divides (spec SC-003, research.md R6). **(reopened — BUG-001)**: extend the existing assertion to cover distance from the river too (depends on T060/T063; see T064).
- [X] T033 [P] [US3] Extend `tests/world-compat-wide.test.mjs` with a case loading a world whose `heat` declares `from: "water"` and asserting a fly starts with no error.
- [X] T034 [US3] Run the full test suite (`npm test`) and confirm it is green, including T032/T033.

**Checkpoint**: User Story 3 is independently testable via T031/T032/T033, regardless of US2 or US6.

---

## Phase 6: User Story 4 - Following Food Odour Across the Whole Map (Priority: P1)

**Goal**: Food odour follows the irregular, stepped, touching-footprint field (T007), not the old point-sum falloff, for both `v1` and `v2` worlds, and food placement on the new map forms one connected trail.

**Independent Test**: Sample the food field around several food items for the 3×3 core and irregular stepped falloff, and confirm every food item is reachable from every other by following non-zero food odour (spec SC-004).

### Implementation for User Story 4

- [X] T035 [US4] Build `world.foodField` once per world load from `config.edibles`/`logic.edibleSize` (stock fraction read live each sample) via T007's `foodField()`, in the same module as T023/T028.
- [X] T036 [US4] Add a field-mode branch for `odour:food` in `samplerFor` (`public/js/fly/forager-step-wide.js`), sampling `world.foodField` instead of the point-sum `edibles` sampler for that sense, leaving `taste`'s existing `contact`/stock-scaled path untouched.
- [X] T037 [US4] Update the `v1` food-odour path (`public/js/fly/stimulus.js`'s `senseBilateral`/`fruitIntensity` callers used by `forager-step.js`/`fly-world.js`) to sample the same `foodField` at each antenna point, keeping the existing bilateral left/right call signature unchanged.
- [X] T038 [US4] Place `edibles` in `public/world/world.json` (per T001's clusters) so every food unit's footprint touches or overlaps at least one neighbour's, forming a single connected trail across the map (spec FR-014/FR-015).
- [X] T039 [P] [US4] Extend `tests/food-field.test.mjs` (T012) with a connectivity check over `world.json`'s actual `edibles` list: every unit reachable from every other by following non-zero food odour (spec SC-004), mirroring the existing `tests/odour-food.test.mjs` SC-003 connectivity pattern.
- [ ] T040 [US4] Run the full test suite, then in the running app walk a fly from one food cluster toward the next and confirm its food-odour reading rises smoothly with no zero-odour gap along the route.

**Checkpoint**: User Story 4 is independently testable via T039/T040.

---

## Phase 7: User Story 5 - Bumping Into Anything Feels Like a Touch (Priority: P2)

**Goal**: Every decorative object placed on the new map registers touch, using the existing `from: "blocked"` mechanism.

**Independent Test**: Walk a fly into one example of every decoration kind placed on the map and confirm each registers a left/right touch (spec SC-005).

### Implementation for User Story 5

- [X] T041 [US5] Audit every `objects`/`groves`/`scatter` placement authored for `public/world/world.json` in US1 and confirm each resolves `solid: true` in `buildLogic`'s `blocked` array (`public/js/world/layout.js`); for any scatter sprite class that is not already auto-solid (today only `class === 'bush'` is), set `solid` explicitly on the rule or the placement so every decoration used by the new map is solid (research.md R7).
- [X] T042 [P] [US5] Add a case to `public/tests/layout.test.js` asserting every object placed by `public/world/world.json` resolves `solid: true` in `buildLogic(...).blocked`.
- [ ] T043 [US5] In the running app, walk a fly into one tree, one rock, the tent, and a bone/skull pile from both the left and right side, and confirm each registers the corresponding `touch` reading in the side panel (spec SC-005).

**Checkpoint**: User Story 5 is independently testable via T042/T043.

---

## Phase 8: User Story 6 - Switching Overlays On and Off (Priority: P2)

**Goal**: Four independent overlay toggles — food odour, danger odour, heat odour, tile grid — replace today's single combined odour toggle.

**Independent Test**: Toggle each of the four overlays on/off independently and in combination; only the toggled overlays appear (spec SC-006).

### Implementation for User Story 6

- [X] T044 [US6] Grow `LAYERS` in `public/js/world/layers.js` from `[{ id: 'odour', label: 'Odour' }]` to `[{id:'odour-food',...}, {id:'odour-danger',...}, {id:'odour-heat',...}, {id:'grid',...}]` (contracts/odour-layer-v2.md §1); `initialLayers`/`toggleLayer` need no logic change.
- [X] T045 [P] [US6] Add a `prefix` parameter to `parseRamp` in `public/js/render/heatmap.js` (default `'--odour'`, backward compatible with existing callers), and add `--odour-danger-low/mid/high/alpha` and `--odour-heat-low/mid/high/alpha` CSS token groups (contracts/odour-layer-v2.md §3).
- [X] T046 [P] [US6] Add `paintGrid(cols, rows, cellPx, style)` to `public/js/render/heatmap.js`, drawing 1px lines at every `cellPx` boundary over a `cols × rows` canvas, coloured from a `--grid-line-color` CSS token with a low-alpha neutral-grey fallback (contracts §3).
- [X] T047 [US6] In `public/js/main.js`, build and lazily cache a field+canvas pair per odour layer (from T005/T006/T007's builders, each painted with T045's `prefix`-selected ramp) plus a grid canvas (T046), and compose `overlays` from whichever of the four `layers` entries are currently `true` (contracts/odour-layer-v2.md §5).
- [X] T048 [US6] Update the World pane in `public/js/ui/panel/panel.js` to render one `.layer-row`/switch per `LAYERS` entry (generically, from the list) and one `.odour-legend` per odour layer (not `grid`), each reflecting and toggling its own `view.layers[id]` (contracts/odour-layer-v2.md §6).
- [X] T049 [P] [US6] Extend `tests/layers.test.mjs` for the 4-entry `LAYERS` list and `tests/heatmap.test.mjs` for `parseRamp`'s `prefix` parameter and `paintGrid`'s line positions (contracts §7).
- [ ] T050 [US6] In the running app, toggle each of the four overlays on alone, off alone, and in every combination (including all four at once), confirming only the toggled overlays' content appears and legends show/hide correctly (spec SC-006, quickstart.md §4).

**Checkpoint**: User Story 6 is independently testable via T049/T050.

---

## Phase 9: User Story 7 - Every World Runs on the Same Sketched Map (Priority: P3)

**Goal**: Every shipped, runnable world config shares `world.json`'s new map geometry, keeping its own body/brain/experiment sections.

**Independent Test**: Open each shipped world URL and confirm it shows the new sketched map with no console errors (spec SC-007).

### Implementation for User Story 7

- [X] T051 [US7] ⚠️ Reopened (BUG-001) Copy `public/world/world.json`'s `grid`/`ground`/`waterBodies`/`objects`/`groves`/`scatter`/`edibles` block into `public/world/world-connectome.json`, leaving its own `flies`/brain section unchanged. **(reopened — BUG-001)**: re-copy once T063 lands, so this world also gets the river/swamp/desert-removal fix (see T066).
- [X] T052 [P] [US7] ⚠️ Reopened (BUG-001) Copy the same block into `public/world/world-antennal-lobe.json`, leaving its own `flies`/brain section unchanged. **(reopened — BUG-001)**: re-copy after T063 (see T066).
- [X] T053 [P] [US7] ⚠️ Reopened (BUG-001) Copy the same block into `public/world/world-forager.json`, leaving its own `flies`/`experiment`/`brain.lif` sections unchanged. **(reopened — BUG-001)**: re-copy after T063 (see T066).
- [X] T054 [P] [US7] ⚠️ Reopened (BUG-001) Copy the same block into `public/world/world-forager-11k.json`, leaving its own `flies`/`experiment`/`brain.lif` sections unchanged. **(reopened — BUG-001)**: re-copy after T063 (see T066).
- [X] T055 [US7] ⚠️ Reopened (BUG-001) Copy the same block into `public/world/world-forager-wide.json` (already carrying T025/T030's `odour:danger`/`heat` updates), leaving its own `flies`/`experiment`/`brain.lif` sections unchanged, and remove its now-unused `dangers` list. **(reopened — BUG-001)**: re-copy after T063 (see T066). `dangers` was already absent (removed by the earlier T055 pass); confirmed still absent.
- [X] T056 [US7] ⚠️ Reopened (BUG-001) Update `public/world/README.md` to describe the new sketch-based shared map in place of "Pond Meadow," following the file's existing structure. **(reopened — BUG-001)**: describe the river, the swamp connector and the absence of desert/lava terrain, not the two-lake/plain-land-gap/gravel-desert description this task originally wrote.
- [ ] T057 [US7] Run `npm test && node --test public/tests/*.test.js`, then open every URL in quickstart.md §2 and confirm each shipped world loads the new map with no console errors (spec SC-007). Leave `world-forager-bad.json`, `world-forager-11k-bad.json` and `world-forager-wide-bad.json` untouched (research.md R10). **Depends on T066 (BUG-001)**, since this is the final confirmation across every shipped world. **Status**: `npm test && node --test public/tests/*.test.js` is green for all six world files (plus a direct `validateConfig`/`validateArt`/`buildLogic`/`groundPlan`/`shorePlacements` smoke check run against each — see T067); opening each URL in a browser to confirm no console errors is still unverified (no browser tool available in this session).

**Checkpoint**: User Story 7 is independently testable via T057 — every shipped world shares the new geometry.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across every story.

- [ ] T058 Run the full `quickstart.md` validation end to end (all 6 sections) and record any deviations found.
- [X] T059 [P] Confirm no remaining reference to the retired `dangers`/`DANGER_SPRITES` point-source path exists in any shipped world file beyond `world-forager-wide.json` (T055), and that `npm test && node --test public/tests/*.test.js` is fully green.

---

## Phase 11: Bugfix BUG-001 — River, Swamp, Edge-Forest Gap, Desert Removal

**Purpose**: Bring the map's water/forest/desert geometry in line with the already-reviewed reading of
`world_map.jpg` at `zrpg-art/examples/WORLD-SPEC.md` (river, swamp) and the user's instruction to skip
the sketch's desert-family terrain. See [bugs/BUG-001.md](bugs/BUG-001.md), `research.md` R11,
`data-model.md` and `contracts/world-format-sketch-map.md` §6.

**Independent Test**: Sample `heatField()` over `world.json`'s corrected geometry and confirm the water
mask includes the river; open `?world=world/world.json` and confirm no dune/rocky-desert/lava art renders
anywhere (spec SC-001, US1 Acceptance Scenarios 5–6).

- [X] T060 [P] Add `river` outline support to `public/js/world/water.js`: a `riverDistance(river, seed)`
  sibling to the existing `bodyDistance(blob, ...)` (Catmull-Rom spline through `outline.river.path`,
  width lerped by arc length, stamped as discs, same mask→EDT pipeline), and have `bodyKind` return
  `'river'` for it (contracts/world-format-sketch-map.md §6).
- [X] T061 [P] Add `'swamp'` to `SURFACE_KINDS` in `public/js/world/validate.js`, and validate
  `waterBodies[].outline.river.path` (≥ 2 points) / `.width` (exactly 2 positive entries) alongside the
  existing `blob` checks (contract §6).
- [X] T062 [P] Add a `swamp` entry to `PATCH_TILES` in `public/js/world/ground.js` (wet, dark, reed-dotted
  ground art) for the new ground kind's rendering (contract §6).
- [X] T063 [US1] Re-author `public/world/world.json` per T015/T019's reopened notes: add the river
  `waterBodies` entry, add the `swamp` ground area in place of the plain-land lake connector, cut the
  north/south `edgeForest` outlines back at the river's edge crossings, and remove the
  `gravel-dunes`/`gravel-lava-zone` ground areas and their substitute objects. Depends on T060–T062.
  **Implementation note**: authored as two river bodies (`river-north` feeding Lake Joy from the top edge,
  `river-south` draining Lake Byte out the bottom edge) rather than one continuous body threading the
  isthmus — a single body spanning the isthmus sealed the only dry crossing with its heat halo (no
  Chebyshev-distance-3 gap remained), matching how the reference design's own swamp pools are separate,
  non-channel-forming water features rather than one unbroken river (research.md R11).
  **Second pass, same day**: the first version of this task positioned the lakes/river/swamp
  independently rather than from WORLD-SPEC's own reference-px coordinates, which the user explicitly
  asked to inherit — redone from those coordinates (sketch-map-authoring-notes.md's Conversion section
  and research.md R11's second-pass note have the factors, the per-feature table, and why each lake's `cy`
  and `slime-hills-scatter`'s `rx` needed a further nudge to keep FR-011's crossing deterministic across
  both shipped seeds once the lakes sat at their WORLD-SPEC-derived, closer-together positions).
- [X] T064 [US1] Extend `tests/water-corridor.test.mjs` (T032) to assert the zero-heat corridor is ≥ 3
  tile-steps from the river's cells too, and add a case asserting `river` outline cells rasterise to
  `water[k] === 1` in `buildLogic`'s output (contract §6 Tests). Depends on T060, T063.
- [X] T065 [US1] Run `npm test && node --test public/tests/*.test.js` — green (`npm test`: 566/572, the 6
  failures are `tests/activity.test.mjs`, pre-existing and unrelated, confirmed failing identically on the
  pre-BUG-001 commit; `public/tests/*.test.js`: 90/90). **Not done**: serving the app and visually
  confirming the river/swamp/no-desert map against `world_map.jpg` in a browser — no browser tool was
  available in this session; see the report back to the user. Depends on T063, T064.
- [X] T066 [US7] Re-copy `world.json`'s corrected `grid`/`ground`/`waterBodies`/`objects`/`groves`/`scatter`/`edibles`
  block (T063) into `world-connectome.json`, `world-antennal-lobe.json`, `world-forager.json`,
  `world-forager-11k.json` and `world-forager-wide.json` (T051–T055), each keeping its own
  `flies`/`experiment`/`brain.lif` sections unchanged. Depends on T063.
- [ ] T067 [US7] Run `npm test && node --test public/tests/*.test.js`, then open every shipped world URL in
  quickstart.md §2 and confirm each one loads the corrected map with no console errors (spec SC-007,
  redoes T057 for the corrected geometry). Depends on T066. **Status**: the automated half is done — both
  suites are green for all six world files, and `validateConfig`/`validateArt`/`buildLogic`/`groundPlan`/
  `shorePlacements` were run directly against each of the six shipped world files with zero errors/throws
  (a DOM-free stand-in for "no console errors" up to the point where rendering needs a real canvas).
  Opening each URL in a browser is still unverified — no browser tool was available in this session.

**Checkpoint**: Phase 11 is independently testable via T064/T065 (US1 geometry) and T067 (US7 rollout).

---

## Phase 12: Bugfix BUG-002 — The World Equals the Art Pack's Reference Map

**Goal**: terrain, forest and water equal `zrpg-art/examples/world.html`, drawn with the regenerated art pack; the
world keeps its grid and its food and danger allocation. See [bugs/BUG-002.md](bugs/BUG-002.md).

- [x] T068 [US1] Replace `public/assets/atlas/` with zrpg-art `5d151a3`; remap the tile path's moved ids (`compose.js`, `ground.js`, `shore.js`, `banned-art.test.js`)
- [x] T069 [US1] Port the reference water fields and shore decor, pure: `public/js/world/map-water.js`
- [x] T070 [US1] Port the reference world plan and the logic grid (water, blocked, forestEdge), pure: `public/js/world/sketch-map.js`; `buildLogic` uses it for a world with `map`
- [x] T071 [US1] Paint the plan (water at t = 0, areas, trails, sprites, finish): `public/js/world/sketch-paint.js`; `main.js` uses it
- [x] T072 [US1] Validate `map` (structure in `validateConfig`; sprites, forbidden art and food on water in `validateArt`); `sheet/name` lookup in `catalog.js`
- [x] T073 [US1] Migrate the seven 64 × 40 worlds to the shared `map`; keep their edibles and `flies`
- [x] T074 [US3] Amend the corridor test to the crossing the reference water allows (heat ≤ 50%) and record the finding
- [x] T075 [US1] Contract §7, spec FR-011/FR-025/FR-026, world README, attribution; tile-format tests on `public/tests/fixtures/world-tile.json`; `tests/sketch-map.test.mjs`
- [ ] T076 [US7] Re-run the forager calibration and held-out gates on the new map (calibration was done on the old map)

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001's sprite/coordinate notes feed T015+). Blocks every user story.
- **User Stories (Phase 3–9)**: All depend on Foundational completion.
  - US1 (Phase 3) has no dependency on the other stories, but **US2, US3 and US4 each depend on US1's `public/world/world.json` existing** (they sample fields built from US1's authored `forestEdge`/`water`/`edibles`), so in practice US1 must land first even though it is not a hard code dependency for Foundational's field builders themselves.
  - US5 (Phase 7) depends on US1's authored objects (it audits them).
  - US6 (Phase 8) depends on Foundational's field builders (T005–T007) but not on US2/US3/US4's sense-wiring — it can be built in parallel with US2–US5 once US1's map exists, since it only needs a field to paint, not a brain that senses it.
  - US7 (Phase 9) depends on US1 (the block it copies) and, to ship a fully-correct `world-forager-wide.json`, on US2/US3 (T025/T030's `flies.stimuli` edits).
- **Polish (Phase 10)**: Depends on all stories being complete.
- **Bugfix BUG-001 (Phase 11)**: Depends on US1 (Phase 3) and US7 (Phase 9) having landed once (the
  geometry and the copies it corrects) — T060–T062 (schema/art) can start immediately in parallel with
  anything else; T063 depends on them; T064/T065 depend on T063; T066 depends on T063; T067 depends on
  T066. Supersedes Phase 10's T058 as the final check for this feature's map content.

### Within Each User Story

- US1: geometry (T014–T019) before review/validation (T020–T021) before manual confirmation (T022).
- US2/US3: field-building wiring before world-config edit before tests before verification.
- US4: field-building wiring (T035–T037) before placement (T038) before connectivity test (T039) before manual check (T040).
- US6: data model (`LAYERS`, T044) and rendering primitives (T045–T046) before the composition wiring (T047) before the panel UI (T048) before tests/manual verification.

### Parallel Opportunities

- Foundational: T003–T008 (six different new/edited files) can run in parallel once T002 lands conceptually (T002 and T009 both touch `validate.js` and must be sequential with each other, but neither blocks T003–T008, which are different files). T010–T013 (four test files) can run in parallel once their respective implementation task is done.
- US2 and US3 touch different `flies.stimuli` keys and different (but structurally parallel) code paths — once US1's map and Foundational are done, a second contributor could work US3 while US2 is in progress, merging at `forager-step-wide.js`'s `samplerFor` (coordinate to avoid a merge conflict in that one file).
- US5 and US6 have no file overlap with US2/US3/US4 and can proceed in parallel with them once US1 is done.
- US7's five world-file copies (T051–T055) touch five different files and can run in parallel, though T055 should follow T025/T030 (US2/US3) so the copied `world-forager-wide.json` block is already correct.

---

## Parallel Example: Foundational Phase

```bash
# After T002 (validate.js edgeForest rule) lands, in parallel:
Task: "Add edgeForest to PATCH_TILES in public/js/world/ground.js"
Task: "Add forestEdge array to buildLogic in public/js/world/layout.js"
Task: "Create public/js/world/danger-field.js"
Task: "Create public/js/world/heat-field.js"
Task: "Create public/js/world/food-field.js"
Task: "Add field mode to senseDeclared in public/js/fly/stimulus.js"

# Once their implementation tasks land, in parallel:
Task: "Create tests/danger-field.test.mjs"
Task: "Create tests/heat-field.test.mjs"
Task: "Create tests/food-field.test.mjs"
Task: "Extend tests/stimulus-declared.test.mjs"
```

---

## Implementation Strategy

### MVP First (Setup + Foundational + User Story 1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1): the sketch-shaped map itself, with no odour recalibration yet (it still carries the old point-sum senses until US2–US4 land).
3. **STOP and VALIDATE**: open the map, compare to the sketch (spec SC-001).

Note: US1 alone does not deliver the request's main point (the odour recalibration) — it only delivers the
visual map. Since US2, US3 and US4 are all P1 in spec.md, treat **Setup + Foundational + US1 + US2 + US3 +
US4** as the realistic minimum "done" slice; US1 is still listed as the MVP checkpoint because it is the
first point at which there is something to look at and validate independently.

### Incremental Delivery

1. Setup + Foundational → infrastructure ready, nothing visible yet.
2. US1 → the sketch-shaped map renders (demo-able).
3. US2 → danger odour calibrated (test-verifiable; visible once US6 lands).
4. US3 → heat odour calibrated and the dry crossing holds (test-verifiable; visible once US6 lands).
5. US4 → food odour forms a connected trail (test-verifiable; visible once US6 lands).
6. US5 → every decoration touches (verifiable in-browser immediately).
7. US6 → all three odour fields and the grid become visible/switchable (makes US2–US4's work observable).
8. US7 → every shipped world carries the same map.
9. Polish → full-suite and full-quickstart confirmation.

### Parallel Team Strategy

With multiple contributors, after Setup + Foundational + US1:
- Contributor A: US2 then US3 (both touch `forager-step-wide.js`'s `samplerFor` — coordinate merges).
- Contributor B: US4.
- Contributor C: US5 and US6 (no overlap with A/B's files).
- Converge on US7 once US2/US3's `world-forager-wide.json` edits (T025, T030) are in.

---

## Notes

- [P] tasks touch different files and have no incomplete-task dependency.
- [Story] labels map every Phase 3+ task to spec.md's US1–US7 for traceability.
- US2/US3/US4's "independent test" is a field/test-level check (spec.md's own Independent Test sections), not a visual one — the overlay that makes them visible is US6's job, by design (research.md R8's rationale: overlays only ever read already-built fields, so sensing correctness and overlay correctness are separable).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- `*-bad.json` world fixtures are intentionally out of scope (research.md R10) — do not edit them.

**Bugfix**: 2026-10-15 — BUG-001 Updated from bugfix patch (reopened T001, T015, T019, T031, T032,
T051–T057; added Phase 11, T060–T067). See [bugs/BUG-001.md](bugs/BUG-001.md).

**Bugfix**: 2026-10-15 — BUG-002 Added Phase 12, T068–T076. See [bugs/BUG-002.md](bugs/BUG-002.md).
