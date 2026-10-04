# Feature Specification: Arcade World Setup

**Feature Branch**: `001-arcade-world-setup`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Setup the infrastructure for the app development. Create a world in the style of 90x arcade games. The world is scrollable and zoomable with mouse. The world has grass, trees, water, rocks, etc. It has readable elements fruits, honey and danger fires, spiders. The world is renderable in the browser and configurable via json so that in the future it can be changed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore a Retro Arcade World in the Browser (Priority: P1)

A developer or visitor opens the app in a web browser and sees a top-down, pixel-art world in the style of classic 90s arcade games. The world is made of recognizable terrain: grass, trees, water, rocks, and similar scenery. They can pan across the world by dragging with the mouse and zoom in or out with the mouse wheel, with the zoom centered on the cursor.

**Why this priority**: This is the core deliverable. Without a rendered, navigable world there is nothing else to build on. It also establishes the visual identity and the infrastructure every later feature depends on.

**Independent Test**: Open the app in a browser, confirm the world renders with all required terrain types, then drag to pan across the whole world and use the mouse wheel to zoom in and out. The world is fully usable without any other feature being present.

**Acceptance Scenarios**:

1. **Given** the app is opened in a supported browser, **When** the page finishes loading, **Then** the world is visible with grass, trees, water, and rocks clearly distinguishable from one another.
2. **Given** the world is displayed at its default zoom, **When** the user drags with the mouse, **Then** the view pans smoothly in the drag direction and the user can reach every edge of the world.
3. **Given** the cursor is over a point in the world, **When** the user scrolls the mouse wheel up, **Then** the view zooms in and the point under the cursor stays under the cursor.
4. **Given** the view is zoomed in or out, **When** the user scrolls the mouse wheel down, **Then** the view zooms out, and zoom stops at the configured minimum and maximum levels.

---

### User Story 2 - Find Edible and Dangerous Elements in the World (Priority: P2)

The world contains readable, distinct elements that a player can tell apart at a glance: edible items (fruits, honey) and dangers (fires, spiders). Edible items and dangers look clearly different from the scenery and from each other, so a viewer can immediately tell which is which.

**Why this priority**: These elements give the world its purpose and are the first interactive-meaning layer on top of the scenery. They depend on the world from User Story 1 being in place.

**Independent Test**: Open the app and, with the world at default zoom, identify every fruit, honey pot, fire, and spider on screen. Confirm each category is visually distinct and that edible items and dangers are not confused.

**Acceptance Scenarios**:

1. **Given** the world is displayed, **When** the user looks at it, **Then** fruits and honey are visible and each is visually distinct from the terrain and from the dangers.
2. **Given** the world is displayed, **When** the user looks at it, **Then** fires and spiders are visible and each is visually distinct from the edible items and from the terrain.
3. **Given** the world is displayed at maximum zoom-out, **When** the user looks at it, **Then** the edible items and dangers remain distinguishable from one another in the overview.

---

### User Story 3 - Change the World by Editing a Configuration File (Priority: P3)

A developer changes what the world looks like and contains by editing a JSON configuration file, without changing application code. Examples: making the world larger, changing how many trees or spiders appear, changing which terrain types are used, or changing the zoom limits. After reloading the app, the new world reflects the edited configuration.

**Why this priority**: This makes the world a data-driven starting point, so later features and content changes do not require code edits. It is important for future development, but the world can already be shown to users with a fixed default configuration.

**Independent Test**: Change one value in the configuration file (for example, the number of spiders), reload the app, and confirm the world reflects the change. Then return the value to its original setting and confirm the world reverts.

**Acceptance Scenarios**:

1. **Given** a valid configuration file, **When** the app is loaded, **Then** the world uses the sizes, terrain, and element counts defined in that file.
2. **Given** a configuration file with a changed element count, **When** the app is reloaded, **Then** the number of that element in the world matches the new count.
3. **Given** a configuration file that is invalid or missing a required value, **When** the app is loaded, **Then** the user sees a clear message describing the problem, and the app does not show a broken or partially rendered world.
4. **Given** the same configuration file is loaded twice, **When** the world is generated each time, **Then** the two worlds are identical.

---

### Edge Cases

- What happens when the user zooms or pans past the edge of the world? The view stops at the world boundary; the user cannot scroll into empty space beyond it.
- What happens when the mouse wheel is scrolled very quickly? Zoom changes remain smooth and never jump past the configured zoom limits.
- What happens when the browser window is resized? The world remains fully visible within the window, and the current zoom and centre point are kept where possible.
- What happens when a configuration file is missing entirely? The app shows a clear error message instead of an empty or broken world.
- What happens when a configuration file references a terrain or element type that does not exist? The app reports which entry is unknown and does not render that entry.
- What happens when an element type is configured to appear in a place it cannot fit (for example, a tree on water)? Placement rules keep such elements off incompatible terrain; if no valid position exists, the element is skipped and the count is reduced.
- What happens on a device without a mouse wheel (for example a touch-only device)? The world is still viewable; mouse-based controls are the required input for this feature, and touch support is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST render a top-down, pixel-art style world in a web browser, with a visual style consistent with classic 90s arcade games.
- **FR-002**: The world MUST contain at least these terrain types: grass, trees, water, and rocks.
- **FR-003**: The world MUST contain edible elements of at least two kinds: fruits and honey.
- **FR-004**: The world MUST contain dangerous elements of at least two kinds: fires and spiders.
- **FR-005**: Each terrain, edible, and dangerous element type MUST be visually distinct from every other type when viewed at default zoom.
- **FR-006**: Users MUST be able to pan the view across the whole world by pressing and dragging with the mouse.
- **FR-007**: Users MUST be able to zoom in and out with the mouse wheel.
- **FR-008**: Zoom MUST be anchored at the mouse cursor, so the world point under the cursor stays under the cursor during zoom.
- **FR-009**: Zoom MUST be limited to a configurable minimum and maximum level.
- **FR-010**: The view MUST NOT extend beyond the edges of the world.
- **FR-011**: The world layout (terrain and element placement) MUST be defined by a JSON configuration file, not by application code.
- **FR-012**: The configuration MUST be able to define at least: world dimensions, the unit size of a tile, the terrain types and their appearance, the element types and their counts, placement rules for each element type, and zoom limits.
- **FR-013**: Given the same configuration file, the app MUST produce the same world every time it is loaded.
- **FR-014**: The configuration MUST carry a version identifier, and the app MUST refuse a configuration with an unsupported version, showing a clear message.
- **FR-015**: When the configuration is missing, malformed, or references an unknown type, the app MUST show a clear, human-readable error that names the problem and MUST NOT render a partial or broken world.
- **FR-016**: Trees, rocks, and other solid scenery MUST NOT be placed on water; edible elements and dangers MUST NOT be placed on water.
- **FR-017**: Changes to the configuration MUST take effect after reloading the app, without any code change or rebuild.
- **FR-018**: The app MUST run from a static file location with no backend service required to display the world.
- **FR-019**: The world MUST remain responsive (pan and zoom feel immediate to the user) while being displayed.
- **FR-020**: Terrain cells that come from a tile group MUST be drawn with the group's fill, edge and corner tiles chosen from their neighbours, so that every neighbour of a group edge or corner tile belongs to the same group. No group edge line, outline or transparent edge pixel may repeat inside a terrain area.
- **FR-021**: Every terrain cell MUST be drawn over an opaque fill tile of its group, so transparent pixels of a sprite never show the page background or another cell.
- **FR-022**: The tile groups used by the world, with their sheet rectangles and the role of each tile, MUST be recorded in the asset attribution file.

**Bugfix**: 2026-10-04 — BUG-001 Added FR-020 to FR-022, SC-009 and SC-010, and a tile-group assumption. Terrain must use group-consistent, opaque, seam-free tiles.

### Key Entities *(include if feature involves data)*

- **World**: The whole playable area. Has a size (in tiles), a seed used for reproducible layout, zoom limits, and a list of terrain and element definitions.
- **Terrain Type**: A kind of ground or scenery covering a tile (grass, water, and similar). Has a name, an appearance, and whether it is walkable or blocked.
- **Scenery Object**: A decorative element placed on terrain (trees, rocks). Has a type, an appearance, a placement rule, and a count or density.
- **Edible Element**: A pickup-type element (fruits, honey). Has a type, an appearance, and a placement rule. Its effect is out of scope for this feature.
- **Danger Element**: A hazard element (fires, spiders). Has a type, an appearance, and a placement rule. Its effect is out of scope for this feature.
- **View**: The part of the world currently shown to the user. Has a centre point and a zoom level.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can open the app and see the rendered world within 3 seconds on a typical modern laptop.
- **SC-002**: A user can reach every edge of the world by panning, with no area of the world unreachable.
- **SC-003**: Zoom responds to a single mouse-wheel step within 100 milliseconds of the input, and the zoom range spans at least a 4x difference between the most zoomed-in and most zoomed-out views.
- **SC-004**: In a viewing check, at least 90% of first-time viewers correctly identify fruits and honey as edible and fires and spiders as dangerous, without any explanation.
- **SC-005**: A developer can change the number of one element type (for example, spiders) by editing only the configuration file, reload, and see the change in 100% of trials, with zero code edits.
- **SC-006**: Loading the same configuration twice produces identical worlds in 100% of trials.
- **SC-007**: An invalid or missing configuration produces a clear error message in 100% of trials, with no broken or partially drawn world.
- **SC-008**: The world displays and remains usable in the latest versions of the major evergreen browsers, with no required backend service.
- **SC-009**: In a viewing check at default zoom and at a non-default zoom, no dark outline, repeated edge line or transparent edge pixel is visible inside a rock, water or grass area.
- **SC-010**: [NEEDS CLARIFICATION: integer zoom only?] Every terrain tile edge falls on a whole device pixel at each zoom step, so no seam is visible at any zoom.

## Assumptions

- **Interpretation of "eadable"**: The input reads as "edible" (fruits and honey are edible; fires and spiders are dangers). Edible items and dangers are therefore treated as two groups.
- **Scope of this feature is the world, not gameplay**: Eating, damage, movement of spiders, and fly behaviour are out of scope. This feature only renders the world and places its elements. The configuration SHOULD leave room for these behaviours to be added later.
- **Visual style**: Top-down, tile-based pixel art with a bright, limited palette in the spirit of 90s arcade games. Existing tilesets and sprites already in the repository may be reused as the initial art, but the choice of artwork is not fixed by this spec.
- **Mouse as the required input**: Mouse drag to pan and mouse wheel to zoom are the required controls. Touch and keyboard controls are out of scope for this feature.
- **Default world size**: A medium-sized world (for example, around 100 by 100 tiles) with a default zoom range is used when the configuration does not override it.
- **Reproducibility**: The world layout is generated from a seed stored in the configuration, so the same configuration always gives the same world.
- **Static delivery**: The app is served as static files (HTML, CSS, JavaScript, JSON, images) from any static host, with no backend and no build step, consistent with the project constitution.
- **Dependencies**: No external services are required. Any third-party browser library, if used, is vendored with the repository.
- **Future extension**: Later features will add behaviour for edible and dangerous elements and for the flies. The configuration format is expected to be versioned so that such extensions can be introduced without breaking existing configurations.
- **Tile groups (BUG-001)**: The terrain sheet `assets/terrain/roguelike-16.png` is organised into tile groups (autotile sets). A group's edge and corner tiles are only correct next to tiles of the same group. Single tiles are not used as independent terrain. The groups are measured in `.specify/bugs/tile-edge-misalignment/sheet-analysis.md`.
