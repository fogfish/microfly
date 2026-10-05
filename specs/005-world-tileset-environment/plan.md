# Implementation Plan: Detailed World Tileset and Diverse Environment

**Branch**: `005-world-tileset-environment` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-world-tileset-environment/spec.md`

**Bugfix**: 2026-10-05 — BUG-001 Updated from bugfix patch

**Bugfix**: 2026-10-05 — BUG-002 Updated from bugfix patch (natural water bodies after the art pack's WATER-SPEC)

**Bugfix**: 2026-10-05 — BUG-003 Updated from bugfix patch (flowers and dangers spread over the map; `fire` / `jungle-prop-002` removed)

## Summary

Replace the 16 px roguelike world with a map drawn from the high-resolution atlas in
`public/assets/atlas`. The scene and the fly's navigation grid become two separate layers:

- **Scene layer**: art at its native pixel size, placed at continuous world coordinates
  (in cells). Sprites are not equal-size tiles, so nothing in the scene is tied to a grid cell.
- **Logic layer**: a coarse grid of 32 px cells. It holds only what the fly needs: walkable or
  blocked, water, fruit/honey cells and danger cells. Flies move and sense on this grid.

The map is static. Everything in the scene is composed once at load into one offscreen bitmap.
Only the flies are redrawn each frame. Water is the static frame `water-water-001` (no animation).

~~Shorelines use the atlas's sand rings (water → sand → grass) where a basin fits a ring. Where no ring fits, the shore falls back to rock and pebble art, as the spec already allows.~~ ~~Shorelines use shore overlay art only: transition plants `beach-plant-001` and `beach-plant-003` (rotated where needed) and decoration plants `beach-plant-013` to `beach-plant-017`.~~ Sand is not used (BUG-001).

**Water (BUG-002)**: Water is not built from cells. Following the art pack's water spec
(`zrpg-art/examples/WATER-SPEC.md`, reference `water.js`), each body is a wobbly ellipse
rasterised into a padded pixel mask (`PAD = 48`). An exact distance transform gives the signed
distance `S` to the waterline, roughened by seeded noise. Everything else is a function of `S`:
the grass shore band (`rocks2-terrain-020`, 4–11 px), the mud line, the bank face on north banks
and the rim on south banks, shallow tint steps, and decor placement (reed beds clipped to a clump,
waterline stones with ripple rings, tufts, sprigs, ferns, flowers). Only `water-water-001` is used,
with no drift and one fixed foam phase, and it is baked into the static scene with the rest (R6).
The logic grid samples `S` at each cell centre, so the fly's water cells match the drawn water.
The default world has one medium lake and 2–3 small ponds.

## Technical Context

**Language/Version**: Plain JavaScript (ES modules) in the browser; no build step (constitution I).
**Primary Dependencies**: None. Canvas 2D, `Image`, `fetch`. No new library.
**Storage**: Static files only: `public/assets/atlas/atlas-0.png`, `catalog.json`,
`public/world/world.json` (new format version 2).
**Testing**: Node's built-in test runner for the pure modules (layout, composition, validation,
fly logic) and a manual viewing check on the page served by `python3 -m http.server`.
**Target Platform**: Current evergreen desktop browsers (constitution, Technical Constraints).
**Project Type**: Static web app (existing `public/`).
**Performance Goals**: Load and first composed frame under 3 s on a laptop (SC-007). Pan and
zoom respond under 100 ms. Map composition runs once at load.
**Constraints**: Pixel-perfect rendering. Integer zoom only. The map is static. Constitution I
(no build, no framework), VI (world declares stimuli, brain drives flies).
**Scale/Scope**: Default world 48 × 32 cells (1536 × 1024 px at 32 px per cell). About 400
placed scene objects and about 3000 ground cells. Six flies.

## Constitution Check

*GATE: checked before Phase 0; re-checked after Phase 1.*

| Principle | Status | Notes |
|---|---|---|
| I. Static Web, Zero Build | Pass | Composition happens in the browser at load. No build tool is needed to run the app. |
| II. One Fly, One Worker | Pass | Fly brains stay in their workers. This feature does not touch the brain. |
| III. Connectome-Grounded | N/A | No brain snapshot changes. |
| IV. Configurable, Reproducible | Pass | The map is declared in JSON. The scatter rules use the seed. |
| V. Faithful LIF | N/A | LIF untouched. |
| VI. Living World | Pass | The world declares the stimulus objects (fruit/honey cells) and the danger cells. Flies still act only through motor output. |
| VII. Simplicity | Pass with note | Replacing procedural blobs/noise with an explicit map removes generator code. A catalogue loader and shore composition are added; see Complexity Tracking. BUG-002 adds a water field module; see Complexity Tracking. |

Re-check after Phase 1: pass. The data model keeps the scene and the logic grid separate, and
the static bake adds no runtime dependency.

## Decisions Driven by the User Request

| Request | Plan |
|---|---|
| High-resolution atlas, read `OBJECTS.md` | Use `catalog.json`. Each sprite is referenced by `id`. Draw from the atlas rectangle `atlas` and anchor at `anchor` (foot point). Sizes are not assumed equal. |
| Scene ≠ logic tiles | Scene uses continuous coordinates in cells. Logic grid is 32 px cells. Objects declare their footprint on the logic grid, not their pixel size. |
| Water, rocks on the shore | Water basins are blocked on the logic grid. ~~Shores use sand rings where a basin fits, else rock and pebble art.~~ ~~Shores use the shore overlay set (BUG-001).~~ Shores use the WATER-SPEC grass shore style: band, bank face and decor from the signed distance `S` (BUG-002). |
| Grass with plants, flowers, bushes | Grass ground tiles plus meadow patches. Scatter rules place plants and bushes in clusters and clearings using the seed. |
| Trees: standalone and groves | Explicit positions for single trees. Groves are explicit lists of 4 to 12 trees around a centre. |
| No animated water | Use the single static frame `water-water-001`. The animation block is not used. No flow drift, and foam is one fixed phase (BUG-002). |
| Water → sand → grass | ~~Use sand rings (`beach-terrain-001` 96 px, `beach-terrain-002` 56 px) around water basins. Research R1 checks the fit.~~ Removed (BUG-001): no sand in the world. |
| Edibles: fruit, flowers, honey | ~~Honey → `jungle-prop-001 bee_hive`.~~ Edibles are flowers only (BUG-001). Flowers → `trees-plant-001/002/003`, `jungle-plant-016/017`. Fruit: no standalone fruit art found yet (research R2). |
| Dangers: skull_spear_banner, campfire_logs, oil_lantern_post | ~~Fire → `jungle-prop-002 campfire_logs`.~~ Fire removed (BUG-003): `jungle-prop-002` is not a danger, and there is no `fire` kind. Spider → `jungle-prop-005 skull_spear_banner`. Oil lantern → `jungle-prop-006 oil_lantern_post` as a third danger kind. Research R3 confirms the mapping. |
| Sprite roles (BUG-001) | Each catalogue sprite has one role: terrain (ground layer, 32 px cells, may be layered) or overlay (drawn over ground, foot-point anchored, sorted by `y`). Solid tiles `rocks2-terrain-004..007` are not used. `outcrop_medium_grass` (`rocks2-rock-035`) is an overlay. ~~Rotation applies only to overlays.~~ No sprite is rotated or mirrored: shadows are baked in (BUG-002). |
| Fly size (BUG-001) | The fly is a 22 × 22 px sprite in `world.json`, replacing the 8 × 8 pixel grid carried over from v1. |
| One medium lake and a few small ponds (BUG-002) | Bodies are `blob` outlines in cells. Lake: `rx` 180–260 px, `ry/rx` 0.55–0.65, wobble 0.14–0.24, 5–7 harmonics. Ponds (2–3): `rx` 60–100 px, `ry/rx` 0.65–0.8, wobble 0.08–0.14, 3–5 harmonics (art pack `lakes.md`, `ponds.md`). |
| Spread of edibles and dangers (BUG-003) | Hand-placed in `world.json` (FR-017), no generator. Every 16 × 16-cell region of the 3 × 2 split holds at least one flower and one danger; flowers are at least 6 cells apart; at least 6 flowers and 5 dangers. A test checks the rule (FR-032, SC-013). The decorative `meadow-flowers` scatter drops `trees-plant-001` to `trees-plant-003`, so edible flowers stay distinct. Both world files carry the same lists. |
| World files (BUG-001) | `?world=` loads version 2 files only. `world-connectome.json` is migrated to version 2 with its connectome section unchanged. |

## Project Structure

### Documentation (this feature)

```text
specs/005-world-tileset-environment/
├── plan.md              # this file
├── research.md          # Phase 0 decisions and open research items
├── data-model.md        # Phase 1 entities: scene, logic grid, placements
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/
│   └── world-format.md  # Phase 1 world definition contract, version 2
├── spec.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
public/
├── assets/atlas/                 # existing; read-only (OBJECTS.md)
├── world/world.json              # rewritten to format version 2
├── js/
│   ├── config/load-world.js      # accepts version 2, rejects others (FR-020)
│   ├── world/
│   │   ├── validate.js           # rewritten for version 2 (unknown art, water placements, shapes)
│   │   ├── catalog.js            # NEW: loads atlas/catalog.json, resolves art ids
│   │   ├── layout.js             # NEW: builds logic grid (blocked, water, fruit, danger) from declarations
│   │   ├── compose.js            # NEW: draws the static scene into one offscreen canvas (BUG-002: shore bands, static water layer, bank face, reed beds, ripple rings)
│   │   ├── water.js              # NEW (BUG-002): pure water field: blob mask, distance transform, S, shore width, value noise
│   │   ├── shore.js              # NEW: ~~shore overlay placement (transition and decoration plants, rotation)~~ shore decor placement from S, grass-style rules (BUG-002)
│   │   ├── ground.js             # NEW: terrain ground layer (grass variants, cobble, gravel)
│   │   ├── scatter.js            # NEW: seeded scatter of plants and bushes in areas
│   │   ├── prng.js               # existing, reused
│   │   └── generate.js, noise.js, autotile.js  # retired (blob/noise generation, roguelike groups)
│   ├── fly/
│   │   ├── fly-world.js          # uses the logic grid instead of the old grid
│   │   └── fly-config.js         # stimulus ids point at the new edible ids
│   └── render/
│       ├── renderer.js           # draws the composed map, then the flies
│       ├── camera.js             # integer zoom steps only
│       └── sprites.js            # atlas rectangle sources (replaces roguelike sheet use)
├── assets/ATTRIBUTION.md         # credits the new atlas and lists the used sprites (FR-023)
└── tests/                        # NEW: node:test files for the pure modules
```

**Structure Decision**: Keep the existing `public/` layout. Add the four new pure modules
(`catalog`, `layout`, `compose`, `shore`, `scatter`) next to the world code, so that only the
renderer touches the DOM and Canvas. Retire the procedural generator instead of keeping two
ways to build a world.

## Phase 0: Research (see research.md)

Open items that could change the design:

- **R1 Shoreline fit** (closed by BUG-001: sand removed; reopened and decided by BUG-002: the art pack's WATER-SPEC grass shore style): The atlas has 2 sand rings with a hole (96 px and 56 px) and 2 sand
  pit tiles. Confirm whether they form a usable water → sand → grass border for round basins,
  and what fallback covers irregular outlines.
- **R2 Fruit**: No standalone fruit sprite has been identified yet. Palm trees with fruit
  exist (`trees-tree-*`, `jungle-*` palms) but are trees, not pickups. Search the remaining
  ~~sprites or decide on a flower or honey-only edible set.~~ Decided (BUG-001): flower-only edible set; honey removed.
- **R3 Danger mapping**: Confirm the three named danger sprites visually and whether a spider
  needs a separate sprite or whether `skull_spear_banner` is used as the spider stand-in.
  Reopened by BUG-003: campfire logs are rejected as a danger. The catalogue has no other fire,
  torch or flame sprite, so the `fire` kind is dropped; the dangers are the spider stand-in and the lantern.
- **R4 Logic grid cell size**: 32 px cells against 16 px cells for fly movement and sensing.
- **R5 Zoom steps**: Integer-only zoom with `imageSmoothingEnabled = false` to keep pixels even.

## Phase 1: Design

- `data-model.md` defines the scene objects, the logic grid, water and shore entities, and the
  six flies' relation to the grid.
- `contracts/world-format.md` defines the version 2 JSON that a developer edits.
- `quickstart.md` lists the viewing checks and the automated tests.

## Spec Amendments Required

The user's decisions change four statements in `spec.md`. Update them when this plan is
accepted:

- **FR-005 / SC-006 / User Story 2 scenario 1**: Water is static. Remove the animation wording.
- **Assumption "Shoreline by decoration"**: Shores use sand rings where possible (sand is now
  used), with rock/pebble fallback.
- **Assumption "Edibles, dangers and flies unchanged"**: Edibles and dangers keep their meaning
  but use the new art named in this plan. Honey, flowers, ~~fire,~~ spider, and oil lantern are the
  new kinds (BUG-003: fire removed).
- **Assumption "No elevation"** and **FR-022 (BUG-001 tile-group attribution)**: The roguelike
  tile groups are retired, so FR-022 and the 001 tile-group rules no longer apply. Attribution
  moves to the atlas.

**BUG-003 (applied 2026-10-05)**: the edible and danger spread and the removal of `fire` are now in `spec.md` (FR-009, FR-032, SC-013, User Story 5 scenario 6, assumption "Edibles and dangers keep their meaning") and in `tasks.md` (T076 to T082).

**BUG-002 (applied 2026-10-05)**: the water-body changes are now in `spec.md` (FR-005, FR-011, FR-012, FR-015, FR-016, FR-024, FR-025, FR-028 to FR-031, SC-004, SC-006, SC-010, SC-012) and in `tasks.md` (T063 to T075).

**BUG-001 (applied 2026-10-05)**: the sand, honey, sprite-role, rotation, fly-size and world-file changes above are now in `spec.md` (FR-009, FR-012, FR-015, FR-024 to FR-027, SC-004, SC-010, SC-011) and in `tasks.md` (T053 to T062).

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Catalogue loader (`catalog.js`) | Art is referenced by id from the atlas catalogue, which is the documented contract (`OBJECTS.md`). | Hard-coding rectangles in `world.json` would copy data that the atlas already documents and would drift on regeneration. |
| Water field (`water.js`, BUG-002) | The atlas has no water edge or corner tiles, so a natural waterline needs a mask and distance field. This is the art pack's only supported method. About 300 lines of pure code ported from `water.js`; build cost about 0.3–1.2 s for 1536 × 1024, limited to each body's box plus `PAD`. | Per-cell water with sprites around it (sand rings, rock art, rotated plants) was tried three times and always gives square, stepped edges (BUG-001, BUG-002). |
| Shore composition (`shore.js`) | ~~Shore overlays (transition and decoration plants, rotated where needed) are placed by foot point, and the renderer cannot pick them automatically (BUG-001).~~ Shore decor is placed from `S` by the grass-style rules (BUG-002). | ~~Only rock art on the border was rejected by the user for water and sand.~~ Rock art alone is not enough: `beach-rock-001` to `beach-rock-003` are overlays and are not used as shore art (BUG-001). |
| Static bake at load (`compose.js`) | One offscreen map keeps the per-frame cost to the flies. | Drawing every object per frame would work but would redraw about 3000 cells for no visible change. |
