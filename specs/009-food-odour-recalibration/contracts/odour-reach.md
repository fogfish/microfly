# Contract: Odour Reach per Food Unit

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Extends**: [specs/007-odor-layer/contracts/odour-layer.md](../../007-odor-layer/contracts/odour-layer.md)

Replaces the single global `radius` as the reach of every source. The global `radius` stays as the per-size factor (world format version 3, section 4).

## 1. Reach of a food unit

```text
reach(unit) = flies.stimulus.radius × sizeTiles(unit.sprite)
sizeTiles(sprite) = max(sprite.w, sprite.h) / CELL_PX     CELL_PX = 32
```

- Computed once in `buildWorld` (fly side) and used for the odour layer. Pure.
- The catalogue entry supplies `w` and `h`. A sprite missing from the catalogue is refused by the validator, so `sizeTiles` never sees it.

## 2. `public/js/fly/stimulus.js` (pure)

```js
export function falloff(d, radius)                       // unchanged: max(0, 1 - d / radius); 0 when radius <= 0
export function fruitIntensity(points, x, y, radius)     // per point: falloff(d, p.reach ?? radius)
export function senseBilateral(points, fly, stimulus)    // per point: falloff(d, p.reach ?? stimulus.radius) × (p.fraction ?? 1)
```

- `p.reach` (cells) is set by the fly world. `p.reach ?? radius` keeps the old single-radius path for unit fixtures that have no reach. No shipped world uses that path.
- The sum-then-cap rule and the resting level are unchanged.

## 3. `public/js/fly/fly-world.js` and `food.js` (pure)

```js
// stimulusCells: Map<cellIndex, { kind, reach }>
export function stimulusPoints(world)   // [{ x, y, reach }] cell centres in tiles
// food.points(): [{ x, y, reach, fraction }]
```

- `buildWorld` reads `logic.edibleSize[idx]` (set by `buildLogic`) and multiplies by `radius`.
- `stimulusPoints` now carries `reach`. Callers that only need positions keep working.

## 4. `public/js/world/odour-field.js` (pure, no DOM)

```js
export function odourField({ points, stimulus, cols, rows, samplesPerCell })
  // → { width, height, samplesPerCell, values: Float32Array }
```

- Each point visits the bounding box of its own `reach`, not of the global radius.
- Parity with the fly (odour-layer contract §3): for any sample, `values[k]` equals `min(1, gain × fruitIntensity(points, sx, sy, p.reach) / max)` within 1e-6. Each source's value is the same falloff the fly senses.
- Reach: a sample farther than a point's own `reach` from that point gets nothing from it.
- Cap: no value exceeds 1. Peak: the value at a unit's centre is `min(1, gain / max)`, which is 1 with the shipped values.

## 5. `public/js/main.js`

- `odourSources(config, logic)` returns `stimulusPoints(buildWorld(...))`, so points carry `reach`. The legend stays `{ max: stimulus.max }`.

## 6. Tests

- `tests/odour-field.test.mjs` (updated): parity with per-point reach; reach; overlap; cap; bounds; empty.
- `tests/odour-food.test.mjs` (new), one file per spec rule:
  - SC-001: peak at each unit is the maximum; reach ratio equals size ratio within 5% (`sizeTiles` ratio from the catalogue).
  - SC-002: the odour-free share of walkable cells is between 30% and 70%.
  - SC-003: no walkable cell is cut off from odour (route check on the walkable grid).
  - Units are on land and not on each other (FR-008).
- `tests/fly-world.test.mjs` (updated): stimulus cells carry the reach of their unit.
