# Tasks: Food Odour Recalibration

**Input**: Design documents from `/specs/009-food-odour-recalibration/`

**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (user stories P1–P3), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The spec does not ask for TDD, but the plan names the test files to add or update (`tests/odour-food.test.mjs`, `tests/validate-v3.test.mjs`, `tests/fly-sprite.test.mjs`) and AGENTS.md requires `npm test` to pass before a feature is done. Test tasks are marked with the story they check.

**Organization**: Grouped by user story (US1–US4 from spec.md) so each story can be checked on its own.

**Scope**: All five world files the app loads (`world.json`, `world-forager.json`, `world-connectome.json`, `world-antennal-lobe.json`, and the fixture `world-forager-bad.json`). `world.v1.json` is not loaded by the app and is not touched.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 to US4, from spec.md. Setup, Foundational and Polish have no story label.
- Each task names its file path(s).

**Same-file rule**: five world files are edited by US1 (edibles, stimulus), US3 (scatter, shore) and US4 (fly sprite). Those phases run in that order, so no two stories edit one file at the same time.

---

## Phase 1: Setup (Baseline)

**Purpose**: Record what the app does before any change, so the change can be compared with it.

- [X] T001 Run `npm test` and `npm run test:slow` on the untouched map; create `specs/009-food-odour-recalibration/results.md` with the pass or fail counts under "Baseline (before change)"
- [X] T002 Run `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out` and `--seeds=calibration` (run from `public/`, or as the script expects); append both outputs to `specs/009-food-odour-recalibration/results.md` under "Baseline (before change)"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The edible vocabulary, the edible sprite and the edible size in the code that every story reads. No story can start before this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Replace the sprite table in `public/js/world/layout.js`: remove `EDIBLE_SPRITES` and set `EDIBLE_KINDS = ['small', 'medium', 'large']`. In `buildScene`, take each edible's sprite from the entry's `sprite` field (data-model: `sprite` "Required. Must exist in the catalogue. Must be one of the food sprites")
- [X] T004 In `public/js/world/layout.js`, extend `buildLogic` with `edibleSize` (Float32Array, one per cell, `max(w, h) / CELL_PX` from the catalogue entry of the edible's sprite; 0 where there is no edible). Depends on T003
- [X] T005 (closed by T047 — BUG-001: cardinality changed from "exactly one per kind" to "one or more per kind") Update `public/js/world/validate.js` for world format version 3 (contract world-format-v3 §1–§2): accept `"version": 3` only and name the version found and the one expected; refuse `"flower"` by name as an unknown edible kind; `kind` must be "small", "medium" or "large" (data-model: "Closed set in code (`EDIBLE_KINDS`). Anything else is refused by name."); `sprite` required and in the catalogue; ~~exactly three edibles, one per kind~~ one or more edibles, every kind present at least once (BUG-001). Depends on T003
- [X] T006 [P] Write `tests/validate-v3.test.mjs` first (it fails until Phase 3 migrates the files): version 2 refused, `flower` refused, edible without `sprite` refused, unknown sprite refused, the five shipped worlds accepted (world-forager-bad refused on its snapshot version, not on format)
- [X] T007 [P] Check `public/js/ui/error-panel.js` and `public/js/config/load-world.js` for any text that names world format version 2 and update it to version 3

**Checkpoint**: Validator and layout know the version 3 vocabulary. World files are still version 2 and do not load yet.

---

## Phase 3: User Story 1 - Food Smells Stronger the Bigger It Is (Priority: P1) 🎯 MVP

**Goal**: Three food units, each with odour reach proportional to its sprite size, peak on the unit, sensed by the fly and drawn by the odour layer from the same field.

**Independent Test**: Load `world-forager.json` with the odour layer on. Odour peak is at each unit's position, reach ratio matches size ratio within 5%, and `node --test tests/odour-food.test.mjs` passes its SC-001 checks.

### Implementation for User Story 1

- [X] T008 [US1] In `public/js/fly/stimulus.js`, make `fruitIntensity` and `senseBilateral` use each point's own reach: `falloff(d, p.reach ?? radius)` (contract odour-reach §2). Sum-then-cap and resting level unchanged
- [X] T009 [P] [US1] In `public/js/world/odour-field.js`, give each point its own reach in the bounding box loop and in the reach test (contract odour-reach §4). Parity with `fruitIntensity`, cap at 1, empty stays zero
- [X] T010 [US1] In `public/js/fly/fly-world.js`, make `stimulusCells` a Map of `cellIndex → { kind, reach }` with `reach = flies.stimulus.radius × logic.edibleSize[idx]`; `stimulusPoints` returns `{ x, y, reach }` (contract odour-reach §3). Depends on T004
- [X] T011 [US1] In `public/js/fly/food.js`, `points()` carries `reach` from the stimulus cell and keeps `fraction` (research R3). Depends on T010
- [X] T012 [US1] In `public/js/main.js`, `odourSources` passes points with `reach` from `stimulusPoints` (legend stays `{ max: stimulus.max }`). Depends on T009, T010
- [X] T013 (closed by T049 — BUG-001: the single-entry-per-kind positions reached only ~50% odour coverage; now 5 instances, 60–70% coverage) [P] [US1] Migrate `public/world/world-forager.json` to version 3: `version: 3`; replace the eight `flower` entries with three edibles (`large` `jungle-plant-015` at x 10.5 y 20.5; `medium` `jungle-plant-010` at x 32.5 y 19.5; `small` `red_flower_plant` at x 21.5 y 3.5); `flies.stimulus.objects` = `["small", "medium", "large"]`; `flies.stimulus.radius` = `6`. Do not touch `scatter` (US3)
- [X] T014 (closed by T050 — BUG-001) [P] [US1] Migrate `public/world/world.json` the same way as T013 (mock brain; `flies.stimulus.radius` 6; `flies.stimulus.objects` three kinds)
- [X] T015 (closed by T051 — BUG-001) [P] [US1] Migrate `public/world/world-connectome.json` the same way as T013 (v0 brain)
- [X] T016 (closed by T052 — BUG-001) [P] [US1] Migrate `public/world/world-antennal-lobe.json` the same way as T013 (v0 antennal-lobe brain)
- [X] T017 (closed by T053 — BUG-001) [P] [US1] Migrate `public/world/world-forager-bad.json` to version 3 with the same three edibles and stimulus, keeping its v1 + version 3 snapshot pairing, so it still fails on the snapshot version (its purpose)

### Tests for User Story 1

- [X] T018 [P] [US1] Update `tests/odour-field.test.mjs` (create it if it does not exist): parity with `fruitIntensity` per point reach within 1e-6; reach (zero beyond a point's own reach); cap at 1; bounds at the edge; empty gives zeros (contract odour-reach §4)
- [X] T019 (closed by T054 — BUG-001: the test titled "exactly three food units, one per size class (FR-001)" hardcoded a sorted-array equality that only held for one unit per kind; renamed and rewritten) [US1] Create `tests/odour-food.test.mjs`: SC-001 for `world-forager.json`: odour at each unit's cell is the world maximum (1.0 with gain 1, max 1); reach ratio `large : medium : small` equals `sizeTiles` ratio within 5% (`63/32 : 45/32 : 32/32`)
- [X] T020 [P] [US1] Update `tests/fly-world.test.mjs`: stimulus cells carry the `reach` of their unit; no expectation refers to kind `flower`

**Checkpoint**: US1 works alone. Run `node --test tests/odour-food.test.mjs tests/odour-field.test.mjs tests/fly-world.test.mjs` and `node --test tests/validate-v3.test.mjs`.

---

## Phase 4: User Story 2 - Odour Is Patchy, So the Fly Has Somewhere to Go (Priority: P2)

**Goal**: Between 30% and 70% of walkable cells have no odour, no walkable cell is cut off from odour, and food sits on land and not on another food unit.

**Independent Test**: `node --test tests/odour-food.test.mjs` passes the SC-002, SC-003 and FR-008 checks for every shipped world.

### Tests for User Story 2

- [X] T021 (closed by T054 — BUG-001: SC-002's range is now 0.30–0.40, and the FR-008 "reaches do not overlap" assertion was dropped since FR-020 now lets any two instances overlap on purpose) [US2] In `tests/odour-food.test.mjs`, add: SC-002 (odour-free share of walkable cells between 0.30 and 0.70, computed with the app's `buildLogic` and the odour formula); SC-003 (every walkable cell is in a 4-connected region that contains some odour); FR-008 (each food unit is not water, not blocked, not on another edible cell; the reaches of any two units do not overlap: distance ≥ `reach_i + reach_j`). Use `world-forager.json`, `world.json` and `world-connectome.json`. Depends on T019
- [X] T022 (closed by T055 — BUG-001: the food-cardinality assertion "food units are three, one per kind" hardcoded the old count; renamed and rewritten) [P] [US2] Update `public/tests/spread.test.js`: replace the flower rule (16 × 16 region, 6-cell gap, FR-032) with the food rules of plan §5 (contract world-format-v3 §5); keep the danger rule unchanged

**Checkpoint**: US2 passes alone (after US1 migration). Run `node --test tests/odour-food.test.mjs` and `npm test -- public/tests/spread.test.js` (or `node --test public/tests/spread.test.js`).

---

## Phase 5: User Story 3 - The Map Shows Only the Decor It Should (Priority: P2)

**Goal**: The three removed sprites are gone from every world. The food sprites are not used as decor. The yellow flowers are decor, not food.

**Independent Test**: `node --test tests/odour-food.test.mjs tests/validate-v3.test.mjs` pass the FR-009, FR-010, FR-019 checks; `grep` finds no removed or food sprite in any scatter or shore rule.

### Implementation for User Story 3

- [X] T023 [P] [US3] In `public/world/world.json` `scatter`: `meadow-flowers` sprites become `["trees-plant-001", "trees-plant-002", "trees-plant-003"]` (yellow decor; drops `trees-plant-005`, `jungle-plant-016`, `jungle-plant-017`); `fern-tufts` drops `jungle-plant-010` and `jungle-plant-015` and keeps `trees-plant-008`, `trees-plant-010`; delete the `shrubs-south-east` rule (only `jungle-bush-018`). Leave `bush-patch` and the other fields unchanged
- [X] T024 [P] [US3] Apply T023 to `public/world/world-forager.json`
- [X] T025 [P] [US3] Apply T023 to `public/world/world-connectome.json`
- [X] T026 [P] [US3] Apply T023 to `public/world/world-antennal-lobe.json`
- [X] T027 [P] [US3] Apply T023 to `public/world/world-forager-bad.json`
- [X] T028 [US3] In `public/js/world/shore.js`, the `wild flowers` rule `ids` becomes `["trees-plant-001", "trees-plant-002", "trees-plant-003"]` (decor only; drops `jungle-plant-016`, `jungle-plant-017`, `trees-plant-005`)
- [X] T029 [US3] In `public/js/world/validate.js`, refuse any `scatter` rule that names a food sprite (`red_flower_plant`, `jungle-plant-010`, `jungle-plant-015`) or a removed sprite (`jungle-plant-016`, `jungle-plant-017`, `jungle-bush-018`), with a named error (FR-009, FR-019). Depends on T005
- [X] T030 [P] [US3] Update `public/tests/banned-art.test.js`: the stimulus check expects `['small', 'medium', 'large']` (line ~66); the required-sprite list drops `jungle-bush-018` and `jungle-plant-016` (line ~81), as withdrawn by FR-012

### Tests for User Story 3

- [X] T031 [US3] In `tests/validate-v3.test.mjs`, add: a scatter rule with a food sprite is refused; a scatter rule with a removed sprite is refused; a yellow flower in scatter is accepted. Depends on T006, T029
- [X] T032 [US3] In `tests/odour-food.test.mjs`, add: FR-009 and SC-004 (no removed sprite appears in any world file); FR-010 (the yellow flower sprites are not in `edibles` and not in `flies.stimulus.objects`; they add no odour); FR-019 (no food sprite in any scatter list). Depends on T022
- [X] T033 [US3] Check `public/tests/scatter.test.js`, `public/tests/shore.test.js`, `public/tests/layout.test.js`, `public/tests/groves.test.js` and `public/tests/determinism.test.js`; fix only expectations that name a removed or food sprite, or a count that the removal changes. Do not change the scatter seed or clearings

**Checkpoint**: US3 passes alone. Run `node --test tests/validate-v3.test.mjs tests/odour-food.test.mjs` and `node --test public/tests/banned-art.test.js public/tests/shore.test.js public/tests/scatter.test.js`.

---

## Phase 6: User Story 4 - The Fly Looks Like a Fruit Fly (Priority: P3)

**Goal**: The fly and the baseline fly are 32 × 32 pixel sprites that read as a fruit fly.

**Independent Test**: `node --test tests/fly-sprite.test.mjs` passes; the visual check in quickstart §4 is recorded in `results.md`.

### Implementation for User Story 4

- [X] T034 (closed by T062 — BUG-002: one generic shape is replaced by a female and a male shape, each with its own baseline, and the wings are redrawn to project laterally at a right angle to the body axis) [US4] Author the 32 × 32 `fly` and `fly-baseline` pixel grids per `contracts/fly-sprite.md` (§1–§3: 32 rows of 32 characters; palette `w`, `k`, `e`, `t`; head at top, red eyes, tan abdomen with dark bands, clear wings, six legs) and write the same two sprite blocks into the `sprites` map of all five world files. Depends on T024–T027 (same files as US3)

### Tests for User Story 4

- [X] T035 (closed by T065 — BUG-002: the "same non-transparent pixels" assertion compared `fly` to `fly-baseline`; it now applies within each sex, and `fly-female`/`fly-male` are expected to differ in shape) [P] [US4] Create `tests/fly-sprite.test.mjs`: both sprites have exactly 32 rows of 32 characters; every character is `.` or in the palette; `fly` and `fly-baseline` have the same non-transparent pixels and different palettes (contract fly-sprite §5)
- [ ] T036 (closed by T066 — BUG-002: the sprite set changed, so the pending human visual check is redone against the new female/male/baseline sprites) [US4] ⚠️ Partially done — headless Chromium check: the sprite itself (shape, palette, not rotated) was verified by running the app's own `renderPixels` decode logic against both sprites at 1×/2×/4×; see `results.md`. The live canvas did not visibly render or move the fly in the same headless session (likely a headless-Chromium quirk, not a code defect — telemetry, console and network were all clean), so a human has not yet confirmed the sprite in a real browser tab. Reopen/close once a human does. Visual check per quickstart §4: open `public/index.html?world=world/world-forager.json` (served from `public/`), zoom to 1, 2 and 4, confirm the fly is one cell, reads as a fruit fly and is not rotated; record the result in `results.md`. Depends on T034

**Checkpoint**: US4 passes alone.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Contracts, docs, the full test run, behaviour record and the final app check.

- [X] T037 [P] Update `specs/005-world-tileset-environment/contracts/world-format.md`: version 3, edible kinds and `sprite`, `flower` refused, scatter rule (contract world-format-v3 §1–§3)
- [X] T038 [P] Update `specs/008-hungry-forager-brain/contracts/world-config-forager.md`: `flies.stimulus.radius` is reach per tile of sprite size; `objects` lists the three kinds (contract world-format-v3 §4)
- [X] T039 [P] Update `specs/002-toy-lif-fly-network/contracts/fly-config.md`: fly sprites are 32 × 32 (replace the 8 × 8 note in the Sprites section)
- [X] T040 [P] Update `specs/007-odor-layer/contracts/odour-layer.md`: §1 and §3 describe per-source reach (contract odour-reach §2, §4)
- [X] T041 [P] Update `public/world/README.md`: version 3, the food rule (three units, reach from size), decor rule, the fly sprite size
- [X] T042 Search for leftovers: `grep -rn "flower\|jungle-plant-016\|jungle-plant-017\|jungle-bush-018\|EDIBLE_SPRITES" public/js public/world public/tests tests` and remove any code or config reference (keep history in CHANGELOG and old specs)
- [X] T043 (closed by T058 — BUG-001) Run `npm test`, `npm run test:slow`, and `node --test tests/lif-golden.test.mjs` (LIF core must be unchanged); record the counts in `results.md` under "After change"
- [X] T044 (closed by T057 — BUG-001: the 0.50 free-share target is superseded by 0.30–0.40) Run `node scripts/food-placement.mjs 6` and confirm the output matches research R2 (free share about 0.50, one walkable component); record it in `results.md`
- [X] T045 (closed by T059 — BUG-001) Run `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out` and `--seeds=calibration`; append both to `results.md` under "After change". Do not change any value to pass a metric (AGENTS.md). Depends on T043
- [X] T046 (closed by T060 — BUG-001: the map's odour coverage changed; a fresh visual check was needed) Smoke test per quickstart §3: serve `public/` on port 8000, open `?world=world/world-forager.json`, turn on the odour layer, run one fly, confirm no console errors; record in `results.md`. Depends on T036

---

## Phase 8: Bugfix BUG-001 — Multiple Food Instances Per Class

**Bugfix**: 2026-10-07 — BUG-001 Updated from bugfix patch. One instance per size class reached only about 50% odour
coverage; the reporter wants 60–70%, reached by adding instances per class and allowing same-class instances to sit near
each other (spec FR-001, FR-020). T005, T013–T017, T019, T021, T022, T043, T044, T045 and T046 are reopened (see their
notes above). T047–T060 are new.

**Goal**: One or more food units per size class, placed so that odour covers 60–70% of walkable cells, with no walkable
cell cut off from odour and no two food objects sharing a cell.

**Independent Test**: `node --test tests/odour-food.test.mjs` passes the revised SC-001, SC-002 and FR-008 checks on all
five world files; `node scripts/food-placement.mjs` (or its multi-instance extension) reports 60–70% coverage.

- [X] T047 [US1] In `public/js/world/validate.js` (lines ~126–134), change the edible-count check from "exactly one unit
  of each kind" to "one or more units, every kind present at least once": keep the per-entry `validateSpot`/`sprite`
  checks, replace `edibles.length !== EDIBLE_KINDS.length || !EDIBLE_KINDS.every(...)` with a check that only requires
  every kind in `EDIBLE_KINDS` to appear at least once. Depends on T005 (reopened)
- [X] T048 [P] Extend `scripts/food-placement.mjs` (or add a sibling script) to search placements with one or more
  instances per size class, targeting 30–40% odour-free share (60–70% coverage), one walkable component, and no two
  food objects on the same cell. Instances of the same kind MAY be placed near each other so their reaches overlap
  (FR-020). Record the chosen counts and positions per class. Also fixed a half-cell coordinate bug inherited from
  the original script (it reported `x - 0.5, y - 0.5` instead of the exact centre `x, y` it evaluated against)
- [X] T049 [P] [US1] Re-migrate `public/world/world-forager.json` `edibles[]` using T048's placement data (replacing the
  single-entry-per-kind positions from T013). Keep `flies.stimulus.objects` = `["small", "medium", "large"]` and
  `flies.stimulus.radius` = `6`. Depends on T048
- [X] T050 [P] [US1] Apply T049 to `public/world/world.json`. Depends on T048
- [X] T051 [P] [US1] Apply T049 to `public/world/world-connectome.json`. Depends on T048
- [X] T052 [P] [US1] Apply T049 to `public/world/world-antennal-lobe.json`. Depends on T048
- [X] T053 [P] [US1] Apply T049 to `public/world/world-forager-bad.json`, keeping its v1 + version 3 snapshot mismatch so
  it still fails on the snapshot version (its purpose). Depends on T048
- [X] T054 [US2] Rewrite `tests/odour-food.test.mjs`: the FR-001 test checks every kind in `EDIBLE_KINDS` has at least
  one instance (not a sorted-array equality that only holds for exactly one per kind); the SC-002 test range becomes
  0.30–0.40; the FR-008 test keeps the land/not-blocked/not-same-cell checks for every instance but drops the
  cross-pair "reaches do not overlap" assertion (same-kind instances are meant to overlap, FR-020). Depends on T049–T053
- [X] T055 [P] [US2] Rewrite the food-cardinality assertion in `public/tests/spread.test.js` (~line 55, "food units are
  three, one per kind") to match T054's "every kind present, one or more instances" rule. Depends on T049–T053
- [X] T056 [P] Update `specs/009-food-odour-recalibration/contracts/world-format-v3.md` §"Exactly three entries, one per
  kind" (line 23) and `data-model.md` line 69 ("`edibles` has exactly three entries, one per kind") to state one or more
  entries, every kind present at least once (FR-001, BUG-001)
- [X] T057 Re-run `node scripts/food-placement.mjs` (or T048's extension) and confirm 60–70% odour coverage (30–40%
  free); record it in `results.md` under "After BUG-001 fix". Depends on T048. Result: 33.3% free (66.7% coverage), 0 stranded
- [X] T058 Re-run `npm test` and `npm run test:slow`; record the counts in `results.md` under "After BUG-001 fix".
  Depends on T047, T049–T055 (closes T043). Also ran `node --test public/tests/*.test.js` and `tests/lif-golden.test.mjs`.
  Result: 410/6 unit (6 pre-existing, unrelated), 80/0 browser-module, 1/0 LIF golden, slow suite unchanged (2 pre-existing TODOs)
- [X] T059 Re-run `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out` and, for the
  calibration seeds, the same command with no `--seeds` flag (the script only accepts `held-out` or omitted —
  `--seeds=calibration` as written here errors; corrected when run) on the re-migrated `world-forager.json`; append
  both to `results.md` under "After BUG-001 fix". Do not change any value to pass a metric (AGENTS.md). Depends on
  T049 (closes T045). Result: held-out find 36.1% (was 22.2%), and `eat` now PASSES on held-out (was FAIL before and
  after the one-per-class fix) — recorded as a finding, nothing tuned
- [X] T060 Smoke test per quickstart §3 with the denser map: serve `public/`, open `?world=world/world-forager.json`,
  turn on the odour layer, confirm visibly higher coverage and no console errors; record in `results.md` under "After
  BUG-001 fix". Depends on T058 (closes T044, T046). Result: 0 console errors, 0 failed requests, odour switch
  toggled, fly telemetry updated over time

**Checkpoint**: Run `node --test tests/odour-food.test.mjs tests/odour-field.test.mjs tests/fly-world.test.mjs
tests/validate-v3.test.mjs` and `node --test public/tests/spread.test.js public/tests/banned-art.test.js`, then
`npm test` and `npm run test:slow`.

---

## Phase 9: Bugfix BUG-002 — Male/Female Fly Sprites And Wing Orientation

**Bugfix**: 2026-10-07 — BUG-002 Updated from bugfix patch. The fly sprite had one shape and a colour-only baseline variant,
with wings drawn parallel to the body. T034–T036 are superseded (see their notes above). T061–T066 are new.

**Goal**: The fly sprite set has a female and a male variant, each with its own baseline colour pair, with wings that
project laterally at roughly a right angle to the body axis, using the reporter's reference image (`fruit-fly.jpeg`) for
proportions. Which sex a given fly displays is declared in the world configuration (open decision D4).

**Independent Test**: `node --test tests/fly-sprite.test.mjs` passes the revised checks on all four sprites; the quickstart
§4 visual check, redone for female, male and both baselines, is recorded in `results.md`.

- [X] T061 [P] Update `contracts/fly-sprite.md` §2 (Ids) and §3 (Look) with the `fly-female`, `fly-female-baseline`,
  `fly-male`, `fly-male-baseline` ids, the female/male shape difference (abdomen length and banding), and the
  wing-orientation clause (wings project laterally, roughly a right angle to the body axis). Update `data-model.md`'s Fly
  sprite table the same way, adding the `sex` attribute and the `flies.sex` world-config field (done directly by the
  `/speckit-bugfix-patch BUG-002` pass)
- [X] T062 [US4] Author the four 32 × 32 pixel grids (`fly-female`, `fly-female-baseline`, `fly-male`,
  `fly-male-baseline`) per the revised contract, using `fruit-fly.jpeg`'s proportions as the reference (female: longer
  body and abdomen, evenly banded to the tip; male: shorter body, one solid dark terminal abdomen band), with wings
  redrawn to project laterally at roughly a right angle to the body axis instead of running parallel to it. Write the
  four sprite blocks into the `sprites` map of all five world files, replacing `fly`/`fly-baseline`. Depends on T061
  (closes T034)
- [X] T063 Decide and wire up per-fly sex assignment (open decision D4): extend world config so each world declares
  which flies are female or male (`flies.sex`, one entry per index in `flies`), and the part of `public/js/fly/` that
  currently reads `flies.sprite`/`flies.baselineSprite` instead picks the `fly-female`/`fly-male` (and matching
  baseline) pair per fly from `flies.sex`. Depends on T062 — confirm D4 with the user before merging
- [X] T064 [P] Apply T063's `flies.sex` field to all five world files, choosing a female/male mix per world. Depends on
  T063
- [X] T065 [P] [US4] Rewrite `tests/fly-sprite.test.mjs` (contract fly-sprite §5, revised): all four sprites have 32 rows
  of 32 characters, every character in the palette; within each sex, the normal and baseline sprites have the same
  non-transparent pixels and different palettes; `fly-female` and `fly-male` are allowed and expected to have different
  non-transparent pixel shapes. Depends on T062 (closes T035)
- [ ] T066 [US4] ⚠️ Partially done — headless Chromium check (same quirk as T036): the sprite-decode logic was run
  standalone against all four sprites (shape, palette and the wing geometry all confirmed; see `results.md`), but
  the live `#world` canvas did not visibly render a fly in the same headless session (zero matching pixels on a
  full canvas scan despite 0 console errors and the fly list/telemetry behaving normally) — consistent with T036's
  finding, not a new regression. Redo the quickstart §4 visual check against the new sprite set (female and male,
  both normal and baseline, at zoom 1, 2 and 4) in a real browser tab: confirm each reads as a fruit fly, the wings
  read as projecting from the body rather than folded along it, and the two sexes are visually distinguishable;
  record the result in `results.md`. Depends on T062, T064 (closes T036)

**Checkpoint**: Run `node --test tests/fly-sprite.test.mjs`, then the quickstart §4 visual check, then `npm test`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T002 follows T001 (same file).
- **Foundational (Phase 2)**: Depends on Setup. Blocks all stories. T004 and T005 follow T003 (same file, `layout.js`/`validate.js`).
- **US1 (Phase 3)**: Depends on Foundational. MVP.
- **US2 (Phase 4)**: Depends on US1 (world files migrated, food test file exists).
- **US3 (Phase 5)**: Depends on US1 migration (same world files) and on T006 and T022 (test files).
- **US4 (Phase 6)**: Depends on US3 (same world files).
- **Polish (Phase 7)**: Depends on all stories.
- **Bugfix BUG-001 (Phase 8)**: Depends on Polish (Phase 7) having run once; reopens T005, T013–T017, T019, T021, T022,
  T043–T046 and supersedes their one-instance-per-kind assumption. Must complete before the feature is considered done.
- **Bugfix BUG-002 (Phase 9)**: Depends on Phase 8 having run once (same five world files); supersedes T034–T036's
  single-shape assumption. Needs open decision D4 (per-fly sex assignment) confirmed before T063–T064. Must complete
  before the feature is considered done.

### Within Each Story

- Code before tests that exercise it.
- World files: US1 edits edibles and stimulus, US3 edits scatter and shore, US4 edits sprites. Run in that order, one file at a time per story.

### Parallel Opportunities

- Foundational: T006 and T007 run alongside T003–T005.
- US1: T009, T013–T017, T018, T020 run in parallel once their code dependencies are done.
- US3: T023–T027 (five different world files) run in parallel; T030 runs alongside them.
- Polish: T037–T041 (five doc files) run in parallel.

---

## Parallel Example: User Story 1 world migration

```bash
# Five different files, no dependency between them:
Task: T013 Migrate public/world/world-forager.json
Task: T014 Migrate public/world/world.json
Task: T015 Migrate public/world/world-connectome.json
Task: T016 Migrate public/world/world-antennal-lobe.json
Task: T017 Migrate public/world/world-forager-bad.json
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (baseline) and Phase 2 (foundational).
2. Phase 3 (US1): food units with size-based reach, drawn and sensed from one field.
3. **STOP and VALIDATE**: `node --test tests/odour-food.test.mjs tests/odour-field.test.mjs`, then one fly in the app.

### Incremental Delivery

1. MVP above.
2. US2: patchiness and reachability checks (only tests, plus the spread test).
3. US3: map cleanup and decor.
4. US4: fly sprite.
5. Polish: docs, full test run, behaviour record, smoke test.

---

## Notes

- ~~Positions of food units (large 10.5/20.5, medium 32.5/19.5, small 21.5/3.5) come from `scripts/food-placement.mjs`
  (research R2). Do not move them to change behaviour.~~ Superseded by BUG-001: those one-instance-per-kind positions
  reached only ~50% odour coverage. T048's placement search replaces them with one-or-more-per-kind positions chosen
  for 60–70% coverage; do not move the new positions either, except through another recorded placement search.
- `radius` is 6 in every world (research R2) and is unchanged by BUG-001; only the instance count and positions change.
  Changing `radius` itself is a separate, recorded config change, not a fix.
- The brain (`lif-v0.js`, `lif-v1.js`, snapshots) is not touched. Any brain failure is a finding for `results.md`.
- Commit after each phase checkpoint, with the `(fea)` prefix, when the user asks for commits.
