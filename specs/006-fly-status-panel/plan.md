# Implementation Plan: Fly Status Side Panel

**Branch**: `006-fly-status-panel` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-fly-status-panel/spec.md`

## Summary

The viewport is split into the world and a right-hand status panel for the selected fly. The
panel shows the fly's action, a three.js point cloud of its brain with per-neuron fade-in/fade-out
activity, and ~~one bar row per input and output channel.~~ one centred bar row per input and output channel. The fly list and the fly status are two tabs, "World" and "Fly" (BUG-001).

The brain now declares what it exposes. The declaration is data: signals the LIF produces and the
input and output channels the brain offers. It is written by the Python exporter from the extract
config into the snapshot header, and the toy and baseline brains produce the same declaration in
JavaScript. The panel renders from that declaration, so a new channel or signal is a declaration
change plus, at most, a new panel section. Existing panel code does not change.

Because the header gains a declaration the browser must act on, the snapshot format moves to
version 3, and the worker protocol moves to version 2 so that each motor message carries every
declared output and the sparse list of neurons that spiked.

## Technical Context

**Language/Version**: JavaScript ES2022 (browser modules, Node 20+ for tests); Python 3.11+ for the
extractor (`extract/.venv`, pinned in `extract/requirements.txt`).

**Primary Dependencies**: three.js 0.160.0, already vendored at `public/brains/vendor/three/` for the
brain inspector, reused by path. No new dependency. NumPy and PyArrow for the extractor (pinned).

**Storage**: Static files only. Snapshots are `*.brain` files in `public/brains/` (version 3 after
this feature). The world config is `public/world/world-connectome.json`.

**Testing**: `npm test` (Node built-in runner, `tests/*.test.mjs`, currently 141 passing) and
`extract/.venv/bin/python -m unittest discover -s extract/tests` (currently 62 passing). Browser
smoke check per the constitution: `python3 -m http.server 8000`, no console errors.

**Target Platform**: Evergreen browsers (Chrome, Firefox, Safari) with WebGL, ES modules, module
Workers and typed arrays.

**Project Type**: Static web app with a Python extraction tool (the existing two-part layout).

**Performance Goals**: The panel refreshes 5 times a second (FR-012) and the render loop stays at 60 fps
for a brain of up to 1,000 neurons. A brain of 143,219 neurons (the full admitted subgraph) must
still draw, at a lower frame rate if needed, without blocking the world.

**Constraints**: The main thread does no neural computation (constitution II). The panel is
read-only with respect to the brain. Only the selected fly's brain is drawn, so the three.js scene
is one object at a time. Every activity value is derived from received spikes, not sampled from
the worker's internal state.

**Scale/Scope**: Six flies by default, one panel, one selected fly at a time. Reference brain:
11 neurons, 78 edges. Toy brain: 40 neurons.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Static Web, Zero Build | three.js is loaded as a vendored ES module, no bundler. Justified below. | Pass |
| II. One Fly, One Worker | The worker protocol moves to v2, documented in `contracts/worker-protocol-v2.md`. The main thread only decodes spikes and draws. | Pass |
| III. Connectome-Grounded Snapshots | Channel declarations are configuration, not data. Soma positions and neuron identities stay dataset-derived. Provenance covers the config hash, which now includes the declaration. | Pass |
| IV. Configurable, Reproducible Extraction | Channels are declared in the extract config. The exporter writes them deterministically, and the same config and dataset still give the same bytes. The format is versioned (3), and the browser rejects other versions. | Pass |
| V. Faithful, Inspectable LIF | The LIF core is unchanged. Telemetry grows from a fixed list of telemetry neurons to the full spike stream, which is the telemetry the principle asks for. | Pass |
| VI. Living World, Embodied Flies | Input and output mapping is declared in data (the constitution's requirement). The panel reads state and never changes behaviour. | Pass |
| VII. Simplicity | See Complexity Tracking. Each added layer is justified there. | Pass with justification |

No gate fails. The complexity items are listed in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-fly-status-panel/
├── plan.md                              # This file
├── research.md                          # Phase 0: decisions R1–R8
├── data-model.md                        # Phase 1: declaration, activity, model, protocol v2
├── quickstart.md                        # Phase 1: validation guide
├── contracts/
│   ├── snapshot-format-v3.md            # amends specs/003 snapshot-format (version 3)
│   ├── channel-declaration.md           # how a brain declares signals and channels; how to add one
│   ├── worker-protocol-v2.md            # amends specs/002 worker-protocol (version 2)
│   └── panel-sections.md                # section registry and isolation rules
└── checklists/requirements.md
```

### Source Code (repository root)

```text
extract/
├── configs/smallest-functional-brain.json   # + "capabilities" block (channels, signals)
├── malecns_brain/
│   ├── config.py                            # validates the capabilities block
│   ├── capabilities.py                      # NEW: declaration validation, same messages as JS
│   ├── container.py                         # FORMAT_VERSION 3; writes and reads capabilities
│   └── migrate.py                           # NEW: header-only v2 → v3 (body bytes unchanged)
└── tests/
    ├── test_capabilities.py                 # NEW
    └── test_migrate.py                      # NEW

public/
├── brains/
│   ├── smallest-functional-brain.brain      # regenerated as v3 (body bytes identical)
│   └── vendor/three/                        # unchanged; reused by the panel
├── index.html                               # stage split: world + aside#fly-panel
├── css/style.css                            # two-column grid; stacked below 900 px; tab and centred-bar styles; L/R/both colour tokens (BUG-001)
├── js/
│   ├── main.js                              # boot: capability check, panel mount, resize
│   ├── config/load-world.js                 # unchanged
│   ├── brain/
│   │   ├── capabilities.js                  # NEW: validate and default the declaration (pure)
│   │   ├── activity.js                      # NEW: fade envelope, window counts (pure)
│   │   ├── layout.js                        # NEW: soma → unit cube, seeded fallback (pure)
│   │   ├── fly-brain.js                     # runner emits outputs[] and spikes[]; declaration
│   │   ├── worker-core.js                   # motor message v2
│   │   ├── protocol.js                      # PROTOCOL_VERSION 2; validators for outputs, spikes
│   │   ├── snapshot.js                      # reads v3 header and capabilities
│   │   └── fly.worker.js                    # unchanged shell
│   ├── fly/
│   │   ├── fly-config.js                    # telemetry key removed
│   │   ├── fly-host.js                      # stores spike stream, window counts, action
│   │   └── action.js                        # NEW: action label from motor outputs (pure)
│   ├── render/                              # renderer and camera use the world container size
│   ├── viz/
│   │   └── point-cloud.js                   # NEW: three.js points with per-neuron colour (browser)
│   └── ui/
│       ├── error-panel.js                   # unchanged
│       ├── fly-panel.js                     # REPLACED by the panel shell below
│       └── panel/
│           ├── panel.js                     # NEW: shell, World/Fly tabs, fly list, mounts sections
│           ├── tabs.js                      # NEW: tab state and transitions (pure, BUG-001)
│           ├── registry.js                  # NEW: section registry with per-section isolation
│           ├── model.js                     # NEW: FlyStatusModel from a record (pure)
│           └── sections/
│               ├── action.js                # NEW: requires motor outputs
│               ├── neuron-map.js            # NEW: requires signal "spikes"; uses viz/point-cloud
│               └── channels.js              # NEW: one centred row per declared channel; L left of zero, R right (BUG-001)
└── world/
    ├── world.json                           # telemetry key removed
    └── world-connectome.json                # telemetry key removed; brain capabilities via header

tests/                                       # Node tests added (listed in contracts and quickstart)
├── capabilities.test.mjs
├── activity.test.mjs
├── layout.test.mjs
├── action.test.mjs
├── panel-model.test.mjs
├── panel-registry.test.mjs
├── snapshot-v3.test.mjs
└── protocol-v2.test.mjs
```

**Structure Decision**: Keep the existing layout. Pure logic goes under `public/js/brain/` and
`public/js/fly/` and is tested in Node. Browser-only code (three.js, DOM) goes under `public/js/viz/`
and `public/js/ui/panel/`. The inspector under `public/brains/` is not changed. It keeps its own
three.js scene and model code, which avoids regressions in spec 004.

## Key Design Decisions

1. **Declaration in the snapshot header (version 3).** The panel must know the brain's channels and
   signals from the file itself. A v2 reader would ignore a new optional field and mislabel the
   channels, so the version is bumped. Version 2 files are rejected with the standard error. The
   reference brain is migrated by a header-only rewrite, which keeps the body bytes identical.
2. **Declaration for toy and baseline brains.** The same shape is produced in JavaScript
   (`brain/capabilities.js`), so the panel has one code path.
3. **Sparse spike stream.** The worker sends the indices of neurons that spiked on each tick
   (`Uint32Array`), replacing the fixed telemetry list. Dense per-tick arrays would cost 143 KB per
   tick per fly for the full admitted brain. Window counts are computed on the main thread.
4. **Fade envelope from spike time.** Each neuron's brightness is a function of the wall-clock time
   since its last spike: a short rise, then an exponential fall. It is pure and testable, and it is
   independent of the 20 Hz tick rate.
5. **Panel sections behind a registry.** Each section declares what it requires (a signal or a
   channel kind). It renders only when the brain declares that requirement, and its errors stay
   inside it. A new section cannot break the others.
6. **Channel semantics.** Input channels read the world value (in v3, only neuron 0 is an input
   because the world drives only that neuron). Output channels read a moving average of their
   neuron's spike rate. The body is driven by the outputs marked `drive: "left"` and `drive: "right"`.
   Extra outputs are displayed and do not move the fly until a body uses them.
7. **Tabs and centred channel bars (BUG-001).** The panel shell holds two tabs. The World tab draws
   the fly list, and the Fly tab draws the selected fly's sections. Tab state is a pure function
   (`ui/panel/tabs.js`): a selection moves to Fly, and a tab click moves to the named tab. Channel
   rows are one row each. The L bar is anchored at the centre and grows left, the R bar grows right,
   and a "both" channel draws on both sides in a neutral colour. The bar scale is the value clamped to
   [0, range maximum] as a fraction of half the row, so the declared minimum does not move the zero
   line. The row renderer changes; the section list and the declaration do not.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| three.js on the main page (constitution I and VII prefer Canvas 2D) | The request asks for a three.js point cloud, and the inspector already vendors three.js 0.160.0. The orbit and depth handling come with it. | A 2D projection of the point cloud would need its own depth sort and rotation code. Reusing the vendored file adds no new dependency. |
| Snapshot format version 3 | The panel must read the declaration from the file. | Keeping version 2 with an optional field would let an old reader render the channels with wrong labels and no warning. |
| Worker protocol version 2 | Motor messages must carry all declared outputs and the spike list. | Adding fields to v1 would silently break hosts that expect the fixed `selected` array. |
| Section registry with error isolation | Principle "new channels must not break everything" is a requirement of the spec (User Story 5). | A single panel function that renders everything would break for every new channel. |

**Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch (tabs, centred channel rows, Key Design Decision 7).
