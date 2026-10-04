# Implementation Plan: Brain Point-Cloud Inspector

**Branch**: `004-brain-point-cloud-inspector` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-brain-point-cloud-inspector/spec.md`, extended by the user request to (a) carry 3D data points in the extractor's output and (b) build a switchable brain inspector in `public/brains` with the level filters and annotations of `inspector/malecns-3d.html`.

## Summary

Two changes that depend on each other:

1. **Extractor carries positions.** The MaleCNS annotation table already has `somaLocation` (voxel coordinates) for 141,781 of 211,577 bodies, including all 11 neurons of the reference brain. The extractor copies each selected neuron's soma position and its `superclass` into the brain container header. Both are optional header fields, so the container stays at format version 2. Neurons without a position are written as `null` and counted in the extraction report.
2. **Brain inspector in `public/brains`.** A static page that lists the brains available to the simulator from a manifest, lets the user switch between them, and draws each brain as a point cloud with edges. It keeps the level filter (Region, Superclass, Class, Type), group legend, group and body connection modes, minimum-synapse and top-edge controls, and the role descriptions and sources of `inspector/malecns-3d.html`. `inspector/malecns-3d.html` is not changed.

The inspector reuses the existing snapshot reader (`public/js/brain/snapshot.js`), so the browser has one implementation of the container contract.

## Technical Context

**Language/Version**: Python 3 (extractor, pyarrow 25.0.1, numpy 2.5.3, pinned in `extract/requirements.txt`); JavaScript ES modules in evergreen browsers (no build step).

**Primary Dependencies**: Extractor: existing `malecns_brain` package. Viewer: three.js r160 (the version `inspector/malecns-3d.html` uses), vendored into `public/brains/vendor/three/` with its MIT licence. No CDN at runtime.

**Storage**: Snapshots are static `.brain` files in `public/brains/`. The brain list is a static manifest `public/brains/brains.json`. The dataset stays external in `data/malecns/` (git-ignored, located by `MALECNS_DIR` or `--dataset`).

**Testing**: Python: `cd extract && .venv/bin/python -m unittest discover -s tests -t .`. JavaScript: `node --test tests/*.test.mjs` (the `npm test` script). Contract tests on both sides for the header change (constitution, Development Workflow).

**Target Platform**: Evergreen desktop browsers (Chrome, Firefox, Safari), served by `python3 -m http.server 8000 -d public`. The web root is `public/`, so the viewer is at `http://localhost:8000/brains/`.

**Project Type**: Static web app (viewer page) with a command-line extraction tool.

**Performance Goals**: Reference brain (11 neurons, 78 edges) fully drawn within 3 seconds of page load (spec SC-001). Full admitted subgraph (143,219 neurons, 22,082,410 edges), if present locally: first draw within 10 seconds, with at most 3,000 edges drawn and interaction kept smooth while rotating.

**Constraints**: No build step, no backend, no network CDN (constitution I). Snapshot format change follows the contract's versioning rule. Extraction must not load the 25.5M-row edge table whole (existing streaming rule).

**Scale/Scope**: One reference brain committed. Other brains are generated locally from the dataset and added to the manifest. The full admitted snapshot is a benchmark file and not committed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | Viewer is HTML, CSS and ES modules served by `http.server`. three.js is vendored, not loaded from a CDN, and justified below. No build step. | Pass, with a justified library (see Complexity Tracking) |
| II. One Fly, One Worker | The inspector runs no neural computation. The simulator is unchanged. | Pass (not applicable) |
| III. Connectome-Grounded Snapshots | Positions and superclass come from the dataset. Provenance gains `positionSource`. Dataset stays external. Neuron identity keeps `bodyId`, `class`, `type`. | Pass |
| IV. Configurable, Reproducible Extraction | No config change is needed to add positions. The same config and dataset still give identical bytes, apart from `createdAt`, because the self-check compares the new fields too. The format change is documented and versioned as an optional header addition (see research R1). | Pass |
| V. Faithful LIF Simulation | LIF core untouched. The reference brain's body bytes must stay identical after regeneration (checked in the quickstart). | Pass |
| VI. Living World | Positions are recorded for later world visualization. The world is not changed in this feature. | Pass (not applicable) |
| VII. Simplicity | Optional header fields rather than a new binary section, a static manifest rather than a generated index, and reuse of the existing reader. The one new dependency (three.js) is justified in Complexity Tracking. | Pass, with the one justified dependency |
| Tech constraints | Python extraction in `extract/`, web app in `public/`, configs in `extract/configs/`, docs in `specs/`. | Pass |
| Dev workflow: tests | Pure JavaScript model module tested with `node --test`. Python selection and container tests extended. Contract tests on both sides for `soma`/`superclass`. | Pass (planned) |
| Dev workflow: documentation | `snapshot-format.md` (spec 003) is amended in the same change, through `contracts/snapshot-header-additions.md` here. | Pass (planned) |

**Gate result**: PASS. No unresolved clarifications. One dependency is justified below.

## Project Structure

### Documentation (this feature)

```text
specs/004-brain-point-cloud-inspector/
├── plan.md                                   # This file
├── research.md                               # Phase 0 decisions
├── data-model.md                             # Phase 1 entities and rules
├── quickstart.md                             # Phase 1 run and validation guide
├── contracts/
│   ├── snapshot-header-additions.md          # Optional header fields soma and superclass (amends 003 contract)
│   ├── brains-manifest.md                    # public/brains/brains.json
│   └── brain-inspector-page.md               # URL, controls, levels, error states
├── checklists/requirements.md
└── tasks.md                                  # Created by /speckit-tasks, not here
```

### Source Code (repository root)

```text
extract/
├── malecns_brain/
│   ├── dataset.py                 # ANNOTATION_COLUMNS gains somaLocation
│   ├── selection.py               # admit() keeps somaLocation and superclass; select_brain() writes soma and superclass per neuron
│   └── __main__.py                # build_header() adds provenance.positionSource; report() gains "positions" line
├── tests/
│   ├── test_selection.py          # soma and superclass carried; null when unavailable
│   ├── test_container.py          # header additions round-trip; determinism includes them
│   └── test_cli.py                # report line counts neurons without a position
└── configs/
    └── smallest-functional-brain.json   # unchanged

public/
├── js/brain/snapshot.js           # reader accepts optional soma/superclass; rejects malformed soma with a clear message
└── brains/
    ├── index.html                 # the inspector page (sibling of inspector/malecns-3d.html, not a change to it)
    ├── brains.json                # manifest: brains available to the simulator
    ├── smallest-functional-brain.brain   # regenerated with positions
    ├── js/
    │   ├── main.js                # bootstrap: manifest, brain switch, error panel, wiring
    │   ├── model.js               # pure: region rule, groups, centroids, group edges, top edges
    │   ├── annotations.js         # pure: role descriptions and sources copied from the reference inspector
    │   ├── scene.js               # three.js: points, edges, labels, picking, camera
    │   └── controls.js            # DOM: level, modes, sliders, toggles, legend, info panel
    └── vendor/three/
        ├── three.module.min.js    # three@0.160.0 build
        ├── OrbitControls.js       # three@0.160.0 examples/jsm/controls
        └── LICENSE                # MIT

tests/
└── brain-inspector-model.test.mjs # node --test: model.js and annotations.js; snapshot header additions (reader side)
```

**Structure Decision**: Extractor changes stay in `extract/malecns_brain/` (selection, header, report). The viewer is a self-contained folder `public/brains/` with its own `js/` modules, reusing the simulator's pure reader from `public/js/brain/snapshot.js` by relative import. `inspector/malecns-3d.html` is untouched, verified by checksum (`fcd9e96285aa49b6256b28a829607b491edb4c71df103851477be4ddfda0775c`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Vendored three.js (about 0.7 MB minified) | The inspector needs perspective 3D, orbit controls, picking and labelled points. The reference uses three.js, so the look and controls match. | Raw WebGL with a hand-written orbit camera and picking would be several hundred lines of new, untested rendering code. The browser platform alone (Canvas 2D) cannot give a 3D orbit view. |
| Two extra header fields per neuron (`soma`, `superclass`) | The viewer needs both to draw points and to filter by level. Region is derived from superclass, so only superclass is stored. | A new binary section would change the layout and force format version 3, breaking the simulator's reader for no gain. A separate sidecar file adds a second file to keep in sync. |
| Static manifest `brains.json` | The viewer must list brains and the page cannot list a folder on a static host. | Directory listing depends on the server. A manifest written by the extractor couples extraction to the viewer. The manifest is a few lines and is edited by hand. |

## Phase 0 and Phase 1

Phase 0 decisions are in [research.md](research.md). Phase 1 entities and rules are in [data-model.md](data-model.md). Interface contracts are in [contracts/](contracts/). The run and validation guide is [quickstart.md](quickstart.md).

## Post-design Constitution Check

Re-checked after Phase 1. No new violations. The header additions are optional and within version 2, so the simulator's reader and the rules in `snapshot-format.md` still hold. The viewer depends only on vendored files and same-origin requests. Gate result: PASS.
