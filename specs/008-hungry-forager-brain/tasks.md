# Tasks: Hungry Forager Brain

**Input**: Design documents from `specs/008-hungry-forager-brain/`
**Prerequisites**: [plan.md](plan.md) (required), [spec.md](spec.md) (user stories), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Test tasks are included because [plan.md](plan.md) names the test files for each part and the gates (Gate A,
B, C), and the constitution requires testable behaviour. Each test task is marked *write first*: it must fail before the
implementation task that follows it, then pass.

**Organization**: Setup and Foundational come first. Then one phase per user story in priority order (P1: US1–US4; P2:
US5–US6; P3: US7). Polish comes last.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- **[Story]**: US1–US7, from [spec.md](spec.md); Setup, Foundational and Polish have no story label
- Paths are repository-relative. Browser code is under `public/js/`; the extractor is under `extract/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Record the baseline before anything changes, so every later regression check has a reference.

- [X] T001 Record the baseline in `specs/008-hungry-forager-brain/baseline.txt`: the output of `npm test` (expect 257 passing), `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract` (expect 95 passing), and `node scripts/compare-baseline.mjs --world=world/world-connectome.json --verbose` (the v0 arm values, used by T088 and T103)
- [X] T002 [P] Verify the extractor environment and record the versions in `specs/008-hungry-forager-brain/baseline.txt`: `extract/.venv/bin/python -c "import pyarrow, numpy; print(pyarrow.__version__, numpy.__version__)"` must print `25.0.1 2.5.3`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The v0 simulator is kept intact under its version names, the v1 LIF core and the v4 readers exist, and the extractor
writes the forager snapshot. Every user story below needs `public/brains/forager-brain.brain` and the v0 suite to be green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### 2a. Keep v0 available under its version names (plan phase 1)

- [X] T003 Rename `public/js/brain/lif.js` to `public/js/brain/lif-v0.js` with `git mv`. The code is unchanged (contract: [lif-v1.md](contracts/lif-v1.md) reference for v0)
- [X] T004 Update every import of `lif.js` to `lif-v0.js`. Find them with `grep -rln "lif.js" public/js scripts tests` (expect `public/js/brain/fly-brain.js`, the `tests/lif*.test.mjs` files, `tests/golden-drive.mjs`, `scripts/record-toy-golden.mjs`). No expected value in any test changes
- [X] T005 Move the v0 runner from `public/js/brain/fly-brain.js` into a new `public/js/brain/fly-brain-v0.js`: `BRAIN_DEFAULTS`, the toy and snapshot construction paths, `runner`, `driveNeurons`, `spikeIndices`. Import from `./lif-v0.js`. Exports stay the same names
- [X] T006 Replace `public/js/brain/fly-brain.js` with a dispatcher that re-exports `BRAIN_DEFAULTS` and implements `createFlyBrain(brainConfig, seed)`: `mock` and `v0` (or no version) go to `fly-brain-v0.js`. The `v1` branch is added in T044
- [X] T007 In `public/js/fly/fly-config.js`, add `resolveBrainVersion(brain)`: absent `version` → `mock` when there is no `snapshot`, else `v0` (spec FR-002). `resolveFlies` returns the resolved `brain.version`. `resolveBrain` keeps the v0 defaults for `mock` and `v0`
- [X] T008 In `public/js/world/validate.js`, extend `validateFlyBrain`: `version` ∈ {`mock`, `v0`, `v1`} (message: `flies.brain.version must be "mock", "v0" or "v1"`); `snapshot` required for `v0` and `v1` and forbidden for `mock`; `lif` keys checked against `LIF_DEFAULTS` for `v0`/`mock` and `LIF_V1_DEFAULTS` for `v1` (the import of `LIF_V1_DEFAULTS` is added in T011)
- [X] T009 Checkpoint: run `npm test`. Expect 257 passing, with no change in the v0 expected values

### 2b. LIF v1, off by default (plan phase 3, contract G1)

- [X] T010 [P] Write `tests/lif-v1.test.mjs` with G1 (bit-exact off) and G2 (reproducible): on the `tests/fixtures/toy-golden.json` drive and on a CSR snapshot drive, every potential and every spike of `lif-v1.js` with default parameters equals `lif-v0.js` (`===`, no tolerance); the same graph, parameters, drive and seed give the same spike sequence. *Write first; must fail until T011*
- [X] T011 Create `public/js/brain/lif-v1.js`: `LIF_V1_DEFAULTS` (the table in [lif-v1.md](contracts/lif-v1.md): `dt`, `tau`, `vRest`, `vReset`, `vThreshold`, `refractorySteps`, `synapticScale`, `tauSyn: 0`, `tauAdapt: 0`, `adaptStep: 0`, `thresholdJitter: 0`, `stepsPerTick: 1`); `resolveParams` with the messages in the contract; `createNetwork(graph, overrides, seed)` for CSR and toy edge lists; `step(net, external)` with the v0 update order when `tauSyn = 0` and `tauAdapt = 0`. Until T011a, a non-zero `tauSyn`, `tauAdapt`, `adaptStep` or `thresholdJitter` is rejected with `LIF parameter "<name>" is not yet supported`
- [X] T011a Add the L1, L2 and L3 branches to `public/js/brain/lif-v1.js`, each off by default. L1: `syn ← syn·e^(−dt/tauSyn) + arrive·(1 − e^(−dt/tauSyn))`, membrane adds `syn` in place of `input`. L2: `a ← a·e^(−dt/tauAdapt)`, `a += adaptStep` on a spike, `−a` in the membrane update. L3: `vThreshold_i = vThreshold·(1 + thresholdJitter·u_i)` with `u_i ∈ [−1, 1]` drawn once per neuron from `public/js/world/prng.js` in index order (no draws when jitter is 0). Constraints: `tauSyn ≥ 0`, `tauAdapt ≥ 0`, `adaptStep ≥ 0`, `thresholdJitter` ∈ [0, 1)
- [X] T012 Checkpoint: `node --test tests/lif-v1.test.mjs tests/lif-golden.test.mjs` passes; G1 is green with defaults

### 2c. Channel declaration v4 and snapshot v4 reader, JavaScript (plan phase 4)

- [X] T013 [P] Write `tests/capabilities-v4.test.mjs`: one assertion per rule R1–R8 of [channel-declaration-v4.md](contracts/channel-declaration-v4.md), with the exact message text; one valid forager declaration passes. *Write first*
- [X] T014 Extend `public/js/brain/capabilities.js` with `validateCapabilitiesV4(decl, neuronCount, kind, subject = 'snapshot')` implementing R1–R8, and export `FORAGER_DRIVES = ['turnLeft', 'turnRight', 'forward', 'backward', 'feed']`. Leave `validateCapabilities` (v3), `TOY_CAPABILITIES` and `BASELINE_CAPABILITIES` unchanged
- [X] T015 [P] Write `tests/snapshot-v4.test.mjs`: builds a small **synthetic** version 4 buffer inside the test (labelled `synthetic` in its name and comments; 3 inputs, 5 outputs, a few interneurons) and asserts it parses; asserts the rejection messages for the unknown version, `kind`, role order, modulator rules and CSR rules. *Write first*
- [X] T016 Extend `public/js/brain/snapshot.js`: `parseSnapshot` dispatches on the format version. Version 3 keeps its rules and messages. Version 4 checks the header against the [container-v4.md](contracts/container-v4.md) rules N1–N4 and M1–M3, `kind` = `forager`, `weightRule` = `postFraction`, and `validateCapabilitiesV4`. The result adds `version`, `kind` and `modulators`. The section code is shared. Export `checkBrainVersion(brainVersion, containerVersion)` for T068

### 2d. Worker protocol 3 (plan phase 4)

- [X] T017 [P] Write `tests/protocol-v3.test.mjs`: builders set `v: 3`; `sense.inputs` length is checked against the declaration; `sense.state.hunger` must be a finite number in [0, 1]; a `motor` with `left` or `right` is rejected for a forager (`motor.left is not part of protocol 3 forager messages`); a protocol 2 message still goes to the v0 handler. *Write first*
- [X] T018 Create `public/js/brain/protocol-v3.js` per [worker-protocol-v3.md](contracts/worker-protocol-v3.md): builders `init`, `sense`, `stop`, `ready`, `motor`, `error`; `validateMessage(msg, direction)`; `validateMotorV3(msg, decl)`; `transferables(msg)`. Constraint: `sense.state.hunger` is a finite number in [0, 1]. `protocol.js` (version 2) stays unchanged
- [X] T019 Update `public/js/brain/worker-core.js` to route by `msg.v`: 2 → the existing v0 handler, 3 → the v1 handler. A protocol 2 `init` on a version 4 snapshot returns `brain version does not match the message protocol`. The v1 handler is completed in T047

### 2e. Extractor foundations, Python (plan phase 2)

- [X] T020 Extend `extract/malecns_brain/errors.py` with the codes `E-POOL-EMPTY`, `E-SIDE-IMBALANCE`, `E-OUTPUT-UNREACHED`, `E-NODE-RANGE`, `E-MODULATOR` (existing codes unchanged)
- [X] T021 Extend `extract/malecns_brain/dataset.py`: add `FORAGER_ANNOTATION_COLUMNS = ANNOTATION_COLUMNS + ["rootSide", "subclass", "receptorType"]`, and let `load_annotations(directory, columns=ANNOTATION_COLUMNS)` take the columns. The version 3 path reads exactly what it reads today
- [X] T022 [P] Write `extract/tests/test_capabilities_v4.py` with the same messages as `tests/capabilities-v4.test.mjs` (rules R1–R8). *Write first*
- [X] T023 Extend `extract/malecns_brain/capabilities.py` with `validate_capabilities_v4(decl, neuron_count, kind, subject)` producing the same messages as `capabilities.js`
- [X] T024 [P] Write `extract/tests/test_config_forager.py`: dispatch pairs (`formatVersion` 2 with no `kind` → small; 3 with `kind` `forager` → forager; any other pair → `E-CONFIG` naming the key); C1 mismatch between `capabilities` and `inputs`/`outputs`; unknown key; `weightRule` must be `postFraction`; `outputAdmission` must be `low-confidence-sign-zero`; `neuronCountRange` must be `[min, max]` with min ≤ max. *Write first*
- [X] T025 Extend `extract/malecns_brain/config.py`: `format_of(config)` returns `small` or `forager`; `validate_forager(config)` checks every key in the [extract-config-forager.md](contracts/extract-config-forager.md) table and rule C1; `load_config` dispatches. The version 2 validation is unchanged
- [X] T026 Create `extract/malecns_brain/admission.py` with `admit_forager(annotations, transmitters, config, pool_types)`: Traced bodies in an input or output pool. Output bodies are admitted whatever their transmitter; an unmapped or below-`minConfidence` transmitter gives `sign = 0` and their outgoing edges are dropped later (ADR 003 D2). Input and interneuron bodies use the ADR 002 D4 rule, by calling the existing rule in `selection.py` and not copying it
- [X] T027 Create the synthetic fixture: `extract/tests/make_forager_fixture.py` and `extract/tests/fixtures/forager-synthetic.json`. Labelled `"synthetic": true`. Two odour types with matched sides, taste pools, two outputs per drive, and a graph with a known flow
- [X] T028 [P] Write `extract/tests/test_selection_forager.py` on the synthetic fixture: pool resolution by class, subclass, type prefix and `rootSide`; side matching keeps the first `min(|L|,|R|)` by ascending `bodyId`; `sideMatch: false` keeps all; flow scores are deterministic; budget ties break on the smallest `bodyId`; sensory classes are excluded; output outgoing edges are dropped. *Write first*
- [X] T029 Create `extract/malecns_brain/selection_forager.py`, part 1: `resolve_pools(config, bodies)` (input pools and output pools) and side matching. Raises `E-POOL-EMPTY` and `E-SIDE-IMBALANCE`
- [X] T030 Extend `extract/malecns_brain/selection_forager.py`, part 2: forward flow with `Wᶠ` for `flowSteps` fixed iterations, backward flow with `Wᵇ`, score `√(F·B)` per pathway, ranking with the explicit key `(−score, bodyId)`. Edge arrays are `int32` ids and `uint16` synapse counts. Budget union, exclusions by class and superclass suffix, induced subgraph, output outgoing edges dropped. Raises `E-OUTPUT-UNREACHED` and `E-NODE-RANGE`
- [X] T031 Extend `extract/malecns_brain/selection_forager.py`, part 3: neuron order (input pools in channel order, output pools in declaration order, interneurons by ascending `bodyId`); neuron entries with `index`, `role`, `channel`, `bodyId`, `class`, `type`, `somaSide`, `superclass`, `soma`, `transmitter`, `transmitterConfidence`, `sign`, `flowInput`, `flowOutput`; weights `postFraction` = `sign × synapses / Σ synapses into the target` (unsigned denominator over the selected presynaptic neurons); modulators checked against M1–M3 (`E-MODULATOR`). Returns the brain dict the writer takes
- [X] T032 Extend `extract/malecns_brain/container.py`: `write_container` takes version 4 and writes the header keys of [container-v4.md](contracts/container-v4.md); `read_container` dispatches on version 3 or 4. The version 3 path is unchanged. Messages for N1–N4 and M1–M3 as in the contract
- [X] T033 [P] Write `extract/tests/test_container_v4.py`: round trip of a synthetic version 4 header; each rejection message; the section table matches the version 3 layout; the bytes are identical across two writes apart from `provenance.createdAt`. *Write first*
- [X] T034 Create `extract/configs/forager-brain.json` per [extract-config-forager.md](contracts/extract-config-forager.md): `formatVersion` 3, `kind` `forager`, `datasetRelease` `male-cns-v1.0`, `edgeVariant` `traced-only`, `expect` (the same counts as `smallest-functional-brain.json`), inputs `odour-left`/`odour-right` (`class` olfactory, types `ORN_DM1`, `ORN_DM2`, `ORN_DM4`, `ORN_VA2`, `ORN_VM2`, `ORN_DP1m`, `rootSide` L/R) and `taste-left`/`taste-right` (`class` gustatory, subclasses `labellar bristle` and `taste peg`, type prefix `LgLG`), `sideMatch` `{odour: true, taste: false}`, outputs `turn-left`/`turn-right` (`DNa01`, `DNa02`, `somaSide`), `forward` (`DNp09`), `backward` (`MDN`), `feed` (`MN9`), `flowSteps` 5, `budget` 1500/1500, `excludeInterneuronClasses`, `excludeInterneuronSuperclassSuffix` `_sensory`, `weightRule` `postFraction`, `modulators` (`hunger` gain [0.5, 1.5] on the odour inputs; `hunger-taste` source `hunger`, gain [0.1, 1.5] on the taste inputs), `capabilities` (C1 with the same ids and drives), `expectedNeuronCount` null, `neuronCountRange` [2000, 6000], `outputAdmission` `low-confidence-sign-zero`
- [X] T035 Extend `extract/malecns_brain/__main__.py`: `extract()` dispatches on `format_of(config)`. Small → the existing selection and container version 3, output unchanged. Forager → `admit_forager`, `selection_forager`, container version 4. A forager report prints per-pool counts, side balance, edges into each output, weight min and max, and the self-check. The version 3 report text is unchanged
- [X] T036 Generate the forager brain from MaleCNS v1.0: `MALECNS_DIR=data/malecns extract/.venv/bin/python -m malecns_brain extract --config extract/configs/forager-brain.json --out public/brains/forager-brain.brain` (run from the repository root with `cd extract` as needed). Save the printed report to `specs/008-hungry-forager-brain/gate-a.md` as the first Gate A record
- [X] T037 [P] Write `tests/forager-artifact.test.mjs`: parses `public/brains/forager-brain.brain` with `parseSnapshot` and asserts the neuron count is in [2000, 6000], every output pool has an incoming edge, every non-output neuron has sign ±1, and output neurons with `sign: 0` have no outgoing edge. The test is skipped with a message when the file is absent
- [X] T038 Checkpoint: `npm test` passes (257 plus the new tests), `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract` passes (95 plus the new tests), and `public/brains/forager-brain.brain` exists and parses

---

## Phase 3: User Story 1 - A Hungry Fly Finds Food From a Distance (Priority: P1) 🎯 MVP

**Goal**: The v1 brain turns a fly toward a flower it smells from several tiles away, using bilateral odour, pool drive with hunger
gain, and forager motion.

**Independent Test**: With the forager world, a fly placed beyond one odour radius from a flower, with a seeded run, turns
toward the flower's side when the odour reaches its antennae. A unit test places an odour source on the fly's left and checks
that a left-only turn drive brings the heading toward it.

### Tests for User Story 1 (write first; plan-named)

- [X] T039 [P] [US1] Write `tests/stimulus-bilateral.test.mjs`: the two samples sit at ±`antennaOffset` across the heading; an empty flower (stock 0) contributes 0; a flower 6 tiles away is sensed with `radius` 8; with the flower on the fly's left, the left sample is larger than the right. *Write first*
- [X] T040 [P] [US1] Write `tests/forager-body.test.mjs`: `v = maxSpeed × clamp(forward − backward, −1, 1)`; `ω = turnRate × s × (turnLeft − turnRight)`; the sign test (odour source on the fly's left, `turnLeft`-only drive turns toward it) fixes `s`. *Write first*
- [X] T041 [P] [US1] Write `tests/fly-brain-v1.test.mjs`: each input pool neuron receives `clamp(resting + gain(h) × value, 0, max)`; `gain(h) = g0 + (g1 − g0) × h`; `hunger` must be in [0, 1]; outputs are the EMA of each pool's mean spike rate in declaration order; the same seed gives the same outputs. *Write first*
- [X] T042 [P] [US1] Write `tests/forager-step.test.mjs`: one tick of the pure forager loop (the input values, the brain step, the body step) gives the same result for the same state, and a protocol 3 message is produced for each tick. *Write first*

### Implementation for User Story 1

- [X] T043 [US1] Create `public/js/fly/food.js`: `createFood(world, config)` holds the per-flower stock; `stockAt(cx, cy)` and `fraction(cx, cy)` (= stock ÷ full). Constraint: stock ∈ [0, `food.stock`]. Consume and regrow come in T054
- [X] T044 [US1] Add `senseBilateral` to `public/js/fly/stimulus.js`: `odourLeft` and `odourRight` are `sensoryValue(Σ falloff(d, radius) × fraction, gain, max, resting)` at the two antenna points `pos ± antennaOffset × perpendicular(heading)`. Constraints: `antennaOffset ≥ 0`, `radius > 0`. `senseAt` is unchanged for v0
- [X] T045 [US1] Add `stepForagerBody(body, drives, env)` to `public/js/fly/body.js` per [research.md](research.md) R8. The sign `s` is the value that makes T040 pass. `stepBody` (tank) is unchanged
- [X] T046 [US1] Create `public/js/brain/fly-brain-v1.js`: `createFlyBrain(brainConfig, seed)` for a version 4 snapshot. It builds the network with `createNetwork` from `lif-v1.js`, the pools from the capabilities (input and output neuron lists), and the modulators from the container. Each tick: pool neurons get `clamp(resting_c + gain_c(h) × value_c, 0, max_c)`; `stepsPerTick` LIF steps run with the same external drive; each output is the EMA of its pool's mean rate, updated once per LIF step. Constraint: `hunger` ∈ [0, 1]
- [X] T047 [US1] Complete the v1 branch in `public/js/brain/worker-core.js` (T019): a protocol 3 `sense` runs the v1 brain step and replies with a protocol 3 `motor`. Keep the `fly.worker.js` shell unchanged
- [X] T048 [US1] Wire the v1 branch of the dispatcher in `public/js/brain/fly-brain.js` (T006) to `fly-brain-v1.js`. T041 passes
- [X] T049 [US1] Create `public/js/fly/forager-step.js`: a pure per-tick function `stepForagerFly(fly, env)`. It builds `inputs` (odour left and right from `senseBilateral`; taste left and right = the stock under the fly when it stands on a flower, else 0), the protocol 3 `sense`, the body step with `stepForagerBody` on the drives read by name, and the history entry. It is used by the browser host and by the experiment script. T042 passes
- [X] T050 [US1] Update `public/js/fly/fly-host.js`: flies with version `v1` use `protocol-v3.js` for `init` and `sense`, and call `stepForagerFly`; tank and v0 flies are unchanged. Energy and hunger use the initial energy until US2
- [X] T051 [P] [US1] Write `tests/panel-inputs-v1.test.mjs`: `buildStatusModel` gives each input `inputs[k]` from the last history entry when it is present, and `sensory` otherwise. *Write first*
- [X] T052 [US1] Update `public/js/ui/panel/model.js`: each input value is `last.inputs[k]` when present, else `last.sensory` (v0). T051 passes
- [X] T053 [P] [US1] Write `tests/action-forager.test.mjs`: `forageAction` returns `Forward`, `Turn left`, `Turn right`, `Backward` or `Idle` using the thresholds `ACTION_IDLE_SUM` and `ACTION_STRAIGHT_DIFF` on `forward − backward` and `turnLeft − turnRight`. *Write first*
- [X] T054 [US1] Add `forageAction` to `public/js/fly/action.js`; `public/js/ui/panel/model.js` uses it for v1 flies. `actionLabel` stays for tank flies. T053 passes
- [X] T055 [US1] Create `public/world/world-forager.json`: the same map keys as `public/world/world.json`, with a `flies` section per [world-config-forager.md](contracts/world-config-forager.md) (`brain.version` `v1`, `snapshot` `brains/forager-brain.brain`, `stimulus.radius` 8, `antennaOffset` 0.5, placeholder calibration values marked in `world/README.md`)

**Checkpoint**: The independent test passes (T039–T042, T051, T053 green). Open the forager world from `public/` with a static server; a hungry fly turns toward a flower it smells.

---

## Phase 4: User Story 2 - The Fly Stops and Eats on Food (Priority: P1)

**Goal**: On a flower, a slow fly with feeding output above threshold eats; its energy rises and the flower's stock falls. An empty
flower gives no taste or smell.

**Independent Test**: A hungry fly placed on a flower, slow, with feeding output above threshold, eats; energy rises and stock
falls; a moving or unfed fly does not.

### Tests for User Story 2 (write first; plan-named)

- [X] T056 [P] [US2] Write `tests/food-energy.test.mjs`: `metabolise` keeps energy ≥ 0; `eat` keeps energy ≤ 1; `canEat` needs stock > 0, speed < `eatSpeed` and feed > `feedThreshold`, and each one alone fails; `consume` keeps stock ≥ 0; `regrow` keeps stock ≤ full; an empty flower gives taste and odour 0. *Write first*

### Implementation for User Story 2

- [X] T057 [US2] Add `consume(cx, cy, amount)` and `regrow(seconds)` to `public/js/fly/food.js`, using `consumeRate` and `regrowth` from the world config
- [X] T058 [US2] Create `public/js/fly/energy.js`: `metabolise(energy, dt, metabolism)`, `eat(energy, dt, intake)`, `canEat({stock, speed, feed}, cfg)`, `hunger(energy) = 1 − energy`. Constraints: energy ∈ [0, 1]; `feedThreshold` ∈ [0, 1]. T056 passes
- [X] T059 [US2] Add the defaults to `public/js/fly/fly-config.js`: `body.energy` (`initial` 0.3, `metabolism` 0.01, `intake` 0.2), `food` (`eatSpeed` 0.5, `feedThreshold` 0.5, `stock` 1.0, `consumeRate` 0.2, `regrowth` 0.02, `sated` 0.9), `stimulus.antennaOffset` 0.5
- [X] T060 [US2] Extend `public/js/world/validate.js` with the same keys and their rules, using the failure messages of [world-config-forager.md](contracts/world-config-forager.md) (for example `flies.food.feedThreshold must be a number from 0 to 1`)
- [X] T061 [US2] Update `public/js/fly/fly-world.js`: `buildWorld` creates the flower stock table with `createFood` from `stimulusCells`; the table is held by the host
- [X] T062 [US2] Update `public/js/fly/forager-step.js`: each tick, speed = distance moved ÷ `dt`; `canEat` decides; when eating, `consume(cell, consumeRate × dt)` and `energy = eat(energy, dt, intake)`; always `metabolise` and `regrow`; `eating` is set on the fly; hunger is sent in `sense.state`
- [X] T063 [P] [US2] Add the energy and hunger rows to the Action section: `public/js/ui/panel/model.js` adds `energy` and `hunger`; `public/js/ui/panel/sections/action.js` shows two bars for v1 flies. Channel rows are unchanged. Add the cases to `tests/panel-inputs-v1.test.mjs`

**Checkpoint**: T056 passes. A fly on a flower, slow and fed by its feed output, gains energy and lowers the stock.

---

## Phase 5: User Story 3 - The Fly Leaves When It Is Full (Priority: P1)

**Goal**: As energy rises, the feed output falls below threshold; the fly stops eating and walks off. Eating bouts record how they ended.

**Independent Test**: Run a fly from energy 0.1 on a flower until it is full. Eating stops, the fly walks off before the flower is
empty, and a sated fly does not eat the same flower again at once.

### Tests for User Story 3 (write first)

- [X] T064 [P] [US3] Write `tests/bouts.test.mjs`: a bout starts on the first eating tick and ends on the first tick without eating; `endedBy` is `empty` when stock is 0; `sated` when energy ≥ `food.sated` and feed ≤ `feedThreshold`; `walked` otherwise; a fly whose feed falls below threshold stops eating and its body moves off the cell. *Write first*
- [X] T065 [P] [US3] Write `tests/forager-behaviour.test.mjs`: a headless run (no DOM, using `forager-step.js`) of a fly from energy 0.1 on a flower until it is full; asserts eating stops, the fly leaves before the flower is empty (`endedBy` `walked` or `sated`), and a sated fly does not eat the same cell within 20 ticks. The seed is fixed. *Write first*

### Implementation for User Story 3

- [X] T066 [US3] Add bout bookkeeping to `public/js/fly/energy.js`: `startBout`, `updateBout`, `closeBout` returning `{ cell, ticks, endedBy }`
- [X] T067 [US3] Update `public/js/fly/forager-step.js` and `public/js/fly/fly-host.js` to start, update and close the bout each tick, and keep closed bouts in `record.bouts`. Also set `tauAdapt` and `adaptStep` in `public/world/world-forager.json` to placeholder values (for example 20 and 0.05), marked as placeholders until the calibration in T096 replaces them. T064 and T065 pass

**Checkpoint**: The hungry loop works end to end: approach (US1), eat (US2), leave (US3).

---

## Phase 6: User Story 4 - Choose the Brain in Config (Priority: P1)

**Goal**: One key chooses `mock`, `v0` or `v1`. Existing worlds keep working. A version mismatch stops the world before any fly starts.

**Independent Test**: Run the same world with `mock`, `v0` and `v1` in turn; each starts and reports its brain. An old world file behaves as before. A `v1` world naming a version 3 file shows the error and starts no fly.

### Tests for User Story 4 (write first; plan-named)

- [X] T068 [P] [US4] Write `tests/fly-config-brain.test.mjs`: version inference (no `snapshot` → `mock`; `snapshot` → `v0`); explicit `v1`; an unknown value gives the message in T008; `snapshot` with `mock` is refused; `v1` with a version 3 container and `v0` with a version 4 container give the mismatch messages of [world-config-forager.md](contracts/world-config-forager.md). *Write first*
- [X] T069 [P] [US4] Write `tests/world-compat.test.mjs`: `public/world/world.json`, `world-connectome.json` and `world-antennal-lobe.json` validate unchanged, and their brains resolve to `mock`, `v0` and `v0`. *Write first*

### Implementation for User Story 4

- [X] T070 [US4] Use `checkBrainVersion` from `public/js/brain/snapshot.js` (T016) in `public/js/main.js` and in `loadSnapshot` in `public/js/fly/fly-host.js`: a mismatch fails boot with an error that names both versions, and no fly starts (spec FR-003)
- [X] T071 [US4] Set the brain label in `public/js/fly/fly-host.js`: `mock` → `mock (toy random brain)`; `v0` → `v0 small brain (snapshot release …, created …)`; `v1` → `v1 forager brain (snapshot release …, created …)`. The panel shows this label (FR-004)
- [X] T072 [US4] Create `public/world/world-forager-bad.json`: a copy of `world-forager.json` with `brain.snapshot` set to `brains/smallest-functional-brain.brain` (test fixture; must refuse to start)
- [X] T073 [US4] Add the forager entry to `public/brains/brains.json`: file `forager-brain.brain`, label `Forager brain (ADR 003, v1)`. The manifest `version` stays 1
- [X] T074 [US4] Update `public/brains/js/model.js` and `public/brains/js/main.js` to group the version 4 neurons by `channel` (ADR 003 W5). Extend `tests/brain-inspector-groups.test.mjs` with a version 4 case. Version 3 grouping is unchanged
- [ ] T075 [US4] Checkpoint: T068 and T069 pass; open `world.json`, `world-connectome.json`, `world-forager.json` and `world-forager-bad.json` from the static server, and confirm the expected panel label or error

---

## Phase 7: User Story 5 - Extract Brains in Multiple Formats (Priority: P2)

**Goal**: The extractor writes the small brain (version 3) or the forager brain (version 4), chosen by config, with a report and a
byte-identical rerun. Each failure code writes no file.

**Independent Test**: Run the extractor with `smallest-functional-brain.json` and with `forager-brain.json` on the same dataset. Two
files are written in their formats, each with its report; a second run of each gives identical bytes apart from `createdAt`.

### Tests for User Story 5 (write first; plan-named)

- [X] T076 [P] [US5] Write `extract/tests/test_forager_failures.py`: each of `E-POOL-EMPTY`, `E-SIDE-IMBALANCE`, `E-OUTPUT-UNREACHED`, `E-NODE-RANGE`, `E-MODULATOR` is raised on a variant of `forager-synthetic.json`, and no file is written. A config with an unknown format pair gives `E-CONFIG`. *Write first*
- [X] T077 [P] [US5] Write `extract/tests/test_forager_determinism.py`: two runs on the synthetic fixture give the same bytes apart from `createdAt`; an output with an unmapped transmitter is admitted with `sign` 0 and no outgoing edge (ADR 003 D2). *Write first*
- [X] T078 [P] [US5] Update `extract/tests/test_cli.py`: the version 3 config still writes version 3 with unchanged output; the forager config dispatches to version 4 on the synthetic fixture
- [X] T079 [US5] Create `extract/tests/test_small_unchanged.py`: runs the small config on the real dataset when `MALECNS_DIR` is set (skipped otherwise), and compares the output with the committed `public/brains/smallest-functional-brain.brain` apart from `provenance.createdAt` (SC-002)
- [X] T080 [US5] Gate A run: regenerate `public/brains/forager-brain.brain` with `malecns_brain extract` and append the report to `specs/008-hungry-forager-brain/gate-a.md`. Record the neuron count against [2000, 6000], the edges into each output (`E-OUTPUT-UNREACHED` must not fire), the odour side balance, and the MN9 edge count (ADR 003 Q4)
- [X] T081 [US5] Create `extract/tests/bench_forager.py` to measure peak resident memory (`resource.getrusage`) and wall time for the forager extraction; record both in `specs/008-hungry-forager-brain/gate-a.md`
- [X] T082 [US5] Gate A byte identity: run the forager extraction twice into two files and compare with `cmp` after removing `createdAt` (with a short script). Record the result in `gate-a.md`

**Checkpoint**: Gate A records pass or fail with the numbers. A failing number is reported as it is; no config is hand-wired around it.

---

## Phase 8: User Story 6 - Keep the v0 Simulator Working (Priority: P2)

**Goal**: The v0 LIF and v0 brains produce the same results as before. The v1 mechanisms are verified against the spike-train and
behaviour contract.

**Independent Test**: The golden LIF test passes against `lif-v0.js`; the v1 LIF with mechanisms off matches v0 exactly; with
mechanisms on, the spread, adaptation and jitter tests hold.

### Tests for User Story 6 (write first; plan-named)

- [X] T083 [P] [US6] Extend `tests/lif-v1.test.mjs` with G3 (a sustained input reaches the same steady level as v0, spread over time with the L1 decay factor) and G4 (with `tauAdapt > 0`, a constantly driven neuron fires less later in the run). *Write first; T011a is implemented, so these check it*
- [X] T084 [P] [US6] Extend `tests/lif-v1.test.mjs` with G5: two networks with the same seed have identical thresholds; a different seed gives different ones; `thresholdJitter = 0` gives `vThreshold` for every neuron
- [X] T085 [P] [US6] Add a test to `tests/lif-v1.test.mjs` that `stepsPerTick` runs the core that many times per tick with the same external drive (L5), and that the core itself ignores the field

### Implementation for User Story 6

- [X] T086 [US6] Check that the runner `public/js/brain/fly-brain-v1.js` passes `stepsPerTick` through (ADR 003 L5), and that the EMA is updated once per LIF step. Fix it if T085 fails
- [X] T087 [US6] Regression: the v0 golden test `tests/lif-golden.test.mjs` passes with no change, and `tests/fly-brain.test.mjs`, `tests/antennal-lobe-brain.test.mjs` and `tests/snapshot.test.mjs` pass with no change to their expected values
- [X] T088 [US6] Regression of the experiment: `node scripts/compare-baseline.mjs --world=world/world-connectome.json --verbose` gives the same v0 values as the baseline in `baseline.txt` (T001). Record the comparison in `specs/008-hungry-forager-brain/regression.md`

**Checkpoint**: v0 numbers are unchanged; the v1 LIF is bit-exact off and verified on.

---

## Phase 9: User Story 7 - Compare Brains and Behaviour Over Seeds (Priority: P3)

**Goal**: The experiment compares the arms (mock, v0, v1, random-matched, baseline) over held-out seeds and reports the five forager metrics.

**Independent Test**: `node scripts/compare-baseline.mjs --world=world/world-forager.json` prints one row per arm with the metrics, the
seed count and the verdict per metric.

### Tests for User Story 7 (write first)

- [X] T089 [P] [US7] Write `tests/metrics.test.mjs`: find rate; approach median for flies starting beyond one odour radius; eat bout median by energy class; walked share; hunger dependence; the bootstrap interval is the same for the same seed. *Write first*
- [X] T090 [P] [US7] Write `tests/validate-held-out.test.mjs`: `experiment.heldOut` must be 30 seeds and must not overlap `experiment.seeds`; the message names the overlapping seeds. *Write first*

### Implementation for User Story 7

- [X] T091 [US7] Create `public/js/fly/metrics.js` (pure) per [experiment-metrics.md](contracts/experiment-metrics.md): `findRate`, `approachMedian`, `eatMedian`, `walkedShare`, `hungerDependence`, `bootstrapCI(values, seed)`. T089 passes
- [X] T092 [US7] Update `public/js/world/validate.js` for `experiment.heldOut` (T090 passes)
- [X] T093 [US7] Extend `scripts/compare-baseline.mjs`: `--brains=` picks the arms (`mock`, `v0`, `v1`, `random-matched`, `baseline`); `--seeds=held-out` uses `experiment.heldOut`; `--json=` writes the run record. The loop is `forager-step.js` (T049), so the experiment and the browser use the same code. Keep the existing v0 arm and its output
- [X] T094 [US7] Add `experiment.heldOut` (30 seeds, not overlapping the calibration seeds) to `public/world/world-forager.json`
- [X] T095 [US7] Gate C run after calibration (T096): `node scripts/compare-baseline.mjs --world=world/world-forager.json --brains=mock,v0,v1,random-matched,baseline --seeds=held-out --json=specs/008-hungry-forager-brain/gate-c.json`. Write the table and verdicts to `specs/008-hungry-forager-brain/gate-c.md`. A failing metric is reported as failing

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Calibration, browser timing, documentation and the final checks.

- [X] T096 Calibration on the calibration seeds (`experiment.seeds` in `public/world/world-forager.json`, separate from the held-out set): choose `synapticScale`, `tauSyn`, `tauAdapt`, `adaptStep`, `thresholdJitter`, `stepsPerTick`, the modulator gains, `consumeRate`, `regrowth`, `eatSpeed`, `antennaOffset`. Record the chosen values, the seeds and the reason in `specs/008-hungry-forager-brain/calibration.md`. Remove the "placeholder" markers from `world/README.md`
- [ ] T097 [P] Gate B timing harness: create `public/tests/forager-timing.html` (six `v1` flies, 60 seconds, mean and p95 tick time per fly printed to the page). Run it and record the numbers in `specs/008-hungry-forager-brain/gate-b.md`, including the `stepsPerTick` used
- [X] T098 [P] Documentation: update `public/world/README.md` with the brain choice (`mock`, `v0`, `v1`), the forager world and the held-out seeds. Update the header comment of `public/js/brain/fly-brain.js` to describe the dispatcher
- [X] T099 [P] Check there are no stale imports: `grep -rn "brain/lif.js" public scripts tests` returns nothing, and `public/js/brain/lif.js` does not exist
- [X] T100 Verify the calibration record: `specs/008-hungry-forager-brain/calibration.md` exists (created in T096), and every value in `public/world/world-forager.json` that T096 set matches it. No placeholder marker remains in `public/world/world-forager.json` or in `public/world/README.md`
- [X] T101 Run the full suites: `npm test` and `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract`. Every test passes, including the 257 and 95 from the baseline
- [ ] T102 Run the quickstart ([quickstart.md](quickstart.md)) steps 1–5 end to end, and record the outputs in `specs/008-hungry-forager-brain/quickstart-run.md`
- [X] T103 Confirm the repository state: `data/` is still ignored (dataset not committed), the forager snapshot is 2–3 MB (ADR 003 cost estimate), and `git status` shows only the intended files

**Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch. The app draws only neurons with a soma for snapshot brains (FR-030). No task in this file was a false completion; T104–T107 are new.

- [X] T104 [P] Write `tests/app-drawn-neurons.test.mjs` (write first, must fail): parse `public/brains/forager-brain.brain` with `parseSnapshot`; the neurons the app's layout draws are exactly those with a non-null `soma` (2,444 of 3,408), and the same index set as `drawableNeurons` in `public/brains/js/model.js`. Covers SC-010.
- [X] T105 Update `public/js/brain/layout.js`: export `drawnNeurons(neurons)`, the indices of neurons with a soma, in index order. For snapshot brains `neuronPositions` returns positions for those neurons only. Toy brains keep the seeded sphere for every neuron. T104 passes.
- [X] T106 Update `public/js/fly/fly-host.js` (`positionsFor`) and `public/js/ui/panel/sections/neuron-map.js`: the record keeps the drawn indices with the positions; brightness from `activity` is mapped through those indices before `cloud.update`; the counts line reads "N neurons, M not drawn (no soma position), K active in the last W ticks". Depends on T105.
- [ ] T107 Verify in the browser: open the forager world from `public/` with a static server; the Fly pane's brain activity shows the same shape as the inspector for `forager-brain.brain`. Check `sizeAttenuation` in `public/js/viz/point-cloud.js` too (BUG-001 "not verified" item). Record the result in `specs/008-hungry-forager-brain/bugs/BUG-001.md`. Depends on T106.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 must run before any change.
- **Foundational (Phase 2)**: depends on Setup. Blocks every user story. Within it: 2a (v0 preservation) → 2b (LIF v1) → 2c (readers) → 2d (protocol) → 2e (extractor, which ends with T036 generating the artifact).
- **User stories**: depend on Foundational. Within the P1 stories, US1 → US2 → US3 is the behaviour chain (approach, eat, leave). US4 (brain choice) is independent of US1–US3 after Foundational. US5 (extractor CLI) is mostly done in Foundational, so it only adds tests and Gate A. US6 depends on T011a. US7 depends on US1–US3 (it runs the same loop) and on calibration (T096).
- **Polish**: depends on the stories it documents. T096 (calibration) must finish before T095 (Gate C).

### Story Dependencies

- **US1 (P1)**: needs T036, T043–T054.
- **US2 (P1)**: needs US1 (the loop in `forager-step.js`).
- **US3 (P1)**: needs US2 (energy and bouts).
- **US4 (P1)**: needs Foundational (T006–T008, T016, T019) and T036.
- **US5 (P2)**: needs Foundational extractor (T020–T036).
- **US6 (P2)**: needs T011a and T041.
- **US7 (P3)**: needs US1–US3, US6 (for the regression), and T096.

### Parallel Opportunities

- Setup: T001 and T002 run together.
- Foundational: T010, T013, T015, T017, T022, T024, T028, T033 are test-first tasks in different files and can be written in parallel. The `lif-v0`/`fly-brain` rename (T003–T006) is sequential.
- US1: T039–T042 (tests) and T053 run in parallel. T051 is parallel to T043–T048.
- US2–US3: T056, T064 and T065 are tests written in parallel.
- US5: T076–T078 are parallel.
- US6: T083–T085 are parallel.
- US7: T089 and T090 are parallel.
- Polish: T097, T098 and T099 are parallel.

### Parallel Example: User Story 1

```text
# tests first, in parallel (different files):
T039 tests/stimulus-bilateral.test.mjs
T040 tests/forager-body.test.mjs
T041 tests/fly-brain-v1.test.mjs
T042 tests/forager-step.test.mjs
T051 tests/panel-inputs-v1.test.mjs
T053 tests/action-forager.test.mjs
```

---

## Implementation Strategy

### MVP scope

The spec marks US1–US4 as P1, and the hungry behaviour needs US1, US2 and US3 together. The **suggested MVP** is therefore
Phases 1–2, then US1, US2, US3 (approach, eat, leave), with US4 as the first increment after it so the brain can be chosen in config.
US1 alone shows the fly turning toward food, but it does not eat or leave.

### Incremental delivery

1. Phases 1–2: v0 unchanged, v1 LIF bit-exact off, forager artifact generated (T038 checkpoint)
2. US1: the fly approaches food (checkpoint: T039–T042, T051, T053 green)
3. US2 and US3: eat and leave (checkpoint: T056, T064, T065 green)
4. US4: the brain is chosen in config (checkpoint: T068, T069 green)
5. US5 and US6: extraction gates and v0 regression (checkpoints: T080–T082, T087, T088)
6. US7 and Polish: calibration, the comparison, the timing record

---

## Notes

- Every task names the file it changes. A task marked `[P]` touches a different file from its neighbours in the same group.
- Test tasks marked *write first* must fail before their implementation task runs.
- Gates record numbers. A failing number is reported with the run that produced it; the data and the mechanism are not changed to pass it (ADR 003 Gate C, spec FR-028).
- Commits are not part of these tasks. Commit only when the user asks.
