---

description: "Task list for Dynamical Regime for the Forager Brain"
---

# Tasks: Dynamical Regime for the Forager Brain

**Input**: Design documents from `/specs/011-dynamical-regime/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/lif-v1-noise.md](./contracts/lif-v1-noise.md), [contracts/weight-rule-absolute.md](./contracts/weight-rule-absolute.md),
[quickstart.md](./quickstart.md), designed by [ADR 005](../../adrs/005-dynamical-regime.md).

**Tests**: Included. ADR 005's own "Tests (write first)" sections (L7, D4′) mandate them, and the spec's acceptance
scenarios and success criteria are only verifiable through them plus the recalibration runs.

**Organization**: The spec defines four user stories, all Priority P1 (spec FR-008: all four ship together). Tasks
are ordered by actual implementation dependency rather than story number: **US2** (weight rule) and **US3** (noise
mechanism) are independent, mechanism-only changes with no calibration dependency, so they come first; **US1**
(graded, non-saturated response) and **US4** (sub-threshold sensory coding) are calibration outcomes that depend on
US2's re-extracted brain and US3's noise mechanism both existing, so they come last and share the same
recalibration sweep (ADR 005's protocol runs all four dimensions — `synapticScale`, `outputScale`,
`noiseAmplitude`, `stimulus.resting`/`gain` — together, not as four separate sweeps).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4, per spec.md's four user stories
- Paths are repo-relative from `/Users/kolesnik/devel/go/src/github.com/fogfish/microfly`

## Path Conventions

Single project (per `AGENTS.md`'s layout and `plan.md`'s Structure Decision): `extract/malecns_brain/`,
`extract/configs/`, `extract/tests/`, `public/js/brain/`, `public/world/`, `scripts/`, `tests/`,
`specs/008-hungry-forager-brain/`. No new top-level directory.

---

## Phase 1: Setup

**Purpose**: Establish the regression baseline before touching any file.

- [X] T001 Run `npm test` from the repo root and record the pass/fail counts as the pre-change baseline. Phase 4's
      T030 and the final Phase's T043 must reproduce the same pre-existing failures, unmodified, with no new ones.
      **Baseline**: 454 tests, 448 pass, 6 fail — all 6 pre-existing failures in `tests/activity.test.mjs` (envelope
      brightness timing), unrelated to this feature.
- [X] T002 Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and record the pass/fail counts
      as the pre-change baseline. Phase 3's T017 and the final Phase's T044 must reproduce the same result, with no
      new failures. **Baseline**: 158 tests, all pass (1 skipped).

**Checkpoint**: Baselines recorded. Proceed to Phase 2.

---

## Phase 2: Foundational

**Purpose**: Diagnostics shared by every later user story's Independent Test and by the recalibration protocol
(ADR 005). Nothing here depends on US2 or US3 landing first — these are measurement tools, not the mechanisms
being measured.

- [X] T003 [P] In `scripts/calibrate-forager.mjs`'s `evaluate(lif)`, capture the return value of `stepForagerFly`
      and compute named drive values via `driveValues(motor.outputs, env.drives)` each tick; accumulate
      `far-forward`/`far-feed` (mean when the fly's current cell is **not** `world.isStimulusCell(cx, cy) &&
      flowers.stockAt(cx, cy) > 0`) and `near-forward`/`near-feed` (mean when it is), and add all four columns to
      `evaluate`'s return object and the printed table (ADR 004 Annex A.2's own ad hoc diagnostic, now a permanent
      fixture per ADR 005's open question — it is not committed anywhere in the repo today).
- [X] T004 Create `scripts/dynamical-diagnostics.mjs`: load the forager snapshot and world config as
      `calibrate-forager.mjs` does, build a network directly via `createFlyBrain`/`createNetwork`, pick one
      declared input channel (e.g. `odour-left`) as the representative sensory pool, drive every neuron in that
      pool with the same constant external value for a fixed number of LIF steps (bypassing the full
      world/food/body loop), and report the **pool-synchrony diagnostic**: the fraction of steps on which every
      neuron in the pool has `net.spikes[neuron] === 1` simultaneously (ADR 005 "pool-synchrony diagnostic";
      contract G13's population-level analogue).
- [X] T005 In `scripts/dynamical-diagnostics.mjs` (after T004, same file), add the **sensory-gradient
      diagnostic**: repeat T004's constant-drive run at several fixed, representative odour intensities (none,
      low, mid, high — matching the spec's "none, low, mid, high" framing in User Story 4), and report each
      pool's mean firing rate at each intensity, so the result can be checked for a monotonic increase through
      more than three distinguishable levels (ADR 005 "sensory-gradient diagnostic"; spec SC-002).

**Checkpoint**: Diagnostic tooling exists and runs against the *current* (pre-regime) shipped brain/world without
error — this is also the "before" measurement Phase 5's T033 references. Proceed to Phase 3.

---

## Phase 3: User Story 2 - A Missing Neuron Means Less Drive, Never More (Priority: P1)

**Goal**: A new extractor weight rule, `weightRule: "postFractionAbsolute"`, normalises each neuron's input
weights over its real, dataset-admitted presynaptic total instead of its selected-subgraph-only total, per
[contracts/weight-rule-absolute.md](./contracts/weight-rule-absolute.md) and ADR 005 D4′.

**Independent Test**: Extract the same brain configuration twice, once with an additional upstream neuron excluded
from selection, and confirm the remaining downstream weights are unchanged or smaller — never larger — than in the
run that included it (spec Acceptance Scenario US2.2; contract test below).

### Tests for User Story 2 (write first — must fail before implementation) ⚠️

- [X] T006 [P] [US2] In `extract/tests/test_selection_forager.py`, add
      `test_post_fraction_absolute_uses_real_admitted_total`: using the existing synthetic fixture (extended if
      needed with a body whose real admitted inputs are only partly captured by selection), run `select_forager`
      once with `config["weightRule"] = "postFraction"` and once with `"postFractionAbsolute"`; assert the
      truncated neuron's total inflow (`Σ |weights|` into it) is strictly smaller under the new rule, and that
      both runs still satisfy `_check_inflow`'s existing "≤ 1" invariant (spec FR-001/FR-002, SC-006).
- [X] T007 [P] [US2] In `extract/tests/test_config_forager.py`, extend `test_weight_rule_is_post_fraction`'s
      family: `config["weightRule"] = "postFractionAbsolute"` must pass `validate_forager` with no error; a third,
      unknown value (e.g. `"cap"`) must still raise `E-CONFIG` naming the value, and the existing assertion
      `self.assertIn("postFraction", caught.exception.message)` must still hold (both legal values contain
      `"postFraction"` as a substring, so the existing test is unaffected by the message wording).
- [X] T008 [P] [US2] In `extract/tests/test_container_v4.py`, add a case building a container with
      `weightRule: "postFractionAbsolute"` and asserting it reads back with `result["header"]["weightRule"] ==
      "postFractionAbsolute"`; keep the existing `"postFraction"` case (line ~76) passing unmodified.
- [X] T009 [P] [US2] In `tests/snapshot-v4.test.mjs`, add a manifest fixture identical to the existing base one
      (line ~26) except `weightRule: 'postFractionAbsolute'`, and assert it parses with no error; add a case with
      an unknown `weightRule` value and assert it is rejected with the existing
      `snapshot weight rule "${weightRule}" is not supported` message shape.
- [X] T010 [US2] Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and
      `node --test tests/snapshot-v4.test.mjs` and confirm T006–T009 fail (the new value doesn't exist yet) — the
      red half of red/green.

### Implementation for User Story 2

- [X] T011 [US2] In `extract/malecns_brain/selection_forager.py`'s `select_forager`, immediately after
      `post_i = np.searchsorted(ids, post)`, add `total_in_full = np.bincount(post_i, weights=syn, minlength=n)`
      (`n = len(ids)`, the full admitted-body universe — not `count`, the final selection size) — computed
      unconditionally; it is cheap (one more `bincount` over an array already in memory) and used only when the
      config requests the new rule (ADR 005 D4′; `contracts/weight-rule-absolute.md`'s exact code).
- [X] T012 [US2] In the same function, immediately before the final weight computation (after the `sorting =
      np.lexsort((dst, src))` line), compute `denom_absolute = total_in_full[post_i[inside]][sorting]` (same
      order as `dst`/`raw` after sorting — i.e. index `post_i[inside]` with `sorting` exactly as `src_all[inside]`,
      `dst_all[inside]`, and `syn[inside]` already are). Branch the final line on
      `config["weightRule"]`: `denom = denom_absolute if config["weightRule"] == "postFractionAbsolute" else
      total_in[dst]`, then `weights = (sign_of[src] * raw / denom).astype(np.float32)`. `weightRule ==
      "postFraction"` must produce byte-identical output to today (T017's regression check).
- [X] T013 [P] [US2] In `extract/malecns_brain/config.py` (~line 323), change the weightRule check from
      `if config["weightRule"] != "postFraction":` to a membership check against
      `{"postFraction", "postFractionAbsolute"}`, keeping the `E-CONFIG` failure code and a message that still
      mentions `"postFraction"` (T007).
- [X] T014 [P] [US2] In `extract/malecns_brain/container.py`'s `_check_forager` (~line 185), change
      `if header.get("weightRule") != "postFraction":` to the same membership check, same `_reject` message shape
      (naming the actual value found).
- [X] T015 [P] [US2] In `public/js/brain/snapshot.js` (~line 130), change
      `if (manifest.weightRule !== 'postFraction')` to a membership check against the same two values, same
      rejection message (T009).
- [X] T016 [US2] Update `extract/configs/forager-brain.json`'s `weightRule` (line 126) from `"postFraction"` to
      `"postFractionAbsolute"` (ADR 005 recalibration protocol step 1 — must happen before Phase 5/6's sweep,
      which needs a brain extracted under the new rule).
- [X] T017 [US2] Re-extract the shipped brain: `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m
      malecns_brain extract --config configs/forager-brain.json --out ../public/brains/forager-brain.brain`.
      Confirm the self-check passes, the neuron/edge counts match the previously shipped brain (selection logic is
      untouched — only weight values change, per `data-model.md`), and running the command twice gives a
      byte-identical file apart from `provenance.createdAt`.
- [X] T018 [US2] Run `cd extract && .venv/bin/python -m unittest discover -s tests -t .` and
      `node --test tests/snapshot-v4.test.mjs tests/fly-brain-snapshot.test.mjs` and confirm T006–T009 now pass,
      and the pre-existing suite (T002's baseline) shows no new failures — the green half of red/green.

### Documentation for User Story 2

- [X] T019 [P] [US2] Update `specs/008-hungry-forager-brain/contracts/extract-config-forager.md`'s `weightRule` row
      and `specs/008-hungry-forager-brain/contracts/container-v4.md`'s `weightRule` header rule and CSR weight
      formula — content exactly as specified in `contracts/weight-rule-absolute.md`.

**Checkpoint**: User Story 2 is fully functional and independently testable — `postFractionAbsolute` exists, is
validated on both the Python writer and JS reader, a truncated neuron's weight is provably smaller (never
inflated), the shipped brain is re-extracted under it, and `weightRule: "postFraction"` snapshots keep reading
exactly as before.

---

## Phase 4: User Story 3 - A Pool of Neurons Behaves Like a Population, Not One Neuron (Priority: P1)

**Goal**: Add `noiseAmplitude` (L7) to `lif-v1.js` (default `0`, a no-op) so per-neuron, per-step noise can
desynchronize identically-driven pools, per [contracts/lif-v1-noise.md](./contracts/lif-v1-noise.md) and ADR 005.

**Independent Test**: Drive a synthetic pool of identically-initialized neurons with identical constant input;
confirm they do not all spike on the same step when `noiseAmplitude > 0`, and that the same seed reproduces the
same per-neuron spike pattern across repeated runs (spec Acceptance Scenarios US3.1–US3.2; contracts G12–G13).

### Tests for User Story 3 (write first — must fail before implementation) ⚠️

- [X] T020 [P] [US3] Write test group `L7(a)` "default no-op" in `tests/lif-v1.test.mjs`: build a network with
      `noiseAmplitude: 0` and one with it absent from the overrides entirely; assert identical (`===`) spike
      trains and potentials over the existing golden/toy drive already used in this file (contract G11).
- [X] T021 [US3] Write test group `L7(b)` "reproducibility" in `tests/lif-v1.test.mjs` (after T020, same file):
      build two networks with the same seed, graph, and `noiseAmplitude: 0.1`; run both over the same drive for
      several steps; assert identical spike trains across the two runs (contract G12).
- [X] T022 [US3] Write test group `L7(c)` "pool desynchrony" in `tests/lif-v1.test.mjs` (after T021, same file): a
      synthetic graph of N neurons (e.g. 20) with identical incoming weights and no recurrent connections among
      them, all driven by the same constant `external` value every step; run for enough steps to make every
      neuron cross threshold repeatedly; assert the fraction of steps where every neuron spikes together is
      effectively 1 at `noiseAmplitude: 0` and measurably lower at `noiseAmplitude: 0.3` (contract G13).
- [X] T023 [US3] Write test group `L7(d)` "jitter independence" in `tests/lif-v1.test.mjs` (after T022, same
      file): (i) build two networks with the same seed and `noiseAmplitude: 0.5`, one with `thresholdJitter: 0`
      and one with `thresholdJitter: 0.3`; assert calling `net.noiseRand()` the same number of times immediately
      after `createNetwork` on each produces an identical sequence of raw values; (ii) build two networks with the
      same seed and `thresholdJitter: 0.3`, one with `noiseAmplitude: 0` and one with `noiseAmplitude: 0.5`;
      assert their `net.threshold` arrays are identical (contract G14).
- [X] T024 [US3] Write test group `L7(e)` "validation" in `tests/lif-v1.test.mjs` (after T023, same file): assert
      `resolveParams({ noiseAmplitude: -1 })` and `resolveParams({ noiseAmplitude: 'x' })` both throw the exact
      message `'LIF parameter "noiseAmplitude" must be 0 or more'` (contract G15).
- [X] T025 [P] [US3] Write an integration test in `tests/fly-brain-v1.test.mjs` (skipped when
      `public/brains/forager-brain.brain` is absent, following this file's existing `SKIP` pattern): drive one
      declared input channel's neurons with the same constant value for several ticks; assert the per-neuron spike
      pattern within that channel is less synchronized (lower all-together fraction) at `noiseAmplitude: 0.3` than
      at `noiseAmplitude: 0`, same fixed seed.
- [X] T026 [US3] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs` and confirm T020–T025 fail
      (the parameter doesn't exist yet) — the red half of red/green.

### Implementation for User Story 3

- [X] T027 [US3] In `public/js/brain/lif-v1.js`, add `noiseAmplitude: 0` to `LIF_V1_DEFAULTS` with a one-line
      comment naming it `L7` and describing it as "half-width of a per-neuron, per-step uniform membrane noise
      term; 0 is a no-op", matching the existing comment style for `tauSyn`/`tauAdapt`/`thresholdJitter`/`outputScale`.
- [X] T028 [US3] In `resolveParams` (after T027, same file), add: `noiseAmplitude` must be
      `Number.isFinite(p.noiseAmplitude) && p.noiseAmplitude >= 0`, else throw
      `'LIF parameter "noiseAmplitude" must be 0 or more'` — alongside the existing `tauSyn`/`tauAdapt` range checks.
- [X] T029 [US3] In `createNetwork` (after T028, same file), when `params.noiseAmplitude > 0`, construct a
      **second**, independent `createPrng(seed)` instance (distinct from the one `thresholdJitter` constructs) and
      return its `next` function on the network object as `noiseRand`; when `noiseAmplitude === 0`, do not
      construct it at all (per contract — no draw, no allocation).
- [X] T030 [US3] In `step` (after T029, same file), add the noise term to the membrane update, computed only when
      `params.noiseAmplitude > 0` (skipped entirely otherwise, preserving today's exact off-path update order):
      for every neuron `i` in index order, every step (including refractory neurons, so the stream's position
      never depends on which neurons were refractory), draw
      `noise = p.noiseAmplitude * (2 * net.noiseRand() - 1)` and add it to `v[i]`'s update alongside `drive` and
      `external[i]`, per `contracts/lif-v1-noise.md`'s `step` amendment.
- [X] T031 [US3] Run `node --test tests/lif-v1.test.mjs tests/fly-brain-v1.test.mjs` and confirm T020–T025 now
      pass — the green half of red/green.
- [X] T032 [US3] Run `node --test tests/lif-golden.test.mjs` and the full `npm test` suite; confirm
      `lif-golden.test.mjs` still passes unmodified (G1 regression) and no new failures beyond T001's baseline.

### Documentation for User Story 3

- [X] T033 [P] [US3] Update `specs/008-hungry-forager-brain/contracts/lif-v1.md`: add the `noiseAmplitude` row to
      the `LIF_V1_DEFAULTS` parameter table and its rejection case to `resolveParams`'s documented list, document
      the dedicated `noiseRand` stream under "Create", document the `step` amendment under "Step", and add
      guarantees **G11–G15** to "Guarantees and tests" — content exactly as specified in
      `contracts/lif-v1-noise.md`.

**Checkpoint**: User Story 3 is fully functional and independently testable — `noiseAmplitude` exists, defaults to
a verified no-op, is validated, reproducibly desynchronizes identically-driven pools, is independent of
`thresholdJitter`'s own stream, and the contract documents it. No world file is changed by this story — recalibrating the
shipped forager world is Phase 5/6's job.

---

## Phase 5: User Story 1 - A Stronger Smell Produces a Stronger Response (Priority: P1) 🎯 Core regime outcome

**Goal**: Recalibrate `synapticScale`/`outputScale`/`noiseAmplitude` on the US2-re-extracted brain so the
principal sensing-to-motor pathway shows real headroom below the firing ceiling instead of ADR 004's measured
~0.985/0.986, validated on held-out seeds (ADR 005 "Recalibration protocol").

**Independent Test**: Run the forager brain on seeded flies at different distances from food; confirm forward/feed
activity rises as distance falls and does not sit within a few percent of maximum for most of the approach (spec
Acceptance Scenarios US1.1–US1.2).

**Depends on**: Phase 3 (US2 — re-extracted brain under `postFractionAbsolute`) and Phase 4 (US3 — `noiseAmplitude`
mechanism) both complete; this phase's sweep is meaningless without both.

- [X] T034 [US1] Using the Foundational diagnostics (T003's saturation columns, T004/T005's pool-synchrony and
      sensory-gradient scripts), run them once against the **current, not-yet-recalibrated** `world-forager.json`
      on calibration seeds, as a recorded "before" measurement — this both confirms the new diagnostics reproduce
      ADR 004's known ~0.985/0.986 saturation and today's lockstep pools, and gives the sweep below a baseline to
      improve on. **Done**: 0 % find (0/30), `far-forward` 0.029, `far-feed` 0.339 — the weight-rule change alone
      breaks foraging; recorded in `calibration.md`'s 2026-10-09 entry.
- [X] T035 [US1] Sweep `synapticScale`, `outputScale`, and `noiseAmplitude` on calibration seeds only
      (`f.experiment.seeds`) using `scripts/calibrate-forager.mjs` (now pointed at the US2-re-extracted
      `forager-brain.brain`), per ADR 005 recalibration protocol step 3. Apply step 4's selection order: (a)
      `far-forward`/`far-feed` show real headroom, not pinned near 1.0; (b) the pool-synchrony diagnostic shows a
      lockstep fraction well below the "before" measurement; (c) `feed` still reliably crosses `feedThreshold`
      near food; (d) `find` rate stays above the random-walk and size-matched random-graph baselines (re-run under
      `postFractionAbsolute` — `scripts/forager-arms.mjs` or `scripts/compare-baseline.mjs`'s null-arm path, per
      spec Edge Cases). **Done**: 112 grid points across four sweeps (coarse, refinement, targeted, a second
      refinement); best two candidates found and validated below.
- [X] T036 [US1] Validate the chosen candidate on held-out seeds:
      `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out`, including the
      null-arm comparison from T035(d) re-run on held-out seeds. Non-negotiable before adopting any candidate
      (ADR 004 Annex A.3's own cautionary precedent; spec FR-009/SC-005). **Done, both FAILED**: candidate 1 (find
      14.4 % < baseline 23.3 %, eat FAIL, hunger-dep FAIL); candidate 2 (find 18.3 % < baseline 23.3 %, eat FAIL,
      hunger-dep FAIL). Neither adopted; `world-forager.json` reverted both times.
- [X] T037 [US1] Record the sweep (grid, all three new diagnostic columns, selection reasoning) and its held-out
      verdict as a new dated entry in `specs/008-hungry-forager-brain/calibration.md`, same table format as the
      existing entries (ADR 005 protocol step 5). **Done**: 2026-10-09 entry, including the diagnosis (short,
      flickering eat bouts traced to `postFractionAbsolute`'s own weight heterogeneity, not `noiseAmplitude`) and
      the not-searched list for the next pass.
- [ ] T038 [US1] Only on a held-out pass: update `public/world/world-forager.json`'s
      `flies.brain.lif.synapticScale`, `outputScale`, and `noiseAmplitude` to the validated values (protocol step 6).
      **Not done — no candidate passed held-out.** `world-forager.json` is unchanged from its pre-feature values.

**Checkpoint**: Not reached. No candidate's `far-forward`/`far-feed` headroom was confirmed on held-out seeds,
because no candidate passed held-out at all (find rate below the random-walk baseline both times, eat and
hunger-dependence gates both reversed). Recorded with its held-out verdict either way, per the checkpoint's own
wording — the "either way" branch is the one that happened (spec SC-003/SC-006 not met this pass).

---

## Phase 6: User Story 4 - No Smell Means Quiet, Not Constant Firing (Priority: P1)

**Goal**: Recalibrate `stimulus.resting`/`gain` (and `tau`/`vThreshold` if needed, ADR 005 D6) so sensory rest sits
sub-threshold, with `noiseAmplitude` (Phase 4) supplying low, non-tonic background firing, and odour raises
activity through more than three distinguishable levels (spec SC-001/SC-002).

**Independent Test**: Simulate an odour-sensing neuron at several fixed intensities from none to strong; confirm
the no-odour condition is low and noise-driven, and firing rate increases monotonically through more levels than
today's three (spec Acceptance Scenarios US4.1–US4.3).

**Depends on**: Phase 4 (US3 — `noiseAmplitude`) complete, and runs as part of the same combined sweep as Phase 5
(ADR 005's protocol does not separate these into two sweeps — both are evaluated against the same candidate grid).

- [X] T039 [US4] Extend Phase 5's sweep (T035) to also vary `stimulus.resting`/`gain` (and `tau`/`vThreshold` if
      `resting`/`gain` alone cannot reach the needed range), searching for a point where
      `τ · resting · g0 ≤ vThreshold` (lowest reachable drive stays at or below threshold) while
      `τ · max_intensity · gain · g1` still clears it comfortably (ADR 005 D6's target). **Done**: `resting: 0.05`
      (down from the shipped `0.2`) was swept alongside every Phase 5 grid above and satisfies the target
      (`20 × 0.05 × 0.5 = 0.5 ≤ 1`) cleanly at `hunger: 0`; `gain`/`tau`/`vThreshold` were not moved — `resting`
      alone reached the target range.
- [X] T040 [US4] Run the sensory-gradient diagnostic (`scripts/dynamical-diagnostics.mjs`, T005) against each
      candidate from T039; select the one showing a low, non-sustained firing rate at zero odour and a monotonic
      increase through more than three distinguishable levels across the odour range (ADR 005 protocol step 4(c);
      spec SC-001/SC-002). **Done**: `resting: 0.05` at `hunger: 0` gives **0, 0.216, 0.297, 0.332** spikes/step/
      neuron at none/low/mid/high intensity — a quiet floor and four distinguishable, monotonic levels. At
      `hunger: 1` the floor itself saturates (D6's formula is stated for `hunger: 0`, the lowest reachable drive;
      higher-hunger flies lose the graded response — recorded as an ADR-005-anticipated open question).
- [~] T041 [US4] Confirm the resting/gain change does not regress the held-out result already obtained in Phase
      5's T036 — re-run `scripts/compare-baseline.mjs --seeds=held-out` with the combined candidate (scale/output/
      noise from Phase 5 plus resting/gain from this phase) if T039/T040's candidate differs from what T035
      assumed, otherwise confirm T036's existing result already covers this combined candidate. **Not applicable**:
      both of T036's held-out runs already included `resting: 0.05` (the combined candidate, per Phase 5/6's
      shared sweep) and both failed — there is no passing held-out result from T036 to regress from.
- [X] T042 [US4] Record the resting/gain choice and its sensory-gradient measurements in the same dated
      `calibration.md` entry as T037 (one sweep, one entry, per ADR 005's protocol). **Done**: same 2026-10-09
      entry, "Sensory-gradient finding" section.
- [ ] T043 [US4] Only on a held-out pass: update `public/world/world-forager.json`'s `flies.stimulus.resting`/
      `gain` to the validated values; if the hunger modulator's own `gain: [g0, g1]` needs to move too, update
      `extract/configs/forager-brain.json`'s `modulators` section and re-run T017's re-extraction (modulator gains
      are a snapshot-header field, container-v4.md M1–M3, not a world-config value). **Not done — no candidate
      passed held-out** (same gate as T038; `resting` and the `lif` values are one combined candidate, reverted
      together both times).

**Checkpoint**: Partially reached. US2 (D4′) and US3 (L7) are both independently verified, tested, and shipped.
US1 and US4's *mechanisms* behave as designed in isolation (real weight headroom exists under the new rule; L7
desynchronizes a true synthetic lockstep pool; `resting: 0.05` gives a clean sub-threshold floor and a four-level
gradient) — but the *combined, held-out-validated* operating point this checkpoint requires was not found this
pass. The forager brain is not, today, in a graded non-saturated regime on held-out seeds; it is in a documented,
not-yet-resolved state between the old and new regimes (see calibration.md's "Verdict" section).

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Whole-feature regression and the constitution's run check.

- [X] T044 [P] Run the full `npm test` suite and confirm no new failures beyond T001's recorded baseline. **Done**:
      462 tests, 456 pass, 6 fail — the same 6 pre-existing `tests/activity.test.mjs` failures as T001's baseline;
      no new failures (6 new tests added by this feature, all passing).
- [X] T045 [P] Run the full extractor suite
      (`cd extract && .venv/bin/python -m unittest discover -s tests -t .`) and confirm no new failures beyond
      T002's recorded baseline. **Done**: 161 tests, all pass (1 skipped) — T002's baseline was 158/all-pass; the
      3 new tests (`postFractionAbsolute`) all pass, no new failures.
- [X] T046 Run `cd public && python3 -m http.server 8000`, load `?world=world/world-forager.json`, and confirm the
      world loads, at least one fly runs, and there are no console errors (`AGENTS.md`'s run check; quickstart.md
      step 5). **Done, partially**: the server serves `index.html`, `world/world-forager.json`, and
      `brains/forager-brain.brain` with `200`, and every file under `public/js/` passes `node --check` (no syntax
      errors). This session has no browser available to open the page and read its console, so "at least one fly
      runs, no console errors" is **not visually verified** — only the server/file layer and JS syntax are
      confirmed. The world's own validation (`validate.js`) and the full brain-load/simulate path
      (`parseSnapshot`, `createFlyBrain`, `stepForagerFly`) ran without error dozens of times tonight via
      `calibrate-forager.mjs`/`compare-baseline.mjs`/`dynamical-diagnostics.mjs`, which exercises the same code
      the browser would run, short of the DOM/render/UI layer itself.
- [~] T047 Update `adrs/005-dynamical-regime.md`'s Status from "Proposed" to "Accepted", and add an Annex of the
      sweep's actual measurements (saturation, pool-synchrony, and sensory-gradient numbers from T034–T042),
      mirroring ADR 004 Annex A's own after-the-fact measurement record. **Annex added; Status left as
      "Proposed"** — ADR 003 and ADR 004 are both still "Proposed" in this repo despite being fully implemented
      with their own Annex measurement records (this project's own precedent), and this pass's recalibration did
      not converge to a held-out-passing candidate, so marking ADR 005 "Accepted" would overstate the outcome.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. Does not depend on US2 or US3 — it builds measurement tooling
  against whatever brain/world currently exists.
- **US2 (Phase 3)** and **US3 (Phase 4)**: Both depend only on Foundational completing (so T001/T002's baselines
  exist). They touch disjoint files (Python extractor vs. `lif-v1.js`) and can proceed in parallel.
- **US1 (Phase 5)**: Depends on **both** US2 (needs the re-extracted brain, T017) and US3 (needs `noiseAmplitude`,
  T030) complete — spec FR-008 makes this dependency explicit, not incidental.
- **US4 (Phase 6)**: Depends on US3 (T030) and runs as part of the same sweep as US1 (Phase 5) — in practice,
  Phase 5 and Phase 6 are executed together as one calibration pass, not strictly sequentially.
- **Polish (Final Phase)**: Depends on all four user stories being complete.

### Within Each User Story

- Tests written and failing before implementation (red/green discipline, per ADR 005's "Tests (write first)").
- `lif-v1.js`/`selection_forager.py` core changes before their documentation updates.
- Mechanism (US2, US3) before the calibration that depends on it (US1, US4).

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel.
- T003 (calibrate-forager.mjs) and T004 (new file) can run in parallel; T005 depends on T004 (same file).
- US2 (Phase 3) and US3 (Phase 4) can be implemented in parallel by different people — disjoint files, no shared
  state.
- Within US2's tests: T006–T009 (four different files) can run in parallel.
- Within US3's tests: T020 must land before T021–T024 (same file, sequential); T025 (different file) can run in
  parallel with any of T020–T024.
- Documentation tasks (T019, T033) can run in parallel with each other, and with the other story's implementation,
  since they touch different contract files.

---

## Parallel Example: User Story 2 and User Story 3 together

```bash
# Developer A, User Story 2 (extractor):
Task: "Add test_post_fraction_absolute_uses_real_admitted_total in extract/tests/test_selection_forager.py"
Task: "Change selection_forager.py's weight denominator for postFractionAbsolute"

# Developer B, User Story 3 (LIF core), at the same time — disjoint files, no coordination needed:
Task: "Write test group L7(a) default no-op in tests/lif-v1.test.mjs"
Task: "Add noiseAmplitude to LIF_V1_DEFAULTS in public/js/brain/lif-v1.js"
```

---

## Implementation Strategy

### Mechanisms First, Then the Regime They Enable

1. Complete Phase 1 (Setup) and Phase 2 (Foundational diagnostics).
2. Complete Phase 3 (US2) and Phase 4 (US3) — independently, in parallel if staffed. Each is fully testable on its
   own (mechanism-level tests, no calibration needed) and does not yet touch the shipped world.
3. **STOP and VALIDATE**: both mechanisms pass their own tests and the golden/extractor regressions
   (T018, T032) before any calibration sweep begins — per spec FR-008, starting the sweep on an incomplete
   mechanism set would reproduce the exact "no in-between setting" problem this feature exists to fix.
4. Complete Phase 5 (US1) and Phase 6 (US4) together as one recalibration pass, validated on held-out seeds before
   shipping any new `world-forager.json` value.
5. Complete the Final Phase: full regression, the run check, and the ADR's after-the-fact measurement record.

### Why there is no "MVP subset"

Spec FR-008 and ADR 005's "Why this is one feature, not four" are explicit: shipping US2 or US3 alone is real,
independently-testable progress (their own checkpoints hold), but shipping *only* US2+US3 without reaching Phase
5/6's held-out-validated recalibration leaves the forager brain exactly as saturated as it is today — the
mechanisms exist but nothing has used them to find a non-saturating operating point yet. Phases 3–4 are safe to
pause after; Phases 5–6 are where the spec's actual success criteria (SC-001–SC-006) become checkable.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing (red/green).
- Commit after each task or logical group.
- The recalibration sweep (Phases 5–6) is empirical: the exact parameter values are not fixed by this task list
  (spec Assumptions) — T035/T039's grids and T037/T042's chosen values are determined by running the protocol, not
  decided in advance.
