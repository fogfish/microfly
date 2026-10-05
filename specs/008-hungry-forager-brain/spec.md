# Feature Specification: Hungry Forager Brain

**Feature Branch**: `008-hungry-forager-brain`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Write an utility to parse malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md. This brain should enable the fly behave like a hungry animal. It should smell food from a distance, walk toward it, stop on it, eat for a while, and leave when it is full. Integrate the brain into LIF and simulator. Keep existing LIF, brains available under the version v0 (lif-v0.js, etc). Allow user to choose between mock, small brain v0 and the new brain v1 via config. Make sure the extractor is able to produce multiple brain formats."

**Governing decisions**: [ADR 003 (hungry forager brain)](../../adrs/003-hungry-forager-brain.md) defines the brain, the LIF extensions, the body and world changes, and the contract versions. [ADR 002](../../adrs/002-smallest-functional-brain.md) defines the small brain (v0). This spec states what the user gets and how it is checked; the ADR states how.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Hungry Fly Finds Food From a Distance (Priority: P1)

A visitor starts the world with the forager brain (v1). A fly that is hungry smells a flower from several tiles away,
turns toward the side where the smell is stronger, and walks toward the flower. The visitor sees the fly leave its
random wandering and head for food, not circle in place.

**Why this priority**: Without distance sensing and steering toward food, the rest of the hungry behaviour cannot
happen. The earlier brains reach food no more often than a random walk.

**Independent Test**: Load the world with the v1 brain, place a fly farther than one odour radius from a flower
with a seeded run, and check that the fly's path ends on the flower more often than the random-walk baseline over
held-out seeds.

**Acceptance Scenarios**:

1. **Given** a hungry fly (energy 0.1) farther than the odour radius from every flower, **When** the odour from a
   flower reaches the fly's antennae, **Then** the fly's heading changes so that it moves toward the stronger side.
2. **Given** a hungry fly with a flower on its left, **When** it senses the odour, **Then** its left turn drive is
   lower than its right turn drive and it turns left (verified with a unit test that places an odour source on the
   fly's left).
3. **Given** a hungry fly within one odour radius of a flower, **When** it walks, **Then** its distance to the
   flower falls on average over the run.
4. **Given** a sated fly (energy 0.9), **When** it is near the same flower, **Then** its drive toward the flower is
   weaker than a hungry fly's in the same place.

---

### User Story 2 - The Fly Stops and Eats on Food (Priority: P1)

When the fly reaches a flower, it slows down and stops. Its feeding output rises above the threshold, and it eats for
a while. Each eating tick raises its energy and lowers its hunger. The flower's stock falls while it is eaten, and an
empty flower gives no taste or smell.

**Why this priority**: Eating is what distinguishes a fly that is hungry from one that circles a flower. The earlier
world counted contacts, which rewarded spinning.

**Independent Test**: Place a hungry fly on a flower in a seeded run. Confirm that it eats only while slow and only
while its feeding output is above threshold, that its energy rises and the flower's stock falls, and that no eating
happens elsewhere.

**Acceptance Scenarios**:

1. **Given** a fly on a flower with speed below the eating speed and feeding output above threshold, **When** a tick
   passes, **Then** the fly eats: its energy rises and the flower's stock falls.
2. **Given** a fly on a flower that is moving faster than the eating speed, **When** a tick passes, **Then** the fly
   does not eat, and its energy does not change from eating.
3. **Given** a fly on a flower with feeding output below threshold, **When** a tick passes, **Then** the fly does not
   eat.
4. **Given** a fly on a flower with stock 0, **When** it senses taste and odour, **Then** both are 0.
5. **Given** a flower being eaten, **When** time passes without eating, **Then** its stock regrows at the configured
   rate, up to its full stock.
6. **Given** a fly is eating, **When** its energy reaches 1, **Then** its hunger is 0 and its energy does not exceed 1.

---

### User Story 3 - The Fly Leaves When It Is Full (Priority: P1)

As the fly fills up, its taste and smell from food weaken, and its feeding output falls below threshold. The walking
command then takes over and the fly moves off the flower. A sated fly is not pulled back to the same flower at once.

**Why this priority**: Leaving a flower when full is the second half of "hungry": without it the fly stays on one
flower forever.

**Independent Test**: Run a fly from hungry (energy 0.1) on a flower until it is full. Confirm that eating stops, the
fly walks off the flower before it is empty, and that a sated fly does not return to the same flower right away.

**Acceptance Scenarios**:

1. **Given** a fly eating on a flower, **When** its energy reaches a level where its feeding output falls below
   threshold, **Then** eating stops and the fly resumes walking.
2. **Given** a sated fly, **When** it leaves a flower, **Then** it does not return to that flower's cell within the
   same run, unless the flower regrows and the fly becomes hungry again.
3. **Given** eating bouts in a run, **When** they are counted, **Then** the share that end with the fly walking off
   before the flower is empty is reported.

---

### User Story 4 - Choose the Brain in Config (Priority: P1)

The user chooses which brain runs the flies by one setting in the world config: `mock` (the random toy brain),
`v0` (the small brain of ADR 002, from a snapshot), or `v1` (the forager brain of ADR 003, from a snapshot). The same
world can be run with each choice, so the brains can be compared on the same map and seeds. Existing world configs keep
working with no edit.

**Why this priority**: The user compares brain behaviours. A choice made in config, with no code edit, is what makes the
comparison possible.

**Independent Test**: Run the same world with `mock`, `v0` and `v1` in turn and confirm each one starts, runs the
flies, and reports which brain it used. Run a world file that predates this feature and confirm it behaves as before.

**Acceptance Scenarios**:

1. **Given** `flies.brain` selects `mock`, **When** the world starts, **Then** the flies run the random toy brain
   and the panel names it as mock.
2. **Given** `flies.brain` selects `v0` with a v0 snapshot, **When** the world starts, **Then** the flies run the
   small brain with the v0 LIF and the panel names the snapshot.
3. **Given** `flies.brain` selects `v1` with a v1 snapshot, **When** the world starts, **Then** the flies run the
   forager brain with the v1 LIF and the panel names the snapshot and its release.
4. **Given** `flies.brain` selects `v1` but names a v0 snapshot (or the reverse), **When** the world starts, **Then**
   the world refuses to start with an error naming the mismatch, and no fly starts.
5. **Given** a world file written before this feature (no version key), **When** it starts, **Then** it behaves exactly
   as it did: no snapshot means `mock`, a snapshot means `v0`.
6. **Given** a brain choice that is not `mock`, `v0` or `v1`, **When** the world starts, **Then** the error names the
   unknown value and the allowed values.

---

### User Story 5 - Extract Brains in Multiple Formats (Priority: P2)

The user runs the extractor on the MaleCNS v1.0 dataset with a config file. The config chooses the format: the small
brain of ADR 002 (container version 3) or the forager brain of ADR 003 (container version 4). Each format is written
with its provenance, and each one is read by the browser. The same config and dataset always give a byte-identical file.

**Why this priority**: The brains must be produced from the dataset, and the extractor must not be limited to one
format, because v0 and v1 both have to stay available.

**Independent Test**: Run the extractor with the small-brain config and with the forager config on the same dataset.
Confirm two files are written, each in its own format, each reported with its counts and side balance, and that a
second run of each config gives identical bytes.

**Acceptance Scenarios**:

1. **Given** the existing small-brain config, **When** the extractor runs, **Then** it writes a version 3 container
   exactly as before.
2. **Given** the forager config, **When** the extractor runs, **Then** it writes a version 4 container with 2,000 to
   6,000 neurons, every output reached by at least one edge, odour inputs matched left and right, and the report printed.
3. **Given** the same config and the same dataset, **When** the extractor runs twice, **Then** the two files are
   byte-identical except for the creation time in the provenance.
4. **Given** the dataset is missing a required file or row count, **When** the extractor runs, **Then** it writes no
   file and reports the failure code.
5. **Given** a config that is neither format, **When** the extractor runs, **Then** it writes no file and reports a
   configuration error naming the key.

---

### User Story 6 - Keep the v0 Simulator Working (Priority: P2)

The existing LIF core and its tests stay available under the version v0 (`lif-v0.js`), unchanged. The new LIF core
(`lif-v1.js`) adds the forager mechanisms, all switched off by default. Turning them off gives the same spike trains
as v0. Existing brains, world files and the experiment script keep their results.

**Why this priority**: Comparing v0 and v1 is only meaningful if v0 is still the same model.

**Independent Test**: Run the existing golden LIF test against `lif-v0.js` and the new mechanisms off against
`lif-v1.js`, and confirm both reproduce the same spike trains.

**Acceptance Scenarios**:

1. **Given** the existing golden LIF test, **When** it runs against `lif-v0.js`, **Then** it passes with no change to
   its expected values.
2. **Given** `lif-v1.js` with the forager mechanisms off, **When** the same drive is applied, **Then** the spike train
   equals v0's exactly.
3. **Given** the forager mechanisms turned on, **When** a constant drive is applied, **Then** the input's effect
   spreads over time, the neuron adapts, and identical neurons with a jitter seed stop firing in lockstep.
4. **Given** the same jitter seed, **When** a network is built twice, **Then** the thresholds are identical.

---

### User Story 7 - Compare Brains and Behaviour Over Seeds (Priority: P3)

The experiment script runs each brain arm (mock, v0, v1, the size-matched random graph, and the random walk) over
held-out seeds on the same map and reports the forager metrics per arm: how many flies find food, how fast they reach
it, how long they eat, how often they leave before the flower is empty, and whether hungry flies find food more often
than sated ones.

**Why this priority**: It turns the feature into a comparison, which is the stated goal. It is not a shipping gate
(ADR 003, Gate C).

**Independent Test**: Run the experiment script on the forager world and confirm a table per arm with the five
metrics and the held-out seed count.

**Acceptance Scenarios**:

1. **Given** the forager world, **When** the experiment runs, **Then** it prints each arm's five forager metrics over
   the held-out seeds, and the contact count, which no longer decides the verdict.
2. **Given** the results, **When** a metric fails its expectation, **Then** the result is reported as it is, with the
   run that produced it. The data and the mechanism are not changed to make it pass.

---

### Edge Cases

- A flower is eaten to empty while a fly is on it: the fly stops eating, feels no taste or odour from it, and walks off.
- Two flowers close together: the odour sums, and the stronger side wins; a fly between them is not stuck.
- A dataset pool is empty (no admitted body for an input or output type): the extractor stops with the pool code and
  writes no file.
- The left and right odour pools have different sizes after matching: the extractor stops with the imbalance code.
- An output (the feeding neuron) has a low-confidence transmitter: it is still admitted, with its outgoing edges dropped,
  and the report says so.
- The forager selection reaches no output: the extractor stops with the unreached-output code.
- A v1 snapshot is loaded by a browser that only knows v0: the world refuses to start with a version error. Nothing
  is run.
- A hungry fly never reaches food within the run: it is counted in the find metric as not found; the run is not dropped.
- Energy at 0 does not stop the fly; the fly stays hungry and keeps walking (death is out of scope).
- Six forager flies at once on a slow machine: the flies that fall behind are skipped on each frame; the page stays
  responsive and the other flies keep their pace.
- A brain choice set to `v1` with a flies `mode` of `baseline`: the baseline (random walk) applies; no brain is loaded.
- A forager snapshot has neurons without a soma position (964 of 3,408 in the current file): the app's brain activity
  view leaves them out, as the inspector does, and states the count (FR-030).

## Requirements *(mandatory)*

### Functional Requirements

**Brain choice and compatibility**

- **FR-001**: The world config MUST let the user choose the brain with one setting, `flies.brain.version`, whose
  values are `mock`, `v0` and `v1`.
- **FR-002**: When `flies.brain.version` is absent, the system MUST infer `mock` (no snapshot) or `v0` (snapshot
  named), so existing world files behave as before.
- **FR-003**: The system MUST refuse to start, naming the mismatch, when a version does not match its snapshot's
  container version (`v0` with a version 4 file, or `v1` with a version 3 file).
- **FR-004**: The panel MUST show which brain is running (`mock`, `v0` or `v1`), the snapshot's release and creation
  time for `v0` and `v1`.
- **FR-005**: Existing mock, small brain (v0) and antennal-lobe worlds MUST keep running with no file edit.

**Extraction**

- **FR-006**: The extractor MUST read the MaleCNS v1.0 dataset through a configuration file and MUST NOT require the
  dataset to be committed to the repository (its location comes from an argument or an environment variable).
- **FR-007**: The extractor MUST write the small brain (ADR 002, container version 3) when the config selects that
  format, and the forager brain (ADR 003, container version 4) when the config selects the forager kind.
- **FR-008**: The forager extraction MUST resolve input pools for the two odour channels and the two taste channels,
  match odour pools by side, and resolve the output pools for turn left, turn right, forward, backward and feed.
- **FR-009**: The forager extraction MUST select interneurons by forward flow from the inputs and backward flow to the
  outputs, within the configured odour and taste budgets, excluding sensory neurons.
- **FR-010**: The forager extraction MUST write per-neuron roles, input channels, output drives and the weight rule
  to the container, so the browser can wire the brain without reading the dataset.
- **FR-011**: The extractor MUST print a report per format: counts per pool, side balance, edges into each output,
  the weight range and the self-check result.
- **FR-012**: The extractor MUST stop with a named failure code and write no file for: a missing dataset file or row
  count, an empty pool, a side imbalance, an unreached output, a neuron count out of range, a modulator that targets
  an undeclared input, and a non-determinism between two runs.
- **FR-013**: Output bodies with an unmapped or low-confidence transmitter MUST be admitted with sign 0 and their
  outgoing edges dropped. Input and interneuron bodies MUST keep the existing admission rule.
- **FR-014**: Given the same config and dataset, the extractor MUST produce a byte-identical file apart from the
  creation time.

**Simulator and LIF**

- **FR-015**: The existing LIF core and brain runner MUST remain available unchanged as `lif-v0.js` and its brain
  runner counterpart, and the existing tests for them MUST keep passing.
- **FR-016**: The new LIF core (`lif-v1.js`) MUST provide the forager mechanisms: exponential synaptic current,
  spike-frequency adaptation, threshold heterogeneity seeded per fly, and several LIF steps per world tick. Each is
  off by default, and all are named, documented and validated.
- **FR-017**: With the forager mechanisms off, `lif-v1.js` MUST produce the same spike trains as `lif-v0.js` for the
  same graph, parameters and drive.
- **FR-018**: The v1 brain runner MUST drive each input pool with its own value, multiplied by a hunger-dependent gain
  declared in the snapshot, and MUST read its outputs as the exponential moving average of each output pool's spike
  rate.
- **FR-019**: The forager body MUST derive forward speed from the forward and backward outputs, and turning from the
  left and right turn outputs. The direction of turning MUST be fixed by a test that places an odour source on the
  fly's left.
- **FR-020**: The browser MUST reject a snapshot whose container version the selected brain does not support, with a
  message naming the version.
- **FR-021**: The worker message protocol MUST carry the input values and the hunger state to the brain, and the
  feeding output back. Its version MUST change, and the previous version MUST still be accepted for `v0` and `mock`.

**Body, hunger and eating**

- **FR-022**: Each fly MUST have an energy value between 0 and 1, starting at its configured initial value. Energy
  falls at a metabolic rate every tick and rises at an intake rate while the fly eats. Hunger is 1 minus energy.
- **FR-023**: A fly MUST eat on a tick only when all three hold: its cell holds a flower with stock above 0, its
  speed is below the eating speed, and its feeding output is above the feeding threshold.
- **FR-024**: Eating MUST lower the flower's stock. Each flower MUST regrow its stock at a configured rate, up to its
  full stock. An empty flower MUST give no taste and no odour.
- **FR-025**: Odour MUST be sampled at two points on either side of the fly's heading, weighted by each flower's stock,
  with a radius that lets food be smelled from several tiles away. Taste MUST be the stock of the flower under the
  fly when it stands on one.
- **FR-026**: The world MUST NOT stop, turn or hold a fly. A fly that does not slow down on food does not eat.

**Measurement and experiment**

- **FR-027**: The experiment script MUST report, per arm and over held-out seeds: the fraction of flies that reach a
  flower, the median time to the first flower for flies that start beyond one odour radius, the median eating-bout
  length, the fraction of bouts that end before the flower is empty, and the flower-finding rate for hungry versus
  sated flies.
- **FR-028**: Contacts MUST still be printed but MUST NOT decide the verdict.
- **FR-029**: LIF parameters, the modulator gains and the stock and regrowth values MUST be set by calibration on seeds
  kept separate from the held-out seeds, and the calibration seeds and values MUST be recorded with the run.
- **FR-030**: For a snapshot brain, the app's brain activity view MUST draw the same neurons as the brain inspector does
  for the same file: a neuron without a soma position MUST NOT be drawn, and the view MUST state how many neurons were
  left out. This supersedes the seeded sphere placement for snapshot brains in `006-fly-status-panel` (research R6).
  Toy brains, which have no soma positions at all, keep the seeded sphere.
- **FR-031**: The panel MUST show a v1 fly's energy and hunger as two bars from 0% to 100%, updated on every tick. The
  bars show the fly's own state, not the brain's outputs.
- **FR-032**: In the shipped `world-forager.json`, a hungry fly (energy 0.1) placed on a flower MUST slow below the eating
  speed and eat, using the trained brain's own drives, with no hold or stop in the world (FR-026). The calibration MUST
  choose its values by an eating criterion as well as the find rate, and the calibration record MUST state the eating
  bouts and eating ticks for each setting it considered.
- **FR-033**: For a snapshot brain, the brain activity view MUST show activity the user can compare with the simple brain.
  The counts line MUST state the active neurons in the window, and the same seed run with `v0` and with `v1` MUST be
  reportable side by side.
- **FR-034**: For the selected v1 fly, the panel MUST show the speed, the feed output and the eating state, so that a
  fly which does not stop can be explained from the panel.

**Bugfix**: 2026-10-05 — BUG-002 Added FR-031 to FR-034 for the panel bars, the eating behaviour of the shipped world,
the activity view and the panel diagnostic.

**Bugfix**: 2026-10-05 — BUG-001 Added FR-030 and the matching edge case and success criterion, resolving the conflict
between the inspector (004: soma-less neurons not drawn) and the app (006 R6: seeded sphere) for the forager brain.

**Bugfix**: 2026-10-05 — BUG-002 Added FR-031 to FR-034 and SC-011 to SC-013. The forager fly never slows to eat in the
shipped world, the panel shows no hunger bars for the user, and the activity view gives no comparison with the simple
brain. The spec had no requirement for any of these.

### Key Entities *(include if feature involves data)*

- **Brain choice**: one of `mock`, `v0`, `v1`; set in the world config; decides the brain, the LIF version and the
  worker protocol version.
- **Extraction config (format 3, forager)**: declares the input channels with their pools, the output roles, the
  pathways, the flow steps, the budgets, the weight rule, the modulators and the neuron count range.
- **Brain container (version 4)**: neurons with roles and channels, the induced graph, per-edge weights and raw synapse
  counts, and the declarations of inputs, outputs, drives and modulators.
- **Fly energy and hunger**: per-fly energy in [0, 1], hunger = 1 − energy, changed by eating and by metabolism.
- **Flower stock**: per-flower amount in [0, full], lowered by eating, regrown over time, which sets its taste and smell.
- **Eating bout**: a run of consecutive eating ticks by one fly on one flower; its length and its end reason are reported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extractor writes a version 4 forager brain from MaleCNS v1.0 with 2,000 to 6,000 neurons, every output
  reached by at least one edge, both odour pools matched, and a second run gives identical bytes apart from creation time.
- **SC-002**: The extractor still writes the version 3 small brain from its existing config with identical output.
- **SC-003**: The world runs with `mock`, `v0` and `v1` by changing one config value, with no code edit, and an
  existing world file runs unchanged.
- **SC-004**: The existing golden LIF test and every existing brain and world test pass with no change to expected
  values.
- **SC-005**: With the forager mechanisms off, `lif-v1.js` gives the same spike trains as `lif-v0.js` on every
  reference drive in the test suite.
- **SC-006**: Six forager flies running at the configured tick rate keep the page responsive; the time each tick takes is
  measured and recorded with the run.
- **SC-007**: A hungry fly (energy 0.1) eats for longer bouts than a sated fly (energy 0.9) in the held-out run.
- **SC-008**: The experiment script prints the five forager metrics for every arm over the held-out seeds, with the
  count of seeds. The verdict per metric is recorded as measured, whether it passes or fails.
- **SC-010**: For `forager-brain.brain`, the brain activity view draws exactly the neurons that have a soma position
  (2,444 of 3,408), and the drawn set equals the inspector's drawn set in a test (FR-030).
- **SC-009**: No eating bout occurs off a flower, and no fly eats while its speed is above the eating speed, in any run.
- **SC-011**: In `world-forager.json`, on the held-out seeds, at least 50% of flies that reach a flower eat in at least one
  bout, and each such bout has a fly speed below the eating speed. The 50% threshold is proposed here and is confirmed or
  changed in `calibration.md` before the run.
- **SC-012**: Every eating tick has taste input above 0 on both taste channels. A run that eats with taste at 0 fails.
- **SC-013**: The Action section shows energy and hunger bars for a v1 fly, and they match the energy and hunger in the
  last history entry on every tick (FR-031).

## Assumptions

- **Dataset**: MaleCNS v1.0 as used by the existing extractor (`data/malecns`, not committed); the traced-only edge
  variant; the same admission rule as ADR 002 for inputs and interneurons.
- **Food glomeruli (ADR 003 Q1)**: DM1, DM2, DM4, VA2, VM2 and DP1m are used as the odour receptor types. They are
  config, not code, and can be replaced before the experiment.
- **Taste (ADR 003 Q2)**: the taste pools are all labellar and taste-peg contact neurons, not a sugar-only set. Bitter
  input is mixed in; this is recorded as a limitation of the eating metric.
- **Sign of glutamate (ADR 002 Q1, ADR 003 Q3)**: glutamate stays inhibitory, as in the existing transmitter sign table.
- **Feeding output (ADR 003 Q4)**: MN9 may receive thin input at the default budget. The result is reported. A change
  to the budget or to the feeding pathway is a config change, recorded with the run that motivated it.
- **Calibration (ADR 003 Q5)**: LIF values, gains, stock, regrowth and eating speed are set on calibration seeds, separate
  from the held-out seeds, and recorded.
- **Learning is out of scope (ADR 003 Q6)**: the mushroom body is not part of this brain and no memory of food
  locations is formed. Hunger, eating and leaving use only the current state.
- **Death is out of scope**: energy at 0 keeps the fly alive.
- **Gate C is a measurement, not a shipping gate (ADR 003)**: the forager metrics are reported as results. A metric
  that fails is reported, not hand-wired around.
- **Browser support**: the same environment as the existing app (modern browsers with module workers, typed arrays and
  no build step).
- **Versions**: container version 4 and worker protocol version 3 are new; version 3 and protocol version 2 are still
  read.
- **Brain choice name**: the config value `v0` means the small brain of ADR 002 from any version 3 snapshot named in the
  config, not one fixed file.
