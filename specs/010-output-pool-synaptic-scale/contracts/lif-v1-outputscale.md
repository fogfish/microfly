# Contract Amendment: `outputScale` on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md` — the canonical LIF-v1 contract. This document
specifies the amendment this feature makes to it; per `AGENTS.md`'s "Contracts" rule, the canonical document
itself must be updated in the same change (task-level work), with the new row added in place among the existing
`tauSyn`/`tauAdapt`/`thresholdJitter` rows. This is a **backward-compatible addition**, not an incompatible
change — no version bump.

## Parameter table addition

Add to `LIF_V1_DEFAULTS`'s documented table:

| Name | Default | Meaning |
|---|---|---|
| `outputScale` | `null` | Potential per unit of edge weight, for edges whose target is a declared output neuron (L6). `null` is a no-op: such edges use `synapticScale`, identical to every other edge. |

Add to `resolveParams`'s documented rejection list:

> `outputScale` not `null` and not a finite number ≥ 0 → `'LIF parameter "outputScale" must be null or a number
> of 0 or more'`.

## `createNetwork` amendment

`createNetwork(graph, overrides, seed)` additionally reads `graph.outputNeurons` (an array of neuron indices,
absent or empty treated identically — "no output neurons declared"). It builds a per-neuron output-membership
structure (`outputMask`, one entry per neuron, sized to `graph.neuronCount`) once, alongside the existing
per-neuron threshold array, and returns it as part of the network object. No bounds-checking is performed on the
indices in `outputNeurons` — they are trusted, already validated upstream by the snapshot/capabilities layer
(`container-v4`'s `R5`), the same trust boundary the rest of `createNetwork` already relies on for `graph`.

A neuron index appearing in `outputNeurons` more than once (e.g., because it belongs to more than one output
channel) must still produce exactly one membership entry — membership is binary, not a count.

## `step` amendment

The single spike-delivery line is amended so the scale depends on the edge's target:

```text
appliedScale(target) = outputScale   if outputScale ≠ null AND outputMask[target] is set
                        synapticScale otherwise
```

This evaluation happens once per edge, per presynaptic spike, inside the existing delivery loop. It introduces:
- **One additional branch** per edge delivered in the hot loop.
- **No additional allocation** per step (the mask is built once at `createNetwork` time, not per step).
- **No change** to iteration order, spike timing, refractory handling, adaptation, or synaptic filtering — every
  other part of `step`'s control flow is untouched.

## Guarantees added

- **G6 output no-op**: with `outputScale: null` (the default), every spike train and every potential produced by
  `lif-v1.js` is identical (`===`) to the same network run with no `outputNeurons` supplied at all, and to
  `lif-v1.js`'s own behavior before this amendment. This composes with the existing **G1** (bit-exact to
  `lif-v0.js` with all-default parameters) — `outputScale: null` is itself a default, so G1 is preserved
  unconditionally, not merely approximately.
- **G7 output isolation**: with `outputScale` set to a value different from `synapticScale`, a presynaptic
  neuron driving two equal-weight targets — one declared an output neuron, one not — produces measurably
  different activity on the two targets, in the direction implied by the two scale values (lower `outputScale`
  ⇒ lower output-target activity, all else equal). With `outputScale: null`, the two targets are
  indistinguishable in expectation.
- **G8 validation**: `resolveParams` rejects a negative, non-numeric, or non-finite `outputScale` before any
  network is built or any step runs, naming the parameter in the thrown error, exactly as every other `lif-v1.js`
  parameter already does (Principle V).

These are additions to the "Guarantees and tests" section of the canonical contract, continuing its existing
numbering (the canonical document's current guarantees are G1–G5).

## Caller contract: `fly-brain-v1.js`

`fly-brain-v1.js` (the forager brain runner, not part of the LIF core itself but its sole current caller) MUST
pass `outputNeurons: capabilities.channels.outputs.flatMap((ch) => ch.neurons)` as part of the `graph` argument
it already builds for `createNetwork`. This is the same `capabilities.channels.outputs` structure
`fly-brain-v1.js` already reads to compute each output channel's EMA firing rate — no new data source, no new
snapshot read.

## Touches elsewhere (no content change required, verification only)

- **`public/js/world/validate.js`**: no code change. `flies.brain.lif.outputScale` becomes a legal key
  automatically because the v1 LIF-key allow-list is derived generically from `LIF_V1_DEFAULTS`'s own keys. A
  world file setting this key to a literal JSON `null` is correctly rejected by the existing generic `isNum`
  check on present keys — a world file MUST omit the key (yielding the off-default) rather than writing `null`
  explicitly. This must be covered by a test, not a code change.
- **`specs/008-hungry-forager-brain/contracts/world-config-forager.md`**: its prose list of calibration
  placeholders ("The `synapticScale`, `tauSyn`, `tauAdapt`, `adaptStep`, `thresholdJitter` and modulator gains
  above are placeholders until calibration") should gain `outputScale` to the list, once this feature lands,
  since it is now one more placeholder pending the recalibration protocol (ADR 004's own follow-on, out of
  scope for this feature's implementation).

## BUG-002 amendment: per-channel `outputScale`

One shared `outputScale` for every output channel could not satisfy both `forward` (needed a lower scale to stop
saturating) and `feed` (could not tolerate the same cut without falling below its firing threshold) at once,
confirmed on the live world (`world-forager.json`'s `outputScale: 5`, `feed`'s on-food maximum stuck at 0.452,
never crossing its 0.5 threshold). `outputScale` now also accepts an object keyed by output-channel id. This
amendment extends the same contract document; the parameter table row, `createNetwork` section, `step` section,
and guarantees above are superseded where they conflict by the per-channel text below (the canonical contract,
`specs/008-hungry-forager-brain/contracts/lif-v1.md`, carries the merged, authoritative version).

**Parameter table (superseding the single-value row above)**: `outputScale`'s default stays `null`. It may also
be a plain object, e.g. `{feed: 30, forward: 5}`, scaling each named channel's edges independently; a channel
absent from the object falls back to `synapticScale`, not to any other channel's value or a separate "all
outputs" value.

**`resolveParams` (superseding the single rejection line above)**: an object-valued `outputScale` is validated
entry by entry — each must be a finite number ≥ 0, else `` `LIF parameter "outputScale.${channel}" must be a
number of 0 or more` ``, naming the channel. Every other invalid shape (negative number, non-numeric string,
array, etc.) still throws the *original*, unchanged message `'LIF parameter "outputScale" must be null or a
number of 0 or more'` — the object form adds a new rejection path, it does not alter the existing scalar one.

**`createNetwork` amendment (adds to, does not replace, the `outputNeurons`/`outputMask` text above)**: also
reads `graph.outputChannels` (an array of `{id, neurons}` in declared order; absent/empty ⇒ "no channels"). It
builds two more per-neuron arrays once, alongside `outputMask`: `outputOverride` (`Uint8Array`, 1 where this
neuron's edges use the resolved scale) and `outputScaleOf` (`Float64Array`, that scale). For a plain-number
`outputScale`, every neuron in `outputMask` gets `outputOverride = 1`/`outputScaleOf = outputScale` — identical
to the pre-amendment behavior. For an object-valued `outputScale`, `graph.outputChannels` is walked in
declaration order; for each channel with an entry, each of its neurons not already resolved gets that entry's
value — so **the first-declared channel with an explicit entry wins** when a neuron belongs to more than one
channel (FR-012; a neuron already resolved by an earlier channel is left untouched by a later one, explicit
entry or not). A key of `outputScale` naming a channel id absent from `graph.outputChannels` throws
`` `LIF parameter "outputScale.${id}" names an unknown output channel` `` — checked here, not in `resolveParams`,
because only `createNetwork` has the real channel ids.

**`step` amendment (superseding the formula above)**: `appliedScale(target) = outputScaleOf[target]` if
`outputOverride[target]` is set, else `synapticScale`. Both arrays are resolved once at `createNetwork` time, so
this is still exactly one branch per edge, whether `outputScale` is `null`, a number, or an object — no new
allocation, no change to iteration order or any other part of `step`'s control flow.

**Guarantees added** (continuing the numbering above, canonical contract now at G1–G8):

- **G9 per-channel isolation**: with `outputScale` set to an object mapping distinct channels to distinct
  values, a presynaptic neuron driving one target per channel produces activity on each target tracking that
  channel's own value, independent of the other channels' values; a channel absent from the object is
  indistinguishable from a plain non-output target under the same `synapticScale`. A neuron shared between two
  channels resolves per the first-declared-with-an-entry rule above (FR-012).
- **G10 per-channel/unknown-channel validation**: `resolveParams` rejects a bad per-channel entry, naming the
  channel, before any network is built; `createNetwork` rejects an unknown channel id, before any step runs.
  Neither changes G8's pre-existing scalar message.

**Caller contract amendment**: `fly-brain-v1.js` additionally passes `outputChannels:
capabilities.channels.outputs.map((ch) => ({ id: ch.id, neurons: ch.neurons }))` alongside the existing
`outputNeurons`, into the same `graph` argument — still no new data source, still the same
`capabilities.channels.outputs` structure it already reads.

**`public/js/world/validate.js` — now DOES need a code change** (superseding the "no code change" note above
for `outputScale` specifically; every other LIF key is unaffected): `flies.brain.lif.outputScale` may be a
plain number (existing generic `isNum` check, unchanged) or a plain object, each of whose entries is checked
with `isNum`, erroring at `` `flies.brain.lif.outputScale.${channel}` `` with `'must be a number'` for a bad one.
`validate.js` does **not** check whether an object key names a real output channel — that cross-check happens in
`createNetwork` above, since `validate.js` never reads a snapshot's `.brain` file for a snapshot brain.
