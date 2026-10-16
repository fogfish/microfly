# OBJECTS.md — Sprite Catalogue

Every game object cut from the ZRPG sheets in this folder, as ready-to-use browser sprites. Machine-readable copy: `catalog.json` (and `catalog.js` for `file://` pages). Human QA: `lightbox.html`.

## 1. How to use (for agents)

- **Use the exported sprites, not the source sheets.** Source bounding boxes overlap (shadows, tight packing), so cropping a sheet by box pulls in neighbours. Each file in `sprites/<sheet>/<id>.png` is masked: only that object's pixels.
- **Two ways to draw:** load `sprites/<sheet>/<id>.png` as an `Image`, or load `atlas/atlas-N.png` once and `ctx.drawImage(atlas, a.x, a.y, a.w, a.h, dx, dy, a.w, a.h)` with `a = sprite.atlas`. Atlas rects never overlap (2 px padding).
- **Anchor:** `anchor` (sprite px) is the foot point (bottom-centre of the body, shadow excluded). Draw at `dx = worldX - anchor.x`, `dy = worldY - anchor.y` and depth-sort by `worldY`. `terrain`, `water` and tileset pieces anchor at `0,0` (top-left) and are drawn first.
- **Pixel art:** set `ctx.imageSmoothingEnabled = false` and CSS `image-rendering: pixelated`; scale by integers.
- **Shadows** are baked into the sprite (`shadow: true`) as black at alpha 92. Do not add another shadow.
- **Water** is an animation: `catalog.animations.water.frames` (21 frames, 320×128, fps 6), tile horizontally.
- **Tilesets** (`catalog.tilesets`, section 5) build sand, rock and grass areas of any size from corner, edge and fill pieces on a 32 px grid. Their pieces carry `tileset: {name, role, variant}` and anchor at `0,0`.
- **Ids** are `<sheet>-<class>-<NNN>`; `name` is a readable slug unique within a sheet. Refer to sprites by `id`.
- **Classes** are fixed to the 7 in section 2. Do not invent new ones.

```js
// <script src="catalog.js"></script>
const cat = window.TILE_CATALOG, byId = Object.fromEntries(cat.sprites.map(s => [s.id, s]));
const atlas = cat.atlases.map(a => Object.assign(new Image(), { src: a.file }));
function draw(ctx, id, worldX, worldY) {
  const s = byId[id], a = s.atlas;
  ctx.drawImage(atlas[a.index], a.x, a.y, a.w, a.h, worldX - s.anchor.x, worldY - s.anchor.y, a.w, a.h);
}
```

## 2. Classes

| Class | Meaning | Count |
| --- | --- | ---: |
| `tree` | Standing trees and palms (incl. dead trees, palm trunk/crown segments). Usually with cast shadow. | 40 |
| `bush` | Shrubs, cacti, ferns, leafy vines and overhangs: mid-size ground vegetation that blocks or decorates. | 57 |
| `plant` | Small vegetation: flowers, sprouts, tufts, reeds, mushrooms, grass-blade scatter decals. | 68 |
| `rock` | Rocks: mesas, cliffs, pillars, boulders, crystal/ore nodes, pebbles. | 108 |
| `terrain` | Ground art drawn under everything: grass/sand/gravel tiles, patches, autotile masks, pits, decals. | 181 |
| `prop` | Objects: logs, signposts, planters, tent, lantern, hive, bones, skulls, shells, starfish, coral. | 59 |
| `water` | Water animation frames. | 21 |

## 3. Sources and outputs

| Sheet | Source file | Size | Sprites |
| --- | --- | --- | ---: |
| `trees` | `ZRPGtrees.png` | 1024 × 1024 | 70 |
| `rocks2` | `ZRPGRocks2.png` | 1024 × 1024 | 171 |
| `beach` | `ZRPGBeach.png` | 1024 × 1024 | 220 |
| `jungle` | `ZRPGJunglePlants.png` | 512 × 416 | 52 |
| `water` | `ZRPGWater.png` | 320 × 3328 | 21 |

Atlases: `atlas/atlas-0.png` (2048 × 1835).

## 4. Sprites

Columns: `src` = box in the source sheet (x, y, w, h); `anchor` = foot point in sprite px; `S` = shadow baked in.

### trees — `ZRPGtrees.png`

| ID | Name | Class | File | src x,y,w,h | anchor | S | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `trees-tree-001` | `oak_large_a` | `tree` | `sprites/trees/trees-tree-001.png` | 23,18,347,305 | 158,288 | y | Large oak tree with wide cast shadow |
| `trees-tree-002` | `oak_medium_a` | `tree` | `sprites/trees/trees-tree-002.png` | 397,0,207,183 | 111,179 | y | Medium oak tree with cast shadow |
| `trees-tree-003` | `oak_medium_b` | `tree` | `sprites/trees/trees-tree-003.png` | 626,15,197,168 | 106,164 | y | Medium oak tree with cast shadow |
| `trees-tree-004` | `oak_small_a` | `tree` | `sprites/trees/trees-tree-004.png` | 840,0,145,128 | 48,124 | y | Small oak tree with cast shadow |
| `trees-tree-005` | `round_tree_small` | `tree` | `sprites/trees/trees-tree-005.png` | 832,129,80,96 | 31,95 | y | Small round-canopy tree with shadow |
| `trees-tree-006` | `round_tree_tiny` | `tree` | `sprites/trees/trees-tree-006.png` | 928,157,62,67 | 25,65 | y | Tiny round-canopy tree with shadow |
| `trees-tree-007` | `oak_twisted` | `tree` | `sprites/trees/trees-tree-007.png` | 392,192,177,160 | 51,160 | y | Medium oak with twisted trunk and shadow |
| `trees-tree-008` | `oak_large_b` | `tree` | `sprites/trees/trees-tree-008.png` | 599,210,347,306 | 188,306 | y | Large oak tree with wide cast shadow |
| `trees-tree-009` | `oak_medium_c` | `tree` | `sprites/trees/trees-tree-009.png` | 15,376,208,194 | 110,187 | y | Medium oak tree with cast shadow |
| `trees-tree-010` | `oak_medium_d` | `tree` | `sprites/trees/trees-tree-010.png` | 239,376,205,194 | 110,187 | y | Medium oak tree with cast shadow |
| `trees-terrain-001` | `grass_tile_a` | `terrain` | `sprites/trees/trees-terrain-001.png` | 512,512,32,32 | 0,0 |  | 32x32 grass tile |
| `trees-plant-001` | `yellow_flower_single` | `plant` | `sprites/trees/trees-plant-001.png` | 558,515,9,9 | 3,9 |  | Single tiny yellow flower decal (32px cell) |
| `trees-plant-002` | `yellow_flowers_trio` | `plant` | `sprites/trees/trees-plant-002.png` | 587,517,18,19 | 15,19 |  | Three tiny yellow flowers decal (32px cell) |
| `trees-terrain-002` | `dark_grass_patch_a` | `terrain` | `sprites/trees/trees-terrain-002.png` | 634,512,212,118 | 0,0 |  | Dark green grass patch with ragged edge |
| `trees-terrain-003` | `dark_grass_patch_b` | `terrain` | `sprites/trees/trees-terrain-003.png` | 874,512,143,79 | 0,0 |  | Dark green grass patch with ragged edge |
| `trees-terrain-004` | `grass_tile_b` | `terrain` | `sprites/trees/trees-terrain-004.png` | 512,544,32,32 | 0,0 |  | 32x32 grass tile |
| `trees-plant-003` | `yellow_flowers_cluster` | `plant` | `sprites/trees/trees-plant-003.png` | 545,545,30,29 | 14,29 |  | Cluster of tiny yellow flowers decal (32px cell) |
| `trees-terrain-005` | `grass_tile_c` | `terrain` | `sprites/trees/trees-terrain-005.png` | 512,576,32,32 | 0,0 |  | 32x32 grass tile |
| `trees-terrain-006` | `grass_tile_d` | `terrain` | `sprites/trees/trees-terrain-006.png` | 544,576,32,32 | 0,0 |  | 32x32 grass tile with dark blade marks |
| `trees-tree-011` | `oak_medium_e` | `tree` | `sprites/trees/trees-tree-011.png` | 14,602,198,192 | 110,185 | y | Medium oak tree with cast shadow |
| `trees-terrain-007` | `grass_tile_e` | `terrain` | `sprites/trees/trees-terrain-007.png` | 512,608,32,32 | 0,0 |  | 32x32 grass tile |
| `trees-terrain-008` | `grass_tile_f` | `terrain` | `sprites/trees/trees-terrain-008.png` | 544,608,32,32 | 0,0 |  | 32x32 grass tile with dark blade marks |
| `trees-terrain-009` | `dark_grass_patch_c` | `terrain` | `sprites/trees/trees-terrain-009.png` | 851,623,137,80 | 0,0 |  | Dark green grass patch with ragged edge |
| `trees-plant-004` | `leafy_sprout` | `plant` | `sprites/trees/trees-plant-004.png` | 260,679,23,17 | 9,17 |  | Small leafy green sprout |
| `trees-plant-005` | `red_flower_plant` | `plant` | `sprites/trees/trees-plant-005.png` | 288,676,32,23 | 13,23 |  | Low plant with red flowers |
| `trees-prop-001` | `stone_pedestal_planter` | `prop` | `sprites/trees/trees-prop-001.png` | 352,679,31,57 | 17,57 |  | White stone pedestal planter with leafy plant |
| `trees-plant-006` | `grass_tuft_a` | `plant` | `sprites/trees/trees-plant-006.png` | 360,641,24,26 | 10,25 | y | Green grass tuft |
| `trees-plant-007` | `grass_tuft_b` | `plant` | `sprites/trees/trees-plant-007.png` | 385,652,19,19 | 9,17 | y | Small green grass tuft |
| `trees-prop-002` | `barrel_planter_dry` | `prop` | `sprites/trees/trees-prop-002.png` | 391,675,56,61 | 23,59 | y | Wooden barrel planter with bare branches and shadow |
| `trees-bush-001` | `broadleaf_bush` | `bush` | `sprites/trees/trees-bush-001.png` | 417,643,31,27 | 15,27 | y | Broad-leaf green bush with shadow |
| `trees-prop-003` | `barrel_planter_sapling` | `prop` | `sprites/trees/trees-prop-003.png` | 448,673,32,59 | 15,59 |  | Wooden barrel planter with young leafy tree |
| `trees-prop-004` | `wooden_bowls_pair` | `prop` | `sprites/trees/trees-prop-004.png` | 449,640,29,32 | 19,31 | y | Two wooden bowls: one with seeds, one with a fern |
| `trees-plant-008` | `fern_small` | `plant` | `sprites/trees/trees-plant-008.png` | 483,645,28,23 | 14,23 | y | Small green fern |
| `trees-terrain-010` | `light_meadow_patch_a` | `terrain` | `sprites/trees/trees-terrain-010.png` | 544,655,256,144 | 0,0 |  | Large light-green meadow patch with dark centre |
| `trees-plant-009` | `sapling_twig` | `plant` | `sprites/trees/trees-plant-009.png` | 230,686,19,36 | 11,36 |  | Young sapling with a few leaves |
| `trees-plant-010` | `spiky_plant_a` | `plant` | `sprites/trees/trees-plant-010.png` | 256,708,31,24 | 16,24 |  | Spiky green plant |
| `trees-plant-011` | `spiky_plant_b` | `plant` | `sprites/trees/trees-plant-011.png` | 288,708,31,26 | 16,24 | y | Spiky green plant |
| `trees-plant-012` | `sapling_bent` | `plant` | `sprites/trees/trees-plant-012.png` | 227,737,26,31 | 13,31 |  | Bent young sapling with leaves |
| `trees-plant-013` | `leaf_clump_a` | `plant` | `sprites/trees/trees-plant-013.png` | 323,736,12,13 | 6,13 |  | Small leaf clump |
| `trees-plant-014` | `leaf_clump_b` | `plant` | `sprites/trees/trees-plant-014.png` | 327,751,18,17 | 10,17 |  | Small leaf clump |
| `trees-plant-015` | `leaf_clump_c` | `plant` | `sprites/trees/trees-plant-015.png` | 345,739,18,15 | 10,15 |  | Small leaf clump |
| `trees-plant-016` | `leaf_clump_d` | `plant` | `sprites/trees/trees-plant-016.png` | 363,736,15,16 | 8,16 |  | Small leaf clump |
| `trees-tree-012` | `oak_small_b` | `tree` | `sprites/trees/trees-tree-012.png` | 400,743,111,112 | 61,112 | y | Small oak tree with cast shadow |
| `trees-terrain-011` | `dark_grass_patch_d` | `terrain` | `sprites/trees/trees-terrain-011.png` | 832,741,181,98 | 0,0 |  | Dark green grass patch with ragged edge |
| `trees-plant-017` | `leafy_stalk` | `plant` | `sprites/trees/trees-plant-017.png` | 361,770,16,28 | 4,28 |  | Tall leafy green stalk |
| `trees-prop-005` | `wooden_signpost` | `prop` | `sprites/trees/trees-prop-005.png` | 160,811,32,43 | 14,43 |  | Wooden signpost on grass |
| `trees-bush-002` | `yellow_green_bush` | `bush` | `sprites/trees/trees-bush-002.png` | 193,833,30,31 | 15,31 |  | Yellow-green leafy bush |
| `trees-plant-018` | `broadleaf_plant` | `plant` | `sprites/trees/trees-plant-018.png` | 200,801,47,32 | 27,32 |  | Broad-leaf yellow-green plant |
| `trees-plant-019` | `leafy_clump_tall` | `plant` | `sprites/trees/trees-plant-019.png` | 258,815,28,35 | 17,35 |  | Tall yellow-green leafy clump |
| `trees-plant-020` | `leaf_tiny_a` | `plant` | `sprites/trees/trees-plant-020.png` | 288,808,11,11 | 6,11 |  | Tiny leaf sprite |
| `trees-plant-021` | `leaf_tiny_b` | `plant` | `sprites/trees/trees-plant-021.png` | 299,809,19,15 | 10,15 |  | Tiny leaf sprite |
| `trees-bush-003` | `thorny_shrub` | `bush` | `sprites/trees/trees-bush-003.png` | 333,800,36,31 | 18,31 |  | Woody shrub with sparse leaves |
| `trees-tree-013` | `pine_tall` | `tree` | `sprites/trees/trees-tree-013.png` | 0,866,122,158 | 34,157 | y | Tall pine tree with cast shadow |
| `trees-prop-006` | `hollow_log` | `prop` | `sprites/trees/trees-prop-006.png` | 171,876,42,39 | 32,39 |  | Hollow wooden log |
| `trees-plant-022` | `leaf_tiny_c` | `plant` | `sprites/trees/trees-plant-022.png` | 229,840,8,10 | 4,10 |  | Tiny leaf sprite |
| `trees-prop-007` | `potted_palm` | `prop` | `sprites/trees/trees-prop-007.png` | 229,878,21,40 | 12,40 |  | Potted palm plant |
| `trees-plant-023` | `leaf_tiny_d` | `plant` | `sprites/trees/trees-plant-023.png` | 237,844,14,13 | 5,13 |  | Tiny leaf sprite |
| `trees-plant-024` | `leaf_tiny_e` | `plant` | `sprites/trees/trees-plant-024.png` | 288,840,12,12 | 6,12 |  | Tiny leaf sprite |
| `trees-plant-025` | `leaf_tiny_f` | `plant` | `sprites/trees/trees-plant-025.png` | 299,841,19,15 | 10,15 |  | Tiny leaf sprite |
| `trees-tree-014` | `oak_small_c` | `tree` | `sprites/trees/trees-tree-014.png` | 427,875,49,50 | 19,50 | y | Small oak tree with cast shadow |
| `trees-prop-008` | `potted_teal_plant` | `prop` | `sprites/trees/trees-prop-008.png` | 260,889,23,29 | 12,29 |  | Potted teal plant |
| `trees-prop-009` | `potted_tall_plant` | `prop` | `sprites/trees/trees-prop-009.png` | 294,881,20,37 | 11,37 |  | Potted tall teal plant |
| `trees-bush-004` | `dense_shrub` | `bush` | `sprites/trees/trees-bush-004.png` | 368,880,37,31 | 11,31 | y | Dense dark shrub with shadow |
| `trees-terrain-012` | `light_meadow_patch_b` | `terrain` | `sprites/trees/trees-terrain-012.png` | 517,892,226,111 | 0,0 |  | Light-green meadow patch with dark centre |
| `trees-terrain-013` | `light_meadow_patch_c` | `terrain` | `sprites/trees/trees-terrain-013.png` | 793,897,184,104 | 0,0 |  | Light-green meadow patch with dark centre |
| `trees-tree-015` | `pine_small_wide` | `tree` | `sprites/trees/trees-tree-015.png` | 131,948,72,76 | 29,75 | y | Small wide pine tree with shadow |
| `trees-tree-016` | `pine_small` | `tree` | `sprites/trees/trees-tree-016.png` | 224,947,59,77 | 18,76 | y | Small pine tree with shadow |
| `trees-tree-017` | `round_tree_dense` | `tree` | `sprites/trees/trees-tree-017.png` | 320,928,81,96 | 36,96 | y | Small dense round tree with shadow |
| `trees-tree-018` | `oak_small_d` | `tree` | `sprites/trees/trees-tree-018.png` | 416,949,73,72 | 29,72 | y | Small oak tree with shadow |
| `trees-tree-019` | `pine_sapling` | `tree` | `sprites/trees/trees-tree-019.png` | 292,992,28,31 | 9,31 | y | Pine sapling with shadow |

### rocks2 — `ZRPGRocks2.png`

| ID | Name | Class | File | src x,y,w,h | anchor | S | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `rocks2-rock-001` | `mesa_hollow_open_tl` | `rock` | `sprites/rocks2/rocks2-rock-001.png` | 224,0,64,64 | 0,0 |  | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: top-left corner |
| `rocks2-rock-002` | `mesa_hollow_open_t1` | `rock` | `sprites/rocks2/rocks2-rock-002.png` | 288,0,32,64 | 0,0 |  | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: top edge |
| `rocks2-rock-003` | `mesa_hollow_open_t2` | `rock` | `sprites/rocks2/rocks2-rock-003.png` | 320,0,32,64 | 0,0 |  | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: top edge |
| `rocks2-rock-004` | `mesa_hollow_open_tr` | `rock` | `sprites/rocks2/rocks2-rock-004.png` | 352,0,96,64 | 0,0 |  | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: top-right corner |
| `rocks2-rock-005` | `mesa_hollow_open_l` | `rock` | `sprites/rocks2/rocks2-rock-005.png` | 224,64,64,32 | 0,0 |  | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: left edge |
| `rocks2-rock-006` | `mesa_hollow_open_r` | `rock` | `sprites/rocks2/rocks2-rock-006.png` | 352,64,96,32 | 0,0 | y | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: right edge |
| `rocks2-rock-007` | `mesa_hollow_open_bl` | `rock` | `sprites/rocks2/rocks2-rock-007.png` | 224,96,64,128 | 0,0 | y | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: bottom-left corner |
| `rocks2-rock-008` | `mesa_hollow_open_b1` | `rock` | `sprites/rocks2/rocks2-rock-008.png` | 288,96,32,128 | 0,0 | y | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: bottom edge |
| `rocks2-rock-009` | `mesa_hollow_open_b2` | `rock` | `sprites/rocks2/rocks2-rock-009.png` | 320,96,32,128 | 0,0 | y | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: bottom edge |
| `rocks2-rock-010` | `mesa_hollow_open_br` | `rock` | `sprites/rocks2/rocks2-rock-010.png` | 352,96,96,128 | 0,0 | y | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow: bottom-right corner |
| `rocks2-rock-011` | `mesa_solid_tl` | `rock` | `sprites/rocks2/rocks2-rock-011.png` | 448,0,64,64 | 0,0 |  | Mesa with gravel top, cliff face and shadow: top-left corner |
| `rocks2-rock-012` | `mesa_solid_t1` | `rock` | `sprites/rocks2/rocks2-rock-012.png` | 512,0,32,64 | 0,0 |  | Mesa with gravel top, cliff face and shadow: top edge |
| `rocks2-rock-013` | `mesa_solid_t2` | `rock` | `sprites/rocks2/rocks2-rock-013.png` | 544,0,32,64 | 0,0 |  | Mesa with gravel top, cliff face and shadow: top edge |
| `rocks2-rock-014` | `mesa_solid_tr` | `rock` | `sprites/rocks2/rocks2-rock-014.png` | 576,0,96,64 | 0,0 |  | Mesa with gravel top, cliff face and shadow: top-right corner |
| `rocks2-rock-015` | `mesa_solid_l` | `rock` | `sprites/rocks2/rocks2-rock-015.png` | 448,64,64,32 | 0,0 |  | Mesa with gravel top, cliff face and shadow: left edge |
| `rocks2-rock-016` | `mesa_solid_c` | `rock` | `sprites/rocks2/rocks2-rock-016.png` | 512,64,32,32 | 0,0 |  | Mesa with gravel top, cliff face and shadow: fill |
| `rocks2-rock-017` | `mesa_solid_r` | `rock` | `sprites/rocks2/rocks2-rock-017.png` | 576,64,96,32 | 0,0 | y | Mesa with gravel top, cliff face and shadow: right edge |
| `rocks2-rock-018` | `mesa_solid_bl` | `rock` | `sprites/rocks2/rocks2-rock-018.png` | 448,96,64,128 | 0,0 | y | Mesa with gravel top, cliff face and shadow: bottom-left corner |
| `rocks2-rock-019` | `mesa_solid_b1` | `rock` | `sprites/rocks2/rocks2-rock-019.png` | 512,96,32,128 | 0,0 | y | Mesa with gravel top, cliff face and shadow: bottom edge |
| `rocks2-rock-020` | `mesa_solid_b2` | `rock` | `sprites/rocks2/rocks2-rock-020.png` | 544,96,32,128 | 0,0 | y | Mesa with gravel top, cliff face and shadow: bottom edge |
| `rocks2-rock-021` | `mesa_solid_br` | `rock` | `sprites/rocks2/rocks2-rock-021.png` | 576,96,96,128 | 0,0 | y | Mesa with gravel top, cliff face and shadow: bottom-right corner |
| `rocks2-rock-022` | `mesa_solid_fog_tl` | `rock` | `sprites/rocks2/rocks2-rock-022.png` | 672,0,64,64 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: top-left corner |
| `rocks2-rock-023` | `mesa_solid_fog_t1` | `rock` | `sprites/rocks2/rocks2-rock-023.png` | 736,0,32,64 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: top edge |
| `rocks2-rock-024` | `mesa_solid_fog_t2` | `rock` | `sprites/rocks2/rocks2-rock-024.png` | 768,0,32,64 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: top edge |
| `rocks2-rock-025` | `mesa_solid_fog_tr` | `rock` | `sprites/rocks2/rocks2-rock-025.png` | 800,0,64,64 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: top-right corner |
| `rocks2-rock-026` | `mesa_solid_fog_l` | `rock` | `sprites/rocks2/rocks2-rock-026.png` | 672,64,64,32 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: left edge |
| `rocks2-rock-027` | `mesa_solid_fog_c` | `rock` | `sprites/rocks2/rocks2-rock-027.png` | 736,64,32,32 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: fill |
| `rocks2-rock-028` | `mesa_solid_fog_r` | `rock` | `sprites/rocks2/rocks2-rock-028.png` | 800,64,64,32 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: right edge |
| `rocks2-rock-029` | `mesa_solid_fog_bl` | `rock` | `sprites/rocks2/rocks2-rock-029.png` | 672,96,64,128 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: bottom-left corner |
| `rocks2-rock-030` | `mesa_solid_fog_b1` | `rock` | `sprites/rocks2/rocks2-rock-030.png` | 736,96,32,128 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: bottom edge |
| `rocks2-rock-031` | `mesa_solid_fog_b2` | `rock` | `sprites/rocks2/rocks2-rock-031.png` | 768,96,32,128 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: bottom edge |
| `rocks2-rock-032` | `mesa_solid_fog_br` | `rock` | `sprites/rocks2/rocks2-rock-032.png` | 800,96,64,128 | 0,0 |  | Mesa with gravel top and fog-faded cliff face: bottom-right corner |
| `rocks2-rock-033` | `rock_cluster_grass_a` | `rock` | `sprites/rocks2/rocks2-rock-033.png` | 928,4,32,28 | 17,28 |  | Small rock cluster on grass |
| `rocks2-rock-034` | `rock_cluster_grass_b` | `rock` | `sprites/rocks2/rocks2-rock-034.png` | 960,5,32,27 | 7,27 |  | Small rock cluster on grass |
| `rocks2-rock-035` | `rock_cluster_grass_c` | `rock` | `sprites/rocks2/rocks2-rock-035.png` | 995,7,26,25 | 14,25 |  | Small rock cluster on grass |
| `rocks2-rock-036` | `low_rock_grass_a` | `rock` | `sprites/rocks2/rocks2-rock-036.png` | 932,46,23,18 | 12,18 |  | Low rock on grass |
| `rocks2-rock-037` | `small_rock_a` | `rock` | `sprites/rocks2/rocks2-rock-037.png` | 966,42,19,21 | 10,21 |  | Small rock |
| `rocks2-rock-038` | `small_rock_b` | `rock` | `sprites/rocks2/rocks2-rock-038.png` | 966,79,19,17 | 8,17 |  | Small rock |
| `rocks2-rock-039` | `low_rock_grass_b` | `rock` | `sprites/rocks2/rocks2-rock-039.png` | 995,78,25,18 | 13,18 |  | Low rock pair on grass |
| `rocks2-rock-040` | `low_rock_c` | `rock` | `sprites/rocks2/rocks2-rock-040.png` | 997,50,19,14 | 9,14 |  | Low small rock |
| `rocks2-rock-041` | `pebble_pair_a` | `rock` | `sprites/rocks2/rocks2-rock-041.png` | 935,83,14,11 | 11,11 |  | Pair of pebbles |
| `rocks2-rock-042` | `pebble_a` | `rock` | `sprites/rocks2/rocks2-rock-042.png` | 938,114,12,10 | 6,10 |  | Single pebble |
| `rocks2-rock-043` | `low_rock_grass_d` | `rock` | `sprites/rocks2/rocks2-rock-043.png` | 965,116,21,12 | 12,12 |  | Low rock on grass |
| `rocks2-rock-044` | `pebble_pair_b` | `rock` | `sprites/rocks2/rocks2-rock-044.png` | 999,116,15,10 | 8,10 |  | Pair of pebbles |
| `rocks2-rock-045` | `small_boulder_a` | `rock` | `sprites/rocks2/rocks2-rock-045.png` | 931,132,26,24 | 12,24 |  | Small boulder |
| `rocks2-rock-046` | `small_boulder_b` | `rock` | `sprites/rocks2/rocks2-rock-046.png` | 972,128,40,32 | 14,32 |  | Small boulder |
| `rocks2-rock-047` | `small_boulder_c` | `rock` | `sprites/rocks2/rocks2-rock-047.png` | 929,174,30,18 | 13,18 |  | Low small boulder |
| `rocks2-rock-048` | `cliff_column` | `rock` | `sprites/rocks2/rocks2-rock-048.png` | 2,224,108,139 | 65,139 |  | Vertical cliff column, no shadow |
| `rocks2-rock-049` | `cliff_column_shadow` | `rock` | `sprites/rocks2/rocks2-rock-049.png` | 130,224,149,139 | 62,138 | y | Vertical cliff column with cast shadow |
| `rocks2-rock-050` | `cliff_column_grass` | `rock` | `sprites/rocks2/rocks2-rock-050.png` | 322,224,133,146 | 94,146 |  | Vertical cliff column with grass at the base |
| `rocks2-rock-051` | `cliff_column_fog` | `rock` | `sprites/rocks2/rocks2-rock-051.png` | 483,224,107,139 | 64,139 |  | Vertical cliff column with fog-faded base |
| `rocks2-rock-052` | `cliff_ledge_fog` | `rock` | `sprites/rocks2/rocks2-rock-052.png` | 640,224,128,91 | 64,91 |  | Horizontal cliff ledge fading into fog |
| `rocks2-rock-053` | `pillar_1` | `rock` | `sprites/rocks2/rocks2-rock-053.png` | 780,232,40,55 | 18,55 |  | Narrow rock pillar |
| `rocks2-rock-054` | `pillar_2` | `rock` | `sprites/rocks2/rocks2-rock-054.png` | 843,230,42,57 | 17,57 |  | Narrow rock pillar |
| `rocks2-rock-055` | `pillar_3` | `rock` | `sprites/rocks2/rocks2-rock-055.png` | 906,239,43,48 | 15,48 |  | Narrow rock pillar with small shadow |
| `rocks2-rock-056` | `pillar_4` | `rock` | `sprites/rocks2/rocks2-rock-056.png` | 969,225,46,62 | 19,62 |  | Narrow rock pillar with small shadow |
| `rocks2-rock-057` | `pillar_5` | `rock` | `sprites/rocks2/rocks2-rock-057.png` | 765,296,59,55 | 21,55 | y | Narrow rock pillar with cast shadow |
| `rocks2-rock-058` | `pillar_6` | `rock` | `sprites/rocks2/rocks2-rock-058.png` | 831,294,58,58 | 17,57 | y | Narrow rock pillar with cast shadow |
| `rocks2-rock-059` | `pillar_7` | `rock` | `sprites/rocks2/rocks2-rock-059.png` | 894,303,55,51 | 15,48 | y | Narrow rock pillar with cast shadow |
| `rocks2-rock-060` | `pillar_8` | `rock` | `sprites/rocks2/rocks2-rock-060.png` | 957,289,63,62 | 19,62 | y | Narrow rock pillar with cast shadow |
| `rocks2-rock-061` | `plateau_tall_tl` | `rock` | `sprites/rocks2/rocks2-rock-061.png` | 672,352,64,64 | 0,0 |  | Plateau with gravel top and layered cliff face: top-left corner |
| `rocks2-rock-062` | `plateau_tall_t1` | `rock` | `sprites/rocks2/rocks2-rock-062.png` | 736,352,32,64 | 0,0 |  | Plateau with gravel top and layered cliff face: top edge |
| `rocks2-rock-063` | `plateau_tall_t2` | `rock` | `sprites/rocks2/rocks2-rock-063.png` | 768,352,32,64 | 0,0 |  | Plateau with gravel top and layered cliff face: top edge |
| `rocks2-rock-064` | `plateau_tall_tr` | `rock` | `sprites/rocks2/rocks2-rock-064.png` | 800,352,64,64 | 0,0 |  | Plateau with gravel top and layered cliff face: top-right corner |
| `rocks2-rock-065` | `plateau_tall_l` | `rock` | `sprites/rocks2/rocks2-rock-065.png` | 672,416,64,32 | 0,0 |  | Plateau with gravel top and layered cliff face: left edge |
| `rocks2-rock-066` | `plateau_tall_c` | `rock` | `sprites/rocks2/rocks2-rock-066.png` | 736,416,32,32 | 0,0 |  | Plateau with gravel top and layered cliff face: fill |
| `rocks2-rock-067` | `plateau_tall_r` | `rock` | `sprites/rocks2/rocks2-rock-067.png` | 800,416,64,32 | 0,0 |  | Plateau with gravel top and layered cliff face: right edge |
| `rocks2-rock-068` | `plateau_tall_bl` | `rock` | `sprites/rocks2/rocks2-rock-068.png` | 672,448,64,128 | 0,0 |  | Plateau with gravel top and layered cliff face: bottom-left corner |
| `rocks2-rock-069` | `plateau_tall_b1` | `rock` | `sprites/rocks2/rocks2-rock-069.png` | 736,448,32,128 | 0,0 |  | Plateau with gravel top and layered cliff face: bottom edge |
| `rocks2-rock-070` | `plateau_tall_b2` | `rock` | `sprites/rocks2/rocks2-rock-070.png` | 768,448,32,128 | 0,0 |  | Plateau with gravel top and layered cliff face: bottom edge |
| `rocks2-rock-071` | `plateau_tall_br` | `rock` | `sprites/rocks2/rocks2-rock-071.png` | 800,448,64,128 | 0,0 |  | Plateau with gravel top and layered cliff face: bottom-right corner |
| `rocks2-rock-072` | `outcrop_medium` | `rock` | `sprites/rocks2/rocks2-rock-072.png` | 6,404,134,97 | 67,97 |  | Medium rock outcrop |
| `rocks2-rock-073` | `outcrop_medium_shadow` | `rock` | `sprites/rocks2/rocks2-rock-073.png` | 166,404,144,104 | 90,104 | y | Medium rock outcrop with cast shadow |
| `rocks2-rock-074` | `outcrop_medium_grass` | `rock` | `sprites/rocks2/rocks2-rock-074.png` | 326,404,179,108 | 103,108 |  | Medium rock outcrop merged with grass |
| `rocks2-rock-075` | `outcrop_medium_fog` | `rock` | `sprites/rocks2/rocks2-rock-075.png` | 518,404,134,104 | 90,104 |  | Medium rock outcrop with fog-faded base |
| `rocks2-rock-076` | `outcrop_small` | `rock` | `sprites/rocks2/rocks2-rock-076.png` | 0,522,101,75 | 52,75 |  | Small rock outcrop |
| `rocks2-rock-077` | `outcrop_small_shadow` | `rock` | `sprites/rocks2/rocks2-rock-077.png` | 128,522,109,77 | 52,75 | y | Small rock outcrop with cast shadow |
| `rocks2-rock-078` | `outcrop_small_grass` | `rock` | `sprites/rocks2/rocks2-rock-078.png` | 256,522,123,75 | 34,75 |  | Small rock outcrop merged with grass |
| `rocks2-rock-079` | `outcrop_small_fog` | `rock` | `sprites/rocks2/rocks2-rock-079.png` | 384,522,101,75 | 52,75 |  | Small rock outcrop with fog-faded base |
| `rocks2-rock-080` | `cliff_fog_tile` | `rock` | `sprites/rocks2/rocks2-rock-080.png` | 512,544,32,32 | 16,32 |  | 32x32 fogged cliff fill tile |
| `rocks2-terrain-001` | `grass_patch_octagon_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-001.png` | 0,608,64,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: top-left corner |
| `rocks2-terrain-002` | `grass_patch_octagon_t` | `terrain` | `sprites/rocks2/rocks2-terrain-002.png` | 64,608,32,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: top edge |
| `rocks2-terrain-003` | `grass_patch_octagon_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-003.png` | 96,608,64,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: top-right corner |
| `rocks2-terrain-004` | `grass_patch_octagon_l` | `terrain` | `sprites/rocks2/rocks2-terrain-004.png` | 0,672,64,32 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: left edge |
| `rocks2-terrain-005` | `grass_patch_octagon_c` | `terrain` | `sprites/rocks2/rocks2-terrain-005.png` | 64,672,32,32 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: fill |
| `rocks2-terrain-006` | `grass_patch_octagon_r` | `terrain` | `sprites/rocks2/rocks2-terrain-006.png` | 96,672,64,32 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: right edge |
| `rocks2-terrain-007` | `grass_patch_octagon_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-007.png` | 0,704,64,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: bottom-left corner |
| `rocks2-terrain-008` | `grass_patch_octagon_b` | `terrain` | `sprites/rocks2/rocks2-terrain-008.png` | 64,704,32,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: bottom edge |
| `rocks2-terrain-009` | `grass_patch_octagon_br` | `terrain` | `sprites/rocks2/rocks2-terrain-009.png` | 96,704,64,64 | 0,0 |  | Dark-green grass patch with light ragged fringe and cut corners: bottom-right corner |
| `rocks2-terrain-010` | `grass_cross_frame_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-010.png` | 160,608,64,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): top-left corner |
| `rocks2-terrain-011` | `grass_cross_frame_t` | `terrain` | `sprites/rocks2/rocks2-terrain-011.png` | 224,608,32,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): top edge |
| `rocks2-terrain-012` | `grass_cross_frame_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-012.png` | 256,608,64,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): top-right corner |
| `rocks2-terrain-013` | `grass_cross_frame_l` | `terrain` | `sprites/rocks2/rocks2-terrain-013.png` | 160,672,64,32 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): left edge |
| `rocks2-terrain-014` | `grass_cross_frame_r` | `terrain` | `sprites/rocks2/rocks2-terrain-014.png` | 256,672,64,32 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): right edge |
| `rocks2-terrain-015` | `grass_cross_frame_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-015.png` | 160,704,64,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): bottom-left corner |
| `rocks2-terrain-016` | `grass_cross_frame_b` | `terrain` | `sprites/rocks2/rocks2-terrain-016.png` | 224,704,32,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): bottom edge |
| `rocks2-terrain-017` | `grass_cross_frame_br` | `terrain` | `sprites/rocks2/rocks2-terrain-017.png` | 256,704,64,64 | 0,0 |  | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites): bottom-right corner |
| `rocks2-terrain-018` | `grass_cross_cutout_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-018.png` | 320,608,64,64 | 0,0 |  | Green grass frame around a hole with notched corners: top-left corner |
| `rocks2-terrain-019` | `grass_cross_cutout_t` | `terrain` | `sprites/rocks2/rocks2-terrain-019.png` | 384,608,32,64 | 0,0 |  | Green grass frame around a hole with notched corners: top edge |
| `rocks2-terrain-020` | `grass_cross_cutout_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-020.png` | 416,608,64,64 | 0,0 |  | Green grass frame around a hole with notched corners: top-right corner |
| `rocks2-terrain-021` | `grass_cross_cutout_l` | `terrain` | `sprites/rocks2/rocks2-terrain-021.png` | 320,672,64,32 | 0,0 |  | Green grass frame around a hole with notched corners: left edge |
| `rocks2-terrain-022` | `grass_cross_cutout_r` | `terrain` | `sprites/rocks2/rocks2-terrain-022.png` | 416,672,64,32 | 0,0 |  | Green grass frame around a hole with notched corners: right edge |
| `rocks2-terrain-023` | `grass_cross_cutout_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-023.png` | 320,704,64,64 | 0,0 |  | Green grass frame around a hole with notched corners: bottom-left corner |
| `rocks2-terrain-024` | `grass_cross_cutout_b` | `terrain` | `sprites/rocks2/rocks2-terrain-024.png` | 384,704,32,64 | 0,0 |  | Green grass frame around a hole with notched corners: bottom edge |
| `rocks2-terrain-025` | `grass_cross_cutout_br` | `terrain` | `sprites/rocks2/rocks2-terrain-025.png` | 416,704,64,64 | 0,0 |  | Green grass frame around a hole with notched corners: bottom-right corner |
| `rocks2-plant-001` | `grass_scatter_light` | `plant` | `sprites/rocks2/rocks2-plant-001.png` | 480,608,160,109 | 40,109 |  | Loose light-green grass blades scatter (decal set) |
| `rocks2-terrain-026` | `grass_tile_teal_dark` | `terrain` | `sprites/rocks2/rocks2-terrain-026.png` | 192,672,32,32 | 0,0 |  | 32x32 dark teal grass tile |
| `rocks2-terrain-027` | `grass_tile_sage` | `terrain` | `sprites/rocks2/rocks2-terrain-027.png` | 224,640,32,32 | 0,0 |  | 32x32 sage-green grass tile |
| `rocks2-terrain-028` | `grass_tile_green` | `terrain` | `sprites/rocks2/rocks2-terrain-028.png` | 224,672,32,32 | 0,0 |  | 32x32 mid-green grass tile |
| `rocks2-terrain-029` | `grass_tile_teal` | `terrain` | `sprites/rocks2/rocks2-terrain-029.png` | 256,672,32,32 | 0,0 |  | 32x32 teal grass tile |
| `rocks2-plant-002` | `grass_tuft_light_a` | `plant` | `sprites/rocks2/rocks2-plant-002.png` | 480,712,64,53 | 29,53 |  | Dense light-green grass tuft |
| `rocks2-plant-003` | `grass_tuft_light_b` | `plant` | `sprites/rocks2/rocks2-plant-003.png` | 545,717,94,47 | 27,47 |  | Dense light-green grass tuft |
| `rocks2-terrain-030` | `grass_band` | `terrain` | `sprites/rocks2/rocks2-terrain-030.png` | 704,684,128,104 | 0,0 |  | Horizontal grass band edge tile |
| `rocks2-plant-004` | `grass_scatter_green` | `plant` | `sprites/rocks2/rocks2-plant-004.png` | 477,757,163,115 | 53,115 |  | Loose green grass blades scatter (decal set) |
| `rocks2-terrain-031` | `cobble_ground_grass_edge_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-031.png` | 0,768,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: top-left corner |
| `rocks2-terrain-032` | `cobble_ground_grass_edge_t` | `terrain` | `sprites/rocks2/rocks2-terrain-032.png` | 32,768,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: top edge |
| `rocks2-terrain-033` | `cobble_ground_grass_edge_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-033.png` | 64,768,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: top-right corner |
| `rocks2-terrain-034` | `cobble_ground_grass_edge_l` | `terrain` | `sprites/rocks2/rocks2-terrain-034.png` | 0,800,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: left edge |
| `rocks2-terrain-035` | `cobble_ground_grass_edge_c` | `terrain` | `sprites/rocks2/rocks2-terrain-035.png` | 32,800,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: fill |
| `rocks2-terrain-036` | `cobble_ground_grass_edge_r` | `terrain` | `sprites/rocks2/rocks2-terrain-036.png` | 64,800,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: right edge |
| `rocks2-terrain-037` | `cobble_ground_grass_edge_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-037.png` | 0,832,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: bottom-left corner |
| `rocks2-terrain-038` | `cobble_ground_grass_edge_b` | `terrain` | `sprites/rocks2/rocks2-terrain-038.png` | 32,832,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: bottom edge |
| `rocks2-terrain-039` | `cobble_ground_grass_edge_br` | `terrain` | `sprites/rocks2/rocks2-terrain-039.png` | 64,832,32,32 | 0,0 |  | Cobblestone ground with grassy ragged edge: bottom-right corner |
| `rocks2-terrain-040` | `cobble_tile_hole` | `terrain` | `sprites/rocks2/rocks2-terrain-040.png` | 96,768,65,70 | 0,0 |  | Cobblestone tile with hole |
| `rocks2-terrain-041` | `cobble_overgrown_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-041.png` | 160,768,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: top-left corner |
| `rocks2-terrain-042` | `cobble_overgrown_t` | `terrain` | `sprites/rocks2/rocks2-terrain-042.png` | 192,768,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: top edge |
| `rocks2-terrain-043` | `cobble_overgrown_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-043.png` | 224,768,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: top-right corner |
| `rocks2-terrain-044` | `cobble_overgrown_l` | `terrain` | `sprites/rocks2/rocks2-terrain-044.png` | 160,800,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: left edge |
| `rocks2-terrain-045` | `cobble_overgrown_c` | `terrain` | `sprites/rocks2/rocks2-terrain-045.png` | 192,800,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: fill |
| `rocks2-terrain-046` | `cobble_overgrown_r` | `terrain` | `sprites/rocks2/rocks2-terrain-046.png` | 224,800,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: right edge |
| `rocks2-terrain-047` | `cobble_overgrown_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-047.png` | 160,832,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: bottom-left corner |
| `rocks2-terrain-048` | `cobble_overgrown_b` | `terrain` | `sprites/rocks2/rocks2-terrain-048.png` | 192,832,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: bottom edge |
| `rocks2-terrain-049` | `cobble_overgrown_br` | `terrain` | `sprites/rocks2/rocks2-terrain-049.png` | 224,832,32,32 | 0,0 |  | Cobblestone ground overgrown with grass: bottom-right corner |
| `rocks2-terrain-050` | `stone_tile_hole` | `terrain` | `sprites/rocks2/rocks2-terrain-050.png` | 256,768,64,64 | 0,0 |  | 64x64 stone tile with hole |
| `rocks2-plant-005` | `grass_scatter_yellow` | `plant` | `sprites/rocks2/rocks2-plant-005.png` | 320,768,157,104 | 50,104 |  | Loose yellow grass blades scatter (decal set) |
| `rocks2-terrain-051` | `grass_rim_bar_left` | `terrain` | `sprites/rocks2/rocks2-terrain-051.png` | 626,792,79,104 | 0,0 |  | Vertical green cliff-rim bar with ragged edges (left) |
| `rocks2-rock-081` | `pebble_crumbs_a` | `rock` | `sprites/rocks2/rocks2-rock-081.png` | 96,835,58,26 | 10,25 | y | Loose pebble crumbs |
| `rocks2-terrain-052` | `grass_tile_light` | `terrain` | `sprites/rocks2/rocks2-terrain-052.png` | 256,832,64,64 | 0,0 |  | 64x64 light-green grass tile |
| `rocks2-terrain-053` | `grass_rim_bar_right` | `terrain` | `sprites/rocks2/rocks2-terrain-053.png` | 767,800,65,96 | 0,0 |  | Vertical green cliff-rim bar with ragged edges (right) |
| `rocks2-terrain-054` | `gravel_patch_round_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-054.png` | 0,864,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top-left corner |
| `rocks2-terrain-055` | `gravel_patch_round_t` | `terrain` | `sprites/rocks2/rocks2-terrain-055.png` | 32,864,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top edge |
| `rocks2-terrain-056` | `gravel_patch_round_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-056.png` | 64,864,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top-right corner |
| `rocks2-terrain-057` | `gravel_patch_round_l` | `terrain` | `sprites/rocks2/rocks2-terrain-057.png` | 0,896,32,32 | 0,0 | y | Gravel ground with loose-stone edge: left edge |
| `rocks2-terrain-058` | `gravel_patch_round_c` | `terrain` | `sprites/rocks2/rocks2-terrain-058.png` | 32,896,32,32 | 0,0 |  | Gravel ground with loose-stone edge: fill |
| `rocks2-terrain-059` | `gravel_patch_round_r` | `terrain` | `sprites/rocks2/rocks2-terrain-059.png` | 64,896,32,32 | 0,0 |  | Gravel ground with loose-stone edge: right edge |
| `rocks2-terrain-060` | `gravel_patch_round_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-060.png` | 0,928,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom-left corner |
| `rocks2-terrain-061` | `gravel_patch_round_b` | `terrain` | `sprites/rocks2/rocks2-terrain-061.png` | 32,928,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom edge |
| `rocks2-terrain-062` | `gravel_patch_round_br` | `terrain` | `sprites/rocks2/rocks2-terrain-062.png` | 64,928,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom-right corner |
| `rocks2-terrain-063` | `gravel_tile_holes` | `terrain` | `sprites/rocks2/rocks2-terrain-063.png` | 96,860,64,66 | 0,0 |  | Gravel tile with holes |
| `rocks2-plant-006` | `grass_tuft_yellow_cluster` | `plant` | `sprites/rocks2/rocks2-plant-006.png` | 320,870,78,85 | 38,85 |  | Dense yellow grass tufts cluster |
| `rocks2-plant-007` | `grass_tuft_yellow` | `plant` | `sprites/rocks2/rocks2-plant-007.png` | 388,877,84,51 | 70,51 |  | Dense yellow grass tuft |
| `rocks2-plant-008` | `grass_tuft_green_cluster` | `plant` | `sprites/rocks2/rocks2-plant-008.png` | 472,870,83,58 | 41,58 |  | Dense green grass tufts cluster |
| `rocks2-plant-009` | `grass_tuft_green` | `plant` | `sprites/rocks2/rocks2-plant-009.png` | 548,877,84,51 | 70,51 |  | Dense green grass tuft |
| `rocks2-terrain-064` | `grass_rim_diamond` | `terrain` | `sprites/rocks2/rocks2-terrain-064.png` | 632,848,199,160 | 0,0 |  | Diamond-shaped green cliff-rim corner piece |
| `rocks2-terrain-065` | `rubble_overlay_set` | `terrain` | `sprites/rocks2/rocks2-terrain-065.png` | 162,896,89,96 | 0,0 |  | Rubble and dirt overlay pieces |
| `rocks2-terrain-066` | `grass_tile_dark` | `terrain` | `sprites/rocks2/rocks2-terrain-066.png` | 256,896,64,64 | 0,0 |  | 64x64 dark-green grass tile |
| `rocks2-rock-082` | `pebble_b` | `rock` | `sprites/rocks2/rocks2-rock-082.png` | 960,915,21,10 | 10,9 | y | Single pebble |
| `rocks2-rock-083` | `pebble_crumbs_b` | `rock` | `sprites/rocks2/rocks2-rock-083.png` | 963,896,27,20 | 19,19 | y | Loose pebble crumbs |
| `rocks2-rock-084` | `pebble_c` | `rock` | `sprites/rocks2/rocks2-rock-084.png` | 1001,905,17,16 | 2,15 | y | Single pebble |
| `rocks2-terrain-067` | `rubble_overlay_a` | `terrain` | `sprites/rocks2/rocks2-terrain-067.png` | 64,958,83,34 | 0,0 |  | Rubble and dirt overlay strip |
| `rocks2-terrain-068` | `pebble_patch_round_tl` | `terrain` | `sprites/rocks2/rocks2-terrain-068.png` | 864,928,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: top-left corner |
| `rocks2-terrain-069` | `pebble_patch_round_t` | `terrain` | `sprites/rocks2/rocks2-terrain-069.png` | 896,928,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: top edge |
| `rocks2-terrain-070` | `pebble_patch_round_tr` | `terrain` | `sprites/rocks2/rocks2-terrain-070.png` | 928,928,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: top-right corner |
| `rocks2-terrain-071` | `pebble_patch_round_l` | `terrain` | `sprites/rocks2/rocks2-terrain-071.png` | 864,960,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: left edge |
| `rocks2-terrain-072` | `pebble_patch_round_c` | `terrain` | `sprites/rocks2/rocks2-terrain-072.png` | 896,960,32,32 | 0,0 |  | Pebble ground with loose-pebble edge: fill |
| `rocks2-terrain-073` | `pebble_patch_round_r` | `terrain` | `sprites/rocks2/rocks2-terrain-073.png` | 928,960,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: right edge |
| `rocks2-terrain-074` | `pebble_patch_round_bl` | `terrain` | `sprites/rocks2/rocks2-terrain-074.png` | 864,992,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: bottom-left corner |
| `rocks2-terrain-075` | `pebble_patch_round_b` | `terrain` | `sprites/rocks2/rocks2-terrain-075.png` | 896,992,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: bottom edge |
| `rocks2-terrain-076` | `pebble_patch_round_br` | `terrain` | `sprites/rocks2/rocks2-terrain-076.png` | 928,992,32,32 | 0,0 | y | Pebble ground with loose-pebble edge: bottom-right corner |
| `rocks2-terrain-077` | `pebble_tile_hole` | `terrain` | `sprites/rocks2/rocks2-terrain-077.png` | 960,928,64,64 | 0,0 | y | Pebble ground tile with hole |
| `rocks2-terrain-078` | `rubble_overlay_c` | `terrain` | `sprites/rocks2/rocks2-terrain-078.png` | 964,992,60,32 | 0,0 |  | Rubble and dirt overlay strip |

### beach — `ZRPGBeach.png`

| ID | Name | Class | File | src x,y,w,h | anchor | S | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `beach-prop-001` | `shell_spiral` | `prop` | `sprites/beach/beach-prop-001.png` | 12,6,14,17 | 6,17 |  | Yellow spiral shell |
| `beach-prop-002` | `starfish_red_large` | `prop` | `sprites/beach/beach-prop-002.png` | 35,2,28,29 | 14,28 | y | Large red starfish |
| `beach-prop-003` | `shell_yellow_a` | `prop` | `sprites/beach/beach-prop-003.png` | 66,37,14,16 | 5,15 |  | Yellow scallop shell |
| `beach-prop-004` | `shell_yellow_large` | `prop` | `sprites/beach/beach-prop-004.png` | 72,6,21,22 | 8,21 | y | Large yellow scallop shell |
| `beach-prop-005` | `shell_white_a` | `prop` | `sprites/beach/beach-prop-005.png` | 107,36,16,11 | 8,10 | y | White shell |
| `beach-prop-006` | `shell_white_b` | `prop` | `sprites/beach/beach-prop-006.png` | 111,2,14,14 | 5,13 | y | White shell |
| `beach-prop-007` | `shell_pink_long` | `prop` | `sprites/beach/beach-prop-007.png` | 136,9,13,15 | 9,15 |  | Long pink shell |
| `beach-bush-001` | `fern_dark` | `bush` | `sprites/beach/beach-bush-001.png` | 160,0,32,32 | 17,32 | y | Dark green fern |
| `beach-bush-002` | `dry_shrub` | `bush` | `sprites/beach/beach-bush-002.png` | 192,1,32,31 | 17,31 | y | Dry white twig shrub |
| `beach-bush-003` | `barrel_cactus_dark` | `bush` | `sprites/beach/beach-bush-003.png` | 224,1,31,31 | 15,30 | y | Dark barrel cactus |
| `beach-bush-004` | `cactus_sprouts_flower` | `bush` | `sprites/beach/beach-bush-004.png` | 225,33,62,31 | 30,30 | y | Pair of small cactus sprouts with pink flower |
| `beach-bush-005` | `barrel_cactus_light` | `bush` | `sprites/beach/beach-bush-005.png` | 257,1,30,31 | 15,31 |  | Light green barrel cactus |
| `beach-bush-006` | `cactus_column_light_small` | `bush` | `sprites/beach/beach-bush-006.png` | 299,0,12,32 | 5,31 | y | Small light-green column cactus |
| `beach-bush-007` | `cactus_column_dark_small` | `bush` | `sprites/beach/beach-bush-007.png` | 299,32,12,32 | 5,31 | y | Small dark column cactus |
| `beach-bush-008` | `saguaro_light` | `bush` | `sprites/beach/beach-bush-008.png` | 321,0,104,127 | 31,127 | y | Large light-green saguaro cactus with shadow |
| `beach-bush-009` | `saguaro_mid` | `bush` | `sprites/beach/beach-bush-009.png` | 449,0,104,127 | 31,127 | y | Large mid-green saguaro cactus with shadow |
| `beach-bush-010` | `saguaro_dark` | `bush` | `sprites/beach/beach-bush-010.png` | 577,0,104,127 | 31,127 | y | Large dark-green saguaro cactus with shadow |
| `beach-tree-001` | `palm_tall_a` | `tree` | `sprites/beach/beach-tree-001.png` | 708,0,143,157 | 55,157 | y | Tall palm tree with diagonal shadow |
| `beach-tree-002` | `palm_tall_b` | `tree` | `sprites/beach/beach-tree-002.png` | 873,0,138,157 | 28,157 | y | Tall palm tree with diagonal shadow |
| `beach-prop-008` | `shell_white_c` | `prop` | `sprites/beach/beach-prop-008.png` | 11,41,13,15 | 3,15 |  | White shell |
| `beach-prop-009` | `shell_white_d` | `prop` | `sprites/beach/beach-prop-009.png` | 11,76,14,15 | 6,14 |  | White clam shell |
| `beach-prop-010` | `shell_yellow_b` | `prop` | `sprites/beach/beach-prop-010.png` | 40,42,14,14 | 8,13 |  | Yellow scallop shell |
| `beach-prop-011` | `shell_yellow_long` | `prop` | `sprites/beach/beach-prop-011.png` | 43,75,13,15 | 3,15 |  | Long yellow shell |
| `beach-prop-012` | `starfish_red_small` | `prop` | `sprites/beach/beach-prop-012.png` | 74,74,16,16 | 7,15 |  | Small red starfish |
| `beach-prop-013` | `shell_yellow_c` | `prop` | `sprites/beach/beach-prop-013.png` | 79,48,14,16 | 8,15 |  | Yellow scallop shell |
| `beach-prop-014` | `shell_white_e` | `prop` | `sprites/beach/beach-prop-014.png` | 100,48,14,14 | 8,13 | y | White shell |
| `beach-prop-015` | `shell_pink_a` | `prop` | `sprites/beach/beach-prop-015.png` | 111,66,14,14 | 5,13 | y | Pink shell |
| `beach-prop-016` | `coral_red` | `prop` | `sprites/beach/beach-prop-016.png` | 131,69,25,23 | 12,22 | y | Red coral branch |
| `beach-prop-017` | `shell_pink_b` | `prop` | `sprites/beach/beach-prop-017.png` | 139,44,14,15 | 6,14 |  | Pink scallop shell |
| `beach-prop-018` | `starfish_yellow` | `prop` | `sprites/beach/beach-prop-018.png` | 164,71,16,16 | 8,15 |  | Yellow starfish |
| `beach-bush-011` | `cactus_column_light` | `bush` | `sprites/beach/beach-bush-011.png` | 197,66,22,58 | 11,58 |  | Light-green column cactus |
| `beach-bush-012` | `barrel_cactus_dark_b` | `bush` | `sprites/beach/beach-bush-012.png` | 224,66,30,30 | 15,29 | y | Dark barrel cactus |
| `beach-bush-013` | `barrel_cactus_dark_flower` | `bush` | `sprites/beach/beach-bush-013.png` | 256,65,30,31 | 15,30 | y | Dark barrel cactus with pink flower |
| `beach-bush-014` | `cactus_cluster_flower` | `bush` | `sprites/beach/beach-bush-014.png` | 289,64,31,32 | 20,32 | y | Cactus cluster with pink flower |
| `beach-prop-019` | `shell_nautilus` | `prop` | `sprites/beach/beach-prop-019.png` | 12,107,14,17 | 7,17 |  | Nautilus shell |
| `beach-prop-020` | `sand_dollar_small` | `prop` | `sprites/beach/beach-prop-020.png` | 43,107,14,15 | 6,14 |  | Small sand dollar |
| `beach-prop-021` | `sand_dollar_large` | `prop` | `sprites/beach/beach-prop-021.png` | 73,105,19,20 | 8,19 | y | Large sand dollar |
| `beach-prop-022` | `shell_conch` | `prop` | `sprites/beach/beach-prop-022.png` | 103,83,16,11 | 7,10 | y | Pink conch shell |
| `beach-prop-023` | `shell_pink_c` | `prop` | `sprites/beach/beach-prop-023.png` | 110,112,14,14 | 5,13 | y | Pink shell |
| `beach-prop-024` | `coral_white` | `prop` | `sprites/beach/beach-prop-024.png` | 132,101,25,23 | 12,22 | y | White dry coral branch |
| `beach-bush-015` | `barrel_cactus_green` | `bush` | `sprites/beach/beach-bush-015.png` | 224,98,30,30 | 15,29 | y | Green barrel cactus |
| `beach-bush-016` | `barrel_cactus_green_flower` | `bush` | `sprites/beach/beach-bush-016.png` | 256,98,30,30 | 15,29 | y | Green barrel cactus with pink flower |
| `beach-bush-017` | `cactus_column_dark` | `bush` | `sprites/beach/beach-bush-017.png` | 5,130,22,58 | 11,58 |  | Dark column cactus |
| `beach-bush-018` | `cactus_column_green` | `bush` | `sprites/beach/beach-bush-018.png` | 37,130,22,58 | 11,58 |  | Green column cactus |
| `beach-bush-019` | `saguaro_small_a` | `bush` | `sprites/beach/beach-bush-019.png` | 65,128,29,64 | 14,63 | y | Small saguaro cactus |
| `beach-bush-020` | `saguaro_small_b` | `bush` | `sprites/beach/beach-bush-020.png` | 97,128,29,64 | 15,63 | y | Small saguaro cactus |
| `beach-bush-021` | `prickly_pear` | `bush` | `sprites/beach/beach-bush-021.png` | 141,131,48,60 | 20,58 | y | Prickly pear cactus |
| `beach-bush-022` | `palm_shrub_a` | `bush` | `sprites/beach/beach-bush-022.png` | 517,135,64,44 | 35,42 | y | Low palm-frond shrub with shadow |
| `beach-bush-023` | `palm_shrub_b` | `bush` | `sprites/beach/beach-bush-023.png` | 611,145,66,45 | 19,42 | y | Low palm-frond shrub with shadow |
| `beach-bush-024` | `cactus_blob_dark` | `bush` | `sprites/beach/beach-bush-024.png` | 6,196,16,27 | 7,27 |  | Dark round stacked cactus |
| `beach-bush-025` | `cactus_stacked` | `bush` | `sprites/beach/beach-bush-025.png` | 33,192,31,64 | 10,64 | y | Stacked dark/light round cactus |
| `beach-bush-026` | `saguaro_small_dark_a` | `bush` | `sprites/beach/beach-bush-026.png` | 66,192,29,64 | 14,63 | y | Small dark saguaro cactus |
| `beach-bush-027` | `saguaro_small_dark_b` | `bush` | `sprites/beach/beach-bush-027.png` | 98,192,29,64 | 15,63 | y | Small dark saguaro cactus |
| `beach-bush-028` | `prickly_pear_dark` | `bush` | `sprites/beach/beach-bush-028.png` | 131,195,53,60 | 32,58 | y | Dark prickly pear cactus |
| `beach-tree-003` | `palm_a` | `tree` | `sprites/beach/beach-tree-003.png` | 548,192,134,123 | 55,123 | y | Palm tree with shadow |
| `beach-tree-004` | `palm_bananas_a` | `tree` | `sprites/beach/beach-tree-004.png` | 708,160,143,157 | 55,157 | y | Tall palm tree with bananas and shadow |
| `beach-tree-005` | `palm_bananas_b` | `tree` | `sprites/beach/beach-tree-005.png` | 873,160,138,157 | 28,157 | y | Tall palm tree with bananas and shadow |
| `beach-bush-029` | `cactus_blob_green` | `bush` | `sprites/beach/beach-bush-029.png` | 5,228,18,28 | 9,27 | y | Green round stacked cactus |
| `beach-tree-006` | `gnarled_coastal_tree` | `tree` | `sprites/beach/beach-tree-006.png` | 9,265,101,108 | 52,108 |  | Gnarled coastal tree with twisted trunk |
| `beach-tree-007` | `dead_gnarled_tree` | `tree` | `sprites/beach/beach-tree-007.png` | 128,256,96,128 | 67,128 |  | Dead leafless gnarled tree |
| `beach-tree-008` | `leafy_tree` | `tree` | `sprites/beach/beach-tree-008.png` | 225,272,94,134 | 47,134 |  | Leafy deciduous tree |
| `beach-prop-025` | `fallen_dead_branch` | `prop` | `sprites/beach/beach-prop-025.png` | 352,258,128,94 | 12,94 |  | Fallen dead tree branch with shadow |
| `beach-prop-026` | `rib_arches` | `prop` | `sprites/beach/beach-prop-026.png` | 354,355,89,133 | 44,131 | y | Large fossil rib arches |
| `beach-tree-009` | `palm_bananas_c` | `tree` | `sprites/beach/beach-tree-009.png` | 580,320,134,123 | 55,123 | y | Palm tree with bananas and shadow |
| `beach-tree-010` | `palm_b` | `tree` | `sprites/beach/beach-tree-010.png` | 745,320,119,123 | 29,123 | y | Palm tree with shadow |
| `beach-tree-011` | `palm_bananas_d` | `tree` | `sprites/beach/beach-tree-011.png` | 873,320,119,123 | 29,123 | y | Palm tree with bananas and shadow |
| `beach-prop-027` | `cow_skull` | `prop` | `sprites/beach/beach-prop-027.png` | 71,388,80,52 | 41,51 | y | Horned cow skull |
| `beach-prop-028` | `tree_stump` | `prop` | `sprites/beach/beach-prop-028.png` | 172,385,47,31 | 23,31 |  | Broken tree stump |
| `beach-prop-029` | `ribcage` | `prop` | `sprites/beach/beach-prop-029.png` | 2,406,60,74 | 30,73 | y | Ribcage skeleton |
| `beach-prop-030` | `bone_fragment_a` | `prop` | `sprites/beach/beach-prop-030.png` | 35,423,9,9 | 2,8 |  | Small bone fragment |
| `beach-prop-031` | `bone_fragments_b` | `prop` | `sprites/beach/beach-prop-031.png` | 96,435,12,9 | 5,8 |  | Small bone fragments |
| `beach-prop-032` | `bone_a` | `prop` | `sprites/beach/beach-prop-032.png` | 163,422,24,26 | 20,24 | y | Bone |
| `beach-prop-033` | `bone_b` | `prop` | `sprites/beach/beach-prop-033.png` | 197,422,24,26 | 3,24 | y | Bone |
| `beach-prop-034` | `bone_ring_arch` | `prop` | `sprites/beach/beach-prop-034.png` | 258,419,89,93 | 44,91 | y | Circular bone archway |
| `beach-terrain-001` | `sand_ring_tile_tl` | `terrain` | `sprites/beach/beach-terrain-001.png` | 448,416,32,32 | 0,0 |  | Sand border around a hole (ring): top-left corner |
| `beach-terrain-002` | `sand_ring_tile_t` | `terrain` | `sprites/beach/beach-terrain-002.png` | 480,416,32,32 | 0,0 |  | Sand border around a hole (ring): top edge |
| `beach-terrain-003` | `sand_ring_tile_tr` | `terrain` | `sprites/beach/beach-terrain-003.png` | 512,416,32,32 | 0,0 |  | Sand border around a hole (ring): top-right corner |
| `beach-terrain-004` | `sand_ring_tile_l` | `terrain` | `sprites/beach/beach-terrain-004.png` | 448,448,32,32 | 0,0 |  | Sand border around a hole (ring): left edge |
| `beach-terrain-005` | `sand_ring_tile_r` | `terrain` | `sprites/beach/beach-terrain-005.png` | 512,448,32,32 | 0,0 |  | Sand border around a hole (ring): right edge |
| `beach-terrain-006` | `sand_ring_tile_bl` | `terrain` | `sprites/beach/beach-terrain-006.png` | 448,480,32,32 | 0,0 |  | Sand border around a hole (ring): bottom-left corner |
| `beach-terrain-007` | `sand_ring_tile_b` | `terrain` | `sprites/beach/beach-terrain-007.png` | 480,480,32,32 | 0,0 |  | Sand border around a hole (ring): bottom edge |
| `beach-terrain-008` | `sand_ring_tile_br` | `terrain` | `sprites/beach/beach-terrain-008.png` | 512,480,32,32 | 0,0 |  | Sand border around a hole (ring): bottom-right corner |
| `beach-terrain-009` | `sand_ring_small_tl` | `terrain` | `sprites/beach/beach-terrain-009.png` | 544,416,32,32 | 0,0 |  | Small sand disc in four quadrants: top-left corner |
| `beach-terrain-010` | `sand_ring_small_tr` | `terrain` | `sprites/beach/beach-terrain-010.png` | 576,416,32,32 | 0,0 |  | Small sand disc in four quadrants: top-right corner |
| `beach-terrain-011` | `sand_ring_small_bl` | `terrain` | `sprites/beach/beach-terrain-011.png` | 544,448,32,32 | 0,0 |  | Small sand disc in four quadrants: bottom-left corner |
| `beach-terrain-012` | `sand_ring_small_br` | `terrain` | `sprites/beach/beach-terrain-012.png` | 576,448,32,32 | 0,0 |  | Small sand disc in four quadrants: bottom-right corner |
| `beach-prop-035` | `animal_skull` | `prop` | `sprites/beach/beach-prop-035.png` | 65,452,60,58 | 11,55 | y | Animal skull |
| `beach-prop-036` | `long_bone` | `prop` | `sprites/beach/beach-prop-036.png` | 128,452,63,60 | 7,60 |  | Long curved bone |
| `beach-prop-037` | `bone_fragment_c` | `prop` | `sprites/beach/beach-prop-037.png` | 133,469,9,9 | 2,8 |  | Small bone fragment |
| `beach-prop-038` | `bone_fragment_d` | `prop` | `sprites/beach/beach-prop-038.png` | 137,452,7,8 | 3,7 |  | Small bone fragment |
| `beach-prop-039` | `bone_claws_a` | `prop` | `sprites/beach/beach-prop-039.png` | 194,451,28,61 | 18,60 | y | Bone claws pair |
| `beach-prop-040` | `bone_claws_b` | `prop` | `sprites/beach/beach-prop-040.png` | 227,451,27,61 | 8,60 | y | Bone claws pair |
| `beach-tree-012` | `palm_very_tall_a` | `tree` | `sprites/beach/beach-tree-012.png` | 644,467,164,202 | 58,202 | y | Very tall palm tree with long shadow |
| `beach-tree-013` | `palm_crown_bananas_a` | `tree` | `sprites/beach/beach-tree-013.png` | 740,467,83,109 | 56,109 |  | Palm crown with bananas (top segment, stack on a trunk) |
| `beach-tree-014` | `palm_very_tall_b` | `tree` | `sprites/beach/beach-tree-014.png` | 841,467,160,202 | 25,202 | y | Very tall palm tree with long shadow |
| `beach-tree-015` | `palm_crown_bananas_b` | `tree` | `sprites/beach/beach-tree-015.png` | 937,467,83,77 | 42,77 |  | Palm crown with bananas (top segment, stack on a trunk) |
| `beach-rock-001` | `pebble_a` | `rock` | `sprites/beach/beach-rock-001.png` | 3,512,8,6 | 3,5 |  | Small pebble |
| `beach-rock-002` | `pebble_pair` | `rock` | `sprites/beach/beach-rock-002.png` | 14,515,14,10 | 6,9 | y | Pebble pair |
| `beach-prop-041` | `bone_fragment_e` | `prop` | `sprites/beach/beach-prop-041.png` | 15,484,9,9 | 6,8 |  | Small bone fragment |
| `beach-prop-042` | `bone_fragments_f` | `prop` | `sprites/beach/beach-prop-042.png` | 29,491,19,17 | 6,16 |  | Scattered small bone fragments |
| `beach-prop-043` | `bone_fragment_g` | `prop` | `sprites/beach/beach-prop-043.png` | 31,480,13,12 | 8,11 |  | Small bone fragment |
| `beach-terrain-013` | `grass_patch_tile` | `terrain` | `sprites/beach/beach-terrain-013.png` | 320,512,192,64 | 0,0 |  | 192x64 bright grass terrain tile |
| `beach-rock-003` | `pebble_cluster` | `rock` | `sprites/beach/beach-rock-003.png` | 0,531,21,10 | 10,9 | y | Small pebble cluster |
| `beach-terrain-014` | `gravel_tile_crack` | `terrain` | `sprites/beach/beach-terrain-014.png` | 0,540,64,68 | 0,0 |  | Gravel tile with cracked hole |
| `beach-rock-004` | `pebble_b` | `rock` | `sprites/beach/beach-rock-004.png` | 8,524,9,5 | 4,4 |  | Small pebble |
| `beach-rock-005` | `pebble_c` | `rock` | `sprites/beach/beach-rock-005.png` | 22,527,8,5 | 3,4 |  | Small pebble |
| `beach-rock-006` | `pebble_d` | `rock` | `sprites/beach/beach-rock-006.png` | 41,532,7,5 | 2,4 |  | Small pebble |
| `beach-rock-007` | `pebble_e` | `rock` | `sprites/beach/beach-rock-007.png` | 45,521,13,10 | 5,9 | y | Small pebble |
| `beach-terrain-015` | `sand_tile_hole` | `terrain` | `sprites/beach/beach-terrain-015.png` | 64,544,64,64 | 0,0 |  | 64x64 sand tile with hole |
| `beach-terrain-016` | `sand_splat` | `terrain` | `sprites/beach/beach-terrain-016.png` | 139,552,48,51 | 0,0 |  | Sand splat decal |
| `beach-terrain-017` | `gravel_tile_hole` | `terrain` | `sprites/beach/beach-terrain-017.png` | 192,544,64,64 | 0,0 |  | 64x64 gravel tile with hole |
| `beach-terrain-018` | `gravel_splat` | `terrain` | `sprites/beach/beach-terrain-018.png` | 267,520,48,52 | 0,0 |  | Gravel splat decal |
| `beach-rock-008` | `pebble_f` | `rock` | `sprites/beach/beach-rock-008.png` | 32,573,9,6 | 4,5 |  | Small pebble |
| `beach-plant-001` | `tall_grass_wide` | `plant` | `sprites/beach/beach-plant-001.png` | 289,576,191,127 | 60,127 | y | Wide block of tall reeds with foreground tufts |
| `beach-plant-002` | `tall_grass_narrow` | `plant` | `sprites/beach/beach-plant-002.png` | 480,576,64,96 | 31,96 |  | Narrow tall reed block with gaps |
| `beach-plant-003` | `tall_grass_block` | `plant` | `sprites/beach/beach-plant-003.png` | 544,577,96,127 | 37,127 | y | Tall reed block |
| `beach-terrain-019` | `gravel_patch_tl` | `terrain` | `sprites/beach/beach-terrain-019.png` | 0,608,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top-left corner |
| `beach-terrain-020` | `gravel_patch_t` | `terrain` | `sprites/beach/beach-terrain-020.png` | 32,608,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top edge |
| `beach-terrain-021` | `gravel_patch_tr` | `terrain` | `sprites/beach/beach-terrain-021.png` | 64,608,32,32 | 0,0 | y | Gravel ground with loose-stone edge: top-right corner |
| `beach-terrain-022` | `gravel_patch_l` | `terrain` | `sprites/beach/beach-terrain-022.png` | 0,640,32,32 | 0,0 | y | Gravel ground with loose-stone edge: left edge |
| `beach-terrain-023` | `gravel_patch_c` | `terrain` | `sprites/beach/beach-terrain-023.png` | 32,640,32,32 | 0,0 |  | Gravel ground with loose-stone edge: fill |
| `beach-terrain-024` | `gravel_patch_r` | `terrain` | `sprites/beach/beach-terrain-024.png` | 64,640,32,32 | 0,0 |  | Gravel ground with loose-stone edge: right edge |
| `beach-terrain-025` | `gravel_patch_bl` | `terrain` | `sprites/beach/beach-terrain-025.png` | 0,672,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom-left corner |
| `beach-terrain-026` | `gravel_patch_b` | `terrain` | `sprites/beach/beach-terrain-026.png` | 32,672,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom edge |
| `beach-terrain-027` | `gravel_patch_br` | `terrain` | `sprites/beach/beach-terrain-027.png` | 64,672,32,32 | 0,0 | y | Gravel ground with loose-stone edge: bottom-right corner |
| `beach-terrain-028` | `sand_pit_square_tl` | `terrain` | `sprites/beach/beach-terrain-028.png` | 96,608,32,32 | 0,0 |  | Sand border around a square hole: top-left corner |
| `beach-terrain-029` | `sand_pit_square_t` | `terrain` | `sprites/beach/beach-terrain-029.png` | 128,608,32,32 | 0,0 |  | Sand border around a square hole: top edge |
| `beach-terrain-030` | `sand_pit_square_tr` | `terrain` | `sprites/beach/beach-terrain-030.png` | 160,608,32,32 | 0,0 |  | Sand border around a square hole: top-right corner |
| `beach-terrain-031` | `sand_pit_square_l` | `terrain` | `sprites/beach/beach-terrain-031.png` | 96,640,32,32 | 0,0 |  | Sand border around a square hole: left edge |
| `beach-terrain-032` | `sand_pit_square_r` | `terrain` | `sprites/beach/beach-terrain-032.png` | 160,640,32,32 | 0,0 |  | Sand border around a square hole: right edge |
| `beach-terrain-033` | `sand_pit_square_bl` | `terrain` | `sprites/beach/beach-terrain-033.png` | 96,672,32,32 | 0,0 |  | Sand border around a square hole: bottom-left corner |
| `beach-terrain-034` | `sand_pit_square_b` | `terrain` | `sprites/beach/beach-terrain-034.png` | 128,672,32,32 | 0,0 |  | Sand border around a square hole: bottom edge |
| `beach-terrain-035` | `sand_pit_square_br` | `terrain` | `sprites/beach/beach-terrain-035.png` | 160,672,32,32 | 0,0 |  | Sand border around a square hole: bottom-right corner |
| `beach-terrain-036` | `gravel_pit_tl` | `terrain` | `sprites/beach/beach-terrain-036.png` | 192,608,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: top-left corner |
| `beach-terrain-037` | `gravel_pit_t` | `terrain` | `sprites/beach/beach-terrain-037.png` | 224,608,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: top edge |
| `beach-terrain-038` | `gravel_pit_tr` | `terrain` | `sprites/beach/beach-terrain-038.png` | 256,608,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: top-right corner |
| `beach-terrain-039` | `gravel_pit_l` | `terrain` | `sprites/beach/beach-terrain-039.png` | 192,640,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: left edge |
| `beach-terrain-040` | `gravel_pit_c` | `terrain` | `sprites/beach/beach-terrain-040.png` | 224,640,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: fill |
| `beach-terrain-041` | `gravel_pit_r` | `terrain` | `sprites/beach/beach-terrain-041.png` | 256,640,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: right edge |
| `beach-terrain-042` | `gravel_pit_bl` | `terrain` | `sprites/beach/beach-terrain-042.png` | 192,672,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: bottom-left corner |
| `beach-terrain-043` | `gravel_pit_b` | `terrain` | `sprites/beach/beach-terrain-043.png` | 224,672,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: bottom edge |
| `beach-terrain-044` | `gravel_pit_br` | `terrain` | `sprites/beach/beach-terrain-044.png` | 256,672,32,32 | 0,0 |  | Gravel ground with sandy ragged edge: bottom-right corner |
| `beach-plant-004` | `grass_sprig_a` | `plant` | `sprites/beach/beach-plant-004.png` | 469,678,11,7 | 4,6 |  | Small grass sprig |
| `beach-tree-016` | `palm_trunk_a` | `tree` | `sprites/beach/beach-tree-016.png` | 693,672,116,125 | 9,125 | y | Palm trunk segment with shadow (stack under a crown) |
| `beach-tree-017` | `palm_trunk_b` | `tree` | `sprites/beach/beach-tree-017.png` | 858,672,143,125 | 8,125 | y | Palm trunk segment with shadow (stack under a crown) |
| `beach-rock-009` | `pebble_g` | `rock` | `sprites/beach/beach-rock-009.png` | 12,718,8,6 | 3,6 |  | Small pebble |
| `beach-terrain-045` | `sand_tile_pit_a` | `terrain` | `sprites/beach/beach-terrain-045.png` | 30,704,66,68 | 0,0 |  | Sand tile with pit |
| `beach-rock-010` | `pebble_h` | `rock` | `sprites/beach/beach-rock-010.png` | 107,717,10,8 | 4,8 |  | Small pebble |
| `beach-terrain-046` | `sand_tile_pit_b` | `terrain` | `sprites/beach/beach-terrain-046.png` | 128,704,64,64 | 0,0 |  | Sand tile with pit |
| `beach-rock-011` | `pebble_i` | `rock` | `sprites/beach/beach-rock-011.png` | 204,718,8,6 | 3,6 |  | Small pebble |
| `beach-terrain-047` | `sand_tile_pit_c` | `terrain` | `sprites/beach/beach-terrain-047.png` | 222,704,66,68 | 0,0 |  | Sand tile with pit |
| `beach-plant-005` | `grass_sprig_b` | `plant` | `sprites/beach/beach-plant-005.png` | 298,692,10,9 | 5,9 |  | Small grass sprig |
| `beach-rock-012` | `pebble_j` | `rock` | `sprites/beach/beach-rock-012.png` | 299,717,10,8 | 4,8 |  | Small pebble |
| `beach-terrain-048` | `sand_tile_pit_d` | `terrain` | `sprites/beach/beach-terrain-048.png` | 320,703,64,65 | 0,0 |  | Sand tile with pit |
| `beach-plant-006` | `grass_sprig_c` | `plant` | `sprites/beach/beach-plant-006.png` | 388,714,13,15 | 7,15 |  | Small grass sprig |
| `beach-plant-007` | `grass_sprig_d` | `plant` | `sprites/beach/beach-plant-007.png` | 404,711,8,12 | 4,12 |  | Small grass sprig |
| `beach-plant-008` | `grass_sprig_e` | `plant` | `sprites/beach/beach-plant-008.png` | 425,708,11,7 | 5,7 |  | Small grass sprig |
| `beach-plant-009` | `grass_sprig_f` | `plant` | `sprites/beach/beach-plant-009.png` | 441,691,6,7 | 1,6 |  | Small grass sprig |
| `beach-plant-010` | `grass_sprig_g` | `plant` | `sprites/beach/beach-plant-010.png` | 452,691,20,12 | 13,11 | y | Small grass sprigs |
| `beach-tree-018` | `palm_leaning` | `tree` | `sprites/beach/beach-tree-018.png` | 564,717,108,107 | 14,107 | y | Leaning palm tree with shadow |
| `beach-terrain-049` | `sand_clump_a` | `terrain` | `sprites/beach/beach-terrain-049.png` | 5,740,23,23 | 0,0 |  | Sand clump decal |
| `beach-terrain-050` | `sand_clump_b` | `terrain` | `sprites/beach/beach-terrain-050.png` | 100,739,25,25 | 0,0 |  | Sand clump decal |
| `beach-terrain-051` | `sand_clump_c` | `terrain` | `sprites/beach/beach-terrain-051.png` | 197,740,23,23 | 0,0 |  | Sand clump decal |
| `beach-terrain-052` | `sand_clump_d` | `terrain` | `sprites/beach/beach-terrain-052.png` | 292,739,25,25 | 0,0 |  | Sand clump decal |
| `beach-plant-011` | `grass_sprig_h` | `plant` | `sprites/beach/beach-plant-011.png` | 387,741,12,10 | 6,10 |  | Small grass sprig |
| `beach-plant-012` | `grass_sprig_i` | `plant` | `sprites/beach/beach-plant-012.png` | 402,755,12,9 | 6,9 |  | Small grass sprig |
| `beach-plant-013` | `agave_a` | `plant` | `sprites/beach/beach-plant-013.png` | 416,743,28,25 | 13,24 | y | Agave plant |
| `beach-plant-014` | `grass_sprig_j` | `plant` | `sprites/beach/beach-plant-014.png` | 422,726,6,7 | 3,7 |  | Small grass sprig |
| `beach-bush-030` | `cactus_tall_arms` | `bush` | `sprites/beach/beach-bush-030.png` | 454,738,58,87 | 28,86 | y | Tall cactus with arms and shadow |
| `beach-terrain-053` | `sand_pit_dark_large_tl` | `terrain` | `sprites/beach/beach-terrain-053.png` | 0,768,32,32 | 0,0 |  | Sand ground with dark raised rim: top-left corner |
| `beach-terrain-054` | `sand_pit_dark_large_t` | `terrain` | `sprites/beach/beach-terrain-054.png` | 32,768,32,32 | 0,0 |  | Sand ground with dark raised rim: top edge |
| `beach-terrain-055` | `sand_pit_dark_large_tr` | `terrain` | `sprites/beach/beach-terrain-055.png` | 64,768,32,32 | 0,0 |  | Sand ground with dark raised rim: top-right corner |
| `beach-terrain-056` | `sand_pit_dark_large_l` | `terrain` | `sprites/beach/beach-terrain-056.png` | 0,800,32,32 | 0,0 |  | Sand ground with dark raised rim: left edge |
| `beach-terrain-057` | `sand_pit_dark_large_c` | `terrain` | `sprites/beach/beach-terrain-057.png` | 32,800,32,32 | 0,0 |  | Sand ground with dark raised rim: fill |
| `beach-terrain-058` | `sand_pit_dark_large_r` | `terrain` | `sprites/beach/beach-terrain-058.png` | 64,800,32,32 | 0,0 |  | Sand ground with dark raised rim: right edge |
| `beach-terrain-059` | `sand_pit_dark_large_bl` | `terrain` | `sprites/beach/beach-terrain-059.png` | 0,832,32,32 | 0,0 |  | Sand ground with dark raised rim: bottom-left corner |
| `beach-terrain-060` | `sand_pit_dark_large_b` | `terrain` | `sprites/beach/beach-terrain-060.png` | 32,832,32,32 | 0,0 |  | Sand ground with dark raised rim: bottom edge |
| `beach-terrain-061` | `sand_pit_dark_large_br` | `terrain` | `sprites/beach/beach-terrain-061.png` | 64,832,32,32 | 0,0 |  | Sand ground with dark raised rim: bottom-right corner |
| `beach-terrain-062` | `sand_pit_light_small_tl` | `terrain` | `sprites/beach/beach-terrain-062.png` | 96,768,32,32 | 0,0 |  | Sand ground with light rim: top-left corner |
| `beach-terrain-063` | `sand_pit_light_small_t` | `terrain` | `sprites/beach/beach-terrain-063.png` | 128,768,32,32 | 0,0 |  | Sand ground with light rim: top edge |
| `beach-terrain-064` | `sand_pit_light_small_tr` | `terrain` | `sprites/beach/beach-terrain-064.png` | 160,768,32,32 | 0,0 |  | Sand ground with light rim: top-right corner |
| `beach-terrain-065` | `sand_pit_light_small_l` | `terrain` | `sprites/beach/beach-terrain-065.png` | 96,800,32,32 | 0,0 |  | Sand ground with light rim: left edge |
| `beach-terrain-066` | `sand_pit_light_small_c` | `terrain` | `sprites/beach/beach-terrain-066.png` | 128,800,32,32 | 0,0 |  | Sand ground with light rim: fill |
| `beach-terrain-067` | `sand_pit_light_small_r` | `terrain` | `sprites/beach/beach-terrain-067.png` | 160,800,32,32 | 0,0 |  | Sand ground with light rim: right edge |
| `beach-terrain-068` | `sand_pit_light_small_bl` | `terrain` | `sprites/beach/beach-terrain-068.png` | 96,832,32,32 | 0,0 |  | Sand ground with light rim: bottom-left corner |
| `beach-terrain-069` | `sand_pit_light_small_b` | `terrain` | `sprites/beach/beach-terrain-069.png` | 128,832,32,32 | 0,0 |  | Sand ground with light rim: bottom edge |
| `beach-terrain-070` | `sand_pit_light_small_br` | `terrain` | `sprites/beach/beach-terrain-070.png` | 160,832,32,32 | 0,0 |  | Sand ground with light rim: bottom-right corner |
| `beach-terrain-071` | `sand_pit_dark_b_tl` | `terrain` | `sprites/beach/beach-terrain-071.png` | 192,768,32,32 | 0,0 |  | Golden sand ground with dark raised rim: top-left corner |
| `beach-terrain-072` | `sand_pit_dark_b_t` | `terrain` | `sprites/beach/beach-terrain-072.png` | 224,768,32,32 | 0,0 |  | Golden sand ground with dark raised rim: top edge |
| `beach-terrain-073` | `sand_pit_dark_b_tr` | `terrain` | `sprites/beach/beach-terrain-073.png` | 256,768,32,32 | 0,0 |  | Golden sand ground with dark raised rim: top-right corner |
| `beach-terrain-074` | `sand_pit_dark_b_l` | `terrain` | `sprites/beach/beach-terrain-074.png` | 192,800,32,32 | 0,0 |  | Golden sand ground with dark raised rim: left edge |
| `beach-terrain-075` | `sand_pit_dark_b_c` | `terrain` | `sprites/beach/beach-terrain-075.png` | 224,800,32,32 | 0,0 |  | Golden sand ground with dark raised rim: fill |
| `beach-terrain-076` | `sand_pit_dark_b_r` | `terrain` | `sprites/beach/beach-terrain-076.png` | 256,800,32,32 | 0,0 |  | Golden sand ground with dark raised rim: right edge |
| `beach-terrain-077` | `sand_pit_dark_b_bl` | `terrain` | `sprites/beach/beach-terrain-077.png` | 192,832,32,32 | 0,0 |  | Golden sand ground with dark raised rim: bottom-left corner |
| `beach-terrain-078` | `sand_pit_dark_b_b` | `terrain` | `sprites/beach/beach-terrain-078.png` | 224,832,32,32 | 0,0 |  | Golden sand ground with dark raised rim: bottom edge |
| `beach-terrain-079` | `sand_pit_dark_b_br` | `terrain` | `sprites/beach/beach-terrain-079.png` | 256,832,32,32 | 0,0 |  | Golden sand ground with dark raised rim: bottom-right corner |
| `beach-terrain-080` | `sand_pit_light_b` | `terrain` | `sprites/beach/beach-terrain-080.png` | 302,783,68,70 | 0,0 |  | Sand pit, light rim |
| `beach-plant-015` | `grass_tuft_tall` | `plant` | `sprites/beach/beach-plant-015.png` | 390,775,25,52 | 11,51 | y | Tall grass tuft |
| `beach-plant-016` | `agave_b` | `plant` | `sprites/beach/beach-plant-016.png` | 419,768,29,25 | 13,24 | y | Agave plant |
| `beach-terrain-081` | `sand_crater_a` | `terrain` | `sprites/beach/beach-terrain-081.png` | 384,835,96,89 | 0,0 |  | Sand crater with stone well rim |
| `beach-plant-017` | `spiky_plant` | `plant` | `sprites/beach/beach-plant-017.png` | 426,800,22,28 | 8,27 | y | Spiky green-blue plant |
| `beach-rock-013` | `sand_pebbles_set_a` | `rock` | `sprites/beach/beach-rock-013.png` | 485,837,49,57 | 29,57 |  | Set of small sand pebbles |
| `beach-tree-019` | `palm_c` | `tree` | `sprites/beach/beach-tree-019.png` | 740,821,156,139 | 68,139 | y | Palm tree with shadow |
| `beach-tree-020` | `palm_d` | `tree` | `sprites/beach/beach-tree-020.png` | 897,821,127,139 | 22,139 | y | Palm tree with shadow |
| `beach-terrain-082` | `sand_strip_a` | `terrain` | `sprites/beach/beach-terrain-082.png` | 0,864,101,32 | 0,0 |  | Sand strip tile |
| `beach-rock-014` | `sand_crumbs` | `rock` | `sprites/beach/beach-rock-014.png` | 98,866,58,27 | 16,27 |  | Sand crumbs |
| `beach-terrain-083` | `sand_strip_b` | `terrain` | `sprites/beach/beach-terrain-083.png` | 192,864,96,32 | 0,0 |  | Sand strip tile |
| `beach-tree-021` | `palm_e` | `tree` | `sprites/beach/beach-tree-021.png` | 599,844,137,107 | 69,107 | y | Palm tree with shadow |
| `beach-rock-015` | `sand_dune_a_left` | `rock` | `sprites/beach/beach-rock-015.png` | 0,918,97,106 | 37,106 |  | Curved sand dune, left half of a dune arch (pairs with sand_dune_a_right) |
| `beach-rock-016` | `sand_dune_a_right` | `rock` | `sprites/beach/beach-rock-016.png` | 96,918,96,106 | 56,106 |  | Curved sand dune, right half of a dune arch (pairs with sand_dune_a_left) |
| `beach-rock-017` | `sand_dune_b_left` | `rock` | `sprites/beach/beach-rock-017.png` | 192,918,97,106 | 37,106 |  | Curved sand dune, left half of a dune arch (pairs with sand_dune_b_right) |
| `beach-rock-018` | `sand_dune_b_right` | `rock` | `sprites/beach/beach-rock-018.png` | 288,918,95,106 | 56,106 |  | Curved sand dune, right half of a dune arch (pairs with sand_dune_b_left) |
| `beach-terrain-084` | `sand_ripples_a` | `terrain` | `sprites/beach/beach-terrain-084.png` | 481,896,63,65 | 0,0 |  | Group of sand ripples decal |
| `beach-terrain-085` | `sand_crater_b` | `terrain` | `sprites/beach/beach-terrain-085.png` | 383,931,97,89 | 0,0 |  | Sand crater with stone well rim |
| `beach-terrain-086` | `sand_crater_small_a` | `terrain` | `sprites/beach/beach-terrain-086.png` | 96,992,32,32 | 0,0 |  | 32x32 small sand crater decal |
| `beach-terrain-087` | `sand_crater_small_b` | `terrain` | `sprites/beach/beach-terrain-087.png` | 288,992,32,32 | 0,0 |  | 32x32 small sand crater decal |
| `beach-terrain-088` | `sand_ripples_b` | `terrain` | `sprites/beach/beach-terrain-088.png` | 481,960,63,64 | 0,0 |  | Group of sand ripples decal |
| `beach-terrain-089` | `sand_ripple_tile_a` | `terrain` | `sprites/beach/beach-terrain-089.png` | 545,960,63,64 | 0,0 |  | Sand ripple decal tile |
| `beach-terrain-090` | `sand_ripple_tile_b` | `terrain` | `sprites/beach/beach-terrain-090.png` | 609,960,63,64 | 0,0 |  | Sand ripple decal tile |
| `beach-rock-019` | `sand_pebbles_set_b` | `rock` | `sprites/beach/beach-rock-019.png` | 677,965,49,57 | 29,57 |  | Set of small sand pebbles |

### jungle — `ZRPGJunglePlants.png`

| ID | Name | Class | File | src x,y,w,h | anchor | S | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `jungle-bush-001` | `broadleaf_plant_small` | `bush` | `sprites/jungle/jungle-bush-001.png` | 15,19,45,45 | 22,45 |  | Small green broad-leaf plant |
| `jungle-bush-002` | `jungle_bush_dense` | `bush` | `sprites/jungle/jungle-bush-002.png` | 74,15,48,44 | 28,44 |  | Dense tropical jungle bush |
| `jungle-bush-003` | `leaf_canopy_wide` | `bush` | `sprites/jungle/jungle-bush-003.png` | 133,24,59,26 | 36,26 |  | Wide horizontal leaf canopy |
| `jungle-bush-004` | `leaf_sprout_curved` | `bush` | `sprites/jungle/jungle-bush-004.png` | 202,22,49,36 | 41,36 |  | Curved tropical leaf sprout |
| `jungle-plant-001` | `purple_pitcher_plant` | `plant` | `sprites/jungle/jungle-plant-001.png` | 256,2,64,62 | 36,62 |  | Dark purple pitcher plant with coiled tendril |
| `jungle-plant-002` | `purple_spiky_alien` | `plant` | `sprites/jungle/jungle-plant-002.png` | 320,5,64,59 | 33,59 |  | Alien purple bulbous spiky plant |
| `jungle-plant-003` | `purple_trumpet_flower` | `plant` | `sprites/jungle/jungle-plant-003.png` | 385,2,63,62 | 34,62 |  | Large purple trumpet flower |
| `jungle-plant-004` | `purple_alien_pod` | `plant` | `sprites/jungle/jungle-plant-004.png` | 448,3,63,61 | 30,61 |  | Bulbous purple alien pod |
| `jungle-bush-005` | `broadleaf_plant_large` | `bush` | `sprites/jungle/jungle-bush-005.png` | 64,72,64,56 | 33,56 |  | Large light-green broad-leaf plant |
| `jungle-bush-006` | `jagged_foliage_bush` | `bush` | `sprites/jungle/jungle-bush-006.png` | 128,70,63,58 | 37,58 |  | Wide jagged green foliage bush |
| `jungle-bush-007` | `tropical_leaf_plant_dark` | `bush` | `sprites/jungle/jungle-bush-007.png` | 191,68,65,60 | 34,60 |  | Tropical leaf plant with dark base |
| `jungle-plant-005` | `heliconia_stalk` | `plant` | `sprites/jungle/jungle-plant-005.png` | 331,64,40,64 | 23,64 |  | Heliconia (lobster claw) flower stalk |
| `jungle-plant-006` | `red_yellow_flower_stalk` | `plant` | `sprites/jungle/jungle-plant-006.png` | 460,67,40,61 | 18,61 |  | Red-and-yellow flower stalk |
| `jungle-bush-008` | `fern_low` | `bush` | `sprites/jungle/jungle-bush-008.png` | 4,86,58,42 | 26,42 |  | Low green jungle fern |
| `jungle-plant-007` | `red_seed_pod_cluster` | `plant` | `sprites/jungle/jungle-plant-007.png` | 256,88,64,40 | 37,40 |  | Red/orange tropical seed pod cluster |
| `jungle-plant-008` | `red_pod_shoot` | `plant` | `sprites/jungle/jungle-plant-008.png` | 397,89,40,39 | 19,39 |  | Small red tropical pod shoot |
| `jungle-bush-009` | `hanging_vine_left` | `bush` | `sprites/jungle/jungle-bush-009.png` | 3,147,55,34 | 26,34 |  | Hanging leafy vine |
| `jungle-bush-010` | `hanging_vine_center` | `bush` | `sprites/jungle/jungle-bush-010.png` | 72,146,45,38 | 39,38 |  | Hanging leafy vine |
| `jungle-bush-011` | `drooping_palm_leaf` | `bush` | `sprites/jungle/jungle-bush-011.png` | 143,153,31,50 | 21,50 |  | Drooping single palm leaf |
| `jungle-bush-012` | `curved_hanging_leaf` | `bush` | `sprites/jungle/jungle-bush-012.png` | 196,139,47,44 | 1,44 |  | Curved hanging foliage leaf |
| `jungle-bush-013` | `dark_frond_bush_1` | `bush` | `sprites/jungle/jungle-bush-013.png` | 256,142,64,82 | 29,82 |  | Dark shadowed palm-leaf bush |
| `jungle-bush-014` | `dark_frond_bush_2` | `bush` | `sprites/jungle/jungle-bush-014.png` | 321,137,63,87 | 27,87 |  | Dark shadowed palm-leaf bush |
| `jungle-bush-015` | `dark_frond_bush_3` | `bush` | `sprites/jungle/jungle-bush-015.png` | 384,142,64,82 | 26,82 |  | Dark shadowed palm-leaf bush |
| `jungle-bush-016` | `dark_frond_bush_4` | `bush` | `sprites/jungle/jungle-bush-016.png` | 448,135,64,89 | 43,89 |  | Curved dark shadowed palm frond |
| `jungle-bush-017` | `canopy_overhang_upper` | `bush` | `sprites/jungle/jungle-bush-017.png` | 0,221,96,35 | 87,35 |  | Canopy foliage overhang (upper edge) |
| `jungle-plant-009` | `reed_orange_sheath` | `plant` | `sprites/jungle/jungle-plant-009.png` | 203,208,46,112 | 20,112 |  | Tall reed with orange flower sheath |
| `jungle-bush-018` | `leaf_shrub_red_flower` | `bush` | `sprites/jungle/jungle-bush-018.png` | 258,231,59,25 | 29,25 |  | Low leaf shrub with red flower |
| `jungle-plant-010` | `orange_carnivorous_pod` | `plant` | `sprites/jungle/jungle-plant-010.png` | 333,226,45,30 | 23,30 |  | Orange bulbous carnivorous pod |
| `jungle-bush-019` | `green_leafy_shoot` | `bush` | `sprites/jungle/jungle-bush-019.png` | 384,224,32,32 | 18,32 |  | Bright green leafy shoot |
| `jungle-prop-001` | `bee_hive` | `prop` | `sprites/jungle/jungle-prop-001.png` | 424,224,20,25 | 10,25 |  | Hanging bee hive |
| `jungle-prop-002` | `campfire_logs` | `prop` | `sprites/jungle/jungle-prop-002.png` | 454,235,52,24 | 25,24 |  | Stacked campfire wood logs |
| `jungle-bush-020` | `leaf_overhang_large` | `bush` | `sprites/jungle/jungle-bush-020.png` | 96,249,95,71 | 76,71 |  | Large sweeping green leaf overhang |
| `jungle-bush-021` | `broadleaf_plant_low` | `bush` | `sprites/jungle/jungle-bush-021.png` | 258,264,59,24 | 30,24 |  | Low broad-leaf plant |
| `jungle-plant-011` | `grass_blades` | `plant` | `sprites/jungle/jungle-plant-011.png` | 321,256,30,31 | 17,31 |  | Grass blades cluster |
| `jungle-plant-012` | `weed_sprout` | `plant` | `sprites/jungle/jungle-plant-012.png` | 354,257,22,31 | 11,31 |  | Small weed sprout |
| `jungle-bush-022` | `micro_leaf_sprout` | `bush` | `sprites/jungle/jungle-bush-022.png` | 389,272,22,16 | 11,16 |  | Small leaf sprout |
| `jungle-bush-023` | `canopy_overhang_lower` | `bush` | `sprites/jungle/jungle-bush-023.png` | 0,285,96,34 | 22,34 |  | Canopy foliage overhang (lower edge) |
| `jungle-prop-003` | `hollow_log` | `prop` | `sprites/jungle/jungle-prop-003.png` | 266,299,40,21 | 18,21 |  | Hollow log |
| `jungle-plant-013` | `red_mushroom_pair` | `plant` | `sprites/jungle/jungle-plant-013.png` | 331,308,14,12 | 7,12 |  | Tiny red mushroom pair |
| `jungle-plant-014` | `red_mushroom_cluster` | `plant` | `sprites/jungle/jungle-plant-014.png` | 356,298,27,22 | 14,22 |  | Red mushroom cluster |
| `jungle-plant-015` | `glowing_blue_bulb_plant` | `plant` | `sprites/jungle/jungle-plant-015.png` | 450,289,59,63 | 20,63 |  | Tall dark plant with glowing blue bulb |
| `jungle-prop-004` | `canvas_tent` | `prop` | `sprites/jungle/jungle-prop-004.png` | 8,342,112,73 | 53,73 |  | Canvas tent with wooden frame |
| `jungle-prop-005` | `skull_spear_banner` | `prop` | `sprites/jungle/jungle-prop-005.png` | 103,320,40,63 | 34,63 |  | Tribal skull on spear with red banner |
| `jungle-prop-006` | `oil_lantern_post` | `prop` | `sprites/jungle/jungle-prop-006.png` | 165,325,17,59 | 12,59 |  | Lit oil lantern on post |
| `jungle-plant-016` | `blue_flower` | `plant` | `sprites/jungle/jungle-plant-016.png` | 198,335,17,17 | 8,17 |  | Small blue flower |
| `jungle-plant-017` | `white_flower_sprout` | `plant` | `sprites/jungle/jungle-plant-017.png` | 231,333,21,19 | 10,19 |  | Small white flower sprout |
| `jungle-prop-007` | `hollow_log_mossy` | `prop` | `sprites/jungle/jungle-prop-007.png` | 266,331,40,21 | 18,21 |  | Hollow mossy log |
| `jungle-rock-001` | `crystal_node_blue` | `rock` | `sprites/jungle/jungle-rock-001.png` | 196,372,59,43 | 29,43 |  | Rock node with glowing blue crystals |
| `jungle-rock-002` | `crystal_node_green` | `rock` | `sprites/jungle/jungle-rock-002.png` | 260,372,59,43 | 29,43 |  | Rock node with glowing green crystals |
| `jungle-rock-003` | `crystal_node_pink` | `rock` | `sprites/jungle/jungle-rock-003.png` | 324,372,59,43 | 29,43 |  | Rock node with glowing pink crystals |
| `jungle-rock-004` | `ore_rock_orange` | `rock` | `sprites/jungle/jungle-rock-004.png` | 389,368,58,48 | 25,48 |  | Rock with orange ore deposits |
| `jungle-rock-005` | `crystal_node_corrupted` | `rock` | `sprites/jungle/jungle-rock-005.png` | 460,364,42,52 | 19,52 |  | Corrupted rock node with purple crystals |

### water — `ZRPGWater.png`

| ID | Name | Class | File | src x,y,w,h | anchor | S | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `water-water-001` | `water_frame_01` | `water` | `sprites/water/water-water-001.png` | 0,0,320,128 | 0,0 |  | Animated deep-water texture, frame 1 of 21 (tileable horizontally) |
| `water-water-002` | `water_frame_02` | `water` | `sprites/water/water-water-002.png` | 0,160,320,128 | 0,0 |  | Animated deep-water texture, frame 2 of 21 (tileable horizontally) |
| `water-water-003` | `water_frame_03` | `water` | `sprites/water/water-water-003.png` | 0,320,320,128 | 0,0 |  | Animated deep-water texture, frame 3 of 21 (tileable horizontally) |
| `water-water-004` | `water_frame_04` | `water` | `sprites/water/water-water-004.png` | 0,480,320,128 | 0,0 |  | Animated deep-water texture, frame 4 of 21 (tileable horizontally) |
| `water-water-005` | `water_frame_05` | `water` | `sprites/water/water-water-005.png` | 0,640,320,128 | 0,0 |  | Animated deep-water texture, frame 5 of 21 (tileable horizontally) |
| `water-water-006` | `water_frame_06` | `water` | `sprites/water/water-water-006.png` | 0,800,320,128 | 0,0 |  | Animated deep-water texture, frame 6 of 21 (tileable horizontally) |
| `water-water-007` | `water_frame_07` | `water` | `sprites/water/water-water-007.png` | 0,960,320,128 | 0,0 |  | Animated deep-water texture, frame 7 of 21 (tileable horizontally) |
| `water-water-008` | `water_frame_08` | `water` | `sprites/water/water-water-008.png` | 0,1120,320,128 | 0,0 |  | Animated deep-water texture, frame 8 of 21 (tileable horizontally) |
| `water-water-009` | `water_frame_09` | `water` | `sprites/water/water-water-009.png` | 0,1280,320,128 | 0,0 |  | Animated deep-water texture, frame 9 of 21 (tileable horizontally) |
| `water-water-010` | `water_frame_10` | `water` | `sprites/water/water-water-010.png` | 0,1440,320,128 | 0,0 |  | Animated deep-water texture, frame 10 of 21 (tileable horizontally) |
| `water-water-011` | `water_frame_11` | `water` | `sprites/water/water-water-011.png` | 0,1600,320,128 | 0,0 |  | Animated deep-water texture, frame 11 of 21 (tileable horizontally) |
| `water-water-012` | `water_frame_12` | `water` | `sprites/water/water-water-012.png` | 0,1760,320,128 | 0,0 |  | Animated deep-water texture, frame 12 of 21 (tileable horizontally) |
| `water-water-013` | `water_frame_13` | `water` | `sprites/water/water-water-013.png` | 0,1920,320,128 | 0,0 |  | Animated deep-water texture, frame 13 of 21 (tileable horizontally) |
| `water-water-014` | `water_frame_14` | `water` | `sprites/water/water-water-014.png` | 0,2080,320,128 | 0,0 |  | Animated deep-water texture, frame 14 of 21 (tileable horizontally) |
| `water-water-015` | `water_frame_15` | `water` | `sprites/water/water-water-015.png` | 0,2240,320,128 | 0,0 |  | Animated deep-water texture, frame 15 of 21 (tileable horizontally) |
| `water-water-016` | `water_frame_16` | `water` | `sprites/water/water-water-016.png` | 0,2400,320,128 | 0,0 |  | Animated deep-water texture, frame 16 of 21 (tileable horizontally) |
| `water-water-017` | `water_frame_17` | `water` | `sprites/water/water-water-017.png` | 0,2560,320,128 | 0,0 |  | Animated deep-water texture, frame 17 of 21 (tileable horizontally) |
| `water-water-018` | `water_frame_18` | `water` | `sprites/water/water-water-018.png` | 0,2720,320,128 | 0,0 |  | Animated deep-water texture, frame 18 of 21 (tileable horizontally) |
| `water-water-019` | `water_frame_19` | `water` | `sprites/water/water-water-019.png` | 0,2880,320,128 | 0,0 |  | Animated deep-water texture, frame 19 of 21 (tileable horizontally) |
| `water-water-020` | `water_frame_20` | `water` | `sprites/water/water-water-020.png` | 0,3040,320,128 | 0,0 |  | Animated deep-water texture, frame 20 of 21 (tileable horizontally) |
| `water-water-021` | `water_frame_21` | `water` | `sprites/water/water-water-021.png` | 0,3200,320,128 | 0,0 |  | Animated deep-water texture, frame 21 of 21 (tileable horizontally) |

## 5. Tilesets

A tileset is a composite from the sheets (mesa, ground patch, pit, ring) split into 9-slice pieces on the 32 px grid. Draw it as 3 × 3 bands: corners once, `t`/`b` edges repeated along the top/bottom, `l`/`r` edges down the sides, `c` fill inside. `cols`/`rows` are the band sizes in px, [left, centre, right] and [top, middle, bottom]. Side bands can be wider than one cell (mesa rims are 64 px, the cliff face is 128 px). The centre band repeats in 32 px steps, so `nx × ny` centre cells give `cols[0] + 32·nx + cols[2]` × `rows[0] + 32·ny + rows[2]` px. When a role has several variants, cycle them. `hole` = no fill: the ground under the tileset shows through. `layout` lists piece ids as arranged in the source sheet, so drawing it row by row reproduces the original art. Reference renderer: `examples/terrain.js`.

| Tileset | Sheet | Class | cols px | rows px | Hole | Pieces | Description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mesa_hollow_open` | `rocks2` | `rock` | 64/64/96 | 64/32/128 | y | tl `rocks2-rock-001`, t `rocks2-rock-002` `rocks2-rock-003`, tr `rocks2-rock-004`, l `rocks2-rock-005`, r `rocks2-rock-006`, bl `rocks2-rock-007`, b `rocks2-rock-008` `rocks2-rock-009`, br `rocks2-rock-010` | Mesa ring with grassy inner rim and open (transparent) centre, cliff face and shadow |
| `mesa_solid` | `rocks2` | `rock` | 64/64/96 | 64/32/128 |  | tl `rocks2-rock-011`, t `rocks2-rock-012` `rocks2-rock-013`, tr `rocks2-rock-014`, l `rocks2-rock-015`, c `rocks2-rock-016`, r `rocks2-rock-017`, bl `rocks2-rock-018`, b `rocks2-rock-019` `rocks2-rock-020`, br `rocks2-rock-021` | Mesa with gravel top, cliff face and shadow |
| `mesa_solid_fog` | `rocks2` | `rock` | 64/64/64 | 64/32/128 |  | tl `rocks2-rock-022`, t `rocks2-rock-023` `rocks2-rock-024`, tr `rocks2-rock-025`, l `rocks2-rock-026`, c `rocks2-rock-027`, r `rocks2-rock-028`, bl `rocks2-rock-029`, b `rocks2-rock-030` `rocks2-rock-031`, br `rocks2-rock-032` | Mesa with gravel top and fog-faded cliff face |
| `plateau_tall` | `rocks2` | `rock` | 64/64/64 | 64/32/128 |  | tl `rocks2-rock-061`, t `rocks2-rock-062` `rocks2-rock-063`, tr `rocks2-rock-064`, l `rocks2-rock-065`, c `rocks2-rock-066`, r `rocks2-rock-067`, bl `rocks2-rock-068`, b `rocks2-rock-069` `rocks2-rock-070`, br `rocks2-rock-071` | Plateau with gravel top and layered cliff face |
| `grass_patch_octagon` | `rocks2` | `terrain` | 64/32/64 | 64/32/64 |  | tl `rocks2-terrain-001`, t `rocks2-terrain-002`, tr `rocks2-terrain-003`, l `rocks2-terrain-004`, c `rocks2-terrain-005`, r `rocks2-terrain-006`, bl `rocks2-terrain-007`, b `rocks2-terrain-008`, br `rocks2-terrain-009` | Dark-green grass patch with light ragged fringe and cut corners |
| `grass_cross_frame` | `rocks2` | `terrain` | 64/32/64 | 64/32/64 | y | tl `rocks2-terrain-010`, t `rocks2-terrain-011`, tr `rocks2-terrain-012`, l `rocks2-terrain-013`, r `rocks2-terrain-014`, bl `rocks2-terrain-015`, b `rocks2-terrain-016`, br `rocks2-terrain-017` | Yellow-green grass frame around a hole for base tiles (the cross tiles are separate sprites) |
| `grass_cross_cutout` | `rocks2` | `terrain` | 64/32/64 | 64/32/64 | y | tl `rocks2-terrain-018`, t `rocks2-terrain-019`, tr `rocks2-terrain-020`, l `rocks2-terrain-021`, r `rocks2-terrain-022`, bl `rocks2-terrain-023`, b `rocks2-terrain-024`, br `rocks2-terrain-025` | Green grass frame around a hole with notched corners |
| `cobble_ground_grass_edge` | `rocks2` | `terrain` | 32/32/32 | 32/32/32 |  | tl `rocks2-terrain-031`, t `rocks2-terrain-032`, tr `rocks2-terrain-033`, l `rocks2-terrain-034`, c `rocks2-terrain-035`, r `rocks2-terrain-036`, bl `rocks2-terrain-037`, b `rocks2-terrain-038`, br `rocks2-terrain-039` | Cobblestone ground with grassy ragged edge |
| `cobble_overgrown` | `rocks2` | `terrain` | 32/32/32 | 32/32/32 |  | tl `rocks2-terrain-041`, t `rocks2-terrain-042`, tr `rocks2-terrain-043`, l `rocks2-terrain-044`, c `rocks2-terrain-045`, r `rocks2-terrain-046`, bl `rocks2-terrain-047`, b `rocks2-terrain-048`, br `rocks2-terrain-049` | Cobblestone ground overgrown with grass |
| `gravel_patch_round` | `rocks2` | `terrain` | 32/32/32 | 32/32/32 |  | tl `rocks2-terrain-054`, t `rocks2-terrain-055`, tr `rocks2-terrain-056`, l `rocks2-terrain-057`, c `rocks2-terrain-058`, r `rocks2-terrain-059`, bl `rocks2-terrain-060`, b `rocks2-terrain-061`, br `rocks2-terrain-062` | Gravel ground with loose-stone edge |
| `pebble_patch_round` | `rocks2` | `terrain` | 32/32/32 | 32/32/32 |  | tl `rocks2-terrain-068`, t `rocks2-terrain-069`, tr `rocks2-terrain-070`, l `rocks2-terrain-071`, c `rocks2-terrain-072`, r `rocks2-terrain-073`, bl `rocks2-terrain-074`, b `rocks2-terrain-075`, br `rocks2-terrain-076` | Pebble ground with loose-pebble edge |
| `sand_ring_tile` | `beach` | `terrain` | 32/32/32 | 32/32/32 | y | tl `beach-terrain-001`, t `beach-terrain-002`, tr `beach-terrain-003`, l `beach-terrain-004`, r `beach-terrain-005`, bl `beach-terrain-006`, b `beach-terrain-007`, br `beach-terrain-008` | Sand border around a hole (ring) |
| `sand_ring_small` | `beach` | `terrain` | 32/0/32 | 32/0/32 | y | tl `beach-terrain-009`, tr `beach-terrain-010`, bl `beach-terrain-011`, br `beach-terrain-012` | Small sand disc in four quadrants |
| `gravel_patch` | `beach` | `terrain` | 32/32/32 | 32/32/32 |  | tl `beach-terrain-019`, t `beach-terrain-020`, tr `beach-terrain-021`, l `beach-terrain-022`, c `beach-terrain-023`, r `beach-terrain-024`, bl `beach-terrain-025`, b `beach-terrain-026`, br `beach-terrain-027` | Gravel ground with loose-stone edge |
| `sand_pit_square` | `beach` | `terrain` | 32/32/32 | 32/32/32 | y | tl `beach-terrain-028`, t `beach-terrain-029`, tr `beach-terrain-030`, l `beach-terrain-031`, r `beach-terrain-032`, bl `beach-terrain-033`, b `beach-terrain-034`, br `beach-terrain-035` | Sand border around a square hole |
| `gravel_pit` | `beach` | `terrain` | 32/32/32 | 32/32/32 |  | tl `beach-terrain-036`, t `beach-terrain-037`, tr `beach-terrain-038`, l `beach-terrain-039`, c `beach-terrain-040`, r `beach-terrain-041`, bl `beach-terrain-042`, b `beach-terrain-043`, br `beach-terrain-044` | Gravel ground with sandy ragged edge |
| `sand_pit_dark_large` | `beach` | `terrain` | 32/32/32 | 32/32/32 |  | tl `beach-terrain-053`, t `beach-terrain-054`, tr `beach-terrain-055`, l `beach-terrain-056`, c `beach-terrain-057`, r `beach-terrain-058`, bl `beach-terrain-059`, b `beach-terrain-060`, br `beach-terrain-061` | Sand ground with dark raised rim |
| `sand_pit_light_small` | `beach` | `terrain` | 32/32/32 | 32/32/32 |  | tl `beach-terrain-062`, t `beach-terrain-063`, tr `beach-terrain-064`, l `beach-terrain-065`, c `beach-terrain-066`, r `beach-terrain-067`, bl `beach-terrain-068`, b `beach-terrain-069`, br `beach-terrain-070` | Sand ground with light rim |
| `sand_pit_dark_b` | `beach` | `terrain` | 32/32/32 | 32/32/32 |  | tl `beach-terrain-071`, t `beach-terrain-072`, tr `beach-terrain-073`, l `beach-terrain-074`, c `beach-terrain-075`, r `beach-terrain-076`, bl `beach-terrain-077`, b `beach-terrain-078`, br `beach-terrain-079` | Golden sand ground with dark raised rim |

## 6. How the boxes were made

- Boxes were **not** taken from the original `ZRPG*.md` specs (QA in `tiles-qa.json` rejected 120 of them). Every sprite is a pixel-connected component of the sheet alpha (8-connectivity).
- Cast shadows (pure black, alpha 92) are attached to the object they touch, so a tree and its shadow are one sprite and a neighbour is never included.
- Where two objects touch in the art (pedestal/leaves, bowl/pot, bone arch/grass/sand tiles, two desert arches, pillar/ledge, tile strips, two jungle plants, frond/shoot) they were separated with hand-placed masks.
- Specks under 6×6 px were absorbed into the nearest sprite or dropped. Scatter decals (loose grass blades, rubble) are grouped into one sprite per cluster.
- Removed: solid dark/black placeholder squares (1 in trees, 4 in beach) and the water divider bands.
- Composites drawn on the 32 px grid (mesas, plateaus, ground patches, pits, rings) were cut into tileset pieces (section 5). Pixels of a composite outside its grid are dropped (11 px in `plateau_tall`, 5 px in `gravel_patch_round`).

## 7. Regenerating

Do not edit sprites, atlas or catalog by hand. Change `tools/build.py` (masks: cuts, groups, clips, tilesets per sheet) or `tools/labels.py` (class, name, description in reading order), then run:

```sh
pip install pillow numpy scipy
python tools/build.py && python tools/contact.py && python tools/export.py
```

`tools/contact.py` writes `tools/.cache/cs_<sheet>.png`, a numbered contact sheet. Its order must match `labels.py`; if a mask change adds or removes a sprite, update the labels to match. A tileset is one entry (`T<n>` on the sheet) and one label line; its pieces are named `<name>_<role>[<n>]`. Ids are reassigned on regeneration.
