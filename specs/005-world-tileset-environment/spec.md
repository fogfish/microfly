# Feature Specification: Detailed World Tileset and Diverse Environment

**Feature Branch**: `005-world-tileset-environment`

**Created**: 2026-10-04

**Status**: Draft

**Bugfix**: 2026-10-05 — BUG-001 Sand removed, honey removed, sprite roles, shore overlays with rotation, fly size and world-file migration added (FR-024 to FR-027, SC-010, SC-011).

**Bugfix**: 2026-10-05 — BUG-002 Water bodies redefined after the art pack's water spec (`zrpg-art/examples/WATER-SPEC.md`): one medium lake and 2–3 small ponds, a natural waterline from a signed-distance field, grass shore bands, a bank face and decor that straddles the waterline. Raw and rotated shore plants are removed. Water stays fully static (FR-005, FR-011, FR-012, FR-015, FR-016, FR-024, FR-025 updated; FR-028 to FR-031, SC-012 added; SC-004, SC-006, SC-010 updated).

**Bugfix**: 2026-10-05 — BUG-003 Flowers and dangers spread over the whole map, and `fire` (`jungle-prop-002` campfire logs) removed as a danger kind. The dangers are the spider stand-in and the oil lantern (FR-009 updated; FR-032, SC-013, User Story 5 scenario 6 added; assumption "Edibles and dangers keep their meaning" updated).

**Input**: User description: "The world is large for six inhabitants and lack pixel perfect details to be expected for moder RPG style games. The new details assets for the world constructions has been released into `public/assets/atlas`. This change is also driving an ability to represent a real maps in the future. Adopt the new tileset and create a diverse map environment: with water and rocks on the shore; grass with plantsm flowers and bushes; standalone trees and mid size group of trees."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a Detailed, Compact World Sized for Six Flies (Priority: P1)

A visitor opens the app and sees a smaller, detailed top-down world drawn with the new
RPG-style art instead of the old coarse arcade tiles. The ground is grass with visible
texture variation, so it does not look like one repeated square. Every pixel is drawn
sharply at every zoom level. The world is small enough that the six flies are easy to find
and often meet each other.

**Why this priority**: This is the core visual change. Switching to the new art and reducing
the world size fixes both problems in the request ("too large for six inhabitants" and "not
pixel-perfect"). Every other story builds on this one.

**Independent Test**: Open the app, check that the ground is drawn with the new grass art,
that no old-tileset art is visible, that pixels stay sharp (no blur) when zooming in and out,
and that the whole world can be seen in at most a few screens at default zoom with the six
flies inside it.

**Acceptance Scenarios**:

1. **Given** the app is opened, **When** the world finishes loading, **Then** all terrain and
   scenery are drawn with art from the new tileset, and no art from the previous terrain
   sheet is visible.
2. **Given** the world is displayed, **When** the user zooms in to the maximum zoom, **Then**
   individual art pixels appear as sharp, evenly sized squares, with no blur and no gaps or
   seams between ground tiles.
3. **Given** the world is displayed at default zoom on a typical laptop screen, **When** the
   user pans, **Then** the whole world can be covered in no more than about four screen
   widths, and all six flies are inside the world.
4. **Given** a large area of grass, **When** the user looks at it, **Then** it shows varied
   grass tiles and patches of lighter meadow or darker grass, not a single repeated tile.

---

### User Story 2 - Water Bodies with Rocky Shores (Priority: P2)

The world contains bodies of water such as a pond, a lake or a stream. The map is static: the
water surface is a still image and only the flies move. ~~Shorelines run from water to sand to grass, using the tileset's sand rings where a basin fits. Where no sand ring fits an outline, the shore is lined with rocks, boulders and pebbles~~ ~~Shorelines are lined with shore overlay art: transition plants and rocks (see FR-012), so the border looks natural and not like a hard square edge.~~ Each water body has a smooth, slightly ragged waterline, a band of lush grass of varying width around it, a low earth bank on its north side, and reeds, stones and plants that stand across the waterline (see FR-012, FR-028 to FR-030). The world has one medium lake and a few small ponds (BUG-002). Sand is not used (BUG-001).

**Why this priority**: Water is the most noticeable landmark and is already part of the
world's meaning (flies cannot enter it). It is the first terrain feature named in the
request.

**Independent Test**: Open the app, find each water body, and check that the water is a still
texture with no animation, and that its shoreline has ~~sand, rock or pebble~~ ~~shore plant and rock art along its
whole length with no gaps~~ a natural waterline with no square corners or long straight edges, a
lush grass band and shore decor along its whole length (BUG-002).

**Acceptance Scenarios**:

1. **Given** the world is displayed, **When** the user looks at a water body, **Then** its
   surface is a static texture that does not move, and no seam is visible where the texture
   repeats.
2. **Given** a water body, **When** the user follows its shoreline, **Then** ~~sand, rocks,~~ ~~shore plants and rocks,
   boulders or pebbles cover the water–grass border, and~~ the waterline is curved and slightly ragged, a lush
   grass band of varying width runs along it, and no straight, bare square edge between
   water and grass is visible (BUG-002).
3. **Given** the world has ~~at least two water bodies~~ one medium lake and 2–3 small ponds (BUG-002), **When** the user compares them,
   **Then** they have different shapes and sizes.
4. **Given** a fly moves toward water, **When** it reaches the shore, **Then** water and shore
   rocks keep the same effect on flies as water and rocks had before this change.
5. **Given** a water body, **When** the user looks at its north bank (land above the water on
   screen), **Then** a low bank face with a dark line under it is visible, and its south bank
   shows a light rim instead (BUG-002).
6. **Given** a fly next to a water body, **When** it moves, **Then** it is stopped where water
   is drawn and can walk where grass is drawn, so the drawn shore and the fly's blocked cells
   agree (BUG-002).

---

### User Story 3 - Lively Grass with Plants, Flowers and Bushes (Priority: P2)

Open grass is dressed with small vegetation: grass tufts, flowers, sprouts, ferns and bushes.
Vegetation is spread unevenly, with denser clusters and open clearings, so the meadow looks
natural and not like a uniform grid of decorations.

**Why this priority**: Ground detail is what makes the world look like a modern RPG map.
It is named directly in the request.

**Independent Test**: Open the app, look at several grass areas, and check that plants,
flowers and bushes of several kinds are present, that they form clusters and clearings, and
that none sit on water.

**Acceptance Scenarios**:

1. **Given** the world is displayed, **When** the user looks at any open grass area of about
   one screen, **Then** at least three different kinds of small vegetation (for example
   flowers, tufts and bushes) are visible.
2. **Given** vegetation on grass, **When** the user looks across the meadow, **Then** some
   areas have dense clusters and others are open clearings.
3. **Given** the world is displayed, **When** the user looks at water bodies, **Then** no
   flower, plant or bush is drawn on open water.

---

### User Story 4 - Standalone Trees and Groves (Priority: P3)

The world has single trees standing alone on the grass and several medium-size groups of
trees (groves) of about 4 to 12 trees close together. Trees use several sizes and shapes.
Overlapping trees are drawn in the right front-to-back order, so a tree closer to the viewer
covers the one behind it.

**Why this priority**: Trees give the map structure and landmarks. They add a lot of
character, but the world can already be shown without them.

**Independent Test**: Open the app, count the standalone trees and the groves, and check that
trees in a grove overlap correctly with the nearer tree in front.

**Acceptance Scenarios**:

1. **Given** the world is displayed, **When** the user surveys it, **Then** there are several
   standalone trees and at least two groves of 4 to 12 trees each.
2. **Given** two trees overlap, **When** one stands lower on the screen (closer to the
   viewer), **Then** that tree is drawn in front of the other.
3. **Given** the world is displayed, **When** the user looks at trees, **Then** at least three
   different tree sizes or shapes are visible, and no tree trunk stands on water.
4. **Given** a fly is under or near a tree, **When** the world is drawn, **Then** the fly is
   still visible and is not hidden behind the canopy.

---

### User Story 5 - Describe the Map Explicitly in the World Definition (Priority: P3)

A developer opens the world definition file and can read, and edit, where each water body,
shoreline, terrain area, plant, bush and tree is. The map is described by explicit positions
and shapes, not only by random scatter rules. This is the step toward building worlds from
real maps later. Art is referenced by its name in the new tileset's catalogue.

**Why this priority**: It prepares future work (real maps) and keeps the world data-driven.
The visible result for users is the same with or without it, so it comes after the visual
stories.

**Independent Test**: Edit the definition to move one tree and change the outline of one water
body, reload, and check that exactly those changes appear. Load the same definition twice
and check that both worlds are identical.

**Acceptance Scenarios**:

1. **Given** a world definition, **When** the developer moves one placed object to new
   coordinates and reloads, **Then** that object appears at the new place and nothing else
   in the world changes.
2. **Given** a world definition, **When** the developer changes the outline of a water body
   and reloads, **Then** the water and its shoreline follow the new outline.
3. **Given** a world definition that references an art name missing from the tileset
   catalogue, **When** the app loads, **Then** a clear error names the missing art and the
   entry that uses it, and no partial world is drawn.
4. **Given** the same world definition, **When** it is loaded twice, **Then** both worlds are
   identical.
5. **Given** a world definition in the previous format version, **When** the app loads it,
   **Then** the app shows a clear message that the version is not supported.
6. **Given** the default world, **When** the user surveys it, **Then** flowers and dangers
   appear in every part of the map, not in a few spots, and no campfire logs are shown as a
   danger (BUG-003).

---

### Edge Cases

- **Big sprites near the world edge**: a tree or rock near the boundary may extend past the
  edge. It is clipped at the world boundary and never makes the world larger.
- **Overlapping placements**: two solid objects (trees, boulders) placed on the same spot in
  the definition are both drawn in front-to-back order. A clear warning names them, so the
  author can fix the map.
- **Objects on water**: a tree, bush, plant, edible item or danger placed on open water is
  rejected with a clear error that names the entry. ~~Shore rocks, pebbles and transition plants are allowed on
  the water–grass border.~~ Shore decor placed by the shore rules (reed beds, waterline stones,
  tufts) is allowed on the waterline (BUG-002).
- **Tiny water bodies**: a water body too small to show its shoreline ~~(smaller than 2 × 2
  logic cells)~~ is rejected with a clear error. A body smaller than the pond range of FR-011
  (half-width below 60 px) is too small: its shore band and decor would cover the water (BUG-002).
- **Art fails to load**: if the tileset image or catalogue cannot be loaded, the app shows a
  clear error and does not draw a partial world.
- **Window resize or extreme zoom**: pixel sharpness and seam-free ground are kept at every
  allowed zoom level and window size.
- **Hidden flies**: flies, edible items and dangers stay visible and identifiable on top of
  the more detailed scenery. Dense vegetation never hides them completely.
- **Fruit art not found**: the new tileset has no standalone fruit pickup. ~~Honey and~~ flowers
  serve as the edible kinds until a fruit sprite is confirmed. Palm trees that carry fruit are
  scenery, not pickups.

## Requirements *(mandatory)*

### Functional Requirements

**Art and rendering**

- **FR-001**: The world MUST draw all terrain and scenery with art from the new tileset in
  `public/assets/atlas`, referenced by the catalogue identifiers. The previous terrain sheet
  MUST NOT be used for terrain or scenery.
- **FR-002**: Art MUST be shown pixel-perfect: every art pixel shows as a sharp square of the
  same size, with no smoothing or blur, at every allowed zoom level.
- **FR-003**: Ground MUST be drawn without visible seams, gaps or background showing between
  adjacent ground cells, at every allowed zoom level.
- **FR-004**: Grass ground MUST use at least three grass tile variants and MUST include larger
  patches (lighter meadow or darker grass), so no large area shows a single repeated tile. Variants MUST differ visibly in colour and detail; a single solid-colour tile does not count as a variant (BUG-001).
- **FR-005**: Water MUST be drawn with a single static frame of the tileset's water texture.
  The map MUST NOT animate: only the flies move. No visible seam may appear where the water
  texture repeats. Only `water-water-001` is used. The texture does not drift, and foam, if
  drawn, is one fixed pattern that never changes. The water is drawn once with the rest of the
  static scene (BUG-002).
- **FR-006**: Objects that stand on the ground (trees, bushes, rocks, plants) MUST be drawn in
  front-to-back order by their foot point, so an object lower on screen covers objects
  behind it.
- **FR-007**: Shadows built into the art MUST be the only shadows shown. No extra shadow may be
  added to them.
- **FR-008**: Flies, edible items and dangers MUST stay visible above the scenery and MUST NOT
  be fully hidden by trees, bushes or plants.
- **FR-009**: Edible items MUST be ~~honey (bee hive) and~~ flowers, using art from the new tileset (BUG-001: honey removed).
  Dangers MUST be ~~fire (campfire logs),~~ a spider stand-in (skull on a spear with a banner) and
  an oil lantern on a post, using art from the new tileset. `jungle-prop-002` (campfire logs) MUST NOT be used as a danger, and there is no `fire` kind (BUG-003). Each kind MUST stay clearly distinct
  from the scenery and from the other kinds. Fruit is added once a fruit sprite is confirmed.

**World size and composition**

- **FR-010**: The default world MUST be much smaller than today's, in proportion to six flies:
  at default zoom on a 1440×900 screen, the whole world fits within about four screen widths
  and three screen heights.
- **FR-011**: ~~The default world MUST contain at least two water bodies of different shape and
  size, at least one of them a natural shape (pond or lake), not a rectangle.~~ The default world
  MUST contain exactly one medium lake and 2 to 3 small ponds, all natural shapes of different
  size (BUG-002). A **lake** has a half-width `rx` of 180 to 260 px, `ry/rx` of 0.55 to 0.65,
  wobble 0.14 to 0.24 and 5 to 7 harmonics. A **pond** has `rx` of 60 to 100 px, `ry/rx` of
  0.65 to 0.8, wobble 0.08 to 0.14 and 3 to 5 harmonics (art pack `lakes.md`, `ponds.md`). Each
  body has room around it for its shore band and north-bank decor.
- **FR-012**: Every water–grass border MUST be lined along its full length with shore art from
  the tileset. ~~Where an outline fits a sand ring, the border MUST run water → sand → grass. Where it does not, the border MUST use rock, boulder or pebble art, mixing at least three different rock or pebble kinds.~~ ~~The border MUST use the shore set: transition plants `beach-plant-001` and `beach-plant-003` (rotated where needed) on the grass beside the water, mixed with decoration plants `beach-plant-013` to `beach-plant-017` nearby, using at least three different kinds.~~ No sand is used (BUG-001). (Superseded by BUG-002: the transition plants are rectangular blocks, and rotating them is an anti-pattern in the art pack's water spec). Every water–grass border MUST use the **grass shore style** of the art pack's water spec (WATER-SPEC §4.3): a lush grass band (`rocks2-terrain-020`) of varying width, 4 to 11 px, with a ragged outer edge; a mud line at the waterline; and shore decor from FR-030 that stands across the waterline at least once every 60 to 100 px of shoreline (BUG-002).
- **FR-013**: Open grass MUST be dressed with small vegetation of at least three kinds
  (for example flowers, tufts, sprouts or ferns) and with bushes of at least two kinds.
  Vegetation MUST form denser clusters and open clearings.
- **FR-014**: The default world MUST contain at least five standalone trees and at least two
  groves of 4 to 12 trees each, using at least three different tree sizes or shapes.
- **FR-015**: Trees, bushes, plants, edible items and dangers MUST NOT stand on open water.
  ~~Shore rocks, pebbles and transition plants MAY lie on the water–grass border.~~ Shore decor
  placed by the shore rules of FR-030 MAY stand on the waterline (BUG-002).
- **FR-016**: Water and solid scenery (trees, large rocks) MUST keep the same effect on flies
  (blocked or passable, and sensory meaning) that water and solid scenery have today.
  A logic cell is water when the drawn water shape covers the cell centre (signed distance
  `S < 0` there), so the fly's water cells match the drawn water (BUG-002).

**World definition**

- **FR-017**: The world definition MUST describe the map explicitly: the outline of each water
  body and terrain area, and the position and art of each placed object (trees, groves,
  bushes, plants, shore rocks, edible items and dangers).
- **FR-018**: The world definition MAY also give scatter rules (for example "flowers at this
  density inside this area"). Results MUST come from a seed stored in the definition, so the
  same definition always gives the same world.
- **FR-019**: The world definition MUST place features in cells that do not depend on the art's
  pixel size, so a future map importer can place features without knowing the art sizes. The
  scene and the fly's logic grid MUST be separate layers: scenery is drawn at its native size,
  and flies move and sense on a coarser logic grid.
- **FR-020**: The world definition MUST carry a new format version. The app MUST refuse a
  definition with an unsupported version and show a clear message.
- **FR-021**: When the definition references unknown art, places a forbidden object on water,
  or describes an invalid shape, the app MUST show a clear message that names the entry and
  the problem, and MUST NOT draw a partial world.
- **FR-022**: Editing the world definition and reloading MUST change the world, with no code
  change or build step.
- **FR-023**: The asset attribution file MUST credit the new tileset and list which parts of it
  the world uses.

**Art roles, fly size and world files (BUG-001)**

- **FR-024**: Each catalogue sprite MUST have one role. A **terrain** sprite is a ground-level tile, drawn in the ground layer on the 32 px cell grid, and may be layered. A terrain sprite MAY also be drawn as a world-aligned texture through a shore band mask, or as a ground decal centred on a point (BUG-002, WATER-SPEC §3.1, §6.1). An **overlay** sprite (classes `rock`, `plant`, `bush`, `tree`, `prop`) is drawn over terrain and water, placed by its foot point, and sorted by `y`. Overlays MUST NOT be drawn as ground fill. The solid-colour tiles `rocks2-terrain-004` to `rocks2-terrain-007` MUST NOT be used. `outcrop_medium_grass` (`rocks2-rock-035`) is an overlay.
- **FR-025**: ~~An overlay sprite MAY be drawn rotated by 90°, 180° or 270° about its foot point when the shore layout needs it. Rotation is deterministic and MUST NOT be applied to terrain tiles.~~ Sprites MUST NOT be rotated or mirrored. Their shadows are baked in and fall to the right, so turning them breaks the lighting (BUG-002, WATER-SPEC §6.4).
- **FR-026**: Each fly MUST be drawn as a 22 × 22 px sprite, one art pixel per px at 1×, and is scaled with the scenery at the same integer zoom.
- **FR-027**: The app MUST load the world file named by `?world=` (default `world/world.json`). Every accepted world file MUST be format version 2. `world/world-connectome.json` MUST be migrated to version 2, keeping its connectome section unchanged for the brain. A file in another version MUST be refused with the message in FR-020, naming the file and the version.

**Water bodies (BUG-002)**

- **FR-028**: Each water body MUST be described as a smooth shape (a wobbly ellipse: centre,
  half-widths, wobble, harmonics; in cells) and rasterised into a pixel mask. The waterline
  MUST be derived from the signed distance `S` to the edge of that mask, roughened by seeded
  noise of 1 to 1.6 px. Water is drawn where `S < 0`. The waterline MUST have no straight run
  longer than about 24 px and no 90° corners. Water MUST NOT be filled per logic cell.
- **FR-029**: Each water body MUST show depth in the 3/4 view: a bank face of 2 to 4 px (earth
  texture, hole-filled `beach-terrain-007` with a brown tint) with a dark waterline and a bank
  shadow under it where land lies above the water on screen, and a light rim where land lies
  below. The water has a green tint and dithered shallow steps near the shore. Soft
  transitions use ordered dithering, never anti-aliased blur (FR-002).
- **FR-030**: Shore decor MUST follow the grass shore rules of WATER-SPEC §4.3 and the
  placement algorithm of §6.1: reed beds cut from `beach-plant-003` or `beach-plant-002` into a
  natural clump (never placed as raw rectangles; at most one on each pond), waterline stones
  `rocks2-rock-013` and `rocks2-rock-011`, tufts, sprigs, ferns and wild flowers, each in its
  band, with the spacing given there. Decor that stands in water gets a ripple ring under it.
  Decor joins the overlay layer sorted by foot `y` (FR-006). `beach-plant-001` is not used.
- **FR-031**: All water randomness (outline harmonics, waterline noise, band widths, decor)
  MUST come from the world seed, so the same definition always gives the same water and shore
  (FR-018). The pipeline follows the art pack's reference `water.js`; where this spec and
  WATER-SPEC differ, this spec wins only on animation (none) and on the world's sprite bans.

**Edibles and dangers (BUG-003)**

- **FR-032**: Edible flowers and dangers MUST be spread over the whole default world, not
  grouped in a few spots. Split the map into 3 × 2 regions of equal size (16 × 16 cells in the
  48 × 32 world). Every region MUST hold at least one flower and at least one danger. No two
  flowers may be closer than 6 cells (twice the stimulus radius), so their stimulus areas do
  not overlap. The default world MUST hold at least 6 flowers and at least 5 dangers, and both
  danger kinds MUST appear. All of them stay off water and outside the shore band (FR-015).
  Decorative scatter and shore decor MUST NOT use the edible flower sprites (`trees-plant-001` to
  `trees-plant-003`), so an edible flower stays distinct from the scenery (FR-009).

### Key Entities *(include if feature involves data)*

- **Tileset Catalogue**: The published list of art pieces in the new tileset. Each piece has
  an identifier, a class (tree, bush, plant, rock, terrain, prop, water), a size, a foot point
  and a flag for built-in shadow. It is read-only for this feature.
- **World Definition**: The map description. It has a format version, name, size in world
  units, seed, zoom limits, ground areas, water bodies, placed objects, optional scatter
  rules, flies, edible items and dangers.
- **Ground Area**: A region of ground with a terrain kind (grass, meadow, dark grass and
  similar) and an outline. Unassigned ground defaults to base grass.
- **Water Body**: A region of water with an outline. Its border becomes a shoreline that is
  dressed with ~~shore rocks~~ a grass shore band, a bank face and shore decor (BUG-002). It is a
  lake or a pond, by size (FR-011).
- **Placed Object**: One piece of scenery at an explicit position. It has an art identifier
  and a position at its foot point. It may belong to a group (for example a grove).
- **Grove**: A named group of 4 to 12 trees close together, described in the definition.
- **Scatter Rule**: A rule that fills an area with a kind of vegetation at a given density,
  driven by the world seed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a viewing check at minimum, default and maximum zoom, zero blurred pixels and
  zero ground seams are visible.
- **SC-002**: At default zoom on a 1440×900 screen, a user can pan from one edge of the world
  to the opposite edge within 4 screen widths horizontally and 3 screen heights vertically.
- **SC-003**: With six flies in the default world, at least two flies are on screen together
  in at least half of random snapshots taken at default zoom over one minute.
- **SC-004**: ~~Following every shoreline of the default world shows 0 gaps where bare grass
  touches water with no shore rock, pebble or transition plant.~~ Following every shoreline of
  the default world shows 0 straight waterline runs longer than about 24 px, 0 square corners,
  and at least one decor item standing across the waterline in every 100 px of shoreline
  (BUG-002, WATER-SPEC §8).
- **SC-005**: In a viewing check, at least 8 of 10 viewers describe the world as "a detailed
  RPG-style map" rather than "a simple arcade grid", and name water, rocks, flowers, bushes,
  standalone trees and groves without prompting.
- **SC-006**: The map stays still while only the flies move: over 30 seconds of viewing, no
  scenery or water changes position or appearance. This includes the water texture, its drift
  and the foam (BUG-002).
- **SC-007**: The world loads and is ready to explore in under 3 seconds on a typical modern
  laptop, and pan and zoom respond within 100 milliseconds, with six flies running.
- **SC-008**: A developer can move one tree and reshape one water body by editing only the
  world definition, in under 5 minutes, with zero code edits. Loading the same definition
  twice gives identical worlds in 100% of trials.
- **SC-009**: Every invalid definition in a test set (unknown art, object on water, bad
  version, bad shape) gives a clear error that names the entry, in 100% of trials, with no
  partial world drawn.

- **SC-010**: A check of the default world and its code finds zero uses of the sprites banned by FR-024 (`rocks2-terrain-004` to `rocks2-terrain-007`, `beach-terrain-001`, `beach-terrain-002`), zero shore uses of `beach-rock-001` to `beach-rock-003`, and zero uses of honey, in 100% of runs. It also finds zero uses of `beach-plant-001`, zero raw (unclipped) placements of `beach-plant-002` or `beach-plant-003`, zero rotated or mirrored sprites, and zero uses of the water animation frames `water-water-002` to `water-water-021` (BUG-002).
- **SC-011**: `?world=world/world-connectome.json` loads and draws the same way as the default world, with no version error.
- **SC-012**: In a viewing check of the default world, a viewer finds one lake and 2 to 3 ponds,
  and every item of the WATER-SPEC §8 self-check passes except the motion items (foam and
  texture motion), which are replaced by "nothing moves" (BUG-002).
- **SC-013**: A check of the default world and `world-connectome.json` finds, in 100% of runs:
  at least one flower and one danger in each of the 6 map regions of FR-032, no two flowers
  closer than 6 cells, at least 6 flowers and 5 dangers, zero `fire` entries, zero uses of
  `jungle-prop-002` as a danger, and zero decorative uses of `trees-plant-001` to
  `trees-plant-003` (BUG-003).

## Assumptions

- **Tileset as delivered**: The atlas image and catalogue in `public/assets/atlas` are used as
  delivered and are not edited by hand, as their documentation requires. Art is drawn from
  the single atlas image using the catalogue's rectangles and foot points.
- **Default world size**: About 48 × 32 ground cells of 32 art pixels (1536 × 1024 art pixels),
  compared with today's 100 × 100 cells of 16 pixels. The exact size is set in the world
  definition and can be tuned.
- **Shoreline (BUG-002)**: The atlas has no water edge or corner tiles, so water cannot be
  built from tiles. Water and shores follow the art pack's water spec
  (`zrpg-art/examples/WATER-SPEC.md`, reference `water.js`), using its grass
  shore style. Its rocky and sand styles, rivers and islands are out of scope.
- ~~**Shoreline with sand and rock**~~ (superseded by BUG-002): The tileset's sand rings (a sand ring with a hole, in two
  sizes) ~~give a water → sand → grass border for basins that fit them.~~ Sand is not used (BUG-001). Basins that do not fit
  use rock, boulder and pebble art along the border, as the request asks ("water and rocks on
  the shore"). ~~Whether the rings look natural is confirmed by a viewing check.~~
- **Hand-authored default map**: The default world is a hand-authored map in the new explicit
  format. Scatter rules are allowed for small vegetation inside authored areas, to keep the
  file readable. Fully procedural worlds (the old blob and noise generation) are no longer
  the default.
- **Edibles and dangers keep their meaning, with new art**: ~~Honey and flowers are edible;~~ Flowers are the only edible kind (BUG-001, honey removed);
  ~~fire,~~ the spider stand-in and the oil lantern are dangers (BUG-003: fire removed; the
  catalogue has no other fire art). Their behaviour and meaning are
  unchanged, and they use art from the new tileset. The six flies keep their behaviour. Their
  placement and count are adapted to the smaller world, and they are spread over the whole
  map (FR-032, BUG-003).
- **No elevation**: Cliffs, mesas, plateaus and other height features in the tileset are out of
  scope. The world stays flat. Sand, gravel, cobblestone, jungle plants, crystals and props
  (logs, signposts, tents) may be used as optional decoration but are not required.
- **Real maps are future work**: Importing real geographic or tiled map data is out of scope.
  This feature only makes the world definition explicit and independent of art size, so such
  an importer can be added later.
- **Zoom**: The camera keeps mouse pan and cursor-anchored wheel zoom. Zoom uses whole-number
  steps only (1×, 2×, 3×, 4×), so every art pixel stays an even square (see FR-002). This
  settles the open question about integer-only zoom.
- **Static delivery**: Consistent with the constitution, the world stays static files (HTML,
  JavaScript, JSON, images), runs with `python3 -m http.server`, and needs no build step or
  backend.
- **Fly-world contract**: Flies still sense and act through the world interface. The kinds that
  flies sense (water, solid scenery, edible, danger) keep their meaning. The edible kinds named
  in the stimulus change to flowers only (BUG-001), so the stimulus mapping in the world definition
  changes, while brain snapshots need no change.
