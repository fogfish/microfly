# Implementation Plan: Hungry Forager Brain

**Branch**: `008-hungry-forager-brain` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-hungry-forager-brain/spec.md`, plus planning input: "Write an utility to parse
malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md. Preserve compatibility of the simulator
with previous versions allowing user to choose between mock, small brain v0 and the new brain v1 via config. The goal is
comparison of various brain behaviours."

## Summary

Build the ADR 003 forager brain end to end, and keep the two existing brains running beside it so they can be compared.

- **Extractor** (Python): one config-driven command writes either the ADR 002 small brain (container version 3) or the
  ADR 003 forager brain (container version 4), chosen by the config's format. The forager selection is the flow ranking
  of ADR 003 D3, with side-matched odour pools, bilateral taste pools, and output pools with declared drives.
- **Simulator** (browser, pure JS): the v0 LIF and v0 runner keep their behaviour and files (`lif-v0.js`, `fly-brain-v0.js`,
  `protocol.js`). The v1 LIF (`lif-v1.js`) adds the ADR 003 L1–L5 mechanisms, all off by default, so with them off it
  reproduces v0 bit for bit. The v1 runner (`fly-brain-v1.js`) drives pools with hunger gain and reads outputs by drive.
- **World and body**: hunger (energy), eating physics, flower stock and bilateral odour are added for v1 only, in pure modules.
- **Choice**: one config key, `flies.brain.version` (`mock`, `v0`, `v1`), selects the whole stack (LIF, runner, protocol,
  snapshot reader). Existing world files work unchanged.
- **Comparison**: the experiment script runs the arms (mock, v0, v1, random-matched, baseline) over the same world and held-out
  seeds and reports the five forager metrics per arm (ADR 003 Gate C, measured not gated).

Design decisions and their reasons are in [research.md](research.md). Entities are in [data-model.md](data-model.md).
Formats are in [contracts/](contracts/). The runnable guide is [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: JavaScript ES2022 (browser ES modules, Node 20+ for tests). Python 3.14 with the extractor's own
environment (`extract/.venv`) for the dataset tools.

**Primary Dependencies**: None new. Browser: Canvas 2D, Web Workers, typed arrays, three.js (already vendored, unchanged).
Python: `pyarrow==25.0.1`, `numpy==2.5.3` (already in `extract/requirements.txt`).

**Storage**: Snapshot files `public/brains/*.brain` (committed, as the existing ones are). Dataset is external
(`data/malecns`, not committed, configured by `MALECNS_DIR`). Flower stock and energy are in memory and reset on reload.

**Testing**:
- JavaScript: `npm test` (Node built-in runner, `tests/*.test.mjs`). Baseline 257 of 257 passing.
- Python: `extract/.venv/bin/python -m unittest discover -s extract/tests -t extract`. Baseline 95 of 95 passing.
- Golden and equality tests: `lif-golden` (v0 unchanged), `lif-v1` bit-exact off (contract G1), container v4 round trip.
- Gate A (extractor) and Gate B (simulator timing) are recorded runs, described in [quickstart.md](quickstart.md).

**Target Platform**: Evergreen browsers (module workers, typed arrays). Extractor: macOS and Linux with Python 3.14.

**Project Type**: Static web app (browser simulator) and a Python extraction pipeline. The app remains buildless (Principle I).

**Performance Goals**:
- Extraction: the forager config completes on the full v1.0 dataset within the same order of time as the ADR 002 configs
  (minutes, not hours). Peak memory recorded in Gate A.
- Simulator: six v1 flies at 20 Hz with `stepsPerTick` steps keep the main thread responsive (ADR 003 Gate B). The
  measured per-tick time is recorded; the target is a tick budget below 50 ms of work per visible frame.

**Constraints**:
- No neural computation on the main thread (Principle II). Stock and energy are world and body state, updated by the host.
- No change to a v0 result: v0 files, v0 worlds, the golden test and the experiment's v0 arm are byte- and value-identical.
- Dataset rows are streamed and column-selected, never loaded whole (Principle IV).
- Every sort and every tie has an explicit key ending in `bodyId` (determinism).

**Scale/Scope**:
- Forager brain: about 3,900 neurons and 222,000 edges (ADR 003 A4 at budget 3,000).
- Six flies by default; up to 64 is allowed by the world validator.
- Four input channels and five output drives.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` (version 1.0.0, principles I–VII).

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Static Web, Zero Build | Pass | No build step, no new runtime dependency. The forager snapshot and world file are static files. |
| II. One Fly, One Worker | Pass | Each v1 fly keeps its own worker. Stock and energy are held by the host (the world's owner), not shared into a worker. Protocol 3 is documented (contract). |
| III. Connectome-Grounded Brain Snapshots | Pass | Version 4 header records provenance, the config hash, and the dataset release. Weights come from synapse counts. Sign comes from dataset predictions, with the low-confidence rule stated (ADR 003 D2). The synthetic test fixture is labelled. |
| IV. Configurable, Reproducible Extraction | Pass | The forager config declares every pool, budget, drive and weight rule. Same config and dataset give byte-identical output apart from `createdAt` (self-check). Dataset is streamed. The config's expected counts are checked against the dataset. |
| V. Faithful, Inspectable LIF Simulation | Pass | Every v1 parameter is named in `LIF_V1_DEFAULTS`, validated, and documented in the LIF contract. The core stays pure. The seeded jitter keeps runs reproducible. Telemetry (spikes, outputs, inputs, hunger, energy) is exposed. |
| VI. Living World, Embodied Flies | Pass | Flies perceive inputs only through declared channels. Eating is world physics, gated by the brain's feed output (ADR 003 W2): the world never stops a fly. Drive mapping is declared in the snapshot (W4). The random-walk baseline stays labelled. |
| VII. Simplicity | Pass with justification | See Complexity Tracking: a second LIF core, runner, protocol and container version are the minimum that keeps v0 available and makes the comparison possible. |

**Result**: no unjustified violation.

### Gate notes

- **Principle III, synthetic fixtures**: the test fixtures for the forager (`extract/tests/fixtures/forager-synthetic.json`,
  `tests/fixtures/forager-small.brain`) are labelled as synthetic in their names and headers. They are never shipped in
  `public/brains/`.
- **Principle VI, eating gate**: the eating rule uses the feed output the brain produced, with a threshold declared in the
  world config. The world does not decide that a fly eats on a flower without the brain's signal.

## Re-check after Phase 1 design

All seven contracts and the data model follow the principles above. The contracts keep the v0 formats, so no v0
artifact changes. No new unjustified complexity was added in design. **Result: pass.**

## Project Structure

### Documentation (this feature)

```text
specs/008-hungry-forager-brain/
├── spec.md                       # /speckit-specify output
├── plan.md                       # this file
├── research.md                   # Phase 0 decisions R1–R17
├── data-model.md                 # Phase 1 entities and state rules
├── quickstart.md                 # Phase 1 runnable validation guide
├── contracts/
│   ├── container-v4.md           # brain container, version 4
│   ├── extract-config-forager.md # extraction config, format 3 and dispatch
│   ├── channel-declaration-v4.md # channel declaration rules for v4
│   ├── worker-protocol-v3.md     # worker messages, version 3
│   ├── lif-v1.md                 # LIF core, version 1 (G1–G5)
│   ├── world-config-forager.md   # flies.brain.version, body.energy, food, stimulus extras
│   └── experiment-metrics.md     # arms, held-out seeds, Gate C metrics
├── checklists/requirements.md
└── tasks.md                      # /speckit-tasks output (not created here)
```

### Source Code (repository root)

```text
extract/
├── configs/
│   ├── smallest-functional-brain.json   # unchanged (format 2, container 3)
│   ├── antennal-lobe-brain.json         # unchanged (format 2, container 3)
│   └── forager-brain.json               # NEW (format 3, kind forager, container 4)
├── malecns_brain/
│   ├── __main__.py                      # CHANGED: dispatch on format and kind; report per format
│   ├── config.py                        # CHANGED: formats 2 and 3; C1 check; forager keys
│   ├── container.py                     # CHANGED: write and read version 4 (version 3 unchanged)
│   ├── capabilities.py                  # CHANGED: v4 channel rules R1–R8 beside the v3 rules
│   ├── selection.py                     # unchanged (ADR 002 selection, container v3)
│   ├── selection_forager.py             # NEW: pools, side match, flow ranking, budgets, weights (ADR 003 D1–D4)
│   ├── admission.py                     # NEW: forager admission incl. output rule (D2); admit() in selection.py stays
│   ├── errors.py                        # CHANGED: new codes E-POOL-EMPTY, E-SIDE-IMBALANCE, E-OUTPUT-UNREACHED, E-NODE-RANGE, E-MODULATOR
│   ├── dataset.py                       # CHANGED: read rootSide, subclass, receptorType columns (column-selected)
│   └── migrate.py                       # unchanged
└── tests/
    ├── fixtures/
    │   ├── synthetic-config.json        # unchanged
    │   └── forager-synthetic.json       # NEW: labelled synthetic pools and graph for the failure codes
    ├── test_selection_forager.py        # NEW
    ├── test_container_v4.py             # NEW: write, read, invariants, the message set
    ├── test_config_forager.py           # NEW: dispatch pairs, C1, E-CONFIG messages
    ├── test_capabilities_v4.py          # NEW: R1–R8 rules and messages
    └── bench_forager.py                 # NEW: Gate A peak memory and time

public/
├── brains/
│   ├── forager-brain.brain              # NEW (generated by the extractor, committed)
│   ├── brains.json                      # CHANGED: adds the forager entry (manifest version 1 unchanged)
│   └── js/                              # CHANGED minimally: channel grouping for pools (ADR 003 W5)
├── world/
│   ├── world-forager.json               # NEW: v1 world, brain version "v1"
│   ├── world-forager-bad.json           # NEW: test fixture, v1 naming a v0 file (must refuse)
│   └── README.md                        # CHANGED: the brain choice and the forager world
├── tests/
│   └── forager-timing.html              # NEW: Gate B browser harness (six v1 flies, 60 s, tick timings)
└── js/
    ├── brain/
    │   ├── lif.js                       # RENAMED to lif-v0.js (code unchanged)
    │   ├── lif-v0.js                    # v0 LIF core (was lif.js)
    │   ├── lif-v1.js                    # NEW: LIF core with L1–L3 and L5 parameters (off by default)
    │   ├── fly-brain.js                 # CHANGED: dispatcher by flies.brain.version
    │   ├── fly-brain-v0.js              # NEW home of the v0 runner (was fly-brain.js body)
    │   ├── fly-brain-v1.js              # NEW: forager runner (pool inputs, hunger gain, drives, stepsPerTick)
    │   ├── protocol.js                  # unchanged (protocol 2, for mock and v0)
    │   ├── protocol-v3.js               # NEW: protocol 3 builders and validators
    │   ├── worker-core.js               # CHANGED: routes by message version (2 → v0, 3 → v1)
    │   ├── capabilities.js              # CHANGED: v4 rules R1–R8 beside v3; TOY and BASELINE unchanged
    │   └── snapshot.js                  # CHANGED: parses version 3 and version 4 (shared section code)
    ├── fly/
    │   ├── body.js                      # CHANGED: stepForagerBody added; stepBody (tank) unchanged
    │   ├── stimulus.js                  # CHANGED: senseBilateral added; senseAt (v0) unchanged
    │   ├── food.js                      # NEW: flower stock, consume, regrow (pure)
    │   ├── energy.js                    # NEW: metabolise, eat, canEat, bout rule (pure)
    │   ├── fly-config.js                # CHANGED: defaults for body.energy, food, brain.version
    │   ├── fly-world.js                 # CHANGED: flower stock table built from stimulusCells
    │   ├── fly-host.js                  # CHANGED: protocol by version; inputs and hunger per tick; eating; bouts
    │   └── action.js                    # CHANGED: forager action label beside the tank label
    ├── ui/panel/
    │   ├── model.js                     # CHANGED: inputs[k] per channel; energy and hunger rows
    │   └── sections/                    # CHANGED: energy row in Action; channel rows read per-channel values
    └── world/
        └── validate.js                  # CHANGED: flies.brain.version, body.energy, food, stimulus extras, version checks

scripts/
├── compare-baseline.mjs                 # CHANGED: arms via --brains; held-out seeds; forager metrics; --json
└── record-toy-golden.mjs                # unchanged

tests/
├── lif-golden.test.mjs                  # imports lif-v0.js; expected values unchanged
├── lif-v1.test.mjs                      # NEW: G1–G5
├── fly-brain-v1.test.mjs                # NEW: pool drive, gain, stepsPerTick, drives
├── snapshot-v4.test.mjs                 # NEW: parse, roles, modulators, CSR, version dispatch
├── capabilities-v4.test.mjs             # NEW: R1–R8 messages
├── protocol-v3.test.mjs                 # NEW: builders, validation, routing by version
├── forager-body.test.mjs                # NEW: stepForagerBody; sign test (odour on the left turns left)
├── food-energy.test.mjs                 # NEW: food.js and energy.js rules (FR-022–FR-026)
├── stimulus-bilateral.test.mjs          # NEW: two samples, stock weighting, empty flower gives 0
├── fly-config-brain.test.mjs            # NEW: version inference, defaults, mismatch refusal
├── metrics.test.mjs                     # NEW: find, approach, eat, leave, hunger dependence
└── …existing tests                      # unchanged expected values
```

**Structure decision**: The v0 modules keep their names, except `lif.js`, which becomes `lif-v0.js` as the user asked.
The new v1 modules sit beside them under the `-v1` name. This keeps every v0 test on the code it tests, and it keeps the
two brains independently readable. The Python extractor gets one new selection module and one admission module, so
`selection.py` (ADR 002, container v3) is not touched.

## Phases

The plan is ordered so that each phase leaves v0 green. `tasks.md` (from `/speckit-tasks`) turns these into tasks.

1. **v0 preservation** (no behaviour change): rename `lif.js` to `lif-v0.js`, move the runner body to `fly-brain-v0.js`,
   add the dispatcher, add `flies.brain.version` inference and validation. Run the full suite: 257 of 257 must pass.
2. **Extractor, forager**: admission, pools, side match, flow ranking, budgets, weights, container v4 writer and reader,
   config format 3. Synthetic fixture first (failure codes), then the real v1.0 run (Gate A). Extractor suite 95 of 95 plus
   the new tests.
3. **Simulator, LIF v1**: `lif-v1.js` with defaults off. Gate G1 (bit-exact against `lif-v0.js`) before any mechanism is
   turned on. Then L1, L2, L3, L5 each with its test.
4. **Protocol, runner and worker**: protocol 3, `fly-brain-v1.js`, worker routing by version. Snapshot v4 parse in the browser.
5. **Body, world and eating**: `food.js`, `energy.js`, `stepForagerBody`, bilateral stimulus, host wiring, bout records.
   Eating tests (FR-022–FR-026) before the host wiring.
6. **Panel and inspector**: per-channel input rows, energy row, forager action label, inspector grouping by channel.
   **Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch. The brain activity view (`neuron-map.js`) draws snapshot
   neurons that have a soma only, and states how many were left out (FR-030). Toy brains keep the seeded sphere
   (`layout.js`). Tasks T104–T107.
7. **Experiment**: arms via `--brains`, held-out seeds, metrics (pure), run record. Gate C run.
8. **Calibration and Gate B**: calibration on the calibration seeds (values recorded), browser timing harness, the
   recorded tick budget.

## Risks

- **Flow and feeding (ADR 003 Q4)**: MN9 receives 18 edges at the default budget. If `feed` stays silent, eating never
  starts and the behaviour metrics fail. Mitigation: the config options in ADR 003 Q4 (budget, feed pool, separate flow).
  Each is a config change, recorded.
- **Linear falloff and left-right contrast**: the difference between the two antenna samples is small. Mitigation:
  adaptation (L2) and the AL-like contrast in the runner, and calibration of `antennaOffset`. If calibration fails, the
  finding is recorded as the result.
- **Cost of 3,900 neurons at `stepsPerTick` 5 in the browser**: may exceed the budget. Mitigation: fewer steps per tick
  (config), then a smaller budget (config). Gate B records which.
- **Peak memory of the extraction**: the restricted edge table is the largest structure. Mitigation: `int32` and `uint16`
  arrays, streamed reads, the Gate A measurement.
- **Float reproducibility of the flow**: numpy on different platforms can differ in the last bit. Mitigation: fixed
  iteration count, explicit sort keys, and the self-check within one machine. The byte-identical claim is per platform,
  stated in the report.
- **v0 regression**: the rename and the dispatcher touch every brain path. Mitigation: phase 1 is done and tested before
  any v1 code, and the golden tests are not edited.

## Complexity Tracking

> Constitution Check violations and the reasons they are needed.

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| VII: a second LIF core (`lif-v1.js`) beside `lif-v0.js` | The user requires v0 to stay available, and the comparison needs both models running unchanged. The v1 mechanisms (synaptic current, adaptation, jitter, steps per tick) add state that v0 must not have. | Adding flags inside `lif.js` would fork its hot loop and risk changing v0 results. Two files keep v0 bit-identical by construction. |
| VII: a second runner (`fly-brain-v1.js`) and a dispatcher | v1 drives pools with hunger gain and reads drives by name, which v0's single sensory neuron cannot express. | Generalising v0's runner would change its contract (one input, two tank drives) and all its tests. |
| VII: a second worker protocol (version 3) | `sense` must carry a vector of inputs and a hunger state. Protocol 2 is a documented contract with tests. | Overloading protocol 2 would make every v0 message ambiguous. The version check in `worker-core` is one line. |
| VII: container version 4 beside version 3 | The ADR 003 header carries pools, modulators and the weight rule, which version 3 cannot express. Both are read by the same section code. | Changing version 3 would invalidate the existing small brain files and their tests (spec SC-002). |
| VII: a new eating and energy layer (`food.js`, `energy.js`) | ADR 003 W1–W2 make eating and hunger physics, which the world does not have. | Counting contacts (as v0 does) rewards spinning, which the spec rejects. |
| VII: a second extraction format | The user requires the extractor to produce multiple formats. | A separate tool per format would duplicate the CLI, provenance and self-check. |
