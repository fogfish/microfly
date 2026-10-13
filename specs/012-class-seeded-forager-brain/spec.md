# Feature Specification: Class-Seeded Forager Brain

**Feature Branch**: `014-class-seeded-forager-brain`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Extract the brain as defined by ADR 006-class-seeded-forager-brain.md This ADR defines
a brain made of whole functional classes (all ORN, PN, LN, LHN, all KC, MBON, DAN, all DNs, motor neurons, GRN, JO).
It is compatible with LIF v1 protocol and does not increase input / output sensorts. Keep existing LIF, brains
available under the versions mock, v0 and v1, keep same mechanism to choose the configuration. Make sure the
extractor is able to produce multiple brain formats and application is able to operate them. Integrate the
visualization of new input / output and state channels into the side panel on UI."

**Governing decisions**: [ADR 006 (class-seeded forager brain)](../../adrs/006-class-seeded-forager-brain.md)
defines the new brain's seed classes, fill rule, admission, edge threshold and extraction-fidelity probe (D8–D14),
and the one new world file and snapshot additions that carry it (W6–W7). [ADR 003](../../adrs/003-hungry-forager-brain.md)
defines the forager's input and output pools, modulators and world loop, which this brain keeps unchanged.
[ADR 005](../../adrs/005-dynamical-regime.md) defines the weight rule and the staged calibration protocol this
brain reuses. This spec states what the user gets and how it is checked; the ADRs state how.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the Class-Seeded Brain in the World (Priority: P1)

A visitor opens a world that names the new, larger brain. Flies smell food, taste it, steer, walk and feed exactly
as they do with the shipped forager brain — same six channels, same world loop, same LIF engine — only the
network between the senses and the motors is bigger and built from whole connectome classes instead of a
flow-ranked selection.

**Why this priority**: Without a working world run, the new brain is only a file on disk. The point of this feature
is a brain the visitor can watch behave.

**Independent Test**: Open the new world file with the class-seeded snapshot, confirm the app starts with no
console error, and confirm the panel names the running brain and its snapshot.

**Acceptance Scenarios**:

1. **Given** a world file that names the class-seeded snapshot under `flies.brain.version: v1`, **When** the world
   starts, **Then** flies run on `lif-v1.js` and worker protocol v3, exactly as the shipped forager brain does.
2. **Given** the class-seeded brain running, **When** a fly senses odour or taste, **Then** its sensory and motor
   channels are the same six pools as the shipped forager brain (odour-left, odour-right, taste-left, taste-right,
   turnLeft/turnRight, forward, backward, feed) — none added, removed or resized.
3. **Given** the class-seeded brain running, **When** the visitor selects a fly in the panel, **Then** the panel
   names the brain's snapshot and its release, the same way it does for the shipped forager brain.

---

### User Story 2 - Extract the Brain from Whole Functional Classes (Priority: P1)

A maintainer runs the extractor against the MaleCNS dataset with a configuration that seeds whole functional
classes (all antennal-lobe projection and local neurons, all Kenyon cells, MBONs, DANs, every descending neuron,
plus the existing forager's input and output pools) with no sampling or budget, fills the remaining neurons by
plain connectivity to that seed set, and reports whether the result still carries the connectome's real routes
from each sense to each output.

**Why this priority**: The brain only has a claim to the dataset if every seed class is admitted whole and the
fill rule is connectivity, not an objective tuned to pass a metric (ADR 006 lesson 2).

**Independent Test**: Run the extractor with the class-seeded config against the dataset and confirm every
declared seed class is present in full, the fill size matches the configured neuron count, and the fidelity
report is printed and stored with the snapshot.

**Acceptance Scenarios**:

1. **Given** the class-seeded config, **When** the extractor runs, **Then** every body matching a declared seed
   filter is present in the brain, with none sampled or dropped for budget.
2. **Given** the same config, **When** the extractor runs, **Then** the non-seed neurons are chosen only by total
   shared synapse weight with the seed set, up to the configured neuron count, with ties broken on ascending
   `bodyId`.
3. **Given** the same config, **When** the extractor runs, **Then** it computes and prints a fidelity report
   comparing the selected brain's signed routes with the whole thresholded connectome's, for every sense-to-output
   pair, before any behaviour run.
4. **Given** the config sets the fidelity check as required, **When** the probe's steering or feeding check fails,
   **Then** the extractor writes no file and reports which check failed and both compared values.
5. **Given** the same config and dataset run twice, **When** the two files are compared, **Then** they are
   byte-identical apart from the creation time.

---

### User Story 3 - Keep the Brain Choice Mechanism Unchanged (Priority: P1)

The world still picks its brain stack with the one existing setting, `flies.brain.version`, whose only values are
`mock`, `v0` and `v1`. The class-seeded brain is a new snapshot and a new world file under the existing `v1` value,
not a new version to learn. Every world file that worked before this feature keeps working with no edit.

**Why this priority**: Comparing brains only works if choosing one is still one setting, and nothing already
shipped regresses when the catalogue grows.

**Independent Test**: Run the mock world, the small-brain (v0) world, the shipped forager (v1) world and the new
class-seeded world in turn, each by its own file, with no code change and no new config key.

**Acceptance Scenarios**:

1. **Given** the existing mock, v0 and shipped v1 worlds, **When** each is opened after this feature ships,
   **Then** each behaves exactly as before.
2. **Given** a new world file naming the class-seeded snapshot, **When** it is opened, **Then** `flies.brain.version`
   is `v1`, with no new value introduced to select it.
3. **Given** a world names the class-seeded snapshot under the wrong version, **When** it starts, **Then** the app
   refuses to start and names the mismatch, exactly as it already does for any v0/v1 snapshot mismatch.

---

### User Story 4 - Extract Multiple Brain Formats Side by Side (Priority: P2)

A maintainer keeps extracting the existing small brain and the existing flow-ranked forager brain exactly as
before, while the extractor also accepts the new class-seeded configuration. The three configurations live beside
each other; choosing one is a config file, not a code change, and producing one format never disturbs the others.

**Why this priority**: The brains must stay comparable, which only works if every format the project has shipped
keeps extracting unchanged while the new one is added.

**Independent Test**: Run the extractor three times, once per existing config and once with the new class-seeded
config, and confirm each produces its own correct, unchanged-where-expected result.

**Acceptance Scenarios**:

1. **Given** the existing small-brain config, **When** the extractor runs, **Then** it writes the same version 3
   container as before.
2. **Given** the existing flow-ranked forager config, **When** the extractor runs, **Then** it writes the same
   version 4 container as before, with no change to its counts or weights.
3. **Given** the new class-seeded config, **When** the extractor runs, **Then** it writes a version 4 container in
   the declared neuron range, loadable by the same browser code that loads the other two.
4. **Given** a config that matches neither known extraction strategy, **When** the extractor runs, **Then** it
   writes no file and reports a configuration error naming the key.

---

### User Story 5 - See the New Brain's Provenance and Neuron Origin in the Panel (Priority: P2)

A visitor inspecting a fly that runs the class-seeded brain can see, in the side panel, how that brain was built:
its selection strategy, its admission rule, the synapse threshold applied, and whether the extraction-fidelity
check passed. In the brain activity view, the visitor can tell a neuron that was seeded as a whole functional
class apart from one that was added by fill, and see each neuron's transmitter. Brains that do not carry this
information (mock, v0, the shipped v1 forager) show no new, empty section — the panel looks exactly as it does
today for them.

**Why this priority**: The new brain's distinguishing feature — whole classes plus a plain connectivity fill — is
invisible unless the panel surfaces it. Without this, comparing it with the shipped forager brain by eye is not
possible.

**Independent Test**: Select a fly running the class-seeded brain and confirm the provenance fields and the
seed/fill distinction are visible; select a fly running the shipped forager brain or a toy brain and confirm the
panel is unchanged.

**Acceptance Scenarios**:

1. **Given** a fly running a brain whose snapshot declares its selection strategy, admission rule and synapse
   threshold, **When** the visitor opens the panel, **Then** these are shown.
2. **Given** a brain whose snapshot carries a fidelity report, **When** the visitor opens the panel, **Then** the
   report's pass/fail state is visible, and the full table is reachable from the same section.
3. **Given** a brain whose snapshot records each neuron's origin (seed class or fill) and transmitter, **When** the
   visitor looks at the brain activity view, **Then** seed and fill neurons are visually distinguishable, and a
   neuron's transmitter is shown without renaming or hiding its existing role.
4. **Given** a fly running mock, v0, or the shipped v1 forager brain, **When** the visitor opens the panel,
   **Then** no new section appears and the existing sections are unchanged.

---

### User Story 6 - Compare the New Brain Against the Established Arms (Priority: P3)

A maintainer runs the existing behaviour-comparison experiment with the class-seeded brain added as an arm,
alongside the shipped v1 forager, a version of the shipped forager's own selection rule run under the new
admission and threshold rules, a size-matched random graph, and the random walk. Every arm is measured on the
same held-out seeds and reported with the same metrics used for the shipped forager brain.

**Why this priority**: The brain's purpose is to be compared, not shipped blind. This is a measurement, not a
release gate (ADR 006, Gate C).

**Independent Test**: Run the comparison script with the class-seeded world and confirm it reports the existing
five forager metrics for every arm, with the held-out seed count.

**Acceptance Scenarios**:

1. **Given** the class-seeded world, **When** the comparison script runs, **Then** it reports the find rate, time
   to food, eating-bout length, early-leave fraction and hungry-versus-sated contrast for every arm.
2. **Given** a metric where the class-seeded brain does not beat the random walk or the size-matched random graph,
   **When** the result is reported, **Then** it is recorded as measured, with the run that produced it, and is not
   hidden or hand-wired to pass.

---

### Edge Cases

- A declared seed filter matches no traced body: the extractor stops with a named code and writes no file.
- The seed classes plus the existing input and output pools already exceed the configured total neuron count: the
  extractor stops with a named code before any fill step.
- The fidelity check is required and either the steering or the feeding check fails: the extractor stops, writes
  no file, and names which check failed with both compared values.
- The fidelity check is not required and a check fails anyway: the extractor still writes the file, and the
  mismatch is recorded in the report as a finding, not hidden.
- A world names the class-seeded snapshot under a version its container does not support: the app refuses to
  start and names both versions, exactly as for any other version mismatch.
- An older snapshot (mock, v0, the shipped v1 forager) has none of the new optional provenance or per-neuron
  fields: the reader loads it exactly as before, and the panel shows no new section for it.
- A neuron has no admitted, confident transmitter prediction: it is still admitted and signed by the default rule,
  recorded as such, and participates in the network like any other neuron.
- Two extraction strategies target the same neuron count but choose different neurons: the comparison experiment
  reports them as separate, explicitly named arms, never merged into one result.

## Requirements *(mandatory)*

### Functional Requirements

**Brain choice and compatibility**

- **FR-001**: The world config MUST continue to select the brain stack with the single existing setting,
  `flies.brain.version`, whose only values remain `mock`, `v0` and `v1`. This feature MUST NOT add a new value.
- **FR-002**: The class-seeded brain MUST run under `v1`: the existing `lif-v1.js` LIF core, the existing
  `fly-brain-v1.js` runner and the existing worker protocol version, with no code change to any of them.
- **FR-003**: The class-seeded brain MUST declare the same input and output channels as the shipped v1 forager
  brain (odour-left, odour-right, taste-left, taste-right, turnLeft, turnRight, forward, backward, feed) and MUST
  NOT add, remove or resize any sensory or motor pool.
- **FR-004**: Every world file that works before this feature MUST keep working unchanged; the class-seeded brain
  is reached only through a new world file, never by editing an existing one.
- **FR-005**: The app MUST refuse to start, naming the mismatch, when a world's declared brain version does not
  match its snapshot's container version — unchanged from existing behaviour, and verified for the new snapshot
  too.

**Extraction**

- **FR-006**: The extractor MUST support a whole-class seeding and connectivity-fill selection strategy, chosen by
  configuration, alongside its existing flow-ranked selection strategy. Choosing between them MUST be a config
  file, never a code edit.
- **FR-007**: Under the new strategy, every traced body matching a declared seed class or superclass filter MUST
  be included with no sampling and no per-class budget.
- **FR-008**: Under the new strategy, every neuron not in a seed class or an existing input/output pool MUST be
  chosen only by its total shared synapse weight with the seed set, up to one configured total neuron count, with
  ties broken on ascending `bodyId`. No pathway, flow or per-output scoring MUST be used for this choice.
- **FR-009**: Under the new strategy, every traced body MUST be admissible regardless of transmitter-prediction
  confidence; its sign MUST come from the dataset's consensus transmitter, with GABA and glutamate inhibitory and
  every other value excitatory by a configurable default, and the sign rule MUST be recorded per neuron.
- **FR-010**: Edges below one configured synapse-count threshold MUST be dropped before scoring, selection and
  weight computation, and MUST stay absent through every later step.
- **FR-011**: Connection weights MUST keep the existing normalised-input-fraction rule, computed over the
  thresholded, admitted edges.
- **FR-012**: Before any behaviour run, the extractor MUST compute and print a fidelity report comparing the
  selected brain's signed propagation with the whole thresholded connectome's, for every declared sense pool
  against every declared output, and MUST store this report with the snapshot.
- **FR-013**: When configured to require it, the extractor MUST fail with a named error and write no file if the
  fidelity report's steering or feeding check does not pass; the error MUST name which check failed and both
  compared values.
- **FR-014**: The extractor MUST stop with a named failure code and write no file for: an empty seed filter, seeds
  exceeding the configured total neuron count, an unrecognised transmitter column, and the existing forager
  failure conditions (empty pool, side imbalance, unreached output, neuron count out of range, a modulator naming
  an undeclared input, non-determinism between two runs).
- **FR-015**: Given the same configuration and dataset, the extractor MUST produce a byte-identical snapshot,
  apart from the recorded creation time.
- **FR-016**: The extractor MUST keep producing the existing small brain and the existing flow-ranked forager
  brain exactly as before; adding the new strategy MUST NOT change either one's output.

**Simulator and application**

- **FR-017**: The snapshot reader MUST accept new, optional provenance fields (synapse threshold, selection
  strategy, admission rule) and new, optional per-neuron fields (transmitter, origin) and an optional fidelity
  report, and MUST continue to load snapshots that omit all of them with no change in behaviour.
- **FR-018**: The brain inspector and the app's brain activity view MUST list and draw the class-seeded brain's
  snapshot the same way they already do for every other listed snapshot.
- **FR-019**: A dedicated world file MUST select the class-seeded brain, carrying the existing forager pools,
  hunger gain and eating rule unchanged, with its own calibrated LIF settings.

**Side panel visualization**

- **FR-020**: For a brain whose snapshot declares the new provenance fields, the side panel MUST show its
  selection strategy, admission rule and synapse threshold.
- **FR-021**: For a brain whose snapshot carries a fidelity report, the panel MUST show the report's pass/fail
  state, with the full per-pair table reachable from the same place.
- **FR-022**: For a brain whose snapshot records per-neuron origin and transmitter, the brain activity view MUST
  let the visitor distinguish a seed-class neuron from a fill neuron, and MUST show each neuron's transmitter,
  without hiding or renaming any existing neuron role or channel.
- **FR-023**: For a brain whose snapshot declares none of the new fields, the panel MUST render exactly as it did
  before this feature: no empty or placeholder section for missing data.

**Measurement**

- **FR-024**: The existing behaviour-comparison experiment MUST be able to run the class-seeded brain as an arm
  alongside the shipped v1 forager brain, the shipped forager's own selection rule run under the new admission and
  threshold rules, a size-matched random graph, and the random walk, reporting the existing forager metrics for
  each.
- **FR-025**: A metric that the class-seeded brain does not pass MUST be reported as measured, with the run that
  produced it; it MUST NOT be hidden, and MUST NOT be made to pass by hand-wiring a connection or changing the
  dataset-derived weights.

### Key Entities *(include if feature involves data)*

- **Brain choice**: unchanged — one of `mock`, `v0`, `v1`, set in the world config; the class-seeded brain is
  reached under `v1` by naming its own snapshot.
- **Seed class**: a functional class or superclass (for example all Kenyon cells, or all descending neurons) whose
  every traced, matching body is admitted with no sampling and no budget.
- **Fill neuron**: a non-seed body added to the brain, chosen only by its total shared synapse weight with the
  seed set, up to the configured total neuron count.
- **Extraction configuration (whole-class strategy)**: declares the seed class list, the total neuron count, the
  synapse threshold, the admission and transmitter-sign rule, and whether the fidelity check is required —
  alongside the existing pools, modulators and outputs it reuses verbatim.
- **Fidelity report**: a per sense-pool, per-output table comparing the selected brain's signed propagation with
  the whole thresholded connectome's; its steering and feeding checks may gate extraction, and its full table is
  stored with the snapshot for inspection.
- **Snapshot provenance additions**: the synapse threshold, selection strategy and admission rule recorded once
  per brain, and the transmitter and origin recorded once per neuron — all optional, so older snapshots keep
  loading unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extractor writes the class-seeded brain from the MaleCNS dataset with every declared seed class
  complete, the configured total neuron count reached by connectivity fill alone, every declared output reached,
  and the fidelity report passing its steering and feeding checks; a second run gives an identical file apart from
  the creation time.
- **SC-002**: The existing small brain and the existing flow-ranked forager brain still extract to the same output
  as before this feature.
- **SC-003**: A visitor runs the mock, v0, shipped v1 forager and class-seeded worlds in turn, each by opening its
  own file, with `flies.brain.version` never taking a value other than `mock`, `v0` or `v1`, and no existing world
  file needing an edit.
- **SC-004**: Six flies running the class-seeded brain at the configured tick rate keep the page responsive, with
  the per-step cost measured and recorded.
- **SC-005**: On held-out seeds, the existing forager metrics are reported for every comparison arm (the
  class-seeded brain, the shipped v1 forager, the shipped forager's selection rule under the new admission and
  threshold rules, the size-matched random graph, and the random walk); any arm that does not beat the random walk
  is recorded as measured, not hidden.
- **SC-006**: A visitor selecting a fly on the class-seeded brain can read its selection strategy, admission rule,
  synapse threshold and fidelity pass/fail state in the panel, and can visually distinguish seed neurons from fill
  neurons in the brain activity view.
- **SC-007**: A visitor on the mock, v0 or shipped v1 forager brain sees no change anywhere in the panel: no new
  section appears for a brain whose snapshot does not declare the new fields.

## Assumptions

- **Dataset**: MaleCNS v1.0, traced-only edge variant, the same dataset location convention as the existing
  extractor (`data/malecns`, not committed).
- **Seed class list is fixed by ADR 006 D8**: antennal-lobe projection and local neurons (and the small remaining
  antennal-lobe classes), Kenyon cells, MBONs, DANs, every descending neuron, plus the existing forager input and
  output pools. This feature does not add, drop or sample a central seed class.
- **Total neuron count is one configured number (ADR 006 D9)**, chosen so the fidelity probe passes; its exact
  value is a config value, not a code constant, and may be revisited by a later ADR without touching this spec.
- **Synapse threshold default is 5 (ADR 006 D11)** for this brain; the existing default of 1 is unchanged for
  configs that do not set it, so the shipped small and forager brains are unaffected.
- **Modulatory transmitters (dopamine, octopamine, serotonin) excite by default (ADR 006 D10)**. Whether this
  should instead be a zero or modulatory sign is an open question in the ADR (Q2), tracked there, not resolved by
  this feature.
- **Lateral-horn neurons are not a seed class at this brain's size (ADR 006 D8)**; they may still appear as fill.
  Seeding them is a later ADR's open question (Q3).
- **The fidelity probe is linear and necessary but not sufficient (ADR 006 Q7)**: it shows which signed routes
  exist, not what the LIF network will do. Calibration and the held-out behaviour comparison are separate steps,
  run after extraction passes this probe.
- **Calibration values (LIF scale, gains, output scaling) are set on calibration seeds kept separate from
  held-out seeds**, following the existing staged protocol; the chosen values and the run that motivated them are
  recorded outside this spec, as the shipped forager brain's are.
- **Tonic baseline current with noise, and output pools chosen from data, are out of scope (ADR 006 Q5, Q6)**:
  this feature changes only the network topology between the existing senses and motors.
- **The mushroom body carries no plasticity here**: Kenyon cells, MBONs and DANs enter whole as connectome
  neurons, but the brain does not learn; the LIF core gains no new mechanism from this feature.
- **Browser support**: unchanged — the same environment as the existing app (evergreen browsers with module
  workers, typed arrays, no build step).
- **Versions**: no new container format version or worker protocol version is introduced; the new snapshot and
  world additions are optional fields on the existing version 4 container and the existing `v1` world contract.
