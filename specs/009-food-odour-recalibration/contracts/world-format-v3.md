# Contract: World Format Version 3 (changes from version 2)

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md) | **Base contract**: [specs/005-world-tileset-environment/contracts/world-format.md](../../005-world-tileset-environment/contracts/world-format.md)

This document lists only what changes. Everything else in the version 2 contract still applies.

## 1. Version

The file declares `"version": 3`. The app refuses any other version and names the version it found and the one it expects. There is no version 2 reader (plan D1).

## 2. `edibles`

```json
"edibles": [
  { "kind": "large", "sprite": "jungle-plant-015", "x": 10.5, "y": 20.5 },
  { "kind": "medium", "sprite": "jungle-plant-010", "x": 32.5, "y": 19.5 },
  { "kind": "small", "sprite": "red_flower_plant", "x": 21.5, "y": 3.5 },
  { "kind": "small", "sprite": "red_flower_plant", "x": 4.5, "y": 5.5 },
  { "kind": "medium", "sprite": "jungle-plant-010", "x": 42.5, "y": 7.5 }
]
```

- Allowed kinds: `small`, `medium`, `large`. `flower` is refused, with the message that names it as an unknown edible kind.
- `sprite` is required. It must be a food sprite for its kind (see table). The validator checks it is in the catalogue.
- ~~Exactly three entries, one per kind (spec FR-001).~~ One or more entries per kind, every kind present at least
  once (spec FR-001, BUG-001). Several entries of the same kind MAY be placed near each other so their odour reach
  overlaps and adds (FR-020) — this is how the shipped worlds reach the 60–70% odour-coverage target of FR-006.
- Each entry must be on land, outside every blocked cell, and not on another edible cell (FR-008) — this holds per
  entry, not per kind: two entries of the same kind MUST NOT share a cell either.
- Food positions are data. The app does not choose them.

| Kind | Sprite | Size in tiles |
|---|---|---|
| `small` | `red_flower_plant` | max(32, 23) / 32 = 1.00 |
| `medium` | `jungle-plant-010` | max(45, 30) / 32 = 1.41 |
| `large` | `jungle-plant-015` | max(59, 63) / 32 = 1.97 |

## 3. `scatter` and shore decor

- No `scatter` rule and no shore rule may name `red_flower_plant`, `jungle-plant-010`, `jungle-plant-015`, `jungle-plant-016`, `jungle-plant-017` or `jungle-bush-018`. The validator refuses any world that does (FR-009, FR-019).
- Yellow flowers (`trees-plant-001` to `003`) may appear as decor. They are not edible.

## 4. `flies.stimulus`

| Key | Version 2 | Version 3 |
|---|---|---|
| `objects` | `["flower"]` | `["small", "medium", "large"]`. Each must be a declared edible kind. |
| `radius` | reach of every source, in tiles | reach **per tile of sprite size**, in cells. A source's reach is `radius × size`. |
| `gain`, `max`, `resting`, `antennaOffset` | unchanged | unchanged |

The rule `reach = radius × size` is the same in every world. Size comes from the catalogue, not from the world (see [odour-reach.md](odour-reach.md)).

## 5. Map rules for every version 3 world

- Walkable cells are one connected region, or every walkable cell has a route to a food unit's odour (spec SC-003).
- ~~Between 30% and 70%~~ Between 30% and 40% of walkable cells have an odour value of zero, so odour covers 60% to
  70% of walkable cells (spec FR-006, BUG-001).

## 6. Shipped worlds

| File | Brain | Change |
|---|---|---|
| `public/world/world.json` | mock | version 3, food, decor, sprites |
| `public/world/world-forager.json` | v1 | version 3, food, decor, sprites |
| `public/world/world-connectome.json` | v0 | version 3, food, decor, sprites |
| `public/world/world-antennal-lobe.json` | v0 (antennal lobe) | version 3, food, decor, sprites |
| `public/world/world-forager-bad.json` | v1 fixture | version 3, so that it still fails on the snapshot version (its purpose). |
| `public/world/world.v1.json` | — | not loaded by the app; unchanged. |

## 7. Tests

- `tests/validate-v3.test.mjs` (new): refuses version 2, refuses `flower`, refuses a food sprite used as decor, refuses a removed sprite, accepts the shipped worlds, accepts more than one edible of the same kind (BUG-001).
- `public/tests/spread.test.js`: the flower rule is replaced by the food rules in section 5 (one or more entries per kind, every kind present, BUG-001); the danger rule is unchanged.
- `public/tests/banned-art.test.js`: the list of required sprites drops `jungle-bush-018` and `jungle-plant-016`; the stimulus check expects the three kinds.
