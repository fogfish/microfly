# Implementation Plan: Demo Forager — Decoded Readout, Body Layer and Online Homeostasis

**Branch**: `017-demo-forager` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Implementation plan from `/specs/017-demo-forager/spec.md`

## Summary

Add a fourth brain mode, `flies.brain.version: "v3"`, on top of the already-shipped ADR 009 wide connectome brain
(14,500 neurons, unchanged). It adds: an optional tonic background current to the LIF core (L10); a main-thread
decoder that turns the worker's existing per-tick spike list into per-sense side/drive/trend signals from
calibration-derived neuron pools (D27–D31), persisted as a new `decoder-v1` sidecar file; a declared body layer
that turns those signals into walking, steering, escape and backing-up (W12–W14), replacing today's single linear
speed/turn formula for `v3` only; a hunger threshold that gates food-sense gain (D32); online homeostasis so the
decoder needs no separate per-pool balance calibration (D33); a new calibration profile and CLI stage
(`calibrate.mjs --version=demo-v3 --stage=all`, C1 regime / C2 decode / C3 smoke, ≤ 30 min); a panel section showing
the decoded readout as declared, not learned (D31); and a held-out, two-map acceptance run over three arms (brain,
random walk, matched random graph) reporting R1–R5 (Part K).

`v0`/`v1`/`v2` and their worlds are untouched. No extraction change (ADR 010 D26). No worker-protocol change
(research.md §1).

## Technical Context

**Language/Version**: Plain JavaScript (ES2022+ native modules, no transpiler) for the app and calibration CLI;
Node.js 20+ (built-in test runner, no install) for `calibrate.mjs`/`forager-arms.mjs` and `tests/*.test.mjs`. No
Python change (extraction is unchanged per D26).

**Primary Dependencies**: None new. Existing: none beyond the browser platform and Node's standard library
(constitution Principle I/VII — no new dependency is introduced by this feature).

**Storage**: Static files only — the existing `.brain` snapshot (unchanged), a new `decoder-v1` JSON sidecar file
(`public/brains/forager-brain-wide.decoder.json`), new world config JSON files. No database, no backend.

**Testing**: Node's built-in test runner — `tests/*.test.mjs` (new: `decoder.test.mjs`, `body-layer.test.mjs`,
`homeostasis.test.mjs`, `world-config-v3.test.mjs`, `decoder-engine.test.mjs`, `lif-baseline-current.test.mjs`,
contract tests for `decoder-v1` reader/writer per AGENTS.md's "Contracts" rule) and `tests/slow/*.test.mjs` for the
Part K held-out runs if they are too slow for the default suite. `public/tests/*.test.js` for the new tile-section
world config (R5's second map), reusing existing `ground.test.js`/`water.test.js`-style conventions.

**Target Platform**: Browser (current evergreen Chrome/Firefox/Safari; ES modules, module Web Workers, Canvas 2D,
typed arrays) for the app; Node.js 20+ on the developer's machine for calibration and the acceptance scripts —
identical to every prior spec in this repository.

**Project Type**: Static web app + CLI calibration tooling, in one repository (existing structure; see Project
Structure below — no new top-level directory).

**Performance Goals**: Calibration end-to-end ≤ 30 minutes, one core (R4/K7, ADR 010 Part H's own ~20-minute
estimate leaves headroom). Runtime: six `v3` flies at the existing 20 Hz tick rate with no dropped responsiveness,
matching the existing multi-fly performance bar (spec 008 SC-006).

**Constraints**: Zero build step (Principle I). No neural computation outside the worker (Principle II) — the
decoder reads already-computed spikes on the main thread, it does not run the LIF step. `lif-v1.js`'s existing
golden test MUST stay bit-identical with `baselineCurrent` at its default of 0 (Principle V / L10). Calibration
seeds and held-out seeds MUST stay disjoint (AGENTS.md).

**Scale/Scope**: One new brain version (`v3`) layered on the existing 14,500-neuron / 730,859-edge snapshot; one
new world (plus one new second-map world for R5); 12 declared input pairs, ~1,320 pool-selection candidates (every
descending neuron plus named outputs, per D27); 6 simulated flies per run; held-out acceptance over ~30 seeds × 2
maps × 3 arms.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | No bundler, no framework, no new third-party library; plain ES modules; `python3 -m http.server` still starts the app. | **PASS** |
| II. One Fly, One Worker | The LIF step stays in the worker (`lif-v1.js`, unchanged). The decoder reads `spikes` on the main thread (`fly-host.js`'s existing `motor` handler) — motor decoding, not neural computation (ADR 010 Design, Part D). No worker talks to another fly's state. | **PASS** |
| III. Connectome-Grounded Brain Snapshots | No extraction change (D26); the snapshot stays unchanged. Readout pools are selected by a declared response rule (D27), measured on calibration seeds only, recorded with provenance in `decoder-v1` (contracts/decoder-v1.md), and the identical rule runs against the RG null-arm brain (research.md §8). This is the exact bullet added to Principle III by constitution v2.0.0. | **PASS** |
| IV. Configurable, Reproducible Extraction | Not touched — no extraction config changes in this feature. | **PASS (N/A)** |
| V. Faithful, Inspectable LIF Simulation | `baselineCurrent` (L10) is named, documented, validated (finite ≥ 0), defaults to 0 so the existing golden test (`tests/lif-golden.test.mjs`) is unchanged. Online homeostasis (D33) is named, bounded (quiet-only EMA update), off by default in the sense that it is new code gated behind `v3`, deterministic given the seed, and visible in telemetry via the panel (D31) — matching the bullet constitution v2.0.0 added to Principle V. | **PASS** |
| VI. Living World, Embodied Flies | The brain decides side/strength/feed/escape, read from simulated neurons via the decoder (D27–D30). The body layer (W12–W14) is declared in world config, never reads the stimulus directly, and is identical across every experiment arm (FR-015). Valence is declared in `decoder-v1` and shown on the panel (D31, FR-021). This is exactly the redefined Principle VI this feature is the first to implement. | **PASS** |
| VII. Simplicity | Three small, additive modules (`decoder.js`, `body-layer.js`, `decoder-engine.mjs`) replace what would otherwise be forcing new per-neuron-pool logic into the existing A1/A2/B grid-search engine (`engine.mjs`), which is a different, retired protocol for `v3` (research.md §4). No new dependency. | **PASS** |
| Demo Acceptance (new section) | Part K's held-out, two-map, one-calibration run with B/RW/RG arms reported together, RG's pass stated not hidden (FR-022–FR-024) — this section exists in the constitution specifically because of this feature's governing ADR. | **PASS (by construction)** |

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/017-demo-forager/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── decoder-v1.md            # New: the decoder sidecar file format
│   └── world-config-v3.md       # New: flies.brain.version "v3", amends world-config-wide-io.md
├── checklists/requirements.md
├── calibration.md       # Written during implementation (C1/C2/C3 record), per AGENTS.md convention
└── results.md           # Written during implementation (Part K run), per quickstart.md step 5
```

### Source Code (repository root)

Single project (static web app + Node CLI tooling), existing layout — no new top-level directory.

```text
public/js/brain/
├── lif-v1.js                   # EDIT: add baselineCurrent (L10), default 0
├── fly-brain-v1.js              # EDIT: hunger-threshold ramp (D32) in the modulator-gain computation
└── protocol-v3.js               # unchanged (research.md §1)

public/js/fly/
├── decoder.js                   # NEW: decoder-v1 reader + per-tick decode (D29), called from fly-host.js
├── body-layer.js                # NEW: W12 walk/speed, W13 tropotaxis+klinotaxis, W14 escape+backup, v3 only
├── fly-host.js                  # EDIT: route decoded signals through the existing `case 'motor':` handler
├── fly-config.js                # EDIT: resolve flies.brain.decoder, flies.body.locomotion/backup for v3
└── body.js                      # unchanged for v0/v1/v2 (W14's escape jump reused by body-layer.js)

public/js/world/
└── validate.js                  # EDIT: v3 enum value, flies.brain.decoder, body.locomotion/backup, modulators.hunger.threshold gates

public/js/ui/panel/
└── sections/
    └── decoder.js                # NEW: side/drive/trend/valence/pool-size per sense (D31), registered like inputs.js/outputs.js

public/world/
├── world-forager-demo.json              # NEW: v3 world on the (shared) sketch map
└── world-forager-demo-tilemap.json      # NEW: v3 world on the tile-section generator map (R5's second map)

.claude/skills/microfly-calibrate/scripts/
├── decoder-engine.mjs            # NEW: C1 regime, C2 per-neuron pool selection + decoder-v1 writer, C3 smoke
├── profiles/demo-v3.mjs          # NEW: the demo-v3 profile (world path, snapshot, pair declarations)
└── calibrate.mjs                 # EDIT: add --stage=c1|c2|c3|all dispatch

scripts/
└── forager-arms.mjs              # EDIT: add the "v3" arm (decoder + body-layer) alongside existing wide/random-matched-wide arms

tests/
├── lif-baseline-current.test.mjs        # NEW
├── decoder.test.mjs                      # NEW (reader + per-tick decode)
├── decoder-engine.test.mjs               # NEW (C2 writer: determinism, ties, E-DECODE-<pool>)
├── body-layer.test.mjs                   # NEW (W12/W13/W14)
├── homeostasis.test.mjs                  # NEW (D33 quiet-only update, seeded from tick 0)
├── hunger-threshold.test.mjs             # NEW (D32 ramp)
├── world-config-v3.test.mjs              # NEW (contract tests, both sides of decoder-v1 and world-config-v3)
└── panel-decoder-section.test.mjs        # NEW (D31)

public/tests/
└── world-tilemap-demo.test.js            # NEW: the tile-section second-map config (R5)
```

**Structure Decision**: Every new file is additive, following the existing `v1`→`v2` precedent (new sibling
modules keyed on `flies.brain.version`, old versions untouched) rather than editing shared code paths in place,
except the two surgical edits research.md identifies as genuinely shared and backward-compatible-by-default:
`lif-v1.js` (new parameter, default 0) and `fly-brain-v1.js` (new ramp shape, parameterised by a threshold that is
absent — and therefore a no-op — for every world that doesn't set it).

## Complexity Tracking

*No Constitution Check violations. Table intentionally empty.*
