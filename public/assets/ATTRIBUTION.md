# Attribution

## Atlas (feature 005): `public/assets/atlas/`

| Asset                                                                                                   | Source URL                                                                           | Author       | Licence                                              | Used by                                               |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| Sprite atlas `atlas-0.png` (2048 × 1822) with `catalog.json` and `OBJECTS.md`, cut from the ZRPG sheets | **Not recorded in this repository.** The atlas folder has no licence or source file. | Not recorded | **To be confirmed by the author before publishing.** | Every sprite below, through `public/world/world.json` |

The world uses these sprites (ids from `catalog.json`; listed from `public/js/world/` and
`public/world/world.json`):

| Sprite id            | Name                     | Role                 |
| -------------------- | ------------------------ | -------------------- |
| `beach-plant-002`    | tall_grass_narrow        | reed bed (cut)       |
| `beach-plant-003`    | tall_grass_block         | reed bed (cut)       |
| `beach-plant-004`    | grass_sprig_a            | shore decor          |
| `beach-plant-005`    | grass_sprig_b            | shore decor          |
| `beach-plant-006`    | grass_sprig_c            | shore decor          |
| `beach-plant-007`    | grass_sprig_d            | shore decor          |
| `beach-plant-008`    | grass_sprig_e            | shore decor          |
| `beach-plant-010`    | grass_sprig_g            | shore decor          |
| `beach-plant-011`    | grass_sprig_h            | shore decor          |
| `beach-plant-012`    | grass_sprig_i            | shore decor          |
| `beach-plant-015`    | grass_tuft_tall          | shore decor          |
| `beach-terrain-007`  | gravel_tile_hole         | bank face            |
| `beach-terrain-011`  | gravel_pit               | ground patch         |
| `beach-tree-008`     | leafy_tree               | object, grove tree   |
| `jungle-bush-008`    | fern_low                 | scatter, shore decor |
| `jungle-bush-018`    | leaf_shrub_red_flower    | scatter              |
| `jungle-plant-010`   | orange_carnivorous_pod   | scatter              |
| `jungle-plant-011`   | grass_blades             | shore decor          |
| `jungle-plant-015`   | glowing_blue_bulb_plant  | scatter              |
| `jungle-plant-016`   | blue_flower              | scatter, shore decor |
| `jungle-plant-017`   | white_flower_sprout      | scatter, shore decor |
| `jungle-prop-005`    | skull_spear_banner       | danger               |
| `jungle-prop-006`    | oil_lantern_post         | danger               |
| `jungle-prop-007`    | hollow_log_mossy         | shore decor          |
| `rocks2-rock-011`    | low_rock_c               | shore decor          |
| `rocks2-rock-013`    | pebble_a                 | shore decor          |
| `rocks2-rock-035`    | outcrop_medium_grass     | object               |
| `rocks2-terrain-009` | cobble_ground_grass_edge | ground patch         |
| `rocks2-terrain-020` | grass_tile_dark          | shore band           |
| `trees-bush-001`     | broadleaf_bush           | scatter              |
| `trees-bush-002`     | yellow_green_bush        | scatter              |
| `trees-plant-001`    | yellow_flower_single     | edible               |
| `trees-plant-002`    | yellow_flowers_trio      | edible               |
| `trees-plant-003`    | yellow_flowers_cluster   | edible               |
| `trees-plant-005`    | red_flower_plant         | scatter, shore decor |
| `trees-plant-006`    | grass_tuft_a             | shore decor          |
| `trees-plant-007`    | grass_tuft_b             | shore decor          |
| `trees-plant-008`    | fern_small               | scatter, shore decor |
| `trees-plant-010`    | spiky_plant_a            | scatter              |
| `trees-terrain-001`  | grass_tile_a             | ground tile          |
| `trees-terrain-002`  | dark_grass_patch_a       | ground patch         |
| `trees-terrain-004`  | grass_tile_b             | ground tile          |
| `trees-terrain-005`  | grass_tile_c             | ground tile          |
| `trees-terrain-007`  | grass_tile_e             | ground tile          |
| `trees-terrain-010`  | light_meadow_patch_a     | ground patch         |
| `trees-terrain-012`  | light_meadow_patch_b     | ground patch         |
| `trees-tree-001`     | oak_large_a              | object               |
| `trees-tree-002`     | oak_medium_a             | object               |
| `trees-tree-005`     | round_tree_small         | object, grove tree   |
| `trees-tree-006`     | round_tree_tiny          | object, grove tree   |
| `water-water-001`    | water_frame_01           | water (static frame) |

The water and shore pipeline (`public/js/world/water.js`, `shore.js` and the water part of
`compose.js`) is ported from the ZRPG art pack's reference renderer `examples/water.js` and follows
its `examples/WATER-SPEC.md` (grass shore style). It is used without the water animation.

## Roguelike sheet (feature 001, no longer used by the world)

The 16 px roguelike sheet below was the world art until feature 005. `public/world/world.json` no
longer names it. The entries are kept as the record of where the old art came from.

| Asset                                                                                       | Source URL                                  | Author                      | Licence                                                                           | Used by                                                                                      |
| ------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Roguelike/RPG 16×16 pack, sheet `terrain/roguelike-16.png` (968×526, 16 px tiles, 1 px gap) | https://kenney.nl/assets/roguelike-rpg-pack | Kenney Vleugels (kenney.nl) | CC0 1.0 (public domain). Copy of the licence text in `terrain/KENNEY-LICENSE.txt` | `grass`, `water`, `rock`, `rock-*` edges, `tree`, `bush`, `rock-small` in `world/world.json` |
| Project-authored sprites: `apple`, `cherry`, `honey`, `fire`, `spider`                      | This repository                             | Dmitry Kolesnik             | Project-authored, same licence as the repository                                  | `world/world.json` (`pixels` form, inline)                                                   |

## Tile coordinates

Tile (column, row) in the sheet maps to pixels `x = 17 × column`, `y = 17 × row`, with each tile 16×16. The sheet has no outer margin (57 × 16 + 56 = 968, 31 × 16 + 30 = 526).

| Sprite id    | Tile (col, row) | Sheet rectangle `x, y, w, h` | Role                                                             |
| ------------ | --------------- | ---------------------------- | ---------------------------------------------------------------- |
| `grass`      | (3, 16)         | 51, 272, 16, 16              | Opaque grass base (centre of the grass blob)                     |
| `water`      | (1, 3)          | 17, 51, 16, 16               | Water fill. Single opaque tile, no shore (see Known limitations) |
| `rock`       | (8, 16)         | 136, 272, 16, 16             | Opaque rock fill, group `rock`                                   |
| `rock-n`     | (8, 15)         | 136, 255, 16, 16             | Rock edge, open north                                            |
| `rock-e`     | (9, 16)         | 153, 272, 16, 16             | Rock edge, open east                                             |
| `rock-s`     | (8, 17)         | 136, 289, 16, 16             | Rock edge, open south                                            |
| `rock-w`     | (7, 16)         | 119, 272, 16, 16             | Rock edge, open west                                             |
| `rock-ne`    | (9, 15)         | 153, 255, 16, 16             | Rock corner, open north and east                                 |
| `rock-nw`    | (7, 15)         | 119, 255, 16, 16             | Rock corner, open north and west                                 |
| `rock-se`    | (9, 17)         | 153, 289, 16, 16             | Rock corner, open south and east                                 |
| `rock-sw`    | (7, 17)         | 119, 289, 16, 16             | Rock corner, open south and west                                 |
| `rock-ns`    | (9, 14)         | 153, 238, 16, 16             | Rock strip, open north and south                                 |
| `rock-ew`    | (9, 13)         | 153, 221, 16, 16             | Rock strip, open east and west                                   |
| `rock-all`   | (8, 12)         | 136, 204, 16, 16             | Isolated rock, open on all sides                                 |
| `tree`       | (13, 11)        | 221, 187, 16, 16             | Round green tree with trunk (object)                             |
| `bush`       | (13, 9)         | 221, 153, 16, 16             | Round green bush with stem (object)                              |
| `rock-small` | (55, 22)        | 935, 374, 16, 16             | Small grey stone on grass (object)                               |

## Tile group: rock (`groups.rock`)

Source: `roguelike-16.png`, the 3 × 3 rounded rock set at columns 7–9, rows 13–17, plus the fill at (8, 16). "Open" means the sprite is transparent on that side, so the base terrain shows through there.

The group is drawn as an overlay on the opaque grass base. Each rock cell's edge tile is picked from its four neighbours (`public/js/world/autotile.js`):

| Open sides                 | Edge tile                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| none                       | `rock` (fill)                                                                                                                            |
| N, E, S, W                 | `rock-n`, `rock-e`, `rock-s`, `rock-w`                                                                                                   |
| NE, NW, SE, SW             | `rock-ne`, `rock-nw`, `rock-se`, `rock-sw`                                                                                               |
| N+S, E+W                   | `rock-ns`, `rock-ew`                                                                                                                     |
| all four                   | `rock-all`                                                                                                                               |
| N+E+S, N+E+W, N+S+W, E+S+W | fallback to the nearest supported tile with fewer open sides: N+E+S → `rock-ns`; N+E+W → `rock-ew`; N+S+W → `rock-nw`; E+S+W → `rock-ew` |

The three-open cases have no tile of their own in the sheet. The fallback keeps the transparent sides a subset of the real open sides, so transparency never faces the rock group itself.

Edge classes measured per tile (transparent sides, from the sheet's alpha channel): `rock-n` N; `rock-e` E; `rock-s` S; `rock-w` W; `rock-ne` N+E; `rock-nw` N+W; `rock-se` S+E; `rock-sw` S+W; `rock-ns` N+S; `rock-ew` E+W; `rock-all` all four. `rock` (fill) has no transparent side.

## Known limitations

- **Water has no shore.** The sheet's pond ring (sand border) could not be mapped with confidence to the water group, so water is a square opaque fill on grass. This is the next step if the shore is needed.
- **Grass is the base only.** The grass blob at columns 2–4, rows 15–17 has a complete 3 × 3 edge set, but it is not used, because grass is drawn as the base beneath every group overlay.
- **Three-open rock cases** use the fallback above and may show a one-side rock extension at those junctions.
