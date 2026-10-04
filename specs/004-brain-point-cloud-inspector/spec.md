# Feature Specification: Brain Point-Cloud Inspector

**Feature Branch**: `004-brain-point-cloud-inspector`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Create a visual inspection of brain snapshot as point cloud with edges, similar to inspector of the dataset malecns-3d.html (keep malecns-3d.html unchanged, implement a parallel version at `public/brains` so that it is loadable through webserver as simulation). If the brain snapshot does not contain 3d dimensional data as available at main dataset extend it, it would be required for further visualization inside the world."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect a brain snapshot in 3D (Priority: P1)

A researcher opens a page served from the `public/brains` folder and sees one brain snapshot. Each neuron is a point at its real position in the male CNS, and each synaptic connection is an edge between two neurons. The researcher can rotate, zoom and hover over neurons to see what each one is.

**Why this priority**: The project simulates a real fly connectome. Seeing where the snapshot's neurons sit in the real brain is the first check that the snapshot is grounded in the data. It is also the minimum needed to judge the brain before it is placed in the world.

**Independent Test**: Serve the repository with a plain static web server, open the viewer, and load the reference brain (`smallest-functional-brain.brain`). Confirm that 11 points and 78 edges are shown and that hovering a point shows its identity.

**Acceptance Scenarios**:

1. **Given** the reference brain snapshot, **When** the viewer opens it, **Then** all 11 neurons appear as points at their dataset soma positions and all 78 edges are drawn between the neurons they connect.
2. **Given** the viewer shows a brain, **When** the user hovers over a neuron, **Then** the panel shows its `bodyId`, class, type, soma side, role (sensory, left, right or interneuron) and neurotransmitter where the dataset has one.
3. **Given** the viewer shows a brain, **When** the user drags, right-drags or scrolls, **Then** the view rotates, pans or zooms, and a reset control returns to the starting view.
4. **Given** the viewer shows a brain, **When** the user turns points off or edges off, **Then** only the chosen kind of element is hidden and the other stays visible.
5. **Given** the viewer shows a brain, **When** it is displayed, **Then** sensory, left-motor and right-motor neurons are colored differently from interneurons, so they can be told apart at a glance.

---

### User Story 2 - Choose other snapshots and filter edges (Priority: P2)

A researcher picks a different snapshot from the same folder and filters the edges by strength. For a large snapshot such as the full admitted subgraph (143,219 neurons, 22,082,410 edges), the viewer draws only a bounded set of edges, the strongest ones, and states on screen how many are drawn. It stays responsive while the user rotates it.

**Why this priority**: The reference brain is small. Comparing topologies and neuron selections is a core goal of the project, and that needs more than one brain. Large snapshots must still be viewable, or the viewer is only useful for toy examples.

**Independent Test**: Open the viewer with a second snapshot name, then open the full admitted snapshot if it is present locally. Confirm the name of the snapshot is shown, the minimum-synapse filter changes the drawn edges, and the on-screen edge count matches the cap.

**Acceptance Scenarios**:

1. **Given** a snapshot file name in the viewer's address, **When** the viewer opens, **Then** that snapshot is shown with its name, neuron count and edge count.
2. **Given** the full admitted snapshot, **When** the viewer opens it, **Then** it shows the total neuron and edge counts, and the number of edges drawn, which does not exceed the documented cap. The edges drawn are the strongest by synapse count.
3. **Given** a minimum synapse count set by the user, **When** the value changes, **Then** only edges with at least that many synapses are drawn and the on-screen count updates.
4. **Given** the full admitted snapshot, **When** the user rotates or zooms, **Then** the view keeps responding without a visible freeze.

---

### User Story 3 - Snapshots carry 3D positions and the simulation keeps working (Priority: P3)

A team member regenerates a brain snapshot from the dataset. Each neuron in the file now records its 3D soma position, with the dataset release and column it came from. The fly simulation loads and runs the same brain as before, and the extraction report states how many neurons had no position in the dataset.

**Why this priority**: The viewer needs positions, and the same positions are needed later to place the brain inside the world. This is lower priority than viewing because it changes a shared file format, and the simulation must not regress.

**Independent Test**: Regenerate the reference brain with positions. Confirm the simulation test suite passes unchanged, the simulation runs the regenerated brain, and the extraction report includes the count of neurons without a position.

**Acceptance Scenarios**:

1. **Given** the dataset and an extraction configuration, **When** a snapshot is produced, **Then** every neuron in it has an integer 3D soma position taken from the dataset, or is recorded as having none.
2. **Given** a regenerated snapshot, **When** the same configuration and dataset are used again, **Then** the output is byte-identical apart from the creation time, as before.
3. **Given** the regenerated reference brain, **When** the fly simulation loads it, **Then** the simulation runs and its existing tests still pass.

---

### Edge Cases

- A snapshot file has no 3D positions (for example, the current reference brain before regeneration). The viewer shows a clear message that the snapshot has no positions and does not draw a partial view.
- A snapshot uses an unsupported format version, is truncated, or is not a snapshot at all. The viewer shows the same clear error that the simulation shows, and renders nothing.
- A snapshot file named in the address does not exist. The viewer shows an error that names the missing file.
- A neuron has no soma position in the dataset. The extraction records it as having none and reports the count. The viewer does not draw that neuron or its edges, and it states how many were left out.
- A snapshot has no edges, or every edge is below the minimum synapse filter. The viewer shows the neurons only and states that no edges are drawn.
- The browser cannot show 3D graphics. The viewer shows a clear message instead of a blank page.
- A neuron's position is a voxel index in the dataset's coordinate system, with no known physical size. The viewer scales the whole cloud to fit the view and does not state physical distances.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The viewer MUST be a new page under `public/brains/`, next to the snapshot files. It MUST run when the repository is served by a plain static web server, with no build step, no install and no backend.
- **FR-002**: The existing `inspector/malecns-3d.html` MUST NOT be modified.
- **FR-003**: The viewer MUST show the snapshot named in its address, and MUST default to `smallest-functional-brain.brain` when no name is given. Snapshot names are files in `public/brains/`.
- **FR-004**: Each neuron MUST be drawn as a point at its soma position from the snapshot. The whole cloud MUST be scaled to fit the view, with the same centring as the reference inspector.
- **FR-005**: Each synaptic connection MUST be drawn as an edge between its presynaptic and postsynaptic neuron. The edge's visual weight MUST increase with its synapse count.
- **FR-006**: For a snapshot with more edges than the viewer can draw comfortably, the viewer MUST draw only a documented cap of edges, the strongest by synapse count. The on-screen display MUST state the number of edges drawn and the total.
- **FR-007**: Neurons MUST be colored by role (sensory, left, right, interneuron). The viewer MUST also offer coloring by dataset class.
- **FR-008**: Hovering over or clicking a neuron MUST show its `bodyId`, class, type, soma side, role, neurotransmitter and sign where present, and its number of incoming and outgoing synapses within the drawn graph.
- **FR-009**: Users MUST be able to rotate, pan and zoom the view, and to return to the starting view with one control.
- **FR-010**: Users MUST be able to hide the points and the edges separately, and to turn on slow automatic rotation.
- **FR-011**: Users MUST be able to set a minimum synapse count, and only edges at or above it are drawn.
- **FR-012**: The viewer MUST check each snapshot against the same rules as the simulation's reader (magic, version, header, section bounds, connection-table consistency). On failure it MUST show the contract's error message and render nothing partial.
- **FR-013**: The snapshot format MUST record a 3D soma position for each neuron, and the source of that position (dataset release and column). The change MUST follow the snapshot contract's versioning rule. Readers that do not support the new version MUST reject the file with a clear message.
- **FR-014**: The extraction pipeline MUST take each neuron's position from the dataset, record neurons with no position as such, and report how many there are. It MUST remain deterministic: the same configuration and dataset produce the same bytes, apart from the creation time.
- **FR-015**: The reference brain `public/brains/smallest-functional-brain.brain` MUST be regenerated with positions. The fly simulation MUST keep loading and running it, and its existing tests MUST keep passing.
- **FR-016**: Third-party libraries used by the viewer MUST be vendored into the repository, so the page does not depend on a network CDN at runtime. Each library MUST be justified in the plan that adds it.
- **FR-017**: The viewer MUST show counts for the snapshot: neurons in the file, edges in the file, neurons drawn and edges drawn.

### Key Entities *(include if feature involves data)*

- **Brain Snapshot**: One brain as a single `.brain` file. It has provenance (dataset release, edge variant, minimum confidence, configuration hash, tool version, creation time), a neuron list, and a connection list.
- **Neuron**: One body of the dataset in the snapshot. It has an index, a role (sensory, left, right or interneuron), a `bodyId`, a class and type where the dataset has them, a soma side, a neurotransmitter with its confidence, a sign, and now a 3D soma position or none.
- **Soma Position**: Three integers (x, y, z) in the dataset's voxel coordinates, taken from the dataset's soma location column. The physical size of a voxel is not stated in the dataset.
- **Edge**: A directed connection from one neuron to another, with a synapse count (the raw count) and a weight derived from it.
- **Viewer Page**: The static page under `public/brains/` that reads a snapshot file and shows it. It holds only display state (selected snapshot, filters, toggles), not brain data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a standard laptop browser, the reference brain is fully visible within 3 seconds of opening the page: 11 of 11 neurons and 78 of 78 edges.
- **SC-002**: For every neuron in the reference brain, the drawn position matches that neuron's soma position in the dataset, in 100% of checked neurons.
- **SC-003**: `inspector/malecns-3d.html` is byte-identical to its state before this feature, verified by checksum.
- **SC-004**: A user with only a browser and a plain static web server can open the viewer by following the documented steps, with no install or build.
- **SC-005**: The full admitted snapshot opens, and the drawn edges never exceed the documented cap. The on-screen count of drawn edges matches the number actually drawn.
- **SC-006**: The fly simulation's existing automated tests pass after the reference brain is regenerated with positions, and the simulation runs that brain.
- **SC-007**: In every tested malformed case (wrong magic, unsupported version, truncated file, missing file, broken connection table), the viewer shows a visible error and draws nothing.
- **SC-008**: Every extraction run reports the number of neurons without a position, and no neuron is dropped without being counted.

## Assumptions

- "Parallel version" means a second page next to the original inspector, placed under `public/brains/`, and not a change to the original. "Loadable through the web server as simulation" means the page is served with the rest of the app by a plain static web server, reads its snapshot as a static file, and needs no backend.
- Soma positions come from the dataset's soma location column, which is in voxel units. Coverage is 141,781 of 211,577 annotated bodies. All 11 neurons in the reference brain have a position. Neurons without one are handled as described in the edge cases.
- The dataset stays external and is configured by location, as the constitution requires. Only the derived snapshot carries positions.
- The exact way the snapshot format carries positions (a new format version, or an optional header field permitted within version 2) is a plan decision under the contract's versioning rule.
- The full admitted snapshot is a benchmark file, not committed. The viewer must handle it when it is present locally in `public/brains/`. It is not required to be shipped.
- The edge cap's default value and the color palette are plan decisions. The visual style follows the reference inspector (dark background, same panel layout) as a guide, not as a requirement.
- Out of scope: placing the brain inside the world, showing live spike activity, editing snapshots, and mobile layout. Positions are the prerequisite for the later world visualization, which is a separate feature.
- The reference inspector's status filter and role-description panel are not part of this feature. Neurons here are grouped by the snapshot's role and class, not by dataset status labels.
