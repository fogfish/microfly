# Feature Specification: MaleCNS Smallest Brain Extractor

**Feature Branch**: `003-malecns-brain-extractor`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Write an utility to parse malecns dataset, extract smallest feasible brain topology as defined by 002-smallest-functional-brain into the data format and integrated it with simulator. Existing toy fly mock has to still be fully functional and be exchangable via config."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Extract a Reproducible Connectome Brain Snapshot (Priority: P1)

A developer with a local copy of the MaleCNS v1.0 dataset runs one command with a configuration file. The tool reads the dataset, selects the smallest functional brain described in ADR 002 (one sensory neuron, two readout neurons, a few interneurons), and writes a single snapshot file. The snapshot records where every neuron and connection came from. If the dataset is missing, has a different size, or the selection cannot be made, the tool stops with a named error and leaves any existing snapshot untouched.

**Why this priority**: Nothing downstream can be tested against real data until a snapshot exists. The snapshot is the contract between the dataset and the simulator, so producing it correctly and reproducibly is the foundation of the feature.

**Independent Test**: Run the tool on the v1.0 dataset with the default configuration, then run it again. The first run writes a snapshot with between 3 and 11 neurons and reports its node and edge counts. The second run produces a byte-identical file (apart from the creation time recorded in its provenance). A deliberately broken input produces the documented error and no snapshot.

**Acceptance Scenarios**:

1. **Given** the v1.0 dataset is present and the default configuration is used, **When** the developer runs the tool, **Then** a snapshot file is written with a sensory neuron, a left readout, a right readout, and at least one interneuron that reaches each readout side.
2. **Given** the same configuration and the same dataset, **When** the tool is run twice, **Then** both snapshots have identical contents, excluding the creation time in the provenance.
3. **Given** the dataset folder does not contain a required file, **When** the tool runs, **Then** it exits with a failure, names the missing file, and writes no snapshot.
4. **Given** the dataset has a different number of rows than the configuration expects, **When** the tool runs, **Then** it exits with a failure that reports the expected and actual counts, and an existing snapshot is left unchanged.
5. **Given** a selected neuron has no transmitter prediction above the configured confidence threshold, **When** the tool runs, **Then** it refuses to guess a sign for that neuron and fails with a named error.
6. **Given** a successful run, **When** the developer reads the tool's report, **Then** it lists the actual neuron count, connection count, selected transmitters per neuron, and the range of connection weights, so that the configuration's expected values can be filled in from real output.

---

### User Story 2 - Run a Fly on the Connectome Snapshot by Changing Configuration (Priority: P2)

A developer switches a fly's brain from the toy network to the connectome snapshot by editing the world configuration. No code changes are needed. The fly is driven by the snapshot brain, and its inspection readout shows the same kinds of telemetry as the toy fly (sensory input, left and right motor outputs, spike events for selected neurons). Switching back to the toy network is again a configuration edit. Both modes remain fully functional in the same app.

**Why this priority**: This is the integration the ADR was written for. It proves the simulator can run a real topology without changing the engine. Keeping the toy mode fully working matters just as much, because the toy is the baseline the connectome brain must be compared against.

**Independent Test**: Start the app with the default world configuration and confirm six toy flies run as before. Change the brain setting to the snapshot file, reload, and confirm six flies run on the snapshot with no console errors. Change it back and confirm the toy flies return unchanged.

**Acceptance Scenarios**:

1. **Given** the default world configuration (toy brain), **When** the app is opened, **Then** six toy flies run with the same behaviour and inspection readout as before this feature, and no snapshot file is loaded.
2. **Given** the world configuration points a fly's brain at a valid snapshot file, **When** the app is opened, **Then** the fly's brain has exactly the number of neurons stated in the snapshot, and the fly runs without errors.
3. **Given** a snapshot file with an unsupported format version, **When** the app is opened, **Then** the app shows a clear error that names the version found and the version expected, and does not start the world.
4. **Given** a snapshot whose neurons are not in the required role order (sensory, left, right), **When** the app is opened, **Then** the app shows a clear error and does not start the world.
5. **Given** a world configuration that sets both a snapshot and a toy network size, **When** the app is opened, **Then** the app shows a clear error naming both settings and does not start the world.
6. **Given** the world configuration sets a telemetry neuron index at or above the snapshot's neuron count, **When** the app is opened, **Then** the app shows a clear error naming that index.
7. **Given** a snapshot brain fly is running, **When** the developer opens its inspection readout, **Then** it shows sensory input, left and right motor outputs and spike events for the selected neurons, updating in real time.

---

### User Story 3 - Compare the Connectome Brain Against the Toy and the Baseline (Priority: P3)

A developer runs the existing comparison in three modes over the same seeds and world: toy brain, connectome snapshot brain, and random-walk baseline. They read fruit-contact totals for each mode. The result says whether the connectome brain does better than chance and how it compares with the toy. A result that is worse than the baseline is a valid outcome and is reported as such.

**Why this priority**: This is the behavioural check (ADR 002, Gate C). It is a result, not a precondition for shipping the extractor. It comes after the extractor and integration work because it depends on both.

**Independent Test**: Run the comparison with the configured seed list in all three modes. Each mode reports fruit contacts per fly and per seed, and a summary shows the totals and the differences.

**Acceptance Scenarios**:

1. **Given** the same world and seed list, **When** the comparison runs in all three modes, **Then** each mode reports fruit contacts per fly and per seed, and the summary states the total for each mode.
2. **Given** the comparison results, **When** the developer reads the summary, **Then** the connectome total is shown against both the toy total and the baseline total, with the difference.
3. **Given** the connectome brain does not beat the baseline, **When** the summary is read, **Then** the report states that result plainly and does not hide it.

---

### Edge Cases

- What happens when the dataset folder is not set? The tool refuses to run and names the setting it needs. The location is never read from the configuration file.
- What happens when the configuration contains an unknown setting or a value out of range? The tool refuses to run and names the setting (no snapshot is written).
- What happens when the dataset is a different release (different row counts)? The tool refuses to run, as in User Story 1, scenario 4.
- What happens when no sensory neuron qualifies? The tool fails and names the cause (no sensory candidate), and leaves any existing snapshot unchanged.
- What happens when no interneuron reaches the left readout, or none reaches the right? The tool fails and says that one turn direction would be impossible.
- What happens when fewer interneurons qualify than the configured minimum? The tool fails and reports how many were found.
- What happens when a snapshot file is replaced while the app is running? The running app keeps the snapshot it loaded at startup. A reload picks up the new file.
- What happens when a snapshot is valid but a fly's brain fails at runtime? That fly stops and shows its error in its readout. The other flies keep running, as the toy flies already do.
- What happens when the snapshot brain's neurons have no outgoing connections to the readouts after filtering? The tool fails at extraction time, so the app never receives such a snapshot.
- What happens to a toy-brain fly when a snapshot is also present in the configuration? Each fly uses only the brain setting it is given. Toy flies are never driven by the snapshot and snapshot flies are never driven by the toy network.

## Requirements *(mandatory)*

### Functional Requirements

**Extraction**

- **FR-001**: The tool MUST read a MaleCNS dataset release from a folder given on the command line or in an environment variable. The dataset location MUST NOT be stored in the configuration file.
- **FR-002**: The tool MUST take a declarative configuration file as its only other input. It MUST choose the sensory, readout and interneuron selection rules from that file, without code changes.
- **FR-003**: The tool MUST use only the traced-only connection variant of the dataset. The variant MUST be recorded in the snapshot.
- **FR-004**: The sensory neuron MUST be an ALPN body with traced status. The two readout neurons MUST be traced descending neurons, one on the left side and one on the right side.
- **FR-005**: The tool MUST admit an interneuron only if it has traced status, a transmitter prediction that maps to a sign with confidence at or above the configured threshold, a connection from the sensory neuron, and a connection to a readout neuron. Interneurons MUST be ranked by the smaller of those two connection totals and capped at a configured maximum. Ties MUST break on ascending body identifier.
- **FR-006**: The selected topology MUST include every traced connection between any two selected neurons, and no other connections.
- **FR-007**: The sign of each neuron MUST come from its predicted transmitter, using a configured map. Transmitters not in the map, and predictions below the confidence threshold, MUST NOT be assigned a sign. A selected neuron without a sign MUST cause a failure, not a default.
- **FR-008**: Each connection's weight MUST be its sign times its synapse count, capped at a configured value and divided by that value. The raw synapse count MUST be kept next to the weight.
- **FR-009**: The tool MUST refuse to run if the configuration has unknown keys or out-of-range values, if a required dataset file is missing, or if the dataset row counts differ from those in the configuration.
- **FR-010**: On any failure, the tool MUST exit with a failure status, write no snapshot, and leave any existing snapshot unchanged. Each failure MUST carry a stable, documented error code and a message that names the cause.
- **FR-011**: The same configuration and dataset MUST produce a byte-identical snapshot, except for the creation time. The tool MUST verify this by running its selection twice in one run and failing if the results differ.
- **FR-012**: On success the tool MUST report the actual neuron count, connection count, selected transmitters per neuron, and the weight range, so that the configuration's expected values can be set from a real run.
- **FR-013**: The tool MUST read dataset files in parts (column selection or filtering) and MUST NOT need to hold any large dataset file in memory in full.

**Snapshot format**

- **FR-014**: The snapshot MUST be a single static file with a format version. Version 1 MUST contain provenance (dataset release, connection variant, minimum confidence, configuration hash, tool version and creation time), a list of neurons, and a list of connections.
- **FR-015**: Each neuron MUST keep its dataset identifiers (body identifier, type, class, side) and its role. The snapshot MUST be ordered so that the sensory neuron is first, the left readout second, and the right readout third, followed by interneurons in ascending body identifier order.
- **FR-016**: The snapshot MUST contain no dataset content beyond the selected neurons and connections, and MUST NOT require the dataset to be present when it is read.

**Integration with the simulator**

- **FR-017**: A fly's brain MUST be selectable in the world configuration as either the toy network or a snapshot file. The choice MUST require no code change.
- **FR-018**: The toy network MUST remain the default and MUST keep working unchanged. Existing world configurations MUST continue to produce the same six toy flies with no edit.
- **FR-019**: When a snapshot is selected, the app MUST load it once at startup, check its format version and its role order, and build the fly's brain from it. The neuron count MUST come from the snapshot, not from a toy size setting.
- **FR-020**: A world configuration that sets a snapshot together with a toy network size MUST be rejected with a clear error naming both settings.
- **FR-021**: Telemetry neuron indices MUST be checked against the neuron count of the brain actually used (toy or snapshot).
- **FR-022**: A fly MUST interact with the world only through its sensory input and its left and right motor outputs, exactly as the toy fly does. The snapshot MUST NOT change the world, the rendering, or the simulator's core behaviour.
- **FR-023**: Snapshot flies MUST show the same telemetry and inspection readout as toy flies, and their brain MUST be labelled in the app as a connectome snapshot, with its release and extraction date.
- **FR-024**: The toy and the snapshot MUST be selectable per fly, so a world can, in principle, mix them. A fly MUST never be driven by the other kind of brain.
- **FR-025**: The app MUST run from static files, with no backend service and no dataset access in the browser.
- **FR-026**: The comparison MUST be able to run the connectome brain alongside the toy brain and the random-walk baseline, over the same seeds and world, and report the totals side by side.

**Documentation and contracts**

- **FR-027**: The snapshot format, the extraction configuration schema, the error codes, and the new world configuration setting MUST be documented in the same change that introduces them.
- **FR-028**: The world configuration contract MUST gain the snapshot setting as an optional field within its existing version, so existing configurations remain valid.

### Key Entities *(include if feature involves data)*

- **Extraction Configuration**: The declarative input to the tool. Names the dataset release and connection variant, the expected row counts, the sensory and readout rules, the transmitter-to-sign map, the confidence threshold, the connection-weight cap, the interneuron limits, and the expected neuron count.
- **Dataset Release**: The external MaleCNS data. Read-only, never stored in the repository. Provides body annotations, predicted transmitters and traced connections.
- **Selected Neuron**: One node of the topology. Has a role (sensory, left readout, right readout, or interneuron), a body identifier, type, class, side, a transmitter, a confidence value and a sign.
- **Selected Connection**: One directed link between two selected neurons, with its raw synapse count and its normalised weight.
- **Brain Snapshot**: The versioned static file the simulator reads. Holds provenance, the selected neurons in role order and the selected connections.
- **Provenance**: The record of how a snapshot was made: release, variant, threshold, configuration fingerprint, tool version, creation time.
- **Brain Selection**: The per-fly setting in the world configuration that chooses toy network or snapshot file.
- **Extraction Report**: The summary the tool prints on success: counts, selected transmitters and weight range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the v1.0 dataset with the default configuration, the tool produces a snapshot with between 3 and 11 neurons in one run, and the run reports its counts.
- **SC-002**: Across 10 repeated runs with the same configuration and dataset, the snapshot is identical in 100% of runs apart from the creation time.
- **SC-003**: Each of the failure conditions listed in the extraction requirements produces its documented error and no snapshot in 100% of trials, and an existing snapshot is left unchanged in 100% of those trials.
- **SC-004**: A developer can switch a fly between the toy brain and the connectome snapshot brain by editing the world configuration only, with zero code edits, in 100% of trials.
- **SC-005**: With the default configuration, the app shows the same six toy flies as before this feature, and the toy brain behaviour is unchanged across 20 repeated runs with the same seeds.
- **SC-006**: With a snapshot selected, all six flies run for five minutes with no console errors.
- **SC-007**: An unsupported snapshot version, a wrong role order, or a conflicting setting produces a clear, human-readable error that names the offending value in 100% of trials, and the world does not start.
- **SC-008**: The comparison report shows the fruit-contact totals for the toy brain, the connectome brain and the baseline, with the differences, over the full configured seed list.
- **SC-009**: A developer can read the provenance of any running snapshot fly (release, variant, configuration fingerprint, creation time) from the app in under 30 seconds.

## Assumptions

- **Dataset**: The v1.0 MaleCNS release is available locally in a folder the developer chooses. It is not committed to the repository (the repository already ignores the data folder).
- **Topology rules**: ADR 002 is authoritative for the selection rules, the sign rule, the weight rule, the error codes and the snapshot format. This spec restates them as requirements and does not add rules.
- **Glutamate sign**: Glutamate is treated as inhibitory by default, as in ADR 002 (open question Q1). The choice sits in the configuration, so it can be changed without a code edit.
- **Confidence threshold and interneuron limits**: The defaults are a minimum confidence of 0.5, a weight cap of 5, a minimum of 2 interneurons and a maximum of 8. These are the ADR 002 defaults and are expected to be tuned after the first real run (ADR 002, open questions Q2 and Q3).
- **Readout selection**: The two-hop rule for choosing the readout neurons is the ADR 002 heuristic (open question Q4). It is a configuration-level choice for later revision.
- **Default brain**: The toy network stays the default for every world. Switching to the connectome snapshot is an explicit opt-in per fly, so this feature cannot change the existing app's behaviour by accident.
- **Behaviour outcome**: Whether the connectome brain beats the baseline is a result the comparison reports. It is not a success criterion for shipping the tool or the integration (ADR 002, Gate C).
- **Sensory channel**: The single sensory neuron receives the same scalar stimulus as the toy fly. Olfactory receptor neurons upstream of the sensory neuron are out of scope (ADR 002, open question Q5).
- **Motor mapping**: The left and right readouts drive the wheels exactly as the toy's LEFT and RIGHT outputs do. Mapping real motor groups is out of scope.
- **Snapshot size**: A snapshot of this topology is small enough to load in the browser at startup without noticeable delay, and it is inspectable by hand.
- **Dependencies**: This feature builds on `001-arcade-world-setup` (world and fruit), `002-toy-lif-fly-network` (simulator, worker protocol, fly configuration and comparison) and `adrs/002-smallest-functional-brain.md` (topology rules).
- **Out of scope**: Olfactory receptor neurons, motor groups outside the two readouts, any use of non-traced bodies, neurotransmitters beyond the fast-sign rule, the growth loop after the first snapshot, and any browser-side reading of the dataset.
