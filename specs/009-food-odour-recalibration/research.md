# Research: Food Odour Recalibration

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1. Size of a food unit

- **Decision**: size = the longer side of the sprite's atlas rectangle, in tiles: `size = max(w, h) / CELL_PX`, with `CELL_PX = 32`.
- **Rationale**: the atlas gives `w` and `h` for each sprite (`public/assets/atlas/catalog.json`). The longer side is what a visitor sees as "bigger", and it is one number per sprite.
- **Values** (from the catalogue):

| Kind | Sprite | w × h (px) | size (tiles) |
|---|---|---|---|
| small | `red_flower_plant` (`trees-plant-005`) | 32 × 23 | 1.00 |
| medium | `jungle-plant-010` | 45 × 30 | 1.41 |
| large | `jungle-plant-015` | 59 × 63 | 1.97 |

- **Alternatives**: area (w × h) — rejected, because the ratio would be 1 : 2.0 : 3.8 and visually overstates the large unit. A hand-written size per kind — rejected, because it would duplicate the atlas and drift from it.

## R2. Reach and placement

- **Decision**: `reach = radius × size`, with `radius = 6` cells per tile of size. Reaches are 6.0, 8.44 and 11.81 cells. Placement (cell indices, centre = index + 0.5 in config):

| Kind | x | y |
|---|---|---|
| large | 10.5 | 20.5 |
| medium | 32.5 | 19.5 |
| small | 21.5 | 3.5 |

- **How it was found**: `scripts/food-placement.mjs` (`scripts/food-placement.mjs`, see Source Code). It loads the map with the app's own `indexCatalog` and `buildLogic`, takes the walkable cells, and tries 40 000 seeded random triples of walkable cells. It keeps a triple only when: (a) no two reaches overlap (so the cap at 1 never flattens a peak and each unit is the unique maximum), (b) no walkable cell is cut off from every odour region, and (c) the odour-free share of walkable cells is within 30–70%. Among the 6 632 that pass, it keeps the one closest to 50%.
- **Result for the chosen triple**: odour-free share 49.8% of walkable cells; walkable cells 1 395 of 1 536; walkable region is one connected component, and 0 walkable cells are without a route to odour.
- **Why 6**: radius 6 gives a feasible range. Coverage constraints (30–70%) hold for a large reach between about 9 and 17 cells, so 6 per tile (large = 11.8) sits in the middle. The number was chosen from the geometry (coverage), not from fly behaviour.
- **Why fixed coordinates, not a random seed at load**: the map is data (constitution IV, reproducibility), and the spec's rules are checked by tests on the fixed coordinates.
- **Alternatives**: several placements per size — rejected, because spec Assumption "only three" means one per size. Placing by the scatter rule — rejected, because food must be checkable.

## R3. Where the odour comes from (stock and reach)

- **Decision**: a unit's odour value at a point is `falloff(d, reach) × fraction`, where `fraction` is the unit's stock over full stock. The bilateral sensing already does this (`senseBilateral`, `food.js points()`). The odour layer uses the same falloff with `fraction = 1`, as now (`odourField`, parity test).
- **Rationale**: the spec's odour rule says a fly senses what the odour layer shows. Existing code already has this split. Per-source reach is the only new input.
- **Alternatives**: a global fraction-free field — rejected, because it would break the eaten-out rule in the spec (edge cases).

## R4. Odour from reach, not one radius

- **Decision**: `falloff(d, p.reach ?? radius)` in `fruitIntensity`, `senseBilateral` and `odourField`. Points without a `reach` keep the global `radius`. No world file without reach remains in the repo after this change, so the fallback is for tests and unit fixtures only.
- **Rationale**: smallest change that keeps the falloff formula and the sum-then-cap rule. The parity test (`contracts/odour-reach.md`) holds.
- **Alternatives**: a second odour code path for the layer — rejected (duplication, and parity could drift).

## R5. World format version

- **Decision**: world format version 2 → 3. The app accepts version 3 only. Version 2 is no longer read.
- **Rationale**: the edible vocabulary changes (`flower` removed; `small`, `medium`, `large` added) and an edible entry gains a required `sprite`. A version 2 file cannot be read as version 3. Keeping a version 2 reader would need `flower`, which FR-018 forbids. All version 2 worlds are in this repo and are migrated in the same change.
- **Alternatives**: stay at version 2 and accept the new shape — rejected, because a silent shape change under the same version breaks old worlds without a clear error. Keep a version 2 reader — rejected, see above. **Open decision D1.**

## R6. Scatter and shore decor

- **Decision**: food sprites (`trees-plant-005`, `jungle-plant-010`, `jungle-plant-015`) leave every scatter list and the shore rule. The three yellow flower sprites (`trees-plant-001` to `003`) are added to the `meadow-flowers` scatter as decor, and the shore `wild flowers` rule uses them. `jungle-plant-016`, `jungle-plant-017` and `jungle-bush-018` are removed everywhere.
- **Rationale**: the spec's decor rule (FR-010) says yellow flowers are decor, and FR-019 keeps food art off decor. Scatter draws from one list per rule, so removing sprites changes placements; the scatter seed and clearings are kept so the rest of the layout is stable.
- **Alternatives**: keep food sprites in scatter but mark them non-edible — rejected, because a plant that looks like food but does not smell confuses the visitor (the reason for D3).

## R7. Fly sprite

- **Decision**: `fly` and `fly-baseline` become 32 × 32 pixel grids (32 rows of 32 characters), palette-based, like the current sprites (`contracts/fly-sprite.md`). The baseline has the same shape and a different palette. The renderer is not changed. The fly is drawn head-up (no rotation).
- **Rationale**: the pixel form already exists (`public/js/render/sprites.js`, 1 px per cell at native size). One cell is 32 px, so the fly fills one cell. Rotation is not in the renderer and is out of scope (D2).
- **Alternatives**: a PNG atlas sprite — rejected, because the world already uses pixel sprites for the fly and the atlas has no fruit fly. Rotating the fly — rejected for this feature (D2).

## R8. Behaviour verification (not tuning)

- **Decision**: after the change, run `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out` and record the result in `specs/009-food-odour-recalibration/results.md`. Also run the calibration seeds (`experiment.seeds`) for the record. No value is changed to pass a metric. If the brain fails, the failure is recorded as a finding (AGENTS.md "Behaviour failures are findings").
- **Rationale**: the placement and reach were chosen from geometry (R2), not from behaviour, so no tuning step is needed or allowed on held-out seeds.
- **Alternatives**: recalibrate `radius` on calibration seeds if the brain fails — allowed only as a separate, recorded calibration step.
