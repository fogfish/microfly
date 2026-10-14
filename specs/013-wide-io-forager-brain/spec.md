# Feature Specification: Wide-I/O Forager Brain (Brain v2)

**Feature Branch**: `015-wide-io-forager-brain`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Build new brain version 2 that uses the 11K brain (ADR 006) fixed the topology but
request interface is 12 inputs (food odour, danger odour, heat, mouth taste, leg taste and touch, each L/R) and 6
outputs (turn L/R, forward, backward, feed, escape). Three of the six senses are not in the 11K brain. Danger ORNs,
heat receptors and front-leg touch neurons are sensory classes. ADR 006 excludes them from fill, and they are not
pools, so the shipped snapshot has none of them (Annex A1, A3). This feature needs a re-extraction. The topology rule
does not change, and 10,410 of 11,000 neurons stay the same. The ADR 007-wide-io-forager-brain.md defines the
required brain version 2 architecture. Preserve the application compatibility with existing brains and
configurations. Integrate the visualization of new input / output and state channels into the side panel on UI."

**Governing decisions**: [ADR 007 (wide-I/O forager brain)](../../adrs/007-wide-io-forager-brain.md) defines the
brain's six bilateral senses, six outputs, the re-extraction this feature requires, the per-channel sense/site
declaration, the escape physics gate, and the fidelity and calibration protocol (D15–D20, W8–W11). [ADR 003 (hungry
forager brain)](../../adrs/003-hungry-forager-brain.md) defines the forager's eating rule, hunger modulation and
world loop, kept unchanged. [ADR 006 (class-seeded forager brain)](../../adrs/006-class-seeded-forager-brain.md)
defines the topology rule (central seed classes, fill by shared synapse weight, admission and edge threshold), which
this brain reuses verbatim — only the input and output pools move. This spec states what the visitor and the
maintainer get and how it is checked; the ADRs state how.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Watch a Fly Brake, Avoid and Touch in the World (Priority: P1)

A visitor opens a world that names the wide-I/O brain. A fly finds food by its odour as before, but now also slows
and turns to eat once its mouth or front legs taste a flower, turns away from a danger odour and a heat source
before reaching them, and turns toward a blocked front leg. The fly's escape drive is visible on the panel but moves
nothing, because the escape behaviour has no confirmed driver in the connectome yet.

**Why this priority**: Without a working world run, the wider interface is only a file on disk. The point of this
feature is a fly whose approach-and-feed, avoidance and touch behaviour the visitor can watch and tell apart from
the shipped forager brain.

**Independent Test**: Open a world file that names the wide-I/O snapshot, confirm the app starts with no console
error, and confirm a fly slows near food it tastes, turns away from a danger or heat source, and turns toward a
touched side.

**Acceptance Scenarios**:

1. **Given** a world file that names the wide-I/O snapshot under `flies.brain.version: v2`, **When** the world
   starts, **Then** flies run on the existing LIF core and runner, unchanged, reading all twelve declared inputs and
   driving all six declared outputs.
2. **Given** a hungry fly whose mouth and front legs are on a flower, **When** the brain updates, **Then** its raw
   `forward` drive is lower, and its `feed` and `backward` drives are higher, than when it is not on a flower.
3. **Given** a fly near a danger source or a heat source, **When** the brain updates, **Then** its steering drives
   turn it away, as reported by the behaviour comparison (User Story 6), not asserted as a guaranteed single-tick
   outcome.
4. **Given** a fly whose front leg is blocked, **When** the brain updates, **Then** its turn drive favours the
   touched side.
5. **Given** any fly running the wide-I/O brain, **When** the visitor inspects its motor output, **Then** an
   `escape` drive is present and visible, and the fly's position does not jump unless the world's escape physics is
   explicitly turned on.

---

### User Story 2 - Re-extract the Brain with the Wider Interface (Priority: P1)

A maintainer runs the extractor against the MaleCNS dataset with a configuration that keeps the 11K brain's topology
rule unchanged (its central seed classes, fill rule, admission and edge threshold) but replaces its four input and
five output pools with the twelve declared input channels and six declared output channels, each backed by its own
dataset filter. The result shares the great majority of its neurons with the shipped 11K brain, and the extractor
reports, for every declared input channel against every declared output channel, whether the brain's signed routes
agree with the whole connectome's.

**Why this priority**: The wider interface only has a claim to the dataset if every new channel is backed by a
real, filtered sensory or motor population, and the topology rule that makes the brain comparable to the 11K brain
is provably untouched.

**Independent Test**: Run the extractor with the wide-I/O config against the dataset and confirm it writes a
snapshot whose input and output pools match the twelve-channel, six-output interface, whose shared-neuron count
with the shipped 11K brain matches the configured topology, and whose fidelity report is printed and stored.

**Acceptance Scenarios**:

1. **Given** the wide-I/O config, **When** the extractor runs, **Then** every one of the twelve declared input
   channels and six declared output channels is backed by a non-empty, correctly filtered neuron population, with
   no pool overlapping another.
2. **Given** the same config, **When** the extractor runs, **Then** the central topology (seed classes, fill rule,
   admission, edge threshold) is identical to the shipped 11K config, and the two brains share the configured
   majority of their neurons.
3. **Given** the same config, **When** the extractor runs, **Then** it computes and prints a fidelity report
   comparing every declared input channel's signed route to every declared output, against the same routes on the
   whole thresholded connectome, before any behaviour run.
4. **Given** the config declares which of those checks must pass, **When** any required check fails, **Then** the
   extractor writes no file and reports which check failed and both compared values.
5. **Given** the same config and dataset run twice, **When** the two files are compared, **Then** they are
   byte-identical apart from the recorded creation time.

---

### User Story 3 - Keep Every Existing Brain and World Working (Priority: P1)

The world still picks its brain stack with the existing `flies.brain.version` setting. The wide-I/O brain is reached
through a new value, read by a dedicated code path that knows how to read a declared sense and site per channel;
every world and brain that worked before this feature — mock, v0, the shipped v1 forager, and the 11K class-seeded
brain — keeps working with no file edit and no change in behaviour.

**Why this priority**: The project compares brains side by side. That only works if adding the widest brain yet
never disturbs any brain already shipped.

**Independent Test**: Run the mock, v0, shipped v1 forager, 11K and wide-I/O worlds in turn, each by its own file,
with no code change to any of their configs and no change in their behaviour.

**Acceptance Scenarios**:

1. **Given** the existing mock, v0, v1 forager and 11K worlds, **When** each is opened after this feature ships,
   **Then** each behaves exactly as before.
2. **Given** a new world file naming the wide-I/O snapshot, **When** it is opened, **Then** it selects the brain
   under its own declared version, with no existing world file needing a new value or a new field.
3. **Given** a world whose declared brain version does not match its snapshot's declared channel set, **When** it
   starts, **Then** the app refuses to start and names the mismatch, exactly as it already does for a version
   mismatch.
4. **Given** a snapshot that declares an input channel's sense without the world defining where that sense comes
   from, **When** the world starts, **Then** the app refuses to start and names the missing sense, rather than
   silently reading zero.

---

### User Story 4 - See the Wider Interface and Escape Telemetry in the Side Panel (Priority: P2)

A visitor inspecting a fly that runs the wide-I/O brain can see all twelve input channels and all six output
channels in the side panel, each labelled by the sense or action it represents (food odour, danger odour, heat,
mouth taste, leg taste, touch; turn left/right, forward, backward, feed, escape) rather than by a bare channel
index. The escape output is visible as telemetry even while the world's escape physics stays off. Brains that do
not declare these additional channels (mock, v0, v1, the 11K brain) show the same panel they show today, with no
new or empty section.

**Why this priority**: A twelve-input, six-output brain is unreadable on a panel built for four inputs and five
outputs with hard-coded labels. Without this, the visitor cannot tell which drive responds to which sense.

**Independent Test**: Select a fly running the wide-I/O brain and confirm all twelve inputs and six outputs are
individually labelled and live-updating; select a fly running an older brain and confirm the panel is unchanged.

**Acceptance Scenarios**:

1. **Given** a fly running the wide-I/O brain, **When** the visitor opens the panel, **Then** each of the twelve
   input channels is shown labelled by its sense and side (for example "danger odour, left"), with a live value.
2. **Given** the same fly, **When** the visitor opens the panel, **Then** each of the six output channels is shown
   labelled by its action (for example "escape"), with a live value, including the escape drive while the world's
   escape physics is off.
3. **Given** a fly running mock, v0, the shipped v1 forager or the 11K brain, **When** the visitor opens the panel,
   **Then** it renders exactly as it did before this feature, with no new or placeholder section.

---

### User Story 5 - Turn Escape Physics On for Calibration (Priority: P3)

A maintainer calibrating or demonstrating the escape behaviour sets the world's escape physics on. With it on, a
fly whose escape drive crosses the configured threshold jumps once along its heading and then cannot jump again
until its cooldown passes; with it off, the same drive is computed and shown but moves nothing.

**Why this priority**: Escape has no confirmed connectome driver yet (ADR 007 D17), so it ships off by default; a
maintainer still needs a documented, config-only way to exercise the physics for calibration or a future visual
input.

**Independent Test**: With escape physics on in a world config, drive a fly's escape output above threshold and
confirm it jumps once and then waits out its cooldown before jumping again; with escape physics off, confirm the
same drive never moves the fly.

**Acceptance Scenarios**:

1. **Given** a world with escape physics off (the default), **When** a fly's escape drive exceeds the threshold,
   **Then** the fly's position does not change because of it.
2. **Given** a world with escape physics on, **When** a fly's escape drive exceeds the threshold and its cooldown
   has elapsed, **Then** the fly moves once along its heading and starts a new cooldown.
3. **Given** escape physics on and a fly mid-cooldown, **When** its escape drive exceeds the threshold again,
   **Then** the fly does not move again until the cooldown elapses.

---

### User Story 6 - Compare the Wide-I/O Brain Against the Established Arms (Priority: P3)

A maintainer runs the existing behaviour-comparison experiment with the wide-I/O brain as an arm, alongside the
shipped 11K brain, a size-matched random graph of the wide-I/O brain, and the random walk, on held-out seeds. The
report includes the existing forager metrics plus the brake, avoidance and touch measurements this brain was built
to test, and the escape drive reported as telemetry only.

**Why this priority**: The brain's purpose is to test whether the wider interface produces the brake and avoidance
behaviour the shipped and 11K brains could not; that only means something measured against the same null arms used
before.

**Independent Test**: Run the comparison script with the wide-I/O world and confirm it reports every existing
forager metric plus the brake, stay, avoid and touch measurements for every arm, with the held-out seed count.

**Acceptance Scenarios**:

1. **Given** the wide-I/O world, **When** the comparison script runs, **Then** it reports find, approach, eat,
   leave and hunger-dependence metrics, plus the brake, stay, avoid and touch measurements, for the wide-I/O brain,
   the shipped 11K brain, the size-matched random graph and the random walk.
2. **Given** a metric where the wide-I/O brain does not beat the random walk or the random graph, **When** the
   result is reported, **Then** it is recorded as measured, with the run that produced it, and is not hidden or
   made to pass by hand-wiring a connection or changing a dataset-derived weight.
3. **Given** the same run, **When** the report is produced, **Then** the escape drive is reported as a mean value
   inside versus outside the danger radius, with no pass/fail claim attached.

---

### Edge Cases

- A declared input or output filter matches no traced body: the extractor stops with a named code and writes no
  file.
- A side-matched channel pair does not have exactly one left and one right channel: the extractor stops with a
  named code before fill.
- A required fidelity check fails: the extractor stops, writes no file, and names which check failed with both
  compared values.
- A fidelity check is not required and fails anyway: the extractor still writes the file, and the mismatch is
  recorded in the report as a finding, not hidden.
- A world names the wide-I/O snapshot under a brain version its container does not support, or a version-v2 world
  names a snapshot that is not wide-I/O: the app refuses to start and names both the expected and actual value.
- A snapshot declares a sense that the world's stimulus configuration does not define: the app refuses to start and
  names the missing sense, rather than reading a silent zero.
- An older snapshot (mock, v0, v1 forager, 11K) has none of the new per-channel sense/site fields: the reader loads
  it exactly as before, and the panel shows no new section for it.
- The world's escape physics is on, the fly is in cooldown, and its escape drive exceeds threshold again: no second
  jump happens until the cooldown elapses.
- A behaviour claim the connectome does not support (leg taste turning toward its touched side using only
  food-taste receptors; the escape output receiving a confirmed touch or taste driver) is reported as a finding,
  not quietly made to pass.

## Requirements *(mandatory)*

### Functional Requirements

**Brain choice and compatibility**

- **FR-001**: The world config MUST continue to select the brain stack with the existing `flies.brain.version`
  setting; the wide-I/O brain MUST be reached under its own declared value, and this feature MUST NOT change the
  meaning of `mock`, `v0` or the existing `v1` value for any brain that does not declare the wide twelve-channel
  interface.
- **FR-002**: The wide-I/O brain MUST run on the existing LIF core and the existing brain runner, unchanged; no new
  simulation mechanism MUST be introduced to support the wider interface.
- **FR-003**: The wide-I/O brain's central topology (seed classes, fill rule, admission rule, edge threshold) MUST
  be identical to the shipped 11K brain's; only its input and output pools MUST differ.
- **FR-004**: Every world file and brain snapshot that works before this feature MUST keep working unchanged; the
  wide-I/O brain MUST be reached only through a new world file and a new brain version value, never by editing an
  existing world or snapshot.
- **FR-005**: The app MUST refuse to start, naming the mismatch, when a world's declared brain version does not
  match its snapshot's declared channel set — unchanged in spirit from the existing version-mismatch check, and
  verified for the new snapshot too.

**Extraction**

- **FR-006**: The extractor MUST support declaring twelve bilateral input channels (food odour, danger odour, heat,
  mouth taste, leg taste, touch; left and right) and six output channels (turn left, turn right, forward, backward,
  feed, escape), each backed by its own dataset filter, chosen by configuration.
- **FR-007**: Each declared input and output channel MUST be populated only by traced bodies matching its declared
  filter, with no body placed in more than one channel's pool.
- **FR-008**: Where a channel pair is declared side-matched, the extractor MUST require exactly one left and one
  right population for that pair and MUST record any traced bodies the side-matching rule excludes.
- **FR-009**: The extractor MUST keep the shipped 11K brain's seed classes, fill rule, admission rule and edge
  threshold unchanged for this brain; a re-extraction MUST produce a brain that shares the great majority of its
  neurons with the shipped 11K brain, at a configured minimum share.
- **FR-010**: Before any behaviour run, the extractor MUST compute and print a fidelity report comparing every
  declared input channel's signed route to every declared output channel, both on the selected brain and on the
  whole thresholded connectome.
- **FR-011**: The configuration MUST declare which fidelity comparisons are required to pass; when a required
  comparison fails, the extractor MUST write no file and report which comparison failed and both compared values.
  Comparisons not marked required MUST still be computed, reported and stored, never silently dropped.
- **FR-012**: The extractor MUST stop with a named failure code and write no file for: an empty input or output
  filter, a side-matched pair without exactly one channel per side, and the existing forager and class-seeded
  failure conditions (side imbalance, unreached output, neuron count out of range, non-determinism between two
  runs).
- **FR-013**: Given the same configuration and dataset, the extractor MUST produce a byte-identical snapshot,
  apart from the recorded creation time.
- **FR-014**: The extractor MUST keep producing the existing small brain, the existing flow-ranked forager brain and
  the existing 11K class-seeded brain exactly as before; adding the wide-I/O channel set MUST NOT change any of
  their output.
- **FR-015**: Declaring the giant-fibre output MUST remove its outgoing connections from the network, consistent
  with how every other declared output pool is treated.

**Simulator and application**

- **FR-016**: The snapshot reader MUST accept a declared sense and body site per input channel and MUST let the
  host read sensory values by that declaration instead of by a fixed channel count or order.
- **FR-017**: The world config MUST let a map declare where each named sense comes from (for example, a danger
  odour from a kind of hazard, or touch from whether a body site's cell is walkable), and MUST let a fly's body
  declare where each site sits relative to its centre.
- **FR-018**: When a snapshot declares a sense that the world's stimulus configuration does not define, the app
  MUST refuse to start and name the missing sense.
- **FR-019**: The world MUST support an escape action gated by a configured threshold and cooldown, moving the fly
  once per cooldown period while its escape drive exceeds the threshold, and MUST default this action to having no
  effect on fly position regardless of the drive's value.
- **FR-020**: The brain inspector and the app's brain activity view MUST list and draw the wide-I/O brain's
  snapshot the same way they already do for every other listed snapshot.

**Side panel visualization**

- **FR-021**: For a brain whose snapshot declares more than the original four input and five output channels, the
  side panel MUST show every declared input and output channel individually, each labelled by its declared sense
  or action and side, with a live-updating value.
- **FR-022**: The side panel MUST show the escape output's live value regardless of whether the world's escape
  physics is turned on.
- **FR-023**: For a brain whose snapshot declares only the original channel set (mock, v0, v1 forager, 11K), the
  panel MUST render exactly as it did before this feature: no new or placeholder section.

**Measurement**

- **FR-024**: The existing behaviour-comparison experiment MUST be able to run the wide-I/O brain as an arm
  alongside the shipped 11K brain, a size-matched random graph of the wide-I/O brain, and the random walk, on
  held-out seeds, reporting the existing forager metrics plus a brake measurement (raw forward drive on food versus
  off food), a stay measurement (ticks per visit), an avoid measurement (time near a danger or heat source versus
  the random walk) and a touch measurement (turn direction after a one-sided touch versus the random walk).
- **FR-025**: The escape drive MUST be reported by the comparison experiment as a measured value (inside versus
  outside a danger radius), with no pass/fail claim attached, since the connectome does not confirm a driver for
  it.
- **FR-026**: A metric the wide-I/O brain does not pass MUST be reported as measured, with the run that produced
  it; it MUST NOT be hidden, and MUST NOT be made to pass by hand-wiring a connection or changing a dataset-derived
  weight.

### Key Entities *(include if feature involves data)*

- **Input channel**: one of twelve declared bilateral sensory pools (food odour, danger odour, heat, mouth taste,
  leg taste, touch; left/right), each backed by its own dataset filter and declaring the sense and body site it
  represents.
- **Output channel**: one of six declared motor pools (turn left, turn right, forward, backward, feed, escape).
- **Side-matched pair**: a pair of input or output channels whose populations are required to have one left and one
  right member per matched type; unmatched pairs keep their populations as filtered, without that requirement.
- **Fidelity report**: a table comparing every declared input channel's signed route to every declared output
  channel, on the selected brain and on the whole thresholded connectome; some comparisons may gate extraction,
  others are reported only.
- **Sense/site declaration**: a snapshot-side statement of which world sense an input channel reads and which body
  site it reads from; paired with a world-side statement of where each sense comes from and where each site sits on
  the fly's body.
- **Escape action**: a world behaviour gated by a configured threshold and cooldown, computed from the brain's
  escape output but disabled by default so the drive is visible without moving the fly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extractor writes the wide-I/O brain from the MaleCNS dataset with all twelve input and six output
  channels populated, the shared-neuron count with the shipped 11K brain at or above the configured minimum share,
  every required fidelity comparison passing, and the full comparison table stored with the snapshot; a second run
  gives an identical file apart from the creation time.
- **SC-002**: The existing small brain, flow-ranked forager brain and 11K class-seeded brain still extract to the
  same output as before this feature.
- **SC-003**: A visitor runs the mock, v0, shipped v1 forager, 11K and wide-I/O worlds in turn, each by opening its
  own file, with no existing world file needing an edit and no change in any of their behaviour.
- **SC-004**: Six wide-I/O flies running at the configured tick rate keep the page responsive, with the per-step
  cost measured and recorded.
- **SC-005**: On held-out seeds, the existing forager metrics plus the brake, stay, avoid and touch measurements are
  reported for every comparison arm (the wide-I/O brain, the shipped 11K brain, the size-matched random graph and
  the random walk); the escape drive is reported as telemetry; any arm that does not beat the random walk is
  recorded as measured, not hidden.
- **SC-006**: A visitor selecting a fly on the wide-I/O brain can read all twelve input values and all six output
  values individually labelled in the panel, including the escape drive while escape physics is off.
- **SC-007**: A visitor on the mock, v0, v1 forager or 11K brain sees no change anywhere in the panel: no new
  section appears for a brain whose snapshot does not declare the wider channel set.
- **SC-008**: With the world's escape physics turned on, a fly whose escape drive crosses threshold moves at most
  once per configured cooldown period; with it off (the shipped default), the same drive never moves a fly.

## Assumptions

- **Dataset**: MaleCNS v1.0, traced-only edge variant, the same dataset location convention as the existing
  extractor (`data/malecns`, not committed).
- **Topology is fixed by ADR 006 and reused verbatim (ADR 007 D18)**: the central seed classes, fill rule, admission
  rule and edge threshold do not change; only the input and output pools move. This feature does not propose a new
  selection rule.
- **Three of the six senses (danger odour, heat, front-leg touch) have no traced neurons in the shipped 11K snapshot
  (ADR 007 Annex A1, A3)**, so this feature requires a full re-extraction rather than a remap of the existing
  snapshot; roughly ninety-five percent of neurons are expected to carry over.
- **Leg taste excludes the male foreleg pheromone receptors (`ppk23`/`ppk25`) by design (ADR 007 D16)**, even though
  including them would better match the requested "leg taste turns toward its side" behaviour; this is a declared,
  reversible exclusion, not an oversight, and the resulting away-turn is reported as a finding rather than
  corrected.
- **The escape output has no connectome-confirmed tactile or gustatory driver (ADR 007 D17, Annex A7)**; its
  physics therefore ships off by default, and turning it on is a world-config change for calibration or a later
  feature that adds a visual input, not a claim this feature makes.
- **Calibration values (LIF scale, gains, output scaling, stimulus gains) are set on calibration seeds kept separate
  from held-out seeds**, following the existing staged protocol; the chosen values and the run that motivated them
  are recorded outside this spec, as the shipped forager and 11K brains' are.
- **No LIF mechanism changes (ADR 007, "Decisions: LIF core and runner")**: the LIF core, the worker protocol and
  the golden-spike test stay exactly as they are; this feature changes the interface declared around them, not the
  simulation itself.
- **Browser support**: unchanged — the same environment as the existing app (evergreen browsers with module
  workers, typed arrays, no build step).
- **Versions**: the snapshot container format stays at its current version; the channel-declaration format gains a
  new version for the wide-I/O channel kind, and the extraction-config format gains a new version for the new
  filter keys this brain needs. Older formats and the brains built from them are unaffected.
