# Implementation Plan: Mushroom-Body Valence Learning

**Branch**: `019-mb-valence-learning` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-mb-valence-learning/spec.md`

## Summary

The 14.5K brain already contains the whole mushroom body: 4,064 KCs, 97 MBONs (37 types), 316 PAM and 16 PPL1
DANs, and 33,496 KC→MBON edges (research.md §0). It has no plasticity. This feature adds learning in three parts:
the precondition, the learning itself, and the evidence that it works.

1. **Precondition.**
   - Two non-overlapping food odours: A, fruit (DM1, DM2, DM4), and B, floral (VA2, DP1m, VM5d). They come from a
     new extraction config (`forager-brain-mb`); the wide brain is untouched.
   - Flowers carry a scent.
   - A **regime gate** measures whether the KC code is sparse, reliable and distinct for A and B, before any
     learning code is written. If the brain sits in an up-state, the one remedy is a declared LIF pathway gain
     (L11). If the gate still fails, the feature stops at a recorded finding.
2. **Learning.**
   - A LIF plasticity option (L12), off by default, in the worker. It applies a per-edge `wmod ∈ [wMin, 1]` on
     KC→MBON edges only.
   - KC eligibility traces, and dopamine as the DAN pool rate above its baseline minus a threshold.
   - Reward depresses KC→avoid-MBON edges and punishment depresses KC→approach-MBON edges, with slow recovery.
   - Neuron groups and MBON roles (each with a literature citation) live in a checked-in `learning-v1` sidecar.
   - Teaching signals are measured in the connectome first. Only the ones it does not carry are injected through
     declared DAN input channels, labelled as injected.
3. **Evidence.**
   - The decoder reads a per-odour learned valence ℓ ∈ [0.5, 1.5] from MBON spikes and scales the declared `v_p`.
   - A network-path probe decides whether learning reaches eat and stay through the connectome. If not, a declared
     fallback rule (W16) applies ℓ to the eat and stay decisions.
   - Conditioning and behaviour experiments run four arms (plastic, frozen, DAN-shuffled, random graph) on
     held-out seeds and two maps, and report stay time and eat fraction per scent before and after training, and
     the decay.

## Technical Context

**Language/Version**:
- Plain ES modules (browser and Node 20+), no transpiler.
- Python 3 for the extractor (one validation rule and one config).

**Primary Dependencies**:
- No new dependencies. Reuses `lif-v1.js`, `fly-brain-v1.js`, `decoder.js`, `body-layer.js`, `stimulus.js`,
  `metrics.js`, `scripts/forager-arms.mjs` (`rewire`), and the `microfly-calibrate` C2 stage.
- Python: the pinned `pyarrow` and `numpy`.

**Storage**: Static files only:
- `public/brains/forager-brain-mb.{brain,decoder.json,learning.json}`;
- `public/world/world-forager-learning*.json`;
- results JSON and Markdown under `specs/019-mb-valence-learning/`.

**Testing**:
- `npm test` (`node:test`), `npm run test:slow`.
- Extractor `unittest`.
- New: `tests/lif-plasticity-golden.test.mjs`, `tests/lif-plasticity.test.mjs`, `tests/learning-v1.test.mjs`,
  `tests/world-learning.test.mjs`, and protocol-addition tests on both sides.

**Target Platform**:
- Evergreen browsers: one module worker per fly.
- Node for the probes and experiments.

**Project Type**: The existing single-project static web app plus the Python extractor (AGENTS.md layout).

**Performance Goals**:
- Plasticity adds at most about 37K multiply-adds per LIF step, against a spike pass over 730K edges. Target: ≤ 10 %
  more worker time per tick.
- The 6-fly learning world runs at the same frame rate as the demo world (SC-007).

**Constraints**:
- With every new parameter at its default, the spikes are bit-identical to today's (G1, G6).
- The plastic run is deterministic (G7).
- Snapshot weights are never written (G8).
- Tuning uses calibration seeds; verdicts use held-out seeds.
- The wide brain and the demo world's Part K stay unchanged (FR-027).

**Scale/Scope**:
- One new snapshot, sidecar and world pair.
- 2 new LIF parameters, 1 new contract (learning-v1), and 3 contract amendments.
- 5 Node scripts, 1 ADR and 1 constitution MINOR amendment.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | Plain ES modules, a JSON sidecar, no new dependency, no build. | PASS |
| II. One Fly, One Worker | Plasticity runs inside `lif-v1.js` in each fly's worker. The host only decodes spikes it already receives (ℓ, research.md §7) and reads a 4-float telemetry field. A fly's `wmod` never leaves its worker. Protocol 3 gains only an optional field, documented with tests on both sides. | PASS |
| III. Connectome-Grounded | Weights still come from synapse counts. `wmod` is a run-time modifier on a copy, and the snapshot array is never written (G8). Groups are selected by dataset `class`/`type`. MBON roles are per type with a citation, never from transmitter. Injected teaching channels are declared snapshot channels on dataset DAN neurons. The random-graph arm uses the same sidecar and decoder rule. **L11 `pathwayGain`** scales edge classes chosen by dataset identity; see Complexity Tracking. | PASS (justified) |
| IV. Reproducible Extraction | The two odours and the teaching pairs are a new config file. The only code change is the `E-POOL-OVERLAP` validation, a named error. The same config gives a byte-identical snapshot. | PASS |
| V. Faithful, Inspectable LIF | The plasticity bullet requires a decision record (ADR 011), named and bounded parameters ([wMin, 1], ℓ ∈ [0.5, 1.5]), off by default (`null`), determinism given the seed (G7, seeded shuffle stream, integer counters), and telemetry (`motor.learning`, panel). Every parameter is in `LIF_V1_DEFAULTS` and validated. `lif-golden` is unchanged. | PASS |
| VI. Living World, Embodied Flies | **Blocked until amended**: "valence … shown … as declared, not learned". Phase A amends this bullet: the declared sign stays, and learning MAY scale strength within decision-record bounds, shown as "declared × learned". Everything else holds: ℓ is read from MBON spikes; W16 reads only decoded values, is declared in data, off by default and identical across arms; the scent fields and world events are declared stimuli on declared snapshot channels (the new-sense rule); events come from the fly's own body and the food table. | PASS after amendment (Phase A) |
| VII. Simplicity | It extends `lif-v1.js` behind defaults instead of a `lif-v2`. A sidecar like `decoder.json` instead of a container change. Two teaching pairs are extracted once rather than re-extracted on demand. | PASS |
| Demo Acceptance | The new brain's behaviour is reported on held-out seeds and two maps, with one calibration. The random walk and matched random graph are reported, and a null arm that passes is stated. | PASS (planned in Phase G) |

**Post-design re-check** (after research.md, data-model.md and contracts/):
- No artifact writes snapshot weights, and none reads the stimulus in the body layer.
- None puts neural computation on the main thread, or adds a dependency or build step.
- The only open gate is still VI, closed by Phase A before any code.
- Complexity Tracking lists the three deliberate choices. No gate is reopened.

## Project Structure

### Documentation (this feature)

```text
specs/019-mb-valence-learning/
├── spec.md
├── plan.md                 # this file
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── lif-v1-plasticity.md          # L11 pathwayGain, L12 plasticity (amends 008 lif-v1.md)
│   ├── learning-v1.md                # learning sidecar (new) + decoder-v1 optional key
│   ├── world-config-v3-learning.md   # scents, events, W16, experiment schedule (amends 017)
│   └── worker-protocol-v3-learning.md# init.brain.learning, motor.learning (amends 008)
├── regime-gate.{json,md}   # Phase C output
├── conditioning.json       # Phase F output
├── results.{json,md}       # Phase G output
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
extract/
├── configs/forager-brain-mb.json          # NEW: odour-food-a/b, reinforcement-reward/punish pairs
├── malecns_brain/config.py                # AMENDED: E-POOL-OVERLAP across input pairs
└── tests/                                 # NEW tests: overlap error; DAN input pool not double-counted in fill

public/brains/
├── forager-brain-mb.brain                 # NEW (generated)
├── forager-brain-mb.decoder.json          # NEW (C2, with learning.naive)
├── forager-brain-mb.learning.json         # NEW (hand-written, cited)
└── brains.json                            # AMENDED: lists the new brain

public/js/brain/
├── lif-v1.js                              # AMENDED: L11 pathwayGain, L12 plasticity, net.learning
├── learning.js                            # NEW: learning-v1 reader + group resolver (pure)
├── fly-brain-v1.js                        # AMENDED: passes neuronClass, learning groups; returns learning telemetry
├── worker-core.js, protocol-v3.js         # AMENDED: init.brain.learning, motor.learning

public/js/fly/
├── decoder.js                             # AMENDED: ℓ per food pair; v_p·ℓ in W13
├── body-layer.js                          # AMENDED: W16 feed/stay (off by default)
├── stimulus.js, fly-world.js              # AMENDED: scent-filtered fields; from:"events" stimuli
├── fly-host.js                            # AMENDED: event pulses, loads learning sidecar, stores motor.learning
├── metrics.js                             # AMENDED: visits by scent, eat fraction per visit
└── fly-config.js                          # AMENDED: defaults for new keys

public/js/ui/                              # AMENDED: panel "Learning" block, injected tags
public/js/world/validate.js                # AMENDED: new keys and errors
public/world/
├── world-forager-learning.json            # NEW: sketch map, both scents
└── world-forager-learning-tilemap.json    # NEW: second map

scripts/
├── mb-regime-probe.mjs                    # NEW: Phase C gate
├── mb-teaching-probe.mjs                  # NEW: Phase D
├── mb-conditioning-probe.mjs              # NEW: Phase F (rebuilt from smallfly learn_test description)
├── mb-network-probe.mjs                   # NEW: Phase F, network vs W16
└── learning-arms.mjs                      # NEW: Phase G behaviour experiment (reuses forager-arms rewire)

tests/
├── lif-plasticity-golden.test.mjs         # NEW: G6, G7, G8
├── lif-plasticity.test.mjs                # NEW: rule on a labelled synthetic fixture
├── learning-v1.test.mjs                   # NEW
├── world-learning.test.mjs                # NEW: validator, scents, events, W16 at ℓ=1
└── protocol-v3-learning.test.mjs          # NEW: both sides

adrs/011-mb-valence-learning.md            # NEW
.specify/memory/constitution.md            # AMENDED via /speckit-constitution (v2.2.0)
README.md, public/world/README.md          # AMENDED: learned gain shown as declared × learned
```

**Structure Decision**: The existing single project, extended in place. The learning state lives where the weights
live (the LIF core, in the worker). The readout lives where decoding lives (`decoder.js`, main thread). The
declarations live in data: the extraction config, the learning sidecar, and the world config.

## Phases and gates

The order is binding. Each phase ends at a gate. Spec FR-008 makes Phase C a hard stop.

| Phase | Work | Gate |
|---|---|---|
| **A. Governance** | `/speckit-constitution`: Principle VI learned-gain bullet (v2.2.0). ADR 011 skeleton (Proposed). | Constitution amended; ADR filed |
| **B. Two odours** | `E-POOL-OVERLAP` and tests; check DAN input pools against seeds and fill (research.md §6 risk); `forager-brain-mb.json`; extract; scent fields in the world; two learning worlds; C2 decoder for the new brain (learning off). | Extractor tests green, byte-identical rerun, wide brain unchanged, new world runs |
| **C. Regime gate** | L11 `pathwayGain` (default null, G1 holds); `mb-regime-probe.mjs`; run on calibration seeds; remedy if up-state. | **Pass, or stop and record the finding in ADR 011** |
| **D. Teaching signals** | `mb-teaching-probe.mjs`; declare `reinforcement:*` events only for the signals the connectome doesn't carry. | ADR 011 lists carried and injected signals |
| **E. Plasticity core** | `learning.js` and the sidecar (cited roles); L12 in `lif-v1.js`; runner and protocol additions; golden and unit tests. | `npm test` green incl. G1, G6–G8 |
| **F. Readout** | ℓ in the decoder (with C2 `learning.naive`); `mb-conditioning-probe.mjs`; `mb-network-probe.mjs`; W16 only if the network path doesn't carry. | SC-002 on held-out seeds; the path choice recorded in ADR 011 |
| **G. Experiments** | `learning-arms.mjs`; B-punished (sketch), A-punished (tilemap), A-only; four arms; decay. | SC-003–SC-005 reported, with nulls stated |
| **H. Panel and close** | Panel Learning block and injected tags; README; regression (Part K unchanged); run check. | SC-006–SC-008; ADR 011 Accepted |

## Complexity Tracking

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| L11 `pathwayGain`: a gain on dataset-selected edge classes (doc/research.md §4 lists pathway gains as blocked by Principle III) | It is the only remedy the user allows if the KC code is in an up-state. Without a sparse, distinct code, learning generalises to every odour. Relative weights within each class stay synapse-derived, as with L6 `outputScale` and L8 `inhibitoryScale`. It is used only if the gate fails, and it is recorded in ADR 011. | Re-extracting with a higher `minSynapses` changes the whole brain. Hand-editing PN→KC weights breaks Principle III outright. |
| A new sidecar contract (`learning-v1`) | MBON roles need a per-type citation and the groups belong to a snapshot. A sidecar mirrors `decoder-v1`. | Putting them in the container header needs a format change on both sides (Python and JS) for data that isn't connectome. Putting them in world config ties a snapshot's indices to a map. |
| Teaching pairs extracted up front (`reinforcement-*` on PAM and PPL1) | One extraction serves both outcomes of the Phase D probe. Undriven channels are 0, so the neurons behave as interneurons. | Extracting again after the probe doubles the slowest step. Driving DANs from code without a channel breaks Principle VI. |
