# Contract Amendment: `noiseAmplitude` (L7) on LIF core version 1 (`lif-v1.js`)

**Amends**: `specs/008-hungry-forager-brain/contracts/lif-v1.md` — the canonical LIF-v1 contract. This document
specifies the amendment this feature makes to it; per `AGENTS.md`'s "Contracts" rule, the canonical document itself
must be updated in the same change (task-level work), with the new row added among the existing
`tauSyn`/`tauAdapt`/`thresholdJitter`/`outputScale` rows. This is a **backward-compatible addition**, not an
incompatible change — no version bump.

## Parameter table addition

Add to `LIF_V1_DEFAULTS`'s documented table:

| Name | Default | Meaning |
|---|---|---|
| `noiseAmplitude` | `0` | Half-width of a per-neuron, per-step uniform noise term added to the membrane update (L7). `0` is a no-op: no draw is made, every potential is identical to `noiseAmplitude` absent. |

Add to `resolveParams`'s documented rejection list:

> `noiseAmplitude` not a finite number ≥ 0 → `'LIF parameter "noiseAmplitude" must be 0 or more'`.

## `createNetwork` amendment

`createNetwork(graph, overrides, seed)`, when `params.noiseAmplitude > 0`, constructs a **second**, independent
`createPrng(seed)` instance — not the one `thresholdJitter` (L3) already constructs from the same `seed` when
`thresholdJitter > 0` — and stores its `next` function on the returned network object as `noiseRand`. This second
instance exists, and is advanced, only when `noiseAmplitude > 0`; with `noiseAmplitude === 0` no PRNG is
constructed for noise and no draw is ever made, regardless of `thresholdJitter`'s own setting.

Unlike `thresholdJitter`'s one-time, per-neuron draw at `createNetwork` time, `noiseRand` is advanced **every
step**, once per neuron, in index order — this is new: no existing `lif-v1.js` mechanism previously needed
state that persists and advances across calls to `step`.

## `step` amendment

The membrane-update line gains one term, computed only when `noiseAmplitude > 0` (skipped, including the draw,
otherwise):

```text
noise[i] = noiseAmplitude × (2 × noiseRand() − 1)         // uniform in [−noiseAmplitude, +noiseAmplitude]
v[i] += (dt/tau)(vRest − v[i]) + drive + external[i] + noise[i]
```

drawn for **every** neuron `i` on every step, in index order, regardless of whether `i` is in its refractory period
(so the stream's position after a step does not depend on which neurons happened to be refractory — keeping two
runs with different `refractorySteps` but the same seed comparable neuron-by-neuron, the same guarantee the
existing refractory check already gives the rest of the update). With `noiseAmplitude === 0`, this line is skipped
entirely (no draw, `noise[i]` implicitly 0), so the **off case update order is exactly today's** — `v[i] +=
(dt/tau)(vRest − v[i]) + drive + external[i]` — preserving G1 unconditionally.

## Guarantees and tests

- **G11 noise no-op**: with `noiseAmplitude: 0` (the default), every spike train and every potential produced by
  `lif-v1.js` is identical (`===`) to the same network run with `noiseAmplitude` absent from the overrides
  entirely. This composes with G1 — `noiseAmplitude: 0` is itself a default, so G1 is preserved unconditionally.
- **G12 noise reproducibility**: the same seed, graph, parameters (including `noiseAmplitude > 0`), and drive give
  the same spike sequence on repeated runs — the noise stream is seeded and deterministic, not drawn from a
  process-global or time-based source.
- **G13 pool desynchrony**: a set of neurons receiving identical external drive, built with identical starting
  state (as every neuron already is at `createNetwork`), does not spike in lockstep when `noiseAmplitude > 0`: the
  fraction of steps on which every neuron in the set spikes together is measurably lower than at `noiseAmplitude:
  0`, where it is (subject to the drive actually crossing threshold) effectively 1.
- **G14 noise/jitter independence**: the sequence of values drawn from `noiseRand` is identical whether
  `thresholdJitter` is `0` or nonzero (and vice versa — the sequence of per-neuron thresholds set at `createNetwork`
  time is identical whether `noiseAmplitude` is `0` or nonzero), for the same `seed`. The two mechanisms' PRNG
  streams never interact.
- **G15 validation**: `resolveParams` rejects a negative, non-numeric, or non-finite `noiseAmplitude` before any
  network is built or any step runs, naming the parameter, exactly as every other `lif-v1.js` parameter already
  does.

These are the unit tests named in the plan (`tests/lif-v1.test.mjs`, group L7); G11 is also a golden-adjacent test
for v1 (alongside G1/G6, the other declared no-ops).

## World config

`flies.brain.lif.noiseAmplitude` becomes a legal key automatically (`validate.js`'s LIF-key check already derives
its allow-list from `LIF_V1_DEFAULTS`, and `noiseAmplitude` is a plain number like `synapticScale`/`tauAdapt` — the
existing generic `isNum` check on present keys already covers it, no `validate.js` code change expected, same as
every prior scalar L-parameter's landing).
