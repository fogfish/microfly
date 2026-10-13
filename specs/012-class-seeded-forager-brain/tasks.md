---

description: "Task list for the Class-Seeded Forager Brain feature"
---

# Tasks: Class-Seeded Forager Brain

**Input**: Design documents from `/specs/012-class-seeded-forager-brain/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The constitution requires tests for the extractor and for any snapshot/protocol change
(Development Workflow & Quality Gates), so test tasks are not optional here even though the spec did not demand
strict TDD ordering — they are listed beside their implementation, not gated ahead of it.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P1/P2/P2/P3, in that document's own
order). Build order below follows real dependencies within the P1 tier (extract → run → verify unchanged) rather
than the spec's listing order, since US1 (run in the world) needs US2's (extraction) output snapshot to exist.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 = Run the brain in the world · US2 = Extract from whole functional classes · US3 = Keep the
  brain-choice mechanism unchanged · US4 = Multiple formats side by side · US5 = Panel provenance/origin · US6 =
  Compare against the established arms

## Path Conventions

Existing single-repository layout (`extract/`, `public/`, `scripts/`, `tests/`, `.claude/skills/`) — see
[plan.md](plan.md) Project Structure. No new top-level directory.

---

## Phase 1: Setup

**Purpose**: Bring in the data-only and vendored-tool artifacts this feature needs before any code is written.

- [X] T001 [P] Write `extract/configs/forager-brain-11k.json` per
  [contracts/extract-config-classseed.md](contracts/extract-config-classseed.md) and ADR 006 D14: `formatVersion: 4`,
  `kind: "forager"`, `selection: "classSeed"`, `datasetRelease: "male-cns-v1.0"`, `edgeVariant: "traced-only"`,
  `minSynapses: 5`, `seeds: [{"class": ["ALPN","ALLN","ALIN","ALON","Kenyon_Cell","MBON","DAN"]}, {"superclass":
  ["descending_neuron"]}]`, `admission: "allTraced"`, `transmitterColumn: "consensus_nt"`,
  `transmitterSign: {"gaba": -1, "glutamate": -1}`, `defaultSign: 1`, `fill: {"neuronCount": 11000,
  "excludeClasses": <ADR 003 D3 sensory list, copied from forager-brain.json>, "excludeSuperclassSuffix":
  "_sensory", "excludeSuperclasses": ["vnc_motor", "cb_motor"]}`, `inputs`/`sideMatch`/`outputs`/`modulators`/
  `capabilities` copied verbatim from `extract/configs/forager-brain.json`, `weightRule: "postFractionAbsolute"`,
  `fidelity: {"require": true, "steps": 8, "minContrastFraction": 0.1}`, `neuronCountRange: [10000, 12000]`.
- [X] T002 [P] Port `.claude/skills/microfly-calibrate/SKILL.md`, `scripts/calibrate.mjs` and `scripts/engine.mjs`
  from branch `013-forager-brain-15k-lif-v2` (`git show 013-forager-brain-15k-lif-v2:<path>`), rewording the
  `--version=v1|v2` help text and the "Extending to a new brain version" section so neither names the withdrawn
  15K brain as current (research.md §6). Do not port `scripts/profiles/v2.mjs`.
- [X] T003 [P] Port `.claude/skills/microfly-calibrate/scripts/profiles/v1.mjs` unchanged from branch
  `013-forager-brain-15k-lif-v2` and `tests/calibrate-engine.test.mjs` unchanged from the same branch; run
  `node --test tests/calibrate-engine.test.mjs` and confirm it passes with no modification (research.md §6).
- [X] T004 Record the pre-feature baseline: run `npm test` and
  `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract`; confirm the counts match
  quickstart.md's stated baseline (470 JS tests, 464 passing, 6 pre-existing failures in `tests/activity.test.mjs`)
  so a regression this feature introduces is distinguishable later.

**Checkpoint**: config and vendored tooling in place; no production code touched yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared extractor and reader plumbing that both the new selection strategy (US2) and the
side-by-side format check (US4) depend on, and that the panel (US5) needs to see the new data at all.

**⚠️ CRITICAL**: US2, US4 and US5 cannot be implemented until this phase is complete.

- [X] T005 [P] Add failure codes `E-SEED-EMPTY`, `E-SEED-OVERFLOW`, `E-TRANSMITTER-COLUMN`, `E-FIDELITY` to
  `extract/malecns_brain/errors.py`, matching the conditions in
  [contracts/extract-config-classseed.md](contracts/extract-config-classseed.md) Failure codes table.
- [X] T006 [P] Extend `extract/malecns_brain/config.py`: add a `format_of` dispatch branch for
  `(formatVersion: 4, kind: "forager", selection: "classSeed")`, and a `validate_class_seed(config)` validating
  `seeds`/`fill`/`admission`/`transmitterColumn`/`transmitterSign`/`defaultSign`/`minSynapses`/`fidelity` per the
  same contract's Keys table, raising `E-CONFIG` for any of `pathways`/`flowSteps`/`budget`/`outputAdmission`/
  `minConfidence` present under `selection: "classSeed"`.
- [X] T007 [P] Extend `extract/malecns_brain/admission.py`: add `admit_all_traced(annotations, transmitters,
  config)` implementing ADR 006 D10 — every `Traced` body admitted regardless of confidence, sign from
  `config["transmitterColumn"]` via `transmitterSign`/`defaultSign` — raising `E-TRANSMITTER-COLUMN` when
  `transmitterColumn` is not a column of the neurotransmitter table.
- [X] T008 Extend `extract/malecns_brain/container.py`: `write_container` writes the optional header fields
  (`minSynapses`, `selection`, `admission`, `fidelity`) and per-neuron `transmitter`/`origin` fields when present;
  `read_container` enforces rules 11–13 of
  [contracts/container-v4-additions.md](contracts/container-v4-additions.md) (malformed `transmitter`/`origin`/
  `fidelity`) with the exact messages given there. Depends on T005 for the shared error machinery.
- [X] T009 [P] Extend `public/js/brain/snapshot.js`: parse the optional `minSynapses`/`selection`/`admission`/
  `fidelity` header fields and per-neuron `transmitter`/`origin` fields, ignoring any field it does not know, and
  reject the malformed cases (rules 11–13) with the exact messages from
  [contracts/container-v4-additions.md](contracts/container-v4-additions.md).
- [X] T010 [P] Extend `public/js/brain/capabilities.js`: derive `"provenance"` (any of `minSynapses`/`selection`/
  `admission` present), `"fidelity"` (`fidelity` present) and `"origin"` (any neuron has non-null `origin`) into
  `capabilities.signals`, per [contracts/panel-provenance-signals.md](contracts/panel-provenance-signals.md)
  Derived signals table, leaving `signals` exactly as today for a snapshot with none of these fields.
- [X] T011 [P] Write `tests/snapshot-v4-additions.test.mjs` per
  [contracts/container-v4-additions.md](contracts/container-v4-additions.md) Contract tests: a fixture with all
  new fields present, one with none, and one fixture per malformed case (rules 11–13), asserting acceptance or
  the exact rejection message.
- [X] T012 [P] Write `tests/panel-provenance-signals.test.mjs` per
  [contracts/panel-provenance-signals.md](contracts/panel-provenance-signals.md) Contract test: three fixture
  `capabilities` objects (all three new fields, none, `fidelity` only), asserting the exact derived `signals`
  membership and that `selectSections`/`unmetSections` (`public/js/ui/panel/registry.js`, unchanged) mount or
  skip the `provenance` section accordingly.

**Checkpoint**: extractor and reader both understand the new optional data; the panel can detect it. US2, US4 and
US5 can now proceed.

---

## Phase 3: User Story 2 - Extract the Brain from Whole Functional Classes (Priority: P1)

**Goal**: A whole-class-seed-plus-connectivity-fill selection strategy that produces a byte-identical,
fidelity-checked class-seeded brain from the dataset.

**Independent Test**: Run the extractor with `forager-brain-11k.json` against the dataset; confirm every seed
class is complete, the fill size matches the configured total, the fidelity report is printed and stored, and a
second run gives an identical file apart from `provenance.createdAt`.

### Implementation for User Story 2

- [X] T013 [US2] Create `extract/malecns_brain/selection_class_seed.py` with `seed_bodies(config, bodies)`
  implementing ADR 006 D8: every traced body matching a `class`/`superclass` filter in `config["seeds"]`, no
  sampling, no budget; raises `E-SEED-EMPTY` when a filter matches nothing.
- [X] T014 [US2] In `extract/malecns_brain/selection_class_seed.py`, add `fill_candidates(config, bodies, edges,
  seeds)` implementing D9: `shared(i) = Σ syn(i→s) + syn(s→i)` over seeds, computed only on edges at or above
  `minSynapses`; keeps the top `neuronCount − |seeds|` candidates, ties on ascending `bodyId`; excludes bodies
  matching `fill.excludeClasses`/`excludeSuperclassSuffix`/`excludeSuperclasses`; raises `E-SEED-OVERFLOW` when
  seeds already exceed `fill.neuronCount`.
- [X] T015 [US2] In `extract/malecns_brain/selection_class_seed.py`, add `apply_threshold(edges, min_synapses)`
  (D11, dropping edges below the threshold before scoring, selection and weights) and reuse the
  `postFractionAbsolute` weight rule (ADR 005 D4′) computed over the thresholded, `allTraced`-admitted edge set
  (D12).
- [X] T016 [US2] In `extract/malecns_brain/selection_class_seed.py`, add `fidelity_probe(config, brain_graph,
  whole_graph, input_pools, outputs)` implementing D13's linear propagation with `numpy` (`bincount`-based
  matrix–vector steps, 8 per pool) on both graphs, returning the `FidelityReport` shape from
  [data-model.md](data-model.md); raises `E-FIDELITY`, naming the failing check and both compared values, when
  `fidelity.require` is true and the steering or feeding check fails.
- [X] T017 [US2] In `extract/malecns_brain/selection.py`, dispatch `select_brain` to
  `selection_class_seed.seed_bodies`/`fill_candidates`/`fidelity_probe` when `config["selection"] == "classSeed"`,
  leaving the existing `selection_forager.py` dispatch path for `"forager"`/absent completely untouched.
- [X] T018 [US2] Wire `selection_class_seed.py`'s per-neuron `origin` (`"seed:<class or superclass>"` / `"fill"`)
  and `transmitter`, plus the header `fidelity`/`minSynapses`/`selection`/`admission` fields, into the
  `write_container` call inside `extract/malecns_brain/__main__.py`'s extraction flow.

### Tests for User Story 2

- [X] T019 [P] [US2] Write `extract/tests/make_class_seed_fixture.py`: a small, labelled synthetic fixture with a
  known seed/fill split, a known shared-weight ranking (including a tie on `bodyId`), and a hand-computable
  fidelity probe (ADR 006 Acceptance: "Python unit tests on the labelled synthetic fixture").
- [X] T020 [P] [US2] Write `extract/tests/test_selection_class_seed.py` using the fixture from T019: seed classes
  complete with no sampling, `allTraced` admission with `defaultSign`, the threshold applied before scoring
  (D11), the D12 denominator, fill ties broken on ascending `bodyId`, and the probe against the hand-computed
  values.
- [X] T021 [P] [US2] Write `extract/tests/test_config_class_seed.py`: `validate_class_seed` accepts the shape of
  `extract/configs/forager-brain-11k.json`, rejects each of `pathways`/`flowSteps`/`budget`/`outputAdmission`/
  `minConfidence` under `selection: "classSeed"` with `E-CONFIG`, and rejects an unknown `transmitterColumn` with
  `E-TRANSMITTER-COLUMN`.
- [X] T022 [P] [US2] Write `extract/tests/test_class_seed_failures.py`: `E-SEED-EMPTY`, `E-SEED-OVERFLOW`,
  `E-FIDELITY` (message names both compared values), plus confirming the existing `E-POOL-EMPTY`/
  `E-SIDE-IMBALANCE`/`E-OUTPUT-UNREACHED`/`E-NODE-RANGE`/`E-MODULATOR` codes still fire under this strategy.
- [X] T023 [P] [US2] Write `extract/tests/test_class_seed_determinism.py`: the same config and fixture dataset,
  extracted twice, give byte-identical container bytes apart from `provenance.createdAt`.
- [X] T024 [US2] Run the extractor against the real MaleCNS v1.0 dataset with `forager-brain-11k.json`, producing
  `public/brains/forager-brain-11k.brain`; confirm the printed report (seed sizes, fill ≈ 2,873, edges ≈ 448K,
  fidelity pass) against ADR 006 Annex A3/A4, then commit the snapshot (precedent: `forager-brain.brain` is
  committed today).

**Checkpoint**: the class-seeded brain extracts deterministically with a passing, stored fidelity probe.
Independently verifiable via [quickstart.md](quickstart.md) §1 and §3.

---

## Phase 4: User Story 1 - Run the Class-Seeded Brain in the World (Priority: P1)

**Goal**: Flies run the new brain under the existing, unmodified `v1` stack, with the same six channels as the
shipped forager brain.

**Independent Test**: Open the new world file; confirm no console error and that the panel names the running
brain and its snapshot.

- [X] T025 [P] [US1] Create `public/world/world-forager-11k.json`: a copy of `world-forager.json` with
  `brain.snapshot: "brains/forager-brain-11k.brain"`, `brain.version` unchanged at `"v1"`, and
  `experiment.seeds`/`experiment.heldOut` as a non-overlapping calibration/held-out split (`public/world/README.md`
  convention); leave `flies.brain.lif` at v1's calibrated values as a placeholder pending T028.
- [X] T026 [P] [US1] Add a `public/brains/brains.json` manifest entry `{ "file": "forager-brain-11k.brain",
  "label": "Class-seeded forager brain (ADR 006, 11K)" }`, following the existing entries' shape exactly.
- [X] T027 [P] [US1] Create `.claude/skills/microfly-calibrate/scripts/profiles/class-seed-11k.mjs` per
  [contracts/calibration-profile.md](contracts/calibration-profile.md): `id: "class-seed-11k"`,
  `worldPath: "world/world-forager-11k.json"`, `brainVersion: "v1"`, `regionNames: ["all"]`, `referencePoint()`
  returning v1's calibrated LIF block, `axes` widened with `inhibitoryScale`, `adapt` (`[tauAdapt, adaptStep]`
  pair) and `thresholdJitter` (ADR 006 Calibration protocol point 3), `gates` with `ceilingExemptGroups:
  ['output']` and `rateBasis: 'perStep'` (branch 013 BUG-002/BUG-003), channels read generically from
  `ctx.capabilities.channels` (not by position).
- [X] T028 [US1] Using the profile from T027, run
  `node .claude/skills/microfly-calibrate/scripts/calibrate.mjs --version=class-seed-11k` through its staged
  `classify` → `auto` steps (human-paced, per `SKILL.md`'s own ask-before-running Step 1), review the candidates,
  and update `world-forager-11k.json`'s `flies.brain.lif`/`stepsPerTick`/`outputScale` with the reviewed result;
  record the run (seeds, grid, chosen values) per `AGENTS.md` ("Working on brains").
- [ ] T029 [US1] Manual check: `cd public && python3 -m http.server 8000`, open
  `?world=world/world-forager-11k.json`; confirm no console error, the panel names the snapshot and its release,
  and the six existing channels (odour L/R, taste L/R, turnLeft/turnRight, forward, backward, feed) are present
  with none added, removed or resized (spec FR-003, Acceptance Scenario 2).
- [ ] T030 [US1] Run the existing browser timing harness (`public/tests/forager-timing.html`) against
  `world-forager-11k.json` with six flies; record the measured per-step cost against ADR 006 Annex A6's
  ≈0.1–0.25 ms estimate (spec SC-004).

**Checkpoint**: the class-seeded brain runs, visibly, in the world, with a calibrated starting point. US1 and US2
together are the feature's MVP.

---

## Phase 5: User Story 3 - Keep the Brain Choice Mechanism Unchanged (Priority: P1)

**Goal**: `flies.brain.version` still takes only `mock`/`v0`/`v1`; every world that worked before this feature
still works unedited; a version mismatch still refuses to start.

**Independent Test**: Run the mock, v0, shipped-v1 and class-seeded worlds in turn, each from its own file, with
no code change; a world naming the new snapshot under the wrong version is refused.

- [X] T031 [P] [US3] Extend `public/tests/` with a fixture world (e.g. `world-forager-11k-bad.json`, naming the
  new snapshot under `flies.brain.version: "v0"`) and a test asserting the app refuses to start and names both
  versions, exactly as the existing `world-forager-bad.json` case does.
- [X] T032 [US3] Run `npm test` and `node --test public/tests/*.test.js`; confirm every pre-existing mock/v0/v1
  test still passes unchanged, and grep the diff for this feature to confirm no new `flies.brain.version` value
  was introduced anywhere.
- [ ] T033 [US3] Manually open `/`, `/?world=world/world-connectome.json`, `/?world=world/world-antennal-lobe.json`
  and `/?world=world/world-forager.json`; confirm each behaves exactly as it did before this feature
  ([quickstart.md](quickstart.md) §4, first three rows).

**Checkpoint**: no regression to any shipped brain or world; the selection mechanism is provably unchanged.

---

## Phase 6: User Story 4 - Extract Multiple Brain Formats Side by Side (Priority: P2)

**Goal**: the small brain, the existing flow-ranked forager brain, and the new class-seeded brain all keep
extracting correctly from the same codebase; an unrecognized format/selection combination still fails cleanly.

**Independent Test**: Run all three extractor configs in one session; diff the two pre-existing outputs against
their committed files.

- [X] T034 [P] [US4] Re-extract with `extract/configs/smallest-functional-brain.json` and
  `extract/configs/antennal-lobe-brain.json`; diff byte-for-byte (ignoring `provenance.createdAt`) against the
  committed files to confirm zero regression from T006/T007/T008's extensions.
- [X] T035 [P] [US4] Re-extract with `extract/configs/forager-brain.json`; diff byte-for-byte (ignoring
  `provenance.createdAt`) against the committed `public/brains/forager-brain.brain`.
- [X] T036 [P] [US4] Write a dispatch-table test (extend `extract/tests/test_config.py` or add
  `extract/tests/test_config_dispatch.py`) asserting `format_of` resolves `(2, absent, —)` → small/v3,
  `(3, "forager", absent)` → forager/v4, `(4, "forager", "classSeed")` → class-seeded/v4, and any other
  combination raises `E-CONFIG` naming the offending key.

**Checkpoint**: three formats, one extractor, zero cross-contamination — verified by diff, not assumption.

---

## Phase 7: User Story 5 - See the New Brain's Provenance and Neuron Origin in the Panel (Priority: P2)

**Goal**: the side panel shows selection strategy, admission rule, synapse threshold and fidelity state for
brains that declare them, and lets the user distinguish seed from fill neurons — with zero change for every
brain that declares none of this.

**Independent Test**: Select a fly on the class-seeded brain and confirm the new section and legend appear;
select a fly on `mock`/`v0`/shipped-`v1` and confirm the panel is pixel-for-pixel unchanged.

- [X] T037 [P] [US5] Extend `public/js/ui/panel/model.js`: project `provenance: { selection, admission,
  minSynapses }` and `fidelity: FidelityReport` from the snapshot header into `FlyStatusModel` only when
  `capabilities.signals` includes `"provenance"`/`"fidelity"` respectively
  ([contracts/panel-provenance-signals.md](contracts/panel-provenance-signals.md) Model additions).
- [X] T038 [US5] Create `public/js/ui/panel/provenance.js`: a new section (`id: 'provenance'`, `title: 'Brain
  provenance'`, `requires: { signal: 'provenance' }`) with `mount`/`update`/`dispose` drawing `selection`/
  `admission`/`minSynapses` rows — only the rows the model actually has — and, when the model also carries
  `fidelity`, the pass/fail state plus a toggle revealing the full `fidelity.table`.
- [X] T039 [US5] Register the `provenance` section from T038 in `public/js/ui/panel/registry.js`'s initial
  sections list, with no change to the registry's lifecycle code itself (panel-sections.md is unchanged by this
  feature except for this one new entry).
- [X] T040 [P] [US5] Extend the brain activity view (`neuron-map` section) to read each neuron's `origin`/
  `transmitter` only when `capabilities.signals` includes `"origin"`: draw a seed-vs-fill legend and colour/marker
  channel independent of the existing spike-brightness envelope, and show `transmitter` on hover/selection
  alongside the existing `bodyId`/`type`/`class` identity.
- [X] T041 [P] [US5] Extend `tests/panel-provenance-signals.test.mjs` (or add a DOM-level test under `public/tests/`)
  asserting the `provenance` section mounts only when its signal is present, and is absent for `mock`/`v0`/
  shipped-`v1` fixtures (completing T012's coverage at the section level).
- [ ] T042 [US5] Manual check: open `world-forager-11k.json`, select a fly, confirm "Brain provenance" shows
  `selection: classSeed`, `admission: allTraced`, `minSynapses: 5`, fidelity pass, and the activity view
  distinguishes seed vs. fill neurons; then open `world-forager.json` (shipped v1) and confirm no new section
  appears and the activity view is unchanged (spec FR-023, SC-007).

**Checkpoint**: the new brain's distinguishing feature is visible; every other brain's panel is provably
untouched.

---

## Phase 8: User Story 6 - Compare the New Brain Against the Established Arms (Priority: P3)

**Goal**: the existing comparison script reports the five forager metrics, on held-out seeds, for the
class-seeded brain and the "v1 selection under D10–D12" arm alongside the shipped `v1` forager, the size-matched
random graph and the random walk.

**Independent Test**: Run the comparison script on the class-seeded world; confirm a row per arm with all five
metrics and the held-out seed count.

- [X] T043 [P] [US6] Create `extract/configs/forager-brain-v1-rules.json` (ADR 006 Gate C arm 3): the shipped
  forager's own flow/budget selection, re-run with `admission: "allTraced"`, `minSynapses: 5` and the D12
  denominator; extract it and confirm its fidelity probe passes at ≈3,644 neurons (ADR 006 Annex A4).
- [X] T044 [US6] Extend `scripts/forager-arms.mjs`: add the class-seeded brain and the "v1 selection under
  D10–D12" brain (T043's output) as named arms, reusing `runForagerArms`/`armMetrics`/`printForagerTable`/
  `verdicts` unchanged, alongside the existing size-matched random graph and random-walk arms.
- [X] T045 [US6] Run `node scripts/compare-baseline.mjs --world=world/world-forager-11k.json
  --brains=class-seed-11k,v1,v1-selection-rules,random-matched,baseline --json=run.json` on held-out seeds;
  record the printed table in `specs/012-class-seeded-forager-brain/results.md` (precedent: spec 008's
  `gate-c.md`), reporting any metric that does not beat the random walk or the random graph as a finding, not
  hidden (spec FR-025).
- [X] T046 [P] [US6] Add an assertion (script or test) that the two new arms appear in `forager-arms.mjs`'s
  output with the same five-metric shape as the pre-existing arms — no special-casing.

**Checkpoint**: the brain is measured, not just shipped. A failing metric is on record, with the run that
produced it.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T047 [P] Update `README.md`'s "Brains" table and `public/world/README.md`'s "Choosing the brain: `flies.
  brain.version`" section with the new world file/brain row (still only `mock`/`v0`/`v1`).
- [X] T048 [P] Amend `specs/008-hungry-forager-brain/contracts/container-v4.md` and
  `contracts/extract-config-forager.md` to cross-reference this feature's additions, per `AGENTS.md` ("update the
  contract document in the same change"), linking to
  [contracts/container-v4-additions.md](contracts/container-v4-additions.md) and
  [contracts/extract-config-classseed.md](contracts/extract-config-classseed.md).
- [X] T049 [P] Update `doc/CALIBRATION.md` to describe the ported `microfly-calibrate` skill workflow and the
  `class-seed-11k` profile, reworded (research.md §6) so it does not describe the withdrawn 15K brain as current.
- [ ] T050 Run [quickstart.md](quickstart.md) §1–§7 end to end; confirm every "Expected" outcome.
- [X] T051 Run `npm test` and `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract` one
  final time; confirm no new failures beyond T004's pre-existing 6, and that the app starts with
  `python3 -m http.server 8000` and runs at least one fly of every brain with no console error (constitution,
  "Run check").

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup — blocks US2, US4 and US5.
- **US2 (Phase 3)**: depends on Foundational. Blocks US1 (needs a real snapshot), US4 (needs the new strategy to
  diff against), US6 (needs the brain to compare).
- **US1 (Phase 4)**: depends on US2 (T024's snapshot) and on T002/T003/Foundational for the calibration tooling.
- **US3 (Phase 5)**: depends on US1/US2 existing (so there is a new brain/world to prove *doesn't* disturb the
  old ones) but touches no new production code of its own.
- **US4 (Phase 6)**: depends on Foundational and US2 (needs the new strategy in place to prove it coexists).
- **US5 (Phase 7)**: depends on Foundational (T009/T010) and US1 (needs a running fly to inspect in the panel).
- **US6 (Phase 8)**: depends on US1/US2 (needs the calibrated world and the snapshot).
- **Polish (Final Phase)**: depends on every phase above it that it documents.

### Within Each Story

- US2: T013 → T014 → T015 → T016 (same file, sequential) → T017 → T018; tests T019–T023 in parallel with each
  other, after T013–T018; T024 last.
- US1: T025/T026/T027 in parallel → T028 → T029 → T030.
- US5: T037 → T038 → T039 (same chain); T040/T041 parallel to T037–T039; T042 last.
- US6: T043 → T044 → T045; T046 parallel to T045.

### Parallel Opportunities

- Setup: T001, T002, T003 in parallel.
- Foundational: T005, T006, T007 in parallel; T009, T010 in parallel (once T008 lands); T011, T012 in parallel.
- US2 tests: T019–T023 in parallel with each other.
- US1 setup: T025, T026, T027 in parallel.
- US4: T034, T035, T036 fully in parallel (independent configs/diffs/test file).
- US5: T037 and T040 in parallel; T041 in parallel with both.
- Polish: T047, T048, T049 in parallel.

---

## Parallel Example: User Story 2

```bash
# After T013-T018 land, run the independent test files together:
Task: "Write extract/tests/make_class_seed_fixture.py"
Task: "Write extract/tests/test_selection_class_seed.py"
Task: "Write extract/tests/test_config_class_seed.py"
Task: "Write extract/tests/test_class_seed_failures.py"
Task: "Write extract/tests/test_class_seed_determinism.py"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Setup (Phase 1) + Foundational (Phase 2).
2. US2 (Phase 3): the brain extracts, deterministic, fidelity-checked.
3. US1 (Phase 4): the brain runs in the world, calibrated, with no console error.
4. **STOP and VALIDATE**: open `world-forager-11k.json`, watch flies behave, confirm the panel names it.

### Incremental Delivery

1. Setup + Foundational → tooling and plumbing ready.
2. US2 → the brain exists as a file (not yet visible in the app).
3. US1 → the brain is visible and running (MVP demo-able).
4. US3 → proven that nothing else broke.
5. US4 → proven the extractor still produces every other format.
6. US5 → the new brain's provenance is visible, every other brain's panel untouched.
7. US6 → the brain is measured against the established arms.
8. Polish → docs and contracts catch up with the code.

### Parallel Team Strategy

Once Foundational is done, US2 must land before US1/US4/US6 can proceed meaningfully, but one developer can
start US2 while another begins US5's panel-side plumbing (T037/T040, which only need Foundational's T009/T010)
against a temporary fixture snapshot, converging once T024's real snapshot exists.
