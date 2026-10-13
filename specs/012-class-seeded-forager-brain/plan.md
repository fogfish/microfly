# Implementation Plan: Class-Seeded Forager Brain

**Branch**: `014-class-seeded-forager-brain` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-class-seeded-forager-brain/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Extract a second, larger forager brain (ADR 006, ~11,000 neurons) by seeding every traced body of a fixed set of
whole functional classes (antennal-lobe PNs/LNs, Kenyon cells, MBONs, DANs, every descending neuron, plus the
existing forager's sensory and motor pools) and filling the remainder by plain connectivity to that seed set — no
flow ranking, no per-output budget. The brain runs under the existing `v1` stack (`lif-v1.js`, `fly-brain-v1.js`,
worker protocol v3, container v4) with the same six channels as the shipped forager brain: nothing about the
simulator, the protocol or the world loop changes, only the extractor gains a second selection strategy and the
snapshot gains optional provenance fields. The extractor computes a linear extraction-fidelity probe before any
behaviour run and can gate on it. The side panel surfaces the new, optional provenance/fidelity/origin data only
for snapshots that declare it, leaving every existing brain's panel pixel-for-pixel unchanged. The project's
`microfly-calibrate` skill (generic engine + CLI, abandoned on branch `013-forager-brain-15k-lif-v2` along with
the withdrawn 15K brain it was built for) is ported back — its version-agnostic parts only — and given one new
profile for this brain, reusing ADR 006's own stated "Calibration protocol" (start from v1's calibrated block,
widen with `inhibitoryScale`/adaptation/`thresholdJitter`, multi-point A2 at the world stage). `mock`, `v0` and
the shipped `v1` forager brain keep working with no edit; the new brain is reached only by a new world file.

## Technical Context

**Language/Version**: Python 3 (extractor: stdlib + pinned `pyarrow`, `numpy`) and plain ES2022+ JavaScript (app
and dev scripts; Node 20+ for scripts and tests). No new language introduced.

**Primary Dependencies**: `pyarrow`, `numpy` (already pinned in `extract/requirements.txt`) for dataset reads,
selection and the fidelity probe's sparse matrix-vector steps. The browser app stays dependency-free (native ES
modules). No new runtime dependency anywhere.

**Storage**: MaleCNS v1.0 Feather files (external, git-ignored, read via `MALECNS_DIR`) in; one new `.brain`
binary snapshot (`forager-brain-11k.brain`, container v4, same binary layout as the shipped forager brain) out.
No database.

**Testing**: `python -m unittest discover` under `extract/tests` for the new selection strategy, admission and
fidelity-probe logic, against a small labelled synthetic fixture (constitution V, "Tests"). `npm test` (Node's
built-in test runner) for the JS reader's optional-field handling, the panel's new capability-gated sections, and
the ported calibration engine's pure gate logic. `npm run test:slow` for the existing long behaviour suites,
unaffected. Manual check: `python3 -m http.server 8000` from `public/`, opening the new world with no console
error (constitution, "Run check").

**Target Platform**: evergreen browsers (Chrome, Firefox, Safari) for the app; Linux/macOS CLI for the Python
extractor and the Node calibration/comparison scripts (developer tooling, not shipped to the browser).

**Project Type**: existing single-repository project with three co-located parts — a static web app
(`public/`), a Python extraction CLI (`extract/`) and Node developer scripts (`scripts/`, `.claude/skills/`) —
matching the layout already fixed by the constitution's "Repository layout" constraint. Not a web-service or
mobile app.

**Performance Goals**: six 11,000-neuron flies keep the main thread responsive at the world's 20 Hz tick rate;
ADR 006 estimates ≈0.1–0.25 ms per LIF step (edge count × 2.2 against the shipped brain), to be measured and
recorded at Gate B, matching spec SC-004. Extraction and the fidelity probe run as a batch CLI job on
developer hardware; no interactive latency target applies to them.

**Constraints**: zero build step; no new runtime dependency; no change to `lif-v1.js`'s default parameters or to
the worker protocol version or container version; `mock`, `v0` and the shipped `v1` forager brain keep working
unedited (spec FR-001–FR-005); the dataset is never committed; extraction reads the dataset with column
selection/batched reads, never a whole large Feather file at once (constitution IV).

**Scale/Scope**: one new extraction config and one new Python selection module (parallel to the existing
flow-ranked one); ~10,000–12,000 neurons, ~448K edges, ≈8 MB snapshot (ADR 006 Annex A3/A6); one new world file;
a bounded set of optional snapshot fields (3 header, 2 per-neuron) and one new report; a small number of new,
capability-gated panel sections; one ported-and-trimmed calibration skill plus one new profile file; the existing
comparison script gains 1–2 named arms.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | No new runtime dependency; the calibration skill and comparison script are Node CLI dev tools (like the existing `scripts/calibrate-forager.mjs`), never loaded by the browser app; no bundler, no new vendored library. | **PASS** |
| II. One Fly, One Worker | The new brain runs inside the existing per-fly worker through the unchanged `fly-brain-v1.js`/`lif-v1.js`/protocol v3 path. No neural computation moves to the main thread. | **PASS** |
| III. Connectome-Grounded Brain Snapshots | Weights stay synapse counts; sign stays a dataset `consensus_nt` lookup with the rule for every value stated in config (`transmitterSign`, `defaultSign`) and recorded per neuron (`origin`, `transmitter`). No hand-wired edge. Provenance gains `minSynapses`, `selection`, `admission`, `fidelity`. | **PASS** |
| IV. Configurable, Reproducible Extraction | The new strategy is one more declarative config (`selection: "classSeed"`); same config + dataset ⇒ byte-identical file; the format stays documented and versioned (optional additions, no incompatible bump, old readers unaffected); dataset reads stay column-selected/batched. | **PASS** |
| V. Faithful, Inspectable LIF Simulation | No change to `lif-v1.js` or its parameters; same seed ⇒ same spikes; new optional per-neuron state (`transmitter`, `origin`) is additional inspectability, not a new mechanism. | **PASS** |
| VI. Living World, Embodied Flies | The stimulus→sensory and motor→action mapping is unchanged (same six pools); the new brain only swaps the network between them; the world still never steers, stops or feeds a fly. | **PASS** |
| VII. Simplicity | One new Python selection module and one new JS panel capability path are added beside the existing ones, rather than branching inside `selection_forager.py` or hard-coding a new tab. See rationale below. | **PASS**, with a noted design choice |

**Simplicity note (not a violation, no Complexity Tracking entry needed):** a new selection module, rather than a
flag inside the existing flow-ranked one, is the smaller change here: ADR 006 lesson 6 is "change only the
topology," and mixing two unrelated selection philosophies (flow-to-output ranking vs. whole-class seed + plain
connectivity fill) inside one function would risk regressing the shipped forager extraction to test the new one.
Likewise, the panel's new data is read through the *existing* capability/signal-gated section registry
(`registry.js`, already used for `channels`/`signal` requirements) rather than a new mechanism — this is reuse,
not a new abstraction.

**Post-design re-check (after Phase 1):** `research.md` and the `contracts/` resolve every design choice without
introducing a new dependency, a container/protocol version bump, or a branch inside an existing selection or LIF
module. `data-model.md`'s entities are all either config-driven (extraction) or optional/derived (snapshot, panel
signals) — none require editing `lif-v1.js`, `fly-brain-v1.js`, the worker protocol, or `registry.js` itself. The
table above still holds unchanged; no new Complexity Tracking entry is needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-class-seeded-forager-brain/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── extract-config-classseed.md
│   ├── container-v4-additions.md
│   ├── panel-provenance-signals.md
│   └── calibration-profile.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This feature adds to the project's existing layout (extractor / app / dev-scripts in one repository, fixed by the
constitution's "Repository layout" constraint) — no new top-level directory.

```text
extract/
├── configs/
│   └── forager-brain-11k.json        # NEW — format 4, "selection": "classSeed" (ADR 006 D14)
├── malecns_brain/
│   ├── config.py                     # extend: validate the classSeed config shape (seeds, fill, fidelity)
│   ├── selection.py                  # extend: dispatch to a strategy by config.selection
│   ├── selection_forager.py          # unchanged — existing flow-ranked strategy keeps extracting as-is
│   ├── selection_class_seed.py       # NEW — D8 seeds, D9 shared-weight fill, D13 fidelity probe
│   ├── admission.py                  # extend: "allTraced" admission, transmitterSign/defaultSign rule
│   ├── container.py                  # extend: write the W7 optional header/per-neuron additions
│   └── errors.py                     # extend: E-SEED-EMPTY, E-SEED-OVERFLOW, E-TRANSMITTER-COLUMN, E-FIDELITY
└── tests/
    └── test_selection_class_seed.py  # NEW — seeds complete, fill ties on bodyId, D12 denominator, probe fixture

public/
├── brains/
│   ├── brains.json                   # extend: + forager-brain-11k.brain manifest entry
│   └── forager-brain-11k.brain       # generated snapshot (not committed; built by the extractor, as today's are)
├── world/
│   └── world-forager-11k.json        # NEW — flies.brain.version: "v1", new snapshot, own calibrated lif block
├── js/brain/
│   ├── snapshot.js                   # extend: parse optional W7 fields, ignore ones it doesn't know (no version bump)
│   └── capabilities.js               # extend: derive optional signals (provenance/fidelity/origin) when present
└── js/ui/panel/
    ├── registry.js                   # unchanged — existing requires.signal gate covers the new sections
    ├── model.js                      # extend: project the new optional fields into the view model
    └── provenance.js                 # NEW section module — provenance/fidelity rows and the seed/fill + transmitter legend

.claude/skills/microfly-calibrate/     # ported from branch 013-forager-brain-15k-lif-v2 (generic parts only), adapted
├── SKILL.md                          # ported, reworded: drop 15K-specific framing, name the new profile
└── scripts/
    ├── calibrate.mjs                 # ported — generic CLI, unchanged behaviour
    ├── engine.mjs                    # ported — generic A1/A2/B engine, unchanged behaviour
    └── profiles/
        ├── v1.mjs                    # ported unchanged — kept as the engine's known-answer reference case
        └── class-seed-11k.mjs        # NEW — this brain's grid/gates (ADR 006 "Calibration protocol")

scripts/
└── forager-arms.mjs                  # extend: add the class-seeded brain and the "v1 selection under D10-D12" arm

tests/
├── calibrate-engine.test.mjs         # ported unchanged — generic engine unit tests (no brain-specific import)
└── snapshot-v4-additions.test.mjs    # NEW — JS reader contract test for the W7 optional fields, both directions
```

**Structure Decision**: single existing project (extractor + static app + dev scripts in one repository); no new
top-level directory. Every new file sits beside its existing counterpart (a second selection module next to
`selection_forager.py`, a second world file next to `world-forager.json`, a second calibration profile next to
`v1.mjs`), so the two brains and the two selection strategies stay independently comparable, per spec FR-004/FR-016.

## Complexity Tracking

> No entries. The Constitution Check above found no principle violated; the one noted design choice (a new
> selection module and a new panel section, instead of branching existing ones) is the simpler of the two options
> available, not a deviation that needs justification.
