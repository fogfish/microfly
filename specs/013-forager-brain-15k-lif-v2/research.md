# Phase 0 Research: Cautious Forager Brain (15K, LIF v2)

ADR 006 already decided *what* the brain is (D8–D14, L9–L11, W6–W10). This phase resolves *how* those decisions
land in the existing microfly codebase: which file gets which change, which existing pattern to reuse, and the
handful of places where today's code assumes there are only ever two forager-shaped brains (v0's tank model and
v1's five-drive model).

## R1. Two version axes must stay distinct: extraction-config `formatVersion` vs. container `version`

**Decision**: the new extraction config uses `formatVersion: 4` (ADR 006 D14's own heading). The container it
writes is **version 5** (ADR 006 W9: "Snapshot container → v5"). These are different counters in different files
(`extract/malecns_brain/config.py`'s `format_of` vs. `container.py`'s `FORMAT_VERSION_V5`), and this plan never
conflates them.

**Rationale**: the codebase already has this split for v1 (extraction-config format 3 → container version 4), so
the pattern is established, not new. Conflating them (e.g. by writing `formatVersion: 5` in the extraction config)
would make `config.py` and `container.py` disagree about what a given config produces, with no code-level error to
catch it.

**Alternatives considered**: a single shared counter. Rejected — it already doesn't hold for v0/v1 (format 2→v3,
format 3→v4 are not equal), so "fixing" it now for v2 would make the numbering inconsistent across generations
instead of consistent within one.

## R2. `kind` stays `"forager"` for both v1 and v2; the drive count differentiates, not the kind string

**Decision**: the ADR 006 brain keeps `"kind": "forager"` in its config and container header. `capabilities.py`
gains a six-tuple `FORAGER_DRIVES_V2` (adds `"escape"`) used only by the new `validate_capabilities_v5`; the
existing `FORAGER_DRIVES`/`validate_capabilities_v4` (five drives) stays exactly as is for container v4.

**Rationale**: ADR 006 is explicitly a continuation of the same lineage ("Extends ADR 003"), not a new creature —
the world, the body and the eating/braking loop are the same shape with more senses and one more output. Container
*version* (3/4/5) already carries the "which generation" information; overloading `kind` with that too would be
redundant and would require every `kind`-keyed table (`KIND_DRIVES`, etc.) to grow a parallel version check anyway.

**Alternatives considered**: a new `kind: "forager-15k"`. Rejected per Principle VII — it would require every
`kind`-dispatching function to add a third case for no behavioural difference beyond drive count, which the
container version already signals.

## R3. Transmitter-source fallback (D10) is a new resolver function, not a rewrite of existing admission

**Decision**: `dataset.py`'s `NEUROTRANSMITTER_COLUMNS` gains `ground_truth` and `consensus_nt` (column-selected,
same streaming discipline as today). A new function, `resolve_transmitter_sign(row, source_order, sign_table,
min_confidence)`, walks `transmitterSource` in order and returns the first column that names a transmitter, plus
which column it used (written per neuron as `transmitterSource`, Principle III traceability). The existing
`predicted_nt`-only path in `admission.py` is untouched; format-3 configs never set `transmitterSource`, so they
never call the new function.

**Rationale**: ADR 006 D10 states the new key's "default absent (ADR 002 behaviour)" explicitly — this is a
decision to add a fallback, not to replace the existing rule, and the measured effect (Annex A1: 143,219 → 155,771
admitted bodies) is big enough that it must be an opt-in, auditable path, not a silent change to v1's numbers.

## R4. D11's pair-grid selection is a new module, `selection_forager_v2.py`

**Decision**: a new module implements D8 (six-sense pools, per-pool side-match flag), D9 (six outputs), D11
(forward flow per pathway × backward flow per output group, pair scores, per-pair budget, union, ties on ascending
`bodyId`), D12 (anchors, whole-class exclusions) and D13 (`synapseCount` weights, `minSynapses` threshold). It
writes a per-neuron `region` field using L10's taxonomy (first-match rule: input → output → al → vnc → dn →
central) for the panel's region-activity section and the core's `groupGain`.

**Rationale**: `selection_forager.py` (v1) ranks one pooled backward flow against per-pathway budgets (ADR 006
Context point: "that pooled flow is dominated by the outputs with the most input") — this is a different scoring
rule, not a generalisation of the same one. Reusing the same module with a format-version branch risks the one
thing SC-002 forbids: changing v1's byte-identical output.

**Alternatives considered**: generalise `selection_forager.py` with a `pairGrid: bool` flag. Rejected — the
function's internals (`top_by_score` called once per pathway) would need restructuring into a nested loop over
pairs regardless, so a flag would not actually avoid a rewrite, only hide that a rewrite happened inside a module
whose existing tests assume the old behaviour.

## R5. L9 (Poisson input encoding) lives in the runner, L10 (`groupGain`) lives in the shared core

**Decision**: `fly-brain-v2.js` owns per-input-neuron Bernoulli draws (`p = r0 + (r1-r0) × clamp(gain×value, 0, 1)`)
from a PRNG stream seeded from the fly's seed, tagged distinctly from `lif-v1.js`'s existing jitter
(`thresholdJitter`) and noise (`noiseAmplitude`) streams. `lif-v1.js` itself gains only `groupGain: {}`, resolved
once in `createNetwork` into a per-neuron scale array keyed by a new `graph.neuronGroup` input (populated only when
the caller passes it — `fly-brain-v1.js` never does, so v1 is unaffected by construction), and applied at the
single edge-delivery line in `step()`.

**Rationale**: ADR 006 L9 states this placement directly ("L9 lives in the runner... so the LIF core is not
touched"). L10, by contrast, is explicitly a core change ("The core gains one optional parameter") because it must
scale incoming edges during the membrane update itself, which only the core can do without duplicating the hot
loop. This mirrors the exact split `outputScale` (L6) already uses: a per-group/per-channel map resolved once,
looked up with one branch per step.

## R6. `groupGain`'s no-op guarantee follows the `outputScale`/`outputOverride` pattern exactly

**Decision**: `resolveParams` validates `groupGain` as `{groupName: nonNegativeNumber}`, same shape check as
`outputScale`. `createNetwork` builds `groupScaleOf` (a `Float32Array` sized to the neuron count, default 1 for
every neuron) once, from `graph.neuronGroup` × `groupGain`, exactly as `outputScaleOf`/`outputOverride` are built
today. `step()`'s edge-delivery line becomes `weights[k] * (outputOverride[target] ? outputScaleOf[target] :
groupScaleOf[target] * p.synapticScale)` — one more multiply, no new branch.

**Rationale**: this is the established, already-tested pattern for "scale some edges differently, off by default,
resolved once outside the hot loop" (L6, ADR 004). Reusing it keeps the G1 bit-exactness guarantee a one-line proof
(`groupGain: {}` ⇒ every `groupGain[group] ?? 1` lookup returns 1 ⇒ identical to `lif-v0.js`/unmodified `lif-v1.js`)
instead of a new code path to audit.

## R7. `worker-core.js`'s `handleV1` must stop hard-coding brain version `'v1'` and container version `4`

**Decision**: `handleV1` (kept as the name of "the protocol-v3 handler", since the protocol itself is versioned,
not the brain) is generalised to read `msg.brain.version` and to check the container's version against
`snapshot.js`'s existing `checkBrainVersion` map (`{v0:3, v1:4, v2:5}`) instead of its own local `=== 4` check and
its own local `version: 'v1'` literal passed into `createFlyBrain`.

**Rationale**: this is a real, pre-existing defect surfaced by inspection, not new scope: today, any protocol-v3
message would silently be treated as a v1 brain and validated against container version 4 regardless of what
`msg.brain.version` actually said, because nothing has ever sent anything but `'v1'` over protocol v3. Adding v2
without fixing this would make a v2 fly either silently run v1's LIF semantics or fail a container-version check
that is checking the wrong number. The fix is scoped to this one function; protocol v3's wire format does not
change (ADR 006 W9: "Worker protocol: Unchanged (v3)").

**Alternatives considered**: add a third handler, `handleV2`, alongside `handleV0`/`handleV1`. Rejected — it would
duplicate the bug a third time (a future v3 brain over the same protocol would hit it again) instead of fixing the
one place it actually lives.

## R8. Declared senses are a new, additive code path (`senseForagerFlyV2`), not a rewrite of `senseForagerFly`

**Decision**: `stimulus.js` gains a generic resolver, `resolveDeclaredStimulus(sense, site, fliesStimuli,
bodySites)`, that looks up a sense's source objects and falloff from `flies.stimuli` and a site's offset from
`flies.body.sites`, reusing the existing `falloff()` function unchanged. `forager-step.js` gains
`senseForagerFlyV2(fly, env)`, which loops over the snapshot's declared input channels (each with a `sense` and a
`site`) and calls the resolver per channel, building the input vector generically instead of the four positional
constants `senseForagerFly` hard-codes today. `fly-host.js` picks `senseForagerFlyV2` only when `brain.version ===
'v2'`.

**Rationale**: ADR 006 W6 states the rule this fixes directly ("The world must not hard-code 'input 0 is left
odour'... Each input channel in the snapshot declares a `sense` and a body `site`"). Doing this as a sibling
function, not an in-place rewrite, keeps `senseForagerFly` and every v1 test that depends on its exact four-input
shape completely untouched — the same reasoning the plan's Complexity Tracking table gives for the runner split.

## R9. Escape is a discrete, cooldown-gated action in `body.js`, with its state held by the host

**Decision**: `body.js` gains `jumpForagerBody(fly, distance, world)` — a one-tick move of `distance` tiles along
the fly's current heading, stopping at the first non-walkable cell (reusing the same walkability check `pick`-style
moves already use). `forager-step.js`'s `applyForagerMotor` calls it when `drives.escape` is above the configured
threshold and the fly's `escapeCooldownTicks` (held per-fly by `fly-host.js`, decremented every tick) is zero; a
successful jump resets the cooldown to the configured value.

**Rationale**: ADR 006 W8 specifies this exactly ("the body moves `distance` tiles along its heading in one tick...
blocked moves stop at the first non-walkable cell"). Cooldown must be host-held state, not brain state, because the
brain's `escape` output is a continuous signal that can stay above threshold for many ticks — without an external
cooldown the fly would jump on every tick that condition holds, which is not what a single giant-fibre reflex does.

## R10. Region-activity panel section is gated by a capability, so v0/v1 panels cannot regress

**Decision**: `region-activity.js`, a new section, declares `requires: {groups: true}` (a new requirement kind
alongside the existing `channels: 'inputs'|'outputs'` and `signal: 'spikes'` ones `registry.js`'s
`isRequirementMet` already handles — mounted only when the fly's declaration lists a non-empty per-neuron `group`
array). The model only populates `declaration.groups` for container-v5 brains (sourced from the per-neuron `group`
field R4 adds); v0/v1 declarations never have it, so `isRequirementMet` returns false and the section is simply
never mounted for them — no explicit "if version === v2" branch needed in the panel at all.

**Rationale**: this directly satisfies spec FR-031 ("no v2-only row appearing for them") using the registry's
existing capability-gating mechanism instead of adding a new version check, consistent with how `inputsSection`/
`outputsSection` already avoid hard-coding a brain version.

## R11. Naming: `forager-brain-15k.brain` / `world-forager-15k.json`

**Decision**: the new snapshot and world files follow the existing `forager-brain.brain`/`world-forager.json`
naming, with a `-15k` suffix naming the scale, not the brain version (so a future same-scale recalibration doesn't
need a rename).

**Rationale**: matches the existing naming convention (`smallest-functional-brain.brain`,
`antennal-lobe-brain.brain`, `forager-brain.brain` all name what the brain *is*, not its internal version string);
`brains.json`'s manifest already carries a human label per entry for the version distinction.

## R12. Parallel seed execution (ADR 006 W10) is deferred

**Decision**: `compare-baseline.mjs` runs the new `v2` arm serially, like every existing arm, for this feature.
`worker_threads`-based parallelisation (W10) is noted in the plan's Risks as a follow-up, not implemented here.

**Rationale**: the feature spec (User Story 9 / FR-026) requires the six metrics to be reported per arm; it does
not require a runtime bound on the experiment script, and W10 is explicitly scoped by ADR 006 as "a script change
... not an app dependency" — i.e., orthogonal to whether the brain itself works. Adding it now would expand this
feature's surface (worker-thread result-merging, ordering guarantees) for a goal the spec does not ask for.
