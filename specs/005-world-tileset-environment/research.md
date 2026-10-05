# Research: Detailed World Tileset and Diverse Environment

Each entry: Decision, Rationale, Alternatives considered. Status shows whether the item is
closed or still needs a visual check.

## R1 Shoreline: water → sand → grass

**Decision (BUG-002)**: The art pack's water spec (`zrpg-art/examples/WATER-SPEC.md`, reference
`water.js`) is adopted, with its grass shore style. The atlas has no water edge or corner tiles, so
every cell-based shore (sand rings, rock art, rotated plants) gave square, stepped edges. Water is a
blob mask; the signed distance to the waterline drives the shore band, the bank face, the shallows
and the decor. The water is static: one frame, no drift, one fixed foam phase. Supersedes the
BUG-001 decision below.

**Superseded decision (BUG-001)**: Sand is removed. The sand ring is not used and the shore is shore plant art only (`beach-plant-001` and `beach-plant-003`, turned away from the water, with `beach-plant-013` to `beach-plant-017` as decoration). The findings below are kept for history.

**Status**: Closed (BUG-002). Checked on the rendered default world against the WATER-SPEC §8 list, without the motion items. ~~Closed for the fit rule (measured and checked on the spike page, `public/tests/shore-fit.html`). The look of the full shoreline still needs a look on the page.~~

**Findings** (from `catalog.json` and the atlas image):

- `beach-terrain-001 sand_ring_tile` (96 × 96): a ring of sand with a transparent centre
  (about 41% fully opaque). The rim is ragged, so the outside fades into the ground.
- `beach-terrain-002 sand_ring_small` (56 × 56): measured in the alpha channel, it has no usable
  hole. Its centre is solid, and it reads as a diamond blob on the spike page. **Not used as a ring.**
- `beach-terrain-010 sand_pit_square`, `beach-terrain-011 gravel_pit`: sand edges around a pit
  (about 54% opaque). Candidates for square-ish basins.
- `beach-terrain-005 sand_tile_hole` (64 × 64, 92% opaque): a sand tile with a small hole.
- `water-water-001`: opaque 320 × 128 water texture. Used as the static water fill.

**Decision**: Only `beach-terrain-001` is a ring. Its centred hole is about 50 px across (measured from
the atlas alpha), so it is drawn at 2× (integer, pixel-perfect) and the hole is about 100 px, or 3.1 cells.
A basin uses the ring when its outline is round (the short side is at least 80% of the long side)
and it is 2 to 3 cells across, so it sits inside the hole with a margin. Every other basin gets
pebble art (`beach-rock-001` to `beach-rock-003`) along its border. At 1× the ring reads as a square
block on the spike page, so 1× is not used. `ring56` is removed from the options.

**Rationale**: The sand ring is the only atlas piece that places sand between water and grass
around a round basin. Measured, not guessed: the hole size decides which basins fit. Clipping the water to the hole avoids a water rectangle showing outside the ring.

**Alternatives considered**:

- *Only rock and pebble art on the border*: rejected by the user.
- *Build a full autotile water/sand/grass set*: not possible from the atlas, which has no
  matching edge set. It would require hand-authored art, which `OBJECTS.md` forbids in the
  atlas folder.
- *Generate sand borders at runtime from a mask*: more code and a new look that does not come
  from the atlas.

**Open risk**: A ring has one fixed hole size. Irregular basins will mix ring pieces and the
fallback. A visual check decides whether the border looks natural enough. If not, the
fallback becomes the main style for those basins.

## R2 Edible objects: fruit, flowers, honey

**Decision (BUG-001)**: Honey is removed. The only edible kind is `flower`. The findings below are kept for history.

**Status**: Closed. Fruit has no pickup sprite in the atlas (checked 2026-10-04: no name or
description in `catalog.json` marks a fruit pickup; `prickly_pear` and `orange_carnivorous_pod` are
plants, and the palms are trees). Honey and flowers are the edible kinds.

**Findings**:

- Honey: `jungle-prop-001 bee_hive` (20 × 25, hanging hive). Used as the honey pickup.
- Flowers: `trees-plant-001 yellow_flower_single` (9 × 9), `trees-plant-002 yellow_flowers_trio`,
  `trees-plant-003 yellow_flowers_cluster`, `trees-plant-005 red_flower_plant`,
  `jungle-plant-016 blue_flower`, `jungle-plant-017 white_flower_sprout`.
- Fruit: palm trees carry fruit (`trees-tree-*` palms, `jungle-*` palms with yellow fruit), but
  these are trees and cannot be picked up as ground objects. No small fruit sprite was found yet.

**Decision**: Edible kinds for the flies are `honey` (bee hive) and `flower` (yellow and red
flowers). Fruit is not a kind: no pickup sprite exists in the atlas. The fly stimulus uses `flower`
only (BUG-001).

**Rationale**: The user asked for fruits, flowers, and honey as edibles. Honey and flowers have
clear art. Fruit art is not confirmed.

**Alternatives considered**: Use palm trees with fruit as fruit sources. Rejected because the
fly would need to reach a tree trunk cell, which changes the stimulus geometry.

## R3 Danger objects

**Status**: Closed for the mapping. The sprites are on the page; the look in the full world is still
open for a human eye.

**Findings**:

- `jungle-prop-002 campfire_logs` (52 × 24): stacked logs, the fire source. Rejected as a danger by BUG-003.
- `jungle-prop-005 skull_spear_banner` (40 × 63): a tribal skull on a spear with a red banner.
- `jungle-prop-006 oil_lantern_post` (17 × 59): a lit lantern on a post.
- No dedicated spider sprite was found in the atlas.

**Decision**: ~~Fire → `campfire_logs`.~~ Fire is dropped (BUG-003): the user rejected `campfire_logs` as a danger, and the catalogue has no other fire, torch or flame sprite. Spider stand-in → `skull_spear_banner`. Oil lantern is
added as a third danger kind, `lantern`, placed as a post.

**Rationale**: The user named these three as the danger art. Fire and lantern are visually
clear, and the skull marks a hostile spot.

**Alternatives considered**: Keep the old spider art. Rejected because the user asked to
adopt the new dataset.

## R4 Logic grid cell size

**Status**: Closed.

**Decision**: 32 px per logic cell. The default world is 48 × 32 cells.

**Rationale**: The 32 px ground tiles (`trees-terrain-001` and related) fit one cell exactly.
A 16 px grid would split each ground tile into four cells for no gain, and it would double the
size of the logic data.

**Alternatives considered**: 16 px cells (matches the old world). Rejected because the
ground art is 32 px and the fly needs no finer grid.

## R5 Zoom

**Status**: Closed.

**Decision**: Integer zoom steps only (1, 2, 3, 4). Smoothing is off. Each art pixel becomes
a whole number of device pixels.

**Rationale**: At a fractional zoom, art pixels are uneven and seams can appear, which breaks
FR-002 and FR-003. The spec's open question about integer-only zoom (001 SC-010) is answered
here.

**Alternatives considered**: Fractional zoom with smoothing off. Rejected because pixel sizes
would be uneven.

## R6 Static map baking

**Status**: Closed.

**Decision**: Compose the whole scene once into an offscreen canvas at native resolution
(1536 × 1024 px for the default world). Each frame draws that bitmap, then the flies.

**Rationale**: The map is static (user request), so there is no reason to redraw about 3000
cells and 400 objects each frame.

**Alternatives considered**: Per-frame drawing of visible cells only (the current renderer).
Rejected because the scene layer would be recomputed for no change.

## Implementation decisions (made while building the tasks)

- **Fly art stays in pixel form.** The atlas has no fly. The two fly sprites (`fly`, `fly-baseline`)
  stay in the `sprites` section of `world.json`, as contract 002 says.
- **Scatter bushes block, other scatter does not.** Scatter takes its solidity from the sprite class:
  `bush` blocks its cell, `plant` does not.
- **Ground.** Base tiles are chosen per cell from a hash of the seed, so the same seed gives the same
  map. Patches are drawn over the base at native size.
- **Scale.** Scene art is native size. Trees from the atlas are large next to a 32 px cell (the big
  oak covers about 10 cells), so the default world uses a mix of sizes and keeps the large oak to one.
- **Node runner.** `node --test public/tests/` is not accepted by Node 25, which takes file
  patterns. The command is `node --test public/tests/*.test.js`.
