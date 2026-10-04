# Tasks: MaleCNS Smallest Brain Extractor

**Input**: Design documents from `/specs/003-malecns-brain-extractor/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The spec does not ask for TDD, but the constitution's Development Workflow requires LIF tests, pipeline tests and contract tests on both sides for any format or protocol change. Test tasks come before the implementation they cover in each phase.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested on its own. Story priorities come from spec.md: US1 (extraction, P1), US2 (simulator integration, P2), US3 (comparison, P3).

**Order constraint**: T014 and T015 record the toy golden trace from the **current** `lif.js`. They must run before any change to `lif.js` (T035).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2 or US3. Setup, Foundational and Polish tasks have no story label.
- Paths are repository-relative.

## Path Conventions

- Python extractor: `extract/` (package `extract/malecns_brain/`, tests `extract/tests/`)
- Browser app: `public/` (ES modules, no build)
- Node tests: `tests/` (`node --test tests/*.test.mjs`)
- Scripts: `scripts/`
- Feature docs: `specs/003-malecns-brain-extractor/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the extractor skeleton and the reference config. Nothing here touches the dataset.

- [X] T001 Create `extract/requirements.txt` with exactly two pinned lines: `pyarrow==25.0.1` and `numpy==2.5.3` (versions tested in research R11)
- [X] T002 [P] Create `extract/malecns_brain/__init__.py` with `__version__ = "0.1.0"` (the value written as `provenance.toolVersion`)
- [X] T003 [P] Create `extract/configs/smallest-functional-brain.json` with exactly the keys of `contracts/extract-config.md` ("Config shape"): `formatVersion` 2, `datasetRelease` "male-cns-v1.0", `edgeVariant` "traced-only", `expect` (211577 / 25563197 / 1835518), `sensory` {class "ALPN", status "Traced"}, `readouts` {superclass "descending_neuron", status "Traced", somaSides ["L","R"]}, `transmitterSign` {acetylcholine 1, gaba -1, glutamate -1}, `minConfidence` 0.5, `synapseCap` 5, `minInterneurons` 2, `maxInterneurons` 8, `expectedNeuronCount` null. Add no other keys.
- [X] T004 [P] Add to `.gitignore` the lines `extract/.venv/`, `__pycache__/` and `*.pyc` (keep the existing `data/` line)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared format contract, its readers and writers on both sides, the synthetic fixtures, and the toy golden trace. Every user story depends on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create `extract/malecns_brain/errors.py` with `class ExtractError(Exception)` holding `code` and `message`, and the stable codes from `contracts/extract-config.md` "Error codes": E-CONFIG, E-DATASET-MISSING, E-DATASET-ROWS, E-DUP-BODY, E-DUP-EDGE, E-SENSORY-NONE, E-READOUT-NONE, E-NO-PATH, E-TOO-FEW, E-NODE-COUNT, E-SIGN, E-EMPTY-EDGES, E-OVERFLOW, E-NONDETERMINISTIC. Printing format: `E-CODE: message`.
- [X] T006 Create `extract/malecns_brain/config.py`: `load_config(path)` returns the config dict or raises `ExtractError("E-CONFIG", ...)`. Enforce the constraints verbatim from `data-model.md` "ExtractionConfig": `minConfidence` "number, 0–1"; `synapseCap` "integer ≥ 1, must be ≤ 65,535"; `minInterneurons`, `maxInterneurons` "`0 ≤ min ≤ max`; defaults 2 and 8"; `expectedNeuronCount` "null or integer ≥ 3"; `formatVersion` "must be 2"; `edgeVariant` "must be `traced-only`". Reject unknown keys. Add `config_hash(config)` returning `sha256:` plus the hex digest of the canonical JSON (sorted keys, no whitespace).
- [X] T007 Create `extract/malecns_brain/container.py`: `write_container(path, header, offsets, targets, weights, synapses)` writes the layout in `contracts/snapshot-format.md` (magic `MFBR`, `formatVersion` 2, header length multiple of 8 padded with spaces, sections in order, each 4-byte aligned, little-endian) to a temporary file in the same directory, then `os.replace`. Also `read_container(data: bytes)` implementing rules 1–7 of `snapshot-format.md` "Rules for readers", raising `ValueError` with the exact message text listed there. Sections are written with `numpy` dtypes `<u4`, `<f4`, `<u2`.
- [X] T008 [P] Create `public/js/brain/snapshot.js` (pure, no DOM): `parseSnapshot(arrayBuffer)` implementing the same rules 1–7 with the same messages, returning `{ manifest, neuronCount, edgeCount, offsets, targets, weights, synapses }` with typed-array views (`Uint32Array`, `Float32Array`, `Uint16Array`) over the buffer. Sections must start on a 4-byte boundary before a typed view is created.
- [X] T009 [P] Create `extract/tests/make_fixture.py`: writes (a) synthetic Feather datasets with the malecns column names (`body-annotations`: `bodyId, class, superclass, somaSide, status, type`; `body-neurotransmitters`: `body, predicted_nt, predicted_nt_confidence`; traced-only edges: `body_pre, body_post, weight`) into a directory argument, and (b) the container `tests/fixtures/synthetic-smallest.brain` through `write_container`. The module docstring must state "synthetic test fixture, not connectome data" (Constitution III).
- [X] T010 Run `extract/tests/make_fixture.py` to produce and commit `tests/fixtures/synthetic-smallest.brain` (depends on T007, T009)
- [X] T011 [P] Create `extract/tests/test_container.py` (unittest): round trip of `write_container`/`read_container`; determinism (two writes of the same content are byte-identical); rejections with the exact messages of `snapshot-format.md` for bad magic, `formatVersion` 3, truncated header, `neurons` out of role order, a section out of bounds, a non-monotone `offsets`, a `targets` value ≥ `neuronCount`, and a `synapses` value of 0; contract read-back of `../tests/fixtures/synthetic-smallest.brain`
- [X] T012 [P] Create `tests/snapshot.test.mjs` (node:test): `parseSnapshot` reads `tests/fixtures/synthetic-smallest.brain` with the same counts that `test_container.py` asserts (contract test, JavaScript side); the same rejection cases as T011, with the same messages
- [X] T013 [P] Create `scripts/record-toy-golden.mjs`: builds the toy brain with `createFlyBrain({ neuronCount: 40, outDegree: 4, inhibitoryFraction: 0.2, motorSmoothing: 0.05, telemetry: [0, 1, 2] }, 2834727945)`, drives it with sensory 0.5 for 200 ticks, 0 for 200 ticks and 1.0 for 200 ticks, and writes `tests/fixtures/toy-golden.json` with `left`, `right` and `selected` for every tick
- [X] T014 Run `node scripts/record-toy-golden.mjs` **now, before any change to `public/js/brain/lif.js`**, and commit `tests/fixtures/toy-golden.json` (depends on T013)
- [X] T015 Create `tests/lif-golden.test.mjs` (node:test): rebuilds the same toy brain and drives it the same way, then asserts `left`, `right` and `selected` equal `tests/fixtures/toy-golden.json` tick by tick, with exact equality (Constitution V: the toy is unchanged). Passes on current code (depends on T014)

**Checkpoint**: Format contract, both readers, fixtures and the toy golden trace are in place. User stories can start.

---

## Phase 3: User Story 1 - Extract a Reproducible Connectome Brain Snapshot (Priority: P1) 🎯 MVP

**Goal**: A developer runs one command with the ADR 002 config and gets a reproducible `.brain` file for the smallest functional brain, with a report. Failures stop with a named error and leave any existing file untouched.

**Independent Test**: Run the tool on the synthetic fixture datasets (T009) and on the v1.0 dataset. The synthetic run succeeds with the expected counts and reports `self-check identical`. The v1.0 run writes the reference brain and reports its counts. A broken input writes nothing.

### Tests for User Story 1

> **Write these first. They must fail until the implementation below exists.**

- [X] T016 [P] [US1] Create `extract/tests/test_config.py`: each E-CONFIG case in `contracts/extract-config.md` ("Validation of the config"): unknown key, `minConfidence` 1.5, `maxInterneurons` less than `minInterneurons`, `somaSides` not exactly `["L","R"]`, `transmitterSign` value 2, `expectedNeuronCount` 2, malformed JSON; and that the reference config loads without error
- [X] T017 [P] [US1] Create `extract/tests/test_selection.py` on small in-memory tables: admission (Traced only; `predicted_nt` mapped case-insensitively; confidence exactly 0.5 admitted, 0.49 rejected; unmapped transmitter rejected); sensory tie-break on smallest `bodyId`; readout two-hop sum; **reserved slot**: a LEFT reacher ranked below `maxInterneurons` is still selected; E-NO-PATH when no candidate reaches LEFT; E-TOO-FEW; E-SENSORY-NONE; E-READOUT-NONE; E-SIGN; E-EMPTY-EDGES; E-NODE-COUNT when `expectedNeuronCount` differs; E-DUP-BODY; E-DUP-EDGE; E-OVERFLOW (synapses 65,536); weight rule `sign × min(s, cap) ÷ cap`
- [X] T018 [P] [US1] Create `extract/tests/test_cli.py`: exit 0 on the synthetic fixture with `self-check identical` in stdout; exit 1 with E-DATASET-MISSING for a missing file and E-DATASET-ROWS for a changed `expect` value, and in both cases no output file is written and an existing `--out` file keeps its bytes; exit 2 for a missing `--dataset` and no `MALECNS_DIR`

### Implementation for User Story 1

- [X] T019 [US1] Create `extract/malecns_brain/dataset.py`: check the three files exist (E-DATASET-MISSING, names the file); count rows from the Feather metadata without loading columns and compare with `expect` (E-DATASET-ROWS, shows expected and actual); read annotations with columns `bodyId, class, superclass, somaSide, status` and neurotransmitters with `body, predicted_nt, predicted_nt_confidence`; reject duplicate `bodyId` or `body` (E-DUP-BODY); stream the traced-only edges in batches, keeping rows where both `body_pre` and `body_post` are admitted (numpy `isin`), and return typed arrays
- [X] T020 [US1] Create `extract/malecns_brain/selection.py`, part 1 (ADR D1, D4): build the admitted set from the Traced annotations joined with transmitter predictions; sign from the `transmitterSign` map; admission needs `predicted_nt_confidence ≥ minConfidence`. Return per-body `transmitter`, `transmitterConfidence`, `sign`
- [X] T021 [US1] Extend `extract/malecns_brain/selection.py`, part 2 (ADR D6 steps 5–6): sensory = admitted `class` ALPN with the largest total outgoing synapses to admitted bodies, ties on smallest `bodyId`; LEFT and RIGHT = admitted Traced `superclass` `descending_neuron` on `somaSide` L and R, maximising the two-hop synapse sum from the sensory partners, ties on smallest `bodyId`. Raise E-SENSORY-NONE and E-READOUT-NONE
- [X] T022 [US1] Extend `extract/malecns_brain/selection.py`, part 3 (ADR D3 with research R3): candidates pass the four D3 tests; score is `min(synapses from sensory, synapses to readouts)`; keep the best LEFT-reacher and the best RIGHT-reacher (reserved), fill the rest by score up to `maxInterneurons`, ties on ascending `bodyId`; raise E-NO-PATH if a side has no candidate and E-TOO-FEW if fewer than `minInterneurons` are kept. Output neurons in `[sensory, left, right, interneurons sorted by bodyId]`
- [X] T023 [US1] Extend `extract/malecns_brain/selection.py`, part 4 (ADR D5, D6 step 8): build the induced subgraph (every restricted edge between selected neurons with `synapses ≥ 1`); weights `sign(pre) × min(synapses, synapseCap) ÷ synapseCap` in float64, stored as float32; check E-SIGN, E-EMPTY-EDGES, E-OVERFLOW (raw count > 65,535) and E-NODE-COUNT; sort edges by `pre`, then `post`; build the CSR `offsets`. Also report the two-hop input totals of both readouts and the count of interneurons reaching each readout
- [X] T024 [US1] Create `extract/malecns_brain/__main__.py`: argument parsing (`extract --config --dataset --out`, `--dataset` falls back to `MALECNS_DIR`); run dataset → selection → container; **self-check**: run selection a second time on the in-memory table and compare the body bytes and the header except `provenance.createdAt`, raising E-NONDETERMINISTIC on a difference; write through `write_container`; print the report in the format of `contracts/extract-config.md` ("Report on success"); map `ExtractError` to exit 1 and usage errors to exit 2. Also check E-DUP-EDGE on the restricted table (unique `(pre, post)`) before selection
- [X] T025 [US1] Make the tests from T016–T018 pass. Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and fix any failure in `extract/malecns_brain/` (depends on T019–T024)

### Real extraction for User Story 1

- [X] T026 [US1] Run the real extraction from `quickstart.md` section 1: `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract --config configs/smallest-functional-brain.json --out ../public/brains/smallest-functional-brain.brain`. Save the console report to `specs/003-malecns-brain-extractor/extraction-report.md`. Confirm that the reserved LEFT slot is body 10702 (the research R3 evidence) and that the LEFT two-hop input is far below RIGHT (research R4). If the run fails, record the E-code in the report and stop; do not change the rules to pass
- [X] T027 [US1] Set `expectedNeuronCount` in `extract/configs/smallest-functional-brain.json` to the neuron count from `extraction-report.md`, re-run T026, and confirm `self-check identical` and that the output bytes are unchanged apart from `createdAt` (depends on T026)
- [X] T028 [US1] Check the failure contract on real data: run with `MALECNS_DIR=/nonexistent`, confirm exit 1 with E-DATASET-MISSING, and confirm `public/brains/smallest-functional-brain.brain` keeps its checksum (record `shasum -a 256` before and after in `extraction-report.md`) (depends on T027)

**Checkpoint**: User Story 1 is complete. `public/brains/smallest-functional-brain.brain` exists, is produced from the real release, and is reproducible. The MVP scope ends here.

---

## Phase 4: User Story 2 - Run a Fly on the Connectome Snapshot by Changing Configuration (Priority: P2)

**Goal**: A fly's brain is switched to the snapshot by a world config change. The toy stays the default and its behaviour is unchanged. Invalid snapshots and conflicting settings show a clear error and no fly starts.

**Independent Test**: Start the app with the default `world.json` (six toy flies, unchanged), then with `?world=world/world-connectome.json` (six snapshot flies). Switch a snapshot to a missing file or a wrong format version, and confirm the error panel names the problem and no fly starts.

### Tests for User Story 2

> **Write these first. They must fail until the implementation below exists.**

- [X] T029 [P] [US2] Create `tests/validate-snapshot.test.mjs`: `validateConfig` accepts a world with `flies.brain.snapshot` set and no toy-only fields; rejects `snapshot` together with `neuronCount`, `outDegree` or `inhibitoryFraction` (the error names both settings, per `contracts/integration.md` §1); rejects a non-string or empty `snapshot`; still accepts the unchanged default toy config
- [X] T030 [P] [US2] Create `tests/fly-brain-snapshot.test.mjs`: `createFlyBrain` with the parsed `tests/fixtures/synthetic-smallest.brain` as `brainConfig.snapshot` reports `neuronCount` equal to the fixture's; two runs with the same sensory sequence give identical outputs; the sensory neuron's edge weights are the container's weights (no `addMotorDrive` overwrite); telemetry defaults to `[0, 1, 2]`
- [X] T031 [P] [US2] Extend `tests/protocol.test.mjs`: `init` with `brain.snapshot` as a string validates; `init` with `brain.snapshot` as a parsed object validates; a wrong `v` is still rejected. Extend `tests/worker-core` coverage in `tests/protocol.test.mjs`: `init` with a resolved snapshot replies `ready` with the snapshot's `neuronCount`
- [X] T032 [P] [US2] Create `tests/fly-config-snapshot.test.mjs`: `resolveFlies` on a snapshot config does not add the toy default `neuronCount: 40` to `brain` (so the snapshot's count is the only one used)

### Implementation for User Story 2

- [X] T033 [US2] Update `public/js/brain/protocol.js`: `init` validation accepts an optional `brain.snapshot` (string or parsed snapshot object). Protocol version stays 1
- [X] T034 [US2] Update `public/js/world/validate.js` `validateFlyBrain`: when `snapshot` is present, enforce the conflict and type rules from T029 and skip the toy-only defaults checks for `neuronCount`, `outDegree` and `inhibitoryFraction`. Keep `motorSmoothing`, `telemetry` (format only) and `lif` checks. Constitution III: the toy path stays identical when `snapshot` is absent
- [X] T035 [US2] Update `public/js/brain/lif.js`: internal form becomes CSR. `createNetwork` accepts `{ neuronCount, edges }` (convert in input order, grouped by `pre`) or `{ neuronCount, offsets, targets, weights }`. `step` iterates the CSR arrays with the same arithmetic order (`weight × synapticScale`, accumulated in the same sequence). **Run `node --test tests/lif-golden.test.mjs` after this change; it must still pass unchanged** (depends on T014 and T015)
- [X] T036 [US2] Update `public/js/brain/fly-brain.js` `createFlyBrain`: when `brainConfig.snapshot` is a parsed snapshot, build the graph from its CSR arrays, use its `neuronCount`, skip `addMotorDrive`, and ignore `seed` (documented in `contracts/integration.md` §2). The toy branch stays as it is. Make the tests from T030 pass (depends on T035)
- [X] T037 [US2] Update `public/js/brain/worker-core.js`: `init` with a resolved snapshot calls `createFlyBrain` with it and replies `ready` with its `neuronCount`; a failure replies `error` with `flyId`. Make the T031 worker-side test pass (depends on T036)
- [X] T038 [US2] Update `public/js/brain/fly.worker.js` (shell only): on `init` where `brain.snapshot` is a URL string, `fetch` it, `parseSnapshot` the bytes, pass the resolved snapshot to `worker-core`; on any fetch or parse error post `error` with `flyId` and the message. The host sends no `sense` before `ready` (depends on T008, T037)
- [X] T039 [US2] Update `public/js/fly/fly-config.js` `resolveFlies`: for a snapshot brain, do not merge `BRAIN_DEFAULTS` (T032 must pass). Keep `snapshot` on the resolved brain (depends on T032)
- [X] T040 [US2] Update `public/js/fly/fly-host.js` `startFlies`: in snapshot mode, before starting workers, fetch the snapshot once (URL resolved from the same `root` as `loadWorldConfig`), `parseSnapshot` it, and check each `telemetry` index is below its `neuronCount`. On a failure, return an error for the panel and start no fly. Pass the absolute URL in each worker's `init` (depends on T008, T039)
- [X] T041 [US2] Update `public/js/main.js` and `public/js/ui/error-panel.js`: show the snapshot error (names the file and the problem) when the host reports one; label snapshot flies as "connectome snapshot" with the release and `createdAt` from the header (spec FR-023). Toy flies keep their current label (depends on T040)
- [X] T042 [US2] Create `public/world/world-connectome.json`: a copy of `public/world/world.json` with `flies.brain.snapshot` set to `"brains/smallest-functional-brain.brain"` and no `neuronCount` or `outDegree`. Do not change `public/world/world.json` (depends on T026, T034)
- [X] T043 [P] [US2] Update `specs/002-toy-lif-fly-network/contracts/fly-config.md`: add `brain.snapshot` and the conflict rules from `specs/003-malecns-brain-extractor/contracts/integration.md` §1 (constitution: docs in the same change)
- [X] T044 [P] [US2] Update `specs/002-toy-lif-fly-network/contracts/worker-protocol.md`: add the optional `brain.snapshot` field of `init` from `specs/003-malecns-brain-extractor/contracts/integration.md` §2, and state that the seed is unused by a snapshot brain
- [X] T045 [US2] Run the full Node suite: `node --test tests/*.test.mjs`. All tests pass, including `lif-golden` (depends on T029–T041)
- [ ] T046 [US2] Browser run check from `quickstart.md` section 4: `python3 -m http.server 8000 -d public`. Default world: six toy flies, the readout works, no console errors. `?world=world/world-connectome.json`: six snapshot flies labelled as snapshot, readout shows sensory, LEFT and RIGHT changing, no console errors. Negative check: point `flies.brain.snapshot` at a missing file in a temporary copy, and confirm the error panel names the file and no fly starts. Record the results in `specs/003-malecns-brain-extractor/quickstart.md` section 6 (depends on T042, T045)

**Checkpoint**: User Story 2 is complete. The toy is unchanged (golden trace), the snapshot brain runs in the browser, and switching is by config only.

---

## Phase 5: User Story 3 - Compare the Connectome Brain Against the Toy and the Baseline (Priority: P3)

**Goal**: One command runs the four arms of research R9 over the same seeds and reports totals and differences, including the size-matched random control and the baseline.

**Independent Test**: Run `npm run experiment`. Each of the four arms reports fruit contacts per fly and per seed, the totals, and the differences. A result below the baseline is printed as-is.

### Tests for User Story 3

> **Write these first. They must fail until the implementation below exists.**

- [X] T047 [P] [US3] Create `tests/matched-random.test.mjs`: `matchedRandomBrain(header)` returns `neuronCount` equal to the snapshot's `neuronCount` and `outDegree` equal to `round(edgeCount ÷ neuronCount)` clamped to `[1, neuronCount − 1]`; for a 3-neuron, 2-edge header it gives outDegree 1; the result passes `validateConfig` as a toy brain (`data-model.md` WorldBrainConfig, toy column)

### Implementation for User Story 3

- [X] T048 [US3] Add `matchedRandomBrain(header)` to `public/js/brain/snapshot.js` (pure). Make the T047 test pass (depends on T008, T047)
- [X] T049 [US3] Update `scripts/compare-baseline.mjs`: read `flies.brain.snapshot` when set (with `fs`, then `parseSnapshot`); run the four arms of `specs/003-malecns-brain-extractor/research.md` R9 (`toy`, `nature`, `random-matched`, `baseline`) over `experiment.seeds` in the same world; print per-arm and per-seed fruit contacts, totals, and differences `nature − random-matched`, `nature − toy` and each arm `− baseline`. Also print each readout's firing rate, so a silent snapshot brain is visible (plan Risks). Keep the exit codes from `contracts/integration.md` §4 (depends on T048)
- [X] T050 [US3] Run `npm run experiment`. Save the report to `specs/003-malecns-brain-extractor/comparison.md` with the seed list, the totals and the differences. If the snapshot arm is silent, record it and do not change the default LIF values; a calibration is a config value and must be recorded as one (depends on T049, T046)

**Checkpoint**: User Story 3 is complete. The random-versus-nature comparison runs and its result is recorded, whichever way it goes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Amend the ADR, measure format scale, and run every check in one pass.

- [X] T051 [P] Amend `adrs/002-smallest-functional-brain.md`: add a dated "Amendment 2026-10-04" section that records (a) D3 reserved slots (research R3, with the 5-of-77 LEFT evidence), (b) D7 replaced by container version 2 (`specs/003-malecns-brain-extractor/contracts/snapshot-format.md`), and (c) the two new error codes E-DUP-EDGE and E-OVERFLOW. Do not edit the original decisions in place
- [X] T052 [P] Create `extract/tests/bench_full_admitted.py`: writes the full admitted subgraph (every traced-only edge with both ends admitted, no interneuron cap) with the same `write_container`, to the path argument (default `../data/snapshots/full-admitted.brain`). Prints neuron count, edge count, container size, write time and read time. Not run by unittest
- [X] T053 Run the benchmark once: `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python tests/bench_full_admitted.py`. Expect 143,219 neurons and 22,082,410 edges. Record the printed numbers in `specs/003-malecns-brain-extractor/quickstart.md` section 3 (depends on T052)
- [X] T054 Run all test suites and record results in `quickstart.md`: `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and `node --test tests/*.test.mjs`. Every test passes (depends on T025, T045)
- [X] T055 Verify the repository stays clean of data: `git status --short` must not list anything under `data/` or `extract/.venv/`, and `data/snapshots/` must exist only locally (depends on T004, T053)
- [X] T056 Complete the quickstart "Done checks" list in `specs/003-malecns-brain-extractor/quickstart.md` section 6 with the real results (depends on T026, T046, T050, T053, T054)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. T014 must run before any change to `lif.js` (T035)
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2 and US3
- **US2 (Phase 4)**: Depends on Foundational for the tests and code. The **browser run check (T046) and the world config (T042) need the reference brain from US1 (T026)**. Node tests for US2 use the synthetic fixture and do not
- **US3 (Phase 5)**: Depends on US2 (the comparison runs the browser modules and needs the snapshot loader) and on US1 (T026, the reference brain)
- **Polish (Phase 6)**: Depends on all stories being complete

### Story Dependencies

- **US1 (P1)**: Independent. This is the MVP.
- **US2 (P2)**: Independent of US1 for its code and tests. Cross-story dependency: T042 and T046 use the reference brain from T026.
- **US3 (P3)**: Depends on US2 (snapshot loader) and US1 (reference brain).

### Within Each User Story

- Tests are written first and fail until the implementation exists
- Selection parts (T020 → T021 → T022 → T023) are sequential, because they edit one file in order
- Real-data runs (T026–T028) only after the unit tests pass

### Parallel Opportunities

- Setup: T002, T003 and T004 can run in parallel
- Foundational: T005, T008, T009, T011, T012 and T013 can run in parallel (different files)
- US1 tests: T016, T017 and T018 can run in parallel
- US2 tests: T029, T030, T031 and T032 can run in parallel
- US2 docs: T043 and T044 can run in parallel with the code tasks
- Polish: T051 and T052 can run in parallel

---

## Parallel Example: Foundational

```bash
# Different files, no dependencies on each other:
Task: "Create extract/malecns_brain/errors.py (T005)"
Task: "Create public/js/brain/snapshot.js (T008)"
Task: "Create extract/tests/make_fixture.py (T009)"
Task: "Create tests/snapshot.test.mjs (T012)"
Task: "Create scripts/record-toy-golden.mjs (T013)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T015), including the golden trace
3. Phase 3: User Story 1 (T016–T028)
4. **STOP and VALIDATE**: `public/brains/smallest-functional-brain.brain` exists, is reproducible, and the failure contract holds on real data

### Incremental Delivery

1. Setup + Foundational → format contract and toy golden trace in place
2. Add US1 → reference brain from the real release (MVP)
3. Add US2 → snapshot flies in the browser, toy unchanged
4. Add US3 → comparison report recorded
5. Polish → ADR amendment, format benchmark, full checks

---

## Notes

- [P] tasks touch different files and have no dependency on incomplete tasks
- The golden trace (T014) is recorded from the current code and must not be re-recorded after `lif.js` changes; if it fails after T035, fix the refactor, not the fixture
- Do not tune the reserved-slot rule or LIF defaults to improve the comparison result; any change is a recorded config value (ADR Gate C)
- Commit only when asked. The working tree already has uncommitted changes from earlier steps
- Avoid: vague tasks, the same file edited in parallel, and cross-story dependencies beyond the ones listed above

---

## Completion report summary

- **Total tasks**: 56
- **Setup**: 4 (T001–T004)
- **Foundational**: 11 (T005–T015)
- **US1 (P1, MVP)**: 13 (T016–T028)
- **US2 (P2)**: 18 (T029–T046)
- **US3 (P3)**: 4 (T047–T050)
- **Polish**: 6 (T051–T056)
- **Parallel tasks [P]**: 21
- **MVP scope**: Phases 1–3 (T001–T028)
