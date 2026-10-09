# Feature Specification: Dynamical Regime for the Forager Brain

**Feature Branch**: `011-dynamical-regime`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "the brain requires dynamical regime. All four MUST be implemented in one step. Changing only one of these will look like a regression.

1. Weights are scaled far above threshold. With postFraction weights × 50, each edge behaves like an OR gate: activity spreads down every excitatory path until refractoriness caps it. That is the documented saturation, with forward/feed at about 0.985 of the rate ceiling. The calibration finding that only synapticScale=50 finds food fits this: below 50, signals die out within the 3–5 synapses from odour to the descending neurons; at 50, everything saturates. Without noise and a baseline, there is no in-between setting.

2. Normalising over the selected subgraph inflates truncated neurons. A neuron with 1,000 real input synapses, 20 of them from selected neurons, gets those 20 rescaled to the full input weight of 1. Leaving neurons out of the selection makes the remaining edges stronger instead of weaker. With absolute weights, missing inputs just mean less drive.

3. There is no noise and no heterogeneity, so pools fire in lockstep. Every neuron in a pool gets identical drive from an identical start state, so the 131 ORNs on one side fire on the same step, and each pool acts like one huge neuron. Combined with issue 1, the network is effectively a deterministic binary cascade, which also helps explain why calibration-seed wins don't hold on held-out seeds.

4. Sensory coding saturates. The input pools get resting 0.2 × hunger gain [0.5, 1.5] = 0.1–0.3 per step. With V∞ = τ·I = 2–6, ORNs fire tonically even with no fruit around. The firing rate reaches the 1/3 ceiling at I ≈ 1, so the whole odour gradient is squeezed into roughly three rate levels: about 0.19 at I=0.1, 0.5 at 0.3, and 1.0 at 1. In reallity, no odour means a noise-driven state below threshold, and odour raises it in a graded way."

**Governing decisions**: [ADR 003 (hungry forager brain)](../../adrs/003-hungry-forager-brain.md) and [ADR 004 (output pool synaptic scale)](../../adrs/004-output-pool-synaptic-scale.md) define the forager brain and its current calibration. `specs/008-hungry-forager-brain/calibration.md` records the saturation and the "only synapticScale=50 finds food" finding this feature replaces. This spec states what a correctly-behaving brain looks like and how that is checked; the governing decisions and a follow-on plan state how the regime is built.

## Why this is one feature, not four

The four changes below are coupled: each one on its own reproduces, or does not fix, the saturation documented in
`calibration.md`. Scaling weights down without absolute weights and without noise just moves the all-or-nothing
cascade to a different scale. Adding noise to a network that is still normalised and still runs at a saturating
scale does not stop pools firing in lockstep, because the drive dominates the noise. Fixing sensory coding alone
leaves the descending pathway saturated regardless of how graded the input is. A change that implements only one
of the four, or reports success without the others, is a regression against this spec, not a partial delivery of
it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Stronger Smell Produces a Stronger Response (Priority: P1)

Today, a fly's forward and feed drives sit at about 98.5% of their maximum no matter how strong or weak the odour
is — the network behaves like a cascade of OR gates that either stays silent or lights up completely. Under the new
regime, a visitor watching the fly's telemetry sees forward/feed activity track the odour's strength: faint odour
produces a modest response, strong odour (close to food) produces a stronger one, and neither sits pinned at the
ceiling for ordinary stimuli.

**Why this priority**: Without headroom below the firing ceiling, no other change in this feature can show up in the
fly's behaviour — the descending pathway is already maxed out, so nothing downstream can look graded.

**Independent Test**: Run the forager brain on a seeded fly approaching food from a distance and record forward/feed
activity against the fly's distance to food. Confirm the recorded activity rises as distance falls, and that it does
not sit within a few percent of the maximum for most of the approach.

**Acceptance Scenarios**:

1. **Given** a fly far from any food with only background odour, **When** it is simulated for a run, **Then** its
   forward/feed activity stays measurably below the firing-rate ceiling, not pinned near maximum.
2. **Given** two flies at different distances from the same food source, **When** both are simulated under the same
   seed, **Then** the closer fly shows higher forward/feed activity than the farther one.
3. **Given** the calibrated dynamical parameters, **When** the odour signal is removed from a synapse path (a
   regression check, not normal operation), **Then** downstream activity drops, rather than being unaffected because
   every path already saturates.

---

### User Story 2 - A Missing Neuron Means Less Drive, Never More (Priority: P1)

Today, a neuron with most of its real inputs excluded from the extracted brain still receives full-strength drive,
because its selected inputs are rescaled to add up to the same total weight as a fully-connected neuron would have.
Under the new regime, a researcher who extracts two brains from the same dataset — one with a neuron included in the
selection, one with it excluded — sees that excluding it only ever removes or weakens the downstream drive it
contributed; the remaining real connections are not inflated to compensate.

**Why this priority**: As long as the extractor rescales weights up to fill a fixed budget, no choice of neurons to
include is ever "too few" from the simulated neuron's point of view, which silently invalidates every selection and
pruning decision made during extraction.

**Independent Test**: Extract the same brain configuration twice, once with an additional upstream neuron excluded
from selection, and compare the resulting edge weights into the shared downstream neurons. Confirm the remaining
weights are unchanged or smaller, never larger, than in the run that included the extra neuron.

**Acceptance Scenarios**:

1. **Given** a neuron with some of its real synaptic inputs outside the selected set, **When** its brain snapshot is
   built, **Then** its modeled total input weight reflects only the selected, real connections at their real
   strength, not a rescaled total.
2. **Given** two extraction runs that differ only in whether one upstream neuron is included, **When** their
   snapshots are compared, **Then** the downstream neuron's remaining edge weights are identical or smaller in the
   run that excludes it — never larger.
3. **Given** the same extraction configuration and dataset run twice, **When** the resulting snapshots are compared,
   **Then** they are byte-identical apart from their recorded creation time.

---

### User Story 3 - A Pool of Neurons Behaves Like a Population, Not One Neuron (Priority: P1)

Today, every neuron in a sensory pool (for example, the roughly 131 olfactory neurons on one side) receives identical
drive from an identical starting state, so the whole pool spikes on the same simulated step, as if it were a single
large neuron. Under the new regime, an observer inspecting per-neuron spike telemetry for one pool, under one
constant stimulus, sees individual neurons spike on different steps from one another, and the pool's activity reads
as a graded fraction of active neurons rather than an all-or-nothing flip.

**Why this priority**: A network that only ever flips pools fully on or fully off cannot encode a graded signal, no
matter how graded the sensory input or how much headroom the weights leave — and it is also why a setting that
"wins" on the handful of calibration seeds does not generalise to held-out seeds: there is effectively only one
random draw per pool, not one per neuron.

**Independent Test**: Drive one sensory pool with a constant, identical stimulus across all its neurons for a seeded
run and record each neuron's spike times. Confirm that not all neurons in the pool spike on the same step, and that
repeating the run with the same seed reproduces the same per-neuron spike pattern.

**Acceptance Scenarios**:

1. **Given** a pool of neurons receiving the same constant input, **When** the run is simulated, **Then** the
   fraction of steps on which every neuron in the pool spikes together is small, not effectively 100%.
2. **Given** the same seed, stimulus and parameters run twice, **When** the per-neuron spike trains are compared,
   **Then** they are identical — the added variability is reproducible, not merely random.
3. **Given** a dynamical parameter setting chosen using the calibration seeds, **When** it is re-evaluated on the
   held-out seeds, **Then** its find-food and eat-food rates on held-out seeds are close to what was seen on the
   calibration seeds, not a setting that only works on the seeds it was chosen with.

---

### User Story 4 - No Smell Means Quiet, Not Constant Firing (Priority: P1)

Today, an odour-sensing neuron fires tonically even with no food anywhere nearby, because its resting input alone
drives its membrane above the firing threshold; as odour strengthens, the firing rate only has room to move through
about three distinguishable levels before it saturates. Under the new regime, a visitor watching an odour-sensing
neuron with no food nearby sees it sit in a quiet, intermittent state below its firing threshold, with only
occasional, noise-driven spikes — and as the fly nears food, sees that neuron's activity rise smoothly through many
distinguishable levels rather than jumping between a few fixed steps.

**Why this priority**: As long as "no odour" already produces strong, sustained firing, the fly cannot distinguish
faint from absent odour, and the gradient the world provides is wasted before it reaches the rest of the network.

**Independent Test**: Simulate an odour-sensing neuron at several fixed, representative odour intensities, from none
to strong, and record its firing rate at each. Confirm the no-odour condition produces a low, non-sustained firing
rate, and that firing rate increases across more intensities than the current three effective levels.

**Acceptance Scenarios**:

1. **Given** no odour is present, **When** an odour-sensing neuron is simulated for a run, **Then** its average
   firing rate is low and driven by noise, not sustained tonic firing.
2. **Given** a sequence of increasing odour intensities, **When** the same neuron is simulated at each, **Then** its
   firing rate increases monotonically and passes through more distinguishable levels than today's three.
3. **Given** the strongest odour intensity the fly can experience, **When** the neuron is simulated, **Then** its
   firing rate is clearly higher than at a mid-range intensity, i.e. it has not already saturated before reaching the
   strongest realistic stimulus.

---

### Edge Cases

- What happens to the existing mock and v0 (small) brains, and to any v1 brain/world that does not opt into the new
  parameters? They MUST keep loading and behaving exactly as before — the new mechanisms are additions, not changes
  to what already ships unconfigured.
- What happens when the new noise source has no sensory input to react to at all? Background, noise-only firing MUST
  stay low and bounded, not grow into runaway or tonic activity.
- What happens at the strongest possible odour intensity (the fly standing on food)? The sensory response MUST still
  be clearly distinguishable from mid-range intensity, i.e. it must not re-introduce an early ceiling at the top of
  the range.
- What happens when the brain, world, or extraction configuration sets every new parameter to its inert default (no
  noise, no heterogeneity, unchanged weight rule)? The simulation MUST reproduce today's bit-exact behaviour, per the
  existing golden tests.
- What happens to the random-walk and size-matched random-graph comparison arms used in prior calibration? They MUST
  be re-run under the same regime change so the forager brain is still compared against null arms on equal footing.
- What happens if only some of the four changes can be made to work together before a deadline? Per "Why this is one
  feature, not four" above, that MUST be reported as incomplete, not as a partial success.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each modeled synaptic edge's weight MUST be derived from the dataset's real synapse count as an
  absolute quantity. A neuron's total modeled input MUST NOT be rescaled to sum to a fixed budget regardless of how
  many of its real inputs are included in the selection.
- **FR-002**: Excluding a neuron from the selected set MUST only ever decrease or leave unchanged the modeled drive
  reaching the neurons it fed. It MUST NOT increase the weight of the remaining, still-selected edges into those
  neurons to compensate for the exclusion.
- **FR-003**: The synaptic scale and the other dynamical parameters governing signal propagation MUST be set so
  that, for stimuli within the fly's normal operating range, activity on the principal sensing-to-motor pathway does
  not sit at or near the firing-rate ceiling; a stronger stimulus MUST produce measurably more downstream activity
  than a weaker one.
- **FR-004**: Neuron dynamics MUST include a source of per-neuron variability (noise, heterogeneous state, or both)
  sufficient that neurons in the same pool, given identical external input, do not all spike on the same simulated
  step.
- **FR-005**: The variability introduced by FR-004 MUST be fully determined by the simulation's random seed: the
  same seed, inputs and parameters MUST always reproduce the same sequence of per-neuron spikes.
- **FR-006**: Sensory input encoding MUST represent "no stimulus" as a quiet, below-threshold, noise-driven state,
  with no sustained tonic firing when no odour or taste is present.
- **FR-007**: Sensory input encoding MUST increase in a graded fashion as stimulus intensity rises across its
  working range, producing more distinguishable firing-rate levels between quiet and saturated than today's three.
- **FR-008**: The four changes described by FR-001 through FR-007 MUST be delivered and calibrated together. A state
  that implements only some of them MUST NOT be reported or shipped as a completed increment of this feature.
- **FR-009**: The forager brain and world previously calibrated under the old regime MUST be re-calibrated under the
  new one, and the chosen operating point MUST be validated on held-out seeds — not only on the calibration seeds —
  before it is adopted as the shipped default.
- **FR-010**: Any brain or world configuration that does not opt into the new noise, heterogeneity or weight-rule
  parameters MUST continue to load and simulate exactly as it does today.
- **FR-011**: Building the same brain snapshot from the same extraction configuration and dataset, under the new
  weight rule, MUST still produce a byte-identical snapshot, aside from its recorded creation time.

### Key Entities *(include if feature involves data)*

- **Brain Snapshot**: the extracted connectome used by the simulation; under this feature its edge weights are
  absolute values derived from real synapse counts rather than values rescaled to a per-neuron budget over the
  selected subgraph.
- **Neuron Pool**: a group of neurons sharing a sensory or output role (for example, one side's odour-sensing
  neurons). Pools are expected to show within-pool variability in response to identical input, rather than firing in
  lockstep.
- **Dynamical Parameter Set**: the coupled group of settings that define the regime — synaptic scale, the noise and
  heterogeneity parameters, and the sensory resting/gain curve — chosen together during calibration and recorded
  with the run that chose them, in the same spirit as the existing calibration record.
- **Calibration Seed / Held-out Seed**: the two seed groups already used to choose, then verify, dynamical
  parameters; this feature's recalibration MUST use both, per existing practice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no food within sensing range, odour-sensing neurons fire at a small fraction of their firing-rate
  ceiling on average (well below today's roughly 19% at the lowest measured intensity), consistent with a quiet,
  noise-driven resting state.
- **SC-002**: Across the odour intensity range the fly can experience, measured firing rate passes through at least
  five clearly distinguishable levels between quiet and saturated, compared to today's three.
- **SC-003**: On the principal sensing-to-motor pathway, peak sustained activity for a representative stimulus stays
  well below today's roughly 98.5% of the firing-rate ceiling, and a stronger stimulus produces measurably higher
  activity than a weaker one.
- **SC-004**: Within a single sensory pool driven by identical input, the share of simulated steps on which every
  neuron in the pool spikes together drops to near zero, down from today's effectively all of them.
- **SC-005**: A dynamical parameter setting's find-food and eat-food rates, measured on held-out seeds, land close to
  its rates on the calibration seeds it was chosen with, rather than today's pattern where calibration-seed wins do
  not hold on held-out seeds.
- **SC-006**: Across the shipped extraction configurations, excluding a neuron from the selected set never increases
  the modeled drive on the neurons it used to feed, verified by comparing snapshots built with and without that
  neuron.

## Assumptions

- The mapping from real synapse counts to a modeled absolute weight introduces a scale constant; like every other
  dynamical parameter in this project, it is named, documented and validated rather than hard-coded, and its value
  is set during calibration, not fixed in advance by this spec.
- "Noise" and "heterogeneity" build on the project's existing per-neuron variability and seeded-randomness machinery
  rather than introducing an unrelated, undocumented source of randomness.
- Re-calibration under the new regime targets the already-shipped forager brain and world; it does not require a new
  extraction selection, a new set of input/output pools, or a new brain topology beyond what fixing the weight rule
  requires.
- The specific numeric targets in the Success Criteria above (for example, "a small fraction," "at least five
  levels," "well below 98.5%") are starting targets for the calibration that follows this spec, to be confirmed or
  tightened with evidence, the same way `specs/008-hungry-forager-brain/calibration.md` refined its own targets
  empirically rather than fixing them upfront.
- "Below threshold" sensory coding at rest means the resting drive keeps the membrane potential under its firing
  threshold on average, with only occasional noise-driven excursions above it, replacing today's steady-state
  above-threshold resting condition.
- The random-walk and size-matched random-graph comparison arms from prior calibration remain the baselines this
  feature is checked against, re-run under the same regime so the comparison stays like-for-like.
