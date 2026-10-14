---

description: "Task list for the Wide-I/O Forager Brain (Brain v2) feature"
---

# Tasks: Wide-I/O Forager Brain (Brain v2)

**Input**: Design documents from `/specs/013-wide-io-forager-brain/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution requires tests for the extractor and for any snapshot/protocol/channel-
declaration change (Development Workflow & Quality Gates), so test tasks are not optional here even though the
spec did not demand strict TDD ordering — they are listed beside their implementation, not gated ahead of it.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P1/P2/P3/P3, in that document's own
order: US1 Watch a fly brake/avoid/touch, US2 Re-extract, US3 Keep every brain/world working, US4 Side panel, US5
Escape toggle, US6 Compare arms). Build order below follows real dependencies within the P1 tier (extract → run →
verify unchanged) rather than the spec's listing order, since US1 (run in the world) needs US2's (extraction)
output snapshot to exist — the same shape of dependency the 11K brain's own tasks.md recorded between its US1/US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 = Watch a fly brake, avoid and touch · US2 = Re-extract with the wider interface · US3 = Keep
  every brain/world working · US4 = Wider channels and escape telemetry in the panel · US5 = Escape physics toggle
  · US6 = Compare against the established arms

## Path Conventions

Existing single-repository layout (`extract/`, `public/`, `scripts/`, `tests/`, `.claude/skills/`) — see
[plan.md](plan.md) Project Structure. No new top-level directory.

---

## Phase 1: Setup

**Purpose**: Bring in the data-only and vendored-tool artifacts this feature needs before any code is written.

- [X] T001 [P] Write `extract/configs/forager-brain-wide.json` per
  [contracts/extract-config-forager-wide.md](contracts/extract-config-forager-wide.md) and ADR 007 D20:
  `formatVersion: 5`, `kind: "forager-wide"`, `selection: "classSeed"`; `datasetRelease`, `edgeVariant`, `expect`,
  `admission`, `transmitterColumn`, `transmitterSign`, `defaultSign`, `minSynapses: 5`, `seeds`, `fill`,
  `weightRule`, `neuronCountRange` copied verbatim from `forager-brain-11k.json`; the twelve `inputs` entries of
  D15's table (each with `class`, `rootSide`, `pair`, and `types`/`subclasses`, plus `entryNerves`/
  `excludeReceptorTypes` where D15 specifies them); `sideMatch` keyed by the six pair names; the six `outputs`
  of D17 including `escape: {"types": ["DNp01"], "drive": "escape"}`; the two `modulators` of D20 (hunger on food
  odour only, hunger-taste on both taste pairs); `capabilities.channels` matching the twelve inputs (with `sense`/
  `site` per D20's table) and six outputs; `fidelity: {"require": true, "steps": 8, "checks": [...the six D19
  checks...]}`.
- [X] T002 [P] Create `.claude/skills/microfly-calibrate/scripts/profiles/wide-io.mjs`: `id: "wide-io"`,
  `worldPath: "world/world-forager-wide.json"`, `brainVersion: "v2"`, `referencePoint()` returning the 11K world's
  calibrated LIF block as the starting point (ADR 007 "Calibration protocol"), channels read generically from
  `ctx.capabilities.channels` (not by position, per the 11K profile's own convention). Leave the `axes`/`gates` for
  the A1 pool probes and the A2 `outputScale.escape` fit as placeholders — the real grid runs in T038.
- [X] T003 Record the pre-feature baseline: run `npm test` and
  `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract`; note the passing/failing counts so
  a regression this feature introduces is distinguishable later.

**Checkpoint**: config and vendored tooling in place; no production code touched yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared extractor and simulator plumbing — the new container `kind`, channel-declaration v5, the
`v2` brain-version value, the new filter keys, and the escape-physics primitive — that every user story below
depends on either directly or through the snapshot/world it produces.

**⚠️ CRITICAL**: No user story can be implemented until this phase is complete.

- [X] T004 [P] Add `"entryNerve"` to `FORAGER_ANNOTATION_COLUMNS` in `extract/malecns_brain/dataset.py` (ADR 007
  D15: "the snapshot does not carry that column" today — this is the fix).
- [X] T005 [P] Add failure code `E-PAIR` to `extract/malecns_brain/errors.py`, matching
  [contracts/extract-config-forager-wide.md](contracts/extract-config-forager-wide.md) Failure codes table: "A
  side-matched or probe-checked `pair` does not resolve to exactly one left and one right channel id."
- [X] T006 [P] Extend `extract/malecns_brain/admission.py`'s `_pool_fields` to also carry `entryNerve` from the
  annotation row, so every admitted body's `entryNerve` reaches pool-filter checks (depends on T004's column).
- [X] T007 [P] Extend `extract/malecns_brain/selection_forager.py`'s `_matches_input` (shared by both selection
  modules) with two optional, additive checks: a body matches only if `body.get("entryNerve")` is in
  `spec["entryNerves"]` when that key is present, and is excluded when `body.get("receptorType")` is in
  `spec["excludeReceptorTypes"]` when that key is present. Both keys absent (every existing config) must behave
  exactly as before (research.md R6).
- [X] T008 Extend `extract/malecns_brain/config.py`: add a `format_of` dispatch branch returning `"foragerWide"`
  for `(formatVersion: 5, kind: "forager-wide", selection: "classSeed")`, and `validate_forager_wide(config)`
  checking the Keys table of
  [contracts/extract-config-forager-wide.md](contracts/extract-config-forager-wide.md): `inputs[cid].pair`
  required; `sideMatch` keyed by every declared pair (not by `class`); `outputs` may include `escape`; `fidelity`
  has `require`/`steps`/`checks` (no `minContrastFraction`); each `fidelity.checks[]` entry is `{"kind":
  "contrast", "pair", "minFraction"}` or `{"kind": "sign", "from", "to"}`, raising `E-CONFIG` when a `pair`/`from`
  names an undeclared pair or `to` names an undeclared output; the same forbidden flow-strategy keys as format 4
  are still `E-CONFIG` if present.
- [X] T009 [P] Extend `extract/malecns_brain/capabilities.py`: add `validate_capabilities_v5(decl, neuron_count,
  subject)` applying R1–R6 and R8 of
  [contracts/channel-declaration-v5.md](contracts/channel-declaration-v5.md) plus the new R9 (`sense`/`site`
  required per input, non-empty strings) and R10 (exactly the six `"forager-wide"` drives, each once); add
  `KIND_DRIVES["forager-wide"] = ("turnLeft", "turnRight", "forward", "backward", "feed", "escape")`.
- [X] T010 [P] Extend `public/js/brain/capabilities.js`: add `validateCapabilitiesV5(decl, neuronCount, subject)`
  mirroring T009's rules and messages exactly (R9/R10/R11 of
  [contracts/channel-declaration-v5.md](contracts/channel-declaration-v5.md)); add `KIND_DRIVES.{'forager-wide':
  [...]}` alongside the existing `forager`/`tank` entries, exported as `FORAGER_WIDE_DRIVES`.
- [X] T011 Extend `extract/malecns_brain/container.py`: add `_check_forager_wide(header, neuron_count)`, dispatched
  from `write_container`/`read_container` when `header.get("kind") == "forager-wide"`, calling T009's
  `validate_capabilities_v5` and re-running the existing neuron-role/sign checks (N1, N2, N4 of
  `container-v4.md`) against the v5 declaration's input/output neuron counts. Depends on T009.
- [X] T012 Extend `public/js/brain/snapshot.js`: add `checkForagerWide(manifest, neuronCount)` mirroring T011,
  dispatched from `parseSnapshot` on `manifest.kind === 'forager-wide'`; extend `checkBrainVersion(brainVersion,
  containerVersion, kind, path)` to also require `kind === 'forager'` for `v1` and `kind === 'forager-wide'` for
  `v2`, failing with the message from
  [contracts/channel-declaration-v5.md](contracts/channel-declaration-v5.md) "Brain-version / kind cross-check".
  Depends on T010.
- [X] T013 [P] Extend `public/js/brain/fly-brain.js`: dispatch `version === 'v2'` to the existing
  `createV1FlyBrain({...brainConfig, version}, seed)`, unchanged otherwise (ADR 007, "Decisions: LIF core and
  runner" — "`fly-brain.js` maps `v2` to the v1 runner").
- [X] T014 [P] Extend `public/js/world/validate.js`: add `"v2"` to `BRAIN_VERSIONS`; add
  `validateFlyStimuliWide(stimuli, err)`, `validateBodySites(sites, err)` and `validateFlyEscape(escape, err)` per
  [contracts/world-config-wide-io.md](contracts/world-config-wide-io.md) (`flies.stimuli`, `flies.body.sites`,
  `flies.body.escape`), called only when `flies.brain.version` resolves to `"v2"`; `flies.body.escape` present
  under any other version is `flies.body.escape is only for version "v2"`.
- [X] T015 [P] Extend `public/js/fly/fly-config.js`'s `resolveFlies`: carry `flies.stimuli`, `flies.body.sites` and
  `flies.body.escape` (with the defaults of
  [contracts/world-config-wide-io.md](contracts/world-config-wide-io.md): `enabled: false, threshold: 0.5,
  distance: 1.5, cooldown: 2`) through to the resolved config, inert for every brain version other than `"v2"`.
- [X] T016 Extend `public/js/fly/body.js`: add a pure `applyEscape(body, drives, env)` step — when
  `env.escape?.enabled` is true, `drives.escape > env.escape.threshold` and the fly's cooldown has elapsed, move
  the body `env.escape.distance` tiles along its heading (blocked at the first non-walkable cell via the existing
  `pick` helper) and reset the cooldown; otherwise a no-op. Add the per-fly cooldown field next to `energy`/`bout`
  in `initForagerFly` (`public/js/fly/forager-step.js`), defaulting to `0`.
- [X] T017 Extend `public/js/fly/forager-step.js`: have `applyForagerMotor` call T016's `applyEscape` after
  `stepForagerBody`, reading `drives.escape ?? 0` and `env.escape` (both optional — absent for every `v1`/11K
  call site today, so this is a no-op for them); `driveValues` already maps any declared drive name generically,
  so no change there beyond confirming `escape` passes through. `senseForagerFly` (the v1 hard-coded four-channel
  function) is **not** edited (research.md R8).
- [X] T018 [P] Write `tests/capabilities-v5.test.mjs` per
  [contracts/channel-declaration-v5.md](contracts/channel-declaration-v5.md): R9 (missing `sense`/`site`), R10
  (wrong/missing/duplicate drive), R11 (unknown field), and a valid twelve-input/six-output fixture accepted; cross
  -check the same fixtures against T009's Python validator for identical messages.
- [X] T019 [P] Write `tests/snapshot-forager-wide.test.mjs`: a `kind: "forager-wide"` header with a valid v5
  declaration parses; a `kind: "forager"` header is unaffected by T012's addition (regression guard); each
  malformed case from T011/T012 is rejected with its exact message; `checkBrainVersion`'s new kind cross-check
  for both `v1`/`forager` and `v2`/`forager-wide`, and the two mismatch directions.
- [X] T020 [P] Write `tests/fly-brain-v2.test.mjs`: `createFlyBrain({version: 'v2', snapshot: <a parsed
  forager-wide fixture>}, seed)` returns the same shape as `v1`'s (same `createV1FlyBrain` under the hood), tested
  against a small synthetic forager-wide fixture, not the real dataset snapshot.
- [X] T021 [P] Write `tests/body-escape.test.mjs`: no move while `env.escape.enabled` is false regardless of
  drive value; exactly one move of `distance` tiles when enabled, above threshold, and off cooldown; no second
  move until `cooldown` seconds have elapsed; a move is blocked at the first non-walkable cell.
- [X] T022 [P] Write `extract/tests/test_config_forager_wide.py`: `validate_forager_wide` accepts T001's config
  shape; rejects each flow-strategy-only key under `selection: "classSeed"`/format 5 with `E-CONFIG`; rejects a
  `fidelity.checks` entry naming an undeclared `pair`/`from`/`to` with `E-CONFIG`; rejects a `pair` missing from
  an input's spec with `E-CONFIG`.
- [X] T023 [P] Write `extract/tests/test_container_forager_wide.py`: `write_container`/`read_container` round-trip
  a small `kind: "forager-wide"` header built from a hand-written six-drive, sense/site-carrying declaration;
  confirm a `kind: "forager"` header's round trip is byte-identical to before T011 (regression guard).

**Checkpoint**: the container format, channel declaration, brain-version dispatch, world-config keys and the
escape-physics primitive all exist and are tested in isolation. US2 and US1 can now proceed.

---

## Phase 3: User Story 2 - Re-extract the Brain with the Wider Interface (Priority: P1)

**Goal**: A format-5 `classSeed` extraction that keeps the 11K topology rule unchanged and produces a snapshot
with all twelve input and six output channels populated, sharing ≥ 94% of its neurons with the shipped 11K brain,
with a passing twelve-channel fidelity report.

**Independent Test**: Run the extractor with `forager-brain-wide.json` against the dataset; confirm every
declared channel is populated, the shared-neuron count with the 11K brain meets the configured minimum, the full
fidelity table and the six declared checks are printed and stored, and a second run gives an identical file apart
from `provenance.createdAt`.

### Implementation for User Story 2

- [X] T024 [US2] In `extract/malecns_brain/selection_class_seed.py`, extend `resolve_pools`/`_match_sides`: when a
  format-5 config declares `pair` on its inputs, group channels for side matching by `pair` instead of
  `CLASS_TO_PATHWAY`, and read `sideMatch` by that same pair name (ADR 007 D15); a pair that does not resolve to
  exactly one left and one right channel id raises `E-PAIR` (T005). Format-4 configs (no `pair` key) take the
  existing `CLASS_TO_PATHWAY` path, byte-for-byte unchanged.
- [X] T025 [US2] In `extract/malecns_brain/selection_class_seed.py`, generalize `fidelity_probe`/`_probe_pools`:
  compute the full report table over every individual declared input channel id (not three hard-coded probe
  pools) against every declared output, on both the brain and the whole graph; separately evaluate
  `config["fidelity"]["checks"]`, each a `contrast` check (a pair's L/R split against `turn-left`/`turn-right`,
  generalizing the existing steering check) or a `sign` check (a pair's merged L+R pool against a named output,
  generalizing the existing feeding check), per
  [contracts/extract-config-forager-wide.md](contracts/extract-config-forager-wide.md) "Fidelity probe". Format-4
  configs (no `checks` key) take the existing two-check path unchanged.
- [X] T026 [P] [US2] Write `extract/tests/make_forager_wide_fixture.py`: a small, labelled synthetic fixture
  carrying all six new sense classes (including bodies with `entryNerve`/`receptorType` values that must be
  filtered or excluded) and a known pair-matched L/R split, for T027's tests.
- [X] T027 [P] [US2] Write `extract/tests/test_selection_class_seed_wide.py` using T026's fixture: `entryNerves`/
  `excludeReceptorTypes` filters select/exclude the right bodies; pair-keyed side matching keeps `min(|L|,|R|)` per
  type; a deliberately broken pair raises `E-PAIR`; each `fidelity.checks` kind (`contrast`, `sign`) against a
  hand-computed probe value; declaring `escape` as an output drops `DNp01`'s outgoing edges from the brain graph,
  exactly as every other declared output's edges are dropped; the same config and fixture, extracted twice, give
  byte-identical output apart from `provenance.createdAt`.
- [X] T028 [US2] Run the extractor against the real MaleCNS v1.0 dataset with `forager-brain-wide.json`, producing
  `public/brains/forager-brain-wide.brain`; confirm the printed report (seed/fill counts, ~458K edges, 94.6% neuron
  overlap with the shipped 11K brain, all six `fidelity.checks` passing) against ADR 007 Annex A4, then commit the
  snapshot (precedent: `forager-brain-11k.brain` is committed today).

**Checkpoint**: the wide-I/O brain exists as a deterministic, fidelity-checked file. Independently verifiable via
[quickstart.md](quickstart.md) §1.

---

## Phase 4: User Story 1 - Watch a Fly Brake, Avoid and Touch in the World (Priority: P1)

**Goal**: Flies run the wide-I/O brain under the existing `v1` LIF stack (selected as brain version `"v2"`),
sensing all twelve declared channels generically from the world's declared stimuli and body sites, with the
escape drive visible but inert by default.

**Independent Test**: Open a world naming the wide-I/O snapshot under `flies.brain.version: "v2"`; confirm no
console error, and that a fly slows near tasted food, turns from danger/heat, and turns toward a touched side.

### Implementation for User Story 1

- [X] T029 [US1] Extend `public/js/fly/stimulus.js`: add a generic declared-sense sampler, e.g. `senseDeclared(
  sense, site, points, fly, stimuli, bodySites)`, reusing `falloff`/`sensoryValue` for a distance sense
  (`stimuli[sense].radius`) and a direct cell read for a contact sense (`stimuli[sense].contact`), sampling at the
  body point computed from `bodySites[site]` (`forward`/`lateral`, mirrored per the channel's declared `side`,
  rotated by the fly's heading — generalizing `antennaPoints`).
- [X] T030 [US1] Extend `public/js/fly/fly-world.js`: add a hazard lookup (e.g. `hazardPoints(world, kinds)`)
  returning world `dangers` entries filtered by kind, parallel to the existing `stimulusPoints` for `edibles`, for
  the `odour:danger` (`kinds: ["spider"]`) and `heat` (`kinds: ["lantern"]`) senses.
- [X] T031 [US1] Create `public/js/fly/forager-step-wide.js` with `forageEnvWide(f, world, flowers, hazards,
  capabilities)` (parallel to `forageEnv`, additionally carrying `f.stimuli`, `f.body.sites`, `f.body.escape` and
  the hazard lookups) and `senseForagerFlyWide(fly, env)`: builds the twelve-value `Float32Array` in declaration
  order by calling T029's sampler once per declared input channel, using its `sense`/`site` (ADR 007 W8/W9).
  Depends on T029, T030.
- [X] T032 [US1] Extend `public/js/fly/fly-host.js`: the `forager` flag covers `f.brain?.version === 'v1' ||
  f.brain?.version === 'v2'`; dispatch `senseForagerFly`/`forageEnv` (v1) vs `senseForagerFlyWide`/`forageEnvWide`
  (v2) by `f.brain.version`, keeping every other wiring (worker init, protocol-3 validation, history recording)
  shared. Depends on T031.
- [X] T033 [P] [US1] Create `public/world/world-forager-wide.json`: `flies.brain.version: "v2"`,
  `flies.brain.snapshot: "brains/forager-brain-wide.brain"`, `flies.stimuli`/`flies.body.sites` per
  [contracts/world-config-wide-io.md](contracts/world-config-wide-io.md)'s example, `flies.body.escape.enabled:
  false`, `experiment.seeds`/`experiment.heldOut` as a non-overlapping calibration/held-out split (`public/world/
  README.md` convention), `flies.brain.lif` at a placeholder (the 11K world's calibrated block) pending T038.
- [X] T034 [P] [US1] Add a `public/brains/brains.json` manifest entry `{"file": "forager-brain-wide.brain",
  "label": "Wide-I/O forager brain (ADR 007, v2)"}`, following the existing entries' shape.
- [X] T035 [P] [US1] Write `tests/stimulus-declared.test.mjs`: T029's sampler against each `sense` kind (distance
  with `radius`, contact with `contact: true`) and each `site` (`antenna` with its lateral offset, `mouth` with
  zero lateral so both sides read the same value by design, `front-leg` with its forward offset reaching a flower
  before `mouth` does).
- [X] T036 [P] [US1] Write `tests/forager-step-wide.test.mjs`: `senseForagerFlyWide` builds all twelve inputs in
  declaration order from a fixture capability declaration and world config; `forageEnvWide` carries `stimuli`/
  `bodySites`/`escape` through unchanged from the resolved `flies` config.
- [X] T037 [P] [US1] Write `tests/fly-host-wide.test.mjs`: `startFlies` on a `v2` world dispatches
  `senseForagerFlyWide`/`forageEnvWide`, not the v1 functions; a `v1` world is unaffected (regression guard).
- [ ] T038 [US1] Using the profile from T002, run `node .claude/skills/microfly-calibrate/scripts/calibrate.mjs
  --version=wide-io` through its A1 pool-probe stage (ADR 007 "Calibration protocol" point 1: brake, feed, back,
  avoid, touch directions, clamped inputs), review the candidates, and update `world-forager-wide.json`'s
  `flies.brain.lif`/`stepsPerTick`/`outputScale` with the reviewed starting point; record the run per `AGENTS.md`
  ("Working on brains").
- [ ] T039 [US1] Manual check: `cd public && python3 -m http.server 8000`, open
  `?world=world/world-forager-wide.json`; confirm no console error, and that the twelve input and six output
  channels are present with correct values over time (spec Acceptance Scenario 1–5): mouth/leg taste lowers raw
  `forward` and raises `feed`/`backward` on a flower; a touched front leg turns toward that side; the `escape`
  drive is present and non-trivial but the fly never jumps (physics off by default).
- [ ] T040 [US1] Run the existing browser timing harness against `world-forager-wide.json` with six flies; record
  the measured per-step cost against ADR 007 Annex A4's estimate (spec SC-004).

**Checkpoint**: the wide-I/O brain runs, visibly, in the world, sensing generically from declared data, with a
calibrated starting point. US2 and US1 together are the feature's MVP.

---

## Phase 5: User Story 3 - Keep Every Existing Brain and World Working (Priority: P1)

**Goal**: `flies.brain.version` gains `"v2"` with no change to `mock`/`v0`/`v1`'s meaning; every world that worked
before this feature keeps working unedited; a version or kind mismatch still refuses to start, naming both sides.

**Independent Test**: Run the mock, v0, shipped-v1, 11K and wide-I/O worlds in turn, each from its own file, with
no code change to any of them; a `v2` world naming a `forager`-kind snapshot (or vice versa) is refused.

- [X] T041 [P] [US3] Create a fixture world (e.g. `public/world/world-forager-wide-bad.json`, naming the wide-I/O
  snapshot under `flies.brain.version: "v1"`) and a test asserting the app refuses to start and names both the
  expected and actual kind, exactly as `world-forager-11k-bad.json`'s existing case does for a version mismatch.
- [X] T042 [US3] Run `npm test` and `node --test public/tests/*.test.js` and the Python suite; confirm every
  pre-existing mock/v0/v1/11K test still passes unchanged (against T003's baseline), and confirm no existing
  config/world file was edited by this feature's diff.
- [ ] T043 [US3] Manually open `/`, `/?world=world/world.v1.json`, `/?world=world/world-forager.json` and
  `/?world=world/world-forager-11k.json`; confirm each behaves exactly as it did before this feature
  ([quickstart.md](quickstart.md) §3, first four rows).

**Checkpoint**: no regression to any shipped brain or world; the wider interface is provably additive.

---

## Phase 6: User Story 4 - See the Wider Interface and Escape Telemetry in the Side Panel (Priority: P2)

**Goal**: the panel shows all twelve input and six output channels individually labelled, including `escape`'s
live value while its physics is off; every brain that declares the original channel set renders unchanged.

**Independent Test**: Select a fly running the wide-I/O brain and confirm twelve labelled input rows and six
labelled output rows, including `escape`; select a fly on `mock`/`v0`/shipped-`v1`/11K and confirm the panel is
pixel-for-pixel unchanged.

- [X] T044 [US4] Write `tests/panel-wide-channels.test.mjs`: build a `FlyStatusModel` (`public/js/ui/panel/
  model.js`, unedited) from a fixture record carrying a twelve-input/six-output `forager-wide` capabilities
  declaration; assert `mountChannelRows`/`updateChannelRows` (`public/js/ui/panel/channels.js`, unedited) render
  twelve input rows and six output rows with the declared labels, sides and values, including a non-zero
  `escape` row value; assert a four-input/five-output (11K) fixture still renders exactly four input and five
  output rows with no `escape` row. No production code change is expected to make this pass (research.md
  R10) — the task is the test, proving the existing generic sections already cover it.
- [ ] T045 [US4] Manual check: open `world-forager-wide.json`, select a fly, confirm the Inputs section shows
  "Food odour left/right", "Danger odour left/right", "Heat left/right", "Mouth taste left/right", "Leg taste
  left/right", "Touch left/right" and the Outputs section shows "Turn left/right", "Forward", "Backward", "Feed",
  "Escape", each live; then open `world-forager-11k.json` and confirm no new row or section appears (spec FR-023,
  SC-007).

**Checkpoint**: the wider interface is visible with zero new panel code; every other brain's panel is provably
untouched.

---

## Phase 7: User Story 5 - Turn Escape Physics On for Calibration (Priority: P3)

**Goal**: a maintainer can set `flies.body.escape.enabled: true` in a world config and see a fly jump once per
cooldown above threshold; the shipped default stays off, moving nothing.

**Independent Test**: With escape physics on, drive a fly's escape output above threshold and confirm one jump,
then a wait for cooldown before the next; with it off, confirm the drive never moves the fly.

- [X] T046 [US5] Write `tests/escape-integration.test.mjs`: using `forageEnvWide`/`applyForagerMotor` end to end
  (not T021's isolated `applyEscape` unit test) with a fixture motor reply whose `escape` drive stays above
  threshold for several ticks, confirm exactly one move per `cooldown` worth of ticks at the configured `tickHz`,
  and confirm zero moves when `flies.body.escape.enabled` is `false` for the same drive sequence.
- [ ] T047 [US5] Manual check (quickstart.md §4): edit a local copy of `world-forager-wide.json` setting
  `flies.body.escape.enabled: true`, reopen it, and confirm a fly whose escape drive crosses threshold jumps once
  along its heading and then waits out its cooldown; revert the local edit (no committed file change).

**Checkpoint**: escape physics is exercisable on demand, off by default, exactly as ADR 007 D17/W10 require.

---

## Phase 8: User Story 6 - Compare the Wide-I/O Brain Against the Established Arms (Priority: P3)

**Goal**: the comparison script reports the existing five forager metrics plus brake/stay/avoid/touch, and escape
as telemetry only, for the wide-I/O brain against the shipped 11K brain, a size-matched random graph and the
random walk, on held-out seeds.

**Independent Test**: Run the comparison script on the wide-I/O world; confirm a row per arm with all nine metrics
plus the escape telemetry and the held-out seed count.

- [X] T048 [P] [US6] Add `brakeMedian`, `stayMedian`, `avoidFraction`, `touchTurn` and `escapeMean` to
  `public/js/fly/metrics.js` (pure functions, Node-testable), per
  [contracts/experiment-metrics-wide.md](contracts/experiment-metrics-wide.md) Metrics 6–10.
- [X] T049 [US6] Extend `scripts/forager-arms.mjs`: add the `wide` arm (T031's `forageEnvWide`/
  `senseForagerFlyWide`) and `random-matched-wide` (the existing `rewire` helper on the wide snapshot), reusing
  `runForagerArms`/`printForagerTable`/`verdicts` extended to print T048's five new columns, with `escape` reported
  as telemetry (no pass/fail) per the contract. Depends on T048.
- [X] T050 [US6] Run `node scripts/forager-arms.mjs --world=world/world-forager-wide.json
  --brains=wide,v1-11k,random-matched-wide,baseline --seeds=held-out --json=run.json`; record the printed table in
  `specs/013-wide-io-forager-brain/results.md` (precedent: specs/012's `results.md`), reporting any metric that
  does not meet ADR 007's stated expectation as a finding, not hidden (spec FR-026).
- [X] T051 [P] [US6] Write a test asserting T048's five metric functions, on a synthetic history fixture with
  known brake/stay/avoid/touch/escape values, return the hand-computed results.

**Checkpoint**: the brain is measured against every established null arm, not just shipped. A failing metric is on
record, with the run that produced it.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T052 [P] Update `README.md`'s "Brains" table and `public/world/README.md`'s "Choosing the brain: `flies.
  brain.version`" section with the new world file/brain row and the `"v2"` value.
- [X] T053 [P] Amend
  [channel-declaration-v4.md](../008-hungry-forager-brain/contracts/channel-declaration-v4.md),
  [extract-config-classseed.md](../012-class-seeded-forager-brain/contracts/extract-config-classseed.md),
  [world-config-forager.md](../008-hungry-forager-brain/contracts/world-config-forager.md) and
  [experiment-metrics.md](../008-hungry-forager-brain/contracts/experiment-metrics.md) to cross-reference this
  feature's additions, per `AGENTS.md` ("update the contract document in the same change"), linking to this
  feature's `contracts/`.
- [X] T054 [P] Update the calibration documentation describing the `wide-io` profile and the A1/A2 additions to
  the staged protocol (research.md R11).
- [ ] T055 Run [quickstart.md](quickstart.md) §1–§5 end to end; confirm every "Expected" outcome.
- [X] T056 Run `npm test`, `npm run test:slow` and the Python suite one final time; confirm no new failures beyond
  T003's pre-existing baseline, and that the app starts with `python3 -m http.server 8000` and runs at least one
  fly of every brain (`mock`, `v0`, `v1`, 11K, wide-I/O) with no console error (constitution, "Run check").

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — blocks every user story.
- **US2 (Phase 3)**: depends on Foundational. Blocks US1 (needs a real snapshot), US3 (needs the new brain/world
  to prove it doesn't disturb the old ones), US6 (needs the brain to compare).
- **US1 (Phase 4)**: depends on US2 (T028's snapshot) and on Foundational's T013/T016/T017/T002 (dispatch, escape
  primitive, calibration tooling).
- **US3 (Phase 5)**: depends on US1/US2 existing, but touches no new production code of its own beyond one fixture
  world.
- **US4 (Phase 6)**: depends on US1 (needs a running `v2` fly to inspect in the panel).
- **US5 (Phase 7)**: depends on Foundational's T016/T017 and US1's T031-T033 (needs the wide sensing/motor path
  wired end to end to exercise escape through it).
- **US6 (Phase 8)**: depends on US1/US2 (needs the calibrated world and the snapshot).
- **Polish (Final Phase)**: depends on every phase above it that it documents.

### Within Each Story

- US2: T024 → T025 (same file, sequential); T026/T027 in parallel with each other, after T024-T025; T028 last.
- US1: T029 → T030 (independent files, but both feed T031) → T031 → T032; T033/T034/T035/T036/T037 in parallel
  once T031/T032 land; T038 → T039 → T040.
- US3: T041 parallel to nothing (first); T042 after T041; T043 last.
- US6: T048 → T049 → T050; T051 parallel to T050.

### Parallel Opportunities

- Setup: T001, T002 in parallel; T003 independent.
- Foundational: T004–T007 in parallel; T009/T010 in parallel; T013/T014/T015 in parallel (once T012 lands);
  T018–T023 all in parallel with each other once their respective implementation tasks land.
- US2 tests: T026, T027 in parallel with each other.
- US1: T033, T034, T035, T036, T037 in parallel.
- US6: T048 and T051 in parallel with T049/T050's own sequence (T051 needs only T048).
- Polish: T052, T053, T054 in parallel.

---

## Parallel Example: User Story 1

```bash
# After T031-T032 land, run the independent setup/test files together:
Task: "Create public/world/world-forager-wide.json"
Task: "Add public/brains/brains.json manifest entry"
Task: "Write tests/stimulus-declared.test.mjs"
Task: "Write tests/forager-step-wide.test.mjs"
Task: "Write tests/fly-host-wide.test.mjs"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Setup (Phase 1) + Foundational (Phase 2).
2. US2 (Phase 3): the wide-I/O brain extracts, deterministic, fidelity-checked, sharing ≥ 94% of neurons with the
   11K brain.
3. US1 (Phase 4): the brain runs in the world, sensing generically from declared data, with a calibrated starting
   point and no console error.
4. **STOP and VALIDATE**: open `world-forager-wide.json`, watch flies brake near food and turn from hazards,
   confirm the escape drive shows but never moves a fly.

### Incremental Delivery

1. Setup + Foundational → container/declaration/dispatch plumbing and the escape primitive ready.
2. US2 → the wide brain exists as a file (not yet visible in the app).
3. US1 → the brain is visible and running (MVP demo-able).
4. US3 → proven that nothing else broke.
5. US4 → the wider interface is visible in the panel, with zero new panel code.
6. US5 → escape physics is exercisable, off by default.
7. US6 → the brain is measured against the established arms.
8. Polish → docs and contracts catch up with the code.

### Parallel Team Strategy

Once Foundational is done, US2 must land before US1/US3/US6 can proceed meaningfully, but one developer can start
US2 while another begins US1's declared-sense sampler (T029/T030, which only need Foundational) against a
synthetic fixture declaration, converging once T028's real snapshot exists.
