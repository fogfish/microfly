---

description: "Task list for Demo Forager (ADR 010, spec 017)"
---

# Tasks: Demo Forager — Decoded Readout, Body Layer and Online Homeostasis

**Input**: Design documents from `/specs/017-demo-forager/` (plan.md, spec.md, research.md, data-model.md,
contracts/decoder-v1.md, contracts/world-config-v3.md, quickstart.md)

**Tests**: Included. The project constitution requires them: LIF-core unit tests (Principle V), contract tests on
both sides of any snapshot/protocol/world-config contract change (AGENTS.md "Contracts"), and a browser run check
before the feature is done (AGENTS.md "Workflow").

**Organization**: Tasks are grouped by user story (spec.md Stories 1–7) after a Foundational phase. This feature's
seven stories are mostly different *observations* of one shared mechanism (the decoder + body layer running on the
calibrated wide brain), not separable verticals — so the Foundational phase is unusually large, and most
story-specific tasks are "wire in a story-specific metric/edge case" plus "run and record," not new subsystems.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no ordering dependency on an incomplete task)
- **[Story]**: US1–US7, matching spec.md's Story 1–7 (priorities P1/P1/P2/P2/P2/P3/P3 respectively)

## Path Conventions

Single project (static web app + Node CLI tooling), existing repository layout — see plan.md's Project Structure.
All paths below are repo-relative.

---

## Phase 1: Setup

**Purpose**: Scaffolding that every later task writes into; no behaviour yet.

- [X] T001 [P] Create `specs/017-demo-forager/calibration.md` (empty, headed "C1 / C2 / C3 — demo-v3", per the
  `calibration.md` convention AGENTS.md's "Working on brains" names) to receive the T026 calibration run's record.
- [X] T002 [P] Create `specs/017-demo-forager/results.md` (empty, headed with the Part K table columns from
  data-model.md's "Acceptance report" entity: requirement, metric, verdict, B/RW/RG numbers) to receive each story's
  measured results.
- [X] T003 [P] Create `public/world/world-forager-demo.json` as a copy of `public/world/world-forager-wide.json`
  with `flies.brain.version` changed to `"v3"` and placeholder (not-yet-valid) `flies.brain.decoder`,
  `flies.body.locomotion`, `flies.body.backup`, `flies.modulators.hunger` keys per contracts/world-config-v3.md's
  example — this world will not load until T014/T025 land; it exists now so later tasks have one file to edit.
- [X] T004 [P] Create `public/world/world-forager-demo-tilemap.json`: the same `flies` section as T003, on the
  tile-section generator map (`ground`/`waterBodies`/`objects`/`groves`/`scatter` keys, per research.md §5 — not
  the `map` sketch-map block), reusing the existing generator modules
  (`public/js/world/{ground,water,shore,scatter,layout}.js`); base the map layout on the shape of
  `public/world/world-forager-bad.json`'s tile-section skeleton (a deliberately-broken fixture of the same shape —
  copy its structure, not its intentional breakage) minus whatever makes it a `-bad` fixture.

**Checkpoint**: Two placeholder world files and two empty record files exist. No code changed yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The decoder, body layer, world-config-v3 schema, calibration pipeline and one real calibrated
`decoder-v1` artifact. **No user story is observable until this phase and T026 are both done.**

**⚠️ CRITICAL**: No user-story task may be started before this phase's checkpoint.

### LIF core (L10)

- [X] T005 Add `baselineCurrent` to `public/js/brain/lif-v1.js`: a constant input current added to every bulk
  neuron each step, input and output pools treated alike. **Constraint (data-model.md / ADR 010 L10)**: "Default
  `0`, so `lif-v1.js` matches `lif-v0.js` bit for bit"; validated as "a finite number ≥ 0."
- [X] T006 [P] Add `tests/lif-baseline-current.test.mjs`: with `baselineCurrent` at its default (0), spike trains
  are bit-identical to a run with the parameter absent; with it set > 0, verify it is applied equally to input and
  output pools. Re-run the existing `tests/lif-golden.test.mjs` and confirm it still passes unmodified.

### Decoder reader and per-tick decode (D27–D29, contracts/decoder-v1.md)

- [X] T007 [P] Contract test `tests/decoder.test.mjs` for the **reader** rules in contracts/decoder-v1.md: reject
  (before any fly starts) a `snapshot.sha256` mismatch, an out-of-range pool member index, a `pools` key naming an
  undeclared pair, and a `valence` value outside `approach`/`avoid`/`none` — quoting the four exact error-message
  shapes the contract specifies for each case.
- [X] T008 Implement the `decoder-v1` reader in `public/js/fly/decoder.js`: parse the sidecar JSON, run the four
  reject rules from T007, and expose `{ pools, valence, provenance }`. A `side.<pair>.L`/`.R` pair absent from the
  file is exposed as **absent** (not an empty array) — data-model.md's Pool validation rule.
- [X] T009 In `public/js/fly/decoder.js`, implement the per-tick decode (D29 / data-model.md "Decoded sense
  signal"), from the tick's `spikes` (`Uint32Array` of fired neuron indices) and the homeostatic baseline (T010):
  for each declared sense, `drive = max(0, r(drive.p) − rest(drive.p))` smoothed τ = 3 ticks; `side = (r̂(L) − r̂(R)) /
  (r̂(L) + r̂(R) + ε)` when a side pool exists, else absent; `weight = drive / (drive + floor)`; `trend = (drive −
  slow) / (slow + ε)` with `slow` an EMA of τ = 30 ticks.
- [X] T010 In `public/js/fly/decoder.js`, implement the homeostatic baseline (D33 / data-model.md "Homeostatic
  baseline"): per pool, `rest` as an EMA of **τ = 2,000 ticks**, and for each `side` pair, `balance =
  slow(r(side.L)) / slow(r(side.R))`. **Constraint**: both update "only while the pool's sense is quiet: the pair's
  input channels are below 0.05" (or, for `alarm`/`feed`/`forward`/`backward`, "while every sense is quiet"); seeded
  from the `decoder-v1` file's own C2-measured initial values so the fly behaves correctly from tick 0.
- [X] T011 [P] `tests/homeostasis.test.mjs`: while a sense is quiet (channel < 0.05) its `rest`/`balance` keep
  updating; while active, they freeze; a fresh fly seeded from the decoder file's initial values shows no
  persistent left/right turn bias at tick 0 (Story 7, Acceptance Scenario 1).

### Body layer (W12–W14)

- [X] T012 Create `public/js/fly/body-layer.js`, used only for `flies.brain.version === "v3"`. Implement W12
  (walking rhythm/speed): `speed = clamp(baseSpeed + speedGain · (r(forward) − rest(forward)), 0, maxSpeed) · (1 +
  surgeGain · max(0, trend_approach))`, with heading advanced by a random walk of amplitude `wander` even with no
  stimulus (**constraint**: `baseSpeed > 0` — "the fly walks without being driven").
- [X] T013 In `public/js/fly/body-layer.js`, implement W13 (steering: tropotaxis + klinotaxis, signed by declared
  valence): `turn = turnGain · Σ_p v_p · weight_p · side_p` (tropotaxis) and `cast = clamp(1 − castGain · Σ_p v_p ·
  trend_p, castMin, castMax)` (klinotaxis), `heading += (turn + wander · cast · noise) · dt`, where `v_p` is +1 for
  `approach`, −1 for `avoid`, 0 for `none` (data-model.md). When a sense has no `side` pool, its `side_p` term is 0
  and klinotaxis alone carries steering for that sense (Edge Case).
- [X] T014 In `public/js/fly/body-layer.js`, implement W14: reuse the existing `applyEscape` jump
  (`public/js/fly/body.js:42-58`) triggered when `r(alarm) − rest(alarm) ≥ escape.threshold`, jumping toward/away
  from `side_danger` or `side_heat` (backward if neither side pool exists, Edge Case); add backing up — reverse for
  `backup.ticks` when `r(backward) − rest(backward) ≥ backup.threshold`.
- [X] T015 [P] `tests/body-layer.test.mjs`: W12 (base speed with zero drive, speed clamp, surge on rising approach
  trend), W13 (a left-side food source turns the fly left; klinotaxis-only fallback when no side pool), W14 (escape
  jump direction, backward fallback with no side pool, backup reversal duration).

### Hunger threshold (D32)

- [X] T016 Edit `public/js/brain/fly-brain-v1.js`'s modulator-gain computation (currently `gain *= g0 + (g1 − g0) *
  modulatorValue(mod, hunger)`, research.md §6): when a runtime-supplied threshold is present for a modulator,
  substitute `m' = h < threshold ? 0 : (h − threshold) / (1 − threshold)` for `m`. **Constraint (D32)**: absent
  threshold ⇒ today's unchanged linear curve; this must not alter output for `v0`/`v1`/`v2` worlds, which never
  supply a threshold.
- [X] T017 [P] `tests/hunger-threshold.test.mjs`: with `threshold = 0.4`, hunger 0.3 yields gain `gainMin`; hunger
  0.7 yields the ramp value `gainMin + (gainMax − gainMin) · (0.7 − 0.4)/(1 − 0.4)`; with no threshold supplied,
  output is identical to the pre-existing linear formula (regression guard for `v0`–`v2`).

### World config v3 (contracts/world-config-v3.md)

- [X] T018 [P] Contract test `tests/world-config-v3.test.mjs` (validator side): `flies.brain.version` accepts
  `"v3"`; `flies.brain.decoder` required for `v3`, forbidden otherwise; `flies.body.locomotion` and
  `flies.body.backup` required for `v3`; `flies.body.escape.enabled` defaults to `true` for `v3` (vs. `false` for
  `v2`); quote the exact failure messages from contracts/world-config-v3.md ("Failure messages" section) for each
  rejected case.
- [X] T019 Edit `public/js/world/validate.js`: add `'v3'` to `BRAIN_VERSIONS` (currently `['mock', 'v0', 'v1',
  'v2']`); add `validateBodyLocomotion`/`validateBodyBackup` gated on `version === 'v3'`, following the existing
  `validateBodySites`/`validateFlies...Escape` pattern; add the `flies.brain.decoder` required/forbidden check; add
  a `flies.modulators.hunger.threshold` check (number in `[0, 1)`, default 0.4, optional for every version).
- [X] T020 Edit `public/js/fly/fly-config.js`: resolve `flies.brain.decoder` (a path, resolved the same way as
  `flies.brain.snapshot`), and default `flies.body.locomotion`/`flies.body.backup`/`flies.modulators.hunger`
  exactly as contracts/world-config-v3.md's tables state.
- [X] T021 Edit `public/js/fly/fly-host.js`'s existing `case 'motor':` branch (`public/js/fly/fly-host.js:210+`,
  which already receives `msg.spikes`/`msg.outputs`): for a `v3` fly, call `decoder.js`'s per-tick decode (T009)
  then `body-layer.js`'s step (T012–T014) instead of the `v0`/`v1`/`v2` motor path; leave the existing path
  untouched for every other version.
- [X] T022 [P] `tests/forager-step-v3.test.mjs`: an end-to-end synchronous tick (sense → brain.step → decode →
  body-layer → motor) for `v3`, parallel to the existing `forager-step-wide.test.mjs`, confirming the decoder and
  body layer are actually wired into the per-tick path and not just unit-testable in isolation.

### Calibration pipeline (Part H, C1–C3)

- [X] T023 Create `.claude/skills/microfly-calibrate/scripts/decoder-engine.mjs` with the **C1 regime** stage: grid
  `synapticScale {3,4,5,6} × baselineCurrent {0,0.02,0.04,0.06}` (16 points), gated on rest activity 1–10% of
  neurons/tick, no ignition (activity returns to rest within 100 ticks after stimulus ends), every pair's `drive`
  candidate rises ≥ 3 Hz; pick the passing point with lowest rest activity, ties on lower `synapticScale`.
- [X] T024 In `decoder-engine.mjs`, implement **C2 decode**: for the ~1,320 candidates (every descending neuron +
  named outputs), measure per-neuron spike rate under rest, left-only, right-only and bilateral stimulus of each
  pair, over 3 seeds + 1 held-back seed, 400 ticks; select pools per D27's exact rules (`side` pools need `s =
  (rL−rR)/(rL+rR)`, `|s| > 0.3`, mean rate ≥ 2 Hz above rest; `drive` pools need rate rise ≥ 3 Hz and ≥ 2× any other
  pair's rise); sort members by `|s|` descending, ties on `bodyId` ascending (determinism, D27); verify ≥ 70% sign
  reproduction on the held-back seed or fail with `E-DECODE-<pool>` and write no file; write the `decoder-v1` file
  (contracts/decoder-v1.md shape) to `public/brains/forager-brain-wide.decoder.json`.
- [X] T025 [P] `tests/decoder-engine.test.mjs`: C2 pool selection is deterministic for the same snapshot/LIF
  block/seeds (two runs give identical `pools`); the sort order matches `|s|` desc / `bodyId` asc; a forced
  held-back-seed sign mismatch below 70% produces `E-DECODE-<pool>` and no file is written.
- [X] T026 In `decoder-engine.mjs`, implement **C3 smoke**: closed-loop run on calibration seeds, both maps
  (`world-forager-demo.json` and `world-forager-demo-tilemap.json`), brain arm and random-walk arm, hungry start;
  report quick R1–R3 numbers — "reported, never tuned on" (Part H).
- [X] T027 [P] Create `.claude/skills/microfly-calibrate/scripts/profiles/demo-v3.mjs`: `worldPath:
  'world/world-forager-demo.json'`, `brainVersion: 'v3'`, reading the 12 declared input pairs and named outputs
  generically from `ctx.capabilities.channels` (following `profiles/wide-io.mjs`'s own convention, research.md).
- [X] T028 Edit `.claude/skills/microfly-calibrate/scripts/calibrate.mjs`: add `--stage=c1|c2|c3|all` to the
  existing `regime|classify|auto|world` dispatch, calling into `decoder-engine.mjs`'s three stages in order for
  `all`; stop at the first stage that fails its gate, printing the stage, the gate and the failing numbers, and do
  **not** continue to a later stage (spec FR-018); enforce `--budget-minutes` as a hard cap across the whole
  `--stage=all` run, printing total wall-clock time on completion (R4/K7).
- [X] T029 Finalize `public/world/world-forager-demo.json` (replace T003's placeholders): set `flies.brain.decoder`
  to `"brains/forager-brain-wide.decoder.json"`, and `flies.body.locomotion`/`flies.body.backup`/
  `flies.modulators.hunger.threshold` to contracts/world-config-v3.md's worked example values (to be overwritten by
  T030's real calibration numbers).
- [ ] T030 **Run** `node calibrate.mjs --version=demo-v3 --stage=all --budget-minutes=30` end to end. Record the
  stage-by-stage result (pass/fail per gate, wall-clock time) in `specs/017-demo-forager/calibration.md`. If a
  stage fails: this is a finding (AGENTS.md "Behaviour failures are findings") — record it, do not hand-tune the
  decoder or brain to force a pass; adjust `calibrate.mjs`'s grid per ADR 010 Part L's documented fallback and
  re-run instead.
  **Status (2026-10-17): attempted, C1 FAILS — see `calibration.md`.** The shipped grid and a substantially wider
  search (every LIF axis the contract exposes, quiet through fully-ignited regimes) found no point where the
  real `forager-brain-wide.brain`'s candidate population clears the 3 Hz drive-rise gate while rest activity
  stays in the required 1–10% window; this reproduces ADR 010's own stated root cause with direct simulation
  evidence. C2/C3 were not run (blocked on C1, per the stop-at-first-failing-gate rule). Per this feature's
  explicit instruction, calibration is **not** being retried right now — the remaining demo features (below) are
  being completed first, and calibration is restarted afterward, either against a revised grid/LIF block or a
  different brain.

### Null-arm wiring (Part K, for every story's measurement)

- [X] T031 Edit `scripts/forager-arms.mjs`: add a `"v3"` arm running the `v3` decoder + body layer; add a
  `"random-matched-wide-v3"` arm reusing the existing degree-preserving `rewire(snapshot, seed)` (lines 36-48) on
  `forager-brain-wide.brain`, run through the **identical** C2-derived decoder rule and body layer (Principle III,
  constitution VI: "MUST be identical across every arm") to produce its own `decoder-v1` file via T024's C2 logic.
- [X] T032 [P] `tests/forager-arms-v3.test.mjs`: the `"v3"` and `"random-matched-wide-v3"` arms both run against
  the same world and body-layer config object (reference-equal, not just value-equal) — the mechanical check behind
  "the body layer MUST be identical across every arm."

**Checkpoint**: `world-forager-demo.json` loads, runs 6 flies with no console error, and
`public/brains/forager-brain-wide.decoder.json` exists from a real calibration run. Every user story below is now
observable.

**Status (2026-10-17): not yet reached.** T030's C1 regime check fails on the real `forager-brain-wide.brain`
snapshot (see `calibration.md`), so the decoder file does not exist and no story is end-to-end observable in the
running app yet. Per this feature's explicit instruction, Phases 3-10's tasks below were still implemented and
unit-tested against synthetic fixtures (decoder/body-layer/metrics/panel/world-generation code all exist and
pass `npm test`); only the tasks that require a real closed-loop run — "run and record" tasks, plus the browser
check — are blocked on T030 and marked accordingly below.

---

## Phase 3: User Story 1 - A Hungry Fly Finds Food and a Sated Fly Does Not (Priority: P1) 🎯 MVP

**Goal**: R1 — hunger-gated food-finding and feeding, measurably better than the random walk.

**Independent Test**: quickstart.md steps 1–4 on `world-forager-demo.json`; SC-001/SC-002.

- [X] T033 [P] [US1] Wire D30 feeding (`r(feed) − rest(feed) ≥ feedThreshold` while standing on food) into the
  `v3` step in `public/js/fly/body-layer.js`, reusing the existing `canEat`/`eat` helpers from
  `public/js/fly/energy.js` unchanged — **constraint (D30)**: "There is no hunger override. Hunger acts only
  through the brain's input" (D32), never a second gate on the feeding decision itself.
- [X] T034 [US1] In `scripts/forager-arms.mjs`, implement the K1–K3 metrics: find-rate 95% CI (hungry vs. sated,
  per SC-001), fraction of arrivals that feed within 50 ticks (SC-002), reported per arm (B/RW/RG).
- [X] T035 [US1] `tests/forager-step-v3.test.mjs` (extend T022's file): a food source on the fly's left makes the
  decoded `side_food` positive and the fly turns left (Acceptance Scenario 4, a placed-source unit test).
- [ ] T036 [US1] Run quickstart.md steps 3–4 for R1 on held-out seeds; record SC-001/SC-002 numbers (both arms, B
  vs. RW CI comparison) in `specs/017-demo-forager/results.md`. **Blocked on T030** (no `decoder-v1` file exists).

**Checkpoint**: Story 1 is independently demoable — a hungry fly visibly finds and eats food; a sated one does not.

---

## Phase 4: User Story 2 - A Fly Reacts to Danger and Escapes It (Priority: P1)

**Goal**: R2 — reliable escape/avoidance on the very first encounter.

**Independent Test**: quickstart.md step 4, danger-ring encounters; SC-003/SC-004.

- [X] T037 [P] [US2] In `scripts/forager-arms.mjs`, implement the K4 metric (escape or turn-away within 20 ticks
  per danger-ring encounter, per-encounter not per-tick) and K5 (total ticks inside danger rings, B vs. RW).
- [X] T038 [US2] `tests/body-layer.test.mjs` (extend T015's file): the no-`drive.odour-danger`-pool fallback
  (alarm falls back to the named escape pool + `drive.heat`) still triggers an escape, per the Edge Case and ADR
  010 Part L's documented fallback.
- [ ] T039 [US2] Run quickstart.md step 4 for R2 on held-out seeds; record SC-003/SC-004 in
  `specs/017-demo-forager/results.md`. **Blocked on T030** (no `decoder-v1` file exists).

**Checkpoint**: Story 2 is independently demoable — a fly reliably escapes danger on first contact.

---

## Phase 5: User Story 3 - A Fly Avoids Heat (Priority: P2)

**Goal**: R3 — less time in heat rings than the random walk (SHOULD).

**Independent Test**: quickstart.md step 4, heat rings; SC-005.

- [X] T040 [US3] In `scripts/forager-arms.mjs`, implement the K6 metric (ticks inside heat rings, B vs. RW).
- [ ] T041 [US3] Run quickstart.md step 4 for R3 on held-out seeds; record SC-005 in
  `specs/017-demo-forager/results.md`. If it fails (SHOULD, not MUST), record it as a finding per AGENTS.md — do
  not hand-tune to force a pass. **Blocked on T030** (no `decoder-v1` file exists).

**Checkpoint**: Story 3's heat-avoidance number is measured and recorded, pass or fail.

---

## Phase 6: User Story 4 - One Calibration Works on a Second Map (Priority: P2)

**Goal**: R5 — the same calibration (no `calibrate.mjs` re-run) holds on a structurally different map.

**Independent Test**: quickstart.md step 5; SC-006.

- [X] T042 [US4] `public/tests/world-tilemap-demo.test.js`: `world-forager-demo-tilemap.json` (T004/T029-equivalent
  for the second map) validates and generates a world distinct in structure from the sketch map, following the
  existing `ground.test.js`/`water.test.js`/`scatter.test.js` conventions.
- [ ] T043 [US4] Run quickstart.md step 5 (K1–K6/K8) on `world-forager-demo-tilemap.json` using the **same**
  `forager-brain-wide.decoder.json` produced in T030 — no recalibration. Record SC-006 in
  `specs/017-demo-forager/results.md`, explicitly noting no `calibrate.mjs` invocation occurred between the two
  maps' runs. **Blocked on T030** (no `decoder-v1` file exists).

**Checkpoint**: R1–R3's gates hold on both maps from one calibration.

---

## Phase 7: User Story 5 - The Panel Shows the Decoded Readout, Not a Hidden Script (Priority: P2)

**Goal**: D31 — per-sense side/drive/trend/valence/pool-size, visibly labelled as decoded, not learned.

**Independent Test**: quickstart.md step 3 (panel open while a fly runs); SC-008.

- [X] T044 [P] [US5] Create `public/js/ui/panel/sections/decoder.js`: a new section (`requires: { signal:
  'decoder' }` or equivalent per `public/js/ui/panel/registry.js`'s `isRequirementMet` convention) rendering, per
  declared sense, side (or "absent" when no side pool exists — not a fabricated value, per Acceptance Scenario 2),
  drive, trend, declared valence and pool size, labelled "decoded readout."
- [X] T045 [US5] Register the new section in `public/js/ui/panel/sections/index.js`'s `SECTIONS` array (the only
  file that needs editing to add a section, per its own header comment).
- [X] T046 [P] [US5] `tests/panel-decoder-section.test.mjs`: the section renders all five fields per sense, updates
  every tick, and shows "absent" rather than `0` for a sense with no side pool.
- [ ] T047 [US5] Browser run check (constitution): open `world-forager-demo.json` from the static server, open the
  panel for a running fly, visually confirm the decoder section renders with no console errors (BUG-003's lesson —
  a passing unit test on the data is not the same as a visible render). **Not done**: `world-forager-demo.json`
  cannot start a fly yet (no `decoder-v1` file — blocked on T030), and this session has no browser-automation tool
  available to drive a real page load. All touched modules pass `node --check`, and the full suite (including the
  panel wiring tests above) passes; a human should still do this check once a `decoder-v1` file exists.

**Checkpoint**: A visitor can see, per sense, that steering is a declared/decoded readout, not a script.

---

## Phase 8: User Story 6 - Calibration Finishes in One Command, Under 30 Minutes (Priority: P3)

**Goal**: R4 — one command, a hard time budget, clear per-stage pass/fail.

**Independent Test**: quickstart.md step 1; SC-007.

- [X] T048 [US6] `tests/calibrate-stage-all.test.mjs`: with a forced C1 (or C2) gate failure, `--stage=all` stops at
  that stage, prints the gate and the failing numbers, and does **not** run the later stage(s) (Story 6 Acceptance
  Scenario 2 / spec FR-018). Implemented against `decoder-engine.mjs`'s new `runC1ThenC2` (a pure extraction of
  the same stop-at-first-failure contract calibrate.mjs's CLI dispatch implements), not a CLI subprocess — this
  session has no real-world/snapshot fixture cheap enough to spawn the actual CLI against.
- [ ] T049 [US6] Record T030's measured wall-clock time as SC-007/K7 in `specs/017-demo-forager/results.md`,
  confirming it is ≤ 30 minutes. **Blocked on T030** (C1 run so far took 2 min 36 s on the shipped grid before the
  widened search; the widened search itself was exploratory, not the timed `--stage=all` run SC-007 asks for).

**Checkpoint**: The calibration command's time budget and stop-on-failure behaviour are both verified, not just
assumed from T030's one successful run.

---

## Phase 9: User Story 7 - Behaviour Holds Up From the First Tick, Without a Separate Balance Pass (Priority: P3)

**Goal**: R6 (MAY) — online homeostasis removes the need for a hand-tuned per-pool balance pass.

**Independent Test**: quickstart.md step 3 at tick 0, plus a longer run; SC-009.

- [X] T050 [US7] Extend `tests/homeostasis.test.mjs` (T011) with Story 7's two acceptance scenarios explicitly: (1)
  a freshly started fly with no stimulus shows no persistent L/R turn bias at tick 0; (2) a quiet pool's
  `rest`/`balance` keep updating over a long run while an active one's freeze during the stimulus, verifying drift
  tracking without a new calibration pass.
- [X] T051 [US7] Record SC-009 in `specs/017-demo-forager/results.md` — no separate per-pool balance calibration
  step exists in the implementation (verified by inspection: `decoder-engine.mjs` has no such stage beyond C2's
  one-time seeding).

**Checkpoint**: R6 (MAY) is satisfied by online homeostasis alone; D34 remains explicitly out of scope (spec
Assumptions).

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the constitution's pending follow-on, and the final Part K report.

- [X] T052 [P] Update `public/world/README.md`'s "Choosing the brain" table with the `v3` row (snapshot kind,
  LIF, protocol — matching the existing `mock`/`v0`/`v1`/`v2` rows) and a short note on `flies.brain.decoder`.
- [X] T053 [P] Update `AGENTS.md` hard rule 6 to ADR 010 Part A's follow-on text: "Direction, strength, feeding and
  escape come from the brain. The body layer may walk, explore and apply declared reflex laws to decoded signals;
  it never reads the stimulus." Also add: "A decoder rule is applied identically to null-arm brains." This closes
  the "Next Action" the constitution's Sync Impact Report left open at v2.0.0.
- [ ] T054 Compile the final Part K acceptance report from `specs/017-demo-forager/results.md`'s rows into a
  single pass/fail table for R1–R5, explicitly stating any case where the `"random-matched-wide-v3"` arm (RG) also
  passed a gate (K9, FR-024) — reported alongside, not hidden. **Blocked on T030/T036/T039/T041/T043/T049**: only
  R6 (SC-009) is measured so far (results.md); R1–R5 have no numbers to compile until a `decoder-v1` file exists.
- [X] T055 Run `npm test`, `npm run test:slow`, and confirm the app starts with `python3 -m http.server 8000` and
  runs `world-forager-demo.json` with no console errors (AGENTS.md "Before calling a feature done"). Fix any
  regression before considering the feature complete.
  **Status (2026-10-17):** `npm test` passes (650 pass; the only 6 failures, in `tests/activity.test.mjs`, are
  pre-existing and untouched by this feature). `npm run test:slow` passes (its 2 tests are pre-existing `todo`
  failures tracked as BUG-002/T112, unrelated). The app's JS module graph has no syntax errors (`node --check` on
  every touched file). **Not done**: an actual browser load of `world-forager-demo.json` — it cannot start a fly
  yet (no `decoder-v1` file, blocked on T030), and this session has no browser-automation tool available. A human
  should run the static-server check once a `decoder-v1` file exists.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS every user story** — T030 (the real calibration run) in
  particular is a hard gate: no story's acceptance numbers (T036, T039, T041, T043, T049, T051) can be measured
  before it exists.
- **User Stories (Phases 3–9)**: All depend on Foundational completion. Among themselves: US1–US3 and US6–US7 can
  proceed in parallel once Foundational is done (they measure different things against the same running system);
  US4 additionally depends on T004/T029's second map (Foundational) and reuses T030's calibration artifact
  unchanged by construction; US5 (panel) only depends on T009/T010's decoder signals existing, not on any
  particular calibration quality.
- **Polish (Phase 10)**: Depends on all desired stories; T054 specifically depends on every story's results.md rows
  being filled in.

### Within Foundational (Phase 2)

Strict order within each subsection (same file, building up): T005→T006; T007→T008→T009→T010→T011; T012→T013→T014→
T015; T016→T017; T018→T019→T020→T021→T022; T023→T024→T025→T026→T027→T028→T029→T030; T031→T032. The subsections
themselves are mostly parallelizable (different files): LIF core, decoder, body layer, hunger threshold, and
world-config-v3 can all start together; the calibration pipeline (T023–T030) depends on the decoder (T007–T011),
body layer (T012–T015) and world-config-v3 (T018–T022) all being done first, since C1–C3 exercise the real `v3`
step.

### Parallel Opportunities

- Setup: T001–T004 all parallel.
- Foundational: T006, T011, T015, T017, T018, T022, T025, T032 (test tasks in separate files) are each parallel
  with sibling implementation tasks once their corresponding implementation task lands; across subsections, the
  five Foundational subsections (LIF, decoder, body layer, hunger threshold, world-config-v3) can be staffed in
  parallel before the calibration pipeline subsection begins.
- User stories: US1, US2, US3, US6, US7 can be staffed in parallel after the Foundational checkpoint; US4 and US5
  likewise, though US4's T043 is only meaningful after T030.
- Polish: T052, T053 are parallel with each other and with T054.

---

## Parallel Example: Foundational Phase

```bash
# Once Setup is done, these five subsections' first tasks can start together:
Task: "T005 Add baselineCurrent to public/js/brain/lif-v1.js"
Task: "T007 Contract test tests/decoder.test.mjs for the decoder-v1 reader rules"
Task: "T012 Create public/js/fly/body-layer.js, implement W12"
Task: "T016 Edit public/js/brain/fly-brain-v1.js's modulator-gain computation for D32"
Task: "T018 Contract test tests/world-config-v3.test.mjs (validator side)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — this is the bulk of the work and is not optional; R1
   cannot be demoed without the decoder, body layer, hunger threshold and one real calibration run.
2. Complete Phase 3 (US1: hungry fly finds food).
3. **STOP and VALIDATE**: quickstart.md steps 1–4 for R1 only. This is already a meaningful demo.

### Incremental Delivery

1. Setup + Foundational → the mechanism exists and `world-forager-demo.json` runs.
2. US1 (R1) → demoable: hungry fly finds food.
3. US2 (R2) → demoable: fly escapes danger. (US1 and US2 are both P1 — deliver together if staffed for it.)
4. US3, US4, US5 (P2) → heat avoidance, second map, decoder panel.
5. US6, US7 (P3) → calibration time budget verified, homeostasis verified.
6. Polish → README/AGENTS.md updates, the compiled Part K report, final regression pass.

### Parallel Team Strategy

After the Foundational checkpoint (which itself benefits from splitting across its five subsections), US1/US2
(both P1) go to the team's strongest pair first; US3/US6/US7 are each small enough for one person; US4 and US5 are
independent of each other and of US1–US3's measured numbers.

---

## Notes

- Every `[Story]`-labelled task maps to spec.md's Story 1–7. Foundational tasks carry no story label, per the
  Checklist Format rules — they are prerequisites for all of them.
- T030 (the real calibration run) is the single most important dependency in this plan: nothing past it can be
  honestly measured without it, and if it fails a gate, that failure is itself the finding to record (AGENTS.md),
  not an obstacle to code around.
- Commit after each task or logical group, per the project's own commit convention (`(fea) …` prefix on this
  branch's commits).
