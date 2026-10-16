# Implementation Plan: Sketch-Based World Map

**Branch**: `016-sketch-world-map` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-sketch-world-map/spec.md`

**Bugfix**: 2026-10-15 — BUG-001 The map geometry below now also includes the sketch's river and the
swamp connecting its two lakes, a gap in the edge-forest ring where the river crosses it, and omits the
sketch's desert-family regions (dunes, rocky desert, lava) rather than substituting them — inherited from
the already-reviewed reading of this same sketch at `zrpg-art/examples/WORLD-SPEC.md`/`world.js`, not
re-derived independently. See [bugs/BUG-001.md](bugs/BUG-001.md).

## Summary

Replace the simulator's shared map geometry with one built from the hand-drawn sketch (`world_map.jpg`),
using only existing atlas art (tent/bone pieces stand in for buildings, plain terrain stands in for the
bridge, no title/legend/animal art, no dune/rocky-desert/lava region). The map's water is a river running
edge-to-edge through two lakes joined by a swamp (BUG-001), not two isolated lake blobs. Recalibrate what
the environment means to a fly: danger odour now comes only from the forest ring at the map's outer edge
(100/50/25% over three tile-steps), gapped where the river crosses that edge (BUG-001); heat odour now
comes only from water (same 100/50/25% shape, now including the river) with a guaranteed zero-heat land
crossing through the swamp where the sketch's water splits the map, and food odour becomes an irregular,
stepped 3×3-core trail whose footprints touch so a fly can cross the whole map by smell. Every decorative
object becomes a touch source using the touch-sensing path that already exists. The grid is resized to fit
the sketch while keeping today's one-cell-equals-one-fly-body scale. Four independent overlay toggles
(food odour, danger odour, heat odour, tile grid) replace today's single combined odour toggle. The same
map geometry is then copied into every shipped, runnable world file.

## Technical Context

**Language/Version**: Plain JavaScript (native ES modules, no transpiler), run directly by the browser; Node.js 20+ built-in test runner for unit tests. The Python extractor (`extract/`) is untouched by this feature.

**Primary Dependencies**: None added. Reuses in-repo pure modules: `world/water.js` (seeded noise, exact distance transform), `fly/stimulus.js` (falloff and declared-sense sampling), `world/odour-field.js` and `render/heatmap.js` (field build and paint).

**Storage**: Static JSON world configuration files under `public/world/`, the static sprite atlas under `public/assets/atlas/`. `world_map.jpg` is a design reference for authoring the new geometry; it is not loaded by the app.

**Testing**: `npm test` (`tests/*.test.mjs`, Node's built-in runner) and `node --test public/tests/*.test.js` (DOM-free world-generation unit tests). No browser test runner exists or is introduced.

**Target Platform**: Evergreen browsers (Chrome, Firefox, Safari) via `python3 -m http.server`, per the constitution's zero-build rule.

**Project Type**: Single static web application (no backend, no separate frontend/backend split).

**Performance Goals**: World load (validate → compose scene → build logic/sense fields) stays interactive on page load, in the same order of magnitude as today's ~48×32-cell maps. Per-tick fly sensing stays O(declared input channels) — no per-tick scan of the grid; danger/heat/food fields are built once per world load, same pattern as today's single food-odour field.

**Constraints**: Zero build step (constitution I); pure modules (`world/*.js`, `fly/stimulus.js`) stay DOM-free and are usable from Node tests; the LIF core and the worker message protocol are untouched — this feature only changes world geometry, JSON world config, and the main-thread sensing/visualization code that already runs outside the worker (constitution II).

**Scale/Scope**: One new shared map geometry (terrain, water, edge forest, decoration, food layout), sized to fit the sketch (research.md R1), copied into every shipped, runnable world file (`world.json`, `world-connectome.json`, `world-antennal-lobe.json`, `world-forager.json`, `world-forager-11k.json`, `world-forager-wide.json`); each file keeps its own `flies`/brain/experiment sections unchanged. New pure field-builder modules for danger, heat and food; four-way overlay toggle state in place of today's single `odour` toggle.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Static Web, Zero Build** — PASS. No new dependency, package or build step; everything is new JSON data and new/updated pure ES modules served statically.
- **II. One Fly, One Worker** — PASS. Sensing (translating world state, including the new danger/heat/food fields, into sensory numbers) already runs on the main thread today (`fly-host.js` builds the sense message before `postMessage`-ing it to the worker); this feature extends that existing main-thread sensing path, not the worker. The worker still only runs the LIF `step()`.
- **III. Connectome-Grounded Brain Snapshots** — PASS. No brain snapshot is added, removed or re-extracted. Shipped `.brain` files are untouched.
- **IV. Configurable, Reproducible Extraction** — PASS. Not touched; no extraction config changes.
- **V. Faithful, Inspectable LIF Simulation** — PASS. The LIF core (`lif-v0.js`/`lif-v1.js`) is untouched. World fields are seeded and deterministic, so same-seed reproducibility is preserved.
- **VI. Living World, Embodied Flies** — PASS, and directly load-bearing: the new danger/heat sense sources are added as new `flies.stimuli[sense].from` values in world config data (`research.md R3`), not hard-coded in world or brain code, consistent with "the mapping from world stimuli to sensory neurons... MUST be declared in data." No scripted behaviour is introduced; flies still act only through brain-driven motor output.
- **VII. Simplicity** — PASS. The new field builders reuse the existing noise/distance primitives in `world/water.js` and the existing declared-sense dispatch in `fly/stimulus.js`, rather than introducing a new library or framework. No complexity-tracking entry is needed.

No violations identified. Re-checked after Phase 1 design below — still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/014-sketch-world-map/
├── plan.md              # This file
├── research.md           # Phase 0 output
├── data-model.md          # Phase 1 output
├── quickstart.md          # Phase 1 output
├── contracts/             # Phase 1 output
│   ├── world-format-sketch-map.md
│   ├── stimuli-field-sources.md
│   └── odour-layer-v2.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
public/
├── world/
│   ├── world.json                    # shared base map geometry → new sketch-derived layout
│   ├── world-connectome.json         # same map, connectome brain → updated geometry
│   ├── world-antennal-lobe.json      # same map, antennal-lobe brain → updated geometry
│   ├── world-forager.json            # same map + forager (v1) brain → updated geometry
│   ├── world-forager-11k.json        # same map + class-seeded (v1) brain → updated geometry
│   ├── world-forager-wide.json       # same map + wide-I/O (v2) brain → updated geometry + new stimuli sources
│   └── README.md                     # updated to describe the sketch-based map
├── js/
│   ├── world/
│   │   ├── validate.js                # + edgeForest/swamp ground kinds, new flies.stimuli.from values (swamp: BUG-001)
│   │   ├── water.js                    # + river outline kind alongside existing blob (BUG-001)
│   │   ├── layout.js                   # + forestEdge mask alongside existing water/blocked
│   │   ├── ground.js                   # + edgeForest/swamp patch tiles (swamp: BUG-001)
│   │   ├── danger-field.js             # NEW: edge-forest ring distance field (pure)
│   │   ├── heat-field.js               # NEW: water ring distance field (pure)
│   │   ├── food-field.js               # NEW: irregular stepped per-unit food field (pure)
│   │   └── layers.js                   # LAYERS: 1 entry → 4 entries (food/danger/heat/grid)
│   ├── fly/
│   │   ├── stimulus.js                 # + field-sampling mode in senseDeclared
│   │   └── forager-step-wide.js        # samplerFor: + "water"/"forestEdge" sources
│   ├── render/
│   │   └── heatmap.js                  # + per-channel ramps, + grid-line painter
│   └── main.js                         # build/cache 3 fields + grid canvas, wire 4 toggles
├── index.html                          # World tab: 1 checkbox → 4 checkboxes
└── assets/atlas/                       # unchanged; read-only source of tent/bone/terrain art

tests/
├── danger-field.test.mjs               # NEW
├── heat-field.test.mjs                 # NEW
├── food-field.test.mjs                 # NEW (replaces/extends odour-food.test.mjs)
├── stimulus-declared.test.mjs          # + field-source cases
└── world-compat*.test.mjs              # + new ground kind / stimuli source compatibility

public/tests/
├── spread.test.js                      # updated danger/heat placement rules
├── ground.test.js                      # + edgeForest kind
└── layout.test.js                      # + forestEdge mask, touch coverage

world_map.jpg                           # sketch reference (repo root; not served by the app)
```

**Structure Decision**: Single static web application, matching the repository's existing layout
(`public/` is the web root; `public/js/world`, `public/js/fly`, `public/js/render`, `public/js/ui` are
the existing module groups). This feature adds a small number of new pure modules alongside the existing
`world/odour-field.js` pattern, extends existing validation/layout/layers/stimulus modules, and changes
JSON world data — it does not introduce a new top-level directory or a frontend/backend split.

## Complexity Tracking

*No constitution violations identified; this section is intentionally empty.*

**Bugfix note** *(2026-10-15 — BUG-001)*: the new `river` water-outline kind is rasterised the same way as
existing `blob` outlines (a mask stamped into the padded grid, then the same exact-distance-transform pass
`water.js` already runs) — no new dependency, no DOM, no animation loop (constitution I, V unaffected). No
new constitution concern is introduced by this bugfix.
