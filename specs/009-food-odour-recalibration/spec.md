# Feature Specification: Food Odour Recalibration

**Feature Branch**: `009-food-odour-recalibration`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "World map requires recalibration: (1) only three edible food objects, each casting odour over a distance proportional to its size, with odour at its maximum on the object; small food is `red_flower_plant`, medium is `jungle-plant-010`, large is `jungle-plant-015`; food is spread so that odour-free areas remain and the fly can still follow odour through the world. (2) Odour is connected to the food units and their size. (3) Remove `jungle-plant-016`, `jungle-plant-017` and `jungle-bush-018` from the map permanently. (4) Declassify `yellow_flower_single`, `yellow_flowers_trio` and `yellow_flowers_cluster` from edible to decor. (5) Make the fly sprite 32×32 and make it look like a fruit fly."

**Governing documents**: [AGENTS.md](../../AGENTS.md) and the [constitution](../../.specify/memory/constitution.md). The odour rules are in [specs/007-odor-layer](../007-odor-layer/spec.md) and [specs/008-hungry-forager-brain](../008-hungry-forager-brain/spec.md). The world format is in [specs/005-world-tileset-environment/contracts/world-format.md](../005-world-tileset-environment/contracts/world-format.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Food Smells Stronger the Bigger It Is (Priority: P1)

A visitor opens the world and turns on the odour layer. ~~Three food objects are visible: a small red flower plant, a medium
orange pod plant and a large plant with a glowing bulb.~~ One or more food objects per size class are visible: a small red
flower plant, a medium orange pod plant and a large plant with a glowing bulb, each class with at least one instance
(BUG-001). Each one gives off a smell. The smell is strongest exactly on the object, falls off to nothing at its edge, and
reaches farther for a large food unit than for a small one. The visitor can see that the smell belongs to each food unit
and grows with its size.

**Why this priority**: Odour is the only signal a fly has for finding food. ~~If there are three food units and their odour
does not reflect their size~~ If the food units' odour does not reflect their size (BUG-001: a class can now hold more than
one unit), the rest of the behaviour (walking to food, eating, leaving when full) has nothing sound to work on.

**Independent Test**: Open the world with the odour layer on. Sample the odour value at each food object's position and at points
at increasing distance from it. Check the peak, the falloff and the reach of each source against the size rule.

**Acceptance Scenarios**:

1. **Given** the world is loaded, **When** the odour value is read at the position of each food object, **Then** it is the
   maximum odour value of the world for that object (it is not beaten by a point next to it).
2. **Given** ~~the three food objects~~ the food objects of the large, medium and small size classes (BUG-001: a class may
   hold more than one object, but they all share that class's reach), **When** their odour reach is compared, **Then** the
   large unit reaches farther than the medium unit, and the medium unit reaches farther than the small unit, in the same
   ratio as their sizes (within 5%).
3. **Given** a point at a distance from a food object that is larger than its reach, **When** odour is read there, **Then** the
   value from that object is zero.
4. **Given** a fly next to a food object, **When** it senses odour, **Then** the odour it receives comes from that food object
   only, and it is stronger than the odour from the same food object at a greater distance.

---

### User Story 2 - Odour Is Patchy, So the Fly Has Somewhere to Go (Priority: P2)

A visitor watches a fly in the world. Large parts of the meadow have no smell at all, so the fly wanders there. The fly enters
a smell, follows it, and reaches a food object. The map is not saturated with odour, so a fly that finds one smell has a route
to it from where it is likely to start.

**Why this priority**: ~~With only three food units, a poor placement either leaves the fly with no odour to follow or
floods the map so the fly never has a reason to move.~~ With one or more food units per size class (BUG-001), a poor
placement either leaves the fly with no odour to follow or floods the map so the fly never has a reason to move. Both make
the behaviour meaningless.

**Independent Test**: Compute the odour field of the world and measure the share of walkable cells with no odour. Measure, for each
food object, whether its odour region is connected to the open walkable cells around the flies' starting area.

**Acceptance Scenarios**:

1. **Given** the world, **When** the odour field is computed, **Then** ~~between 30% and 70%~~ between 30% and 40% of
   walkable cells have an odour value of zero, so odour covers 60% to 70% of walkable cells (BUG-001).
2. **Given** a fly placed at a random walkable cell outside any odour, **When** it moves by walking on walkable cells, **Then** it can
   reach the odour of at least one food object without crossing water or a blocked cell.
3. **Given** the food placement, **When** the placement is checked, **Then** no food object is on water, on a blocked cell or on a
   cell where another food object sits.

---

### User Story 3 - The Map Shows Only the Decor It Should (Priority: P2)

A visitor sees the same map as before, with three objects gone and three yellow flower objects no longer treated as food. The
removed objects do not appear anywhere in the world. The yellow flowers stay on the map as decoration and do not smell and do not
attract the fly.

**Why this priority**: Leftover edible-looking decor makes the odour and the food sources mismatch what the visitor sees. The
removal is permanent, so it must hold for every world that shares this map.

**Independent Test**: Load every world file that shares the map. Check that none of the removed objects appears and that none of
the three yellow flower objects is listed as food or as a stimulus.

**Acceptance Scenarios**:

1. **Given** any world file that shares this map, **When** it is loaded, **Then** `jungle-plant-016`, `jungle-plant-017` and
   `jungle-bush-018` do not appear in it, either as a placed object or as scatter, and the shore decor does not use them.
2. **Given** the world, **When** the edible objects are listed, **Then** ~~they are exactly the three food objects of User
   Story 1~~ every one of them is a small, medium or large food object of User Story 1 (one or more per size class, every
   class present — BUG-001), and none of `yellow_flower_single`, `yellow_flowers_trio`, `yellow_flowers_cluster` is among
   them.
3. **Given** the yellow flower objects are on the map, **When** odour is computed, **Then** they contribute no odour.

**Bugfix**: 2026-10-07 — BUG-001 Follow-up (found by `/speckit-bugfix-verify`). The first BUG-001 patch struck through the
normative requirements (FR-001, FR-003, FR-006, FR-008) but left five narrative sentences asserting the superseded "three
food objects" cardinality (User Story 1's opening and "Why this priority", its Acceptance Scenario 2, User Story 2's "Why
this priority", and User Story 3's Acceptance Scenario 2). Those are now struck through and restated to match one-or-more
instances per size class.

---

### User Story 4 - The Fly Looks Like a Fruit Fly (Priority: P3)

A visitor sees the fly on the map at 32×32, the size of one map cell. It reads as a fruit fly: a round tan abdomen with dark bands,
a dark thorax, two large red eyes, a pair of clear wings and six legs. It faces the way it moves, as the current fly does. The fly
is drawn as a female or a male, matching the anatomical difference shown in the reference image: the female has a longer, evenly
banded abdomen; the male has a shorter body and a solid dark band at the abdomen's tip (BUG-002).

**Why this priority**: The fly is the thing the visitor watches most, but it does not change the behaviour or the odour. It is the
last item because it is visual and does not block the other stories.

**Independent Test**: Render the fly at zoom 1, 2 and 4 and check its size and shape against the description. Show it to a reviewer
who has not seen the brief and ask what it is.

**Acceptance Scenarios**:

1. **Given** the fly is drawn on the map, **When** its sprite is measured, **Then** it is 32 by 32 pixels.
2. **Given** the fly is shown to a reviewer at zoom 2 and zoom 4, **When** the reviewer is asked what it is, **Then** the reviewer names
   a fly or an insect, and points to the red eyes and the wings as the reason.
3. **Given** a fly moves in any direction, **When** it is drawn, **Then** its head points the way it is heading.
4. **Given** a female fly and a male fly are shown side by side at zoom 2 or zoom 4, **When** the reviewer is asked to tell them
   apart, **Then** the reviewer can, pointing to body/abdomen length as the reason, and in both, the wings read as sticking out
   from the body rather than folded flat along it (BUG-002).

---

### Edge Cases

- What happens when a food object is eaten down to zero stock? Its odour falls to zero with its stock (see Assumptions), so an empty
  food object no longer attracts the fly.
- What happens when a food object's odour reaches across a lake or pond? The fly still senses it (the odour is not blocked by water),
  but the fly cannot walk onto water to reach the source. Planning must check that the food is reachable on land.
- What happens when two food objects' odour regions overlap? The values add, as they do for any two sources, and the peak stays at the
  stronger object's position.
- What happens when several instances of the same size class are placed near each other? The same overlap rule applies: their odour
  adds, and each instance keeps the reach its class gets from FR-002. This is how FR-006's 60–70% coverage target is reached when
  one instance per class is not enough (BUG-001, FR-020).
- What happens when a world file still names the old `flower` kind? The file must fail to load with a named error, not fall back silently
  (constitution IV style: named error, no guessing).
- What happens to a world that uses the `mock` or `v0` brain? It must still load and run. Only the food and decor change.
- What happens when the fly is 32×32 and sits in a one-cell gap? The fly is drawn over the map and its logic footprint stays one cell.

## Requirements *(mandatory)*

### Functional Requirements

**Food and odour**

- **FR-001**: The world MUST contain ~~exactly three edible food objects: one small (`red_flower_plant`), one medium
  (`jungle-plant-010`) and one large (`jungle-plant-015`). They are the only edible objects in the world.~~ one or more edible
  food objects per size class: small (`red_flower_plant`), medium (`jungle-plant-010`) and large (`jungle-plant-015`). Every
  size class MUST have at least one instance. No other object is edible (BUG-001: one instance per class reached only about
  50% odour coverage, short of the 60–70% target in FR-006; several instances per class are needed).
- **FR-002**: Each food object MUST emit odour over a reach that is proportional to its size: the reach of the large unit, the
  medium unit and the small unit MUST be in the same ratio as their sizes, within 5%. This reach is per size class: every
  instance of a class shares that class's reach, however many instances the class has (BUG-001).
- **FR-003**: The odour from a food object MUST be at its maximum at the object's position and fall off linearly to zero at its reach.
  The maximum MUST be the same for all ~~three~~ food objects, however many there are; size changes only the reach (BUG-001).
- **FR-004**: The odour of each food unit MUST be tied to that unit: a fly senses the odour of a food unit only through that unit,
  and the odour layer shows the same field the flies sense (existing odour contract, specs/007-odor-layer).
- **FR-005**: The reach and the odour source of each food object MUST be declared in the world configuration. The world code MUST NOT
  hard-code the sprite names, sizes or reaches of the food objects.
- **FR-006**: The food placement MUST leave odour-free areas. ~~Between 30% and 70% of walkable cells MUST have an odour value
  of zero.~~ Between 30% and 40% of walkable cells MUST have an odour value of zero, so odour covers 60% to 70% of walkable
  cells (BUG-001: the one-instance-per-class map measured about 50% coverage; the reporter asked for 60–70%, reached by adding
  instances per class, see FR-001 and FR-020).
- **FR-007**: From every walkable cell that starts a fly (the flies' spawn area), at least one food object's odour MUST be reachable
  by walking on land, without crossing water or a blocked cell.
- **FR-008**: No food object MUST stand on water, on a blocked cell, or on a cell that another food object occupies. This holds
  per instance, not per class: two instances of the same size class MUST NOT share a cell either, even though they MAY stand on
  nearby cells (FR-020, BUG-001).

**Map cleanup**

- **FR-009**: `jungle-plant-016`, `jungle-plant-017` and `jungle-bush-018` MUST be removed from every world file that shares this map,
  from the scatter lists and from the shore decor. No generator, scatter or shore rule may place them again.
- **FR-010**: `yellow_flower_single`, `yellow_flowers_trio` and `yellow_flowers_cluster` MUST NOT be edible. They MAY remain on the map as
  decor. They MUST NOT appear in the stimulus objects and MUST NOT contribute odour.
- **FR-011**: The edible rule that every 16×16 region holds a flower and a danger, and that flowers are at least 6 cells apart, is
  superseded by FR-006 to FR-008 for food, and by FR-020 for the placement of same-class instances (BUG-001, added cross-reference
  only — FR-011 was not otherwise in conflict). The danger rule is unchanged.
- **FR-012**: The art rule that requires `jungle-plant-016` and `jungle-bush-018` to be used (BUG-001) is withdrawn for these two sprites
  only, because FR-009 removes them.

**Fly sprite**

- **FR-013**: The fly sprite MUST be 32 by 32 pixels, the size of one map cell.
- **FR-014**: The fly sprite MUST look like a fruit fly (*Drosophila melanogaster*) seen from above: a round tan abdomen with dark
  bands, a dark thorax, two large red compound eyes, a pair of clear wings ~~, and six legs~~ held out from the body, projecting
  laterally at roughly a right angle to the body's long axis (not swept back and folded flat along the abdomen), and six legs
  (BUG-002: wing angle was unspecified and the shipped art drew the wings running parallel to the body).
- **FR-015**: The fly sprite MUST be drawn head-up, as the current fly sprite is. The fly is not rotated to its heading; rotation is a separate feature (plan D2).
- **FR-016**: The baseline fly sprite MUST use the same 32 by 32 shape as its normal counterpart and differ from it only in colour,
  ~~so the two stay comparable~~ within the same sex variant (FR-021), so the two stay comparable (BUG-002: re-scoped from one
  shape with one baseline to one shape-per-sex, each with its own baseline).
- **FR-021** (new, BUG-002): The fly sprite set MUST include a female and a male variant, distinguished by body and abdomen shape
  per the reference anatomy (female: longer, evenly banded abdomen; male: shorter body, solid dark terminal abdomen band), each
  with its own baseline colour pair (FR-016). Which sex a given fly displays MUST be declared in the world configuration, not
  chosen in code (constitution VI).

**Behaviour and verification**

- **FR-017**: The change to food supply MUST be recorded as a configuration change, with the calibration and held-out results of the
  new map written in this feature's folder. Held-out seeds MUST NOT be used to tune the new food placement.
- **FR-019**: The food sprites (`red_flower_plant`, `jungle-plant-010`, `jungle-plant-015`) MUST NOT be used as scatter or shore decor in any world. Food art appears only where food is.
- **FR-018**: Every world file that shares this map MUST still load with the brain version it names (mock, v0 or v1). The old `flower`
  kind MUST be removed from those files, and a file that still names it MUST fail with a named error.
- **FR-020** (new, BUG-001): The world MAY place several food objects of the same size class near each other so that their odour
  reaches overlap and add, raising the local odour level. This is a placement choice, not a new mechanism: it uses the same
  overlap rule already given for two different-sized food objects (Edge Cases). FR-008's per-cell exclusivity still applies to
  every instance.

**Bugfix**: 2026-10-07 — BUG-001 Revised FR-001, FR-002, FR-003, FR-006 and FR-008, and added FR-020, so that one or more food
objects per size class are allowed and same-class instances may sit near each other to raise local odour. The one-instance-per-
class map measured about 50% odour coverage (`results.md`); the new target is 60%–70%.

**Bugfix**: 2026-10-07 — BUG-002 Revised FR-014 (wing orientation: roughly a right angle to the body axis, not parallel to it)
and FR-016 (baseline colour match is now scoped per sex), and added FR-021 (female and male sprite variants, each with its own
baseline), using the reporter's reference image (`fruit-fly.jpeg`) for the anatomical shape difference.

### Key Entities

- **Food unit**: ~~One of three edible objects.~~ One of one-or-more edible objects per size class (BUG-001). Attributes: size
  class (small, medium, large), sprite, cell position, reach of its odour, stock (it is depleted by eating and regrows slowly,
  as today).
- **Odour source**: The odour a food unit emits. Attributes: position, reach (proportional to its size), peak value (the same for all
  units), and the stock that scales it (see Assumptions).
- **Decor object**: A non-edible object such as the yellow flower objects. It has no odour and is never a stimulus.
- **Fly sprite**: The 32×32 image of the fly. Attributes: ~~the normal sprite and the baseline sprite~~ sex (female or male), the
  normal sprite for that sex, and its baseline sprite (BUG-002, FR-021).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ~~For each of the three food objects~~ For each food object, however many instances exist per size class, the odour
  at its position is the world's maximum, and the reach ratio between the large, medium and small ~~units~~ size classes matches
  their size ratio within 5% (BUG-001).
- **SC-002**: ~~Between 30% and 70%~~ Between 30% and 40% of walkable cells have an odour value of zero in the world's odour field,
  i.e. odour covers 60% to 70% of walkable cells (BUG-001).
- **SC-003**: Every spawn cell of a fly has a walkable path to at least one food object's odour, in every world that shares the map.
- **SC-004**: Zero occurrences of `jungle-plant-016`, `jungle-plant-017` or `jungle-bush-018` in any world file that shares the map, and
  zero yellow flower objects among the edible objects or the stimulus objects.
- **SC-005**: The fly sprite is 32 by 32 pixels, and a reviewer who has not read this spec names it as a fly or an insect at zoom 2 and
  zoom 4.
- **SC-006**: The forager comparison on held-out seeds runs on the new map and reports the brain next to the random walk and the
  size-matched random graph. The result is recorded whether the brain passes or fails, and no code is changed to make a number pass.
- **SC-007**: Every world that shares the map loads, and the tests that check the map (`spread`, `banned-art`, world validation) pass
  after the rules above are updated.
- **SC-008** (new, BUG-002): Shown a female and a male fly sprite side by side at zoom 2 and zoom 4, a reviewer who has not read
  this spec tells them apart and names body/abdomen length as the reason, and describes the wings as sticking out from the body
  rather than lying flat along it (FR-014, FR-021).

**Bugfix**: 2026-10-07 — BUG-001 Revised SC-001 and SC-002 to match the one-or-more-per-class rule (FR-001) and the 60%–70%
odour coverage target (30%–40% odour-free) (FR-006).

**Bugfix**: 2026-10-07 — BUG-002 Added SC-008 for the female/male sprite distinction and the corrected wing angle (FR-014, FR-021).

## Assumptions

- ~~"Only three edible objects" means exactly one food object per size class: one small, one medium and one large. If several
  objects per size were meant, FR-001 and FR-006 change and the spec is revisited.~~ Superseded by BUG-001: several objects per
  size class were meant, to raise odour coverage to 60%–70% of walkable cells. FR-001 and FR-006 are revised accordingly; FR-020
  allows same-class instances to sit near each other so their odour adds.
- ~~The three food objects have the same peak odour.~~ All food objects of a given size class have the same peak odour and the
  same reach, however many instances a class has (BUG-001). Size changes only the reach, so a larger food unit smells farther
  away, not stronger at its centre.
- The reach of each food unit is proportional to its on-screen size, measured by the larger side of its sprite in cells. The
  proportionality constant is set in the world configuration and recorded in the plan.
- A food unit's odour follows its remaining stock, as the bilateral odour already does (`fraction` in the stimulus). An eaten-out
  food unit stops attracting the fly. The stock and regrowth values are the existing ones unless the plan records a change.
- The yellow flower objects stay on the map as decor, placed by the existing decor rules. Only their edible role is removed.
- All world files that share this map (`world.json`, `world-forager.json`, `world-connectome.json`, `world-antennal-lobe.json`) get the
  same food and cleanup, so each still loads. `world-forager-bad.json` stays a version fixture. It moves to world format version 3, so that it still fails on its snapshot version, which is the check it exists for.
- The atlas is not changed. The removed sprites stay in the art catalogue; they are only removed from use in the world.
- The brain is not changed. Changing the food supply changes what the brain senses, so the existing calibration does not carry over. The
  calibration seeds may be used to recalibrate; held-out seeds are used only for the verdict.
- The fly's logic footprint stays one cell. Only the drawn size changes.
