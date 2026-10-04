# Feature Specification: Toy LIF Fly Network

**Feature Branch**: `002-toy-lif-fly-network`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "A 40-line LIF core, a seeded random graph, and a two-channel fly network to validate integrations and engine before a real network is integrated. ADR 001-lif-toy-network-and-fly-integration.md the "toy" network and its integration to the world. As an outcome, the world runs six flies each powered by own worker running toy LIF network."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Six Flies Driven by Their Own Toy Brains (Priority: P1)

A developer opens the app and sees six flies moving in the arcade world. Each fly is driven by its own small toy spiking network, running independently from the other flies. A fly turns toward or away from fruit based only on what its sensory input reports and what its two motor outputs (left and right) produce. The developer can see each fly's activity: its sensory input, its motor output, and its spike activity.

**Why this priority**: This is the integration this feature exists to prove. It connects the simulation engine to the world, one brain per fly, and shows the boundary between brain and world works before any real connectome data is involved.

**Independent Test**: Open the app with the default configuration, count six flies, watch them move for one minute, and open the inspection readout for one fly to confirm its sensory input, motor outputs and spike activity change over time.

**Acceptance Scenarios**:

1. **Given** the app is opened with the default configuration, **When** the world is displayed, **Then** exactly six flies are present and each one is shown as moving under its own brain's control.
2. **Given** a fly is over a patch of fruit, **When** its sensory input rises, **Then** its motor outputs and movement change, and the change is visible in its inspection readout.
3. **Given** the six flies are running, **When** the developer compares two of them, **Then** their spike sequences differ, because each fly's network is generated from its own seed.
4. **Given** a fly is selected, **When** the developer opens its inspection readout, **Then** it shows the sensory input, left and right motor rates, and spike events for selected neurons, updating in real time.
5. **Given** the toy networks are in use, **When** the developer looks at the world, **Then** each fly is labelled as running a toy (synthetic) network, not a connectome-derived brain.

---

### User Story 2 - Verify the Simulation Engine in Isolation (Priority: P2)

A developer checks that the neural engine behaves correctly before trusting any fly behaviour. They run an automated test suite that exercises the engine on its own, without a browser and without the world. The tests confirm that the same seed produces the same spike sequence, that a constant input gives a predictable spike interval, that the refractory period is respected, and that inhibitory connections lower the firing rate of the neurons they reach.

**Why this priority**: If the engine is wrong, fly behaviour cannot be interpreted. Checking the engine alone separates engine bugs from world or integration bugs, which is the purpose of this feature.

**Independent Test**: Run the automated engine test suite from the repository. Every check passes, and no browser or world is needed.

**Acceptance Scenarios**:

1. **Given** a fixed seed and a fixed network, **When** the simulation is run twice, **Then** both runs produce identical spike sequences.
2. **Given** a neuron driven by a constant input, **When** it is simulated, **Then** the interval between its spikes is the same across the run and matches the expected value for the configured parameters.
3. **Given** a neuron that has just spiked, **When** the refractory period is running, **Then** the neuron does not spike again until the period ends.
4. **Given** an inhibitory connection from one neuron to another, **When** the presynaptic neuron is active, **Then** the postsynaptic neuron's firing rate is lower than without that connection.
5. **Given** a graph configuration that cannot be built (for example, more outgoing connections per neuron than there are neurons), **When** it is requested, **Then** the engine reports a clear error and does not produce a partial network.

---

### User Story 3 - Compare Toy Flies Against a Random-Walk Baseline (Priority: P3)

A developer checks whether the toy brains do anything useful. They run the same world with the same seeds in two modes: the toy-brain mode and a labelled random-walk baseline mode, where flies move randomly and ignore their brains. They compare fruit contacts across the runs. The baseline mode is selected through configuration, not code changes.

**Why this priority**: The toy network is only a test fixture. Its value is in showing that the wiring from world to brain to motor output can beat chance. If it cannot, the problem is in the wiring, and the real connectome work should wait.

**Independent Test**: Run the comparison over the agreed set of seeds in both modes and read the fruit contact totals from the report.

**Acceptance Scenarios**:

1. **Given** the same world and the same set of seeds, **When** the comparison is run in toy-brain mode and in random-walk baseline mode, **Then** both modes report the number of fruit contacts for each fly and each seed.
2. **Given** the comparison results, **When** the developer reads the summary, **Then** the toy-brain total of fruit contacts is compared against the baseline total, with the difference shown.
3. **Given** the baseline mode is active, **When** the app is displayed, **Then** the flies are visibly labelled as baseline flies and the brains are not used for movement.

---

### Edge Cases

- What happens when no fruit is near a fly? Sensory input stays at its resting level, and the fly's motor output follows from the network alone. The fly keeps moving; it does not freeze.
- What happens when a fly reaches the edge of the world? The fly is kept inside the world boundary, as in the arcade world feature. Its brain keeps running and its motor output is not reset.
- What happens when one fly's simulation fails (for example, an unexpected error in its worker)? That fly stops, its inspection readout shows the error, and the other five flies keep running and keep their spike sequences unchanged.
- What happens when a fly is removed or added in configuration? Only that fly's simulation is created or stopped. The other flies' spike sequences do not change.
- What happens when the toy network configuration is invalid (for example, zero neurons, or an out-degree that is not smaller than the neuron count)? The app shows a clear message naming the invalid value. No fly starts with a partial network.
- What happens when the fruit intensity is very large? The sensory drive is limited by a configured maximum, so a fly cannot be driven into continuous firing that saturates its motor output.
- What happens when the browser tab is in the background? Flies pause their simulation and resume when the tab returns, without a burst of catch-up movement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The world MUST contain six flies by default. The number of flies MUST be set in the world configuration.
- **FR-002**: Each fly MUST be driven by its own toy network. No two flies MUST share neurons, connections or state.
- **FR-003**: Each toy network MUST be generated from a seed. The same seed and the same parameters MUST always produce the same network.
- **FR-004**: The toy network MUST have a fixed number of outgoing connections per neuron, chosen randomly among the other neurons, with no self-connections and no repeated connections from the same neuron to the same target.
- **FR-005**: Each neuron MUST be either excitatory or inhibitory. All outgoing connections of a neuron MUST have the same sign.
- **FR-006**: Each fly's network MUST have exactly one sensory input channel and exactly two motor output channels, LEFT and RIGHT.
- **FR-007**: The sensory input MUST be the fruit intensity at the fly's position, multiplied by a configured gain and limited by a configured maximum.
- **FR-008**: Each motor output MUST be the smoothed spike rate of its designated motor neurons, using a configured smoothing factor. The LEFT and RIGHT rates MUST set the fly's left and right wheel speeds.
- **FR-009**: Every simulation parameter (time step, membrane time constant, resting, reset and threshold potentials, refractory period, synaptic scale, input gain, input maximum, smoothing factor, and the network size and degree) MUST be named and set in configuration. No parameter MUST be a hidden constant.
- **FR-010**: Given the same network, parameters, inputs and seed, the simulation MUST produce the same spike sequence every time.
- **FR-011**: A constant input to a neuron MUST produce regular spikes whose interval matches the configured parameters.
- **FR-012**: A neuron MUST NOT spike during its refractory period.
- **FR-013**: An inhibitory connection MUST reduce the firing rate of the neuron it targets, compared with the same network without that connection.
- **FR-014**: Each fly MUST expose telemetry: spike events and firing rates for selected neurons, the sensory input, and the left and right motor outputs.
- **FR-015**: Users and developers MUST be able to open a per-fly inspection readout that shows the telemetry from FR-014 and updates while the fly is running.
- **FR-016**: Each fly's simulation MUST run separately from the main display, so the world keeps updating and responding to pan and zoom while the flies are simulated.
- **FR-017**: A fly MUST interact with the world only through its sensory input and its motor outputs. It MUST NOT read the world directly or read another fly's state.
- **FR-018**: The world MUST count fruit contacts for each fly and report the totals.
- **FR-019**: The world MUST offer a random-walk baseline mode, selected in configuration, in which flies ignore their brains and move randomly. The baseline mode MUST be labelled as a baseline wherever flies are shown.
- **FR-020**: Toy networks MUST be labelled as synthetic test fixtures in the app and in the configuration. They MUST NOT be presented as connectome-derived brains.
- **FR-021**: If a fly's simulation fails, that fly MUST stop and show its error in its inspection readout, and the other flies MUST keep running.
- **FR-022**: Invalid engine or network configuration MUST produce a clear, human-readable error that names the invalid value. No partial network MUST run.
- **FR-023**: The engine's automated checks (FR-010 to FR-013) MUST run without a browser and without the world.
- **FR-024**: The feature MUST NOT load or depend on any connectome dataset or snapshot file.
- **FR-025**: The app MUST run from static files with no backend service, as the constitution requires.

### Key Entities *(include if feature involves data)*

- **Fly**: A simulated insect in the world. Has a position, a seed, its own toy network, two motor channels, and a fruit contact count.
- **Toy Network**: A small, seeded, randomly connected set of neurons with a sign per neuron. Labelled as a synthetic test fixture. Has a neuron count and an out-degree.
- **Neuron**: One simulated unit with a membrane state, a threshold and a refractory period. Is either the sensory input, a motor output, or an intermediate neuron.
- **Connection**: A directed link from one neuron to another, with a sign that follows the presynaptic neuron.
- **Simulation Parameters**: The named, configured values that control the engine (see FR-009).
- **Sensory Input**: The fruit intensity at a fly's position, scaled and limited, for one time step.
- **Motor Output**: The left and right smoothed spike rates for one fly, used as wheel speeds.
- **Telemetry**: The spike events, firing rates, sensory input and motor outputs recorded for a fly.
- **Baseline Mode**: A configuration setting in which flies move randomly and ignore their toy networks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor sees six moving flies within 3 seconds of the world appearing on a typical modern laptop.
- **SC-002**: Across 20 repeated runs with the same seed and configuration, the spike sequence of every fly is identical in 100% of runs.
- **SC-003**: Across the agreed seed set, the toy-brain flies record more total fruit contacts than the random-walk baseline flies in the same world, and the difference is reported.
- **SC-004**: All engine checks in the automated suite (determinism, predictable spike interval, refractory period, inhibitory effect) pass without a browser.
- **SC-005**: For each fly, the inspection readout shows sensory input, left and right motor outputs and spike events, and these values change over time in 100% of trials.
- **SC-006**: Pan and zoom respond to the user within 100 milliseconds while all six flies are running.
- **SC-007**: If one fly's simulation is stopped, the spike sequences of the other five flies are unchanged in 100% of trials.
- **SC-008**: A five-minute run of the app with six flies completes with no console errors.
- **SC-009**: An invalid network configuration produces a clear error message in 100% of trials, and no fly starts with a partial network.
- **SC-010**: A developer can switch between toy-brain mode and random-walk baseline mode by editing configuration only, with zero code edits, in 100% of trials.

## Assumptions

- **Two motor outputs (LEFT and RIGHT)**: This follows ADR 001, open question 1, and departs from a literal "one input, one output" reading. One output would change speed but not heading, so two outputs are assumed. This is the first decision to confirm.
- **Default toy size**: The default toy network has 40 neurons with an out-degree of 4 and 20% inhibitory neurons. These values are not stated in the ADR; they are chosen as informed defaults and are configurable. The "40-line" in the request refers to the size of the LIF core code, not to the neuron count.
- **Motor mapping**: The toy LEFT and RIGHT outputs drive the wheels directly. Mapping real motor groups from the connectome is out of scope (ADR 001, open question 2).
- **Fruit intensity source**: The world already provides a fruit intensity value for any position, as defined by the arcade world feature (`001-arcade-world-setup`). This feature consumes that value and does not change how fruit is placed.
- **Fruit contact**: A fruit contact is counted when a fly's position overlaps a fruit element. Eating effects, honey and danger responses remain out of scope, as in feature 001.
- **Random-walk baseline**: The baseline is a plain random walk with the same speed limits as toy-brain flies, so that the comparison isolates the brain's effect.
- **Seed set**: The comparison uses a fixed, configured list of at least five seeds, so results are repeatable.
- **Inspection readout**: The telemetry is shown in a simple readout panel. Charts, styling and export are not required by this feature.
- **Background tabs**: Flies pause while the tab is hidden and resume without catch-up movement.
- **Out of scope**: Connectome snapshots, the Python extractor, sign rules from neurotransmitter data, weight normalization, the growth loop after the connectome stage (ADR 001 Stage 3 and its growth loop), and touch input.
- **Dependency**: This feature depends on `001-arcade-world-setup` for the world, the fruit elements and the fly boundary.
