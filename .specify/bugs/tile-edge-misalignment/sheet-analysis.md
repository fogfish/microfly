# Analysis: `public/assets/terrain/roguelike-16.png`

Kenney Roguelike/RPG pack, sheet 968 × 526 px. Tiles are 16 × 16 with a 1 px gap, so tile (col, row) starts at (17·col, 17·row). The grid is 57 × 31 tiles. The arithmetic checks out: 57·16 + 56 = 968 and 31·16 + 30 = 526, with no outer margin.

## 1. Tile groups (autotile sets)

The sheet is not a bag of independent tiles. Tiles are drawn as sets for one material, meant to be placed next to each other. Each edge tile has transparent corners or a dark outline that is only correct when its neighbour is in the same set. Confidence is from visual inspection of zoomed crops, plus the sample maps (see section 3).

| Group | Tiles (col, row) | Shape | Confidence |
|-------|------------------|-------|------------|
| Grass, plain | cols 0–1, rows 15–17 | 2 × 3 block of flat grass; corner notches on (0,16) and (1,16) | high |
| Grass, rounded | cols 2–4, rows 15–17 | 3 × 3 rounded green blob with transparent corners (an edge set) | high |
| Rock A | cols 5–6, rows 13–17 | 2-column rock block; left and bottom edges are outlined | high |
| Rock B | cols 7–9, rows 13–17 | Rounded rock blob with transparent corners | high |
| Water pond | cols 0–4, rows 0–4 | Pond: water interior with a sand ring on cols 2–4, rows 0–3 | high |
| Dirt / path | cols 5–9, rows 12 | Brown dirt edges | medium |
| Orange ground | cols 0–4, rows 18 | Orange ground (not used) | medium |

The exact 3 × 3 roles inside each block (which tile is the north edge, which is the corner, and so on) are not yet mapped. That mapping is needed to pick edges by neighbour. Section 4 lists what is still unknown.

## 2. Measured edges of the tiles the world uses

Opacity is the share of the edge pixels that are non-transparent. Outline is the mean brightness of the edge pixels minus the interior mean. A large negative outline means a dark border.

| Sprite (tile) | N | S | W | E | Outline (N/S/W/E) | Assessment |
|---------------|---|---|---|---|-------------------|------------|
| `grass` (0,15) | 100% | 88% | 100% | 88% | 0 / −3 / 0 / −3 | Small transparent notches on the S and E edges |
| `rock` (6,14) | 75% | **0%** | 88% | 75% | −3 / n/a / −2 / −3 | **Bottom row fully transparent; dark outline on N, W, E.** Edge tile of Rock A, used as an interior tile |
| `water` (1,3) | 100% | 100% | 100% | 100% | −5 / 0 / +6 / −5 | Dark outline on N and E, light edge on W. Repeats as lines |
| `water` (0,0) | 100% | 100% | 100% | 100% | 0 / 0 / 0 / 0 | **Clean interior tile, no outline.** Better water choice |
| `tree` (13,11) | 100% | 38% | 38% | 38% | −2 / +13 / −16 / −16 | Transparent by design; fine as an object |
| `bush` (13,9) | 0% | 38% | 38% | 38% | n/a / +13 / −16 / −16 | Transparent by design; fine as an object |
| `rock-small` (55,22) | 0% | 0% | 0% | 0% | n/a | Stone sits in the middle of a grass tile. Opaque background only in the centre |

## 3. Adjacency in Kenney's sample map

`Map/sample_map.tmx`, layer "Ground/terrain" (100 × 100 tiles, gid = index + 1, firstgid 1). The map is decoded from base64 + zlib. Its 14 distinct ground tiles are dominated by the plain grass (5,1), which covers 9 858 of 10 000 cells. The border tiles are placed in pairs with transition tiles:

- (5,0) is always next to (5,1). (3,1) is next to (4,1), (3,0), (3,2), (1,2) and (2,1). This shows that transition and edge tiles are only ever used next to their own set.
- Only tiles from the same set are placed next to each other. Mixing sets, for example rock next to water, never happens in the sample. This matches the rule "a tile from a group needs surrounding tiles from the same group".

Note: the sample uses grass and water/sand tiles at the top-left, which are different from the tile numbers in our config. The gids were checked against the sheet visually, not assumed.

## 4. What is still unknown

- The exact 3 × 3 role of each tile in the rock and grass blocks. I need the mapping to choose an edge by neighbour. The sample map gives the pairs that occur, which is enough to infer most of them, but not all 16 neighbour cases.
- Whether the grass rounded set is meant to sit on top of the plain grass, or to replace it. In the sample it sits on a plain grass base.

These are the open questions listed in `assessment.md`.
