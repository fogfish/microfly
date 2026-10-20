# Feature Specification: Mushroom-Body Valence Learning

**Feature Branch**: `019-mb-valence-learning`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Learning (mushroom-body valence learning). ADR 010-demo-forager.md defines the learning
criteria at D34: KC→MBON rule, PAM (reward) while eating, PPL1 (punishment) on escape or heat contact, and learned
valence scaling `v_p` within [0.5, 1.5]. The whole MB is already in the 14.5K brain (ADR 006: 4,064 KCs, 316 PAM,
97 MBONs). Relax Principle V of the constitution to enable plasticity in the LIF core. Give the world more than one
odour; the two glomerulus sets do not overlap. Gate on the regime before writing any learning code, as a calibration
gate. Plasticity in the LIF core. Experiments and acceptance. Existing klinotaxis-only steering limits how much a
learned gain can change paths. Learning will show up more in stay/leave and eat/not-eat decisions than in turning.
Enforce stay/leave and eat/not-eat decisions."

**Governing decisions**: [ADR 010](../../adrs/010-demo-forager.md) D34 defines the learning rule and the valence
bound. [ADR 006](../../adrs/006-class-seeded-forager-brain.md) put the whole mushroom body (MB) in the brain without
plasticity. This feature needs a new decision record (ADR 011) for the regime gate result and the plasticity rule,
because constitution Principle V allows online plasticity only "where a decision record defines it". The demo
forager (spec 017) and its acceptance (ADR 010 Part K) are prerequisites and must keep passing with learning off.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The Brain Tells Two Food Odours Apart Before Anything Learns (Priority: P1)

A researcher runs a brain-only regime probe on the 14.5K brain with two food odours, A and B, whose receptor
glomeruli do not overlap. The probe reports how sparse the Kenyon-cell (KC) code is for each odour, how repeatable
it is across trials, and how different the two odour codes are. If the brain cannot keep the two odours apart, the
feature stops here, with the result recorded as a finding; no learning code is written.

**Why this priority**: Learning on KC→MBON synapses only means something if each odour activates its own sparse set
of KCs. A dense or shared code makes anything learned about A spread to B and to every other odour. This is the
gate the user asked for: it runs first and decides whether the rest of the feature is built.

**Independent Test**: Run the regime probe on calibration seeds with odour A alone, odour B alone and no odour.
Read the three gate measures and compare them with their targets. No world, decoder or body is needed.

**Acceptance Scenarios**:

1. **Given** the 14.5K brain at the shipped demo LIF settings, **When** the probe presents odour A for repeated
   trials, **Then** it reports the fraction of KCs active for A, the trial-to-trial correlation of A's KC code, and
   the same for B.
2. **Given** both odour codes, **When** the probe compares them, **Then** it reports the correlation between A's
   and B's KC codes.
3. **Given** the measures meet every target (active fraction 5–15 % per odour, same-odour correlation above 0.85,
   A–B correlation below 0.7), **When** the gate is evaluated, **Then** it passes and the result is recorded in the
   decision record with the seeds and settings it ran with.
4. **Given** the brain sits in a saturated state (KC code dense or A–B correlation near 1), **When** the gate
   fails, **Then** the one declared remedy (a named feed-forward pathway gain, see FR-006) is tried, the probe
   re-runs, and both runs are recorded.
5. **Given** the gate still fails after the remedy, **When** the feature is reviewed, **Then** it stops at the gate
   and the decision record states the finding; the learning stories below are not implemented.

---

### User Story 2 - The Mushroom Body Learns an Odour's Value From Reward and Punishment (Priority: P1)

A researcher pairs odour A with reward (dopamine from PAM neurons) in a brain-only conditioning probe, and in a
separate run pairs it with punishment (dopamine from PPL1 neurons). After pairing, the mushroom-body output neurons
(MBONs) respond to A differently than before, in the direction the pairing predicts, while the response to unpaired
odour B changes less. The change fades back over a configured forgetting time.

**Why this priority**: This is the learning itself. Without a measurable, odour-specific, signed change in MBON
output, there is nothing for behaviour to use.

**Independent Test**: Run the conditioning probe (brain only, calibration seeds) in four arms: plastic, frozen
(plasticity off), dopamine-shuffled (teaching signal at random times), and the matched random graph. Read the
learned valence of A and B before pairing, right after pairing, and after the forgetting time.

**Acceptance Scenarios**:

1. **Given** plasticity is on, **When** odour A is paired with reward, **Then** A's learned valence moves towards
   approach and the shift for A is larger than the shift for B.
2. **Given** plasticity is on, **When** odour A is paired with punishment, **Then** A's learned valence moves towards
   avoid and the shift for A is larger than the shift for B.
3. **Given** plasticity is off (frozen arm), **When** the same pairing runs, **Then** neither odour's valence shifts.
4. **Given** the dopamine-shuffled arm, **When** the teaching signal is not paired with A, **Then** A's shift is not
   larger than B's.
5. **Given** a learned shift, **When** the fly then runs with no reward or punishment for the configured forgetting
   time, **Then** the shift decays towards zero.
6. **Given** odour or taste alone evoke some DAN activity, **When** no reward or punishment happens, **Then** that
   background activity does not teach the fly anything (no drift in valence while nothing is paired).

---

### User Story 3 - A Fly That Was Punished on One Flower Kind Stops Staying and Eating There (Priority: P1)

In a world with two flower kinds, each giving off its own odour (A or B), eating from kind B is punished ("bitter").
At first a hungry fly stays at and eats from both kinds about equally. After a training period it leaves kind B
sooner and eats there less often, while it keeps staying at and eating from kind A.

**Why this priority**: The user expects learning to show in stay/leave and eat/not-eat decisions rather than in
turning, because steering is mainly klinotaxis and a valence gain in [0.5, 1.5] bends paths only a little. These two
decisions are the behaviour this feature must change, and they are where the acceptance is measured.

**Independent Test**: Run the behaviour experiment on held-out seeds with all four arms. For each arm, measure for
each flower kind the time a fly stays in the flower's area per visit and the fraction of visits that end in eating,
in a test period before training and in one after training.

**Acceptance Scenarios**:

1. **Given** a naive hungry fly, **When** it visits both flower kinds in the pre-training test, **Then** its stay
   time and eat fraction at A and B do not differ beyond the arm's own seed-to-seed spread.
2. **Given** the fly has trained with B punished, **When** it visits both kinds in the post-training test, **Then**
   its eat fraction at B falls and its stay time at B shortens, and both measures at A do not fall by the same
   amount.
3. **Given** the frozen, dopamine-shuffled and random-graph arms run the same schedule, **When** their results are
   reported next to the plastic arm, **Then** a change that also appears in a null arm is stated in the results, not
   hidden.
4. **Given** the reversed schedule (A punished, B neutral), **When** the experiment runs, **Then** the effect
   follows the punished odour, not the flower kind's position or its odour identity.

---

### User Story 4 - A Fly Rewarded on One Flower Kind Prefers It (Priority: P2)

With eating rewarded on both kinds as usual but with odour A's flowers being the only ones the fly has eaten from
during training, the fly later stays longer at A and eats there more readily than at B.

**Why this priority**: Reward is the other half of D34. It is less striking than punishment in a world where eating
is already the default, so it ranks below Story 3.

**Independent Test**: Training phase with only kind A available, then a test phase with both kinds. Compare stay
time and eat fraction at A and B in plastic and frozen arms.

**Acceptance Scenarios**:

1. **Given** training on A only, **When** the test phase offers both kinds, **Then** the plastic arm's stay time or
   eat fraction at A exceeds that at B by more than the frozen arm's difference.

---

### User Story 5 - The Panel Shows What the Fly Has Learned (Priority: P2)

A visitor watching the demo can see, for each fly, the learned valence of each food odour, the current dopamine
drive (reward and punishment), and the mean state of the modified synapses per MBON group. The panel labels these as
learned, next to the declared valence, and marks any teaching signal that was injected rather than produced by the
connectome.

**Why this priority**: The constitution requires plasticity to be visible in telemetry, and the demo claim is only
honest if a viewer can see what is learned versus declared versus injected.

**Independent Test**: Load a world with learning on, feed a fly at kind B (punished), and check that the panel's
learned valence for B moves and that injected teaching signals are labelled.

**Acceptance Scenarios**:

1. **Given** learning on, **When** the panel is open, **Then** it shows per-odour learned valence, dopamine drive per
   teaching pool, and mean synapse modifier per MBON group.
2. **Given** learning off, **When** the panel is open, **Then** the learned values are shown as off, not as neutral
   numbers that look learned.

---

### User Story 6 - Everything That Worked Before Still Works With Learning Off (Priority: P1)

All existing brains (mock, v0, v1, v2, v3) and their worlds load and behave exactly as before. With learning off,
the LIF core gives the same spikes as today, bit for bit.

**Why this priority**: Principle V and the AGENTS rules require new mechanisms to be off by default and old brains
to keep working. A regression here blocks the feature regardless of learning results.

**Independent Test**: Run the existing test suites, the LIF golden test, and a new golden test comparing plasticity
off against the current core. Load each existing world in the browser.

**Acceptance Scenarios**:

1. **Given** plasticity is off, **When** any snapshot runs with a fixed seed, **Then** the spike sequence is
   identical to the current LIF core's.
2. **Given** the demo world with learning off, **When** ADR 010 Part K is re-run, **Then** its results are unchanged.

---

### Edge Cases

- **Odour glomeruli overlap.** If the two declared odour sets share any glomerulus or receptor neuron, extraction or
  world loading fails with a named error instead of running with a shared input.
- **A declared neuron group is empty.** If the snapshot has no neurons for a declared KC, PAM, PPL1 or MBON group,
  loading fails with a named error; there is no fallback to a scripted signal.
- **An MBON type has no valence citation.** An MBON type with no declared approach/avoid role and no literature
  citation is left out of the learned-valence readout and listed in the probe report.
- **Tonic dopamine.** DAN pools fire at rest. Without a baseline and threshold this counts as constant reward or
  punishment; the rule must ignore it (Story 2, scenario 6).
- **Odour or taste alone evokes PPL1.** Punishment that the stimulus itself causes, independent of any bad outcome,
  must not teach avoidance of every odour; the baseline-and-threshold rule handles it, and the probe reports it.
- **The connectome does not carry the teaching signal.** If eating (taste plus hunger) does not drive PAM, or escape
  and heat contact do not drive PPL1, through the brain, a declared, labelled reinforcement input is used instead.
- **Synapse modifier saturates.** Modified weights stay within their declared bounds no matter how long training
  runs; the learned valence stays within [0.5, 1.5].
- **Both odours present at once.** When a fly smells A and B together, the learned valence reflects the mixture as
  the MBONs respond to it; no rule picks one odour.
- **Very long runs.** Without further pairing, learned effects decay; they do not drift.
- **Escape triggered by a false alarm.** A false escape (ADR 010 A5) is also punishment under D34; its rate is
  reported so its effect on learning can be judged.

## Requirements *(mandatory)*

### Functional Requirements

**Governance**

- **FR-001**: The project MUST record a decision (ADR 011) that defines the plasticity rule, its parameters and
  bounds, the regime gate result, the neuron-group declarations and the teaching-signal sources, before learning
  code lands. Principle V already allows online plasticity where a decision record defines it; the amendment covers
  only what is not yet allowed.
- **FR-002**: The constitution MUST be amended so a declared valence may be modulated by learning: the declared sign
  of each sense stays, and learning may only scale its strength within declared bounds. The panel and README MUST
  then show valence as "declared, learned gain" when learning is on. This is the one constitution change this
  feature makes (Principle VI wording; Principle V is clarified only if the review finds its current bullet
  insufficient).

**Two food odours**

- **FR-003**: The world MUST support two food odours, A and B, each tied to its own flower kind and its own sensory
  input pair, with non-overlapping glomerulus sets declared in data. Defaults: A = "fruit/ferment" (DM1, DM2, DM4);
  B = "floral/sweet" (VA2, DP1m, VM5d).
- **FR-004**: The snapshot extraction for the two odours MUST be driven by configuration only and stay reproducible
  (byte-identical apart from creation time). Overlap between the two sets MUST fail with a named error.
- **FR-005**: Existing worlds with one food odour MUST keep loading and behave as before.

**Regime gate**

- **FR-006**: A brain-only regime probe MUST measure, per odour and on calibration seeds only: the fraction of KCs
  active, the trial-to-trial correlation of the KC code, and the correlation between the two odours' KC codes. Pass
  targets: 5–15 % active, above 0.85 same-odour, below 0.7 between odours. (Amended 2026-10-20 from 0.9, ADR 011
  D41: the original value had no derivation, and was relaxed after measurement, which D41 records.)
- **FR-007**: If the gate fails because the brain is saturated, the only allowed remedy is a declared feed-forward
  pathway gain: a named LIF parameter that scales excitatory edges from their canonical sources onto `ALPN` and
  `Kenyon_Cell` (receptor→projection neuron, projection neuron→KC) relative to other excitatory inputs. Weights still
  come from the dataset; the parameter is off (neutral) by default. (Amended 2026-10-20, ADR 011 D40: gains below 1
  are allowed, a route may select by dataset `type` as well as `class`, and the learning world may set its own
  existing global LIF parameters (`synapticScale`, `baselineCurrent`, `tauSyn`), calibrated on calibration seeds and
  recorded in the ADR.)
- **FR-008**: Learning code MUST NOT be written until the gate passes. A gate that fails after the remedy MUST be
  recorded as a finding and ends the feature at that point.

**Neuron groups (config, not code)**

- **FR-009**: KCs, reward DANs (PAM types), punishment DANs (PPL1 types) and MBONs MUST be selected by declared rules
  on dataset identity (`class`, `type`), not by code.
- **FR-010**: Each MBON type used for learned valence MUST carry a declared role (approach or avoid) with a
  literature citation. The role MUST NOT be inferred from transmitter alone.

**Plasticity**

- **FR-011**: The LIF core MUST support a plasticity option, off by default, that applies a per-edge modifier only on
  KC→MBON edges. Snapshot weights never change; the modifier stays within declared bounds [wMin, 1].
- **FR-012**: The rule MUST be three-factor: a KC eligibility trace (τ about 400 steps), times a dopamine drive per
  teaching pool. Dopamine drive MUST be the pool's rate above its running baseline, minus a threshold, so tonic and
  stimulus-evoked background dopamine teach nothing.
- **FR-013**: Reward MUST depress KC→avoid-MBON edges of the active KCs; punishment MUST depress KC→approach-MBON
  edges of the active KCs. Modifiers MUST recover slowly towards 1 at a declared forgetting rate.
- **FR-014**: With plasticity on, the same snapshot, parameters, inputs and seed MUST give the same spikes. With it
  off, the core MUST match the current core bit for bit, checked by a golden test.
- **FR-015**: Every plasticity parameter MUST be named, documented, validated and declared in the world config.

**Teaching signals**

- **FR-016**: Before any teaching input is declared, a brain-only probe MUST measure whether eating (mouth taste plus
  hunger) drives PAM, and whether escape, heat contact and bitter taste drive PPL1, through the connectome.
- **FR-017**: Where the connectome carries the signal, it MUST be used as it is. Where it does not, a declared input
  channel (`reinforcement-reward`, `reinforcement-punish`) targeting the DAN group MAY be added, driven by the world
  event (eating, escape, heat contact, eating a punished flower), and MUST be labelled as injected in the panel and
  in results.

**Learned valence and decisions**

- **FR-018**: The learned valence of each odour MUST be read from the MBON groups (approach versus avoid activity
  while that odour is present), mapped into [0.5, 1.5] and multiplied onto the declared valence `v_p` of that odour
  pair. The sign never flips.
- **FR-019**: The learned valence MUST be able to change the stay/leave and eat/not-eat decisions, network first:
  a brain-only probe MUST first measure whether learning moves the decoded `feed` and `forward` pools through the
  connectome (MBON output reaching them). If that shift is too weak to change the decisions, a declared decoder rule
  MAY be switched on that applies the learned valence to the feed decision and to the walking speed near food. The
  probe result and the choice MUST be recorded in ADR 011, and results MUST say which path carried the effect.
- **FR-020**: Any decoder rule that uses learned valence MUST be declared in data, read only decoded brain signals,
  and run identically in every arm (plastic, frozen, dopamine-shuffled, random graph).

**Telemetry and panel**

- **FR-021**: Telemetry MUST expose per-odour learned valence, dopamine drive per teaching pool, and mean modifier
  per MBON group.
- **FR-022**: The panel MUST show these values labelled as learned, show "off" when learning is off, and mark
  injected teaching signals.

**Experiments and acceptance**

- **FR-023**: Every experiment MUST run four arms: plastic, frozen, dopamine-shuffled and matched random graph, with
  the same body layer and decoder rules. All four MUST be reported.
- **FR-024**: Tuning MUST use calibration seeds only; verdicts MUST use held-out seeds only.
- **FR-025**: The conditioning probe (Story 2) and the behaviour experiment (Stories 3 and 4) MUST be runnable from
  the command line without the browser, and write their results next to the spec.
- **FR-026**: The behaviour experiment MUST report, per arm, per flower kind, before and after training: stay time
  per visit, eat fraction per visit, visit count, and the decay of the effect over the forgetting time.
- **FR-027**: With learning off, the demo forager's ADR 010 Part K results MUST be unchanged.

### Key Entities

- **Odour set**: a named food odour (A or B) with its glomeruli, its sensory input pair, and the flower kind that
  emits it. Two sets never share a glomerulus.
- **Flower kind**: a food source type in the world with its odour, and an optional outcome on eating (normal,
  punished).
- **Neuron group**: a declared selection of neurons by dataset identity: KCs, reward DANs, punishment DANs, approach
  MBONs, avoid MBONs. MBON groups carry a citation per type.
- **Regime gate result**: per-odour KC active fraction, same-odour correlation, between-odour correlation, the
  settings and seeds used, pass or fail.
- **Plasticity parameters**: on/off, eligibility time constant, dopamine baseline time constant and threshold,
  learning rates, modifier bounds, forgetting rate.
- **Synapse modifier**: a per-edge value on KC→MBON edges in [wMin, 1], held by the fly's brain, starting at 1.
- **Teaching signal**: reward or punishment dopamine drive, from the connectome or from a labelled injected channel.
- **Learned valence**: per odour, in [0.5, 1.5], scaling that odour's declared valence.
- **Experiment arm**: plastic, frozen, dopamine-shuffled or random graph.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The regime gate result (pass or fail, with all three measures per odour) is recorded in ADR 011 before
  any learning code is merged.
- **SC-002**: In the conditioning probe on held-out seeds, the paired odour's valence shift is larger than the
  unpaired odour's in both the reward and the punishment direction, in at least 80 % of seeds, and the frozen and
  dopamine-shuffled arms do not show this in more than 20 % of seeds.
- **SC-003**: After training with flower kind B punished, the plastic arm's eat fraction at B falls by at least a
  third of its pre-training value, and its stay time per visit at B shortens, while its eat fraction at A falls by
  less than half as much (held-out seeds, 95 % confidence intervals reported).
- **SC-004**: The frozen arm shows no significant change in eat fraction or stay time at B between the pre- and
  post-training tests.
- **SC-005**: The learned effect on eat fraction at B falls by at least half within the configured forgetting time
  without further punishment.
- **SC-006**: With learning off, all existing test suites pass, the golden test shows identical spikes, every
  existing world loads, and the demo forager's Part K results are unchanged.
- **SC-007**: With learning on, the demo world runs 6 flies in the browser with no console errors and no visible drop
  in frame rate compared with learning off.
- **SC-008**: A viewer can tell from the panel alone, for any fly, which odour it has learned to avoid or prefer and
  whether its teaching signal was injected.

## Assumptions

- The demo forager (spec 017) and hunger-sensitive feeding (spec 018) are in place; this feature builds on the v3
  decoder, body layer and food depletion and does not change them with learning off.
- Constitution v2.1.0 Principle V already allows online plasticity under a decision record; "relaxing Principle V"
  therefore means writing ADR 011 and amending Principle VI's "declared, not learned" valence rule, not removing
  Principle V's determinism or off-by-default requirements.
- The 14.5K brain contains the whole mushroom body (ADR 006: 4,064 KCs, 97 MBONs, the DANs including PAM and PPL1
  types). No new neuron classes need to be extracted for learning, only a second odour's receptor neurons and their
  input pair.
- "Bitter" (punished) flowers are punished through a declared mechanism: bitter taste receptor neurons if the probe
  shows they drive PPL1, otherwise the labelled `reinforcement-punish` channel fired on eating that kind.
- The training and test periods are declared in the experiment configuration (default: a test period, a training
  period equal to one simulated day as the experiment defines it, then a second test period). There is no day/night
  cycle in the world today, and none is added.
- Turning is not expected to change much: klinotaxis dominates steering and the valence gain is bounded to
  [0.5, 1.5]. Path changes are reported but are not an acceptance criterion.
- Default MBON roles follow Aso et al. 2014 (glutamatergic MBONs mostly promote avoidance; cholinergic and GABAergic
  ones mostly approach), declared per type with the citation.
- The prior smallfly experiment (`learn_test.mjs`) is the template for the conditioning probe, and its finding that
  tonic dopamine taught avoidance of everything motivates the baseline-and-threshold rule.
- Out of scope: learning in any brain other than the 14.5K v3 brain; learning on synapses other than KC→MBON;
  learning danger or heat valence (R2 must hold on the first encounter, ADR 010 D34); changes to the worker protocol
  beyond added telemetry fields.
