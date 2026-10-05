# Feature Specification: Odour Layer

**Feature Branch**: `007-odor-layer`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Add the odor layer to the world as toggable layer (off by default). The layer uses transparent gradients to show odor intensity at the point in the world."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Show the Odour Field Over the World (Priority: P1)

A visitor watches the flies and wants to know where they can smell food. They turn on the
odour layer. Over the world map, a see-through colour wash appears around each odour source.
The wash is strongest at the source and fades to nothing at the edge of the odour's reach.
Where two sources overlap, the wash is stronger. The terrain, objects and flies stay visible
under the wash.

**Why this priority**: This is the feature. It makes visible the same signal the flies sense, so
the user can relate a fly's movement to the odour around it.

**Independent Test**: Load the default world, turn the layer on, and confirm that a wash is drawn
around every flower, is strongest on the flower, fades with distance, is absent beyond the odour
radius, and leaves the ground and flies visible.

**Acceptance Scenarios**:

1. **Given** the layer is on, **When** the world is drawn, **Then** every point within the odour
   radius of a source is tinted, and the tint is stronger the closer the point is to the source.
2. **Given** the layer is on, **When** a point is farther than the odour radius from every source,
   **Then** that point has no tint.
3. **Given** the layer is on and two sources are close together, **When** their ranges overlap,
   **Then** the overlap is tinted more strongly than either range alone at the same distance.
4. **Given** the layer is on, **When** the world is drawn, **Then** terrain, objects and flies remain
   recognisable under the tint, and flies are drawn above the tint.
5. **Given** the layer is on, **When** the user pans or zooms, **Then** the tint stays aligned with
   the sources and moves with the world.

---

### User Story 2 - Turn the Odour Layer On and Off (Priority: P1)

The world opens with the odour layer off, so the map looks as it does today. A clearly
labelled control turns the layer on, and the same control turns it off again. The control
shows whether the layer is on or off.

**Why this priority**: The request requires the layer to be optional and off by default. Without
the toggle, the layer cannot be shown at all.

**Independent Test**: Load the app and confirm no tint is drawn. Use the control to turn the layer on
and confirm the tint appears; use it again and confirm the tint is gone.

**Acceptance Scenarios**:

1. **Given** the app has just loaded, **When** the world is drawn, **Then** the odour layer is off and
   the world looks the same as without this feature.
2. **Given** the layer is off, **When** the user activates the odour layer control, **Then** the tint
   appears on the next frame and the control shows the layer as on.
3. **Given** the layer is on, **When** the user activates the control again, **Then** the tint is
   removed on the next frame and the control shows the layer as off.
4. **Given** the user toggles the layer, **When** the flies are running, **Then** the flies' behaviour
   and the simulation are not affected.

---

### User Story 3 - Read the Odour Level at a Point (Priority: P3)

With the layer on, the user can tell how strong the odour is in a region by its colour, using a
small legend that maps the lightest and strongest tint to the low and high ends of the odour
scale.

**Why this priority**: It turns the picture into something the user can compare with the input
bars in the fly status panel. The layer is still useful without it.

**Independent Test**: Turn the layer on, look at the legend, and confirm the tint on a flower
matches the legend's high end and the tint near the edge of the radius matches the low end.

**Acceptance Scenarios**:

1. **Given** the layer is on, **When** the legend is shown, **Then** it shows the tint scale from no
   odour to the strongest odour, with the values at each end.
2. **Given** the layer is off, **When** the world is shown, **Then** the legend is hidden.

---

### Edge Cases

- The world has no odour sources: turning the layer on draws no tint, and the control still works.
- Overlapping sources sum above the sensed maximum: the tint is capped at the strongest colour, the
  same way the sensed value is capped.
- A source lies near the edge of the world: the tint is clipped at the world edge and is not drawn
  outside the map.
- The odour radius or the source kinds change in the world configuration: the layer follows the new
  values with no change to the layer itself.
- The layer is on at the smallest and largest zoom levels: the gradient stays smooth enough to read,
  and its edge stays at the odour radius.
- Dark and light colour themes: the tint is visible on the terrain in both.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The world view MUST provide an odour layer drawn over the terrain and objects and
  under the flies.
- **FR-002**: The odour layer MUST be off when the app loads.
- **FR-003**: The user MUST be able to turn the odour layer on and off with one labelled control,
  and the control MUST show the current state.
- **FR-004**: The odour shown at each point MUST be the same odour field the flies sense at that
  point: the same sources, the same radius, the same falloff with distance and the same summing of
  overlapping sources.
- **FR-005**: The layer MUST show odour intensity as a semi-transparent tint whose opacity (or
  colour strength) grows with intensity, changing smoothly with no hard bands at normal zoom.
- **FR-006**: Points with zero odour MUST have no tint, so the layer leaves the world unchanged away
  from sources.
- **FR-007**: The tint MUST be capped at the sensed maximum; intensities above it MUST show the
  strongest tint.
- **FR-008**: The strongest tint MUST still leave terrain, objects and flies recognisable beneath
  or above it.
- **FR-009**: The layer MUST stay aligned with the world when the user pans or zooms.
- **FR-010**: Turning the layer on or off MUST NOT change the simulation, the flies' sensory input,
  or their behaviour.
- **FR-011**: The layer MUST take its sources, radius and maximum from the world configuration, so a
  world with different odour settings needs no change to the layer.
- **FR-012**: When the layer is on, a legend MUST show the tint scale from no odour to the maximum,
  with the value at each end. The legend MUST be hidden when the layer is off.
- **FR-013**: The tint colour and its strength MUST be defined for both light and dark themes.
- **FR-014**: With the layer on, the world MUST keep drawing at its normal frame rate.

### Key Entities *(include if feature involves data)*

- **Odour source**: A world object whose kind is listed as an odour (stimulus) source in the world
  configuration, for example a flower. Has a position in the world.
- **Odour field**: The odour intensity at every point of the world: the sum over sources of a value
  that is highest at the source and falls to zero at the odour radius. The same field feeds the
  flies' sensory input.
- **Odour layer state**: Whether the layer is on or off for the current viewer. Starts as off.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On load, the world is drawn with no odour tint in 100% of loads.
- **SC-002**: The user can turn the layer on or off in one action, and the change is visible within
  one frame.
- **SC-003**: At any sampled point, the tint strength agrees with the odour value a fly at that point
  would sense, to within one step of the visible tint scale.
- **SC-004**: With the layer on, no tint appears farther than the odour radius from every source, in
  100% of sampled points.
- **SC-005**: With the layer on, the world keeps its normal frame rate, with no visible stutter while
  panning or zooming.
- **SC-006**: Toggling the layer any number of times during a run leaves the flies' sensory values
  and positions identical to a run where the layer is never toggled, for the same seed.

## Assumptions

- **Odour sources**: The odour sources are the objects the world configuration already names as the
  fly stimulus (today: flowers), with its radius and maximum. This feature adds no new odour kinds.
- **Static field**: Sources do not move or get used up today, so the field does not change during a
  run. If sources later become dynamic, the layer is expected to follow them.
- **Single odour**: There is one odour channel today. Showing several odours with separate colours is
  out of scope until the world declares more than one.
- **Control location**: The toggle sits with the world view controls, in the panel's World tab or on
  the world area itself; the exact place is a planning decision. A keyboard shortcut is optional.
- **Persistence**: The on/off state is not required to survive a page reload; the layer is off again on
  each load, as the request asks.
- **Colour**: One tint colour, chosen to stand out from the terrain palette in both themes. The exact
  colour is a planning decision.
