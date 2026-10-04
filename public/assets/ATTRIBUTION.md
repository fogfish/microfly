# Attribution

| Asset | Source URL | Author | Licence | Used by |
|-------|-----------|--------|---------|---------|
| Roguelike/RPG 16×16 pack, sheet `terrain/roguelike-16.png` (968×526, 16 px tiles, 1 px gap) | https://kenney.nl/assets/roguelike-rpg-pack | Kenney Vleugels (kenney.nl) | CC0 1.0 (public domain). Copy of the licence text in `terrain/KENNEY-LICENSE.txt` | `grass`, `water`, `rock`, `rock-*` edges, `tree`, `bush`, `rock-small` in `world/world.json` |
| Project-authored sprites: `apple`, `cherry`, `honey`, `fire`, `spider` | This repository | Dmitry Kolesnik | Project-authored, same licence as the repository | `world/world.json` (`pixels` form, inline) |

## Tile coordinates

Tile (column, row) in the sheet maps to pixels `x = 17 × column`, `y = 17 × row`, with each tile 16×16. The sheet has no outer margin (57 × 16 + 56 = 968, 31 × 16 + 30 = 526).

| Sprite id | Tile (col, row) | Sheet rectangle `x, y, w, h` | Role |
|-----------|-----------------|------------------------------|------|
| `grass` | (3, 16) | 51, 272, 16, 16 | Opaque grass base (centre of the grass blob) |
| `water` | (1, 3) | 17, 51, 16, 16 | Water fill. Single opaque tile, no shore (see Known limitations) |
| `rock` | (8, 16) | 136, 272, 16, 16 | Opaque rock fill, group `rock` |
| `rock-n` | (8, 15) | 136, 255, 16, 16 | Rock edge, open north |
| `rock-e` | (9, 16) | 153, 272, 16, 16 | Rock edge, open east |
| `rock-s` | (8, 17) | 136, 289, 16, 16 | Rock edge, open south |
| `rock-w` | (7, 16) | 119, 272, 16, 16 | Rock edge, open west |
| `rock-ne` | (9, 15) | 153, 255, 16, 16 | Rock corner, open north and east |
| `rock-nw` | (7, 15) | 119, 255, 16, 16 | Rock corner, open north and west |
| `rock-se` | (9, 17) | 153, 289, 16, 16 | Rock corner, open south and east |
| `rock-sw` | (7, 17) | 119, 289, 16, 16 | Rock corner, open south and west |
| `rock-ns` | (9, 14) | 153, 238, 16, 16 | Rock strip, open north and south |
| `rock-ew` | (9, 13) | 153, 221, 16, 16 | Rock strip, open east and west |
| `rock-all` | (8, 12) | 136, 204, 16, 16 | Isolated rock, open on all sides |
| `tree` | (13, 11) | 221, 187, 16, 16 | Round green tree with trunk (object) |
| `bush` | (13, 9) | 221, 153, 16, 16 | Round green bush with stem (object) |
| `rock-small` | (55, 22) | 935, 374, 16, 16 | Small grey stone on grass (object) |

## Tile group: rock (`groups.rock`)

Source: `roguelike-16.png`, the 3 × 3 rounded rock set at columns 7–9, rows 13–17, plus the fill at (8, 16). "Open" means the sprite is transparent on that side, so the base terrain shows through there.

The group is drawn as an overlay on the opaque grass base. Each rock cell's edge tile is picked from its four neighbours (`public/js/world/autotile.js`):

| Open sides | Edge tile |
|------------|-----------|
| none | `rock` (fill) |
| N, E, S, W | `rock-n`, `rock-e`, `rock-s`, `rock-w` |
| NE, NW, SE, SW | `rock-ne`, `rock-nw`, `rock-se`, `rock-sw` |
| N+S, E+W | `rock-ns`, `rock-ew` |
| all four | `rock-all` |
| N+E+S, N+E+W, N+S+W, E+S+W | fallback to the nearest supported tile with fewer open sides: N+E+S → `rock-ns`; N+E+W → `rock-ew`; N+S+W → `rock-nw`; E+S+W → `rock-ew` |

The three-open cases have no tile of their own in the sheet. The fallback keeps the transparent sides a subset of the real open sides, so transparency never faces the rock group itself.

Edge classes measured per tile (transparent sides, from the sheet's alpha channel): `rock-n` N; `rock-e` E; `rock-s` S; `rock-w` W; `rock-ne` N+E; `rock-nw` N+W; `rock-se` S+E; `rock-sw` S+W; `rock-ns` N+S; `rock-ew` E+W; `rock-all` all four. `rock` (fill) has no transparent side.

## Known limitations

- **Water has no shore.** The sheet's pond ring (sand border) could not be mapped with confidence to the water group, so water is a square opaque fill on grass. This is the next step if the shore is needed.
- **Grass is the base only.** The grass blob at columns 2–4, rows 15–17 has a complete 3 × 3 edge set, but it is not used, because grass is drawn as the base beneath every group overlay.
- **Three-open rock cases** use the fallback above and may show a one-side rock extension at those junctions.
