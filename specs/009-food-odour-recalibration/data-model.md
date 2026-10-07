# Data Model: Food Odour Recalibration

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Food unit (world config `edibles[]`, version 3)

| Field | Type | Rule |
|---|---|---|
| `kind` | `"small"` \| `"medium"` \| `"large"` | Closed set in code (`EDIBLE_KINDS`). Anything else is refused by name. |
| `sprite` | atlas id | Required. Must exist in the catalogue. Must be one of the food sprites: `red_flower_plant` (small), `jungle-plant-010` (medium), `jungle-plant-015` (large). |
| `x`, `y` | number | Foot point in cells (centre = index + 0.5). Must be on land, not on a blocked cell, and not on another edible cell. |

~~Exactly three entries per world. One per kind.~~ One or more entries per world per kind, every kind present at
least once. Entries of the same kind MAY sit near each other so their odour reach overlaps and adds (FR-001,
FR-008, FR-020, BUG-001).

## Derived food values (code, not stored)

| Name | Source | Formula |
|---|---|---|
| `sizeTiles` | catalogue `w`, `h` of `sprite` | `max(w, h) / CELL_PX` |
| `reach` | `flies.stimulus.radius`, `sizeTiles` | `radius × sizeTiles` (cells) |
| `stock` | `flies.food` | Existing stock model (`food.js`). Starts full, lowered by eating, regrows. |
| `fraction` | `stock / full` | In [0, 1]. The bilateral odour is scaled by it (existing behaviour). |

Reach per kind (radius = 6, unchanged by BUG-001 — only the instance count and positions changed): small 6.0, medium 8.44, large 11.81 cells. The shipped worlds now carry 5 instances (2 small, 2 medium, 1 large) to reach the 60–70% odour-coverage target (FR-006); every instance of a kind shares that kind's reach.

## Odour source (runtime, `{x, y, reach, fraction?}`)

| Field | Meaning |
|---|---|
| `x`, `y` | Cell centre in tiles (`edible index + 0.5`). |
| `reach` | Falloff distance in cells, from the food unit. |
| `fraction` | Stock over full stock. Only in the forager (bilateral) sampler. |

Intensity at a point: `Σ falloff(d, reach) × fraction`, then `clamp(resting + gain × sum, 0, max)` for the brain (v0 and v1), and `min(1, gain × sum / max)` for the odour layer. Peak at the unit's position is `gain / max` (1.0 with the shipped values). (FR-003.)

## Decor object (world config `scatter[]`, `shore.js` rules)

| Field | Rule |
|---|---|
| `sprites` | Any catalogue id except the food sprites and the removed sprites. Yellow flowers (`trees-plant-001` to `003`) are allowed as decor. |
| Never odour, never a stimulus | Decor is not in `edibles`. (FR-010.) |

Removed everywhere: `jungle-plant-016`, `jungle-plant-017`, `jungle-bush-018`. (FR-009.)

## Fly sprite (world config `sprites`)

~~| `fly` | Pixel sprite, 32 rows × 32 columns, palette `{ w, k, e, ... }`. Drawn head-up. (FR-013, FR-014.) |
| `fly-baseline` | Same shape as `fly`, different palette. (FR-016.) |~~

Superseded by BUG-002: one generic shape is replaced by a female and a male shape, each with its own baseline. Wings on both
project laterally, roughly at a right angle to the body axis (FR-014).

| Field | Rule |
|---|---|
| `fly-female` | Pixel sprite, 32 rows × 32 columns, palette `{ w, k, e, ... }`. Drawn head-up. Longer, evenly banded abdomen. (FR-013, FR-014, FR-021.) |
| `fly-female-baseline` | Same shape as `fly-female`, different palette. (FR-016.) |
| `fly-male` | Pixel sprite, 32 rows × 32 columns, same palette keys as `fly-female`. Drawn head-up. Shorter body, solid dark terminal abdomen band. (FR-013, FR-014, FR-021.) |
| `fly-male-baseline` | Same shape as `fly-male`, different palette. (FR-016.) |

A fly's `sex` (world config, open decision D4) selects which normal/baseline pair it uses.

## World config (version 3) — fields that change

| Path | Before (v2) | After (v3) |
|---|---|---|
| `version` | `2` | `3` |
| `edibles[].kind` | `flower` | `small`, `medium`, `large` |
| `edibles[].sprite` | (none) | required, food sprite |
| `scatter[].sprites` | includes food and removed sprites | no food, no removed sprites; yellow flowers allowed |
| `shore` rule `wild flowers` | `jungle-plant-016`, `jungle-plant-017`, `trees-plant-005` | yellow decor `trees-plant-001` to `003` |
| `flies.stimulus.objects` | `["flower"]` | `["small", "medium", "large"]` |
| `flies.stimulus.radius` | reach of every source | reach per tile of sprite size (6 in all worlds) |
| `flies.sprite`, `flies.baselineSprite` | 22 px sprites | 32 px sprites |
| `flies.sex` (new, BUG-002, open decision D4) | (none) | one entry per fly index, `"female"` or `"male"`; selects the `fly-female`/`fly-male` (and baseline) pair |

Other fields (`grid`, `ground`, `waterBodies`, `objects`, `groves`, `dangers`, `flies.body`, `flies.food`, `flies.brain`, `flies.experiment`) are unchanged.

## Validation rules (new or changed)

- ~~`edibles` has exactly three entries, one per kind.~~ `edibles` has one or more entries per kind, every kind
  present at least once. (FR-001, BUG-001.)
- Each `sprite` is a food sprite and the three sizes are strictly increasing: `sizeTiles(small) < sizeTiles(medium) < sizeTiles(large)`. (FR-002.)
- ~~No two food units are closer than `reach_i + reach_j`. (Plan R2: keeps each peak unique.)~~ Superseded by
  BUG-001: food units MAY sit closer than `reach_i + reach_j` so their odour overlaps and adds (FR-020); this was a
  placement choice for the original one-per-kind triple (research R2), not a validation rule, and does not hold
  once more than one instance per kind is placed on purpose.
- No food unit is on water or on a blocked cell (blocked = water or solid object), and no two food units — of the
  same or a different kind — share a cell. (FR-008.)
- `scatter` and the shore rules name no food sprite and no removed sprite. (FR-009, FR-019.)
- `version` is `3`. Any other version is refused by name.
