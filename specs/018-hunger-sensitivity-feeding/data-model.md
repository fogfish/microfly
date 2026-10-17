# Data Model: Hunger-Sensitive Feeding and Food Depletion

Extends the existing runtime model in `public/js/fly/{energy,food}.js`. Nothing here is a new persisted format —
all of it is in-memory world-instance state, rebuilt fresh on every load, declared from world-config JSON.

## Fly (existing entity, no new fields)

Reuses `fly.energy` (number, `[0, 1]`) and the existing `hungerOf(energy) = 1 - energy` (`energy.js`, unchanged).
This feature reads these; it does not add fields to the fly's own state. "Hungry" for this feature's purposes is
`hungerOf(fly.energy) >= flies.food.hungerSensitivity.threshold` — computed where it's needed, not cached.

## Food Resource (extends the per-cell state owned by `createFood`)

| Field | Type | Notes |
|---|---|---|
| `kind` | `"small" \| "medium" \| "large"` | Already present per stimulus cell (`fly-world.js` `stimulusCells`), unchanged by this feature. The capacity model reads it; does not write it. |
| `capacity` | integer ≥ 1 | Derived once per cell from `flies.food.capacity[kind]` at world load. Only present for cells in a world that declares `flies.food.capacity`. |
| `remainingUnits` | number, `[0, capacity]` | Starts at `capacity`. Drained continuously by `consumeRate × dt` on every eating tick, as the legacy stock is (spec 018 amendment: continuous drain, not a charge per completed bout). Floor 0 — never negative. Does not regrow while partly eaten. |
| `recoveryLeft` | seconds or `null` | Set when `remainingUnits` reaches 0 to `flies.food.recovery`; `regrow(seconds)` counts it down, and at ≤ 0 the resource returns to `capacity`. `null` while not recovering. |
| *(existing)* `stock`, `full` | number | Kept, unchanged, for every cell in a world that does **not** declare `flies.food.capacity` — the pre-existing continuous model. The two models are mutually exclusive per world (selected once, at load, by whether `flies.food.capacity` is set), never mixed on the same cell. |

**Derived**: `fraction(cx, cy)` — for a capacity-model cell, `remainingUnits / capacity`; for a legacy cell,
`stock / full` (unchanged). Both ranges are `[0, 1]`, so every existing reader (`food-field.js`'s odor field,
`senseForagerFly*`'s taste input) keeps working without caring which model produced the number.

**State transitions** (capacity model only):

```text
remainingUnits = capacity           (initial, and after recovery)
        │
        │  a feeding bout on this cell closes with endedBy ('sated' | 'empty')
        ▼
remainingUnits -= 1   (floor 0)
        │
        ├─ remainingUnits > 0  → resource stays feedable, odor/taste proportionally weaker
        │
        └─ remainingUnits == 0 → recoveryLeft = flies.food.recovery
                                       │
                                       │  elapsed time ≥ flies.food.recovery
                                       ▼
                                 remainingUnits = capacity; recoveryLeft = null
```

A fly that reaches a cell with `remainingUnits == 0` senses zero taste/odor contribution from it (same as an
`'empty'` legacy cell today) and cannot start a feeding bout there (`flowerAt`/`canEat`-style gates see it as
empty) until it has recovered.

## Feeding Event (not a new persisted object — the existing `bout`, unchanged)

No new type. The `fly.bout` / `startBout` / `updateBout` / `closeBout` lifecycle in `energy.js` is unchanged, and so is
its use in the motor-control call sites. Eating depletes the flower on every eating tick (see the state transitions
above), not when the bout closes.

## World Configuration additions (`flies.food`, all optional)

| Key | Type | Default | Meaning |
|---|---|---|---|
| `hungerSensitivity.threshold` | number, `[0, 1)` | — (absent = feature off) | Hunger value at/above which the odor-sensitivity filter applies. |
| `hungerSensitivity.gain` | number, ≥ 1 | — (required if `hungerSensitivity` is set) | Multiplier applied to food-odor sensed inputs once hungry. |
| `feedMotion` | `"pause" \| "slow"` | `"pause"` | Whether a feeding fly stays in place or moves at reduced speed. |
| `feedSlowSpeed` | number, ≥ 0 | — (required if `feedMotion: "slow"`) | Tiles/second while feeding in `"slow"` mode. |
| `capacity.small` / `.medium` / `.large` | integer ≥ 1 | — (absent = legacy continuous model) | Units of food a resource of that kind holds before it is empty. |
| `recovery` | number (seconds), ≥ 0 | 30 (only meaningful when `capacity` is set) | Delay before a depleted resource returns to full capacity. |

Validation rules (enforced by `public/js/world/validate.js`, mirroring the existing `validateFlyFood`/
`validateModulatorsHunger` style):

- `hungerSensitivity`, if present, MUST be an object with both `threshold` (`[0, 1)`) and `gain` (≥ 1); either
  key missing or out of range is a named error (`flies.food.hungerSensitivity.threshold must be a number from 0
  to less than 1`, and the equivalent for `gain`).
- `feedMotion`, if present, MUST be `"pause"` or `"slow"`; `"slow"` without `feedSlowSpeed` is a named error.
- `capacity`, if present, MUST be an object whose keys are exactly `small`, `medium`, `large`, each a positive
  integer; a missing size or an extra/unknown key is a named error (matches the spec's edge case: an undeclared
  size is a configuration error, not a silent default).
- `recovery`, if present without `capacity`, is a named error (recovery has no meaning for the legacy continuous
  model).
