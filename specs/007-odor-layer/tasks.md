# Tasks: Odour Layer

**Input**: Design documents from `/specs/007-odor-layer/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/odour-layer.md, quickstart.md

**Tests**: The spec does not ask for TDD. The plan and contract name three new pure-module test
files (`odour-field`, `heatmap`, `layers`). They are included because they enforce FR-004 (the layer
shows the same field the flies sense) and SC-006 (the simulation ignores the layer). There are no
DOM or renderer tests. The browser check is the quickstart.

**Organization**: Setup, then Foundational, then one phase per user story:
- US1 (P1): heatmap over the world
- US2 (P1): the arcade switch in the World tab
- US3 (P3): legend

Polish comes last. US1 and US2 together are the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task serves (US1 to US3). Setup, Foundational and Polish tasks have no story label.
- Every task names its exact file path.

## Path Conventions

Static web app (plan.md, Project Structure). Browser modules are in `public/js/`, styles in
`public/css/style.css`, and Node tests in `tests/*.test.mjs` (run with `npm test`). The app is served
by `python3 -m http.server 8000` run from `public/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the baseline before any change.

- [X] T001 Run `npm test` from the repository root and confirm 232 passing tests, 0 failing. Record the count in the commit message of the first change, so that later phases can show nothing regressed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared falloff, the shared source list, the layer state and the renderer overlay
hook. US1, US2 and US3 all depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] In `public/js/fly/stimulus.js`, add `export function falloff(d, radius)` returning `radius > 0 ? Math.max(0, 1 - d / radius) : 0` with a one-line comment that it is shared with the odour layer (specs/007-odor-layer research R1). Change `fruitIntensity` to `sum += falloff(Math.hypot(p.x - x, p.y - y), radius)`. Do not change its signature or results. Contract §1 in `specs/007-odor-layer/contracts/odour-layer.md`.
- [X] T003 [P] In `public/js/fly/fly-world.js`, add `export function stimulusPoints(world)` returning `[...world.stimulusCells.keys()].map((idx) => ({ x: (idx % world.width) + 0.5, y: Math.floor(idx / world.width) + 0.5 }))`. In `public/js/fly/fly-host.js`, import it and replace the inline `points` mapping in `startFlies` with `const points = stimulusPoints(world);`. Contract §2.
- [X] T004 [P] Create `public/js/world/layers.js` (pure, no DOM). Export:
  - `LAYERS = [{ id: 'odour', label: 'Odour' }]`
  - `initialLayers()`, returning a fresh `{ odour: false }` built from `LAYERS` (every layer off)
  - `toggleLayer(state, id)`, returning a new object with `id` flipped. An id not in `LAYERS` returns a copy with the same values.

  Header comment: the state is "not persisted. Nothing under `fly/` or `brain/` imports it (R7)". Contract §5.
- [X] T005 [P] Create `tests/layers.test.mjs`. It checks that:
  - `initialLayers()` is `{ odour: false }` (FR-002)
  - `toggleLayer` flips `odour` and does not mutate its input
  - an unknown id leaves the values unchanged
  - no file under `public/js/fly/` or `public/js/brain/` contains the text `world/layers.js` or `odour-field.js` (read the directories with `node:fs`; FR-010, SC-006)
- [X] T006 Update `public/js/render/renderer.js`: `render({ camera, scene, flies = [], overlays = [] })`. Right after the scene `drawImage` (inside the same `if (sw > 0 && sh > 0)` block), draw each overlay with the same arguments: `ctx.drawImage(overlay, sx, sy, sw, sh, dx, dy, Math.round(sw * scale), Math.round(sh * scale))`. Flies are drawn after the overlays. With `overlays` empty, the output is unchanged. Update the file's header comment to mention overlays. Contract §6.
- [X] T007 Run `npm test`. All 232 earlier tests plus `tests/layers.test.mjs` must pass. The `body`, `determinism` and `fly-world` tests prove that T002 and T003 changed no behaviour. Depends on T002–T006.

**Checkpoint**: The app still runs exactly as before, because no overlay is passed yet.

---

## Phase 3: User Story 1 - Show the Odour Field Over the World (Priority: P1) 🎯 MVP

**Goal**: A heatmap of the odour field, the same field the flies sense, drawn semi-transparently over the
terrain and under the flies, aligned when panning and zooming.

**Independent Test**: `npm test` passes the field-parity and ramp tests. In the browser, after T014 (or
temporarily changing `initialLayers()` to return `{ odour: true }`), a yellow→red wash surrounds every
flower:
- strongest on the flower
- absent beyond 3 cells
- stronger where two flowers overlap
- flies drawn above it
- aligned when panning and zooming

### Implementation for User Story 1

- [X] T008 [P] [US1] Create `public/js/world/odour-field.js` (pure, no DOM). Export `odourField({ points, stimulus, cols, rows, samplesPerCell })`, which returns `{ width: cols * samplesPerCell, height: rows * samplesPerCell, samplesPerCell, values: Float32Array }`.
  - Sample `(i, j)` is at cell coordinates `((i + 0.5) / samplesPerCell, (j + 0.5) / samplesPerCell)`.
  - For each point, visit only the samples inside its bounding box `[x − radius, x + radius] × [y − radius, y + radius]`, clamped to `[0, width) × [0, height)`. Add `falloff(distance, stimulus.radius)` imported from `../fly/stimulus.js`.
  - Then set every value to `Math.min(1, stimulus.gain * sum / stimulus.max)`.
  - Rules quoted from data-model.md:
    - "`values[k] = 0` when no source is within `radius`"
    - "If `max ≤ 0` or the source list is empty, every value is 0"
    - "The field is built once, lazily, and never changes during a run"
  - Do not add `stimulus.resting` (research R2).
- [X] T009 [P] [US1] Create `tests/odour-field.test.mjs` covering every guarantee in contract §3:
  - **Parity**: on a 6×4 grid with `samplesPerCell = 4`, `radius 2`, `gain 1`, `max 1` and points `[{x:1.5,y:1.5},{x:3.5,y:2.5}]`, every `values[k]` equals `Math.min(1, gain * fruitIntensity(points, sx, sy, radius) / max)` within 1e-6.
  - **Reach**: a sample farther than `radius` from every point is exactly 0.
  - **Overlap**: the midpoint of two points 2 cells apart is greater than one point's value at the same distance.
  - **Cap**: no value exceeds 1 (use `gain 5`).
  - **Bounds**: a point at `{x:0.5,y:0.5}` produces no out-of-range write, and the length equals `width * height`.
  - **Empty**: no points, and also `max 0`, give all zeros.
- [X] T010 [P] [US1] Create `public/js/render/heatmap.js`. Export:
  - `parseRamp(style)` (pure). It reads `--odour-low`, `--odour-mid` and `--odour-high` via `style.getPropertyValue(name)`, each as an `"r, g, b"` triple of integers, and `--odour-alpha` as a number in (0, 1]. It returns `{ stops: [[r,g,b],[r,g,b],[r,g,b]], maxAlpha }`. On a missing or invalid token it falls back to the defaults `255, 214, 10` / `255, 128, 0` / `220, 38, 38` / `0.55`.
  - `rampColor(t, ramp)` (pure). It clamps `t` to [0, 1]. The colour is linear low→mid for `t ≤ 0.5` and mid→high above, with each channel rounded. Alpha is `Math.round(255 * ramp.maxAlpha * t)`. It returns `[r, g, b, a]`.
  - `paintField(field, ramp)` (browser only). It creates a canvas of `field.width × field.height`, fills one `ImageData` with `rampColor(field.values[k], ramp)`, puts it with `putImageData`, and returns the canvas.

  Contract §4, research R4.
- [X] T011 [P] [US1] Create `tests/heatmap.test.mjs` for `parseRamp` and `rampColor` (contract §4). It checks that:
  - `a = 0` at `t = 0` and at `t = -1`
  - alpha does not decrease over `t` = 0, 0.1, …, 1
  - `a ≤ 255 * maxAlpha`
  - `t = 2` equals `t = 1`
  - the colour equals the low stop at 0, the mid stop at 0.5 and the high stop at 1
  - `parseRamp` with a stub `{ getPropertyValue: (n) => map[n] ?? '' }` returns the parsed tokens, and falls back to the defaults when they are empty
- [X] T012 [P] [US1] In `public/css/style.css`, add the tokens `--odour-low: 255, 214, 10;`, `--odour-mid: 255, 128, 0;`, `--odour-high: 220, 38, 38;` and `--odour-alpha: 0.55;` to `:root`. Add the same four tokens to the `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` block and to the `:root[data-theme="dark"]` block, with values `255, 224, 64` / `255, 140, 26` / `239, 68, 68` / `0.55` (FR-013).
- [X] T013 [US1] Wire the overlay in `public/js/main.js`, inside `startWorld`:
  - Import `initialLayers`, `odourField`, `parseRamp`, `paintField`, `stimulusPoints` and `resolveFlies`.
  - Create `let layers = initialLayers();` and `let odourCanvas = null; let odourFieldCache = null;`.
  - Add `ensureOdour()`. On first call it builds:
    - `points`: `stimulusPoints(buildWorld(config, logic))` when `config.flies !== undefined`, else `[]`
    - the field: `odourField({ points, stimulus, cols: config.grid.cols, rows: config.grid.rows, samplesPerCell: CELL_PX })`, where `stimulus` is `resolveFlies(config).stimulus` (or `{ radius: 0, gain: 0, max: 0 }` without flies)
    - `odourCanvas`: `paintField(field, parseRamp(getComputedStyle(document.documentElement)))`
  - Wrap the build in try/catch. On error, `console.error` it and keep the canvas null.
  - In `requestDraw`, pass `overlays: layers.odour && odourCanvas ? [odourCanvas] : []` to `renderer.render`.
  - Add a `matchMedia('(prefers-color-scheme: dark)')` `change` listener. If `odourFieldCache` exists, it repaints `odourCanvas` from the cached field with a freshly parsed ramp, then calls `requestDraw()`.
  - Depends on T006, T008, T010.

**Checkpoint**: With the layer forced on, the heatmap draws correctly and stays aligned. `npm test` passes.

---

## Phase 4: User Story 2 - Turn the Odour Layer On and Off (Priority: P1) 🎯 MVP

**Goal**: An arcade-style ON/OFF switch in a "Layers" box in the World tab. It is off on load, shows its
state, and toggles the heatmap on the next frame without touching the simulation.

**Independent Test**:
- Load the page: no tint, and the World tab shows `ODOUR [OFF]` above the fly list.
- Press the switch: it reads `ON` and the heatmap appears.
- Press it again: the heatmap is gone.
- Tab to the switch and press Space: it toggles.
- The fly list still works and selecting a fly still moves to the Fly tab.

### Implementation for User Story 2

- [X] T014 [US2] Update `public/js/ui/panel/panel.js` per contract §7 and research R6:
  - `renderPanel` gains an 8th parameter `view = { layers: {}, onLayer: () => {}, legend: null }` and passes it to a new `renderLayers(worldPane, view)`.
  - In `ensureShell`, the world pane is created with two stable children: a `section.panel-box.layers` and a `div[data-list]`.
  - `renderList` receives the `[data-list]` element instead of the pane. Its `replaceChildren('No flies configured')` and `prepend(list)` now act only on that element.
  - `renderLayers` builds, once, an `h4` "Layers" plus one `div.layer-row[data-layer=<id>]` per entry of `LAYERS` (import from `../../world/layers.js`). Each row holds a `span.layer-label` with `label.toUpperCase()` and a `button.arcade-switch` with `type="button"`, `role="switch"` and `aria-label="<label> layer"`.
  - On every render, set each switch's `aria-checked` to `String(Boolean(view.layers[id]))`, set its `textContent` to `ON` or `OFF`, and set `onclick = () => view.onLayer(id)`.
  - All text is set with `textContent`.
- [X] T015 [US2] In `public/js/main.js`, add `const toggle = (id) => { layers = toggleLayer(layers, id); if (layers.odour) ensureOdour(); requestDraw(); updatePanel(); };`. Pass `{ layers, onLayer: toggle, legend }` as the 8th argument of `renderPanel` in `updatePanel`. Set `legend` to `null` for now (US3 fills it). Import `toggleLayer`. Depends on T013, T014.
- [X] T016 [P] [US2] In `public/css/style.css`, add the arcade switch styles (research R5):
  - `.layers .layer-row`: a flex row, `justify-content: space-between`, `align-items: center`, `margin-top: 6px`. `.layer-label` uses `ui-monospace`, uppercase, `letter-spacing: 1px`.
  - `#fly-panel button.arcade-switch` overrides the generic panel button with:
    - `display: inline-flex; width: 64px; min-height: 28px; padding: 2px`
    - `border: 2px solid currentColor; border-radius: 0; box-shadow: 2px 2px 0 currentColor`
    - `font: 700 12px/1 ui-monospace, monospace; text-align: center; justify-content: center; align-items: center`
    - `transition: none`
  - `[aria-checked="true"]` uses `background: rgb(var(--odour-high)); color: #fff`.
  - `:active` uses `transform: translate(2px, 2px); box-shadow: none`.
  - `:focus-visible` uses `outline: 2px dashed currentColor; outline-offset: 2px`.

**Checkpoint**: US1 + US2 together are the MVP. Run quickstart rows 1–9.

---

## Phase 5: User Story 3 - Read the Odour Level at a Point (Priority: P3)

**Goal**: While the layer is on, a legend under the switch shows the heatmap ramp from 0 to the sensed
maximum. Without odour sources it says so instead.

**Independent Test**:
- Turn the layer on: the legend shows a yellow→red ramp with `0` on the left and `1.0` on the right
  (the default `max`). Its colours match the tint on and around a flower.
- Turn the layer off: the legend is hidden.

### Implementation for User Story 3

- [X] T017 [US3] In `public/js/ui/panel/panel.js` `renderLayers`, build once a `div.odour-legend` after the odour row. It contains `span.legend-ramp`, `span.legend-min` and `span.legend-max`, plus a `p.legend-empty`. On every render:
  - `legend.hidden = !view.layers.odour`.
  - When `view.legend` is null: hide the ramp, min and max, and show `legend-empty` with the text "No odour sources in this world".
  - Otherwise: hide `legend-empty`, set `legend-min` to `0` and `legend-max` to `view.legend.max.toFixed(1)` with `textContent` (FR-012).
- [X] T018 [US3] In `public/js/main.js`, compute `legend` once: `{ max: resolveFlies(config).stimulus.max }` when `config.flies !== undefined` and the stimulus point list is non-empty, else `null`. Reuse the points from `ensureOdour` by moving the point computation to a `const odourPoints` evaluated once in `startWorld`. Pass it in the `view` object (replacing the `null` from T015).
- [X] T019 [P] [US3] In `public/css/style.css`, style the legend:
  - `.odour-legend` is a grid with `grid-template-columns: auto 1fr auto; gap: 6px; align-items: center; margin-top: 6px`, using `ui-monospace` at 12px.
  - `.odour-legend[hidden]` has `display: none`.
  - `.legend-ramp` is `height: 10px; border: 2px solid currentColor; background: linear-gradient(to right, rgba(var(--odour-low), 0), rgba(var(--odour-mid), calc(var(--odour-alpha) * 0.5 + 0.25)), rgba(var(--odour-high), 1))`.
  - Order the grid as min, ramp, max: put `legend-min` first in DOM order in T017, or use `order`.

**Checkpoint**: All three stories work. Run quickstart rows 1–10.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 Run `npm test`. Every earlier test plus `layers`, `odour-field` and `heatmap` must pass with 0 failing.
- [X] T021 Run `npm run experiment` on this branch and on `main` (for example with `git stash` or a worktree), and confirm identical output (quickstart §3, SC-006).
- [X] T022 Run the browser check from `specs/007-odor-layer/quickstart.md` §2: `cd public && python3 -m http.server 8000`, rows 1–10, at desktop width and at a 390 px phone width (the Layers box must not cause horizontal scroll). Confirm no console errors (constitution run check).
- [X] T023 [P] Update the header comment of `public/js/ui/panel/panel.js` to mention the Layers box in the World tab (specs/007-odor-layer/contracts/odour-layer.md §7). Update the header of `public/js/main.js` to mention the odour overlay.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. Blocks every story.
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational. T015 also needs T013 (the overlay wiring it toggles). T014 and T016 can start as soon as Foundational is done.
- **US3 (Phase 5)**: after US2 (it extends `renderLayers` and the `view` object).
- **Polish (Phase 6)**: after the stories you ship.

### Task Graph

```text
T001 → {T002, T003, T004, T005, T006} → T007
T007 → {T008, T009, T010, T011, T012} ; T008 + T010 + T006 → T013
T007 → {T014, T016} ; T013 + T014 → T015
T015 → T017 → T018 ; T019 ∥ T017
{T015 | T018} → T020 → T021 → T022 ; T023 ∥ T020
```

### Within Each Story

- Pure modules and their tests first (they are parallel, in different files), then the `main.js`
  wiring.
- `main.js` is edited by T013, T015 and T018, and `panel.js` by T014 and T017. Do these in order.
  Never run them in parallel.

---

## Parallel Example

```text
# Foundational, in parallel (five files):
T002 public/js/fly/stimulus.js
T003 public/js/fly/fly-world.js + fly-host.js
T004 public/js/world/layers.js
T005 tests/layers.test.mjs
T006 public/js/render/renderer.js

# User Story 1, in parallel (five files), then T013:
T008 public/js/world/odour-field.js
T009 tests/odour-field.test.mjs
T010 public/js/render/heatmap.js
T011 tests/heatmap.test.mjs
T012 public/css/style.css (tokens)

# User Story 2, in parallel once Foundational is done:
T014 public/js/ui/panel/panel.js
T016 public/css/style.css (switch)   # different rule block from T012; do T012 first if one agent edits both
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1, then Phase 2. Stop at the checkpoint: the app is unchanged and the tests are green.
2. Phase 3. The heatmap is wired but off.
3. Phase 4. The switch makes it visible. **Stop and validate** with quickstart rows 1–9. This is a
   shippable feature, since both P1 stories are done.

### Incremental Delivery

4. Phase 5 adds the legend (P3).
5. Phase 6 runs the full regression, the determinism comparison and the phone-width check.

## Notes

- `fruitIntensity` results must not change. If any existing test changes after T002, stop and fix T002.
- The layer state must never reach `fly/` or `brain/`. `tests/layers.test.mjs` (T005) enforces this.
- Commit after each phase checkpoint.
