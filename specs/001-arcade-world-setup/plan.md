# Implementation Plan: Arcade World Setup

**Branch**: `001-arcade-world-setup` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-arcade-world-setup/spec.md`

**Note**: Scope from the user: create the world assets, the JSON world config, and all HTML/CSS/JS in `public/`. The world is inspired by [a16z-infra/ai-town](https://github.com/a16z-infra/ai-town) (MIT). No ReactJS code or assets are reused.

## Summary

Build a static, browser-rendered top-down world in the style of 90s arcade games. A vanilla ES-module app in `public/` loads one JSON world config, generates the world deterministically from a seed (grass base, water lakes, rock clusters, tree groves, then fruits, honey, fires and spiders placed by declared rules), and draws it on a Canvas 2D element. The mouse drags to pan and the wheel zooms around the cursor, both clamped to the world bounds. Invalid configs show a readable error panel and never a partial world.

Technical approach:

- Pure modules (config validation, generation, camera math) have no DOM access, so they run under Node's built-in test runner.
- Rendering and input live in a thin browser layer on the main thread.
- Sprites come from a sprite spec in the config: either a rectangle on a sheet PNG, or a small inline pixel-art grid. Both are CC0 or project-authored, so the look is changed by editing JSON.
- Terrain tiles come from tile groups (autotile sets) in the sheet. Each cell's tile is chosen from its 8 neighbours, so a group's edge tiles only sit next to tiles of the same group. Every terrain cell is drawn over an opaque fill tile (BUG-001).
- The app runs with `python3 -m http.server` from `public/`, with no build and no dependencies.

Asset sourcing is decided in [research.md](research.md). Summary: terrain and scenery come from Kenney's CC0 packs; fruit, honey, fire and spider sprites are authored in the project; the repo's existing `assets/` files are not shipped (provenance unverified).

## Technical Context

**Language/Version**: JavaScript (ES2022, native ES modules), HTML5, CSS3. Node.js 20+ is used only to run the tests, not to serve or build the app.

**Primary Dependencies**: None at runtime. No frameworks, bundlers or npm packages in the app (Constitution I, VII). Tests use the built-in `node:test` module.

**Storage**: Static files only. The world config is `public/world/world.json`. Sprite images are under `public/assets/`. No backend, no local storage.

**Testing**: `node --test tests/` for pure modules (validation, generation, camera). Browser behaviour (rendering, pan, zoom, error panel) is covered by a manual checklist in `quickstart.md`.

**Target Platform**: Current evergreen Chrome, Firefox and Safari on desktop, using ES modules, Canvas 2D and `fetch`.

**Project Type**: Static web application (single page).

**Performance Goals**: First paint of the world within 3 s on a typical laptop (SC-001). Pan and zoom each frame in under 16 ms at 100×100 tiles (SC-003), achieved by drawing only tiles and sprites inside the viewport. One zoom step responds within 100 ms.

**Constraints**: Runs from a plain static server. No build step. Main thread only (no flies or workers in this feature). Reproducible: same config and seed give the same world (FR-013). Config carries a `format` and `version` and is rejected when unsupported (FR-014).

**Scale/Scope**: One world at a time. Default size 100×100 tiles at 16 px. Roughly 10,000 terrain cells and about 1,000 objects by default. Config must allow up to 512×512 without code changes. Gameplay and flies are out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|-----------|-------|--------|
| I. Static Web, Zero Build | App runs with `python3 -m http.server` from `public/`. Plain ES modules. No framework, bundler or runtime package. No backend. | PASS |
| II. One Fly, One Worker | No flies and no simulation in this feature. Rendering and input stay on the main thread, as the constitution requires for world and rendering. | PASS (N/A) |
| III. Connectome-Grounded Snapshots | Not applicable: no brain snapshot is produced. | PASS (N/A) |
| IV. Configurable, Reproducible Extraction | World is defined by a declarative JSON config with a seed. Same config gives identical output. The config format is versioned and rejects unknown versions with a clear error. The config schema is documented in `contracts/world-config.md`. | PASS |
| V. Faithful LIF Simulation | Not applicable: no LIF model. Pure modules are kept testable without DOM, as Principle V's testability rule suggests. | PASS (N/A) |
| VI. Living World | World owns objects and placement. Placement rules are data in the config, not hidden in code. Elements carry only static appearance and placement in this feature. | PASS |
| VII. Simplicity | No libraries. Canvas 2D, ES modules and `fetch` only. Each file has one job (see Project Structure). No extra abstraction layers. | PASS |
| Tests (Dev Workflow) | Pure modules are tested with `node --test`. The run check is `python3 -m http.server` with no console errors, in `quickstart.md`. | PASS |
| Documentation (Dev Workflow) | Config format is documented in `contracts/world-config.md` and updated with any change to it. | PASS |
| Assets (Technology constraints) | No third-party browser library is vendored. CC0 art is not code. Each asset source is recorded in `public/assets/ATTRIBUTION.md`. | PASS |

**Post-design re-check (after Phase 1)**: all gates still pass. No violations, so Complexity Tracking stays empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-arcade-world-setup/
├── spec.md              # Feature specification (/speckit-specify)
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0: asset sourcing, rendering and config decisions
├── data-model.md        # Phase 1: entities of the world config and generated world
├── quickstart.md        # Phase 1: how to run and verify the world
├── contracts/
│   └── world-config.md  # Phase 1: world config format contract (v1)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
public/                              # Static web root (served by python3 -m http.server)
├── index.html                       # Page shell: canvas, error panel, script entry
├── css/
│   └── style.css                    # Layout, canvas fill, error panel, light and dark tokens
├── js/
│   ├── main.js                      # Bootstrap: load config, validate, generate, start renderer
│   ├── config/
│   │   └── load-world.js            # fetch world.json, parse, report load errors
│   ├── world/                       # PURE: no DOM, no canvas
│   │   ├── validate.js              # Validate config, return list of { path, message }
│   │   ├── prng.js                  # Seeded PRNG (mulberry32)
│   │   ├── noise.js                 # Seeded value noise for terrain shaping
│   │   ├── autotile.js              # PURE: pick fill, edge or corner tile per cell from same-group neighbours
│   │   └── generate.js              # Build grid of terrain ids and placed objects from config
│   ├── render/
│   │   ├── camera.js                # PURE: pan, zoom-at-cursor, clamp to bounds
│   │   ├── sprites.js               # Load sheet images, render inline pixel grids to offscreen canvases
│   │   ├── renderer.js              # Draw visible terrain and objects, sorted by y
│   │   └── input.js                 # Mouse drag and wheel events, feeds camera
│   └── ui/
│       └── error-panel.js           # Show readable config errors in the page
├── world/
│   └── world.json                   # Default world config (format v1)
└── assets/
    ├── terrain/                     # CC0 Kenney 16×16 sheet(s) for grass, water, trees, rocks
    ├── sprites/                     # Project-authored pixel-art notes for fruit, honey, fire, spider (sprites live inline in world.json)
    └── ATTRIBUTION.md               # Source, author and licence for every external asset

tests/                               # Node built-in test runner, runs without install
├── validate.test.mjs
├── generate.test.mjs
└── camera.test.mjs

package.json                         # "type": "module", "scripts": { "test": "node --test tests/" }, no dependencies
```

**Structure Decision**: Single static web app rooted at `public/`, as requested. Pure logic is in `public/js/world/` and `public/js/render/camera.js`, which can be imported by Node tests without a DOM. Browser-only code (`renderer.js`, `input.js`, `sprites.js`, `main.js`, `error-panel.js`) is kept separate. The repo's existing `assets/`, `malecns.md` and `specs/` stay where they are. Nothing in `assets/` is shipped in `public/` (see research.md, decision R1).

## Tile Groups (BUG-001)

**Bugfix**: 2026-10-04 — BUG-001 Updated from bugfix patch

The sheet `roguelike-16.png` is made of tile groups (autotile sets). A group's edge tiles are only correct next to tiles of the same group, so the single-tile model in research R2 and R6 no longer holds. Changes:

- **Group model**: `world.json` declares a `groups` entry per terrain. Each group names its roles (`fill`, and the edge and corner roles of the chosen set) and points to sheet rectangles. Roles are validated like sprites.
- **Neighbour pick (`autotile.js`, PURE)**: for each cell, read the 8 neighbours and choose the role of the group. Only same-group tiles may sit next to each other. The pick makes no PRNG draws, so the seed contract (FR-013) holds.
- **Opaque base**: the renderer draws the group's `fill` tile under every terrain cell before the edge or corner tile.
- **Tile analysis**: `.specify/bugs/tile-edge-misalignment/sheet-analysis.md` holds the measured groups. The result is recorded in `public/assets/ATTRIBUTION.md`.
- **Config versioning**: adding `groups` changes the config contract. Decide whether it stays in `version: 1` as an optional field the app ignores when absent, or needs `version: 2` (see `contracts/world-config.md`, versioning rule). [NEEDS CLARIFICATION]
- **Pixel alignment**: integer-only zoom is `[NEEDS CLARIFICATION]`. Until answered, zoom is unchanged.
- **Open tile roles**: the 3×3 role of each rock and grass tile is not fully confirmed from pixels. [NEEDS CLARIFICATION]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | | |
