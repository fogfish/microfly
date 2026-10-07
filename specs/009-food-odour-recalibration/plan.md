# Implementation Plan: Food Odour Recalibration

**Branch**: `009-food-odour-recalibration` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-food-odour-recalibration/spec.md`

**Note**: Scope of this plan is "all variants of the world map the app loads": `world.json` (mock), `world-forager.json` (v1), `world-connectome.json` (v0), `world-antennal-lobe.json` (v0, antennal-lobe snapshot) and `world-forager-bad.json` (fixture that must keep refusing). `world.v1.json` is format 1, which the app does not load, so it is left as is.

## Summary

The map keeps its ground, water, groves, dangers and flies. What changes:

1. **Food** becomes ~~exactly three placed units, one per size class~~ one or more placed units per size class (`small` =
   `red_flower_plant`, `medium` = `jungle-plant-010`, `large` = `jungle-plant-015`), so the odour coverage target can reach
   60–70% of walkable cells (BUG-001). Each unit's sprite is named in its world entry, not chosen in code.
2. **Odour** reach is proportional to the sprite size of each unit: `reach = radius × size`, with `size` = the longest side of the sprite in tiles. Peak is the same for all units and sits on the unit. Odour is sensed (and drawn in the layer) from per-source reach instead of one global radius. Brain code is not touched.
3. **Placement** is fixed data, chosen so that ~~30–70%~~ 30–40% of walkable cells are odour-free (60–70% covered, BUG-001) and
   no walkable cell is cut off from odour (research R2, verified by script). Reaching that share with one instance per class
   only got to about 50% coverage, so BUG-001 adds more instances per class, placed near each other where needed so their
   reaches overlap and add.
4. **Removed** `jungle-plant-016`, `jungle-plant-017`, `jungle-bush-018` from every world's scatter and from shore decor.
5. **Decor**: the three yellow flower sprites are no longer edible; they go into scatter as decor. The food sprites are reserved for food: they leave scatter and shore decor, so a visitor sees a food sprite only where food is (this is an added requirement, see Spec amendments).
6. **Fly** sprite becomes a 32 × 32 pixel grid drawn as a fruit fly. It is drawn unrotated, as the current fly is (see Spec
   amendments). ~~One shape, one baseline colour variant.~~ Two shapes — female and male — each with its own baseline colour
   variant, with wings redrawn to project laterally at roughly a right angle to the body axis instead of running parallel to it
   (BUG-002, FR-014, FR-021, open decision D4).

The world format goes from version 2 to version 3 because the edible vocabulary and the edible entry shape change incompatibly (research R5).

## Spec amendments

These come from checking the spec against the code. They are applied to `spec.md` in this change.

- **FR-015 (fly heading)**: the renderer does not rotate sprites (`public/js/render/renderer.js` draws `s.source` as is; `compose.js` says "No sprite is rotated"). The fly has never been rotated. FR-015 is replaced by: the fly sprite is drawn head-up, as today. Rotating the fly is a separate feature.
- **FR-019 (new)**: the food sprites `red_flower_plant`, `jungle-plant-010` and `jungle-plant-015` are not used by scatter or shore decor in any world. Food is seen only where the food is.

## Technical Context

**Language/Version**: Browser JavaScript (native ES modules, no build) for the app; Node 20+ for tests and scripts. Python extractor not touched.

**Primary Dependencies**: None added. Existing modules: `public/js/world/*`, `public/js/fly/*`, `public/js/render/*`.

**Storage**: World config files (JSON) under `public/world/`. Sprite art in `public/assets/atlas/catalog.json` (unchanged).

**Testing**: `npm test` (Node `node:test`, `tests/*.test.mjs` and `public/tests/*.test.js`); `npm run test:slow`; `scripts/compare-baseline.mjs` on the held-out seeds for the forager world.

**Target Platform**: Evergreen browsers via static server (`cd public && python3 -m http.server 8000`).

**Project Type**: Static web app with one Web Worker per fly.

**Performance Goals**: Odour field is built once per run (same as today). Per-source reach uses the bounding box of each source, as today, so cost stays O(sources × box area). 60 fps rendering is unchanged, since the field is cached.

**Constraints**: Brain snapshots, LIF cores and the worker protocol are unchanged. World files that load must still load, and the three brain versions must still run on their worlds. No world file may hand-wire a brain connection (constitution III and VI).

**Scale/Scope**: 5 world files that the app can load (plus one fixture), one 48 × 32 grid, ~~3 food units~~ one or more food
units per size class, count set by the placement search (BUG-001), 6 flies per world.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. Static Web, Zero Build | Pass | No dependency, no build step. |
| II. One Fly, One Worker | Pass | Odour is computed on the main thread as before; it is not neural computation. The worker protocol is unchanged. |
| III. Connectome-Grounded Brain Snapshots | Pass | Brain snapshots untouched. No connection is added. |
| IV. Configurable, Reproducible Extraction | Pass | Extractor untouched. World placement is data, so the same config gives the same map. |
| V. Faithful, Inspectable LIF Simulation | Pass | `lif-v0.js` and `lif-v1.js` untouched; `tests/lif-golden.test.mjs` unaffected. |
| VI. Living World, Embodied Flies | Pass with note | The stimulus mapping stays in data: `flies.stimulus.objects` names the food kinds, `radius` sets reach, `edibles[].sprite` sets art. The rule that turns sprite size into reach is a fixed geometry rule in code (`size = max side / CELL_PX`), documented in the contract. It does not steer or feed a fly. |
| VII. Simplicity | Pass | Per-source reach replaces one global radius with the smallest change (`p.reach ?? radius`). No new module. The one extra cost is the version bump (see Complexity Tracking). |

Gate result: no unjustified violation. Proceed.

## Project Structure

### Documentation (this feature)

```text
specs/009-food-odour-recalibration/
├── spec.md
├── plan.md                    # this file
├── research.md                # Phase 0: decisions R1–R7
├── data-model.md              # Phase 1: food unit, odour source, decor, fly sprite
├── quickstart.md              # Phase 1: how to check the change in the app and in tests
├── contracts/
│   ├── world-format-v3.md     # edibles and stimulus changes, version 3
│   ├── odour-reach.md         # per-source reach in stimulus.js, odour-field.js, food.js
│   └── fly-sprite.md          # 32 × 32 fly sprites: female/male, each with a baseline (BUG-002)
├── checklists/requirements.md
└── tasks.md                   # NOT created here (/speckit-tasks)
```

### Source Code (touched by this feature)

```text
public/world/
├── world.json                 # mock brain, version 3
├── world-forager.json         # v1 brain, version 3
├── world-connectome.json      # v0 brain, version 3
├── world-antennal-lobe.json   # v0 antennal-lobe brain, version 3
├── world-forager-bad.json     # fixture, version 3 so it fails on the snapshot version as intended
└── README.md                  # world format and food rule

public/js/world/
├── layout.js                  # EDIBLE_SPRITES removed; EDIBLE_KINDS = small, medium, large; edible sprite and size per cell
├── validate.js                # edible kinds, edible sprite, version 3, food placement rules (one or more per kind, BUG-001)
├── shore.js                   # 'wild flowers' rule uses yellow decor only
├── odour-field.js             # per-source reach
└── scatter.js                 # unchanged

public/js/fly/
├── fly-world.js               # stimulus cells carry reach (size × radius)
├── food.js                    # points() carries reach
└── stimulus.js                # fruitIntensity and senseBilateral use p.reach ?? radius

public/js/main.js              # odourSources carries reach
public/js/config/load-world.js # no change expected; version check is in validate.js

public/tests/                  # banned-art, spread, validate-*, layout, shore, scatter, odour-field
tests/                         # fly-world, validate-flies, world-compat, fly-config-*, odour-field (node side)
tests/odour-food.test.mjs      # new: the spec's measurable rules (SC-001 to SC-004)
scripts/food-placement.mjs     # new: reproduces the placement search (research R2), not run by the app

specs/005-world-tileset-environment/contracts/world-format.md   # version 3
specs/002-toy-lif-fly-network/contracts/fly-config.md           # fly sprite size 32 × 32
specs/008-hungry-forager-brain/contracts/world-config-forager.md # radius meaning
specs/007-odor-layer/contracts/odour-layer.md                    # parity with per-source reach
```

**Structure Decision**: No new module in the app. One new test file and one placement script, both outside the app. The placement script is kept so the coordinates can be reproduced; it is not part of the runtime.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| World format version 2 → 3, and no version 2 reader kept (constitution governance: bump and keep the old reader) | Edible kinds change (`flower` removed, `small`/`medium`/`large` added), and each edible needs a `sprite`. A version 2 reader would have to accept `flower`, which FR-018 forbids. | Keeping a version 2 reader makes `flower` loadable, which contradicts FR-018. All version 2 worlds are in this repo and migrated in the same change, so no shipped world loses support. **Needs the user's confirmation** (see Open decision D1). |

## Phase 0 outcome

All unknowns are resolved in [research.md](research.md). No NEEDS CLARIFICATION remains. Decisions D1 to D3 are called out for the user below.

## Open decisions for the user

- **D1 (version bump without a v2 reader)**: recommended as planned. The alternative is to keep a version 2 reader that maps `flower` to something, which the spec forbids.
- **D2 (fly not rotated)**: recommended as planned. Rotation is a renderer change and a separate feature.
- **D3 (food sprites reserved)**: recommended as planned. Without it, scatter keeps showing food-looking plants that do not smell.
- **D4 (per-fly sex assignment, BUG-002)**: recommended: each world declares a `sex` per fly (one entry per index in `flies`,
  e.g. `flies.sex: ["female", "male", ...]`), and `public/js/fly/` reads it to pick `fly-female`/`fly-male` (and the matching
  baseline) instead of the single `flies.sprite`/`flies.baselineSprite` keys — data-driven, per constitution VI, not a coin
  flip in code. The alternative (assign sex randomly per fly at load time) is simpler but is not reproducible run to run and
  is not inspectable from the world file, which a visitor or a test would otherwise have to run the app to discover. **Needs
  the user's confirmation.**

## Phase 1 outcome

- [data-model.md](data-model.md): food unit, odour source, decor, fly sprite, world config v3.
- [contracts/world-format-v3.md](contracts/world-format-v3.md), [contracts/odour-reach.md](contracts/odour-reach.md), [contracts/fly-sprite.md](contracts/fly-sprite.md).
- [quickstart.md](quickstart.md): how to check each success criterion.

Constitution Check re-evaluated after design: unchanged. The only added rule (reach from sprite size) is data-driven and documented in the contract.

**Bugfix**: 2026-10-07 — BUG-001 Updated from bugfix patch. One instance per size class reached only about 50% odour coverage
(`results.md`); the reporter wants 60–70%. The plan now allows one or more instances per size class, placed near each other
where needed so their reaches overlap and add (spec FR-001, FR-020). `validate.js`'s cardinality check, the placement script,
the five world files' `edibles[]`, and the tests that assumed exactly one unit per kind all need the matching change (see
`tasks.md` Phase 8).

**Bugfix**: 2026-10-07 — BUG-002 Updated from bugfix patch. The fly sprite had one shape and a colour-only baseline variant,
with wings drawn parallel to the body. The plan now adds a female and a male shape, each with its own baseline, and redraws
the wings to project laterally at roughly a right angle to the body axis, using the reporter's reference image
(`fruit-fly.jpeg`) for proportions (spec FR-014, FR-016, FR-021). Per-fly sex assignment is a new, data-driven world-config
field (open decision D4). `contracts/fly-sprite.md`, `data-model.md`'s Fly sprite entity, the five shipped world files'
`sprites` maps, and `tests/fly-sprite.test.mjs` all need the matching change (see `tasks.md` Phase 9).
