# Contract Amendment: `groupGain` (L10) on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md` — the canonical LIF-v1 contract, which documents
`tauSyn`/`tauAdapt`/`thresholdJitter`/`stepsPerTick`/`outputScale`/`noiseAmplitude`/`noiseBulkScale`/
`inhibitoryScale` (the latter three added by specs 010/011's own amendments, already folded in). This is a
backward-compatible addition — no version bump.

## Parameter table addition

| Name | Default | Meaning |
|---|---|---|
| `groupGain` | `{}` | Map from region name to a non-negative gain. Edges into a neuron of a listed region use `synapticScale × groupGain[region]` instead of `synapticScale`. An empty map (the default) is a no-op: every region's effective gain is 1 (L10). |

`resolveParams` rejection: `groupGain` not a plain object, or any of its values not finite and ≥ 0 → `'LIF
parameter "groupGain" must be a map of region name to a number 0 or more'` — the same shape and message pattern
`outputScale`'s per-key validation already uses.

## `createNetwork` amendment

`createNetwork(graph, overrides, seed)` accepts an optional `graph.neuronGroup` (a region name, or `undefined`,
per neuron — populated only by callers that know regions; `fly-brain-v1.js` never passes it, so v1 networks have
no `neuronGroup` and this amendment is inert for them). When present, a `groupScaleOf` array is resolved **once**,
sized to the neuron count: `groupScaleOf[i] = groupGain[graph.neuronGroup[i]] ?? 1`. When `graph.neuronGroup` is
absent, or `groupGain` is `{}`, `groupScaleOf[i]` is `1` for every `i` — the same "resolved once, outside the hot
loop" pattern `outputScaleOf`/`outputOverride` (L6) already establish.

## `step` amendment

The single edge-delivery line gains one more case, checked in the same branch that already chooses between
`outputScaleOf` and the plain scale:

```text
scale = outputOverride[target] ? outputScaleOf[target] : groupScaleOf[target] * p.synapticScale
nextInput[target] += weights[k] * scale
```

With `groupGain: {}` (the default) `groupScaleOf[target]` is always `1`, so this line reduces exactly to today's
`weights[k] * p.synapticScale` for every target not in `outputOverride` — identical to `lif-v1.js` before this
amendment, which is itself identical to `lif-v0.js` when every v1 mechanism is off (G1).

## Guarantees and tests

- **G16 group-gain no-op**: with `groupGain: {}` (the default) or `graph.neuronGroup` absent, every spike train
  and every potential is identical (`===`) to the same network run with `groupGain` absent from the overrides
  entirely. Composes with G1: `groupGain: {}` is itself a default, so G1 holds unconditionally.
- **G17 per-group scale**: with `groupGain: {al: 0.5}` and a `graph.neuronGroup` marking some neurons `"al"`,
  only edges targeting those neurons are scaled by `0.5`; every other target's input is unaffected, verified by
  comparing against the same run with `groupGain: {}`.
- **G18 validation**: `resolveParams` rejects a `groupGain` value that is negative, non-numeric, non-finite, or
  not a plain object, naming the parameter, before any network is built.

These are the unit tests named in the plan (`tests/lif-v1-groupgain.test.mjs`); G16 is also appended to
`tests/lif-v1.test.mjs`'s existing G1-style no-op assertions, as the plan's Phase 2 ordering requires before any
other v2 work depends on it.

## World config

`flies.brain.lif.groupGain` becomes a legal key automatically for `v1` **and** `v2` worlds (`validate.js`'s LIF-key
allow-list already derives from `LIF_V1_DEFAULTS`); its value shape (an object, not a plain number) needs one new
branch in `validate.js`'s per-key check, mirroring the object-shaped check `outputScale` already has.
