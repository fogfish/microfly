# Implementation Plan: Hunger-Sensitive Feeding and Food Depletion

**Branch**: `018-hunger-sensitivity-feeding` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-hunger-sensitivity-feeding/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A hungry forager (energy below a declared threshold) senses food odor more strongly, food resources now hold a
size-derived feeding capacity (small = 1, medium = 2, large = 3 completed feedings) that drops as flies finish
feeding and recovers to full after a configurable delay (default 30 s), and a world may declare whether a feeding
fly pauses or moves at reduced speed while it eats. Per the user's explicit direction, every part of this lands as
**world-simulation parameters, a pre-brain sensor filter, and motor-control code** — `public/js/brain/*.js` (the
LIF core, `fly-brain-v1.js`'s channel gains, `decoder.js`'s spike-reading rules) is not touched. The brain still
decides *when* to feed (the feed drive, read from spikes); this feature only changes what the brain smells before
it decides, and what the body does with its limbs and the map's food once the brain has decided.

## Technical Context

**Language/Version**: Plain ES modules (browser, no transpiler), Node.js 20+ built-in test runner for `tests/*.test.mjs`.

**Primary Dependencies**: None new. Reuses this repo's existing modules: `public/js/fly/{energy,food,forager-step,
forager-step-wide,body-layer,fly-config}.js`, `public/js/world/validate.js`, `public/js/fly/stimulus.js`.

**Storage**: N/A — in-memory per-world-instance state only (the `createFood` stock/capacity table), declared in
world JSON config files under `public/world/`.

**Testing**: `npm test` (`tests/*.test.mjs`, Node's built-in `node:test` + `node:assert`), following the existing
pattern in `tests/lif-golden.test.mjs` / the forager bout tests. No new test framework.

**Target Platform**: Browser (evergreen Chrome/Firefox/Safari), main thread only for this feature — no worker
protocol change, since nothing here crosses the brain-worker boundary's message shape (inputs stay the same
length and meaning; only their *value* changes before being sent).

**Project Type**: Static web app (single project; see AGENTS.md Layout table). No frontend/backend split.

**Performance Goals**: No regression to the existing per-tick cost of `senseForagerFly(Wide)`/`stepBodyLayer` —
the new sensor-filter and capacity lookups are O(1) per fly per tick, matching today's cost shape.

**Constraints**: Must not modify `public/js/brain/*.js` (LIF core, channel gains, decoder) — explicit user
direction, also keeps `tests/lif-golden.test.mjs` (lif-v1 vs lif-v0 bit-for-bit) untouched and passing. Must keep
every existing shipped world (`public/world/*.json`) loading and behaving exactly as before when it does not opt
into the new config keys (AGENTS.md "Old brains keep working").

**Scale/Scope**: Touches the forager body/food/sensing layer only (`public/js/fly/`, `public/js/world/validate.js`,
`public/js/fly/fly-config.js`) plus one new/amended world-config contract. No changes to `extract/` (Python),
`public/brains/` snapshots, or the worker protocol version.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Static Web, Zero Build | Plain ES modules only, no new dependency, no build step. | PASS |
| II. One Fly, One Worker | No change to the worker/main-thread split or the protocol; sensor filtering and motor control already run on the main thread (`forager-step*.js`, `body-layer.js`), never inside the worker. The worker still only runs the LIF step. | PASS |
| III. Connectome-Grounded Brain Snapshots | No snapshot, weight, or neuron-identity change. Untouched. | PASS (N/A) |
| IV. Configurable, Reproducible Extraction | No extractor change. Untouched. | PASS (N/A) |
| V. Faithful, Inspectable LIF Simulation | `lif-*.js` is not touched; no new/changed LIF parameter. `tests/lif-golden.test.mjs` stays green by construction, since nothing in its import graph changes. | PASS |
| VI. Living World, Embodied Flies | **The brain still decides when to feed** (the feed drive is read from spikes, unchanged). The *sensitivity* of the odor the brain is given to decide from is a declared, data-driven multiplier computed from the fly's own energy (not hidden world state) — same category as the existing `antennaOffset`/`radius`/`gain` stimulus parameters this contract already allows. The feed-motion choice (pause vs. slow) and the food-capacity/recovery model are declared in world config, applied by the body layer to decoded brain signals (feed drive), never overriding them. No scripted code decides *whether* to feed. | PASS |
| VII. Simplicity | Reuses the existing bout/energy/stimulus machinery; adds config keys and small, additive functions rather than a new abstraction layer or dependency. | PASS |

No violations. Complexity Tracking is not needed.

**Post-design re-check** (after Phase 1 artifacts below): `data-model.md` and
`contracts/world-config-food-feeding.md` keep every new mechanism additive and declared in `flies.food` world
config, read only by `public/js/fly/*.js` and `public/js/world/validate.js`. No file under `public/js/brain/` is
referenced by any new artifact. The table above still holds; no gate is reopened.

## Project Structure

### Documentation (this feature)

```text
specs/018-hunger-sensitivity-feeding/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── world-config-food-feeding.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

This is the existing single-project static web app (AGENTS.md Layout). No new top-level directory. The feature
lands entirely inside the existing `public/js/fly/` and `public/js/world/` modules, plus their contract and test
siblings:

```text
public/js/fly/
├── energy.js            # unchanged: per-tick energy/metabolism/eat() math; closeBout's endedBy stays the signal
│                         # this feature reads (not writes) to decide when a feeding "completes"
├── food.js               # AMENDED: createFood grows a per-kind capacity model (remaining feeding units,
│                         # recovery timer) alongside (not replacing) the existing continuous stock/fraction API,
│                         # selected by new, optional flies.food keys (off by default)
├── forager-step.js       # AMENDED: senseForagerFly applies the hunger-sensitivity filter to the odor inputs
│                         # before they reach brain.step(); applyForagerMotor charges one feeding unit at bout
│                         # close instead of draining continuously (feed motion is v3-only: see body-layer.js)
├── forager-step-wide.js  # AMENDED: senseForagerFlyWide applies the same sensor filter to the declared
│                         # "odour:food" input channel(s) (v2/v3)
├── body-layer.js         # AMENDED: stepBodyLayer's eating branch picks pause (speed 0, today's behavior) or
│                         # slow (reduced speed) per flies.food.feedMotion; charges one feeding unit at bout close
└── fly-config.js         # AMENDED: new FOOD_DEFAULTS keys (off/no-op by default), resolveFlies passthrough

public/js/world/
└── validate.js            # AMENDED: validates the new, optional flies.food keys

tests/
└── *.test.mjs             # NEW: unit tests for the capacity/recovery model, the sensor-filter multiplier, and
                            # the pause/slow motor choice, alongside the existing forager/bout test files
```

No change to `public/js/brain/*.js`, `public/js/brain/worker-core.js`, `public/js/brain/protocol-v3.js`,
`extract/`, or any `.brain` snapshot. No new top-level directory, dependency, or build step.

**Structure Decision**: Single existing project, extended in place. The sensor filter lives in the two
`senseForagerFly*` functions (the world-side code that builds the `inputs` array *before* `brain.step()` is
called — this is "before the brain boundary," never inside `public/js/brain/`). The motor-control change lives in
the two places that already own fly movement and feeding physics (`body-layer.js` for v3, `forager-step*.js`'s
`applyForagerMotor` for v1/v2). The food-capacity/recovery model lives in `food.js`, the existing single owner of
flower/resource state, extended rather than replaced so every world that does not set the new keys keeps today's
continuous stock/regrowth behavior byte-for-behavior identical (AGENTS.md "Old brains keep working").

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
