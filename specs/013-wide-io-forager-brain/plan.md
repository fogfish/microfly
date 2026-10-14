# Implementation Plan: Wide-I/O Forager Brain (Brain v2)

**Branch**: `015-wide-io-forager-brain` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-wide-io-forager-brain/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Re-extract the 11K class-seeded brain (ADR 006) with its topology rule untouched but its four-input/five-output
interface replaced by ADR 007's twelve bilateral inputs (food odour, danger odour, heat, mouth taste, leg taste,
touch) and six outputs (turn L/R, forward, backward, feed, escape). The extractor keeps its `classSeed` strategy and
gains a format-5 config shape (new filter keys `entryNerves`/`excludeReceptorTypes`, `pair`-keyed side matching, a
declared `fidelity.checks` list) rather than a new strategy module, because the topology rule itself does not
change (ADR 007 D18). The snapshot gains a new header `kind`, `"forager-wide"`, under the same container binary
version (4); channel declaration gains a v5 variant (inputs carry `sense`/`site`, outputs carry six drives) that
applies only to that kind, so `kind: "forager"` snapshots (v1, 11K) keep v4 rules untouched. The simulator adds one
new brain-version value, `"v2"`, that runs the existing `lif-v1.js`/`fly-brain-v1.js` unchanged — no LIF mechanism
is added — and selects a new, declared-sense host sensing path (world `flies.stimuli`/`flies.body.sites`) instead of
`forager-step.js`'s hard-coded four-channel sensing, which stays bit-for-bit as is for `"v1"` flies. The side panel
needs no new code: its channel rows are already driven by the declaration's `label`/`side`/`range`, so twelve inputs
and six outputs (including the always-visible, physics-gated-off `escape` telemetry) render through the existing
generic sections. `mock`, `v0`, the shipped `v1` forager and the 11K brain keep working with no edit.

## Technical Context

**Language/Version**: Python 3 (extractor: stdlib + pinned `pyarrow`, `numpy`) and plain ES2022+ JavaScript (app and
dev scripts; Node 20+ for scripts and tests). No new language introduced.

**Primary Dependencies**: `pyarrow`, `numpy` (already pinned in `extract/requirements.txt`) for dataset reads, the
wider pool selection and the generalised fidelity probe. The browser app stays dependency-free (native ES modules).
No new runtime dependency anywhere.

**Storage**: MaleCNS v1.0 Feather files (external, git-ignored, read via `MALECNS_DIR`) in; one new `.brain` binary
snapshot (`forager-brain-wide.brain`, container v4, header `kind: "forager-wide"`) out. No database.

**Testing**: `python -m unittest discover` under `extract/tests` for the new filter keys, pair-keyed side matching,
the generalised fidelity probe/checks, and the format-5 config dispatch, against small labelled synthetic fixtures
(constitution V, "Tests"). `npm test` (Node's built-in test runner) for the v5 channel declaration, the
`forager-wide` container header, the `v2` brain dispatch, the declared-sense host sensing, the escape-physics gate
in `body.js`, and a contract test that the existing generic panel sections render twelve input and six output rows
unedited. `npm run test:slow` for the existing long behaviour suites, unaffected. Manual check: `python3 -m
http.server 8000` from `public/`, opening the new world with no console error (constitution, "Run check").

**Target Platform**: evergreen browsers (Chrome, Firefox, Safari) for the app; Linux/macOS CLI for the Python
extractor and the Node calibration/comparison scripts (developer tooling, not shipped to the browser).

**Project Type**: existing single-repository project with three co-located parts — a static web app (`public/`), a
Python extraction CLI (`extract/`) and Node developer scripts (`scripts/`, `.claude/skills/`) — matching the layout
already fixed by the constitution's "Repository layout" constraint. Not a web-service or mobile app.

**Performance Goals**: six wide-I/O flies (≈11,000 neurons, ≈458K edges per ADR 007 Annex A4) keep the main thread
responsive at the world's 20 Hz tick rate, matching the shipped 11K brain's measured per-step cost (ADR 006);
re-measured and recorded at Gate B (spec SC-004). Extraction and the fidelity probe run as a batch CLI job on
developer hardware; no interactive latency target applies to them.

**Constraints**: zero build step; no new runtime dependency; no change to `lif-v1.js`'s default parameters, to the
worker protocol version, or to the container's binary version; `mock`, `v0`, the shipped `v1` forager and the 11K
brain keep working unedited (spec FR-001–FR-005); the dataset is never committed; extraction reads the dataset with
column selection/batched reads, never a whole large Feather file at once (constitution IV); the escape action
defaults to no effect on fly position (spec FR-019, SC-008).

**Scale/Scope**: one new extraction config (format 5) and incremental extensions to the existing `classSeed`
selection module (no new Python selection strategy); ~10,000–12,000 neurons, sharing ≥ 94% of neurons with the
shipped 11K brain, ≈8–9 MB snapshot (ADR 007 D18, Annex A4); one new world file; one new channel-declaration variant
(v5, dispatched by header `kind`); one new host sensing path, declared generically over `sense`/`site` instead of
hard-coded; one new body-physics gate (escape); zero new panel section modules (existing generic sections cover the
wider channel set); the existing comparison script gains one named arm and four new metric functions (brake, stay,
avoid, touch) plus one telemetry-only report (escape).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | No new runtime dependency; no bundler; no new vendored library. The extended calibration profile is a Node CLI dev tool, never loaded by the browser app. | **PASS** |
| II. One Fly, One Worker | The `v2` brain runs inside the existing per-fly worker through the unchanged `fly-brain-v1.js`/`lif-v1.js`/protocol v3 path, selected by `fly-brain.js`'s dispatcher exactly as `v1` is. No neural computation moves to the main thread; the main thread only gains a declared-sense sampling function, which is host-side world sensing, not brain computation. | **PASS** |
| III. Connectome-Grounded Brain Snapshots | Every new channel is a dataset filter (ADR 007 D15); weights stay synapse counts; sign stays the dataset's consensus-transmitter rule, unchanged. Every exclusion (ppk23/ppk25 from leg taste, mid/hind-leg GRNs, `ORN_DA2`) is a declared filter value with a measured, recorded reason (ADR 007 D16). The escape output's missing connectome driver is reported as telemetry, not wired around (D17). No edge is hand-wired. | **PASS** |
| IV. Configurable, Reproducible Extraction | The wider interface is one more declarative config (format 5, same `selection: "classSeed"` strategy); same config + dataset ⇒ byte-identical file; the channel-declaration and extract-config formats stay documented and versioned (v5 and format 5 are additive dispatch branches, not replacements — format 4/v4 keep extracting and loading exactly as today); dataset reads stay column-selected/batched. | **PASS** |
| V. Faithful, Inspectable LIF Simulation | No change to `lif-v1.js` or its parameters; same seed ⇒ same spikes (`tests/lif-golden.test.mjs` unchanged); the wider interface is declared data the existing generic runner already consumes by channel count, not a new mechanism. | **PASS** |
| VI. Living World, Embodied Flies | The stimulus→sensory and motor→action mapping moves from hard-coded (`senseForagerFly`) to declared data on both sides (snapshot `sense`/`site`, world `flies.stimuli`/`flies.body.sites`) — strictly more in the spirit of this principle, not less. The world still never steers, stops or feeds a fly; escape is physics gated by a brain output and a declared, off-by-default world value. | **PASS** |
| VII. Simplicity | The extractor gains config keys and generalises existing pure functions (`_matches_input`, `resolve_pools`'s side-matching, the fidelity probe) rather than adding a parallel selection module, because the topology rule is unchanged — the smaller change here, unlike the 11K feature's genuinely new strategy. The panel needs zero new section modules: the existing capability-driven generic rendering already covers an arbitrary channel count. | **PASS**, with a noted design choice |

**Simplicity note (not a violation, no Complexity Tracking entry needed):** extending `selection_class_seed.py` and
its shared helpers in place, instead of adding a new `selection_*` module, is the smaller change here specifically
because ADR 007 D18 fixes the topology rule as identical to the 11K brain's — only the pools and the probe's check
list differ, and both are config-driven already. This is the mirror image of the 11K feature's own choice (a new
module, because its selection *philosophy* was new); copying that pattern here would duplicate the whole-class-seed
and shared-weight-fill logic for no behavioural difference. Likewise, no new panel section is added: `inputs.js`,
`outputs.js`, `channel-rows.js` and `model.js` already render one row per declared channel from its `label`/`side`/
`range`, with no assumption about channel count — this is reuse of an existing, already-generic mechanism, not a
new abstraction.

**Post-design re-check (after Phase 1):** `research.md` and the `contracts/` resolve every design choice without a
new dependency, a worker-protocol or binary-container-version bump, a new LIF mechanism, or a new selection module.
`data-model.md`'s entities are all either config-driven (extraction, world) or declaration-driven (channels,
sensing) — none require editing `lif-v1.js`, the worker protocol, or the panel's generic section/model code. The
table above still holds unchanged; no new Complexity Tracking entry is needed.

## Project Structure

### Documentation (this feature)

```text
specs/013-wide-io-forager-brain/
├── plan.md                          # This file (/speckit-plan command output)
├── research.md                      # Phase 0 output (/speckit-plan command)
├── data-model.md                    # Phase 1 output (/speckit-plan command)
├── quickstart.md                    # Phase 1 output (/speckit-plan command)
├── contracts/                       # Phase 1 output (/speckit-plan command)
│   ├── extract-config-forager-wide.md
│   ├── channel-declaration-v5.md
│   ├── world-config-wide-io.md
│   └── experiment-metrics-wide.md
└── tasks.md                         # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This feature adds to the project's existing layout (extractor / app / dev-scripts in one repository, fixed by the
constitution's "Repository layout" constraint) — no new top-level directory.

```text
extract/
├── configs/
│   └── forager-brain-wide.json           # NEW — format 5, "kind": "forager-wide" (ADR 007 D20)
├── malecns_brain/
│   ├── dataset.py                        # extend: FORAGER_ANNOTATION_COLUMNS + "entryNerve"
│   ├── config.py                         # extend: format_of → "foragerWide" for formatVersion 5;
│   │                                      #         validate_forager_wide (D15, D19, D20 key shapes)
│   ├── admission.py                      # extend: _pool_fields + entryNerve
│   ├── selection_forager.py              # extend: _matches_input gains optional entryNerves/
│   │                                      #         excludeReceptorTypes keys (shared by both strategies)
│   ├── selection_class_seed.py           # extend: resolve_pools/_match_sides branch on declared `pair`
│   │                                      #         (format 5) vs CLASS_TO_PATHWAY (format 4, unchanged);
│   │                                      #         generalised fidelity_probe/_probe_pools over
│   │                                      #         config["fidelity"]["checks"] (D19); escape output
│   │                                      #         drops its outgoing edges like any other output (D17)
│   ├── capabilities.py                   # extend: validate_capabilities_v5 (R9 sense/site, R10 six
│   │                                      #         forager-wide drives); KIND_DRIVES + "forager-wide"
│   ├── container.py                      # extend: _check_forager_wide, dispatched on header.kind
│   └── errors.py                         # extend: E-PAIR
└── tests/
    ├── make_forager_wide_fixture.py      # NEW — small labelled fixture with all six new sense classes
    ├── test_config_forager_wide.py       # NEW — format 5 key/shape validation, forbidden-key checks
    ├── test_selection_class_seed_wide.py # NEW — entryNerves/excludeReceptorTypes filters, pair side
    │                                      #       matching, E-PAIR, each fidelity check kind, escape as output
    └── test_container_forager_wide.py    # NEW — header kind "forager-wide", v5 declaration, six drives

public/
├── brains/
│   ├── brains.json                       # extend: + forager-brain-wide.brain manifest entry
│   └── forager-brain-wide.brain          # generated snapshot (not committed; built by the extractor)
├── world/
│   └── world-forager-wide.json           # NEW — flies.brain.version: "v2", new snapshot, flies.stimuli,
│                                          #       flies.body.sites, flies.body.escape (off by default)
├── js/brain/
│   ├── capabilities.js                   # extend: validateCapabilitiesV5, KIND_DRIVES.forager-wide
│   ├── snapshot.js                       # extend: checkForagerWide (dispatch on manifest.kind);
│   │                                      #         checkBrainVersion gains an expected-kind check (v1→
│   │                                      #         "forager", v2→"forager-wide")
│   └── fly-brain.js                      # extend: "v2" dispatches to the existing v1 runner, unchanged
├── js/fly/
│   ├── stimulus.js                       # extend: a generic declared-sense sampler reusing falloff/
│   │                                      #         sensoryValue (distance senses) and a contact-cell
│   │                                      #         reader (contact senses), parametrised by site offset
│   ├── fly-world.js                      # extend: hazard lookup (spider/lantern positions), parallel to
│   │                                      #         the existing stimulusPoints for edibles
│   ├── body.js                           # extend: an escape-physics step, gated by flies.body.escape
│   │                                      #         .enabled, threshold and cooldown; no-op by default
│   ├── forager-step.js                   # extend: initForagerFly/applyForagerMotor/driveValues read an
│   │                                      #         optional escape drive and env.escape generically;
│   │                                      #         senseForagerFly (v1, four hard-coded channels) is
│   │                                      #         UNCHANGED, bit-for-bit
│   ├── forager-step-wide.js              # NEW — senseForagerFlyWide/forageEnvWide: reads a snapshot's
│   │                                      #       declared sense/site per channel and the world's
│   │                                      #       flies.stimuli/flies.body.sites to build the 12-value
│   │                                      #       sense message (ADR 007 W8/W9)
│   ├── fly-host.js                       # extend: forager flag covers "v1" or "v2"; dispatches
│   │                                      #         senseForagerFly vs senseForagerFlyWide and forageEnv
│   │                                      #         vs forageEnvWide by brain.version
│   └── fly-config.js                     # extend: resolveFlies carries flies.stimuli/body.sites/
│                                          #         body.escape through to forageEnvWide
└── js/world/
    └── validate.js                       # extend: BRAIN_VERSIONS + "v2"; validateFlyStimuliWide,
                                           #         validateBodySites, validateFlyEscape (all optional,
                                           #         required only when brain.version is "v2")

scripts/
└── forager-arms.mjs                      # extend: + "wide" arm (forageEnvWide/senseForagerFlyWide),
                                           #         random-matched-wide, brake/stay/avoid/touch metrics,
                                           #         escape reported as telemetry only

public/js/fly/metrics.js                  # extend: brakeMedian, stayMedian, avoidFraction, touchTurn,
                                           #         escapeMean (pure functions, Node-testable)

.claude/skills/microfly-calibrate/scripts/profiles/
└── wide-io.mjs                           # NEW — this brain's A1 pool probes + A2 escape outputScale fit
                                           #       (ADR 007 "Calibration protocol"); tuning itself runs
                                           #       later, in its own /microfly-calibrate session

tests/
├── capabilities-v5.test.mjs              # NEW — v5 declaration rules, both directions with Python
├── snapshot-forager-wide.test.mjs        # NEW — container header kind "forager-wide", six drives
├── fly-brain-v2.test.mjs                 # NEW — "v2" dispatches to the v1 runner; checkBrainVersion's
│                                          #       kind check (v1/forager, v2/forager-wide mismatches)
├── stimulus-declared.test.mjs            # NEW — the generic declared-sense sampler against each sense
│                                          #       kind (distance and contact), each body site
├── body-escape.test.mjs                  # NEW — no move while disabled; one move per cooldown while
│                                          #       enabled and above threshold
├── forager-step-wide.test.mjs            # NEW — senseForagerFlyWide builds 12 inputs in declaration
│                                          #       order; forageEnvWide's escape config passthrough
├── panel-wide-channels.test.mjs          # NEW — contract test: a forager-wide capabilities declaration
│                                          #       renders 12 input and 6 output rows through the
│                                          #       EXISTING generic inputsSection/outputsSection/model, no
│                                          #       panel code change
└── world-compat-wide.test.mjs            # NEW — mock, v0, v1 forager and 11K worlds are byte-for-byte
                                           #       unaffected by every change above
```

**Structure Decision**: single existing project (extractor + static app + dev scripts in one repository); no new
top-level directory. The extraction side extends the existing `classSeed` strategy module in place (same topology
rule, wider pools); the simulator side adds one new, parallel host-sensing module (`forager-step-wide.js`) beside
the unchanged `forager-step.js`, exactly as `fly-brain-v1.js` sits beside `fly-brain-v0.js` — so the `v1` forager's
behaviour cannot regress while the `v2` interface is built, per spec FR-004/FR-014. The panel gains no new files:
its existing generic, declaration-driven sections are the mechanism, verified by a new contract test rather than
new code.

## Complexity Tracking

> No entries. The Constitution Check above found no principle violated; the two noted design choices (extending the
> existing `classSeed` module instead of adding a new one, and adding zero new panel code) are each the simpler of
> the two options available, not a deviation that needs justification.
