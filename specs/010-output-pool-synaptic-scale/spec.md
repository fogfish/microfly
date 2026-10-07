# Feature Specification: Output-pool synaptic scale (`outputScale`)

**Feature Branch**: `010-output-pool-synaptic-scale`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "ADR 004-output-pool-synaptic-scale.md defines the solution to define own control knobs at LIF for un-pin `forward` and `feed` from the firing ceiling. Study it and create a specification."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A brain's output pools can be scaled independently of its interneuron bulk (Priority: P1)

A researcher calibrating a forager brain needs `forward` and `feed` (the fly's motor and feeding outputs) to respond gradedly to sensory input, instead of sitting pinned near the firing ceiling regardless of what the fly senses. Today one global multiplier (`synapticScale`) applies to every synapse in the network; a value large enough to drive the two small, concentrated-fan-in output pools across their firing threshold also drives the much larger recurrent interneuron population into permanent saturation, and the outputs inherit that saturation. The researcher needs a second knob that scales only the synapses landing on declared output neurons, so the interneuron bulk and the output pools can each be tuned to their own operating point.

**Why this priority**: This is the only story in the feature — it is the mechanism ADR 004 defines. Without it, `forward` and `feed` cannot be un-pinned, and the open calibration question from `008-hungry-forager-brain/BUG-002` (the forager finds food but never slows down to eat it) cannot even be investigated, let alone fixed. (Not to be confused with this feature's own `BUG-002`, reported after this spec was first written — see FR-010–FR-012 below.)

**Independent Test**: Can be fully tested by configuring a brain with a distinct output-pool scale and a distinct general synaptic scale, running the LIF simulation, and confirming that the output pool's firing rate changes with its own scale while the rest of the network's firing rate tracks the general scale.

**Acceptance Scenarios**:

1. **Given** a brain configuration that leaves the new output-pool scale unset, **When** the simulation runs, **Then** every synapse is scaled identically to how it is scaled today — the new knob has no observable effect and existing brains and worlds produce unchanged results.
2. **Given** a brain configuration that sets the output-pool scale to a value lower than the general synaptic scale, **When** a presynaptic neuron drives both an output neuron and a non-output neuron with equal-weight synapses, **Then** the output neuron's resulting activity is measurably lower than the non-output neuron's, in proportion to the two scales.
3. **Given** a brain configuration that sets the output-pool scale to an invalid value (negative or non-numeric), **When** the configuration is loaded, **Then** the system refuses to run and reports which setting is invalid and why.
4. **Given** a brain snapshot that declares no output neurons (or declares them but the new scale is left unset), **When** the simulation runs, **Then** behavior is identical to a brain without this feature at all.
5. **Given** a brain configuration that sets the output-pool scale to different values for two different declared output channels, **When** a presynaptic neuron drives a neuron in each of the two channels with equal-weight synapses, **Then** each channel's targeted neuron is scaled by its own channel's value, independently of the other channel's value, and a third channel left out of the configuration uses the general synaptic scale (BUG-002).

### Edge Cases

- A brain snapshot declares an empty output-neuron list: the new scale has nothing to apply to and must behave as a no-op regardless of its value.
- A neuron appears in more than one declared output channel (e.g. shared between `forward` and `feed` groupings): it must still be scaled exactly once by the output-pool scale, not multiple times or skipped. When the channels it belongs to carry different per-channel scales (FR-010), the scale actually applied MUST be chosen deterministically — the first of its channels, in the snapshot's own declared channel order, that carries an explicit scale (BUG-002).
- The output-pool scale is set to zero: output synapses deliver no potential at all, which is a valid (if extreme) calibration point and must not be rejected as invalid.
- The output-pool scale is set equal to the general synaptic scale: behavior must be indistinguishable from leaving it unset, aside from the explicit value being recorded.
- Older brain formats or simulation modes that predate output-role declarations must continue to run unaffected, with the new scale simply never engaging.
- A per-channel scale configuration (FR-010) names a channel id that the brain's capabilities do not declare: this MUST be treated the same as any other invalid setting (FR-011) — rejected before the simulation runs, naming the unknown channel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The simulation MUST support an independent scale for synapses whose target neuron is declared as an output neuron, distinct from the general synaptic scale applied to all other synapses.
- **FR-002**: The output-pool scale MUST default to "unset," and while unset, every synapse — output-targeted or not — MUST be scaled identically to current behavior, with no measurable difference in simulation results.
- **FR-003**: When the output-pool scale is set to a specific value, only synapses targeting a declared output neuron MUST use that value; all other synapses MUST continue to use the general synaptic scale.
- **FR-004**: The set of "declared output neurons" MUST be derived from the brain's own declared output channels (the same classification already used to identify which neurons represent `forward`, `feed`, and the other motor/behavioral outputs), not hand-selected or hard-coded per brain.
- **FR-005**: The system MUST validate the output-pool scale: it is accepted only when unset or when a finite number of zero or greater; any other value (negative, non-numeric, non-finite) MUST be rejected before the simulation runs, with a message naming the offending setting.
- **FR-006**: A brain or world configuration that declares no output neurons, or that leaves the output-pool scale unset, MUST produce simulation results identical to today's behavior.
- **FR-007**: The mechanism MUST be defined generically (by neuron role membership), not by referencing specific named outputs like "forward" or "feed," so it can be reused by any current or future brain that declares output channels.
- **FR-008**: Configuration surfaces that already expose the general synaptic scale (world/brain configuration files) MUST be extended to accept the new output-pool scale using the same validation and omission rules as other tunable simulation parameters.
- **FR-009**: Existing brains, worlds, and simulation-core behavior that predate this feature MUST continue to load and run unchanged when the new scale is not configured.
- **FR-010**: The output-pool scale MUST also be settable per declared output channel (keyed by the channel's own id), in addition to the single shared value of FR-001–FR-003: when configured this way, synapses targeting a given channel's neurons use that channel's own scale, and a declared output channel with no entry in the per-channel configuration MUST fall back to the general synaptic scale — not to any other channel's value, and not to a separate "all outputs" value (BUG-002).
- **FR-011**: Validation (FR-005) MUST extend to the per-channel form: every entry MUST independently be a finite number of zero or greater, and a per-channel configuration that names a channel id the brain's own declared output channels do not contain MUST be rejected before the simulation runs — in both cases the error MUST name the offending channel id.
- **FR-012**: When a neuron belongs to more than one declared output channel and those channels carry different per-channel scales, the scale actually delivered to that neuron MUST be chosen deterministically: the first of its channels, in the brain's own declared output-channel order, that carries an explicit per-channel scale.

### Key Entities

- **Output-pool scale**: A calibration setting applied to synapses that target a declared output neuron, independent of the general synaptic scale applied to the rest of the network — either one shared value for every output channel (as originally shipped), or a per-channel value keyed by output-channel id (FR-010, BUG-002). Unset by default, at both the shared and the per-channel level.
- **Declared output neuron**: A neuron already classified by the brain snapshot as belonging to an output channel (e.g. a motor or feeding readout). This feature consumes that existing classification; it does not introduce a new way of declaring outputs.
- **General synaptic scale**: The existing, network-wide synapse scaling setting that this feature leaves untouched for every synapse not targeting a declared output neuron, and that a per-channel configuration falls back to for any channel it does not name (FR-010).

**Bugfix**: 2026-10-07 — BUG-002 Added FR-010 to FR-012. One shared `outputScale` for every output channel could not
satisfy both `forward` (needed a lower scale to stop saturating) and `feed` (could not tolerate the same cut without
falling below its firing threshold) at once, confirmed on the live world. The output-pool scale must be settable per
channel, with validation and a deterministic resolution rule for neurons shared between channels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the output-pool scale left unset, 100% of existing simulation runs (brains and worlds already in use) produce results indistinguishable from before this feature existed.
- **SC-002**: Given a configuration with a lower output-pool scale than the general scale, the measured activity of output-classified neurons drops relative to an otherwise-identical run with the output-pool scale unset, while the activity of non-output neurons remains unchanged between the two runs.
- **SC-003**: An invalid output-pool scale is caught and reported before a single simulation step runs, with 0% of invalid configurations silently producing a running (but wrong) simulation.
- **SC-004**: A researcher can, within a single configuration change (no code edit), independently search for a general scale and an output-pool scale that keep the recurrent network below saturation while still letting output neurons cross their firing threshold — the search a single global scale cannot satisfy today.
- **SC-005**: Adding this capability introduces no measurable slowdown to simulation throughput beyond what is attributable to one additional comparison per synapse delivery.
- **SC-006**: Given two declared output channels configured with different per-channel scales, the measured activity of each channel changes according to its own configured scale, independent of the other channel's scale and independent of the shared/general scale (BUG-002).
- **SC-007**: An invalid per-channel scale entry (negative, non-numeric, or naming an undeclared channel id) is caught and reported before a single simulation step runs, with 0% of such configurations silently producing a running (but wrong) simulation (FR-011).

**Bugfix**: 2026-10-07 — BUG-002 Added SC-006 and SC-007 for the per-channel scale (FR-010–FR-012).

## Assumptions

- This feature only removes the structural reason output pools are pinned to the firing ceiling; it does not add any new pathway, inhibitory or otherwise, to make an output neuron respond to a specific stimulus (e.g. a "stop on food" brake). That remains separate, future work.
- "Declared output neuron" means whatever a brain snapshot already marks as belonging to an output channel; this feature does not change how that marking is produced during brain extraction.
- ~~All output channels share one scale in this feature (per the ADR's own scoping decision). Giving individual
  output channels (e.g. `forward` vs. `feed`) their own independent scales is explicitly out of scope and left as
  potential follow-on work.~~ **Superseded (BUG-002, 2026-10-07)**: the live world showed one shared scale cannot
  satisfy both `forward` and `feed` at once (ADR 004's own "Open questions" flagged this exact risk). Per-channel
  scales are now in scope — see FR-010–FR-012.
- Re-tuning any brain's calibrated values to take advantage of the new scale is a separate activity from building the mechanism itself, and is out of scope for this specification — this spec covers only the capability to set and validate the new scale, not any specific new calibrated values.
- Connecting an inhibitory pathway between sensory input and the output pools (the "brake" question left open by a prior bug investigation) is explicitly out of scope here and remains a separate, future piece of work.
