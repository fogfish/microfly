# Tasks: Pathway-aware interneuron selection (taste → forward inhibitory bias)

**Input**: Design documents from `/specs/012-pathway-aware-selection/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/extract-config-forager.md, quickstart.md

**Tests**: Explicitly requested — spec.md FR-013 and the original feature description both require extractor
tests. Test tasks are included and must be written before the implementation tasks that make them pass.

**Organization**: spec.md has exactly one user story (P1). Setup and Foundational hold work that is genuinely
prerequisite to it (baseline confirmation, the shared test fixture, the living contract update); everything that
delivers the feature's own behaviour — schema, scoring, report, shipped config, and their tests — lives in the
User Story 1 phase. Polish holds the gate re-runs the plan invocation asked for.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: Belongs to User Story 1 (the feature's only story)
- File paths are exact and relative to the repository root unless noted

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline so every later pass/fail is attributable to this feature.

- [X] T001 Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and confirm the full suite
  passes before any file in this feature is touched. Record the result (pass count) for reference in later gate
  records.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared artifacts the user story's tests and gates depend on.

**⚠️ CRITICAL**: T003 must land before any task in Phase 3 that touches `test_selection_forager.py`.

- [X] T002 Merge the contract amendment into the living contract document: apply
  `specs/012-pathway-aware-selection/contracts/extract-config-forager.md` (rules P1–P5, the `pathwayBias` key row,
  the updated report-line note) into `specs/008-hungry-forager-brain/contracts/extract-config-forager.md` in
  place, per `AGENTS.md`'s rule that a contract change lands "in the same change" as the schema it documents.
- [X] T003 Extend `extract/tests/fixtures/forager-synthetic.json` (synthetic, labelled per Constitution III — update
  the fixture's `"note"` field): add one interneuron body with `sign == -1` and a direct edge into the `forward`
  output pool's body (405), and one further body upstream of it reachable from `taste-left`/`taste-right`. Choose
  synapse counts so that, under *today's* plain backward flow (seeded at every output pool's own bodies, per ADR
  003 D3 step 2), the upstream body's score is low enough to miss a deliberately small `budget.taste` override the
  new tests will use (not the fixture's shipped `config.budget`, so `SelectionTest`'s existing assertions are
  unaffected) — but once backward flow is seeded directly at the new inhibitory body instead of at `forward`
  itself, the upstream body's score rises enough to be admitted within that same small budget. (The one-hop
  dilution this removes — the inhibitory body's own fan-out fraction into `forward` — is exactly the effect
  research.md D1/D3 describe; pick synapse counts that make it measurable, e.g. the inhibitory body sending most of
  its output elsewhere and only a small fraction into `forward`.)

**Checkpoint**: Contract and fixture are ready; User Story 1's tests can now be written against them.

---

## Phase 3: User Story 1 - Pathway-aware interneuron selection (Priority: P1) 🎯 MVP

**Goal**: The extractor favours interneurons that complete a declared pathway → inhibitory-output circuit over
ones that merely touch some unrelated reachable output, using only dataset-derived sign and connectivity, without
changing weight/sign rules or the existing per-pathway budgets.

**Independent Test**: Extract the forager brain twice from the same dataset snapshot — once with
`pathwayBias: []`, once with the shipped taste→forward rule — and confirm: (a) the first run is byte-identical to
today's shipped extraction apart from `provenance.createdAt`; (b) the second run's admitted taste interneurons
differ from the first's while the taste budget's admitted count stays the same; (c) every weight and sign in both
runs still traces to the dataset.

### Tests for User Story 1 (write first — confirm they fail before Phase 3's implementation tasks)

- [X] T004 [P] [US1] In `extract/tests/test_config_forager.py`: add cases —
  - `pathwayBias: []` validates with no error (contract P1, the no-op case).
  - a rule whose `pathway` is not a key of `config["pathways"]` fails `E-CONFIG`, naming that pathway id (contract
    P5).
  - a rule whose `intoOutput` is not a key of `config["outputs"]` fails `E-CONFIG`, naming that output id (contract
    P5).
  - a malformed (`id` not matching `[a-z][a-z0-9-]*`) or duplicate `pathwayBias[*].id` fails `E-CONFIG`.
- [X] T005 [P] [US1] In `extract/tests/test_selection_forager.py`, using T003's extended fixture:
  - with `pathwayBias: []`, every existing `SelectionTest` and `WeightRuleAbsoluteTest` assertion is unchanged, and
    the new bodies from T003 are *not* admitted under the small `budget.taste` override (FR-007 baseline).
  - with the taste→forward rule declared and the same small `budget.taste` override, the new upstream body from
    T003 *is* admitted, while the number of taste-budget admissions stays identical between the two runs (FR-003,
    FR-006).
  - a rule naming an output pool with zero inhibitory in-edges in the fixture (craft one, e.g. into `feed` where
    the only in-edge is excitatory) boosts no candidate and raises no error.
  - a body with zero forward flow from the rule's own pathway (no path at all from that pathway's seeds) stays
    unadmitted regardless of how strong its rule-seeded backward flow is (FR-004).
  - every synapse weight and sign in both runs' output still matches the dataset-derived rule unchanged (FR-005) —
    reuse the existing `test_weights_are_post_fraction_and_inflow_sums_are_at_most_one`-style assertion against the
    rule-bearing run.
- [X] T006 [P] [US1] In `extract/tests/test_forager_determinism.py`: add a case that two extractions of the same
  config with a non-empty `pathwayBias` still produce byte-identical output (extends the existing determinism
  guarantee, SC-001/contract P1, to the new key).

### Implementation for User Story 1

- [X] T007 [US1] `extract/malecns_brain/config.py`: add `PATHWAY_BIAS_KEYS = {"id", "pathway", "intoOutput"}` and
  `"pathwayBias"` to `FORAGER_KEYS`; add `_check_pathway_bias(rules, pathways, outputs)` — list, possibly empty;
  each entry an object with exactly `PATHWAY_BIAS_KEYS`; `id` matches `MODULATOR_ID` and is unique within the list;
  `pathway` must be a key of `pathways`; `intoOutput` must be a key of `outputs`; every failure raises `E-CONFIG`
  naming the offending id (contract P5, no new failure code) — and call it from `validate_forager`. Depends on:
  T004 existing (red) to turn green.
- [X] T008 [US1] `extract/malecns_brain/selection_forager.py`: after computing today's plain `b_flow`, for each
  declared `pathwayBias` rule compute its inhibitory seed set — admitted bodies with `sign == -1` that have at
  least one edge (in the already-restricted `pre_i`/`post_i`, before the output-outgoing-edge drop, which does not
  remove edges *into* an output) landing on a body in the rule's `intoOutput` pool — then its backward flow via the
  existing `_flow(post_i, pre_i, syn, n, seeds, steps=config["flowSteps"])`, unchanged in shape from today's
  `b_flow` call. Group the resulting arrays by `rule["pathway"]` and take the elementwise `max` with the plain
  `b_flow` to get each pathway's effective backward-flow array (data-model.md `PathwayEffectiveBackwardFlow`); use
  that pathway-specific array, instead of the single shared `b_flow`, in `score_odour`/`score_taste`. No new
  tunable weight (research.md D1) — the `max` alone must make FR-003 and FR-004 hold. Depends on: T007 (so a
  config carrying `pathwayBias` validates before selection code runs against it); makes T005 green.
- [X] T009 [US1] `extract/malecns_brain/__main__.py`: `report_forager` gains one printed line per declared
  `pathwayBias` rule — `boosted` (admitted interneurons whose own pathway's effective backward flow at their index
  came from this rule, not the plain `b_flow`) and `admittedOnlyByRule` (of those, how many fall outside the
  top-`budget[pathway]` set plain `b_flow` alone would have produced) — per data-model.md's report-addition entity
  and spec FR-012/FR-011. Depends on: T008 (needs the per-rule arrays it produces).
- [X] T010 [US1] `extract/configs/forager-brain.json`: add
  `"pathwayBias": [{"id": "taste-forward-brake", "pathway": "taste", "intoOutput": "forward"}]` (spec FR-009).
  Depends on: T007 (so the shipped config validates).
- [X] T011 [P] [US1] `extract/malecns_brain/selection_forager.py`: update the module docstring to cite "ADR 003
  D3′" for the new scoring rule, per `AGENTS.md`'s decision-citation code style (research.md D7 — no new ADR
  file).

**Checkpoint**: User Story 1 is fully functional and independently testable — `pathwayBias` is config-declared,
dataset-grounded (weight/sign untouched, FR-005), budget-preserving (FR-006), and covered by schema and selection
tests (T004–T006 green).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: The plan invocation's own ask — adjust the testing gates and compare against the currently-shipped
topology — plus the end-to-end checks `AGENTS.md` requires before calling a feature done.

- [X] T012 [P] `extract/tests/compare_forager_topology.py` (new, Gate-A-style script — not part of `unittest
  discover`, same category as the existing `tests/bench_forager.py`): needs `MALECNS_DIR`. Loads the dataset and
  restricted edge table once, runs `select_forager` twice in the same process — `config["pathwayBias"]` forced to
  `[]` (today's shipped topology, guaranteed byte-equivalent by contract P1) vs. the config as shipped (T010) — and
  prints the `TopologyDiff` (data-model.md): added/removed `bodyId`s per pathway budget, the edge-count delta, and
  a sanity check that every added body's rule-seeded backward flow is strictly positive. Depends on: T008, T010.
- [X] T013 Gate A run: regenerate `public/brains/forager-brain.brain` —
  `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config
  configs/forager-brain.json --out ../public/brains/forager-brain.brain` — and append the printed report (now
  including T009's new lines) to `specs/012-pathway-aware-selection/gate-a.md`, same shape as
  `specs/008-hungry-forager-brain/gate-a.md`: neuron count against `neuronCountRange`, every output pool reached,
  odour side balance, weight range. Depends on: T007–T010.
- [X] T014 Gate A topology comparison: run T012's script against the real dataset and append its printed
  `TopologyDiff` to `specs/012-pathway-aware-selection/gate-a.md` under a "Comparison with the current forager
  brain" heading, stating plainly whether the difference is significant — report the exact counts either way; this
  is a measurement, not a pass/fail gate (`AGENTS.md`'s "behaviour failures are findings"). Depends on: T012, T013.
- [X] T015 [P] Gate A byte identity: run T013's extraction command twice into two separate output files and `cmp`
  them after stripping `provenance.createdAt`; record "identical" (or the diff) in `gate-a.md`, same check as
  `specs/008-hungry-forager-brain/gate-a.md`. Depends on: T013.
- [ ] T016 Gate B run: serve `public/` (`cd public && python3 -m http.server 8000`), open
  `public/tests/forager-timing.html`, six `v1` flies at 60 s, record mean/p95 tick time in
  `specs/012-pathway-aware-selection/gate-b.md`, confirming no regression from the admitted-neuron-set change
  (spec FR-014). Depends on: T013.
- [X] T017 Gate C run: `node scripts/compare-baseline.mjs --world=world/world-forager.json
  --brains=v1,random-matched,mock,baseline --seeds=held-out --json=specs/012-pathway-aware-selection/gate-c.json`;
  write the table and verdicts to `specs/012-pathway-aware-selection/gate-c.md`, same shape as
  `specs/008-hungry-forager-brain/gate-c.md`, alongside the pre-feature baseline numbers already recorded there.
  Report any regression as a finding, not tuned away (spec FR-014). Depends on: T013.
- [X] T018 Run `quickstart.md` steps 1–8 end to end and confirm each step's stated expected outcome. Depends on:
  T004–T017.
- [X] T019 App smoke check: `cd public && python3 -m http.server 8000`, open
  `?world=world/world-forager.json`, confirm one fly runs with no console errors (`AGENTS.md`'s pre-done check).
  Depends on: T013.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. T003 (fixture) blocks every task in Phase 3 that touches
  `test_selection_forager.py` (T005). T002 (contract merge) has no code dependency and can run any time before
  Phase 4 closes out the feature.
- **User Story 1 (Phase 3)**: Depends on Foundational. Within it: tests (T004–T006) are written first; T007
  (schema) before T008 (selection) and T010 (shipped config); T008 before T009 (report needs T008's arrays); T011
  has no code dependency beyond the file existing.
- **Polish (Phase 4)**: Depends on User Story 1 being complete (T007–T011). T012 before T014. T013 before T014,
  T015, T016, T017, T019. T018 last.

### Parallel Opportunities

- T004, T005, T006 (three different test files) can be written in parallel once T003 lands.
- T011 (docstring) can run in parallel with T007–T010 (different concern, same file as T008 — sequence after T008
  to avoid a same-file conflict, or fold into the same edit).
- T012 and T015 can run in parallel with each other once T013 exists.

---

## Parallel Example: User Story 1 tests

```bash
# Once T003 (fixture extension) lands, launch together:
Task: "Add pathwayBias schema cases to extract/tests/test_config_forager.py"
Task: "Add pathwayBias selection/admission cases to extract/tests/test_selection_forager.py"
Task: "Add pathwayBias determinism case to extract/tests/test_forager_determinism.py"
```

---

## Implementation Strategy

### MVP First (and only) scope

Since spec.md has a single user story, the MVP *is* the finished feature:

1. Complete Phase 1 (baseline) and Phase 2 (contract merge, fixture).
2. Complete Phase 3 — tests red, then T007–T011 turn them green.
3. **STOP and VALIDATE**: `cd extract && .venv/bin/python -m unittest discover -s tests -t .` passes in full.
4. Complete Phase 4 — the real-dataset gates and the topology comparison the plan invocation asked for.

### Incremental checkpoints

1. Setup + Foundational → fixture and contract ready.
2. User Story 1 → feature complete, fixture-level tests green, no real dataset touched yet.
3. Polish → real-dataset Gate A/B/C and the topology diff recorded; app smoke-checked.

---

## Notes

- [P] tasks touch different files and have no unmet dependency.
- No `[US2]`/`[US3]` labels exist — spec.md scopes this feature to one story.
- Commit after each task or logical group, per the user's own git workflow (not automated by this feature).
- Gate tasks (T013–T017, T019) need `MALECNS_DIR` pointing at a real `male-cns-v1.0` checkout; T001–T011 and T018's
  fixture-level steps do not.
- A Gate regression (T016, T017) is recorded as a finding, never silently tuned away — `AGENTS.md`'s own rule for
  this project.
