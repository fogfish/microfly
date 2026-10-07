# Contract: Odour Layer

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

These are internal module contracts between the world, the renderer and the panel. They are not a
public API. The worker protocol and the snapshot format are unchanged.

## 1. `public/js/fly/stimulus.js` (pure)

```js
export function falloff(d, radius)          // max(0, 1 - d / radius); 0 when radius <= 0
export function fruitIntensity(points, x, y, radius)   // unchanged result; now sums falloff()
```

`fruitIntensity` MUST return the same values as before this change. The existing body and
determinism tests must still pass.

## 2. `public/js/fly/fly-world.js` (pure)

```js
export function stimulusPoints(world)       // [{x, y}] cell centres of world.stimulusCells
```

`fly-host.js` MUST use this helper in place of its inline mapping.

## 3. `public/js/world/odour-field.js` (pure, no DOM)

```js
export function odourField({ points, stimulus, cols, rows, samplesPerCell })
  // → { width, height, samplesPerCell, values: Float32Array }
```

The function MUST satisfy these guarantees, each covered by `tests/odour-field.test.mjs`:
- **Parity**: for any sample, `values[k]` equals `min(1, gain × fruitIntensity(points, sx, sy, radius) / max)`
  to within 1e-6 (FR-004, SC-003).
- **Reach**: a sample farther than `radius` from every point is exactly 0 (FR-006, SC-004). Spec 009 (contracts/odour-reach.md §4): each point uses its own `reach` when it has one, so a sample is zero beyond that source's reach only.
- **Overlap**: two points sum, so the value at the midpoint is greater than a single point's value
  at the same distance (spec US1 scenario 3).
- **Cap**: no value exceeds 1 (FR-007).
- **Bounds**: points near the edge never write outside `[0, width) × [0, height)` (edge case).
- **Empty**: no points, or `max ≤ 0`, gives all zeros.

## 4. `public/js/render/heatmap.js`

```js
export function parseRamp(style)            // pure: reads --odour-low/mid/high/alpha from a
                                            // CSSStyleDeclaration-like {getPropertyValue}
export function rampColor(t, ramp)          // pure → [r, g, b, a], a in 0..255
export function paintField(field, ramp)     // browser: → HTMLCanvasElement (field.width × field.height)
```

`rampColor` rules (`tests/heatmap.test.mjs`):
- `a = 0` at `t ≤ 0`.
- `a` does not decrease as `t` increases.
- `a ≤ 255 × maxAlpha`.
- `t > 1` is treated as 1.
- The colour equals the low stop at 0, the mid stop at 0.5 and the high stop at 1.

## 5. `public/js/world/layers.js` (pure)

```js
export const LAYERS                         // [{ id: 'odour', label: 'Odour' }]
export function initialLayers()             // { odour: false }
export function toggleLayer(state, id)      // new state; unknown id → same values
```

## 6. Renderer: `public/js/render/renderer.js`

```js
render({ camera, scene, flies, overlays = [] })
```

- `overlays` is an array of canvases, each the same size as `scene`.
- Each overlay is drawn after the scene and before the flies, using the same source rectangle and
  destination rectangle as the scene, with `imageSmoothingEnabled = false`.
- An empty array draws exactly what the renderer draws today (SC-001).
- `main.js` passes `[odourCanvas]` when `layers.odour` is true and `[]` otherwise.

## 7. Panel: `public/js/ui/panel/panel.js`

```js
renderPanel(container, records, selectedId, onSelect, sections, tab, onTab, view)
// view: { layers, onLayer(id), legend: { max } | null }
```

World pane DOM. It is built once and updated in place (R6):

```html
<div class="pane" data-pane="world">
  <section class="panel-box layers">
    <h4>Layers</h4>
    <div class="layer-row" data-layer="odour">
      <span class="layer-label">ODOUR</span>
      <button type="button" role="switch" class="arcade-switch" aria-checked="false"
              aria-label="Odour layer">OFF</button>
    </div>
    <div class="odour-legend" hidden>
      <span class="legend-ramp"></span>
      <span class="legend-min">0</span> <span class="legend-max">1.0</span>
    </div>
  </section>
  <div data-list></div>
</div>
```

Rules:
- The switch's `aria-checked` and its text (`ON` / `OFF`) MUST reflect `view.layers.odour` after
  every render (FR-003).
- Pressing the switch calls `view.onLayer('odour')`.
- The legend is visible only when the layer is on (FR-012).
- The legend shows `0` and `stimulus.max` formatted to one decimal.
- When `legend` is null (no sources), the legend shows the text "No odour sources in this world".
- All text is set with `textContent` (006 FR-014).
- The fly list renders into `[data-list]` only.
