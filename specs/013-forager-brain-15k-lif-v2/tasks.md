---

description: "Task list for the Cautious Forager Brain (15K, LIF v2) feature"
---

# Tasks: Cautious Forager Brain (15K, LIF v2)

**Input**: Design documents from `/specs/013-forager-brain-15k-lif-v2/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included. The constitution (`.specify/memory/constitution.md`, Development Workflow & Quality Gates)
and `AGENTS.md` both make tests mandatory for this project (LIF core unit tests, extractor tests on a fixture,
contract tests on both sides of any format/protocol change) — this is not the optional default.

**Organization**: Tasks are grouped by user story (spec.md's priorities P1–P3). Because every user story in this
feature observes behaviour of **one** brain (the ADR 006 15K brain) running in **one** world, the extraction
pipeline, the LIF/runner/protocol plumbing, and the declared-sense/world-config machinery are genuinely blocking
prerequisites for all nine stories, not optional shared infrastructure — they live in Phase 2 (Foundational). Each
user-story phase then adds only the behaviour, metric and test work specific to that story, on top of a world that
already loads and runs the brain.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to spec.md's user stories (US1–US9)
- Every task names its exact file path

## Path Conventions

Single project, per `AGENTS.md`'s layout: `extract/` (Python) and `public/` (browser) at the repository root,
`tests/` (JS, Node test runner) and `extract/tests/` (Python `unittest`) for tests, `scripts/` for the experiment
harness. No new top-level directory is introduced (plan.md's Structure Decision).

---

## Phase 1: Setup

**Purpose**: the config file, synthetic fixture and manifest entry every later phase reads from or writes into.

- [X] T001 Create `extract/configs/forager-brain-15k.json` (extraction config `formatVersion: 4`, `kind:
  "forager"`) with every key `contracts/extract-config-forager-v2.md`'s schema table requires: 12 `inputs`
  (D8), `sideMatch` flags, 6 `outputs` incl. `escape` (D9), `pathways` (6 names), `outputGroups` (5 names incl.
  `escape`), `budget.perPair: 2400`, `anchors: [{"class": "ALLN"}]`, `excludeInterneuronClasses` (the D12 list),
  `excludeInterneuronSuperclassSuffix: "_sensory"`, `transmitterSource: ["ground_truth", "consensus_nt",
  "predicted_nt"]`, `weightRule: "synapseCount"`, `minSynapses: 1`, `neuronCountRange: [12000, 18000]`, using
  `extract/configs/forager-brain.json` as the structural template for the 6 unchanged top-level keys
  (`datasetRelease`, `edgeVariant`, `expect`, `transmitterSign`, `minConfidence`, `modulators`).
- [X] T002 [P] Create the labelled synthetic fixture `extract/tests/fixtures/forager-15k-synthetic.json`: a small,
  hand-built dataset exercising all six input pools, at least two `(pathway, outputGroup)` pairs, one anchor class,
  one body that would overlap two pools (for `E-POOL-OVERLAP`), one empty anchor case, one pair with no positive
  candidate (for `E-PAIR-EMPTY`), and rows under each of `ground_truth`/`consensus_nt`/`predicted_nt`, following
  `extract/tests/fixtures/forager-synthetic.json`'s shape and `make_forager_fixture.py`'s builder pattern.
- [X] T003 [P] Add the 15K brain's entry to `public/brains/brains.json` (`{"file": "forager-brain-15k.brain",
  "label": "Cautious forager brain (ADR 006, 15K, v2)"}`), keeping manifest `"version": 1` unchanged.

**Checkpoint**: config, fixture and manifest entry exist; nothing runs yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: everything that must exist before any user story is observable — the extraction pipeline that
produces a real container-v5 snapshot, the LIF/runner/protocol/worker plumbing that loads and runs it, and the
declared-sense/body-site/escape machinery the world needs to drive it.

**⚠️ CRITICAL**: no user-story phase can be independently tested until this phase's snapshot (T023) and world
(T048) exist.

### Extraction pipeline (format 4 → container v5)

- [X] T004 Extend `extract/malecns_brain/dataset.py`: add `ground_truth`, `consensus_nt` to
  `NEUROTRANSMITTER_COLUMNS`, and `entryNerve` to `FORAGER_ANNOTATION_COLUMNS` (D8's `taste-leg`/`touch` pools),
  column-selected only — `stream_edges`'s batched, filtered-to-admitted-ids pattern is otherwise unchanged
  (Principle IV: never load a large file whole).
- [X] T005 Add `resolve_transmitter_sign(row, source_order, sign_table, min_confidence)` to
  `extract/malecns_brain/admission.py`: walk `transmitterSource` in order; return the first column that names a
  transmitter in `sign_table`, plus that column's name. `predicted_nt` keeps its existing `minConfidence` test;
  `ground_truth`/`consensus_nt` carry no confidence test (ADR 006 D10). The existing `predicted_nt`-only path used
  by format 3 stays untouched. Record the winning column per neuron as `transmitterSource` (Principle III
  traceability).
- [X] T006 Add four failure codes to `extract/malecns_brain/errors.py`: `E-POOL-OVERLAP` ("a body matches two
  input or output pools"), `E-ANCHOR-EMPTY` ("an anchor matches no admitted body"), `E-TRANSMITTER-SOURCE`
  ("transmitterSource names a column that is absent, or is empty"), `E-PAIR-EMPTY` ("a (pathway, output group)
  pair has no candidate with a positive score") — same `ExtractError(code, message)` shape as every existing code.
- [X] T007 Extend `extract/malecns_brain/config.py`: add `FORAGER_KEYS_V2` (the schema table in
  `contracts/extract-config-forager-v2.md`) and a `format_of` branch for `formatVersion == 4 and kind ==
  "forager"`; validate every `transmitterSource` entry names a column `dataset.py` provides, raising
  `E-TRANSMITTER-SOURCE` naming the config's value otherwise; validate `budget.perPair` is a positive integer,
  `anchors`/`excludeInterneuronClasses` may be empty lists, `weightRule` is one of `"synapseCount"`,
  `"postFraction"`, `"postFractionAbsolute"`.
- [X] T008 Create `extract/malecns_brain/selection_forager_v2.py` with pool resolution for D8's 12 input channels:
  for each of the 6 side-matched pairs (`odour-food`, `odour-danger`, `heat`, `touch`) truncate to
  `min(|L|, |R|)` as `resolve_pools` already does for format 3; for the 2 unmatched pairs (`taste-mouth`,
  `taste-leg`) admit each side independently. Raise `E-POOL-OVERLAP` when a body matches two declared pools (input
  or output) and `E-POOL-EMPTY`/`E-SIDE-IMBALANCE` by the existing format-3 rules otherwise.
- [X] T009 Extend `extract/malecns_brain/selection_forager_v2.py` with D9's 6 output pools (`turn-left`,
  `turn-right`, `forward`, `backward`, `feed`, `escape`), admitted by the existing ADR 003 output rule (incoming
  edges only, `sign = 0` allowed).
- [X] T010 Extend `extract/malecns_brain/selection_forager_v2.py` with D11's pair-grid selection: for every
  `(pathway, outputGroup)` pair in the config, compute `score_{p,o}(i) = sqrt(F_p(i) * B_o(i))` over `flowSteps`
  hops, take `top_k(score)` with `k = budget.perPair`, ties on ascending `bodyId`; raise `E-PAIR-EMPTY` for any
  pair with no candidate above a positive score; union every pair's selection.
- [X] T011 Extend `extract/malecns_brain/selection_forager_v2.py` with D12: add every body matching an `anchors`
  filter regardless of score (raise `E-ANCHOR-EMPTY` if a filter matches nothing), then remove every body whose
  `class` is in `excludeInterneuronClasses` or whose `superclass` ends with `excludeInterneuronSuperclassSuffix`.
- [X] T012 Extend `extract/malecns_brain/selection_forager_v2.py` with D13 (`weight(i→j) = sign(i) *
  synapses(i→j)` when `weightRule == "synapseCount"`, edges below `minSynapses` dropped before weights are
  computed) and L10's per-neuron `region` field, written by the first-match rule: `input` (pool member) → `output`
  (pool member) → `al` (`class ∈ {ALLN, ALPN, ALIN, ALON}`) → `vnc` (`superclass ∈ {vnc_intrinsic, vnc_motor,
  vnc_efferent, ascending_neuron}`) → `dn` (`superclass = descending_neuron`) → `central` (everything else). Order
  neurons input → output → interneuron-by-`bodyId`, as every existing container does.
- [X] T013 Extend `extract/malecns_brain/container.py`: `FORMAT_VERSION_V5 = 5`, `SUPPORTED_VERSIONS = (3, 4, 5)`,
  and `_check_forager_v2` asserting every rule in `contracts/container-v5.md`'s `_check_forager_v2` section
  verbatim: "every input channel declares a non-empty `sense` and `site`", "every output channel's `drive` is one
  of the 6-value vocabulary, and `escape` appears exactly once", "every neuron's `group` is one of the 6 named
  regions", "every neuron's `transmitterSource` is one of the 3 named columns", "`weightRule` is one of the 3
  accepted values". CSR array layout and its existing invariants are unchanged.
- [X] T014 Extend `extract/malecns_brain/capabilities.py`: add `FORAGER_DRIVES_V2 = ("turnLeft", "turnRight",
  "forward", "backward", "feed", "escape")` and `validate_capabilities_v5` implementing R1–R8 (unchanged meaning,
  now checked against `FORAGER_DRIVES_V2`) plus R9 ("every input channel's `sense` is a non-empty string naming
  one of the six declared senses"), R10 ("every input channel's `site` is a non-empty string naming one of the
  declared body sites"), R11 ("exactly one output channel declares `drive: \"escape\"`; zero or more than one
  fails validation naming the count found") — `validate_capabilities_v4`/`FORAGER_DRIVES` (5-tuple) stay
  untouched.
- [X] T015 Extend `extract/malecns_brain/__main__.py`: dispatch `extract_forager_v2` (built from T008–T012) when
  `format_of(config) == 4`; `report_forager_v2` prints pool counts/side balance, per-`(pathway, outputGroup)` pair
  budget fill, admission-source counts per `transmitterSource` column, each output's real-input coverage, and the
  self-check result.

### Extraction tests (contract tests, Python side)

- [X] T016 [P] `extract/tests/test_config_forager_v2.py`: `formatVersion: 4` dispatch, every schema key's shape,
  `E-TRANSMITTER-SOURCE` and `E-CONFIG` messages, against T002's fixture and mutated copies of T001's config.
- [X] T017 [P] `extract/tests/test_forager_v2_failures.py`: one test per new code (`E-POOL-OVERLAP`,
  `E-ANCHOR-EMPTY`, `E-TRANSMITTER-SOURCE`, `E-PAIR-EMPTY`) and every reused code, each mutating a copy of
  `forager-15k-synthetic.json`, plus a "failure writes no file" test (`extract/tests/test_forager_failures.py`'s
  existing pattern).
- [X] T018 [P] `extract/tests/test_selection_forager_v2.py`: D8 pool resolution and side-match, D11's pair-grid
  scoring and per-pair budget, D12's anchor/exclusion union, D13's `synapseCount` weights and `minSynapses`
  threshold, and the `region` field's first-match rule, against T002's fixture.
- [X] T019 [P] `extract/tests/test_container_v5.py`: write/read round-trip of a v5 container; one test per
  `_check_forager_v2` invariant in T013 (each must fail when violated).
- [X] T020 [P] `extract/tests/test_capabilities_v5.py`: one test per R9–R11 and a regression test that
  `validate_capabilities_v4` still rejects `escape` and still requires exactly 5 drives.
- [X] T021 [P] `extract/tests/test_forager_v2_determinism.py`: two runs of the same config and dataset give
  byte-identical files apart from `provenance.createdAt`.
- [X] T022 `extract/tests/bench_forager_v2.py`: Gate A peak-memory and wall-time measurement on the full dataset
  run (ADR 006 Annex A3's ~10 s / 2.7 GB prototype figures are the comparison baseline, not the pass/fail bar —
  the shipping extractor's own number is what gets recorded).
- [X] T023 Run the real extraction: `cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain
  extract --config configs/forager-brain-15k.json --out ../public/brains/forager-brain-15k.brain`. Confirm the
  report's neuron count is within `[12000, 18000]`, every output is reached, every declared side-matched pool is
  balanced, and the self-check reads `identical`. Commit the resulting `.brain` file.

### LIF core, runner, protocol, worker (JS)

- [X] T024 Extend `public/js/brain/lif-v1.js` per `contracts/lif-v1-groupgain.md`: add `groupGain: {}` to
  `LIF_V1_DEFAULTS`; `resolveParams` rejects a `groupGain` value that is "not a plain object, or any of its values
  not finite and ≥ 0"; `createNetwork` resolves `groupScaleOf` once from an optional `graph.neuronGroup`
  (`groupScaleOf[i] = groupGain[graph.neuronGroup[i]] ?? 1`, defaulting to `1` when `graph.neuronGroup` is
  absent); `step()`'s edge-delivery line becomes `weights[k] * (outputOverride[target] ? outputScaleOf[target] :
  groupScaleOf[target] * p.synapticScale)`.
- [X] T025 [P] `tests/lif-v1-groupgain.test.mjs`: G16 (no-op with `groupGain: {}` or `graph.neuronGroup` absent,
  identical to pre-amendment `lif-v1.js`), G17 (only edges into a listed group are scaled), G18 (rejects a
  negative/non-numeric/non-object `groupGain` before any network is built).
- [X] T026 Append the G16 no-op assertion to `tests/lif-v1.test.mjs`'s existing G1-style guarantees (must pass
  before any task below depends on `groupGain`).
- [X] T027 Create `public/js/brain/fly-brain-v2.js`: Poisson input encoding (L9) — `p = r0 + (r1 - r0) *
  clamp(gain_c(h) * value_c, 0, 1)`, one Bernoulli draw per input neuron per step from its own `createPrng(seed)`
  stream (tagged distinctly from `lif-v1.js`'s jitter/noise streams); the `stepsPerTick` loop over `lif-v1.js`
  with `graph.neuronGroup` populated from the snapshot's per-neuron `group` field; EMA output-rate tracking
  generalised to 6 declared output channels (adds `escape` to the existing 5-channel tracking `fly-brain-v1.js`
  uses).
- [X] T028 [P] `tests/fly-brain-v2.test.mjs`: L9 rate mapping (`value = 0` fires at `r0`, `value = 1` at `r1`),
  reproducibility (same seed ⇒ same Bernoulli draws), and stream independence (the input-encoding stream's draws
  are unaffected by `thresholdJitter`/`noiseAmplitude` settings and vice versa).
- [X] T029 Extend `public/js/brain/fly-brain.js`'s dispatcher with `if (version === 'v2') return
  createV2FlyBrain(brainConfig, seed)`, importing from `fly-brain-v2.js` (T027).
- [X] T030 Extend `public/js/brain/snapshot.js`: `FORMAT_VERSIONS` gains `5`; `checkBrainVersion`'s map becomes
  `{v0: 3, v1: 4, v2: 5}`; `parseSnapshot` gains a `version === 5` branch calling `checkForagerV2` (the
  `group`/`transmitterSource`/`sense`/`site`/`escape` checks from `contracts/container-v5.md`) and
  `validateCapabilitiesV5`. CSR/section parsing code is shared with v3/v4, unchanged.
- [X] T031 [P] `tests/snapshot-v5.test.mjs`: parse a v5 fixture, `checkBrainVersion`'s `v2: 5` mapping, the new
  branch's checks, and that v3/v4 parsing is unaffected.
- [X] T032 Extend `public/js/brain/capabilities.js` with `validateCapabilitiesV5` (JS mirror of T014's R9–R11;
  `validateCapabilitiesV4` untouched).
- [X] T033 [P] `tests/capabilities-v5.test.mjs`: JS mirror of T020.
- [X] T034 Fix `public/js/brain/worker-core.js`'s `handleV1`: replace the hard-coded `version: 'v1'` passed into
  `createFlyBrain` with `msg.brain.version`, and replace the local `msg.brain.snapshot?.version !== 4` check with
  a lookup against `snapshot.js`'s `checkBrainVersion` map for whatever `msg.brain.version` actually is (per
  research.md R7 — this is a pre-existing defect, not new protocol surface; protocol v3's wire format is
  unchanged).
- [X] T035 [P] `tests/worker-core-v2.test.mjs`: a protocol-v3 message with `brain.version: 'v2'` and a container-v5
  snapshot round-trips correctly; a regression case confirms a `brain.version: 'v1'` message with a container-v4
  snapshot still resolves to the v1 brain exactly as before T034.

### World, body and declared senses (JS)

- [X] T036 Add `resolveDeclaredStimulus(sense, site, fliesStimuli, bodySites)` to `public/js/fly/stimulus.js`:
  looks up `fliesStimuli[sense]`'s source objects, `kinds`/`radius` filter and falloff shape, and `bodySites`'s
  offset for `site`, reusing the existing `falloff()` unchanged. `senseBilateral`/`senseAt` (v0/v1) are untouched.
- [X] T037 Add `resolveBodySites(flyBodyConfig)` to `public/js/fly/body.js`: resolves `antenna`/`mouth`/
  `front-leg` sample points from `flies.body.sites` offsets (W7 — front-leg additionally offset laterally per
  side). `stepForagerBody` is untouched.
- [X] T038 Add `jumpForagerBody(fly, distance, world)` to `public/js/fly/body.js`: moves the fly `distance` tiles
  along its current heading in one tick, stopping at the first non-walkable cell (reusing the same walkability
  check existing moves use), per W8.
- [X] T039 Add `senseForagerFlyV2(fly, env)` to `public/js/fly/forager-step.js`: loops over the snapshot's
  declared input channels (each with a `sense`/`site`), calling `resolveDeclaredStimulus` (T036) per channel to
  build the 12-value input vector generically — no positional constant, unlike the unchanged `senseForagerFly`.
- [X] T040 Extend `applyForagerMotor` in `public/js/fly/forager-step.js` with an escape branch: when
  `drives.escape` is above `flies.body.escape.threshold` and the fly's `escapeCooldownTicks` is `0`, call
  `jumpForagerBody(fly, flies.body.escape.distance, world)` (T038) and set `escapeCooldownTicks` from
  `flies.body.escape.cooldown`; otherwise decrement `escapeCooldownTicks` toward `0`.
- [X] T041 Extend `public/js/world/validate.js`: `BRAIN_VERSIONS` gains `'v2'` (error message lists all four);
  validate `flies.stimuli` (every snapshot-declared `sense` with no matching key is a named error — FR-021);
  validate `flies.body.sites` (each site a finite offset) and `flies.body.escape` (`threshold`/`distance`/
  `cooldown` each "a positive number"); validate `brain.input.encoding` is `"current"` or `"poisson"`, and
  `"poisson"` requires `rate` (`[r0, r1]`, `0 ≤ r0 ≤ r1 ≤ 1`) and `weight` (a positive number); gate a `v2` brain's
  `lif` keys against `LIF_V1_DEFAULTS`, exactly as `v1` already is.
- [X] T042 Extend `public/js/fly/fly-config.js`: merge defaults for `body.sites`, `body.escape`, `stimuli`,
  `brain.input` only when a world declares them (no change to `resolveBrainVersion` or to any `mock`/`v0`/`v1`
  default).
- [X] T043 Extend `public/js/fly/fly-world.js` to read `flies.stimuli`'s source declarations (both `edibles` and
  `dangers`) into the per-tick stimulus lookup table, alongside the existing flower-stock table.
- [X] T044 Extend `public/js/fly/fly-host.js`: dispatch `senseForagerFlyV2` (T039) and protocol-v3 for
  `brain.version === 'v2'` (reusing the existing generic-by-declared-length sense/motor path); hold
  `escapeCooldownTicks` per fly; write a per-tick `escaped: boolean` telemetry flag for the panel (US8).
- [X] T045 [P] `tests/stimulus-declared.test.mjs`: `resolveDeclaredStimulus` resolves every one of the six senses
  correctly from a test `flies.stimuli`/`flies.body.sites`; a snapshot channel naming an undeclared sense fails
  world start-up with a named error (not a silent zero).
- [X] T046 [P] `tests/body-escape.test.mjs`: `jumpForagerBody` moves the configured `distance`, stops at the first
  non-walkable cell, and `applyForagerMotor`'s cooldown gate suppresses a second jump until `cooldown` elapses.
- [X] T047 [P] `tests/fly-config-brain-v2.test.mjs`: `resolveBrainVersion` is unaffected by this feature; `v2`
  defaults merge correctly; a `v2`/non-v5-snapshot mismatch is refused, naming both versions.
- [X] T048 Create `public/world/world-forager-15k.json`: `flies.brain.version: "v2"`, `snapshot:
  "brains/forager-brain-15k.brain"`, `brain.input` (L9 encoding config), `flies.stimuli` (all six senses mapped
  onto the existing `edibles`/`dangers` world objects per `contracts/world-config-forager-v2.md`'s example),
  `flies.body.sites` (antenna/mouth/front-leg offsets), `flies.body.escape` (threshold/distance/cooldown).
- [X] T049 [P] Create `public/world/world-forager-15k-bad.json`: a copy of T048 with `flies.brain.version: "v2"`
  pointed at `forager-brain.brain` (container v4, not v5) — the test fixture for T047/T066's mismatch-refusal
  check.

**Checkpoint**: `forager-brain-15k.brain` exists and loads; `world-forager-15k.json` starts a `v2` fly that senses,
drives and can jump. Every user-story phase below builds on this.

---

## Phase 3: User Story 1 - A Cautious Fly Finds Food With Six Senses (Priority: P1)

**Goal**: a hungry `v2` fly turns toward and approaches food odour at least as reliably as the `v1` brain did, and
its leg-taste/touch channels go nonzero before its mouth-taste channel does as it nears a flower.

**Independent Test**: seeded run comparing the `v2` and `v1` food-finding rate on held-out seeds; a second seeded
run confirming leg-taste/touch precede mouth-taste.

### Tests for User Story 1

- [ ] T050 [P] [US1] Integration test in `tests/forager-v2-find.test.mjs`: as a `v2` fly's leading front leg
  reaches a flower's cell before its mouth does, leg-taste and touch channels read nonzero while mouth-taste
  still reads 0 (spec Acceptance Scenario 2).
- [ ] T051 [P] [US1] Integration test in `tests/forager-v2-find.test.mjs`: on the same held-out seeds, the `v2`
  brain's food-finding rate is not worse than the `v1` brain's (spec Acceptance Scenario 3, SC-001's find/approach
  carry-over).

### Implementation for User Story 1

- [ ] T052 [US1] Confirm `public/js/fly/metrics.js`'s existing `find`/`approach` functions make no `v1`-specific
  assumption (five fixed channels, a specific channel index) that would misread a `v2` fly's 12-channel
  declaration; adjust only if one is found (they are declared-channel-generic today per the plan's survey).
- [ ] T053 [US1] Calibrate `world/world-forager-15k.json`'s `flies.stimuli.odour:food` falloff/radius and
  `flies.body.sites.front-leg` offset (T048) so a fly's front leg reaches a flower's cell noticeably before its
  mouth does; record the chosen values in `specs/013-forager-brain-15k-lif-v2/calibration.md` (new file, T057
  creates it; append this entry to it).

**Checkpoint**: User Story 1 is independently testable — a `v2` world finds food at least as well as `v1`, with
leg-leading sensing visible.

---

## Phase 4: User Story 2 - The Fly Brakes and Eats on a Flower (Priority: P1)

**Goal**: mouth taste lowers a `v2` fly's forward drive and raises its feed drive, so it slows, stops and eats —
the capability the `v1` brain measurably lacked.

**Independent Test**: on held-out seeds, the median forward-drive ratio (on flower ÷ off flower) is below 1 and
lower than the size-matched random-graph arm's, and the fly eats.

### Tests for User Story 2

- [ ] T054 [P] [US2] Add `brakeMetric(ticks)` to `public/js/fly/metrics.js`: median `forward` drive with mouth
  taste present ÷ median `forward` drive off any flower, hungry flies only (data-model.md's Metric records table).
- [ ] T055 [P] [US2] Unit tests for `brakeMetric` in `tests/metrics-v2.test.mjs` against hand-built tick logs.
- [ ] T056 [US2] Integration test in `tests/forager-v2-brake.test.mjs`: a `v2` fly's forward drive is lower with
  mouth taste present than off a flower, its feed drive is above threshold, and it eats (spec Acceptance Scenario
  1); leg taste on one side does not lower backward/turn-toward-that-side drives below their no-leg-taste values
  (Acceptance Scenario 2).

### Implementation for User Story 2

- [ ] T057 [US2] Create `specs/013-forager-brain-15k-lif-v2/calibration.md` (pattern: `specs/008-hungry-forager-
  brain/calibration.md`) recording the calibration-seed run that confirms SC-007 (brake ratio < 1 and lower than
  the random-graph arm's) before any held-out-seed verdict is taken, per ADR 006's Calibration protocol section
  and the project rule that calibration and held-out seeds never share a seed.

**Checkpoint**: User Stories 1 and 2 both work independently — `v2` finds food and now also brakes and eats on it.

---

## Phase 5: User Story 3 - The Fly Avoids Danger Odour and Heat (Priority: P1)

**Goal**: danger odour and heat reach the same steering/forward outputs food odour does, so a `v2` fly's behaviour
near a spider or lantern changes from what it would be with no such sense — reported with its sign, not required
to beat the random walk.

**Independent Test**: time-near-spider and time-near-lantern, measured and reported against the random walk, with
sign, on held-out seeds.

### Tests for User Story 3

- [ ] T058 [P] [US3] Add `avoidMetric(ticks, dangerKind)` to `public/js/fly/metrics.js`: fraction of ticks within
  1.5 tiles of a danger source of the given kind (spider or lantern), signed against the random-walk arm's value.
- [ ] T059 [P] [US3] Unit tests for `avoidMetric` in `tests/metrics-v2.test.mjs`.
- [ ] T060 [US3] Integration test in `tests/forager-v2-avoid.test.mjs`: a `v2` fly's steering output changes from
  its no-danger-odour/no-heat baseline when danger odour or heat is read (spec Acceptance Scenarios 1–2); both
  danger odour and heat near a fly at once each report their own nonzero channel value (Edge Cases).

### Implementation for User Story 3

- [ ] T061 [US3] No production code beyond T036–T048 (declared-sense resolution already covers `odour:danger` and
  `heat` generically) is expected; if T060 finds a gap (e.g. `flies.stimuli`'s `dangers` source lookup missing a
  kind filter), fix it in `public/js/fly/stimulus.js`/`fly-world.js` and note the gap in research.md.

**Checkpoint**: User Story 3 is independently testable — danger odour and heat measurably change `v2` steering,
reported with sign on held-out seeds.

---

## Phase 6: User Story 4 - The Fly Reacts to Touch and Escapes Danger (Priority: P1)

**Goal**: a blocked front leg turns the fly; a sustained high `escape` output triggers a single cooldown-limited
jump along the fly's heading.

**Independent Test**: a blocked-path seeded run showing a measurable turn-output change; a high-danger seeded run
showing one bounded jump per cooldown window.

### Tests for User Story 4

- [ ] T062 [P] [US4] Add `touchMetric(ticks)` (fraction of ticks with a blocked move) and `escapeMetric(ticks,
  dangerRadius)` (escape events per minute, near danger vs. away from it) to `public/js/fly/metrics.js`.
- [ ] T063 [P] [US4] Unit tests for `touchMetric`/`escapeMetric` in `tests/metrics-v2.test.mjs`.
- [ ] T064 [US4] Integration test in `tests/forager-v2-touch.test.mjs`: a fly whose front leg meets a
  non-walkable cell changes its turn output on that side (spec Acceptance Scenario 1; also the wall-following
  question ADR 006 Q4 raises — record the measured direction, do not assert a side without the measurement).
- [ ] T065 [US4] Extend `tests/body-escape.test.mjs` (T046): a fly above the escape threshold outside cooldown
  jumps exactly once per tick-above-threshold run (Acceptance Scenario 2); a second above-threshold tick during
  cooldown produces no second jump (Acceptance Scenario 3, SC-011).

### Implementation for User Story 4

- [ ] T066 [US4] Confirm `fly-host.js`'s `escaped: boolean` per-tick flag (T044) is set exactly on a tick where
  `jumpForagerBody` actually moved the fly, for the panel's action label (US8, T077) and `escapeMetric` (T062).

**Checkpoint**: User Story 4 is independently testable — touch changes turning, escape jumps are bounded and
cooldown-limited.

---

## Phase 7: User Story 5 - Choose the Brain Version in Config (Priority: P1)

**Goal**: `flies.brain.version` accepts `v2` alongside `mock`/`v0`/`v1`, with the same refuse-on-mismatch and
no-edit-for-existing-worlds guarantees those three already have.

**Independent Test**: run the same world with all four values in turn; run a pre-existing world file unchanged.

### Tests for User Story 5

- [ ] T067 [P] [US5] World-start test in `tests/fly-config-brain-v2.test.mjs`: `flies.brain.version: "v2"` with
  `world-forager-15k.json`'s matching container-v5 snapshot starts, and the panel names the snapshot, its release
  and its format version (spec Acceptance Scenario 1).
- [ ] T068 [P] [US5] World-start test in `tests/world-validate-v2.test.mjs`: `flies.brain.version: "v2"` naming
  `world-forager-15k-bad.json`'s container-v4 snapshot refuses to start, the error message names both versions
  (spec Acceptance Scenario 2, using T049's fixture).
- [ ] T069 [US5] Regression test in `tests/fly-config-brain-v2.test.mjs`: existing `mock`, `v0` and `v1` world
  files (`world-connectome.json`, `world-forager.json`, the default toy world) start and behave exactly as before
  this feature (spec Acceptance Scenario 3, FR-002).

### Implementation for User Story 5

- [ ] T070 [US5] No production code beyond Phase 2 (T029–T030, T034, T041–T042) is expected; this story is the
  acceptance surface for that plumbing. If any test above finds a gap, fix it at its source file rather than
  adding a version-5-specific branch elsewhere.

**Checkpoint**: all four brain versions are selectable by one config value with no code edit to existing worlds.

---

## Phase 8: User Story 6 - Extract the 15K Brain in Multiple Formats (Priority: P2)

**Goal**: the same extractor utility keeps producing the small-brain and `v1` forager formats unchanged while
producing the new 15K format.

**Independent Test**: run all three configs on the same dataset; confirm three files, three reports, and
byte-identical reruns.

### Tests for User Story 6

- [ ] T071 [P] [US6] Regression test (extend `extract/tests/test_small_unchanged.py` or add
  `extract/tests/test_forager_v1_unchanged.py`): running `smallest-functional-brain.json` and `forager-brain.json`
  after this feature produces output byte-identical to the files committed before this feature, apart from
  `provenance.createdAt`.

### Implementation for User Story 6

- [ ] T072 [US6] Run all three configs back-to-back (`smallest-functional-brain.json`, `forager-brain.json`,
  `forager-brain-15k.json`) and diff each output against its pre-feature committed file (or, for the new one,
  against a second run of itself); record the result in the Gate A section of
  `specs/013-forager-brain-15k-lif-v2/quickstart.md`'s step 2–3 (already drafted; confirm the real output matches).

**Checkpoint**: three formats, one extractor, zero regressions to the two existing ones.

---

## Phase 9: User Story 7 - Keep Earlier Brains and Worlds Working Unchanged (Priority: P2)

**Goal**: every `mock`/`v0`/`v1` test, file and worker path is provably untouched by this feature.

**Independent Test**: full existing test suite plus a manual browser run of the three pre-existing worlds.

### Tests for User Story 7

- [ ] T073 [US7] Run `npm test` and confirm every pre-existing test passes with no change to its expected values,
  including `tests/lif-golden.test.mjs` (imports `lif-v0.js` only, structurally unaffected by this feature).
- [ ] T074 [US7] Run `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract` and confirm every
  pre-existing test passes with no change to its expected values.

### Implementation for User Story 7

- [ ] T075 [US7] Browser regression check per `AGENTS.md`'s Run check: start `python3 -m http.server 8000` from
  `public/`, load the default (`mock`) world, `?world=world/world-connectome.json` (`v0`), and
  `?world=world/world-forager.json` (`v1`); confirm each runs with no console error and unchanged behaviour.

**Checkpoint**: zero regressions anywhere in `mock`/`v0`/`v1`, proven by the full suite plus a real browser check.

---

## Phase 10: User Story 8 - See the New Senses and Outputs on the Side Panel (Priority: P2)

**Goal**: a selected `v2` fly's panel shows 12 labelled input rows, 6 labelled output rows (incl. `escape`), and a
new region-activity readout; `v0`/`v1` panels show exactly what they showed before.

**Independent Test**: load a `v2` world, select a fly, confirm all rows render and update; confirm a `v1` fly's
panel is unchanged.

### Tests for User Story 8

- [ ] T076 [P] [US8] `tests/panel-region-activity.test.mjs`: the region-activity section mounts and renders one
  row per region (`input`, `output`, `al`, `vnc`, `dn`, `central`, in that order) for a fly declaration whose
  `groups` list is non-empty; it does not mount for a declaration with no `groups` field (`v0`/`v1`-shaped
  fixtures) — per `contracts/panel-sections-v2.md`'s `requires: {groups: true}` rule.

### Implementation for User Story 8

- [ ] T077 [US8] Create `public/js/ui/panel/sections/region-activity.js`: `requires: {groups: true}`; one row per
  declared region showing its label and the fraction of its neurons that spiked within the existing
  `WINDOW_TICKS` rolling window (`counts.js`'s `activeCount` pattern, computed per region); `mount`/`update`/
  `dispose` follow the shared lifecycle contract (writes only changed values, creates/removes no element on
  `update`).
- [ ] T078 [US8] Register `region-activity` in `public/js/ui/panel/sections/index.js`'s `SECTIONS`, after
  `outputsSection`.
- [ ] T079 [US8] Extend `public/js/ui/panel/model.js`'s diagnostic block to read `drives.escape` when the fly's
  declaration lists it; the block omits the escape line entirely when it does not (no change to the `v1`
  diagnostic shape, per spec Acceptance Scenario 3).
- [ ] T080 [US8] Extend `public/js/ui/panel/action.js`'s `forageAction` with an `"escape"` label shown exactly on
  the tick `fly-host.js`'s `escaped` flag (T066) is true; every other tick keeps today's turn/forward/backward
  labelling unchanged.
- [ ] T081 [US8] Browser verification per `AGENTS.md`'s Run check: load `world-forager-15k.json`, select a `v2`
  fly, confirm 12 input rows, 6 output rows and the region-activity section all render and update live with no
  console error; then select a `v1` fly in `world-forager.json` and confirm its panel is pixel-for-pixel what it
  showed before this feature (spec SC-010).

**Checkpoint**: the panel shows every new channel and region for `v2`, and nothing new for `v0`/`v1`.

---

## Phase 11: User Story 9 - Compare Brain Generations and the Null Arms Over Seeds (Priority: P3)

**Goal**: the experiment script reports all six behaviour metrics (find/approach/eat/leave/hunger-dependence +
brake/avoid/touch/escape/rest) for every arm, including `v2` and the two null arms, over held-out seeds.

**Independent Test**: run the script on the `v2` world; confirm one table per metric with every arm and the
held-out seed count.

### Tests for User Story 9

- [ ] T082 [P] [US9] Add `restMetric(ticksByRegion)` to `public/js/fly/metrics.js`: activity (spike-rate fraction)
  per region with no stimulus present.
- [ ] T083 [P] [US9] Unit test for `restMetric` in `tests/metrics-v2.test.mjs`.

### Implementation for User Story 9

- [ ] T084 [US9] Extend `scripts/compare-baseline.mjs`: `--brains` accepts `v2`; print the brake (T054), avoid
  (T058), touch (T062), escape (T062) and rest (T082) columns per arm, alongside the unchanged
  find/approach/eat/leave/hunger-dependence table; size-matched random-graph and random-walk arms are generated
  against the `v2` brain's neuron/edge count exactly as they already are for `v1`.
- [ ] T085 [US9] Run `node scripts/compare-baseline.mjs --world=world/world-forager-15k.json
  --brains=mock,v0,v1,v2,random-matched,baseline` on held-out seeds; record the full table in
  `specs/013-forager-brain-15k-lif-v2/gate-c.md` (new file, pattern: `specs/008-hungry-forager-brain/gate-c.md`),
  stating each metric's measured value as it is, whether or not it passes (FR-028) — brake must pass (SC-007).

**Checkpoint**: every arm, every metric, reported — the comparison the feature exists to enable.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: fold the amendment contracts into their canonical documents, record the measured performance, and
run the full validation guide end to end.

- [ ] T086 [P] Update `public/world/README.md`: add the `v2` row to the brain-version table (container version 5,
  `lif-v1.js`, `fly-brain-v2.js`, protocol v3) and a 15K calibration section matching the existing `v1` section's
  style (table + "Calibration." / "Starting values, not calibrated." prose).
- [ ] T087 [P] Create `public/tests/forager-v2-timing.html`: Gate B browser harness running six `v2` flies and
  printing mean/p95 tick time per fly.
- [ ] T088 Run the Gate B harness (T087) and record the measured per-tick cost in
  `specs/013-forager-brain-15k-lif-v2/research.md` (append a dated note to R5/R6) or a new `gate-b.md`, against
  the ADR 006 Annex A6 reference figures (1.9–9.4 ms per tick at `stepsPerTick: 10` on the reference hardware).
- [ ] T089 Fold each of the 7 contract amendment documents in `contracts/` into its canonical file
  (`specs/008-hungry-forager-brain/contracts/*.md` for 6 of them, `specs/006-fly-status-panel/contracts/
  panel-sections.md` for the panel one), per `AGENTS.md`'s "update the contract document in the same change"
  rule — the amendment documents stay in this feature's `contracts/` as the historical record of what changed and
  why.
- [ ] T090 Run `npm test` and the extractor `unittest` suite one final time, both fully green, then walk
  `quickstart.md` steps 1–6 end to end exactly as written and confirm every "Expected" outcome holds.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup (T001's config, T002's fixture). **Blocks every user story** —
  none of US1–US9 has a brain or world to run against until T023 (snapshot) and T048 (world) exist.
- **User Stories (Phases 3–11)**: all depend on Foundational completion. Unlike a typical CRUD feature, most
  stories here share deeply overlapping plumbing (the same 12 senses, the same escape mechanism), so true
  story-level parallelism is narrower than usual — see "Parallel Opportunities" below for what can actually run
  side by side.
- **Polish (Final Phase)**: depends on every user story whose behaviour it documents or measures (T088 needs US4's
  escape and US1's find working; T089 needs every contract amendment's production code merged; T090 needs
  everything).

### User Story Dependencies

- **US1 (find)**: needs Phase 2's `senseForagerFlyV2`/world in place. No dependency on other stories.
- **US2 (brake/eat)**: needs Phase 2. Independent of US1, though it runs in the same world.
- **US3 (avoid)**: needs Phase 2. Independent of US1/US2.
- **US4 (touch/escape)**: needs Phase 2 (including `jumpForagerBody`). Independent of US1–US3.
- **US5 (brain choice)**: needs Phase 2's dispatcher/worker-fix/validate.js work (T029, T034, T041). Its tests are
  largely acceptance coverage of Phase 2, not new behaviour.
- **US6 (multi-format extraction)**: needs Phase 2's extraction pipeline (T004–T023). Independent of US1–US5.
- **US7 (no regression)**: needs Phase 2 complete; is itself a cross-check, not new behaviour.
- **US8 (panel)**: needs Phase 2 (a loadable `v2` declaration with `groups`) and benefits from US4's `escaped`
  flag (T066) for its action label — a soft dependency, not a hard block (the region-activity section and the 12/6
  rows need only Phase 2).
- **US9 (experiment/comparison)**: needs US2's `brakeMetric`, US3's `avoidMetric`, US4's `touchMetric`/
  `escapeMetric` (T084 imports all four) in addition to Phase 2. This is the one story with real cross-story
  dependencies, because the comparison report is defined as the union of every other story's metric.

### Within Each User Story

- Tests before the implementation task(s) they validate, written to fail first where new production code is
  still pending (US2–US4, US8, US9's metric functions); several stories (US1, US5, US6, US7) are themselves
  acceptance coverage of Phase 2's production code, so their "tests" are the independent-test criteria and their
  "implementation" tasks are confirmation/fix-up, not new features.

### Parallel Opportunities

- Setup: T002, T003 in parallel (T001 is a prerequisite for T002's fixture shape, so not parallel with it).
- Foundational: T016–T021 (extraction tests) in parallel once T004–T015 land; T025, T028, T031, T033, T035,
  T045–T047, T049 in parallel once their respective production tasks land (each touches a distinct test file).
- Once Phase 2's checkpoint is reached, **US1, US2, US3, US4 and US6 can proceed in parallel** (distinct files:
  `metrics.js` additions in US2–US4 are distinct functions in the same file, so coordinate those three if staffed
  by different people — add functions, do not reorder existing ones). US8 can proceed in parallel with these once
  Phase 2's `groups` field exists. US5, US7 and US9 are best run after the stories they check/aggregate.
- Polish: T086, T087 in parallel; T088–T090 are sequential (each depends on the prior one's output existing).

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Once T004–T015 (extraction pipeline) land, launch its tests together:
Task: "extract/tests/test_config_forager_v2.py"
Task: "extract/tests/test_forager_v2_failures.py"
Task: "extract/tests/test_selection_forager_v2.py"
Task: "extract/tests/test_container_v5.py"
Task: "extract/tests/test_capabilities_v5.py"
Task: "extract/tests/test_forager_v2_determinism.py"

# Once T024 (groupGain) lands, launch its test and the next core consumer together:
Task: "tests/lif-v1-groupgain.test.mjs"
Task: "fly-brain-v2.js (T027, consumes groupGain via graph.neuronGroup)"
```

## Parallel Example: User Stories 1–4 and 6 (after Phase 2's checkpoint)

```bash
Task: "US1 — tests/forager-v2-find.test.mjs"
Task: "US2 — metrics.js: brakeMetric + tests/metrics-v2.test.mjs"
Task: "US3 — metrics.js: avoidMetric + tests/metrics-v2.test.mjs"
Task: "US4 — metrics.js: touchMetric/escapeMetric + tests/metrics-v2.test.mjs"
Task: "US6 — extract/tests/test_forager_v1_unchanged.py"
```

---

## Implementation Strategy

### Reality check: there is no thin MVP slice here

Unlike a typical feature, **US1 alone cannot be demoed without Phase 2 essentially complete** — there is no brain
to sense food with, no world to run it in, and no config switch to select it until the extraction pipeline, the
runner/protocol/worker fix and the declared-sense machinery all exist. The honest MVP boundary is:

1. **Phase 1 + Phase 2** (Setup + Foundational) — this is the bulk of the engineering work and the bulk of the
   risk (ADR 006's own Annex A6 cost figures, the pair-grid selection algorithm, the `handleV1` fix). Nothing is
   demoable before this is done.
2. **+ US5 (brain choice)** — proves the `v2` switch works end to end on the real snapshot/world from Phase 2.
3. **+ US1 (find)** — the first observable behaviour, and the one with the lowest risk (it is the capability v1
   already had, now on six senses).

This three-step slice (Phase 2 + US5 + US1) is the smallest thing worth demoing. From there, US2 (the headline
brake/eat fix ADR 006 exists to deliver) is the next highest-value increment, followed by US3/US4 (avoid/escape),
then US6–US9 (format coverage, regression proof, panel, comparison) in any order, since none of them gates the
others once Phase 2 is done.

### Incremental Delivery

1. Phase 1 + Phase 2 → a `v2` fly loads, senses, drives and can jump in a real world. Nothing is "good" yet, only
   "wired".
2. + US5 → the config switch is proven end to end.
3. + US1 → first observable, comparable behaviour (finds food at least as well as `v1`).
4. + US2 → the headline result (brakes and eats, which `v1` could not do).
5. + US3, US4 → avoidance and escape, reported.
6. + US6, US7 → format and regression proof.
7. + US8 → the panel catches up to the new brain.
8. + US9 → the full cross-generation comparison report.
9. Polish → contracts folded into their canonical documents, performance recorded, quickstart walked end to end.

### Parallel Team Strategy

With multiple developers: one owns Phase 2's Python extraction pipeline (T004–T023) while another owns Phase 2's
JS core/runner/protocol/worker plumbing (T024–T035) and a third owns the world/body/sense machinery (T036–T049) —
these three sub-tracks inside Phase 2 touch disjoint files and can run concurrently, converging at T023 (snapshot)
and T048 (world). Once Phase 2's checkpoint is reached, US1/US2/US3/US4/US6 can be split across developers as
shown in the parallel example above; US5, US7, US8 and US9 are best picked up by whoever finishes first, since
each is largely acceptance coverage or aggregation of the others' work.

---

## Notes

- `[P]` tasks touch different files and have no incomplete prerequisite among the tasks listed above them in the
  same phase.
- `[US#]` maps a task to spec.md's user story for traceability; Setup, Foundational and Polish tasks carry no
  story label by design (they serve every story).
- Every quoted constraint (e.g. T013's `_check_forager_v2` assertions, T041's `validate.js` checks) is copied
  verbatim from `data-model.md`/`contracts/` so the exact wording is not left to implementation-time discretion.
- Commit after each task or logical group. Stop at any phase checkpoint to validate independently before moving
  on — Phase 2's checkpoint in particular is worth a deliberate pause, since everything after it depends on it.
