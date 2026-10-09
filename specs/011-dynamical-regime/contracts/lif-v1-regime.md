# Contract Amendment: `noiseBulkScale` (L7′) and `inhibitoryScale` (L8) on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md` — the canonical LIF-v1 contract, updated in the same
change. **Decided in**: ADR 005 Annex B. This is a **backward-compatible addition** — both parameters default to a
no-op, so no version bump, and G1 (bit-exact to `lif-v0.js` with defaults) is preserved unconditionally.

## Why

The 2026-10-09 recalibration showed two regime failures no existing parameter could separate (ADR 005 Annex B):

- **Noise amplified by the bulk.** `noiseAmplitude` applied to every neuron is amplified by the recurrent
  interneurons into activity comparable to the odour response, and it erases the steering signal. Noise is meant to
  desynchronize the sensory pools (L7's own purpose), so it must be possible to confine it to them.
- **No stable, responsive operating point.** With one `synapticScale` for both signs, the network either stays
  silent or saturates. A separate gain on the dataset's own inhibitory edges is the standard way to stabilize an
  excitatory network (an inhibition-stabilized regime) without hand-wiring any connection.

## Parameter table addition

| Name | Default | Meaning |
|---|---|---|
| `noiseBulkScale` | `1` | Multiplier of `noiseAmplitude` for neurons not in `graph.inputNeurons`. `1` is uniform noise (L7 unchanged); `0` confines noise to the declared input pools. |
| `inhibitoryScale` | `1` | Multiplier of every negative edge weight. `1` is a no-op: the graph's own weight array is used. |

`resolveParams` rejects either one when it is not a finite number ≥ 0:
`'LIF parameter "noiseBulkScale" must be 0 or more'`, `'LIF parameter "inhibitoryScale" must be 0 or more'`.

## `createNetwork` amendment

- `graph.inputNeurons` (array of neuron indices, optional) names the sensory input neurons. `fly-brain-v1.js` passes
  every neuron of every declared input channel.
- When `noiseAmplitude > 0`: `noiseOf[i] = noiseAmplitude` for input neurons and `noiseAmplitude × noiseBulkScale`
  for every other neuron, built once.
- When `inhibitoryScale ≠ 1`: the network uses a copy of `graph.weights` with every negative entry multiplied by
  `inhibitoryScale`. The graph's array is never modified. Signs, edges, and their order are unchanged.

## `step` amendment

```text
noise[i] = noiseOf[i] × (2 × noiseRand() − 1)     // drawn for every neuron, every step, in index order, as L7
```

The step loop is otherwise unchanged; L8 acts only through the weights chosen at `createNetwork`.

## Guarantees and tests

G16–G20 in the canonical contract: noise-target no-op, noise target, inhibitory no-op, inhibitory gain,
validation (`tests/lif-v1.test.mjs`, groups L7′ and L8), plus the runner check that every declared input neuron and
no other keeps its noise at `noiseBulkScale: 0` (`tests/fly-brain-v1.test.mjs`).

## World config

`flies.brain.lif.noiseBulkScale` and `flies.brain.lif.inhibitoryScale` become legal keys automatically:
`validate.js` derives its allow-list from `LIF_V1_DEFAULTS`, and both are plain numbers checked by the existing
number rule and by `resolveParams`.
