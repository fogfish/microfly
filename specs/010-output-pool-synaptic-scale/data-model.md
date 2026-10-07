# Phase 1 Data Model: Output-pool synaptic scale (`outputScale`)

This feature adds one parameter and one derived runtime structure to the existing LIF network entity
(`lif-v1.js`'s `net`, per `contracts/lif-v1.md`). It introduces no new persisted entity, no snapshot-format
change, and no worker-protocol message. Entities below are described in terms of their role and validation
rules, not implementation syntax (that belongs in the contract and the tasks that implement it).

## Entity: LIF parameters (extended)

The existing per-network parameter set (`LIF_V1_DEFAULTS` / `resolveParams`'s output) gains one field.

| Field | Type | Default | Validation | Meaning |
|---|---|---|---|---|
| `outputScale` | number or `null` | `null` | `null`, or a finite number ≥ 0; otherwise rejected before any simulation step runs | Potential delivered per unit of edge weight, for edges whose target is a declared output neuron. `null` means "no override" — such edges use `synapticScale` like every other edge, identical to today. |

**Relationship to existing fields**: `synapticScale` (existing, unchanged) continues to apply to every edge by
default and to every non-output-targeted edge always. `outputScale`, when set, applies only to the subset of
edges whose target is in the output-neuron set below — the two parameters partition the edge set into two
non-overlapping groups by target, never both applying to the same edge delivery.

**Lifecycle**: resolved once per network, at `createNetwork` time, alongside the rest of the parameter object;
immutable for the life of that network (consistent with how every other LIF parameter already behaves — the
object is frozen).

## Entity: output-neuron membership (new, derived)

A per-neuron flag, built once when the network is created, answering "is this neuron index the target of at
least one output channel?"

| Field | Type | Size | Built from | Validation |
|---|---|---|---|---|
| `outputMask` (or equivalent per-neuron membership structure) | boolean-like, one entry per neuron | network's neuron count (`n`) | `outputNeurons`, a flat array of neuron indices supplied by the caller as part of the `graph` argument | None at this layer — indices are trusted, pre-validated upstream by the snapshot/capabilities layer (`container-v4`'s own rules), the same trust boundary the rest of `lif-v1.js` already relies on for its `graph` argument |

**Relationships**:
- **Source**: derived from `capabilities.channels.outputs[*].neurons` (existing snapshot structure, already
  consumed by `fly-brain-v1.js` for output EMA computation) — not a new classification, a reuse of one that
  already exists.
- **Cardinality**: a neuron may appear in more than one output channel (e.g., shared between pools); membership
  is still binary — "in the output set" or not — so duplicate indices across channels must not cause a neuron to
  be scaled more than once per spike delivery.
- **Absence**: when the caller supplies no output-neuron list (older callers, or a graph with no declared
  outputs), every entry is the "not an output" value, so `outputScale` has no effect regardless of its own
  value — this is the mechanism's second line of no-op defense, independent of `outputScale` being `null`.

**Lifecycle**: built once per network at `createNetwork` time from the `graph` argument's `outputNeurons`; not
recomputed per step, not mutated after construction (networks are not restructured at runtime elsewhere in this
codebase either).

## State / behavior rule (not a stored entity, but the mechanism's core logic)

For a given synapse delivery (presynaptic spike → target neuron, with edge weight `w`):

```text
appliedScale(target) =
    outputScale      if outputScale is not null AND target is in the output-neuron set
    synapticScale     otherwise
```

This rule is evaluated once per edge, per presynaptic spike, inside the existing spike-delivery step — it is not
a separate pass over the network and does not change iteration order, spike timing, or any other part of the
step function's existing control flow (refractory handling, threshold comparison, adaptation, synaptic
filtering all continue exactly as today).

## No new entities elsewhere

- **World/brain configuration**: no new top-level key, no new object shape — `outputScale` is simply a new
  member of the existing `flies.brain.lif` parameter object, validated the same way every other key in that
  object already is.
- **Snapshot format**: untouched. No version bump, no new field.
- **Worker protocol**: untouched. No new message type, no new field on an existing message.

## BUG-002 amendment: per-channel resolution

One shared `outputScale` for every output channel could not satisfy both `forward` and `feed` at once (confirmed
on the live world). `outputScale`'s type widens from `number | null` to `number | object | null`, and two new
derived entities replace `outputMask` as the thing `step` actually reads.

### Entity: LIF parameters (`outputScale`, widened)

| Field | Type | Default | Validation | Meaning |
|---|---|---|---|---|
| `outputScale` | number, plain object, or `null` | `null` | `null`; or a finite number ≥ 0; or a plain object whose every entry is a finite number ≥ 0 (each entry validated independently, naming its channel key on failure) — otherwise rejected before any simulation step runs | As before for the number/`null` cases. As an object, keyed by output-channel id: each named channel's edges use that entry's value; a channel absent from the object falls back to `synapticScale`, not to any other value. |

**Relationship to existing fields**: unchanged for the scalar/`null` form. For the object form, `synapticScale`
is now also the fallback for any *declared* output channel the object does not name, not just for non-output
edges — the partition is now three-way by target: named-channel edges (per-channel scale), unnamed-channel or
non-output edges (`synapticScale`), with no edge served by more than one rule.

### Entity: output-channel membership (new, derived, BUG-002)

A per-neuron record of which declared channel(s) a neuron belongs to, in declaration order, consumed only when
`outputScale` is an object.

| Field | Type | Size | Built from | Validation |
|---|---|---|---|---|
| `outputChannels` (caller-supplied, not stored on `net`) | array of `{id, neurons}`, in declared order | one entry per declared output channel | `capabilities.channels.outputs`, mapped to `{id, neurons}` by the caller (`fly-brain-v1.js`) | None at this layer for neuron indices (same trust boundary as `outputNeurons`); a key of `outputScale` not matching any `id` here is rejected at `createNetwork` time, naming the channel |

### Entity: resolved per-neuron output scale (new, derived, BUG-002; supersedes `outputMask` as the thing `step` reads)

| Field | Type | Size | Built from | Validation |
|---|---|---|---|---|
| `outputOverride` | boolean-like, one entry per neuron | `n` | `outputMask` (for a plain-number `outputScale`) or `outputChannels` + `outputScale`'s entries (for an object) | None — derived deterministically, see resolution rule below |
| `outputScaleOf` | number, one entry per neuron | `n` | Same inputs as `outputOverride`; meaningful only where `outputOverride` is set | None |

**Resolution rule (replaces the single-rule state/behavior section above, for the general case)**:

```text
appliedScale(target) =
    outputScaleOf[target]   if outputOverride[target] is set
    synapticScale           otherwise
```

`outputOverride`/`outputScaleOf` are resolved once, at `createNetwork` time:
- If `outputScale` is a plain number: `outputOverride[i] = 1` and `outputScaleOf[i] = outputScale` for every `i`
  where `outputMask[i]` is set — identical in effect to the pre-BUG-002 single-structure design.
- If `outputScale` is an object: walk `outputChannels` in declared order; for each channel with an entry, each
  of its neurons not already resolved gets that entry's value. **Cardinality (supersedes the "binary membership"
  note above for the per-channel case)**: a neuron shared between channels with different explicit entries
  resolves to the *first-declared channel with an entry* (FR-012) — not simply first-declared, not last-declared,
  and not some combination of the two values. A channel with no entry in `outputScale` contributes nothing to
  this walk; its neurons may still be resolved by a later channel that does have an entry.
- If `outputScale` is `null`: both arrays stay all-zero/all-default — the mechanism's no-op guarantee (G6)
  composes unchanged with the object-form addition.

**Lifecycle**: built once per network at `createNetwork` time, alongside `outputMask`; not recomputed per step,
not mutated after construction — same discipline as every other derived structure in `lif-v1.js`.

### No new entities elsewhere (BUG-002 amendment)

- **World/brain configuration**: still no new top-level key — `flies.brain.lif.outputScale`'s *value* widens
  from number-or-absent to number-or-object-or-absent, validated by the same key, just a richer shape check in
  `validate.js` for this one key.
- **Snapshot format**: still untouched.
- **Worker protocol**: still untouched.
