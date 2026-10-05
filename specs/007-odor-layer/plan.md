# Implementation Plan: Odour Layer

**Branch**: `007-odor-layer` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-odor-layer/spec.md`, plus planning input: "Implement
the odor layer toggle in the world tab. Use the arcade style visibility toggle. Draw the odor
intensity as heatmap style over the world map."

## Summary

Add an odour heatmap over the world map, with an arcade-style ON/OFF switch in the panel's World tab.
The layer is off by default.

The heatmap shows the same odour field the flies sense. The per-source falloff moves into one shared
function (`falloff`) that the flies' `fruitIntensity` and the new field builder both use. The field is
sampled once per scene pixel into a `Float32Array` and painted once into an offscreen canvas through a
yellow → orange → red ramp. Alpha rises with intensity and is capped at 0.55. Because flowers never move
or get used up, this happens only once, the first time the layer is turned on. The renderer then draws
that canvas with the scene's own source and destination rectangles, between the scene and the flies, so
it stays aligned when panning and zooming and costs one `drawImage` per frame.

The layer state is a small pure module owned by `main.js`. The fly and brain code never imports it, so
toggling cannot affect the simulation.

## Technical Context

**Language/Version**: JavaScript ES2022 (browser ES modules; Node 20+ for tests).

**Primary Dependencies**: None new. Canvas 2D only.

**Storage**: N/A. The layer state is in memory and resets on reload. World configs in `public/world/`
are read, not changed.

**Testing**:
- `npm test` (Node built-in runner, `tests/*.test.mjs`, currently 232 passing).
- New pure-module tests: `odour-field`, `heatmap`, `layers`.
- Browser run check: `python3 -m http.server 8000` from `public/` (the web root that `main.js`
  resolves as `APP_ROOT`), with no console errors.

**Target Platform**: Evergreen browsers (Chrome, Firefox, Safari).

**Project Type**: Static web app (front-end only for this feature; the Python extractor is untouched).

**Performance Goals**:
- Frame rate with the layer on equals frame rate with it off: one extra `drawImage` per frame.
- Field build under 50 ms at the default 48 × 32 world, run once.

**Constraints**:
- No neural computation or simulation change on the main thread (constitution II, VI; FR-010).
- No change to the worker protocol, the snapshot format or the world-config schema.
- Text set with `textContent` only.

**Scale/Scope**:
- Default world: 1536 × 1024 scene px, about 6 MB for the field and 6 MB for the overlay canvas.
- One odour channel, one layer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Static Web, Zero Build | Plain ES modules and Canvas 2D. No dependency or build step. | Pass |
| II. One Fly, One Worker | The main thread computes a static visual field, not neural state. Worker protocol unchanged. | Pass |
| III. Connectome-Grounded Snapshots | Not touched. | Pass |
| IV. Configurable, Reproducible Extraction | Not touched. | Pass |
| V. Faithful, Inspectable LIF | LIF unchanged. The layer is an extra inspection aid for the sensory signal crossing the brain–world boundary. | Pass |
| VI. Living World, Embodied Flies | The stimulus mapping stays declared in `flies.stimulus`. The layer reads it and never writes. Flies still sense only through `senseAt`. | Pass |
| VII. Simplicity | Adds three small pure modules plus a renderer overlay hook. No abstraction beyond a one-entry layer list (see Complexity Tracking). | Pass |

**Post-design re-check (after Phase 1)**: still passes. The design shares one falloff function
instead of duplicating it, adds no dependency, and keeps every new module except `paintField` and
the panel DOM pure and testable under Node.

## Project Structure

### Documentation (this feature)

```text
specs/007-odor-layer/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R8
├── data-model.md        # Phase 1: source, settings, field, ramp, layer state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── odour-layer.md   # Phase 1: module and DOM contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
public/
├── css/style.css                    # + --odour-* tokens (light + both dark blocks), .layers,
│                                    #   .arcade-switch, .odour-legend
├── js/
│   ├── main.js                      # owns layer state; lazy-builds the overlay; passes overlays + view
│   ├── fly/
│   │   ├── stimulus.js              # + export falloff(); fruitIntensity uses it (same results)
│   │   ├── fly-world.js             # + export stimulusPoints(world)
│   │   └── fly-host.js              # uses stimulusPoints() (no behaviour change)
│   ├── world/
│   │   ├── odour-field.js           # NEW, pure: odourField({points, stimulus, cols, rows, samplesPerCell})
│   │   └── layers.js                # NEW, pure: LAYERS, initialLayers, toggleLayer
│   ├── render/
│   │   ├── heatmap.js               # NEW: parseRamp, rampColor (pure), paintField (canvas)
│   │   └── renderer.js              # + overlays[] drawn between scene and flies
│   └── ui/panel/panel.js            # World pane: Layers box + arcade switch + legend; list in [data-list]
tests/
├── odour-field.test.mjs             # NEW: parity, reach, overlap, cap, bounds, empty
├── heatmap.test.mjs                 # NEW: ramp stops, alpha monotonic and capped
└── layers.test.mjs                  # NEW: off by default, toggle, unknown id; fly/ and brain/ don't import it
```

**Structure Decision**: This uses the existing `public/js` layout. The pure world-data logic goes in
`world/`, the drawing in `render/` and the DOM in `ui/panel/`. Tests go in the root `tests/`
directory as before.

## Design Notes

- **Field (R1–R3)**: For each source, visit only the samples inside its `radius` bounding box, add
  `falloff(d, radius)`, then apply `t = min(1, gain × sum / max)` over the whole array. Samples sit at
  pixel centres in cell units, which matches `fruitIntensity(points, x, y, radius)` for a fly at that
  point.
- **Heatmap (R4)**: `paintField` fills one `ImageData` from `rampColor` and puts it on a
  `document.createElement('canvas')` of size `field.width × field.height`. The ramp is read from CSS
  tokens. If the theme changes (`matchMedia('(prefers-color-scheme: dark)')` change event), the canvas
  is repainted from the cached field.
- **Renderer**: draws each overlay with `ctx.drawImage(overlay, sx, sy, sw, sh, dx, dy, …)` using the
  scene's values. There are no new transforms.
- **Panel (R5, R6)**: the Layers box is built once. Each render updates `aria-checked`, the switch
  text and the legend's `hidden` attribute. The switch's `onclick` calls `view.onLayer('odour')`. Then
  `main.js` toggles the state, builds the overlay if needed, and calls `requestDraw()` and
  `updatePanel()`.
- **Arcade switch styling**:
  - square corners, a 2 px solid border and `box-shadow: 2px 2px 0 currentColor`
  - uppercase `ui-monospace`
  - a block thumb placed with `justify-content`, no transition
  - "on" fill `rgb(var(--odour-high))`
  - `:focus-visible` outline
  - the pressed state shifts the button 2 px into its shadow

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| A `LAYERS` list with one entry, not a single boolean | The panel renders layer rows from data, so the next layer (for example a danger odour) is one entry, as with 006's declared channels | A hard-coded boolean would need panel edits for each new layer. The list is three lines. |
| An offscreen overlay canvas (~6 MB) | Gives exact alignment with the scene and a per-frame cost of one `drawImage` | Per-frame radial gradients cannot reproduce sum-then-cap, and they cost work on every frame (R3) |
