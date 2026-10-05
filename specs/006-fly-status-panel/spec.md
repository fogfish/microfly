# Feature Specification: Fly Status Side Panel

**Feature Branch**: `006-fly-status-panel`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Split the view port into the world and right side panel that shows a status of fly. The fly status consits of * Action the fly is taken * Visualization of the brain neurons and aggregated spike activation over past ticks. The user should be able what part of brain has been active recently * Input signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. food odor, danger, etc). The channes as supported by the LIF and Brain. * Output signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. leg motor, wing motor etc). The channes as supported by the LIF and Brain. The panel and channels visualization has to be extendible to the capabilities enabled in the brain and LIF."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Selected Fly's Status Beside the World (Priority: P1)

A visitor opens the app and sees the world on the left part of the screen and a status panel
on the right. The panel shows the selected fly's current action. The world and the panel
share the viewport without covering each other, so the panel never hides part of the world.
Clicking a fly in the world, or choosing it from the fly list, updates the panel.

**Why this priority**: The split layout and the action readout are the minimum that makes the
panel useful. Every other story adds content to this frame.

**Independent Test**: Open the app on a desktop-width screen and confirm the world and the
panel are side by side with no overlap. Select a fly and confirm the panel shows that fly's
current action and changes as the fly moves or turns.

**Acceptance Scenarios**:

1. **Given** the app is opened on a screen at least 900 px wide, **When** the world loads,
   **Then** the world fills the area left of a right-hand panel, and the panel does not overlap
   the world.
2. **Given** a fly is selected, **When** the fly is moving forward, **Then** the panel's action
   reads "Forward".
3. **Given** a selected fly is turning, **When** its motor output favours one side, **Then** the
   action reads "Turn left" or "Turn right" according to the side it turns toward.
4. **Given** a selected fly is neither moving nor turning, **When** both motor outputs are near
   zero, **Then** the action reads "Idle".
5. **Given** no fly is selected, **When** the panel is shown, **Then** ~~it shows the fly list and
   a prompt to select a fly, and no readouts.~~ the World tab shows the fly list, and the Fly tab
   shows a prompt to select a fly and no readouts (BUG-001, FR-016).

---

### User Story 2 - See Which Brain Neurons Were Recently Active (Priority: P2)

The panel shows the brain of the selected fly as a map of its neurons. Each neuron shows how
often it spiked over a recent window of ticks, so the user can see which part of the brain has
been active lately. The window and the activity measure are the same for every brain.

**Why this priority**: This is the main reason for the panel: it explains what the brain is
doing. It depends on the frame and action readout from User Story 1.

**Independent Test**: Select a fly whose brain is running, watch the neuron map for a few
seconds, and confirm that neurons that spike appear brighter, that quiet neurons stay dim, and
that the brightness decays as the window moves on.

**Acceptance Scenarios**:

1. **Given** a selected fly with a running brain, **When** a neuron spikes, **Then** its entry in
   the map becomes brighter within the next update.
2. **Given** a neuron stops spiking, **When** the recent window has passed, **Then** its entry
   returns to the dim level.
3. **Given** a brain with more neurons than fit the panel, **When** the map is shown, **Then** the
   user can still see the active area, and the panel shows the total number of neurons and the
   number of active neurons in the window.
4. **Given** a fly that uses no brain (baseline mode), **When** it is selected, **Then** the brain
   map is replaced by a message that no brain is in use.

---

### User Story 3 - Read the Input Signals per Channel (Priority: P3)

The panel lists the input channels the fly's brain can receive. Each channel is one row with a
bar for the signal level, ~~grouped under Left (L) and Right (R).~~ drawn as one centred bar on one row, with L to the left of the zero line and R to the right (BUG-001, FR-017). The channel's label names what it
senses (for example "Food odour" or "Danger"). The current level is shown next to the bar.

**Why this priority**: It explains why the brain reacts. It depends on the panel frame, and it
has value only once input channels exist to show.

**Independent Test**: Select a fly near fruit and check that the food-odour bar rises. Move the
fly away and check that the bar falls to the resting level.

**Acceptance Scenarios**:

1. **Given** a selected fly near fruit, **When** the fruit signal increases, **Then** the matching
   input bar grows and its numeric value increases.
2. **Given** a selected fly with no fruit nearby, **When** the panel is shown, **Then** the input
   bar sits at the resting level stated for that channel.
3. **Given** the brain declares a new input channel, **When** the app runs, **Then** the new
   channel appears as a new row with its label, without changes to the panel code.

---

### User Story 4 - Read the Output Signals per Channel (Priority: P3)

The panel lists the output channels the brain drives. Each channel is one row with a bar for the
motor level, ~~grouped under Left (L) and Right (R).~~ drawn as one centred bar on one row, with L to the left of the zero line and R to the right (BUG-001, FR-017). The label names the motor it drives (for
example "Leg motor" or "Wing motor"). Output bars show the same signal that moves the fly.

**Why this priority**: It completes the picture from input to action. It is as important as
User Story 3 but depends on the same panel frame.

**Independent Test**: Select a fly and turn it. Check that the bar of the side it turns toward
grows and that the action in User Story 1 agrees with the bars.

**Acceptance Scenarios**:

1. **Given** a selected fly, **When** its left motor output rises, **Then** the Left output bar
   grows and the fly turns or moves as the action readout states.
2. **Given** the brain declares a new output channel, **When** the app runs, **Then** the new
   channel appears as a new row with its label, without changes to the panel code.

---

### User Story 5 - Extend the Panel to New Brain and Neuron Capabilities (Priority: P3)

A developer adds a capability to the brain or the LIF core, such as a new sensor, a new motor
output, or a neuron type. The panel shows it without rewriting the panel. The developer
declares the channel or neuron group in one place, and the panel reads that declaration.

**Why this priority**: The request requires that the panel grows with the brain. It is a
guarantee about structure, verified by adding a channel in a test.

**Independent Test**: Add one input channel and one output channel to a test brain declaration.
Confirm both appear in the panel with labels and bars and that no panel source file changed.

**Acceptance Scenarios**:

1. **Given** a brain declares channels with an id, label, side and kind, **When** the panel is
   built, **Then** it renders one row per declared channel, grouped by side.
2. **Given** a channel declaration is missing its label or side, **When** the app loads, **Then**
   the error panel names the channel and the missing field, and the panel does not guess.
3. **Given** a brain with a different neuron count, **When** it is selected, **Then** the neuron map
   adapts to that count without a change to the panel code.

---

### Edge Cases

- No fly is in the world or every fly failed to start: the panel shows the existing "no flies"
  or error message and the world is still drawn.
- A fly's worker reports an error: the panel shows the error text and no stale readouts.
- The viewport is narrower than 900 px (for example a phone): the panel is placed below the world
  or over it at the bottom, with a 16 px gutter and no horizontal page scroll, as in the current
  layout.
- A channel's value is outside its declared range: the bar is clamped to the range and the
  number shows the true value.
- The brain has zero spikes in the window: the map is fully dim and the active count reads 0.
- Selection changes while a fly's history is still short: the readouts show "Waiting for the first
  tick" until enough history exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The viewport MUST be split into a world area and a right-hand fly status panel. The
  world area MUST NOT be covered by the panel on screens at least 900 px wide.
- **FR-002**: The panel MUST show the action of the selected fly, one of: Forward, Turn left,
  Turn right, Idle. The action is derived from that fly's current left and right motor outputs.
- **FR-003**: The panel MUST show a map of the selected fly's brain neurons. Each neuron's
  brightness MUST reflect its spike count over the last 20 ticks.
- **FR-004**: The panel MUST show, for the brain map, the total neuron count and the count of
  neurons that spiked within the window.
- **FR-005**: For a brain larger than the panel can draw one-per-neuron, the panel MUST show an
  aggregated view that keeps the active area visible, and MUST state how many neurons it covers.
- **FR-006**: The panel MUST show input channels as bars, one row per channel, ~~grouped under Left
  (L) and Right (R).~~ Each row MUST show a label, the bar and the numeric value. (BUG-001: the bar is
  centred on one row, see FR-017.)
- **FR-007**: The panel MUST show output channels as bars, one row per channel, ~~grouped under Left
  (L) and Right (R).~~ Each row MUST show a label, the bar and the numeric value. (BUG-001: the bar is
  centred on one row, see FR-017.)
- **FR-008**: Channels MUST be declared by the brain (or LIF) as data: id, label, side (L or R),
  kind (input or output), and value range. The panel MUST render every declared channel without
  code changes to the panel.
- **FR-009**: A channel declaration that lacks a required field, or has an unknown side or kind,
  MUST be reported on the error panel with the channel id and the problem. The app MUST NOT start
  the panel from a partial declaration.
- **FR-010**: The panel MUST read the brain's neuron count and channel list from the brain's own
  description, so a brain with a different neuron count or channel set needs no panel change.
- **FR-011**: For a baseline fly (no brain), the panel MUST show the action and the output bars,
  and MUST state that no brain is in use in place of the neuron map.
- **FR-012**: The panel MUST refresh at least 5 times a second while flies run, and user actions
  (selecting a fly, switching tabs, the odour switch) MUST show at once. The panel MUST NOT follow
  every tick, because re-rendering it at the tick rate flickers in Safari, and it MUST NOT block the
  world from drawing.
- **FR-013**: Clicking a fly in the world MUST select it, and selecting a fly from the fly list
  MUST show the same panel content.
- **FR-014**: All text and labels MUST be written as plain text, so values from configuration or
  workers are never read as markup.
- **FR-015**: The panel MUST work on a phone width (16 px side gutter, no horizontal page scroll),
  stacking below the world instead of beside it.
- **FR-016**: The panel MUST have two tabs: "World", which shows the fly list, and "Fly", which shows
  the selected fly's status (action, neuron map, inputs and outputs). The World tab is shown on
  load. Choosing a fly by click in the world or from the list MUST select it and switch to the Fly
  tab. The tabs MUST apply at every width, including phone width (BUG-001).
- **FR-017**: Each input and output channel MUST be one row with a zero line at the centre of the bar
  area. A Left (L) channel's bar MUST grow from the centre toward the left edge. A Right (R) channel's
  bar MUST grow from the centre toward the right edge. Bar length is the value clamped to
  [0, the range maximum], as a fraction of half the row. A channel with side "both" MUST draw one bar
  on each side of the zero line (BUG-001).
- **FR-018**: L bars, R bars and "both" bars MUST use three distinct colours, defined as colour tokens
  for both light and dark themes. The numeric value MUST still show the true value (BUG-001).

### Key Entities *(include if feature involves data)*

- **Fly status**: The selected fly's action, its last input and output values, and its recent
  spike history. Derived from the fly's motor and sensor values and the brain's telemetry.
- **Channel**: A named signal the brain or LIF exposes. Attributes: id, label, side (L or R),
  kind (input or output), value range. Declared by the brain, not hard-coded in the panel.
- **Neuron activity**: For each neuron in the brain, the count of spikes over the last 20 ticks.
  Used for brightness in the neuron map.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a desktop-width screen, the world and the panel are visible side by side with
  no overlap, and the world keeps at least 60% of the viewport width.
- **SC-002**: The action readout matches the fly's motion in at least 95% of sampled ticks when
  checked against its motor outputs.
- **SC-003**: A neuron that spikes becomes visibly brighter within one second, and returns to the
  dim level within one second after the 20-tick window has passed.
- **SC-004**: A newly declared input or output channel appears in the panel with its label, side
  and bar, with zero edits to the panel source files.
- **SC-005**: A malformed channel declaration is reported on the error panel with its id in 100%
  of tested cases, and the panel does not render a partial list.
- **SC-006**: Selecting a fly updates the panel within one second, and the world keeps drawing at
  its normal frame rate while the panel updates.
- **SC-007**: At phone width, the panel and the world can both be reached without horizontal
  scrolling.

## Assumptions

- **Action labels**: Forward, Turn left, Turn right and Idle are the only action labels. The
  thresholds that decide them are a named setting in the brain or fly configuration, not fixed
  in the panel.
- **Activity window**: The window is 20 ticks, matching the existing telemetry window.
- **Neuron map**: Shown as a grid or a compact graph of neurons with brightness for activity. The
  exact drawing is a planning decision, and the spec only requires the behaviour in User Story 2.
- **Channel kinds**: Only input and output channels are in scope. Other kinds (for example, a
  modulator) are out of scope until the brain declares them.
- **Existing signals**: The panel shows only the signals the LIF and brain already produce. No new
  sensing or motor behaviour is added by this feature.
- **Layout**: The panel is on the right of the viewport on desktop widths and stacks below the
  world on phone widths. The current bottom-anchored fly list is replaced by the side panel.
- **Selection**: The fly list and the click on a fly both select the fly; one fly is selected at a
  time, as in the current panel.

## Decisions

- **Input channels (decided 2026-10-05)**: The brain has one sensory input today (fruit
  intensity on neuron 0), with no left/right split. The panel shows that input once, labelled
  "Food odour" and marked as both sides (side: both). A left/right sensory split is a separate,
  later brain change and is out of scope here. Because the channel declaration carries a side,
  the split can be added later without changing the panel (FR-008, User Story 5).
- **Tabs (decided 2026-10-05, BUG-001)**: The panel has a "World" tab (fly list, shown on load) and
  a "Fly" tab (status of the selected fly). Selecting a fly switches to the Fly tab. This default was
  chosen by the bugfix patch; change it here if another default is wanted (FR-016).
- **Both-side channels (decided 2026-10-05, BUG-001)**: A channel with side "both" is one centred row
  with a bar on each side of the zero line, in the neutral "both" colour (FR-017, FR-018). This was
  chosen by the bugfix patch and can be changed here.
- **Channel bar scale (decided 2026-10-05, BUG-001)**: The zero line is the centre of the row. The bar
  is the value clamped to [0, range maximum] as a fraction of half the row. The declared minimum does
  not move the zero line (FR-017).

**Bugfix**: 2026-10-05 — BUG-001 Tabs for the World and Fly views, and one centred bar row per channel with L and R colours (FR-016 to FR-018; User Story 1 scenario 5; FR-006, FR-007; User Stories 3 and 4).
