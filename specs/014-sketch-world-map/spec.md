# Feature Specification: Sketch-Based World Map

**Feature Branch**: `016-sketch-world-map`

**Created**: 2026-10-14

**Status**: Draft

**Bugfix**: 2026-10-15 — BUG-002 The map is the art pack's reference world map (`zrpg-art/examples/world.html`): terrain, forest and water equal it (FR-026); FR-025 withdrawn (the dunes and rocky desert are back); FR-011 amended to the crossing the reference water allows. See [bugs/BUG-002.md](bugs/BUG-002.md).

**Bugfix**: 2026-10-15 — BUG-001 Added river/swamp/edge-forest-gap requirements (FR-022–FR-024) and a desert-exclusion requirement (FR-025); narrowed the lava Edge Case away from substitution. See [bugs/BUG-001.md](bugs/BUG-001.md).

**Input**: User description: "Create a new world map using my sketch world_map.jpg and existing assets library atlas (`public/assets/atlas`). Keep the shape of terrain and water exactly as my sketch draws. The atlas does not have any building use the tent and bones from atlas. The atlas does not have any bridge, just put the terrain there. Avoid setting any title, ledgend and animals. One of the main change is the calibartion of meaning in the world: 1. The edge of the world is a deep forest is must cast the danger odour. The forest itself is max danger odour, neighbor tile is 50% danger odour, and second neighbor tile is 25% of danger odour. Only the edge forest casts danger odour. 2. Water is heat odour, neighbor tile is 50% heat odour, and second neighbor tile is 25% of heat odour. In the sketch the water divides area into two parts, there should be a thin path between terrains with no heat odour so that both sides are connected and reachable by fly. 3. Food odour is 100% at the food flower tile, 100% in the next neighbor tile so that 9 title square is an area where fly can eat. The food odour reduces by 10% but do not draw a perfect circles of food odour it has to be an random shape areas. The food MUST be distributed on the map so that one food odour area gently touches another area. The fly has to be able to travel across the map simply following the food odour. 4. Any decorations, object or trees on the map causes touch left and right when fly is 'touching' them. Make an optimization of the map and tile sizes so that map is 'large' enough to fit the world I've sketched but also proportional to the size of fly. Enhance the visualization of food, danger, heat odour and tile grid so that user can switch it on/off for the visualization. One the new world is complete, apply it to all implemented worlds in this simulator."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A World Shaped Like My Sketch (Priority: P1)

A person who drew a hand map of terrain, water, mountains, buildings and a bridge wants the simulator's world to match the shape of that sketch: the same landmasses, the same bodies of water, in the same relative places — built only from pieces already in the art library, with no title banner, legend box or animal figures carried over from the drawing.

**Why this priority**: The sketch is the entire visual brief for the new world. Without a faithful terrain/water layout the rest of the feature (odour calibration, overlays, rollout) has nothing correct to build on.

**Independent Test**: Open the new map next to the sketch and visually confirm that every landmass outline and every body of water matches the sketch in shape and relative position, that no building, bridge, title, legend or animal artwork from the sketch appears literally (buildings are represented with tent/bone decor, the bridge location is plain terrain), and that the map contains only pieces drawn from the existing atlas.

**Acceptance Scenarios**:

1. **Given** the hand-drawn sketch, **When** the new map is rendered, **Then** every terrain landmass and water body in the sketch has a matching shape and position on the map.
2. **Given** a location in the sketch marked with a building, **When** the new map is rendered, **Then** that location shows only tent and/or bone/skull decoration pieces from the atlas, never a building sprite (the atlas has none).
3. **Given** the bridge drawn in the sketch, **When** the new map is rendered, **Then** that location is plain walkable terrain with no bridge asset.
4. **Given** the title banner, legend/symbol key and animal figures drawn in the sketch, **When** the new map is rendered, **Then** none of them appear on the map.
5. **Given** the sketch's river (crossing from one map edge, through both lakes, to another edge) and the swamp connecting the two lakes, **When** the new map is rendered, **Then** the river appears as a water feature matching the sketch's path and the connector between the lakes is rendered as wet swamp ground, not plain dry terrain, and the outer-edge forest ring leaves a gap wherever the river crosses the map's outer edge. *(Bugfix: 2026-10-15 — BUG-001; see FR-022–FR-024.)*
6. ~~**Given** the sketch's dune, rocky-desert and lava regions, **When** the new map is rendered, **Then** none of those regions appear on the map in any form, substituted or otherwise.~~ *(Withdrawn 2026-10-15 — BUG-002: the dunes and the rocky desert are drawn as the reference draws them; the lava zone, which the reference leaves out, stays out. See FR-026.)*

---

### User Story 2 - Danger Only Comes From the Forest's Edge (Priority: P1)

A person studying fly behaviour wants danger to mean something specific and legible: only the ring of deep forest that forms the outer edge of the world is a threat. A fly standing in that edge forest senses maximum danger; one step inside the map from it senses half as much; two steps in, a quarter; beyond that, none. No other object or interior forest patch radiates danger.

**Why this priority**: This replaces the previous ad-hoc danger sources with a single, map-shaped rule that is core to how a fly is expected to avoid the world's edges — it has to land before the odour trail and touch work are meaningful.

**Independent Test**: Sample the danger field across the whole map; confirm it is at its maximum only on edge-forest tiles, halves one tile inward, quarters two tiles inward, and is zero everywhere else, including any forest that is not part of the outer edge.

**Acceptance Scenarios**:

1. **Given** a tile of edge forest, **When** the danger field is sampled there, **Then** it reads the maximum danger level.
2. **Given** a tile one step inward from edge forest, **When** sampled, **Then** it reads half the maximum danger level.
3. **Given** a tile two steps inward from edge forest, **When** sampled, **Then** it reads a quarter of the maximum danger level.
4. **Given** a patch of forest that is not on the map's outer edge, **When** sampled, **Then** it reads zero danger on its own account.

---

### User Story 3 - Water Radiates Heat, But There's Always a Dry Way Across (Priority: P1)

A person watching a fly navigate wants water to feel hot rather than merely wet: every water tile radiates heat at full strength, fading by half one tile away and a quarter two tiles away. Where the sketch's water splits the map into two halves, a dry corridor still lets a fly walk from one half to the other without ever registering heat.

**Why this priority**: Heat odour is the other half of the new sensory calibration, and the crossing guarantee is what keeps the map explorable rather than splitting it into two unreachable regions — both are prerequisites for the food-trail and rollout stories.

**Independent Test**: Sample the heat field over every water tile and its two surrounding rings to confirm the 100/50/25% levels, then walk a path from one side of the water divide to the other confirming every tile on that path reads zero heat.

**Acceptance Scenarios**:

1. **Given** a water tile, **When** the heat field is sampled there, **Then** it reads the maximum heat level.
2. **Given** a tile one step from the nearest water tile, **When** sampled, **Then** it reads half the maximum heat level.
3. **Given** a tile two steps from the nearest water tile, **When** sampled, **Then** it reads a quarter of the maximum heat level.
4. **Given** the two areas the sketch's water divides the map into, **When** a fly starts on either area, **Then** a walkable route exists to the other area along which every tile reads zero heat.

---

### User Story 4 - Following Food Odour Across the Whole Map (Priority: P1)

A hungry fly wants a trail it can follow: each food item smells strongest in the 3×3 block of tiles centred on it, fades by roughly a tenth with every ring further out in an irregular, non-circular shape, and the food placed across the map is spaced so that one food item's faint outer odour gently overlaps the next item's — turning the whole map into one connected scent trail a fly can walk end to end by always moving toward a stronger smell.

**Why this priority**: This is the single largest behavioural change in the request — it turns "find the nearest flower" into "cross the whole world by smell" — and depends on the terrain layout from Story 1 to know where food can sit.

**Independent Test**: Sample the food odour field around several food items to confirm the 3×3 full-strength core and the irregular, non-circular stepped falloff beyond it, then confirm that, starting from any one food item's odour footprint, every other food item's footprint on the map can be reached by following tiles of non-zero, non-decreasing-then-increasing food odour without crossing a zero-odour gap.

**Acceptance Scenarios**:

1. **Given** a single food item, **When** the food odour field is sampled on its own tile and its eight immediate neighbours, **Then** all nine tiles read full food odour.
2. **Given** that same food item, **When** the field is sampled one ring further out, **Then** the odour has stepped down by about a tenth and the footprint's outline is irregular, not a circle or a square.
3. **Given** two food items placed near each other, **When** their odour footprints are compared, **Then** the low-intensity edges of the two footprints touch or overlap.
4. **Given** the full set of food items on the map, **When** a fly follows non-zero food odour outward from any one of them, **Then** it can reach every other food item on the map without crossing a gap of zero food odour.

---

### User Story 5 - Bumping Into Anything Feels Like a Touch (Priority: P2)

A fly that walks into a tree, rock, tent, bone pile or any other decoration on the map should feel it as a touch on whichever side made contact, consistently, everywhere on the map.

**Why this priority**: Touch sensing already exists for some objects; this story extends it uniformly to every decoration placed by the new map, which other behaviour stories assume is already true.

**Independent Test**: Walk a fly into every kind of decorative object placed on the map (tree, rock, tent, bone pile, and any other prop) and confirm each one registers a left or right touch depending on which side of the fly made contact.

**Acceptance Scenarios**:

1. **Given** a fly approaching a tree, rock, tent or bone decoration from the left, **When** the fly's body reaches it, **Then** a left touch is registered.
2. **Given** a fly approaching the same kind of object from the right, **When** the fly's body reaches it, **Then** a right touch is registered.
3. **Given** every decorative object placed on the new map, **When** a full traversal of the map is made, **Then** every one of them is confirmed to register touch on contact.

---

### User Story 6 - Switching Overlays On and Off (Priority: P2)

A person studying the map wants to see food odour, danger odour, heat odour and the tile grid as separate, independently switchable overlays, so they can look at one signal at a time or combine whichever ones help them understand what a fly is sensing.

**Why this priority**: This is an observability aid for the three odour calibrations above and for verifying the new map's layout — valuable, but it doesn't change the world's behaviour, only its visibility.

**Independent Test**: With the new map loaded, switch each of the four overlays — food odour, danger odour, heat odour, tile grid — on and off independently, in every combination, and confirm only the toggled overlays appear.

**Acceptance Scenarios**:

1. **Given** the map is displayed with all overlays off, **When** the food odour overlay is switched on, **Then** only the food odour overlay appears.
2. **Given** any overlay is on, **When** it is switched off, **Then** it disappears while any other overlay already on stays visible.
3. **Given** two or more overlays are switched on at once, **When** the map is viewed, **Then** all of them are visible together.

---

### User Story 7 - Every World Runs on the Same Sketched Map (Priority: P3)

A person who runs any of the simulator's existing worlds — the base world, the forager worlds, the class-seeded and wide-input-output brains, the connectome and antennal-lobe demos — wants them all to share the new sketched map's terrain, water, forest edge and food layout, so every fly a person can start in this simulator explores the same place.

**Why this priority**: This is the rollout step; it depends on every story above being finished and correct first, and it is validated by exercising each world rather than by any new standalone behaviour.

**Independent Test**: Open each world configuration shipped with the simulator in turn and confirm each one loads the new sketched map's terrain, water, forest-edge danger odour and food layout, with no console errors, while each world's own brain and calibration stay whatever they already were.

**Acceptance Scenarios**:

1. **Given** each world configuration a fly can be started in, **When** it is opened, **Then** it shows the new sketched map's terrain and water layout.
2. **Given** each such world, **When** a fly is started in it, **Then** it runs with no console errors and the fly senses the new danger, heat and food odour fields wherever its brain is wired to sense them.

---

### Edge Cases

- A food odour footprint's outer ring reaches into the edge-forest danger zone or close to water: the food, danger and heat fields are independent and can all be non-zero on the same tile at once.
- Two edge-forest tiles meet at a corner of the map, so a tile can be within range of edge forest from more than one direction: its danger level is the combined effect, still capped at the maximum.
- A candidate dry-crossing tile sits exactly two steps from a water tile on one side: the corridor must be routed far enough from every bank that no tile along it is within heat range of any water tile, not just further from the nearest one.
- A decorative object sits inside a food odour footprint: touch and food odour are sensed independently and both apply at once.
- A world whose brain does not sense one of the new channels (older brain generations sense fewer channels than the newest one) still loads and runs on the new map; the field exists on the map, but a fly whose brain has no input for that channel simply does not react to it.
- The sketch depicts a terrain style the atlas has no matching piece for ~~(for example, a lava area)~~: the map preserves that area's sketched outline and location using the closest available terrain piece instead of inventing new art. **Superseded for desert-family terrain (dunes, rocky desert, lava) by FR-025** *(Bugfix: 2026-10-15 — BUG-001)* — those sketched regions are omitted from the map entirely rather than substituted; this substitution rule (FR-005) now applies only to non-desert terrain styles the atlas has no match for.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The new map's terrain landmasses and water bodies MUST reproduce the shapes drawn in the sketch, in the same relative position and proportions to one another.
- **FR-002**: The new map MUST NOT display any title banner, legend/symbol key, or animal/creature figure that appears in the sketch.
- **FR-003**: Every building depicted in the sketch MUST be represented on the map using only tent and bone/skull decoration pieces from the existing asset library, placed at that building's sketched location.
- **FR-004**: The bridge depicted in the sketch MUST be represented as plain walkable terrain at that location, with no bridge asset.
- **FR-005**: Where the sketch depicts a terrain style with no matching piece in the asset library, the map MUST substitute the closest available terrain piece while preserving the sketched outline and location. **Does not apply to desert-family terrain (dunes, rocky desert, lava) — see FR-025.** *(Bugfix: 2026-10-15 — BUG-001)*
- **FR-006**: Only tiles of the forest that forms the outer edge of the map MUST emit danger odour.
- **FR-007**: Danger odour MUST read at its maximum on edge-forest tiles, at half-maximum one tile inward from edge forest, at a quarter-maximum two tiles inward from edge forest, and at zero beyond that.
- **FR-008**: Forest tiles that are not part of the map's outer edge MUST NOT emit danger odour on their own account.
- **FR-009**: Every water tile MUST emit heat odour.
- **FR-010**: Heat odour MUST read at its maximum on water tiles, at half-maximum one tile from the nearest water tile, at a quarter-maximum two tiles from the nearest water tile, and at zero beyond that.
- **FR-011**: Where the sketch's water divides the map into two areas, the map MUST provide at least one walkable corridor connecting the two areas. ~~along which every tile reads zero heat odour~~ *(Bugfix: 2026-10-15 — BUG-002: the reference water (FR-026) leaves no zero-heat crossing; the corridor runs between the swamp pools at heat ≤ 50%. Restoring zero heat needs different water and is the user's decision.)*
- **FR-012**: Each food item MUST emit full-strength food odour on its own tile and on its eight immediate neighbouring tiles.
- **FR-013**: Beyond that nine-tile core, each food item's odour MUST step down by roughly a tenth of full strength per further ring outward, down to zero, in an irregular, non-circular and non-square outer shape.
- **FR-014**: Food items MUST be distributed across the map so that each food odour footprint's low-intensity edge touches or overlaps the next footprint's.
- **FR-015**: A fly MUST be able to travel between every pair of food items on the map by continuously following non-zero food odour, without crossing a gap of zero food odour.
- **FR-016**: Every decorative object, prop and tree placed on the map MUST register a left or right touch sensation on a fly when the fly's body contacts it, consistent with the side of contact.
- **FR-017**: The map's tile-grid dimensions MUST be large enough to contain the sketch's full terrain and water layout without clipping or distorting any shape.
- **FR-018**: The map's tile size MUST keep the same relative scale between a tile and a fly's body that the simulator's existing maps use, so a fly's size and sensing ranges carry the same meaning on the new map as on prior maps.
- **FR-019**: Users MUST be able to show or hide the food odour overlay, the danger odour overlay, the heat odour overlay, and a tile-grid overlay, each independently of the other three.
- **FR-020**: Any combination of the four overlays in FR-019 MUST be displayable at once, including all four on or all four off.
- **FR-021**: Every world configuration shipped with the simulator that a fly can be started in MUST use the new sketched map's terrain, water, forest-edge danger odour and food layout, while each world's own body, brain and experiment settings remain unchanged.

**Bugfix additions** *(2026-10-15 — BUG-001; the reference reading of this sketch at `zrpg-art/examples/WORLD-SPEC.md` names a river, a swamp and edge-of-map river crossings that the first implementation of this feature omitted, and the user has asked to drop the sketch's desert-family regions rather than substitute them)*:

- **FR-022**: The sketch's river — entering the map at one outer edge, passing through both lakes, and exiting at another outer edge — MUST be reproduced as a body of water, in the same path, shape and relative position as the sketch, in addition to (not instead of) the two lakes it connects (clarifies FR-001).
- **FR-023**: Where the sketch shows wet, reedy ground connecting two bodies of water (the swamp between the two lakes), the map MUST render that connector as swamp ground, not as plain dry terrain, while still satisfying FR-011's walkable-crossing guarantee.
- **FR-024**: Where the sketch's river crosses the map's outer edge, the outer-edge forest ring (FR-006) MUST leave a gap at that crossing, so the river's edge crossing does not itself read maximum danger odour on its own account.
- **FR-025** *(Withdrawn 2026-10-15 — BUG-002, superseded by FR-026)*: ~~The sketch's desert-family terrain — dunes/sand beach, rocky desert, and the lava zone — MUST NOT appear on the map in any form; these sketched regions are omitted from the map rather than substituted with the closest available terrain piece (overrides FR-005 for this terrain family specifically).~~
- **FR-026**: The map's terrain (ground areas, trails, mountains), forest (border band with river gaps, groves) and water (lakes, rivers, swamp pools, island) MUST equal the art pack's reference world map (`zrpg-art/examples/world.html`, `WORLD-SPEC.md`), drawn with that pack's current assets. The world keeps its own grid size (64 × 40 cells of 32 px) and its own food and danger allocation and parameters; scenery yields where it would stand on food. *(Bugfix: 2026-10-15 — BUG-002)*

### Key Entities

- **World Geography**: The terrain landmasses, water bodies — including the sketch's river and the swamp connecting its two lakes *(Bugfix: 2026-10-15 — BUG-001, FR-022/FR-023)* — outer edge forest ring (gapped where the river crosses it, FR-024) and walkable corridors derived from the sketch; shared by every world configuration. The sketch's desert-family regions (dunes, rocky desert, lava) are out of scope for this entity (FR-025).
- **Danger Odour Field**: A per-tile danger intensity sourced only from edge-forest tiles, at 100%/50%/25% over three tile-steps.
- **Heat Odour Field**: A per-tile heat intensity sourced from water tiles, at 100%/50%/25% over three tile-steps, with guaranteed zero-heat crossings where water divides the map.
- **Food Odour Area**: An irregularly-shaped per-item intensity footprint, 100% over its 3×3 core and stepping down roughly 10 percentage points per ring outward, placed so neighbouring areas' footprints touch.
- **Decorative Object**: A tree, rock, tent, bone/skull piece, or other non-food, non-water placement on the map that triggers touch on contact.
- **Visualization Overlay**: One of four independently switchable map display layers — food odour, danger odour, heat odour, tile grid.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every terrain landmass and body of water — including the river and the swamp connecting the two lakes — on the new map can be matched to its counterpart in the sketch by shape and relative position, with no title, legend or animal artwork present, no building or bridge asset drawn on the map, and no dune/rocky-desert/lava region present in any form. *(Bugfix: 2026-10-15 — BUG-001 extends this criterion to the river/swamp and the desert exclusion.)*
- **SC-002**: Sampling the danger field confirms the 100%/50%/25% levels hold across every edge-forest tile and its two surrounding rings, and reads zero over every forest tile that is not on the map's outer edge.
- **SC-003**: Sampling the heat field confirms the 100%/50%/25% levels hold across every water tile and its two surrounding rings, and a walkable, zero-heat route exists between every pair of areas the sketch's water divides.
- **SC-004**: Sampling the food odour field around every food item confirms the full-strength 3×3 core, a stepped roughly-10%-per-ring outward falloff with an irregular outline, and that every food item's footprint touches or overlaps at least one neighbouring footprint, so all food items on the map form one connected trail.
- **SC-005**: A full traversal of the map confirms every decorative object and tree registers a touch on contact, with no exceptions.
- **SC-006**: A person can switch each of the four overlays (food odour, danger odour, heat odour, tile grid) on and off independently, in any combination, and see the display change accordingly every time.
- **SC-007**: Every world configuration shipped with the simulator that a fly can be started in loads the new map and completes a full simulated run with no console errors.

## Assumptions

- The map's overall tile-grid size and tile-to-fly scale are set during design so the full sketch fits without distortion while a tile keeps the same relative size to a fly's body as the simulator's existing maps; no specific tile-count or pixel target was given by the sketch, so these are chosen to serve those two constraints rather than a numeric specification.
- The previous danger sources (standalone "spider" and "lantern" objects) are retired as danger-odour emitters; any such pieces that remain on the map going forward behave only as ordinary decoration that triggers touch, consistent with "only edge forest casts danger odour."
- "Apply it to all implemented worlds" covers every world configuration a fly can actually be started and run in. World files that exist solely to test that the simulator refuses to load a mismatched brain/snapshot pairing keep serving that one purpose and are not in scope for map content.
- Each world's own body, brain snapshot, LIF calibration, and experiment seed settings are untouched by this feature; only the shared map geometry, forest/water placement, food layout and object placement change.
- Brain generations that do not sense danger or heat odour (older brain versions wired to fewer input channels than the newest one) are unaffected by those two fields being present on the map; they continue to behave as before, while brain generations wired to sense them respond to the new calibration.
- The sketch's non-terrain decorative detail (figures, small props scattered for atmosphere) that is not a building, a title, a legend, or an animal is treated as ordinary scenery and rendered with matching atlas decoration pieces where a reasonable match exists, rather than reproduced pixel-for-pixel.
- ~~Sketch terrain with no atlas equivalent is always substituted with the closest available terrain kind~~ *(Bugfix: 2026-10-15 — BUG-001)*: that rule (FR-005) now applies only outside the desert family. `world_map.jpg` is the same reference picture documented by `zrpg-art/examples/WORLD-SPEC.md`; the river, the swamp connector and the edge-forest's river gaps (FR-022–FR-024) follow that document's already-reviewed reading of this exact sketch rather than being re-derived from scratch, and the desert-family regions it also documents (dunes, rocky desert) are deliberately not carried over (FR-025).
