# Research: Odour Layer

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-05

The Technical Context has no open NEEDS CLARIFICATION items. This file records the design
decisions behind the plan, including the user's planning input: the toggle goes in the World tab,
it is an arcade-style visibility toggle, and the odour intensity is drawn as a heatmap over the map.

## R1 — One falloff function for flies and the layer

**Decision**: Move the per-source falloff `max(0, 1 − d / radius)` out of `fruitIntensity` into a
named export `falloff(d, radius)` in `public/js/fly/stimulus.js`. Both `fruitIntensity` (the fly's
sense) and the new odour field use it. A test checks that every sampled field value equals
`fruitIntensity` at the sample centre.

**Rationale**: FR-004 requires the layer to show the same field the flies sense. One function makes
that true by construction, and the parity test keeps it true if the falloff changes later.

**Alternatives considered**: Copy the formula into the layer (drifts silently). Call
`fruitIntensity` per sample (correct, but loops over every source for each of ~1.5 M samples;
accumulating per source over its bounding box is ~20× cheaper at the default world size).

## R2 — What the heatmap value means

**Decision**: The layer shows the normalised odour level `t = min(1, gain × intensity / max)`, in
[0, 1]. The fly's resting level is not added: `t = 0` exactly where no source reaches, so those
points get no tint (FR-006). The cap matches the fly's sensory cap (FR-007). The legend shows 0 at
the low end and `max` at the high end, in the same units as the "Food odour" input bar, offset by
the resting level the bar already shows.

**Rationale**: Adding `resting` would tint the whole map with the resting colour, which breaks
FR-006 and hides the sources' shape. The fly's sensed value is `min(max, resting + gain × I)`, so
the layer shows the odour-driven part of that value.

**Alternatives considered**: Raw intensity (sum of falloffs) with no cap, which is unbounded and
gives no stable colour scale. Showing the sensed value including resting, rejected for FR-006.

## R3 — Sampling resolution and when to compute

**Decision**: Sample the field once per scene pixel (the composed scene is 48 × 32 cells × 32 px =
1536 × 1024 at the default world), at pixel centres, into a `Float32Array`. Paint it once into an
offscreen canvas the same size as the scene. Build it lazily the first time the layer is turned
on, and keep it for the run.

**Rationale**:
- The sources are static (spec Assumptions), so the field never changes during a run.
- A field canvas in scene coordinates is drawn with the exact source and destination rectangle
  the renderer already uses for the scene, so panning and zooming cannot misalign it (FR-009).
- With smoothing off, one scene pixel becomes a whole block of device pixels at higher zoom. That
  matches the 8-bit look and still gives a smooth ramp with no visible bands (FR-005).
- Lazy building means a user who never turns the layer on pays nothing (SC-001, FR-014).

**Cost**: 1536 × 1024 × 4 B ≈ 6 MB for the field and 6 MB for the canvas. The build touches only
each source's bounding box (radius 3 → 7 × 7 cells), which takes a few milliseconds.

**Alternatives considered**:
- One sample per cell, upscaled with smoothing. This blurs across the pixel-art grid and puts the
  radius edge in the wrong place at low zoom.
- Per-frame radial gradients (`createRadialGradient` with `lighter` compositing). These cost work
  on every frame, and overlap summing plus capping cannot match the fly's sum-then-clamp exactly.
- WebGL shader. Not needed for a static field (constitution VII).

## R4 — Heatmap colour ramp and transparency

**Decision**: A three-stop heat ramp: low = warm yellow, mid = orange, high = red. Colour is
interpolated linearly between the stops. Alpha is `maxAlpha × t`, with `maxAlpha = 0.55`. The stops
and `maxAlpha` are CSS custom properties (`--odour-low`, `--odour-mid`, `--odour-high`,
`--odour-alpha`) on `:root`, defined in the light block and in both dark blocks (FR-013). They are
read once with `getComputedStyle` when the field canvas is painted, and again if the theme changes.

**Rationale**:
- Alpha that rises with `t` keeps zero-odour ground untouched, and keeps the edge of the radius
  soft, so it fades out instead of ending in a hard line.
- A 0.55 cap keeps terrain, objects and the flies above the layer readable (FR-008).
- Yellow → red is the conventional heatmap reading of "more" and contrasts with the green and blue
  terrain palette.
- The world art does not change with the theme, so the two themes may share values. The tokens
  still exist in both themes so that the legend can follow the panel theme.

**Alternatives considered**: A single colour with only alpha changing, which gives a weak reading
at low values. Full spectrum (blue→red), which clashes with water tiles.

## R5 — Arcade-style visibility toggle in the World tab

**Decision**: The World tab gets a "Layers" box above the fly list, with one row per layer: the label
"ODOUR" and a switch. The switch is a `<button role="switch" aria-checked>` showing `ON` / `OFF`,
styled as an arcade control:
- square corners, a 2 px solid border and a hard 2 px offset shadow
- uppercase monospace text
- a block "thumb" that jumps from side to side with no easing
- the "on" state uses `--odour-high` as its fill

Pressing it (click, Enter or Space, which a `<button>` handles natively) toggles the layer. The
legend sits under the row and is hidden while the layer is off (FR-012).

**Rationale**:
- The user asked for the World tab and an arcade visibility toggle.
- `role="switch"` with `aria-checked` gives screen readers an on/off state.
- A native button needs no extra key handling.
- Square, unanimated controls match the pixel-art world.

**Alternatives considered**: An eye icon, which needs art or an SVG and is less clear than ON/OFF
text. A checkbox, which is accessible but not arcade-like. A global keyboard shortcut is left out
(spec: optional), because the canvas already uses keys for camera input and one control is enough.

## R6 — Keeping the switch when the panel re-renders

**Decision**: The World pane is split into two stable children: `.layers` (built once, updated in
place) and `[data-list]` (the fly list). `renderList` now writes only into `[data-list]`, so its
`replaceChildren` for "No flies configured" can no longer remove the switch.

**Rationale**: The panel re-renders at 20 Hz. The 006 panel already keeps buttons between renders
so focus survives, and the switch needs the same treatment.

## R7 — Layer state lives on the main thread only

**Decision**: A pure module `public/js/world/layers.js` holds the layer list and its state:
`LAYERS = [{ id: 'odour', label: 'Odour' }]`, `initialLayers()` returns every layer off, and
`toggleLayer(state, id)` returns a new state. `main.js` owns the state, passes it to the renderer
and the panel, and calls `requestDraw()` on change. Nothing in `fly/` or `brain/` reads it.

**Rationale**: FR-010 and SC-006 require the simulation to ignore the layer. Keeping the state out
of every module the flies import guarantees this structurally. The state is not persisted (spec
Assumptions).

## R8 — No odour sources

**Decision**: Sources come from `buildWorld(config, logic).stimulusCells`. The point list now comes
from a shared helper `stimulusPoints(world)` in `fly-world.js`, used by both `fly-host.js` and the
layer. A world with no `flies` section has no stimulus settings and no sources. The switch still
works, the field is empty, and the legend reads "No odour sources in this world".
