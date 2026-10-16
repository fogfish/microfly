# Contract: Odour Layer v2 — Four Independent Overlays

**Amends**: [specs/007-odor-layer/contracts/odour-layer.md](../../007-odor-layer/contracts/odour-layer.md).
Internal module contracts between the world, the renderer and the panel — not a public API. The worker
protocol and the snapshot format are unchanged.

## 1. `public/js/world/layers.js` (pure)

```js
export const LAYERS = [
  { id: 'odour-food',   label: 'Food odour' },
  { id: 'odour-danger', label: 'Danger odour' },
  { id: 'odour-heat',   label: 'Heat odour' },
  { id: 'grid',         label: 'Grid' },
];
export function initialLayers()        // { 'odour-food': false, 'odour-danger': false, 'odour-heat': false, grid: false }
export function toggleLayer(state, id) // unchanged behaviour, now over 4 ids
```

- `initialLayers`/`toggleLayer` signatures and behaviour are **unchanged** — this amendment only grows the
  `LAYERS` list (spec FR-019/FR-020, SC-006). Any code already written generically against `LAYERS`
  (nothing outside `layers.js` currently is) needs no change.
- Every layer still starts `false` (007 FR-002, unchanged).
- Any combination of the four MAY be on at once, independently (FR-020) — `toggleLayer` already flips one
  id without touching the others, so this is already true structurally; this contract makes it explicit.

## 2. `public/js/world/food-field.js`, `danger-field.js`, `heat-field.js` (pure, no DOM)

Each field builder (contracts/world-format-sketch-map.md §3–4) is the single source of truth for both the
fly's sense and its overlay — the overlay MUST show exactly what a fly at that point would sense (spec
FR-004 of 007, carried forward). No separate "visualization-only" computation is introduced for any of the
three fields.

## 3. `public/js/render/heatmap.js` — per-channel ramps and grid lines

```js
export function parseRamp(style, prefix)   // CHANGED: prefix selects the CSS token group, e.g.
                                            // '--odour-food', '--odour-danger', '--odour-heat'
                                            // (was hard-coded to '--odour-*'); default prefix '--odour'
                                            // keeps today's single-ramp callers working unchanged.
export function rampColor(t, ramp)         // unchanged
export function paintField(field, ramp)    // unchanged: → HTMLCanvasElement (field.width × field.height)
export function paintGrid(cols, rows, cellPx, style)  // NEW → HTMLCanvasElement (cols×cellPx × rows×cellPx)
```

- `parseRamp`'s new `prefix` parameter is backward compatible: calling it with no `prefix` reads
  `--odour-low`/`--odour-mid`/`--odour-high`/`--odour-alpha` exactly as today (existing
  `tests/heatmap.test.mjs` cases still pass unmodified).
- Three new CSS custom-property groups are introduced (`--odour-danger-low/mid/high/alpha`,
  `--odour-heat-low/mid/high/alpha`), each with the same shape and fallback behaviour as `--odour-*`
  (`parseRamp`'s existing `??` fallback to `DEFAULT_RAMP` applies per group). The existing `--odour-*`
  tokens are renamed in meaning to `--odour-food-*` at the CSS level, with `--odour-*` kept as an alias (or
  `--odour-food-*` falling back to `--odour-*`) so no theme file breaks before it is updated.
- `paintGrid` draws 1px lines (CSS token `--grid-line-color`, falling back to a low-alpha neutral grey) at
  every `cellPx` boundary, for a `cols × rows` grid — pure with respect to its inputs (same inputs, same
  canvas content), but like `paintField` it needs a browser canvas (not a Node-testable pure function);
  tested through `public/tests` DOM-capable suites or a snapshot of its drawing calls, consistent with how
  `composeScene` itself is excluded from the Node test suite today (`compose.js`'s own header comment).

## 4. `public/js/render/renderer.js`

Unchanged (`render({ camera, scene, flies, overlays = [] })`, `overlays: HTMLCanvasElement[]`). `main.js`
now may pass up to 4 canvases in `overlays` (any subset of food/danger/heat/grid currently on), instead of
at most 1 — no renderer change needed, since `overlays` was already a list.

## 5. `public/js/main.js`

- Builds/caches one field + canvas pair per odour layer (`foodField`/`dangerField`/`heatField`, each via
  its own builder) plus one grid canvas, lazily, the first time that layer is switched on — same
  build-once-cache pattern as today's single `odourFieldCache`/`odourCanvas`, now times three, plus the
  grid canvas (which needs no field, only `config.grid`).
- `requestDraw`'s `overlays` array is built as
  `[layers['odour-food'] && foodCanvas, layers['odour-danger'] && dangerCanvas, layers['odour-heat'] && heatCanvas, layers.grid && gridCanvas].filter(Boolean)`.
- The theme-change repaint (today: re-run `paintOdour()` on `prefers-color-scheme` change) repaints every
  *already-built* canvas among the four, not just one.

## 6. Panel: `public/js/ui/panel/panel.js`

The World pane's single `.layer-row`/`.odour-legend` pair becomes one `.layer-row` per `LAYERS` entry,
built generically from the list (today's markup is already keyed by `data-layer="odour"`; this amendment
is "loop over `LAYERS`" rather than "hard-code one row"):

```html
<section class="panel-box layers">
  <h4>Layers</h4>
  <!-- one row per LAYERS entry -->
  <div class="layer-row" data-layer="odour-food">
    <span class="layer-label">FOOD ODOUR</span>
    <button type="button" role="switch" class="arcade-switch" aria-checked="false"
            aria-label="Food odour layer">OFF</button>
  </div>
  <div class="layer-row" data-layer="odour-danger"> ... </div>
  <div class="layer-row" data-layer="odour-heat"> ... </div>
  <div class="layer-row" data-layer="grid"> ... </div>
  <!-- one legend per odour layer (not grid); same shape as today's single .odour-legend, keyed by layer id -->
  <div class="odour-legend" data-legend="odour-food" hidden> ... </div>
  <div class="odour-legend" data-legend="odour-danger" hidden> ... </div>
  <div class="odour-legend" data-legend="odour-heat" hidden> ... </div>
  <div data-list></div>
</section>
```

Rules (extending 007's §7 rules, now per-layer):
- Each switch's `aria-checked`/text reflects `view.layers[id]` after every render.
- Pressing a switch calls `view.onLayer(id)`.
- Each odour legend is visible only when its own layer is on; `grid` has no legend.
- The `grid` layer MUST NOT draw over the legend/panel chrome — it is a world-canvas overlay only, same as
  the odour overlays.
- All text is set with `textContent` (006 FR-014, unchanged).

## 7. Tests

- `tests/layers.test.mjs` (extend): 4-entry `LAYERS`, `initialLayers`/`toggleLayer` over the new ids.
- `tests/heatmap.test.mjs` (extend): `parseRamp` with an explicit `prefix`; `paintGrid`'s line positions.
- `tests/panel-*.test.mjs` (extend as needed): 4 switches render, each toggles independently, combinations
  of on/off render correctly (spec SC-006).
