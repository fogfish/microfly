# Feature Specification: Cautious Forager Brain (15K, LIF v2)

**Feature Branch**: `013-forager-brain-15k-lif-v2`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "Write an utility to parse malecns dataset, extract the brain as defined by ADR 006-cautious-forager-brain-15k.md. This ADR defines a brain of about 15,000 connectome neurons with 12 input channels (six bilateral senses) and 6 output channels. It has a better properties to find food, Brake and eat food, avoid danger odour, touch things and escape from danger. Integrate the brain into LIF and simulator as LIF v2. Keep existing LIF, brains available under the versions mock, v0 and v1, keep same mechanism to choose the configuration. Make sure the extractor is able to produce multiple brain formats and application is able to operate them. Integrate the visualization of new input / output and state channels into the side panel on UI."

**Bugfix**: 2026-10-10 — [BUG-001](bugs/BUG-001.md): the `forward` output pool's admitted subgraph is net
inhibitory (measured −867 signed weight/neuron), so the `v2` brain cannot register net forward locomotion at any
LIF setting. Adds FR-032/SC-012 (no output pool may ship net-inhibitory) and reclassifies the Assumptions' Q2 from
"left to calibration" to "blocking" below.

**Governing decisions**: [ADR 006 (cautious forager brain, 15K)](../../adrs/006-cautious-forager-brain-15k.md) defines the
brain, the input and output pools, the admission and selection rules, the LIF and runner extensions, and the world
and contract changes. It extends [ADR 003](../../adrs/003-hungry-forager-brain.md), [ADR 004](../../adrs/004-output-pool-synaptic-scale.md)
and [ADR 005](../../adrs/005-dynamical-regime.md). This spec states what the user gets and how it is checked; the
ADR states how.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Cautious Fly Finds Food With Six Senses (Priority: P1)

A visitor starts the world with the new brain (v2). A hungry fly smells food odour from a distance and turns toward
the stronger side, exactly as the v1 forager did, but now its front legs also sense taste and touch half a body
length before its mouth reaches a flower, so the fly can react to what is under its feet before it arrives.

**Why this priority**: Finding food is the baseline capability every later behaviour depends on. The six-sense
interface is what makes the rest of this brain (braking, avoiding, touching, escaping) possible, so it must keep
working as well as the v1 brain did.

**Independent Test**: Load the world with the v2 brain, place a fly farther than one odour radius from a flower
with a seeded run, and check that the fly's path ends on the flower at least as often as the v1 brain did, over
held-out seeds.

**Acceptance Scenarios**:

1. **Given** a hungry fly farther than the odour radius from every flower, **When** food odour reaches its antennae,
   **Then** the fly turns toward the stronger side and moves toward the flower.
2. **Given** a fly approaching a flower, **When** its leading front leg reaches the flower's cell before its mouth
   does, **Then** the fly's leg-taste and touch channels report a nonzero value before its mouth-taste channel does.
3. **Given** the same held-out seeds, **When** the v2 brain and the v1 brain are compared, **Then** v2's food-finding
   rate is not worse than v1's.

---

### User Story 2 - The Fly Brakes and Eats on a Flower (Priority: P1)

When the fly's mouth reaches a flower, mouth taste lowers its forward drive and raises its feeding drive, so the fly
slows down, stops and eats, rather than taste only reading as "more forward" the way the v1 brain did. Leg taste
pulls the fly back and toward the flower's side so it stays on the flower while eating.

**Why this priority**: This is the capability the v1 brain measurably lacked (it found food but never braked or ate
on it). It is the headline result this brain generation exists to deliver.

**Independent Test**: Place a hungry fly on a flower in a seeded run with the v2 brain and confirm its median forward
drive with mouth taste present is lower than its forward drive off a flower, that this ratio is lower than the
size-matched random-graph arm's, and that the fly eats.

**Acceptance Scenarios**:

1. **Given** a hungry fly whose mouth is on a flower, **When** mouth taste is present, **Then** the fly's forward
   drive is lower than it is off a flower, and its feeding drive is above threshold, so it eats.
2. **Given** a fly eating on a flower, **When** leg taste is read on one side, **Then** the fly's backward and
   turn-toward-that-side drives are no lower than they are with no leg taste, keeping it on the flower.
3. **Given** the eat metric, **When** measured on held-out seeds, **Then** it passes where the v1 brain's did not.

---

### User Story 3 - The Fly Avoids Danger Odour and Heat (Priority: P1)

A fly senses danger odour and heat on each side, separately from food odour, and these senses reach the same turning
and forward outputs food odour does, so the fly's steering is shaped by what the connectome's wiring does with
them — toward or away — rather than by a world rule that tells it to flee.

**Why this priority**: Avoiding danger is one of the five behaviours this brain generation is built to measure. The
v1 brain had no danger or heat senses at all.

**Independent Test**: Run a fly near a spider (danger odour source) and a lantern (heat source) on held-out seeds
and report the fraction of ticks spent within a fixed distance of each, against the random-walk baseline, with its
sign (toward or away) stated either way.

**Acceptance Scenarios**:

1. **Given** a fly within sensing range of a spider, **When** danger odour is read, **Then** the fly's steering
   output changes from what it would be with no danger odour.
2. **Given** a fly within sensing range of a lantern, **When** heat is read, **Then** the fly's steering output
   changes from what it would be with no heat.
3. **Given** held-out seeds, **When** time-near-danger and time-near-heat are measured for the brain and for the
   random walk, **Then** both are reported with their sign, whether or not avoidance is stronger than the random
   walk's.

---

### User Story 4 - The Fly Reacts to Touch and Escapes Danger (Priority: P1)

When a front leg bumps into something it cannot walk through, the fly turns in response, and when danger builds up
enough through its touch and taste paths, the fly escapes with a single fast jump along its heading, the way a real
fly's giant-fibre reflex does.

**Why this priority**: Touch and escape are two of the five behaviours this brain generation is built to measure,
and escape is a new output channel that did not exist in the v1 brain.

**Independent Test**: Block a fly's path on one side in a seeded run and confirm its heading changes in a direction
that can be measured and compared against the random walk. Separately, drive the fly into a high-danger situation
and confirm it performs a bounded, cooldown-limited jump when its escape output crosses the configured threshold.

**Acceptance Scenarios**:

1. **Given** a fly whose front leg meets a non-walkable cell, **When** touch is read on that side, **Then** the
   fly's turn output changes, and the direction is recorded against the wall-following question this behaviour
   raises.
2. **Given** a fly whose escape output rises above its configured threshold and the fly is not in cooldown, **When**
   a tick passes, **Then** the fly moves a fixed distance along its heading, stopping at the first non-walkable
   cell, and then enters cooldown.
3. **Given** a fly in escape cooldown, **When** its escape output is above threshold again, **Then** no second jump
   happens until cooldown ends.

---

### User Story 5 - Choose the Brain Version in Config (Priority: P1)

The user keeps choosing which brain runs the flies with the same one setting in the world config, now with a fourth
value: `mock` (the random toy brain), `v0` (the small brain), `v1` (the hungry forager brain) or `v2` (the cautious
forager brain of ADR 006, from a 15K snapshot). The same world can be run with each choice to compare them, and
every existing world config keeps working with no edit.

**Why this priority**: Without a config-only switch, the new brain cannot be compared against the earlier ones on
the same map and seeds, which is the entire point of building successive brain generations.

**Independent Test**: Run the same world with `mock`, `v0`, `v1` and `v2` in turn and confirm each one starts, runs
the flies, and reports which brain and snapshot it used. Run a world file that predates this feature and confirm it
behaves exactly as before.

**Acceptance Scenarios**:

1. **Given** `flies.brain.version` selects `v2` with a matching 15K snapshot, **When** the world starts, **Then**
   the flies run the new brain and the panel names the snapshot, its release and its format version.
2. **Given** `flies.brain.version` selects `v2` but names a snapshot that is not a v2-compatible container, **When**
   the world starts, **Then** the world refuses to start, naming the mismatch, and no fly starts.
3. **Given** existing `mock`, `v0` and `v1` world configs, **When** they are started unchanged, **Then** they behave
   exactly as they did before this feature existed.

---

### User Story 6 - Extract the 15K Brain in Multiple Formats (Priority: P2)

The user runs the extractor on the MaleCNS dataset with a config file that selects the ADR 006 format. The same
extractor utility still produces the earlier formats (the small brain and the v1 forager brain) from their own
configs, so no format is retired to add the new one. Each run writes its provenance and a report, and the same
config and dataset always give a byte-identical file.

**Why this priority**: The extractor must stay a multi-format tool, because v0 and v1 snapshots must keep shipping
and keep loading while the v2 snapshot is added alongside them.

**Independent Test**: Run the extractor with the v0 config, the v1 config and the new v2 config on the same
dataset. Confirm three files are written, each in its own declared format, each reported with its pool counts, side
balance and per-pair budget fill, and that a second run of each config gives identical bytes apart from the creation
time.

**Acceptance Scenarios**:

1. **Given** the new config, **When** the extractor runs, **Then** it writes a container with 12,000 to 18,000
   neurons, 12 input channels matched to their declared senses, 6 output channels including escape, no pool overlap,
   every output reached, and the report printed.
2. **Given** the existing v0 and v1 configs, **When** the extractor runs them, **Then** it writes their formats
   exactly as it did before this feature.
3. **Given** the same v2 config and the same dataset, **When** the extractor runs twice, **Then** the two files are
   byte-identical except for the creation time.
4. **Given** a dataset missing a required file, column or row count, or a config whose anchor matches no body, or a
   pathway/output pair with no candidate, **When** the extractor runs, **Then** it writes no file and reports the
   named failure.

---

### User Story 7 - Keep Earlier Brains and Worlds Working Unchanged (Priority: P2)

The existing LIF core, brain runners and their tests stay available and unchanged for `mock`, `v0` and `v1`. Adding
the new brain's mechanisms does not change a single spike or output value for the earlier brains.

**Why this priority**: Comparing brain generations is only meaningful if the earlier generations are still exactly
what they were. This is also a standing project rule, not unique to this feature.

**Independent Test**: Run the existing golden LIF test and the existing v0/v1 brain and world tests, and confirm
every one passes with no change to its expected values.

**Acceptance Scenarios**:

1. **Given** the existing golden LIF test, **When** it runs, **Then** it passes with no change to its expected
   values.
2. **Given** the new brain's mechanisms turned off (their documented default), **When** they run against the
   existing core, **Then** results are identical to the current core's.
3. **Given** `mock`, `v0` and `v1` worlds, **When** they run after this feature ships, **Then** their behaviour and
   reported metrics are unchanged.

---

### User Story 8 - See the New Senses and Outputs on the Side Panel (Priority: P2)

A visitor who selects a fly running the v2 brain sees, in the side panel, a row for each of the twelve input senses
(food odour, danger odour, heat, mouth taste, leg taste and touch, each left and right), a row for each of the six
outputs (turn left, turn right, forward, backward, feed, escape), and the brain's internal activity broken out by
the regions the brain spans (the sensory/output pools, the antennal lobe, the ventral nerve cord, the descending
neurons and the rest), updated on every tick.

**Why this priority**: Without a panel that shows the new channels, a visitor cannot see or explain why a v2 fly
behaves the way it does; the earlier panel only knows the four-sense, five-output shape of the v1 brain.

**Independent Test**: Load a v2 world, select a fly, and confirm the panel shows twelve labelled input rows, six
labelled output rows including escape, and a per-region activity readout, all changing as the fly senses change.

**Acceptance Scenarios**:

1. **Given** a selected v2 fly, **When** its senses change, **Then** every one of its twelve input rows updates to
   the new value on the next tick.
2. **Given** a selected v2 fly, **When** its escape output crosses the jump threshold, **Then** the escape row and
   the jump are both visible from the panel at the same tick.
3. **Given** a selected v2 fly, **When** the panel is compared against a v1 fly's, **Then** the v1 fly's panel still
   shows its original four senses and five outputs with no extra rows.
4. **Given** a selected v2 fly, **When** the per-region activity readout is shown, **Then** it names each region and
   its current activity level, matching what the brain actually did that tick.

---

### User Story 9 - Compare Brain Generations and the Null Arms Over Seeds (Priority: P3)

The experiment script runs each arm (mock, v0, v1, v2, the size-matched random graph, and the random walk) over
held-out seeds on the same map and reports the find, brake-and-eat, avoid, touch, escape and rest metrics per arm,
so the new brain's behaviour can be read against both the earlier brains and the two null arms.

**Why this priority**: Turning the feature into a comparison is the stated goal of building a new brain generation,
but it is a reporting capability, not a condition for the brain to ship (ADR 006 Gate C is a measurement, not a
pass/fail gate for every metric).

**Independent Test**: Run the experiment script on the v2 world and confirm a table per arm with all six metrics and
the held-out seed count, including the random-graph and random-walk arms.

**Acceptance Scenarios**:

1. **Given** the v2 world, **When** the experiment runs, **Then** it prints each arm's six metrics over the
   held-out seeds.
2. **Given** the results, **When** a metric fails its stated expectation, **Then** the result is reported as
   measured, with the run that produced it; the brain is not hand-tuned to force a pass.

---

### Edge Cases

- A body in the dataset matches two declared input or output pools: the extractor stops with the pool-overlap
  failure and writes no file.
- An anchor (the antennal-lobe local-neuron class) matches no admitted body: the extractor stops with the
  anchor-empty failure.
- The configured transmitter-source order names a column that is absent or empty: the extractor stops with the
  named failure.
- A pathway-and-output-group pair has no candidate interneuron with a positive score: the extractor stops with the
  pair-empty failure.
- A sense a v2 snapshot declares has no matching stimulus mapping in the world config: the world refuses to start,
  naming the undeclared sense, rather than silently reading zero.
- A flower is eaten to empty while a fly's mouth is on it: mouth taste and odour both read 0, forward braking stops,
  and the fly resumes walking.
- Danger odour and heat sources are both near a fly at once: both channels report their own values; the brain, not
  the world, resolves which dominates the fly's steering.
- A fly's escape output is above threshold while it is already in cooldown: no second jump happens until cooldown
  ends.
- An escape jump would move the fly onto a non-walkable cell: the jump stops at the first non-walkable cell, as a
  normal move does.
- A v2 snapshot is loaded by a browser build that only knows `mock`, `v0` and `v1`: the world refuses to start with
  a version error, and nothing runs.
- A `v0` or `v1` world file is loaded after this feature ships: it behaves exactly as it did before, with no file
  edit required.
- Six v2 flies run at once in the browser: the page stays responsive; a fly that falls behind on a slow frame is
  skipped on that frame, as the existing flies already are.

## Requirements *(mandatory)*

### Functional Requirements

**Brain choice and compatibility**

- **FR-001**: The world config MUST let the user choose the brain with the existing single setting,
  `flies.brain.version`, now also accepting `v2`, alongside the existing `mock`, `v0` and `v1`.
- **FR-002**: Existing world configs that predate this feature MUST keep resolving to the brain they resolved to
  before (no change to the `mock`/`v0` inference rule).
- **FR-003**: The system MUST refuse to start, naming the mismatch, when `flies.brain.version` is `v2` and the named
  snapshot is not a v2-compatible container, and likewise for every other version-and-snapshot mismatch already
  covered for `v0` and `v1`.
- **FR-004**: The panel MUST show which brain is running, including `v2`, and the snapshot's release and creation
  time when one is loaded.
- **FR-005**: Existing `mock`, `v0` and `v1` worlds MUST keep running with no file edit.

**Extraction**

- **FR-006**: The extractor MUST read the MaleCNS dataset through a configuration file selecting the ADR 006 brain
  format, without requiring the dataset to be committed to the repository, alongside its existing ability to
  produce the earlier formats from their own configs.
- **FR-007**: The ADR 006 extraction MUST resolve twelve input channels (food odour, danger odour, heat, mouth
  taste, leg taste and touch, each left and right) and six output channels (turn left, turn right, forward,
  backward, feed, escape), matching sides where the format declares a side match and leaving pools unmatched where
  it does not.
- **FR-008**: The extractor MUST admit neurons using a declared, ordered list of transmitter-source columns, falling
  back to the next column in order when an earlier one names no transmitter, and MUST record which column was used
  for each neuron.
- **FR-009**: The extractor MUST select interneurons by scoring each input-pathway-and-output-group pair's forward
  and backward flow, taking a configured budget of top-scoring candidates per pair, union them, add any declared
  whole-population anchors, and remove any declared whole excluded classes.
- **FR-010**: The extractor MUST compute edge weights from a declared weighting rule (including a synapse-count
  rule), drop edges below a declared minimum synapse count, and write per-neuron region groupings derived from
  declared data rules.
- **FR-011**: The extractor MUST print a report per format: pool counts and side balance, per-pair budget fill,
  admission-source counts, each output's coverage of its real admitted input, and the self-check result.
- **FR-012**: The extractor MUST stop with a named failure code and write no file for: a missing dataset file or row
  count, an empty or overlapping pool, a side imbalance where a side match is declared, an empty anchor, an absent
  or empty transmitter-source column, a pathway/output pair with no candidate, an unreached output, a neuron count
  out of the declared range, and a non-determinism between two runs.
- **FR-013**: Given the same config and dataset, the extractor MUST produce a byte-identical file apart from the
  creation time, for every format it supports.

**Simulator and LIF**

- **FR-014**: The existing LIF cores, brain runners and their tests for `mock`, `v0` and `v1` MUST remain available
  and MUST continue to pass unchanged.
- **FR-015**: The system MUST provide a brain runner for the ADR 006 format (selected by `flies.brain.version: v2`)
  that drives twelve declared input channels and reads six declared output channels, including escape.
- **FR-016**: The LIF core used by the v2 brain MUST gain its new mechanisms as off-by-default, named, documented
  and validated parameters, and MUST reproduce the existing golden spike train when they are off.
- **FR-017**: The v2 runner MUST support input encoding that gives each input neuron its own variable firing
  probability derived from its channel's value, in addition to the existing constant-current encoding, selectable
  by configuration, using one reproducible random stream per fly, independent of the existing jitter and noise
  streams.
- **FR-018**: The LIF core MUST support an optional per-region gain so that edges into a declared region can be
  scaled independently, defaulting to no scaling for every region.
- **FR-019**: The browser MUST reject a snapshot whose container version the selected brain does not support, with
  a message naming the version, exactly as it does today for `v0` and `v1`.
- **FR-020**: The worker message protocol MUST keep carrying one input value per declared input channel in
  declaration order and MUST gain the ability to carry the new `escape` output, without breaking `mock`, `v0` or
  `v1` flies using the same protocol version.

**Body, world and senses**

- **FR-021**: Each input channel in a v2 snapshot MUST declare which sense it reads and where on the fly's body it
  is sensed, and the world config MUST declare, per sense, which world objects produce it and how it falls off with
  distance; a sense a snapshot declares with no matching world declaration MUST fail world start-up with a named
  error, not read as zero.
- **FR-022**: Front-leg sense sites MUST be positioned ahead of and to the side of the fly's body, so that leg taste
  and touch are read before mouth taste is, for a fly approaching a flower.
- **FR-023**: Touch MUST report whether the sensed leg's cell is walkable, and MUST change the fly's turning output
  through the brain's own wiring, not through a world rule that turns the fly directly.
- **FR-024**: The escape output MUST trigger a one-tick jump along the fly's heading of a configured distance when
  it is above a configured threshold and the fly is not already in a configured cooldown period; the jump MUST stop
  at the first non-walkable cell and MUST start the cooldown.
- **FR-025**: The world MUST NOT steer, stop, or otherwise directly command a fly in response to any sense; every
  behaviour (braking, avoiding, touch response, escaping) MUST arise from the brain's outputs.

**Measurement and experiment**

- **FR-026**: The experiment script MUST report, per arm (`mock`, `v0`, `v1`, `v2`, size-matched random graph,
  random walk) and over held-out seeds: the find/approach/eat/leave/hunger-dependence metrics already reported for
  `v1`, plus a brake metric (forward drive on food versus off), an avoid metric (time near each danger source,
  signed), a touch metric (blocked-move fraction), an escape metric (escape events per minute near danger versus
  away from it), and a rest metric (activity with no stimulus, reported per region).
- **FR-027**: LIF parameters, input-encoding settings, per-region gains and world sense/threshold values for the v2
  brain MUST be set by calibration on seeds kept separate from the held-out seeds, and the calibration seeds and
  chosen values MUST be recorded with the run.
- **FR-028**: A metric that fails its stated expectation for the v2 brain MUST be reported as measured, with the run
  that produced it; the brain's data-derived selection MUST NOT be hand-adjusted to force a pass.

**Side panel**

- **FR-029**: For a fly running the v2 brain, the side panel MUST show one labelled row per declared input channel
  (twelve rows) and one labelled row per declared output channel (six rows, including escape), updated on every
  tick, using the existing generic per-declaration row rendering so no channel is hard-coded by name.
- **FR-030**: For a fly running the v2 brain, the side panel MUST show the brain's activity broken out by its
  declared regions (sensory/output pools, antennal lobe, ventral nerve cord, descending neurons, the rest),
  updated on every tick.
- **FR-031**: The panel for `mock`, `v0` and `v1` flies MUST show exactly the rows and state those brains showed
  before this feature, with no v2-only row appearing for them.

**Extraction (added by [BUG-001](bugs/BUG-001.md), 2026-10-10)**

- **FR-032**: For every declared output pool, the extractor MUST compute the pool's total admitted net synaptic
  weight per neuron (the signed sum D13 already computes, aggregated per pool) and MUST stop with a named failure
  and write no file when any pool's net sum is not positive (net inhibitory or exactly zero); the extractor's
  report (FR-011) MUST print this signed total per pool regardless of outcome. "Every output reached" (FR-007,
  SC-001) is a coverage check, not a sign check, and BUG-001 found a brain that satisfied the former while being
  behaviourally inert on one output — this requirement closes that gap.

### Key Entities *(include if feature involves data)*

- **Brain choice**: one of `mock`, `v0`, `v1`, `v2`; set in the world config; decides the brain, the LIF core and
  runner, and the worker protocol used.
- **Extraction config (ADR 006 format)**: declares the twelve input pools and their side-match rule, the six output
  pools, the pathway and output-group groupings, the flow steps, the per-pair budget, the anchors and exclusions,
  the transmitter-source order, the weighting rule and minimum synapse count, and the admitted neuron-count range.
- **Brain container (ADR 006 version)**: neurons with roles, channels, and a declared region per neuron; the
  induced graph; per-edge weights and raw synapse counts; and the declarations of inputs (each with a sense and a
  body site), outputs (including escape) and modulators.
- **Sense declaration**: a named sense (food odour, danger odour, heat, mouth taste, leg taste, touch) with a body
  site, read by one or more input channels and mapped, in the world config, to the world objects and falloff that
  produce it.
- **Region**: a named grouping of neurons (input, output, antennal lobe, ventral nerve cord, descending neurons,
  the rest) used for per-region gain and for the panel's activity readout.
- **Escape event**: a one-tick jump triggered when the escape output crosses its threshold outside cooldown; has a
  distance, a cooldown period, and a stop condition at the first non-walkable cell.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extractor writes an ADR 006 container with 12,000 to 18,000 neurons, twelve input channels and six
  output channels (including escape), no pool overlap, every output reached, declared side-matched pools matched,
  and a second run gives an identical file apart from the creation time.
- **SC-002**: The extractor still writes the existing small-brain and v1 forager-brain formats from their existing
  configs with identical output to before this feature.
- **SC-003**: The world runs with `mock`, `v0`, `v1` and `v2` by changing one config value, with no code edit, and
  every existing world file runs unchanged.
- **SC-004**: The existing golden LIF test and every existing `mock`/`v0`/`v1` brain and world test pass with no
  change to expected values.
- **SC-005**: With the new LIF mechanisms off, the v2 brain's core gives the same spike trains as the unmodified
  core on the same graph, parameters and drive.
- **SC-006**: Six v2 flies running at the configured tick rate keep the page responsive; the time each tick takes
  is measured and recorded with the run.
- **SC-007**: On held-out seeds, the v2 brain's median forward drive with mouth taste present, divided by its
  forward drive off a flower, is below 1 and lower than the size-matched random-graph arm's, and flies that reach a
  flower eat.
- **SC-008**: The experiment script prints all six metrics (find, brake, avoid, touch, escape, rest) for every arm
  over the held-out seeds, with the held-out seed count, for the v2 world.
- **SC-009**: A selected v2 fly's side panel shows twelve input rows and six output rows (including escape), all
  changing with the fly's senses and outputs, and a per-region activity readout, in a real browser session with no
  console errors.
- **SC-010**: A selected `v0` or `v1` fly's side panel is pixel-for-pixel the same set of rows it showed before this
  feature shipped.
- **SC-011**: No escape jump occurs during an active cooldown, and every jump stops at the first non-walkable cell,
  in any run.
- **SC-012** (added by [BUG-001](bugs/BUG-001.md), 2026-10-10): the extractor's report states each output pool's
  net admitted synaptic weight per neuron, signed, for every format it supports; no shipped `.brain` file has a
  net-inhibitory output pool.

## Assumptions

- **Dataset**: MaleCNS v1.0 as used by the existing extractor (`data/malecns`, not committed); the traced-only edge
  variant.
- **Food glomeruli, taste pools, and the sign of glutamate** carry over unchanged from ADR 003/002 (ADR 003 Q1–Q3),
  except that the mouth-taste pool drops the leg-taste bodies ADR 006 found mislabelled as mouth taste.
- **Open questions left to calibration, not to this spec** (ADR 006 Q1–Q6): the exact published LIF parameter
  values to start from, ~~whether DNg100 stays in the `forward` output pool~~, whether additional steering
  descending neurons are added later, whether the measured touch-turn direction is wall-following or an artefact,
  whether mid/hind-leg taste is added later, and whether the antennal-lobe anchor is needed for a quiet rest
  state. ~~Each is a config change the calibration record states, not a blocker for this feature.~~
  **Superseded in part by [BUG-001](bugs/BUG-001.md), 2026-10-10**: Q2 (`forward`'s pool composition) is no
  longer a calibration-time config choice — the shipped brain's `forward` pool is structurally net-inhibitory
  (−867 signed weight/neuron), so no LIF setting can produce forward locomotion, and this blocks US1/US2/US9
  until ADR 006's D11 selection rule (or D9's pool) is fixed and the brain re-extracted. The other five open
  questions (Q1, Q3–Q6) are unaffected and remain config changes left to calibration, not blockers.
- **Avoidance is reported, not required to pass**: the avoid metric (danger odour, heat) is measured and reported
  with its sign; this feature does not require the brain to avoid danger more than the random walk does, only that
  the behaviour is measured (ADR 006 Gate C).
- **Vision is out of scope**: the escape output's visual input, and any optic-lobe sensing, are left to a later
  brain generation (ADR 007); this brain's escape input comes from touch and taste paths only.
- **Learning and memory stay out of scope**: no mushroom-body plasticity and no memory of food locations, consistent
  with the earlier forager brain.
- **Browser support**: the same environment as the existing app (modern browsers with module workers, typed arrays
  and no build step).
- **Snapshot size**: roughly 25 MB per v2 snapshot at the default edge threshold; this is an accepted cost of the
  larger brain, not a target to shrink in this feature.
- **Calibration and held-out seeds stay separate**, as the project's standing rule requires; the calibration record
  for this brain is produced alongside the implementation, not assumed in advance.
