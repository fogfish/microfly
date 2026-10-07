---

description: "Task list for Output-pool synaptic scale (`outputScale`)"
---

# Tasks: Output-pool synaptic scale (`outputScale`)

**Input**: Design documents from `/specs/010-output-pool-synaptic-scale/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/lif-v1-outputscale.md](./contracts/lif-v1-outputscale.md), [quickstart.md](./quickstart.md)

**Tests**: Included. ADR 004's own "Tests (write first)" section mandates them, and the spec's acceptance
scenarios are only verifiable through them.

**Organization**: The spec defines exactly one user story (US1 — P1). All implementation tasks below carry the
`[US1]` label; there is no US2/US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 for every story-phase task
- Paths are repo-relative from `/Users/kolesnik/devel/go/src/github.com/fogfish/microfly`

## Path Conventions

Single project (per `AGENTS.md`'s layout and `plan.md`'s Structure Decision): `public/js/brain/`,
`public/js/world/`, `tests/`, `specs/008-hungry-forager-brain/contracts/`. No new top-level directory.

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before touching any file.

- [X] T001 Run `npm test` from the repo root and confirm the full suite passes, including `tests/lif-golden.test.mjs`. Record this as the pre-change baseline — Phase 3's final regression task (T014) must reproduce the same pass, unmodified, after the feature lands.
  - Baseline: 441 tests, 435 pass, 6 fail — all 6 failures are in `tests/activity.test.mjs` (pre-existing, unrelated to this feature; not touched by this branch's diff). `tests/lif-golden.test.mjs` passes standalone (1/1). This is the recorded pre-change baseline; T014/T017 must reproduce the same 6 pre-existing failures, no new ones.

**Checkpoint**: Baseline green. Proceed to Phase 2.

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by the user story.

*None.* This feature has a single user story and touches exactly two existing modules
(`public/js/brain/lif-v1.js`, `public/js/brain/fly-brain-v1.js`) plus their existing contract and tests — there is
no shared infrastructure to stand up first. Proceed directly to Phase 3.

**Checkpoint**: N/A — advance to Phase 3.

---

## Phase 3: User Story 1 - Output pools can be scaled independently of the interneuron bulk (Priority: P1) 🎯 MVP

**Goal**: Add `outputScale` to `lif-v1.js` (default `null`, a no-op) so synapses targeting declared output
neurons can be scaled independently of `synapticScale`, per [contracts/lif-v1-outputscale.md](./contracts/lif-v1-outputscale.md).

**Independent Test**: Configure a brain with a distinct output-pool scale and a distinct general synaptic scale,
run the LIF simulation, and confirm the output pool's firing rate changes with its own scale while the rest of
the network's firing rate tracks the general scale (spec Acceptance Scenario 2; contract G7).

### Tests for User Story 1 (write first — must fail before implementation) ⚠️

- [X] T002 [US1] Write test group `L6(a)` "default no-op" in `tests/lif-v1.test.mjs`: build a network with `outputNeurons` present but `outputScale: null`, and an identical network with no `outputNeurons` at all; assert the two produce identical (`===`) spike trains over the existing golden/toy drive already used in this file (contract G6).
- [X] T003 [US1] Write test group `L6(b)` "isolation" in `tests/lif-v1.test.mjs` (after T002, same file): build a small synthetic graph — one driven presynaptic neuron feeding two equal-weight targets, one declared an output neuron via `outputNeurons` — run it at `{synapticScale: 10, outputScale: 2}` and assert the output target's spike count is measurably lower than the non-output target's; run the same graph at `{outputScale: null}` and assert the two targets' spike counts are equal (contract G7).
- [X] T004 [US1] Write test group `L6(c)` "validation" in `tests/lif-v1.test.mjs` (after T003, same file): assert `resolveParams({ outputScale: -1 })` and `resolveParams({ outputScale: 'x' })` both throw the exact message `'LIF parameter "outputScale" must be null or a number of 0 or more'` (contract G8; data-model.md's validation rule: "`null`, or a finite number ≥ 0; otherwise rejected before any simulation step runs").
- [X] T005 [P] [US1] Write an integration test in `tests/fly-brain-v1.test.mjs` (skipped when `public/brains/forager-brain.brain` is absent, following this file's existing `SKIP` pattern): `createFlyBrain({ lif: { synapticScale: 50, outputScale: 5 } })` must produce a lower mean spike rate on the `forward`/`feed` output channels than the same run with `outputScale: null`, same fixed seed, same fixed nonzero input (per ADR 004's "Tests" section and plan.md's Testing context).
- [X] T006 [P] [US1] Extend `tests/validate-flies.test.mjs`: assert a world config with `flies.brain.lif.outputScale` set to a finite number ≥ 0 (version `v1`) validates with no errors, and a world config with `flies.brain.lif.outputScale: null` (the literal JSON value) is rejected at path `flies.brain.lif.outputScale` with the message `'must be a number'` (per `contracts/lif-v1-outputscale.md`'s "Touches elsewhere" section — a world file must omit the key, never write `null`).
- [X] T007 [US1] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs tests/validate-flies.test.mjs` and confirm T002–T006 fail (the parameter doesn't exist yet) — the red half of red/green.

### Implementation for User Story 1

- [X] T008 [US1] In `public/js/brain/lif-v1.js`, add `outputScale: null` to `LIF_V1_DEFAULTS` with a one-line comment naming it `L6` and describing it as "potential per unit of edge weight for output-pool edges; null is a no-op", matching the existing comment style for `tauSyn`/`tauAdapt`/`thresholdJitter`.
- [X] T009 [US1] In `public/js/brain/lif-v1.js`'s `resolveParams` (after T008, same file), add the validation: `outputScale` must be `null` or `Number.isFinite(p.outputScale) && p.outputScale >= 0`, else throw `'LIF parameter "outputScale" must be null or a number of 0 or more'` — place it alongside the existing `tauSyn`/`tauAdapt`/`adaptStep` range checks.
- [X] T010 [US1] In `public/js/brain/lif-v1.js`'s `createNetwork` (after T009, same file), build `outputMask = new Uint8Array(n)` from `graph.outputNeurons` (an array of neuron indices; absent or empty leaves every entry `0`, per data-model.md's "Absence" rule — duplicate indices across channels must still set the entry to `1` exactly, not increment a count), and return `outputMask` as part of the returned network object, alongside the existing `threshold` array.
- [X] T011 [US1] In `public/js/brain/lif-v1.js`'s `step` (after T010, same file), change the spike-delivery line (`nextInput[targets[k]] += weights[k] * p.synapticScale;`) to compute `const target = targets[k]; const scale = (p.outputScale !== null && outputMask[target]) ? p.outputScale : p.synapticScale; nextInput[target] += weights[k] * scale;` — one branch per edge, no new allocation, per `contracts/lif-v1-outputscale.md`'s `step` amendment.
- [X] T012 [P] [US1] In `public/js/brain/fly-brain-v1.js`'s `createFlyBrain`, pass `outputNeurons: capabilities.channels.outputs.flatMap((ch) => ch.neurons)` as part of the `graph` argument given to `createNetwork` (currently `{ neuronCount, offsets, targets, weights }` — add the new field to that object literal).
- [X] T013 [US1] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs tests/validate-flies.test.mjs` and confirm T002–T006 now pass — the green half of red/green.
- [X] T014 [US1] Run `node --test tests/lif-golden.test.mjs` and confirm it still passes unmodified (contract G6 composing with the pre-existing G1 regression guarantee).

### Documentation for User Story 1

- [X] T015 [US1] Update `specs/008-hungry-forager-brain/contracts/lif-v1.md`: add the `outputScale` row to the `LIF_V1_DEFAULTS` parameter table, add its rejection case to `resolveParams`'s documented list, document `outputMask`'s construction under "Create", document the `step` amendment under "Step", and add guarantees **G6 output no-op**, **G7 output isolation**, **G8 validation** to "Guarantees and tests" — content exactly as specified in `contracts/lif-v1-outputscale.md`.
- [X] T016 [P] [US1] Update `specs/008-hungry-forager-brain/contracts/world-config-forager.md`'s placeholder-list sentence ("The `synapticScale`, `tauSyn`, `tauAdapt`, `adaptStep`, `thresholdJitter` and modulator gains above are placeholders until calibration.") to add `outputScale` to that list.

**Checkpoint**: User Story 1 is fully functional and independently testable — `outputScale` exists, defaults to a
verified no-op, is validated, scales output-targeted synapses independently of `synapticScale`, and the contract
documents it. No world file is changed by this story (recalibrating the shipped forager brain is explicitly out
of scope, per spec.md's Assumptions).

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final whole-suite and whole-app verification per `AGENTS.md`'s "before a feature is done" gate.

- [X] T017 Run `npm test` (full suite) and confirm every test passes, including all of Phase 3's new and existing tests.
  - Result: 447 tests, 441 pass, 6 fail — same 6 pre-existing `tests/activity.test.mjs` failures as the T001 baseline (unrelated to this feature), zero new failures. All 6 new L6/integration/validation tests pass.
- [X] T018 Follow [quickstart.md](./quickstart.md) step 4: start `cd public && python3 -m http.server 8000`, open `http://localhost:8000/?world=world/world-forager.json`, and confirm at least one fly runs with no console errors and visually unchanged behavior (no world file was modified by this feature).
  - Partially verified: the static server serves `index.html`, `world-forager.json`, `forager-brain.brain` and the modified `lif-v1.js`/`fly-brain-v1.js` with 200s, and both files pass `node --check` (syntax valid). No browser-automation tool was available in this session to visually load the page and inspect the console, so the "no console errors" / "visually unchanged" half of this check is **not independently verified** — a human (or a session with browser tooling) should do a quick manual load before merging.

---

**Bugfix**: 2026-10-07 — BUG-002 Updated from bugfix patch. One shared `outputScale` for every output channel
could not satisfy both `forward` (needed the cut) and `feed` (could not tolerate it) at once — confirmed on the
live world (seed 1990, `feed` maxing at 0.452, never crossing its 0.5 threshold). `outputScale` must also accept
a per-channel form (spec FR-010–FR-012). No task in this file was a false completion — T010 and T011's
single-scale code is correct and ships unchanged; T025–T027 build on it for the plain-number path and add the
per-channel resolution alongside it. Tasks T019–T034 are new.

## Phase 5: Per-channel output scale (Priority: P1, extends US1) 🎯 BUG-002

**Goal**: Extend `outputScale` to also accept an object keyed by output-channel id (e.g. `{"feed": 30, "forward":
5}`), so `forward`/`turn`/`backward` can keep the value that fixed navigation while `feed` gets an independent
value, per [contracts/lif-v1-outputscale.md](./contracts/lif-v1-outputscale.md) (to be amended by T032/T033).

**Independent Test**: Configure a brain with two output channels given different explicit per-channel scales and
a third left out of the map; run the LIF simulation; confirm each configured channel's firing rate tracks its own
value while the unconfigured channel tracks the general `synapticScale` (spec Acceptance Scenario 5).

### Tests for Phase 5 (write first — must fail before implementation) ⚠️

- [X] T019 [US1] Write test group `L6(d)` "per-channel isolation" in `tests/lif-v1.test.mjs` (after the existing L6 group, same file): a synthetic graph — one driven presynaptic neuron feeding three equal-weight targets, each declared in a different output channel (`"a"`, `"b"`, and `"c"`, with `"c"` given no entry); run at `{synapticScale: 10, outputScale: {a: 2, b: 8}}` and assert channel `a`'s target spike count < channel `b`'s < channel `c`'s, and that `c`'s count equals a plain non-output target's count under the same config (proving the fallback is exactly `synapticScale`, not some other default) (spec FR-010, Acceptance Scenario 5).
- [X] T020 [US1] Write test group `L6(e)` "shared-neuron tie-break" in `tests/lif-v1.test.mjs` (after T019, same file): one neuron belonging to two declared output channels — case 1, channel `"x"` (declared first, no entry) and channel `"y"` (declared second, entry `2`): assert the neuron's effective scale is `2` (falls through `x` to `y`). Case 2, channel `"p"` (declared first, entry `3`) and channel `"q"` (declared second, entry `7`): assert the neuron's effective scale is `3` (first channel in declared order *with an explicit entry* wins, not simply first-declared or last-declared) (spec FR-012, edge case).
- [X] T021 [US1] Write test group `L6(f)` "per-channel validation" in `tests/lif-v1.test.mjs` (after T020, same file): `resolveParams({ outputScale: { forward: -1 } })` and `resolveParams({ outputScale: { forward: 'x' } })` both throw the exact message `'LIF parameter "outputScale.forward" must be a number of 0 or more'`; `resolveParams({ outputScale: -1 })` and `resolveParams({ outputScale: 'x' })` (the pre-existing T004 cases) still throw the *original* message `'LIF parameter "outputScale" must be null or a number of 0 or more'` unchanged — the per-channel object form must not alter the existing scalar error message (no regression on T004/contract G8) (spec FR-011).
- [X] T022 [P] [US1] Write an integration test in `tests/fly-brain-v1.test.mjs` (skipped when `public/brains/forager-brain.brain` is absent): `createFlyBrain({ lif: { synapticScale: 50, outputScale: { feed: 30, forward: 5 } } })` produces a *higher* mean spike rate on the `feed` channel than the same run with the shared `outputScale: 5`, while `forward`'s mean spike rate stays comparably low in both runs — proving `feed` and `forward` are now tunable independently (spec FR-010, SC-006).
- [X] T023 [P] [US1] Extend `tests/validate-flies.test.mjs`: assert a world config with `flies.brain.lif.outputScale` set to `{feed: 30, forward: 5}` (version `v1`) validates with no errors; assert `flies.brain.lif.outputScale: {feed: "x"}` is rejected at path `flies.brain.lif.outputScale.feed` with the message `'must be a number'`; assert `flies.brain.lif.outputScale: "nope"` (neither a number nor a plain object) is rejected at path `flies.brain.lif.outputScale` with a message distinguishing it from a valid per-channel object (spec FR-011).
- [X] T024 [US1] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs tests/validate-flies.test.mjs` and confirm T019–T023 fail (the per-channel form doesn't exist yet) and all of T002–T006's pre-existing assertions still pass unmodified — the red half of this bugfix round's red/green.

### Implementation for Phase 5

- [X] T025 [US1] In `public/js/brain/lif-v1.js`'s `resolveParams`, extend the `outputScale` check: when `typeof p.outputScale === 'object'` and it is not `null` and not an array, validate each entry (`Number.isFinite(value) && value >= 0`), else throw `` `LIF parameter "outputScale.${channel}" must be a number of 0 or more` `` naming that entry's key; any other invalid shape (including the pre-existing negative-number and non-numeric-string cases) MUST still throw the *original*, unchanged message `'LIF parameter "outputScale" must be null or a number of 0 or more'` — this is the regression guard for T004/G8 (depends on T009; same file, after it).
- [X] T026 [US1] In `public/js/brain/lif-v1.js`'s `createNetwork` (after T010/T025, same file), accept `graph.outputChannels` (an array of `{ id, neurons }` in declared order; absent/empty ⇒ "no channels"). Build `outputOverride = new Uint8Array(n)` and `outputScaleOf = new Float64Array(n)`, resolved once: if `params.outputScale` is a plain number, set `outputOverride[i] = 1` and `outputScaleOf[i] = params.outputScale` for every `i` where `outputMask[i]` (T010) is set — identical in effect to the original T011 branch. If `params.outputScale` is an object, walk `graph.outputChannels` in order; for each channel with an entry in `params.outputScale`, for each of its neurons not already resolved (`outputOverride[neuron] === 0`), set `outputScaleOf[neuron] = params.outputScale[channel.id]` and `outputOverride[neuron] = 1` (first-declared-channel-with-an-entry wins, FR-012); after the walk, any key of `params.outputScale` not matching an `id` in `graph.outputChannels` throws `` `LIF parameter "outputScale.${id}" names an unknown output channel` `` (FR-011 — this is a `createNetwork`-time check, not `resolveParams`, because only `createNetwork` has the real channel ids; `validate.js` does not, since it never reads a snapshot's `.brain` file, per plan.md's Project Structure). Return `outputOverride`/`outputScaleOf` as part of the network object.
- [X] T027 [US1] In `public/js/brain/lif-v1.js`'s `step` (after T026, same file), replace T011's branch with `const target = targets[k]; const scale = outputOverride[target] ? outputScaleOf[target] : p.synapticScale; nextInput[target] += weights[k] * scale;` — still one branch per edge, no new allocation. For every already-shipped plain-number/`null` `outputScale` config this MUST produce byte-identical results to T011's original branch (verified by T024's regression requirement on T002–T006).
- [X] T028 [P] [US1] In `public/js/brain/fly-brain-v1.js`'s `createFlyBrain`, also pass `outputChannels: capabilities.channels.outputs.map((ch) => ({ id: ch.id, neurons: ch.neurons }))` as part of the `graph` argument given to `createNetwork`, alongside the existing `outputNeurons` field (T012, unchanged).
- [X] T029 [US1] In `public/js/world/validate.js`, special-case `flies.brain.lif.outputScale` ahead of the generic per-key `isNum` loop: if its value is a plain object (not an array, not `null`), validate each entry with `isNum` and `err` at `` `flies.brain.lif.outputScale.${key}` `` with `'must be a number'` for a bad one; otherwise (including a literal `null`) fall through to the existing generic number check unchanged. `validate.js` does NOT check whether an object key names a real output channel — that cross-check happens in `createNetwork` (T026), since `validate.js` never reads a snapshot's `.brain` file for a snapshot brain (FR-011, split per plan.md).
- [X] T030 [US1] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs tests/validate-flies.test.mjs` and confirm T019–T023 now pass *and* every pre-existing assertion (T002–T006, and the rest of the two test files) still passes unmodified — the green half, with an explicit no-regression check.
- [X] T031 [US1] Run `node --test tests/lif-golden.test.mjs` and confirm it still passes unmodified (G1, composing through G6 unchanged).

### Documentation for Phase 5

- [X] T032 [US1] Update `specs/008-hungry-forager-brain/contracts/lif-v1.md` again: amend the `outputScale` row to describe the per-channel object form, document `outputChannels`/`outputOverride`/`outputScaleOf` under "Create" (superseding the plain `outputMask` description where it conflicts, per FR-012's tie-break), amend the `step` description, and add guarantees **G9 per-channel isolation** and **G10 per-channel/unknown-channel validation**.
- [X] T033 [P] [US1] Update this feature's own `contracts/lif-v1-outputscale.md` and `data-model.md` to match T032's amended canonical contract (same per-channel content, since `contracts/lif-v1-outputscale.md` is itself an amendment document to the canonical contract, per its own header).
- [X] T034 Re-run ADR 004's "Recalibration protocol" (steps 2–5) with the per-channel mechanism available: sweep `outputScale.feed` independently of `outputScale.forward`/`turn-*`/`backward` (held at the already-live `5`) on calibration seeds, validate the best candidate on held-out seeds, and record the sweep and its held-out verdict as a new dated entry in `specs/008-hungry-forager-brain/calibration.md` — closing the process gap `BUG-002`'s Root Cause Analysis identified (the live `outputScale: 5` was set in `world-forager.json` without this record). Only on a held-out pass, update `world-forager.json`'s `flies.brain.lif.outputScale` from the scalar `5` to the per-channel object.
  - **Result (recorded in `calibration.md`, 2026-10-07 dated entry)**: swept `outputScale.feed` ∈ {5, 10, 20, 30, 40} on calibration seeds, holding `forward`/`backward`/`turn-left`/`turn-right` at the shipped `5`. Zero eating bouts at every value. Near-food diagnostic shows why: eating needs `speed < eatSpeed` **and** `feed > feedThreshold` together, and `% speed < eatSpeed` is 0.00 % near food at every tested `feed` value — `forward`'s mean near food (0.6861) never moves, because it wasn't swept, and `speed = maxSpeed × forward` stays ~4× above `eatSpeed` regardless of `feed`. No candidate passed the calibration-seed screen, so held-out seeds were correctly **not** used (per the protocol's own step 4 — nothing to validate). `world-forager.json` is **unchanged**: still the scalar `outputScale: 5`. Root cause and the follow-on (a joint `forward`/`feed` sweep, or the separate out-of-scope "brake" pathway) are written up in `calibration.md`.

**Checkpoint**: Phase 5 is fully functional and independently testable — `outputScale` accepts a per-channel
object, validated, resolved deterministically for shared neurons, and documented. T034 investigated the live
world's `feed`-starvation regression and found, with evidence, that it is **not fixable by `outputScale.feed`
alone**: `forward`'s own value (unchanged by this sweep, as designed) keeps `speed` structurally above
`eatSpeed` near food. `world-forager.json` is unchanged; the follow-on (a joint `forward`/`feed` sweep, or the
separate "brake" pathway question) is recorded in `calibration.md`, not resolved here — per `AGENTS.md`'s
"behaviour failures are findings," this is a recorded finding, not a code change to force a pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first.
- **Foundational (Phase 2)**: Empty — no gate between Setup and Phase 3.
- **User Story 1 (Phase 3)**: Depends on Phase 1 (baseline recorded). Internally: tests (T002–T006) before the
  red-check (T007) before implementation (T008–T012) before the green-check (T013) before the golden regression
  (T014) before documentation (T015–T016). T008→T009→T010→T011 are strictly sequential (same file, each builds
  on the previous edit); T012 touches a different file and only needs T011's interface (the `graph.outputNeurons`
  field name) agreed in `contracts/lif-v1-outputscale.md`, so it may be done in parallel with T008–T011.
- **Polish (Phase 4)**: Depends on Phase 3's checkpoint.
- **Phase 5 (BUG-002)**: Depends on Phase 4 (the original feature shipped and verified first). Internally: tests
  (T019–T023) before the red-check (T024) before implementation (T025–T029, building on the already-shipped
  T010/T011) before the green-check (T030) before the golden regression (T031) before documentation (T032–T033)
  before the recalibration sweep (T034).

### Within User Story 1

- Tests: T002 → T003 → T004 (same file, sequential); T005 and T006 are each their own file and independent of
  T002–T004 and of each other → `[P]`.
- T007 depends on T002–T006 all being written.
- Implementation: T008 → T009 → T010 → T011 (same file, sequential); T012 is `[P]` relative to T008–T011 (different
  file).
- T013 depends on T007 (red) and all of T008–T012 (green requires the implementation complete).
- T014 depends on T011 (the only behavior-changing edit) but can run any time after it; placed after T013 here
  for a clean red→green→regression narrative.
- T015 depends on T008–T011 being finalized (so the contract text matches the shipped code). T016 is `[P]`
  relative to T015 (different file).

### Within Phase 5 (BUG-002)

- Tests: T019 → T020 → T021 (same file, sequential, after the existing L6 group); T022 and T023 are each their
  own file and independent of T019–T021 and of each other → `[P]`.
- T024 depends on T019–T023 all being written.
- Implementation: T025 → T026 → T027 (same file, sequential: T025 extends `resolveParams`, T026 extends
  `createNetwork` and reads T010's already-shipped `outputMask`, T027 rewrites the `step` branch alongside T011's
  already-shipped one); T028 is `[P]` relative to T025–T027 (different file, same interface contract as T026's
  `graph.outputChannels`); T029 touches `validate.js`, independent of T025–T028 → `[P]`.
- T030 depends on T024 (red) and all of T025–T029 (green requires the implementation complete, including the
  no-regression check on T002–T006).
- T031 depends on T027 (the only behavior-changing edit this round) but can run any time after it.
- T032 depends on T025–T027 being finalized. T033 is `[P]` relative to T032 (different files). T034 depends on
  T032/T033 (the contract must describe the mechanism the sweep is calibrating against) and is otherwise
  independent experimental work, not a code edit.

### Parallel Opportunities

- T005 and T006 (Phase 3 tests) in parallel with each other and with T002–T004.
- T012 (Phase 3 implementation) in parallel with T008–T011.
- T016 (Phase 3 documentation) in parallel with T015.
- T022 and T023 (Phase 5 tests) in parallel with each other and with T019–T021.
- T028 (Phase 5 implementation) in parallel with T025–T027. T029 in parallel with all of them.
- T033 (Phase 5 documentation) in parallel with T032.

---

## Parallel Example: User Story 1

```bash
# Tests — launch together (different files from the sequential lif-v1.test.mjs trio):
Task: "Integration test for forward/feed mean spike rate in tests/fly-brain-v1.test.mjs"
Task: "World-config validation test for outputScale in tests/validate-flies.test.mjs"

# Implementation — launch together (different files):
Task: "Pass outputNeurons into createNetwork's graph argument in public/js/brain/fly-brain-v1.js"
# ...while T008-T011 proceed sequentially in public/js/brain/lif-v1.js

# Documentation — launch together (different files):
Task: "Update world-config-forager.md's placeholder list in specs/008-hungry-forager-brain/contracts/world-config-forager.md"
# ...while T015 updates lif-v1.md
```

---

## Implementation Strategy

### MVP First (and only)

This feature has one user story, so the MVP is the whole feature:

1. Complete Phase 1 (baseline).
2. Phase 2 is empty — proceed directly.
3. Complete Phase 3 (the mechanism, tests, and contract update).
4. Complete Phase 4 (final verification).
5. ~~**STOP**: do not recalibrate `world-forager.json`'s `flies.brain.lif` values as part of this feature — that
   is ADR 004's separate "Recalibration protocol," a follow-on sweep against calibration and held-out seeds,
   recorded in `specs/008-hungry-forager-brain/calibration.md`, not part of this task list.~~ **Superseded
   (BUG-002, 2026-10-07)**: the live world's ad-hoc `outputScale: 5` (set without that recalibration record)
   starved `feed`. Phase 5's T034 now runs that protocol, with the per-channel mechanism available, and records
   it properly.

### Incremental Delivery

Given a single story, delivery is simply: tests red (T002–T007) → implementation green (T008–T013) → regression
confirmed (T014) → contract documented (T015–T016) → whole-suite and whole-app check (T017–T018). Each of
T002–T016 can be committed as its own small step without breaking the suite once T008–T012 land together (the
tests in T002–T006 will fail, as expected, until the implementation tasks complete — this is the one window
where `npm test` is expected to be red). **(BUG-002 amendment)**: Phase 5 repeats the same pattern one level up —
tests red (T019–T024) → implementation green (T025–T030, building on the already-shipped T010/T011) → regression
confirmed (T031) → contract documented (T032–T033) → recalibration sweep (T034).

---

## Notes

- `[P]` tasks touch different files and have no unfinished dependency between them.
- `[US1]` labels every Phase 3 task, per spec.md's single user story.
- T002–T004 intentionally share `tests/lif-v1.test.mjs` and are sequential, not parallel, despite all being
  "tests" — same-file edits cannot be parallelized safely.
- Commit after each checkpoint (T001 baseline, T007 red, T013 green, T014 regression, T016 documentation, T018
  final check) rather than after every single task, given how many of T008–T011 are small sequential edits to
  one file.
- **(BUG-002 amendment)**: `[US1]` also labels every Phase 5 task — it extends the same single user story, not a
  new one. T019–T021 share `tests/lif-v1.test.mjs` and are sequential for the same reason T002–T004 are.
  T025 → T026 → T027 are likewise sequential same-file edits, building on the already-shipped T010/T011. Commit
  after T024 (red), T030 (green), T031 (regression), T033 (documentation), and separately after T034 (the
  recalibration sweep is its own unit of work, possibly landing well after the mechanism itself).
