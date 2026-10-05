# Data Model: Odour Layer

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Everything here lives on the main thread. No snapshot, worker message or world-config field
changes.

## Odour source

A cell of the logic grid that holds an object whose kind is listed in `flies.stimulus.objects`.

| Field | Type | Notes |
|---|---|---|
| `x` | number | Cell centre in cells (`cx + 0.5`) |
| `y` | number | Cell centre in cells (`cy + 0.5`) |

- Produced by `stimulusPoints(world)` (R8) from `buildWorld(config, logic).stimulusCells`.
- The flies and the layer use the same list.
- An empty list is valid.

## Odour settings

These are read from the resolved `flies.stimulus` section (`resolveFlies(config).stimulus`). This
feature adds no new fields.

| Field | Used for |
|---|---|
| `radius` | Distance (cells) where a source's falloff reaches 0 |
| `gain` | Scales summed intensity |
| `max` | Cap of the sensed value; the high end of the heatmap and legend |
| `resting` | Not drawn (R2). It stays the fly's baseline only |

## Odour field

| Field | Type | Notes |
|---|---|---|
| `width` | integer | Samples across = scene width in px (`cols × cellPx`) |
| `height` | integer | Samples down = scene height in px |
| `samplesPerCell` | integer | `cellPx` (32 by default) |
| `values` | `Float32Array(width × height)` | Normalised level `t ∈ [0, 1]`, row-major |

Rules:
- Sample `(i, j)` is at cell coordinates `((i + 0.5) / samplesPerCell, (j + 0.5) / samplesPerCell)`.
- `values[k] = min(1, gain × I / max)`, where `I = Σ falloff(distance to source, radius)` (R1, R2).
- `values[k] = 0` when no source is within `radius`.
- If `max ≤ 0` or the source list is empty, every value is 0.
- The field is built once, lazily, and never changes during a run (R3).

## Heatmap ramp

| Field | Type | Source |
|---|---|---|
| `stops` | `[[r,g,b], [r,g,b], [r,g,b]]` | `--odour-low`, `--odour-mid`, `--odour-high` |
| `maxAlpha` | number in (0, 1] | `--odour-alpha` (0.55) |

`rampColor(t)`:
- Colour: linear between low → mid for `t ≤ 0.5`, and between mid → high above that.
- Alpha: `round(255 × maxAlpha × t)`.
- At `t = 0` alpha is 0.
- `t` is clamped to [0, 1] first.

## Layer state

| Field | Type | Notes |
|---|---|---|
| `odour` | boolean | `false` on load (FR-002) |

- `LAYERS = [{ id: 'odour', label: 'Odour' }]`.
- `initialLayers()` returns `{ odour: false }`.
- `toggleLayer(state, id)` returns a new object with that id flipped.
- An unknown id returns the state unchanged.
- The state is not persisted. Nothing under `fly/` or `brain/` imports it (R7).

State transitions:

```text
off ──press switch──▶ on   (field built on first entry, then drawn every frame)
on  ──press switch──▶ off  (overlay skipped; legend hidden)
```
