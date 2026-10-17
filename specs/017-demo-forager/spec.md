# Feature Specification: Demo Forager — Decoded Readout, Body Layer and Online Homeostasis

**Feature Branch**: `017-demo-forager`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "ADR 010-demo-forager.md defines a new process to extract and calibrate
forager-brain-wide.brain. Expected outcome is demoable application fulfilling the requirements R1–R6 (hungry fly
finds food, fly escapes danger, fly avoids heat, calibration in 30 minutes or less in one command, the world map can
change without recalibration, real-time learning from world feedback where it removes a problem)."

**Governing decisions**: [ADR 010](../../adrs/010-demo-forager.md) defines the decoder, the body layer, the hunger
threshold, online homeostasis, the calibration profile and the acceptance arms, and requires constitution v2.0.0
Part A first. This spec states what a visitor sees and how it is checked; the ADR states how it is built. Part 0 of
ADR 010 (bug fixes and the ADR 009 wide-brain re-extraction) is out of scope here — it already shipped. D34
(mushroom-body valence learning) is out of scope here — it is deferred, optional work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Hungry Fly Finds Food and a Sated Fly Does Not (Priority: P1)

A visitor starts the demo world with the wide connectome brain. A fly whose hunger is above the configured threshold
smells food from a distance, turns and walks toward it, and feeds once it arrives. The same fly, started sated,
explores instead of heading for the same food.

**Why this priority**: This is R1, a MUST requirement, and the single most visible sign that the brain is driving
behaviour rather than a scripted reflex.

**Independent Test**: Load the demo world with a hungry fly and a sated fly on held-out seeds, both farther than one
sensing radius from food. Confirm the hungry fly's find rate and arrival are reliably better than the random-walk
baseline over the same seeds, while the sated fly's is not, and that an arrived, hungry fly feeds shortly after
arrival.

**Acceptance Scenarios**:

1. **Given** a fly with hunger at or above the configured threshold, farther than the sensing radius from food,
   **When** it walks the held-out seeds, **Then** its 3,000-tick find rate's 95% confidence interval sits strictly
   above the random walk's.
2. **Given** the same fly with hunger below the threshold, **When** it walks the same seeds, **Then** its find rate
   is not above the random walk's.
3. **Given** a hungry fly that arrives on food, **When** 50 ticks pass, **Then** it has fed in at least 80% of
   arrivals across held-out seeds.
4. **Given** food on the fly's left, **When** the fly senses it, **Then** the decoded side signal for food points
   left and the fly turns toward it (a placed-source unit test).

---

### User Story 2 - A Fly Reacts to Danger and Escapes It (Priority: P1)

A visitor watches a fly enter a danger zone. Within a short window the fly either jumps away from the side the
danger is on, or turns sharply away, and afterward spends much less time inside danger rings than a fly with no
brain steering it at all.

**Why this priority**: This is R2, a MUST requirement, and it must hold on the very first encounter — there is no
second chance to learn to avoid danger.

**Independent Test**: Run held-out seeds through danger zones and measure, per encounter, whether the fly escapes or
turns away within 20 ticks, and the total time spent inside danger rings compared with the random walk.

**Acceptance Scenarios**:

1. **Given** a fly entering a danger ring, **When** up to 20 ticks pass, **Then** it either triggers the escape
   reflex or turns away, in at least 90% of encounters across held-out seeds.
2. **Given** the same held-out seeds, **When** total ticks spent inside danger rings are compared, **Then** the
   brain-driven fly spends at most half as long inside as the random walk.
3. **Given** no side signal for danger is available (fallback), **When** an encounter occurs, **Then** the fly still
   escapes backward rather than freezing or continuing forward.

---

### User Story 3 - A Fly Avoids Heat (Priority: P2)

A visitor watches a fly cross a heated area. It spends less time inside heat rings than a fly that is not steered by
the brain at all.

**Why this priority**: R3 is a SHOULD requirement — a weaker, secondary sign of avoidance behaviour alongside
danger-escape.

**Independent Test**: Run held-out seeds across heat rings and compare time spent inside against the random-walk
baseline.

**Acceptance Scenarios**:

1. **Given** held-out seeds that cross heat rings, **When** ticks inside the rings are totalled, **Then** the
   brain-driven fly's total is lower than the random walk's.

---

### User Story 4 - One Calibration Works on a Second Map (Priority: P2)

A visitor swaps the world's map for a different layout without recalibrating anything. The same fly still finds
food, still escapes danger, and still avoids heat on the new map at a level consistent with the first.

**Why this priority**: R5 is a SHOULD requirement. It is the test that the behaviour comes from the brain's decoded
readout and declared body layer, not from numbers fitted to one map's geometry.

**Independent Test**: Run the Story 1–3 checks on a second map using the one calibration produced for the first map,
on held-out seeds, with no re-run of the calibration command.

**Acceptance Scenarios**:

1. **Given** the calibration produced for map A, **When** it is applied unchanged to map B, **Then** the find-rate,
   escape and time-in-ring checks from Stories 1–3 pass on map B's held-out seeds.

---

### User Story 5 - The Panel Shows the Decoded Readout, Not a Hidden Script (Priority: P2)

A visitor opens the side panel while a fly is running and sees, per sense, the decoded side signal, drive, trend, the
declared approach/avoid/none valence, and how many neurons feed each pool. Nothing it shows is described as learned
or hand-tuned to an outcome.

**Why this priority**: Constitution v2.0.0 Part A requires each sense's valence and the decoder to be shown as
declared, not learned. Without this, a visitor cannot tell the demo's steering apart from a scripted one.

**Independent Test**: Open the panel for a running fly and confirm every sense pair's side, drive, trend, valence
and pool size are displayed and update every tick.

**Acceptance Scenarios**:

1. **Given** a fly is running, **When** the panel is open, **Then** each declared sense shows its decoded side,
   drive, trend, valence and pool size, labelled as a decoded readout.
2. **Given** the panel is open, **When** a pool has no `side` signal (too few side-selective neurons), **Then** the
   panel shows that pool's side term as absent rather than a fabricated value.

---

### User Story 6 - Calibration Finishes in One Command, Under 30 Minutes (Priority: P3)

A visitor runs a single calibration command and it finishes inside the time budget, reporting a pass or a named
failure at each stage — never silently retrying until a number looks good.

**Why this priority**: R4 is a SHOULD requirement. It makes the demo reproducible by anyone, not only by whoever ran
the original multi-day search.

**Independent Test**: Time one run of the calibration command end to end and confirm it reports pass/fail per stage
and a total wall-clock time.

**Acceptance Scenarios**:

1. **Given** the calibration command is run once, **When** it completes, **Then** its total wall-clock time is at
   most 30 minutes, and each of its three stages reports a clear pass or a named failure.
2. **Given** a stage fails its gate, **When** the command runs, **Then** it stops at that stage with the gate and
   the numbers that failed it, rather than continuing with an unvalidated downstream stage.

---

### User Story 7 - Behaviour Holds Up From the First Tick, Without a Separate Balance Pass (Priority: P3)

A visitor starts a fresh fly and sees it steer correctly immediately — not biased to one side, not needing a warm-up
period — even though no per-pool balance values were hand-tuned for this map or fly history.

**Why this priority**: This is R6 (MAY). Online homeostasis is the one piece of real-time learning from world
feedback on the demo's required path: it removes the need to calibrate rest-rate and left/right balance by hand, and
the unneeded second hand-tuning pass that would otherwise be required.

**Independent Test**: Start a fly at tick 0 with no stimulus and confirm it shows no persistent turn bias; then run
it long enough for the map or the fly's own history to change the quiet-pool baseline, and confirm the decoded
signals track that drift rather than requiring a new calibration.

**Acceptance Scenarios**:

1. **Given** a freshly started fly with no stimulus present, **When** it walks, **Then** it shows no persistent
   left/right turn bias from tick 0.
2. **Given** a sense pool is quiet (its channel below 0.05), **When** ticks pass, **Then** its rest rate and
   left/right balance keep updating; **given** that sense is active, **when** ticks pass, **then** its rest rate and
   balance do not change during the stimulus.

---

### Edge Cases

- No side-selective pool exists for food (too few side-selective descending neurons): the fly still steers toward
  food by klinotaxis (rising drive → straighter path) alone; its side term reads as absent, not zero-and-hidden.
- No drive pool exists for danger: the alarm signal falls back to the named escape pool and the heat-drive pool; if
  both are also unavailable, R2 is reported as failing — this is a finding to record, not a value to patch in.
- The calibration's regime-check stage finds no point in its grid that avoids runaway activity: a documented fallback
  widens the grid by one step each way, still inside the 30-minute budget; if that also fails, calibration stops with
  a named error rather than shipping an unvalidated setting.
- A sense pair's input signal is weak at the range the world needs (for example, the antenna separation on the map):
  an optional, declared stimulus-contrast gain may be turned on; it is off by default and its use is recorded.
- The size-matched random graph, run through the same decoder rule and body layer, also passes the find-rate or
  escape checks: this is reported, not hidden, and it narrows the claim rather than failing the demo.
- A world map is swapped mid-run or a second map is loaded with no decoder or body-layer parameter specific to the
  first map: behaviour must not silently degrade without being measurable by the Story 4 checks.
- A fly stays hungry for the entire run without ever finding food: it is counted as "not found" in the find-rate
  metric; the run is not discarded.
- Six demo flies run at once on a slow machine: the page stays responsive and the run notes which flies fell behind
  a tick, consistent with existing multi-fly behaviour.

## Requirements *(mandatory)*

### Functional Requirements

**Brain and simulation**

- **FR-001**: The demo MUST use the existing wide connectome brain (14,500 neurons, ADR 009) with no change to its
  extraction.
- **FR-002**: The simulation MUST support an optional constant background current applied equally to every bulk
  neuron, off (zero) by default, so that with the default the existing LIF golden test is unaffected.

**Decoded readout**

- **FR-003**: The system MUST derive, from a brain-only spiking probe run on calibration seeds, a named pool of
  neurons for each sense's side-selectivity (where enough side-selective neurons exist), each sense's drive, the
  escape alarm, feeding and the forward/backward outputs.
- **FR-004**: A pool's selection MUST be verified to reproduce on a calibration seed that was held back from the
  pool-selection run itself; failing that check MUST stop calibration with a named error and no decoder is shipped.
- **FR-005**: Pool selection MUST be deterministic for the same snapshot, calibrated settings and seeds (ties broken
  on a stable per-neuron identifier).
- **FR-006**: The decoder MUST be written to a file that records which snapshot and settings it was derived from, the
  probe's seeds, the pools, and each sense's declared valence (approach, avoid or none).
- **FR-007**: The decoder file MUST be rejected at load time if it does not match the snapshot it names, names an
  out-of-range neuron, an unknown sense, or a valence outside approach/avoid/none.
- **FR-008**: Every tick, the system MUST compute, per sense, a smoothed drive, a smoothed side signal (when a side
  pool exists), a weight that falls to zero when the sense's pool is silent, and a trend comparing recent drive
  against a slower-moving average.
- **FR-009**: The exact same decoder rule, derivation process and pool-selection probe MUST be applied, unchanged, to
  the matched random-graph control brain.

**Hunger**

- **FR-010**: Food-related senses MUST reach near-zero effect on a sated fly and their full configured effect once
  hunger passes a configured threshold, with a smooth ramp between the two, set without changing the extracted
  snapshot.
- **FR-011**: Taste senses MUST keep a non-zero minimum effect even when sated, so a fly already standing on food is
  not blind to it.
- **FR-012**: Feeding MUST depend only on standing on food and the decoded feed signal clearing its threshold — no
  separate hunger override gates feeding.

**Body layer**

- **FR-013**: A declared body layer MUST turn decoded signals into motion: a walking rhythm with a non-zero base
  speed and exploration noise even with no stimulus, directional steering from each sense's side signal weighted by
  its valence and current drive, and path straightening or increased casting from each sense's trend.
- **FR-014**: The body layer MUST trigger an escape reflex (a jump away from the stimulus side, or backward if no
  side is known) when the decoded alarm signal clears its threshold, followed by a cooldown, and MUST trigger backing
  up when the decoded backward signal clears its threshold.
- **FR-015**: The body layer MUST be identical in every arm of an experiment (brain, random walk, random graph) and
  MUST NOT read the stimulus directly — only the decoded signals (or, for the random-walk control, none).
- **FR-016**: The body layer MUST require no per-map parameter; a new map's stimulus fields MUST be normalised by the
  world's own field builders so that map size or source count does not change input scale to the body layer.

**Calibration**

- **FR-017**: A single calibration command MUST run, in order: a regime check (no runaway activity, every sense's
  drive pool rises under its own stimulus), pool selection and decoder derivation, and a closed-loop smoke check
  reporting quick pass/fail numbers for food-finding, escape and heat-avoidance — never tuning on those numbers.
- **FR-018**: The calibration command MUST stop at the first stage that fails its gate, reporting the stage, the gate
  and the numbers that failed it, and MUST NOT silently continue to a later stage.
- **FR-019**: The calibration command MUST enforce a hard time budget and report its total wall-clock time on
  completion.
- **FR-020**: Calibration MUST use only seeds reserved for calibration; verification against the acceptance
  requirements (Part K / Stories 1–4) MUST use a disjoint set of held-out seeds.

**Panel and transparency**

- **FR-021**: The panel MUST show, per declared sense, the decoded side signal (or its absence), drive, trend, the
  declared valence, and the pool size, labelled as a decoded readout rather than a learned or scripted value.

**Measurement**

- **FR-022**: The acceptance run MUST report, on held-out seeds and on at least two maps using one calibration, three
  arms: the brain, a random walk using the identical body layer with decoded signals zeroed, and a size-matched
  random graph run through the identical decoder derivation and body layer.
- **FR-023**: The acceptance report MUST state, per requirement (R1–R5), whether its measured gate passed, without
  adjusting the brain, decoder or body layer afterward to flip a failing result.
- **FR-024**: If the random-graph control also passes a gate that the brain passes, the report MUST state this
  alongside the brain's result, not omit it.

### Key Entities *(include if feature involves data)*

- **Decoded sense signal**: per declared sense pair, the per-tick side, drive, weight and trend values computed from
  spiking pool rates; consumed only by the body layer.
- **Pool**: a named set of neuron indices selected by the brain-only probe (side-selectivity, drive-selectivity,
  alarm, feed, forward, backward); carries its selection rule, seeds and provenance.
- **Declared valence**: per sense, one of approach / avoid / none; set in data, shown on the panel, never learned.
- **Body layer**: the declared walking, steering, escape and backing-up laws that turn decoded signals into motion;
  identical across every experiment arm; never reads the stimulus.
- **Hunger threshold**: the hunger level above which food-related senses ramp from a near-zero to a full configured
  effect; set in world config, not in the extracted snapshot.
- **Homeostatic baseline**: per pool, a slow-moving rest rate and, for side pools, a left/right balance, both updated
  only while that pool's sense is quiet.
- **Calibration run**: one execution of the single calibration command, producing a decoder file and a pass/fail
  report per stage, bounded by a time budget.
- **Experiment arm**: one of brain, random walk, random graph; each measured on the same held-out seeds, maps and
  body layer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On held-out seeds, a hungry fly's food-find-rate 95% confidence interval sits strictly above the random
  walk's; the same fly started sated does not clear that bar.
- **SC-002**: At least 80% of a hungry fly's arrivals at food are followed by feeding within 50 ticks, on held-out
  seeds.
- **SC-003**: At least 90% of danger-ring encounters on held-out seeds are followed by an escape or a turn away within
  20 ticks.
- **SC-004**: Time spent inside danger rings on held-out seeds is at most half the random walk's.
- **SC-005**: Time spent inside heat rings on held-out seeds is lower than the random walk's.
- **SC-006**: The food-find, escape and heat-avoidance checks (SC-001, SC-003, SC-005) pass on a second map using the
  same calibration as the first map, with no recalibration run between them.
- **SC-007**: A single run of the calibration command completes in 30 minutes or less, with each of its three stages
  reporting a clear pass or a named failure.
- **SC-008**: The panel displays every declared sense's side, drive, trend, valence and pool size for a running fly,
  updated every tick, with no sense's display fabricated when its pool is unavailable.
- **SC-009**: A freshly started fly shows no persistent left/right turn bias at tick 0, with no separate per-pool
  balance calibration step run beforehand.
- **SC-010**: The acceptance report states a pass/fail verdict for R1 through R5 against measured numbers, on
  held-out seeds, for all three experiment arms, including any case where the random graph also passes.

## Assumptions

- **Prior work already shipped**: ADR 010 Part 0 (the three bug fixes and the ADR 009 wide-brain re-extraction) and
  constitution v2.0.0 Part A landed on `main` ahead of this feature; this spec starts from them and does not re-open
  them.
- **Scope boundary**: D34 (mushroom-body valence learning) is explicitly deferred past this feature's MUST/SHOULD
  path; R6 (MAY) is satisfied here by online homeostasis (Story 7) alone.
- **Seeds**: calibration seeds and held-out seeds are disjoint sets, fixed before any run, per existing project
  convention; held-out seeds are never used to choose a setting.
- **Maps**: the sketch map already shipping, plus one additional existing map layout, are used for the two-map check
  (R5); no new map art is required by this feature.
- **Fallbacks are part of the spec, not an afterthought**: the Edge Cases list the declared fallback for a missing
  side pool, a missing drive pool, a failed regime check and a weak input signal; each fallback stays within the
  calibration time budget and is recorded when used.
- **Behaviour failures are findings**: per project convention, a requirement that does not measure as passing is
  reported as measured, not patched by hand-wiring a connection or adjusting a result after the fact.
- **Browser support**: the same environment as the existing app (modern browsers with module workers, typed arrays,
  no build step, no new third-party dependency beyond what ADR 010 already vendors as justified configuration).
