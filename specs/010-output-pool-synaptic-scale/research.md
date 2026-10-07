# Phase 0 Research: Output-pool synaptic scale (`outputScale`)

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the ADR already fixes the design down to the
line-level diff, so this phase records the decisions already made in [ADR 004](../../adrs/004-output-pool-synaptic-scale.md)
and the alternatives it rejected, rather than opening new unknowns.

## Decision: a second global scale, gated by a per-neuron output mask

**Decision**: Add `outputScale` (default `null`) to `LIF_V1_DEFAULTS`. In `step`, the scale applied to a spike's
contribution to a target neuron is `outputScale` when the target is in a caller-supplied output set and
`outputScale` is not `null`; otherwise it is `synapticScale`, unchanged. The output set is built once per network
as `outputMask = new Uint8Array(n)` from `graph.outputNeurons` (a flat array of neuron indices), not recomputed
per step.

**Rationale**: ADR 004's own measurement (Annex A.2) shows a parameter sweep over the *existing* knobs
(`synapticScale` × `tauAdapt` × `adaptStep`, 16 settings) cannot un-pin `forward`/`feed` — `far-forward` stays at
0.981–0.99 everywhere in the grid, because one global multiplier structurally cannot both keep a 2,466-neuron
recurrent bulk below saturation and drag a 2-neuron, 193–206-in-edge, no-population-averaging readout across
threshold. The two pools need their own multiplier. A per-neuron mask built once at network-construction time
(not evaluated per step with a lookup into a different structure) keeps the hot loop's added cost to one branch
per edge delivery, no new allocation per step — matching the existing cost discipline of `tauSyn`/`tauAdapt`
(ADR 003 L1/L2), which also gate behavior behind a single `if` using state set up once in `createNetwork`.

**Alternatives considered**:
- *Keep sweeping `synapticScale`/`tauAdapt`/`adaptStep` only.* Rejected — ADR 004 Annex A.2/A.3 shows this
  directly: the one calibration-seed candidate that looked promising (`tauAdapt: 40`) reversed two hunger-linked
  gates on held-out seeds. No further grid search over the existing three parameters can work, because the
  structural problem (one multiplier, two very different pool geometries) isn't addressed by any point in that
  space.
- *Hand-wire a brake connection from taste to `forward`.* This is BUG-002's original, already-reverted fix
  attempt — it clamped `forward` to near-zero permanently rather than producing a graded response, and more
  fundamentally it violates the constitution's "brains come from the dataset" rule (hand-wiring a connection to
  fix behavior). Not reconsidered here; ADR 004 explicitly treats a future "pathway-aware" extraction selection
  rule as a separate, parallel question.
- *Per-channel scales (independent values for `forward` vs. `feed` vs. other outputs).* Rejected for this
  iteration as unnecessary complexity-first: the ADR's "Open questions" section flags this as a possible
  follow-on only if the single shared output scale can't satisfy both pools jointly during recalibration. Per
  Principle VII (Simplicity), the plan starts with the smallest design that could work — one shared scale for
  all declared outputs — and defers splitting further until the joint sweep demonstrates it's actually needed.
- *A per-neuron scale array (full generality, one float per neuron) instead of a two-way mask.* Rejected as
  needless generality for the current problem: there is no present requirement for any granularity finer than
  "output vs. not," and a full per-neuron array would cost `n` floats of state and more surface for the
  validation rules (what's a valid array? per-entry bounds?) with no corresponding spec requirement (FR-007
  explicitly scopes the mechanism to role membership, not per-neuron tuning).

## Decision: where the output-neuron list comes from

**Decision**: `fly-brain-v1.js` passes `outputNeurons: capabilities.channels.outputs.flatMap((ch) => ch.neurons)`
into the `graph` argument of `createNetwork`. The LIF core itself has no notion of "forward" or "feed" — it only
sees a flat array of indices.

**Rationale**: `capabilities.channels.outputs[*].neurons` is the same classification already produced by
`container-v4`'s neuron-role rules (confirmed in `public/js/brain/snapshot.js`, which builds `pools.output` from
this exact structure) and already consumed by `fly-brain-v1.js` to compute each output channel's EMA firing
rate. Reusing it here means no new snapshot field, no new extraction step, and the constitutional guarantee that
output-neuron identity traces back to the dataset's own declared roles (Principle III) carries over for free.
Keeping the LIF core ignorant of channel names (per ADR 004's explicit design goal) also keeps `lif-v1.js`
reusable by any future brain config that declares output channels, not just the forager brain.

**Alternatives considered**:
- *Pass channel objects (with ids) into the LIF core and have it look up "forward"/"feed" by name.* Rejected —
  this would couple the LIF core to channel semantics, a layering violation `lif-v1.js`'s existing header comment
  explicitly guards against ("no DOM or worker code... pure"), and it would make the core brain-specific instead
  of reusable.
- *Compute the mask inside `fly-brain-v1.js` and pass a ready-made `Uint8Array` instead of a plain index list.*
  Rejected as a premature optimization: `createNetwork` already knows the network size `n` at construction time
  and is the natural place to size and fill the mask once; passing a raw index array keeps the caller-side code
  (and the `graph` argument's shape) simpler, matching how `edges`/`offsets`/`targets`/`weights` are already
  passed as plain arrays for the core to consume.

## Decision: validation and no-op guarantee

**Decision**: `resolveParams` accepts `outputScale: null` (the default) or any finite number ≥ 0; anything else
throws `'LIF parameter "outputScale" must be null or a number of 0 or more'`. When `null`, every edge uses
`synapticScale` exactly as today, preserving G1 (`lif-v1.js` bit-exact to `lif-v0.js` with default parameters)
unconditionally.

**Rationale**: This mirrors the validation style of every other `lif-v1.js` parameter (named, documented in
`LIF_V1_DEFAULTS`, checked by `resolveParams` with a message naming the parameter — Principle V) and the "off by
default" discipline ADR 003 already established for L1–L3 (`tauSyn: 0`, `tauAdapt: 0`, `thresholdJitter: 0` are
all no-ops). `null` rather than `0` is used as the sentinel because `0` is itself a valid (if extreme) calibration
value per the spec's own edge cases — it must silence output synapses entirely without being confused with "off."

**Alternatives considered**:
- *Use `0` as the "off" sentinel instead of `null`.* Rejected — `0` is a legitimate value a researcher might
  deliberately set (output synapses deliver no potential at all) per the spec's edge cases; conflating "off" with
  "zero" would make that calibration point unreachable.
- *Make `outputScale` mandatory (no sentinel, always active).* Rejected — it would break G1 for every existing
  world/brain config that doesn't yet set it, violating the "old brains keep working" constraint and the
  regression guarantee `tests/lif-golden.test.mjs` already enforces.

## Decision: world-config surface

**Decision**: No new code is needed in `validate.js` to accept the key — its LIF-key allow-list is already
derived generically from `LIF_V1_DEFAULTS`'s own keys (`validate.js:526`, `const defaults = version === 'v1' ?
LIF_V1_DEFAULTS : LIF_DEFAULTS`), so adding `outputScale` to `LIF_V1_DEFAULTS` makes `flies.brain.lif.outputScale`
a legal key automatically. A world file must set it to an actual number or omit it; writing the literal JSON
`null` would be rejected by `validate.js`'s existing generic `isNum` check on present keys (`validate.js:531`),
and omission already yields the off-default.

**Rationale**: Confirmed directly in `public/js/world/validate.js` — the LIF-key validation path (lines 515–539)
is entirely generic over whichever `LIF_*_DEFAULTS` object matches the brain version; it does not enumerate
parameter names. This is exactly the behavior ADR 004 calls out in its "World config" section, and it means this
feature requires zero changes to the validator itself — only a verification test that the new key round-trips.

**Alternatives considered**: none meaningfully different — this is a direct consequence of `validate.js`'s
existing design, not a new choice this feature makes.

## Decision: contract update

**Decision**: `specs/008-hungry-forager-brain/contracts/lif-v1.md` gains the `outputScale` row in its parameter
table, a description of `outputMask`'s construction under "Create," and the no-op guarantee under "Guarantees and
tests," in the same shape as the existing `tauSyn`/`tauAdapt`/`thresholdJitter` rows.

**Rationale**: Per `AGENTS.md`'s "Contracts" section, the LIF parameter set is a documented contract, and a
change to it must update the contract document in the same change and add contract-shaped tests on both sides
(here: the core's own tests, since there is no separate writer/reader split for this particular contract — it's
JS-to-JS, core and caller in the same runtime). This is a backward-compatible addition (new optional key,
default no-op), not an incompatible change, so no version bump is needed per `AGENTS.md`'s "bump its version
when the change is incompatible" rule.
