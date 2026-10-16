# Sketch-to-Grid Authoring Notes

Coordinate and sprite reference used to author `public/world/world.json` (and copied into every other
shipped world file, research.md R10) from `world_map.jpg`. Grid: 64 cols × 40 rows, `cellPx` 32 (research.md
R1). Coordinates below are cell units (x: 0–64, y: 0–40).

**Bugfix**: 2026-10-15 — BUG-001 rewrote the "River Passage / bridge crossing" row for the river + swamp
(research.md R11, contracts/world-format-sketch-map.md §6) and removed the "The Dunes"/"Lava Zone" rows
(FR-025: desert-family terrain is omitted, not substituted). See [bugs/BUG-001.md](bugs/BUG-001.md).

**Second pass, same day**: the first BUG-001 pass added a river and a swamp but positioned and shaped
them independently rather than from `zrpg-art/examples/WORLD-SPEC.md`'s own numbers, which is what the
user actually asked for ("inherit lakes, river and swamp from it"). This pass instead converts
WORLD-SPEC's reference-px coordinates directly into this map's cells and re-authors the two lakes, both
rivers and the swamp from those numbers (below), adjusting only where microfly's own schema constraints
force a deviation (noted inline).

**Conversion**: `world_map.jpg` is 1376 × 768 reference px (the same picture WORLD-SPEC.md itself builds
from). This grid is 64 × 40 cells. `cellX = refX × (64/1376) = refX × 0.046512`,
`cellY = refY × (40/768) = refY × 0.052083` — two independent per-axis factors (not one uniform scale),
since the grid's own aspect ratio (1.6:1, research.md R1) differs from the sketch's (1.79:1); this mirrors
the non-uniform compromise R1 already made for the grid as a whole, applied consistently to every feature
placed within it.

## Sketch region → grid mapping

| Sketch region | Grid area (approx.) | Representation |
|---|---|---|
| Forest border (all sides) | Asymmetric band matching WORLD-SPEC §7's left 104/right 90/top 118/bottom 94 ref-px band, converted: left ≈ 5 cols (0–5), right ≈ 4 cols (60–64), top ≈ 6 rows (0–6), bottom ≈ 6 rows (34–40) | 6 `edgeForest` ground areas (`edge-forest-north-west/-east`, `-south-west/-east`, `-west`, `-east`) — the north/south bands are split in two, leaving a gap where a river crosses that edge (FR-024) + scatter tree cover |
| Title banner, Symbols legend, compass rose | — | Excluded entirely (FR-002) |
| West Arcade Land / Pixel Town (buildings) | centred ~(12, 10) | `jungle-prop-004` tent ×3 + `beach-prop-027` bone pile |
| East Arcade Land / Boss Castle (buildings) | centred ~(53, 10) | `jungle-prop-004` tent ×3 + `beach-prop-029`/`035`/`034` bone/skull pieces |
| Arcade Marketplace (buildings) | centred ~(49, 18) | `jungle-prop-004` tent ×2 + `beach-prop-032`/`033` bone pieces |
| Lake Joy — WORLD-SPEC blob (535, 272) rx 112 ry 84 | converted centre (24.88, 14.17); `rx`/`ry` kept at the pre-existing 7.5/4.5 (the raw conversion, 5.21/4.38 cells, falls between microfly's `pond`/`lake` `BODY_RANGES` — neither fits; 7.5/4.5 is the nearest already-valid `lake` shape) | `waterBodies[0]` `lake-joy`, lake-range blob |
| Lake Byte — WORLD-SPEC blob (770, 535) rx 152 ry 100 | converted centre (35.81, 27.86); `rx`/`ry` kept at the pre-existing 7.8/4.68 (converted 7.07/5.21 cells has the right `rx` but `ry`/`rx` = 0.74 exceeds the `lake` ratio ceiling of 0.65) | `waterBodies[1]` `lake-byte`, lake-range blob |
| North river + Joy→swamp river, merged — WORLD-SPEC (690,−40)→(732,322) and (650,300)→(732,326) | converted path ≈ (32,−3)→(33,6)→(30,14), width ≈ 1.4→1.7 (both WORLD-SPEC segments feed the same lake from the same direction, so one `river` body covers both) | `waterBodies[2]` `river-north` (contract §6); crosses the north edge inside the `edge-forest-north-west`/`-east` gap (x 28–37) |
| South river — WORLD-SPEC (648,640)→(640,800) | converted path ≈ (30,32)→(30,37)→(30,43), width ≈ 2.0→2.4 | `waterBodies[3]` `river-south`; crosses the south edge inside the `edge-forest-south-west`/`-east` gap (x 25–35) |
| Swamp pools — WORLD-SPEC chain (738,340)→(712,440), 8 small blobs "must not form a channel" | converted centre ≈ (31, 20); microfly's `pond` `BODY_RANGES` floor (rx ≥ 60 px ≈ 1.9 cells) is larger than these puddles (rx 11–30 ref-px ≈ 0.5–1.4 cells), so they are **not** authored as water bodies — "wet ground with small pools" is represented by the `swamp` ground kind + reed scatter alone, not a literal water shape, which also keeps the crossing dry by construction | `lake-swamp` ground area (ellipse cx 31, cy 20, rx 3.5, ry 3) + `lake-swamp-reeds` scatter (contract §6, FR-023) |
| Dry crossing margin (FR-011) | Lake Joy's `cy` nudged from the raw-converted 14.17 to 13, Lake Byte's from 27.86 to 28.5 | WORLD-SPEC's own lakes are ≈ 4 cells apart edge-to-edge at this scale — tight enough that, abstracted to microfly's 32 px cells and the 3-tile zero-heat rule, the lakes' wobble (±0.16–0.18 × radius, seed-dependent) could seal the only crossing for some world seeds and not others. Nudging each lake ≈ 1.3–1.6 cells further apart restores a margin that holds for every seed this map ships with (2026 and 1990), verified by `tests/water-corridor.test.mjs` against both `world.json` and `world-forager-wide.json`. |
| Slime Hills (west mountains) | centred ~(9, 19), rx 4.5 (BUG-001: narrowed from 6 so its scatter doesn't randomly choke the dry crossing near x≈5–9 for one world seed and not another — the lucky/unlucky gap this depended on before is what made the crossing seed-fragile) | `rocks2-rock-032`/`019`/`033`/`017` (big rock objects) + small-rock/pebble scatter (research R9 substitution) |
| Mountains east (near Boss Castle) | centred ~(58, 17) | Same rock sprite family, smaller cluster |
| Level 1 Forest (interior forest patch) | centred ~(18, 21) | `darkGrass` ground area + a 7-tree grove + tree scatter (NOT `edgeForest` — only the border casts danger odour, FR-008) |
| Starting Area | centred ~(12, 32) | `meadow` ground area + light plant/flower scatter (non-solid) |
| The Dunes | — | **Removed (BUG-001, FR-025)**: the sketch's dune region is omitted, not substituted; the area is plain base grass. |
| Lava Zone (no atlas equivalent) | — | **Removed (BUG-001, FR-025)**: the sketch's lava region is omitted, not substituted (supersedes research.md R9's original "substitute with gravel" choice, reversed by R11); the area is plain base grass. |
| NPC/animal figures | — | Excluded entirely (FR-002) |

## Building sprite ids (research.md R9)

- Tent: `jungle-prop-004` (`canvas_tent`, 112 × 73 px)
- Bone/skull family: `beach-prop-027` (`cow_skull`), `beach-prop-029` (`ribcage`), `beach-prop-032`/`033`
  (`bone_a`/`bone_b`), `beach-prop-034` (`bone_ring_arch`), `beach-prop-035` (`animal_skull`)

## Food trail (FR-014/FR-015)

Ten food units (`small`/`medium`/`large`, every kind present), chained from the Starting Area through Level 1
Forest, across the dry crossing between the lakes, to the Marketplace and the former Dunes site, each
consecutive pair within Chebyshev distance ≤ 13 cells so neighbouring `foodKernel` footprints (support ~10
rings) overlap with margin. Connectivity verified by `tests/food-field.test.mjs`'s world.json case.
**Bugfix**: 2026-10-15 — BUG-001's second pass moved the unit nearest Lake Joy from (22.5, 17.5) to
(24, 21): the lake's repositioning (above) first put it inside the shore band, then — once the lake was
nudged for the crossing margin — onto a cell a nearby scatter rule happened to place a solid tree on for
one world seed and not another. (24, 21) clears the shore band and stays off blocked cells for both
shipped seeds (2026, 1990).
