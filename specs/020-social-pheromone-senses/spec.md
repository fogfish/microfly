# Feature Specification: Social and Pheromone Senses

**Feature Branch**: `020-social-pheromone-senses`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Social and pheromone senses. The current version on the brain deliberately excluded
`putative_ppk23` / `putative_ppk25` (136 of 300 front-leg GRNs) from leg taste (ADR 007, D16). In a male CNS they are
pheromone receptors that drive courtship, and feeding them flower stimulus put food taste through the courtship
circuit. Only male connectome exists so that females are built on males brain wearing a name tag, defined per fly.
Use `odour-conspecific` (antennae) to detect other flies, as a moving odour source. Use `contact-pheromone` (front
legs) leg contact with another fly. Fly–fly contact is a front-leg site overlapping another fly's body radius. Adjust
extraction with required neurons. Adjust the world and calibration to support the feature."

**Governing decisions**: [ADR 007](../../adrs/007-wide-io-forager-brain.md) D16 excluded the front-leg ppk23/ppk25
neurons from leg taste and measured them as the whole "toward" turn of leg taste (+5.5e-5). This feature gives those
neurons their own sense instead of putting them back into taste. Constitution Principle VI ("every new sense MUST be
declared in data and read from simulated neurons") governs both new senses. The feature needs a new decision record
(ADR 012) for the pheromone neuron selection, the sex tag, the emission model and the probe results. It builds on the
14.5K mushroom-body brain and its worlds (spec 019, ADR 011), which must keep working unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Brain Gets Two Social Senses From Its Own Pheromone Neurons (Priority: P1)

A researcher extracts a brain that has two new bilateral senses: `odour-conspecific` on the antennae, made of the
olfactory receptor neurons of the fly-odour glomeruli, and `contact-pheromone` on the front legs, made of the
front-leg ppk23/ppk25 gustatory neurons that leg taste excludes. Leg taste keeps exactly the neurons it has today.
The researcher can see in the snapshot which dataset neurons each new sense uses, and the extraction is repeatable.

**Why this priority**: Nothing else in the feature can happen without the neurons in the brain and declared as
senses. It also settles the D16 question the right way: the pheromone neurons get a pheromone stimulus, never a
food stimulus.

**Independent Test**: Run the extractor twice on the new config and compare the two snapshots; inspect the declared
channels and their neuron counts; confirm that the leg-taste pool is identical to today's brain.

**Acceptance Scenarios**:

1. **Given** the social brain config, **When** it is extracted twice from the same dataset, **Then** the two
   snapshots are byte-identical apart from creation time.
2. **Given** the snapshot, **When** its channels are listed, **Then** `odour-conspecific-left/right` (site antenna)
   and `contact-pheromone-left/right` (site front leg) are declared with their neuron counts and dataset selection
   rules.
3. **Given** the snapshot, **When** the leg-taste pool is compared with the current 14.5K brain's, **Then** it holds
   the same neurons; no ppk23/ppk25 neuron is in leg taste and no non-ppk neuron is in contact pheromone.
4. **Given** a selection rule that would put one neuron into two senses, **When** extraction runs, **Then** it fails
   with a named error.

---

### User Story 2 - A Probe Shows What the Social Senses Do in the Brain (Priority: P1)

Before any world or decoder work, a researcher runs a brain-only probe that drives each new sense, left and right,
and reports how the decoded motor pools respond (turn left/right, forward, backward, feed, escape), next to the same
probe on the size-matched random graph. The result is recorded in ADR 012, including any sense that does not reach
the motor pools.

**Why this priority**: The project's rule is network first: a sense only means something in behaviour if the
connectome carries it to the outputs. ADR 007 already measured the ppk23/ppk25 neurons turning toward their side;
this probe confirms that with a pheromone stimulus and measures the antennal sense the same way.

**Independent Test**: Run the probe on calibration seeds with no stimulus, each sense alone on each side, and both
sides together; read the contrast per output pool for the brain and the random graph.

**Acceptance Scenarios**:

1. **Given** the social brain at its shipped LIF settings, **When** `contact-pheromone` is driven on one side,
   **Then** the probe reports the turn contrast (toward or away), and the forward, backward and feed responses.
2. **Given** the same brain, **When** `odour-conspecific` is driven on one side, **Then** the probe reports the same
   measures.
3. **Given** the random graph of the same size, **When** the same probe runs, **Then** its results are reported
   next to the brain's.
4. **Given** a sense whose drive does not change any output pool beyond the no-stimulus noise, **When** the result
   is reviewed, **Then** it is recorded as a finding and no connection or decoder shortcut is added to make it act.

---

### User Story 3 - Flies Smell and Touch Each Other in the World (Priority: P1)

In a world with several flies, each fly is a moving odour source: every other fly's antennae sense it, stronger when
closer and on the side it is on. When a fly's front-leg site lies inside another fly's body radius, that fly's
contact-pheromone sense on that side fires. Each fly carries a sex tag (female or male) set per fly in the world
config. Every fly runs the same male brain; the tag only changes what the fly gives off, as declared in the world
config. The panel shows each fly's tag and the two social senses' inputs.

**Why this priority**: This is the feature the user sees. It turns the world's "other flies" from obstacles that are
ignored into stimuli the brain can perceive.

**Independent Test**: Load the social world, place two flies close together, and check in the panel that each fly's
conspecific-odour input rises on the side of the other fly and that leg contact fires the contact sense on the
touching side only.

**Acceptance Scenarios**:

1. **Given** two flies, **When** fly B is to the left of fly A, **Then** A's left conspecific-odour input is higher
   than its right, and the inputs grow as the flies get closer.
2. **Given** a lone fly, **When** no other fly is in range, **Then** its social inputs are zero; a fly never senses
   its own odour.
3. **Given** A's left front-leg site inside B's body radius, **When** the tick is evaluated, **Then** A's left
   contact-pheromone input fires and the right does not; B's contact input fires only if B's own front-leg site is
   inside A's radius.
4. **Given** flies tagged female and male, **When** they emit, **Then** each one's odour and contact strength follows
   the per-sex values declared in the world config, and the receiving brain is the same for both sexes.
5. **Given** the panel, **When** a fly is selected, **Then** its sex tag is shown with the note that its brain is the
   male connectome.

---

### User Story 4 - Social Behaviour Is Measured Against Null Arms (Priority: P2)

A researcher runs a behaviour experiment with several flies on held-out seeds, in four arms: social brain, pheromone-
ablated brain (the same brain with the social input pools disconnected), size-matched random graph, and random walk. They report
how often and how long flies are near and in contact with each other, how flies orient toward a nearby fly, and how
this differs when the other fly is tagged female versus male. Whatever the result, it is written up next to the
spec.

**Why this priority**: The senses can be correct and still change behaviour little; this story measures that
honestly. It ranks below the senses themselves because a weak effect is a finding, not a failure of the feature.

**Independent Test**: Run the experiment from the command line on held-out seeds and read the per-arm table.

**Acceptance Scenarios**:

1. **Given** all four arms (social brain, pheromone-ablated brain, random graph, random walk), **When** the
   experiment runs, **Then** it reports per arm: nearest-neighbour distance, time within 2 tiles of another fly,
   contact events per fly per minute, mean contact duration, a following index, and song bouts per contact versus
   per tick alone.
2. **Given** pairs that mix sexes, **When** the experiment reports, **Then** the same measures are split by the
   other fly's sex tag.
3. **Given** a social effect that also appears in a null arm, **When** the results are reported, **Then** it is
   stated, not hidden.
4. **Given** the behaviour target (social approach, FR-023), **When** it is evaluated on held-out seeds, **Then**
   the social brain's time within the social distance and its contact rate are compared with the random-graph and
   random-walk arms; the sex split is reported but is not part of the verdict.

---

### User Story 5 - Foraging and Learning Still Work With Flies Around (Priority: P1)

Adding social senses does not break food finding, feeding, escape or learning. Existing brains (mock, v0, v1, v2,
v3) and their worlds load and behave as before, and on the social brain with social senses silenced, foraging
measures match the 14.5K brain's.

**Why this priority**: The AGENTS rules require old brains to keep working, and D16 exists to keep food taste clean.
A regression here blocks the feature.

**Independent Test**: Run the test suites, load every existing world, and re-run the forager acceptance on the
social brain with social stimuli off and on.

**Acceptance Scenarios**:

1. **Given** any existing world, **When** it loads, **Then** it runs as before and does not need the new senses.
2. **Given** the social brain in a forager world, **When** social stimuli are off, **Then** find rate, feeding and
   escape stay within the 14.5K brain's seed-to-seed spread.
3. **Given** social stimuli on, **When** flies forage, **Then** any change in find rate or feeding is reported, and
   flower stimulus never drives the contact-pheromone sense.

---

### Edge Cases

- **Neurons with unknown side.** Many fly-odour receptor neurons have `rootSide = unknown` (for example 48 of 204
  `ORN_DA1`). They are left out of the left/right pools, as for the other odours, and the count is reported.
- **Overlap with other odours.** If the conspecific glomeruli share any glomerulus or neuron with the food A, food B
  or danger sets, extraction fails with a named error.
- **A declared social neuron group is missing.** A world that declares a social stimulus for a brain without the
  matching channel fails with a named error; it does not fall back to a scripted signal. Worlds without the social
  stimuli keep loading on any brain.
- **Both front legs inside one fly**, or **one leg inside two flies.** Each side's input is computed on its own; two
  overlapping flies add up, clipped to the channel range.
- **Flies on top of each other.** Bodies may overlap; contact is sensed, not resolved as a collision. The odour field
  near a source is capped so it does not blow up at zero distance.
- **A fly dies or leaves.** It stops emitting at once.
- **Many flies in one spot.** Conspecific odour from several flies adds up and is clipped to the channel range; the
  contrast between sides stays meaningful.
- **Pheromone in food.** Flower and fruit stimuli never drive `contact-pheromone`, and other flies never drive
  `taste-leg`.
- **Sex tag missing.** A fly without a tag uses the world's declared default; an unknown tag value fails the world
  load with a named error.
- **Courtship has only one output.** The brain reads song from the dataset's song descending neuron pIP10 (the
  `song` pool); it has no abdomen or copulation output. If pheromone drive reaches other courtship command neurons
  that are not decoded, that is reported; no output is invented to show courtship. If `song` never rises above
  rest, wing extension is never drawn and that is a finding.

## Requirements *(mandatory)*

### Functional Requirements

**Governance**

- **FR-001**: The project MUST record a decision (ADR 012) that defines the two social senses, their neuron
  selections and counts, the sex tag and its emission model, the probe results and the calibration, before world
  code lands. It MUST note that it adds senses for the D16 neurons rather than reversing D16.
- **FR-002**: Each social sense MUST declare its valence in data, with a fixed sign, shown on the panel and in the
  README like the other senses. The valence MUST NOT be declared up front: it is set from the brain-only probe's
  measured sign (approach, avoid or none) and recorded in ADR 012. (Amended 2026-10-21, plan: cVA in males is
  expected to be aversive or aggression-related, so the data decides.)

**Extraction**

- **FR-003**: A new brain config MUST add the senses by dataset filters only. `contact-pheromone-left/right`: class
  gustatory, subclass leg bristle, entry nerve ProLN, receptor type `putative_ppk23` or `putative_ppk25`, by root
  side (the 136 neurons leg taste excludes). `odour-conspecific-left/right`: class olfactory, fly-odour glomeruli
  (default `ORN_DA1`, `ORN_VA1v`, `ORN_VA1d`; `ORN_VL2a` measured as a variant only), by root side.
- **FR-003a**: The config MUST seed the known social pathway by dataset type so it survives the cut: the pC1 types
  (which hold P1 in this release), the mAL types, vAB3 (`AN09B017e/f/g`) and the song descending neuron pIP10.
  Every type name MUST be checked against the annotations; a seed that matches nothing fails with a named error.
  (Added 2026-10-21, plan.)
- **FR-003b**: The brain MUST declare a named output pool `song` (pIP10). The body layer MAY draw wing extension when
  the decoded `song` drive is above a declared threshold; it never produces song from anything but that pool.
  (Added 2026-10-21, plan.)
- **FR-004**: The leg-taste selection MUST stay exactly as it is (ppk23/ppk25 still excluded). A neuron MUST NOT be
  in more than one sense; extraction MUST fail with a named error otherwise.
- **FR-005**: The new brain MUST keep every input, output and neuron group of the 14.5K mushroom-body brain, so the
  learning and forager worlds can run on it. Neurons the new senses need MUST be admitted by config (seed or fill
  rule), never by hand-wired edges.
- **FR-006**: Extraction MUST be reproducible (byte-identical apart from creation time) and MUST report, per sense
  and side, the neuron count and the neurons dropped for unknown side.

**Brain probe**

- **FR-007**: A brain-only probe MUST drive each social sense per side and report, per output pool, the response
  against no stimulus, for the brain and the size-matched random graph, on calibration seeds. Its results MUST be
  recorded in ADR 012.
- **FR-008**: A sense that does not reach the output pools MUST be recorded as a finding. No edge, decoder rule or
  body rule MAY be added to make a social sense act without the brain.

**World**

- **FR-009**: Each fly MUST have a sex tag (female or male), declared per fly in the world config, with a declared
  default. The tag MUST NOT change the fly's brain, decoder or body layer.
- **FR-010**: Each fly MUST be a moving odour source for `odour:conspecific`. Every other fly senses it at its two
  antenna sites, with strength falling with distance as declared in the world config (range, falloff and a cap near
  zero distance). A fly MUST NOT sense itself.
- **FR-011**: Contact MUST be: a fly's front-leg site (left or right) lies inside another fly's body radius. The
  body radius MUST be declared in the world config. Contact drives `contact-pheromone` on that side only.
- **FR-012**: Each sex's emission (conspecific odour strength, contact pheromone strength) MUST be declared per sex
  in the world config. Defaults are listed in Assumptions.
- **FR-013**: The two stimulus mappings MUST be declared in the world config like the existing ones, MUST drive only
  their declared channels, and MUST be identical across every arm of an experiment. The body layer MUST NOT read
  other flies' positions.
- **FR-014**: A world MUST be shipped that runs several flies of both sexes on the social brain, with food, so social
  and foraging behaviour can be seen together.
- **FR-015**: Worlds that do not declare the social stimuli MUST load and run as before on every brain.

**Calibration**

- **FR-016**: Social stimulus gains and emission strengths MUST be calibrated on calibration seeds only, with the run
  that motivated each value recorded in the feature's calibration notes. Verdicts MUST use held-out seeds only.
- **FR-017**: Calibration MAY change only declared world stimulus values and existing named LIF parameters of the
  social world. It MUST NOT change the forager or learning worlds' shipped settings.
- **FR-018**: The hunger modulator MUST NOT target the social senses unless ADR 012 records a measured reason.

**Telemetry and panel**

- **FR-019**: The panel MUST show each fly's sex tag (noted as "male connectome"), and the left/right input of both
  social senses, labelled with their declared valence.
- **FR-020**: Telemetry MUST expose per-fly social inputs and contact events so the experiment can be run without the
  browser.

**Experiments**

- **FR-021**: The behaviour experiment MUST run four arms (social brain, pheromone-ablated brain: the same brain
  with the social input pools' outgoing synapses removed, random graph, random walk) with the same body layer, from
  the command line, with every fly stepping in lockstep, and write results next to the spec. (Amended 2026-10-21,
  plan: the ablated arm replaces "social stimuli off".)
- **FR-022**: It MUST report per arm: nearest-neighbour distance, time within 2 tiles of another fly, contact events
  per fly per minute, mean contact duration, a following index (heading correlation while close), and song bouts per
  contact against song bouts per tick spent alone, each split by the other fly's sex tag; and the forager measures
  (find rate, feeding, food- and danger-odour turning, escape) with social stimuli on and off.
- **FR-023**: The behaviour target is social approach: on held-out seeds, the social brain MUST spend more time within
  the social distance of another fly, and have more contact events per fly per minute, than both the random-graph
  and the random-walk arms, with non-overlapping 95 % confidence intervals. The female/male split is reported, not
  gated. A failed target is recorded as a finding in ADR 012, with the null arms. (Clarified 2026-10-21, Q1.)

### Key Entities

- **Sex tag**: a fly's label, female or male, set per fly. It changes only what the fly emits; every fly's brain is
  the male connectome.
- **Social sense**: `odour-conspecific` (antennae, fly-odour glomeruli) or `contact-pheromone` (front legs,
  ppk23/ppk25 GRNs), each a left/right channel pair with a declared valence and dataset selection.
- **Emission profile**: per sex, the strength of the fly's odour and of its contact pheromone.
- **Conspecific odour field**: the odour each fly gives off, moving with it, with declared range, falloff and cap.
- **Body radius**: the declared radius of a fly's body, used for contact.
- **Contact event**: a period during which a fly's front-leg site lies inside another fly's body radius, with its
  side, its start and end, and the other fly's sex tag.
- **Social probe result**: per sense and side, the response of each output pool for the brain and the random graph.
- **Experiment arm**: social brain, pheromone-ablated brain, random graph, random walk.
- **Song pool**: the decoded output read from pIP10; above a declared threshold the fly is drawn with its wings
  extended, and a song bout is counted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The social brain extracts twice with byte-identical output, and its leg-taste pool is identical to the
  14.5K brain's; the contact-pheromone pool holds the 136 front-leg ppk23/ppk25 neurons, minus any of unknown side.
- **SC-002**: The probe results for both senses, for the brain and the random graph, are recorded in ADR 012 before
  any world code is merged.
- **SC-003**: In a two-fly test, a fly's conspecific-odour input is higher on the side of the other fly in 100 % of
  sampled ticks where the other fly is in range and off the midline, and contact fires on the correct side in 100 %
  of contact ticks.
- **SC-004**: The behaviour experiment on held-out seeds reports every FR-022 measure for all four arms with 95 %
  confidence intervals; the social brain's time near other flies and contact rate exceed both the random-graph and
  random-walk arms with non-overlapping intervals, or ADR 012 records why not.
- **SC-005**: With social stimuli off, the social brain's find rate, feeding and escape measures stay within the
  14.5K brain's seed-to-seed spread on held-out seeds.
- **SC-006**: All existing test suites pass, every existing world loads, and the forager and learning worlds' results
  are unchanged.
- **SC-007**: The social world runs at least 6 flies of both sexes in the browser with no console errors and no
  visible drop in frame rate compared with the same world without social stimuli.
- **SC-008**: From the panel alone, a viewer can tell each fly's sex tag, that its brain is male, and when it is
  smelling or touching another fly.

## Assumptions

- The base brain is the 14.5K mushroom-body brain (v3, spec 019). The social brain is a new config next to it; the
  existing snapshot stays as it is.
- Only the male CNS exists. A "female" fly is the male brain with a female tag. This is a stated limitation of the
  model: female behaviour is not modelled, only female-like emission, and results are reported as "male brain
  sensing tagged flies".
- Default emission, from the biology: contact pheromone (ppk23/ppk25 in males sense female cuticular pheromones)
  strong for females, weak for males. Conspecific odour present for both sexes, with males adding a cVA-like
  component sensed by DA1; the world declares one strength per sex for the single conspecific channel.
- Default fly-odour glomeruli: DA1 (Or67d, cVA), VA1v (Or47b), VA1d (Or88a). VL2a (Ir84a) is left out of the shipped
  pool because it is also a food-odour glomerulus; it is measured as a variant in the fidelity probe. None overlaps the current food A (DM1, DM2, DM4), food B (VA2, DP1m, VM5d) or danger
  (V) sets.
- Contact pheromone uses front-leg (ProLN) neurons only, matching the front-leg site; mid-leg, hind-leg and wing
  ppk23/ppk25 neurons are out of scope.
- Flies do not collide with each other; contact is sensed only. The existing touch sense keeps reading blocked
  terrain only.
- The existing per-fly `sex` list in the world config is reused as the sex tag where present.
- Out of scope: song sound, copulation, abdomen or any output beyond the `song` pool; female brains; learning on
  social senses; changes to the worker protocol beyond added channels and telemetry fields. Wing extension is drawn
  from the `song` pool only (amended 2026-10-21, plan).
