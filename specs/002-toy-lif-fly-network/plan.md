# Implementation Plan: Toy LIF Fly Network

**Branch**: `002-toy-lif-fly-network` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-toy-lif-fly-network/spec.md`

**Note**: Scope from the user: follow ADR 001 (Stages 1 and 2 and its toy annex). Implement the toy LIF network as a Web Worker per fly, and integrate the flies into the existing arcade world. Stage 3 (connectome snapshot) is out of scope.

## Summary

Add six flies to the arcade world. Each fly is driven by its own toy LIF network (40 neurons, seeded random graph with Dale's law) running in its own module Web Worker. The world (main thread) gives each fly one sensory value per brain tick: the fruit intensity at the fly's position. The worker returns two motor outputs, LEFT and RIGHT, as smoothed spike rates. The main thread turns those into wheel speeds, moves the fly on walkable ground, and counts fruit contacts. A labelled random-walk baseline mode uses the same body with motors drawn from a seeded PRNG, so the ADR's acceptance metric can be run.

All engine and world logic is pure JavaScript with no DOM or Worker dependency. The Worker is a thin shell around the same pure code, so the Node test runner and a headless experiment script exercise exactly what the browser runs.

Technical approach:

- **Brain (pure)**: `brain/lif.js` (the LIF core, ADR Stage 1), `brain/graph.js` (seeded random graph), `brain/fly-brain.js` (the two-channel toy network: sensory, LEFT, RIGHT, motor smoothing).
- **Worker protocol (pure + thin shell)**: `brain/protocol.js` (versioned message encode and validate), `brain/worker-core.js` (message handler, pure), `brain/fly.worker.js` (module worker that calls the handler).
- **Body and stimulus (pure)**: `fly/stimulus.js` (fruit intensity), `fly/body.js` (wheel speeds to motion, walkable check, sliding collision, contact counting), `fly/baseline.js` (seeded random motor source), `fly/fly-world.js` (spawn and blocked map from the generated world).
- **Host (browser)**: `fly/fly-host.js` owns one worker per toy fly, runs the lockstep tick loop, pauses when the tab is hidden, and reports errors per fly.
- **UI (browser)**: flies are drawn by the existing renderer; `ui/fly-panel.js` shows the per-fly list and inspection readout; clicking a fly selects it.
- **Config**: an optional `flies` section in `world.json`. Version stays 1 (see research R3).
- **Experiment (Node)**: `scripts/compare-baseline.mjs` runs the ADR acceptance metric headless.

## Technical Context

**Language/Version**: JavaScript (ES2022, native ES modules, module Web Workers), HTML5, CSS3. Node.js 20+ is used only to run tests and the experiment script.

**Primary Dependencies**: None at runtime. No frameworks, bundlers or npm packages in the app (Constitution I, VII). Tests use `node:test`.

**Storage**: Static files. The world config stays `public/world/world.json`. No backend, no local storage, no connectome data.

**Testing**: `node --test tests/*.test.mjs` for all pure modules, the worker protocol (both sides) and config validation. `node scripts/compare-baseline.mjs` for the ADR Stage 2 metric. Browser behaviour (six workers running, readout, pause, no console errors) is covered by the manual checklist in `quickstart.md`.

**Target Platform**: Current evergreen Chrome, Firefox and Safari on desktop, using ES modules, module workers, Canvas 2D and `fetch`.

**Project Type**: Static web application (single page) with one Web Worker per fly.

**Performance Goals**: Six flies running at a 20 Hz brain tick. Main thread stays under 16 ms per frame with six flies, and pan or zoom still responds within 100 ms (SC-006). Each brain tick round trip is off the main thread, so the world never waits for a worker.

**Constraints**: Runs from a plain static server. No build step. The neural computation runs only in workers (Constitution II). Same world config, same seeds and same tick sequence give the same spike sequences (Principle V). All LIF parameters are named and configurable (Principle V).

**Scale/Scope**: Six flies by default, up to 64 in config. Toy network of 40 neurons by default. The world stays 100×100 tiles by default.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Static Web, Zero Build | Module workers and ES modules only. No package install, no build. Served by `python3 -m http.server` from `public/`. | PASS |
| II. One Fly, One Worker | One module worker per toy fly. The worker owns only that fly's network. Messages use a versioned protocol (`brain/protocol.js`). No cross-fly state. Main thread does no LIF computation. Baseline flies have no worker and no brain, by design (labelled baseline). | PASS (with a justified exception, see Complexity Tracking) |
| III. Connectome-Grounded Snapshots | Toy networks are synthetic test fixtures. Constitution III allows them if labelled. Every place they appear (UI, config, README text, experiment output) labels them "toy (synthetic test fixture)". | PASS (justified exception, see Complexity Tracking) |
| IV. Configurable, Reproducible Extraction | Toy size, degree, inhibitory fraction, LIF parameters, sensory and motor mapping, seeds and experiment seeds are in `world.json` (`flies`). Same config and seeds give identical spike and movement sequences. The new section is documented in `contracts/fly-config.md`. | PASS |
| V. Faithful, Inspectable LIF Simulation | `lif.js` is pure with named `LIF_DEFAULTS`, overridable from config. Seeded graph. Tests cover determinism, ISI, refractory period and inhibition (ADR Stage 1). Telemetry (spikes for selected neurons, sensory, LEFT and RIGHT) is exposed per fly. | PASS |
| VI. Living World, Embodied Flies | Flies perceive only the sensory value; they act only through LEFT and RIGHT motor outputs. The stimulus mapping (which objects, radius, gain) is in config. Motion rules (speed, turn rate) are in config. Behaviour comes from the brain, except in the labelled baseline mode. World owns objects, walkability and contacts. Rendering and world updates stay on the main thread. | PASS |
| VII. Simplicity | No libraries. Module workers, Canvas 2D, typed arrays. Each file has one job. The motor smoothing and body are the minimum needed for a fly to move. | PASS |
| Tests (Dev Workflow) | Pure modules tested with `node --test`. Protocol contract tested on both sides (host encode and worker handler, both in Node). Run check: app starts from `python3 -m http.server` with six flies, no console errors. | PASS |
| Documentation (Dev Workflow) | `contracts/fly-config.md` and `contracts/worker-protocol.md` are updated in the same change. | PASS |
| Technology constraints (Data flow) | Data flow matches the constitution: world config → brain worker (LIF) ↔ world (main thread). | PASS |

**Post-design re-check (after Phase 1)**: All gates still pass. The two exceptions (II and III) are recorded in Complexity Tracking and will be removed when Stage 3 replaces toy networks with snapshots.

## Project Structure

### Documentation (this feature)

```text
specs/002-toy-lif-fly-network/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0: decisions R1–R12
├── data-model.md        # Phase 1: config, brain, body, host and protocol entities
├── quickstart.md        # Phase 1: how to run the tests, experiment and manual checks
├── contracts/
│   ├── fly-config.md        # Phase 1: optional `flies` section of world.json (version 1)
│   └── worker-protocol.md   # Phase 1: host ↔ fly worker messages, protocol version 1
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
public/
├── index.html                           # Adds the fly panel container
├── world/world.json                     # Adds optional `flies` section and fly sprites
├── js/
│   ├── main.js                          # Starts flies after the world (changed)
│   ├── brain/                           # Toy brain. PURE except fly.worker.js
│   │   ├── lif.js                       # LIF core, LIF_DEFAULTS, createNetwork, step (ADR Stage 1)
│   │   ├── graph.js                     # randomGraph with Dale's law (seeded)
│   │   ├── fly-brain.js                 # Two-channel toy network: sensory 0, LEFT 1, RIGHT 2, motor smoothing
│   │   ├── protocol.js                  # Protocol v1: message builders and validators
│   │   ├── worker-core.js               # PURE message handler used by the worker (testable in Node)
│   │   └── fly.worker.js                # Module Worker shell: self.onmessage → worker-core
│   ├── fly/                             # Fly body and host. PURE except fly-host.js
│   │   ├── stimulus.js                  # fruitIntensity(objects, x, y, rule) → [0, max]
│   │   ├── body.js                      # Motion from L/R, walkable check, sliding collision, contacts
│   │   ├── baseline.js                  # Seeded random motor source for baseline flies
│   │   ├── fly-world.js                 # Blocked map, spawn cells, createFlies(config, grid, objects)
│   │   └── fly-host.js                  # BROWSER: workers, lockstep ticks, pause, per-fly errors
│   ├── render/
│   │   ├── renderer.js                  # Draws flies after objects (changed)
│   │   └── input.js                     # Adds click-to-select on a fly (changed)
│   ├── world/
│   │   ├── validate.js                  # Validates optional `flies` (changed)
│   │   ├── generate.js, prng.js, ...    # Reused unchanged
│   └── ui/
│       └── fly-panel.js                 # BROWSER: per-fly list and inspection readout
tests/
├── lif.test.mjs                         # ADR Stage 1 checks: determinism, ISI, refractory, inhibition
├── graph.test.mjs                       # Fixed out-degree, no self or repeated edges, Dale's law, seeded
├── fly-brain.test.mjs                   # Same seed same motors, motor range, sensory raises LEFT rate
├── protocol.test.mjs                    # Protocol v1 contract: host encode, worker handler, both sides
├── body.test.mjs                        # Motion, blocked cells, sliding, bounds, contact counting
├── stimulus.test.mjs                    # Falloff, cap, out of range
├── fly-world.test.mjs                   # Spawn determinism and walkability, flies count
└── validate-flies.test.mjs              # Errors for each invalid `flies` field
scripts/
└── compare-baseline.mjs                 # ADR Stage 2 metric: toy vs random-walk contacts over seeds
package.json                             # Adds "experiment" script
```

**Structure Decision**: Pure logic lives under `public/js/brain/` and `public/js/fly/` (except `fly-host.js`) so Node tests and the experiment script import it directly. Browser-only code is `fly-host.js`, `fly.worker.js`, `fly-panel.js`, and the changes in `renderer.js`, `input.js` and `main.js`. The Worker shell is kept as small as possible so that its behaviour is in `worker-core.js`, which is tested.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle II: the toy brain is built from a seed inside the worker, not loaded from a brain snapshot | Stage 3 (snapshot format and extractor) is deliberately deferred so that the engine and integration are validated before any dataset work (ADR 001, Decision). | Writing a snapshot format and fixture now would add a format contract and tooling before the engine is proven. The toy is a labelled test fixture (Principle III). Removed when Stage 3 lands. |
| Principle III: flies simulate a synthetic network in the app | Constitution III allows synthetic networks as test fixtures if labelled. The ADR's Stage 2 metric can only be answered by running the real integration. | A non-app-only fixture would not test the worker boundary or the world integration the ADR asks to validate. Labelling is applied everywhere the toy appears. |
| Baseline flies run without a worker | The baseline must share the body and world code but not the brain, so comparison isolates the brain's effect (research R7). | Running baseline in a worker would add cost without changing the result. Constitution's "ignore brains" baseline exception covers this. |
