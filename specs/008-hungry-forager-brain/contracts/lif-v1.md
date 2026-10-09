# Contract: LIF core, version 1 (`lif-v1.js`)

**Owner**: `public/js/brain/lif-v1.js`. Pure: no DOM, no workers, no hidden constants (Principle V).
**Relation to v0**: `public/js/brain/lif-v0.js` is the v0 core, renamed from `lif.js` and otherwise unchanged. It is the
reference for the bit-exact check below.

## Parameters

`LIF_V1_DEFAULTS` (frozen). Every key is documented here and validated by `resolveParams`.

| Name | Default | Meaning |
|---|---|---|
| `dt` | 1.0 | Time per LIF step. |
| `tau` | 20.0 | Membrane time constant. |
| `vRest`, `vReset` | 0.0 | Resting and reset potentials. |
| `vThreshold` | 1.0 | Firing threshold. Must be greater than `vReset`. |
| `refractorySteps` | 2 | Integer ≥ 0. |
| `synapticScale` | 0.2 | Potential per unit of edge weight. |
| `tauSyn` | 0 | Synaptic current time constant (L1). 0 is the delta synapse. |
| `tauAdapt` | 0 | Adaptation time constant (L2). 0 is no adaptation. |
| `adaptStep` | 0 | Adaptation increase per spike (L2). |
| `thresholdJitter` | 0 | Fraction of threshold spread per neuron, in [0, 1) (L3). |
| `stepsPerTick` | 1 | LIF steps per world tick (L5). Read by the runner; the core ignores it. Integer in [1, 20]. |
| `outputScale` | `null` | Potential per unit of edge weight, for edges whose target is a declared output neuron (L6). `null` is a no-op: such edges use `synapticScale`, identical to every other edge. **(BUG-002)** May also be a plain object keyed by output-channel id (e.g. `{feed: 30, forward: 5}`), scaling each channel's edges independently; a channel absent from the object falls back to `synapticScale`. |
| `noiseAmplitude` | 0 | Half-width of a per-neuron, per-step uniform noise term added to the membrane update (L7). `0` is a no-op: no draw is made, every potential is identical to `noiseAmplitude` absent entirely. |

`resolveParams(overrides)` throws naming the parameter for: an unknown key, `dt ≤ 0`, `tau ≤ 0`, `refractorySteps`
not a non-negative integer, `vThreshold ≤ vReset`, `tauSyn < 0`, `tauAdapt < 0`, `adaptStep < 0`, `thresholdJitter`
outside [0, 1), `stepsPerTick` not an integer in [1, 20], `outputScale` not `null`, not a finite number ≥ 0, and
not a plain object of finite numbers ≥ 0, each named by its channel key
(`'LIF parameter "outputScale" must be null or a number of 0 or more'` for the scalar/shape case,
`` `LIF parameter "outputScale.${channel}" must be a number of 0 or more` `` for a bad per-channel entry — the
object form does not change the scalar message, BUG-002), and `noiseAmplitude` not a finite number ≥ 0
(`'LIF parameter "noiseAmplitude" must be 0 or more'`, L7).

## Create

`createNetwork(graph, overrides, seed)`. `graph` is the CSR form `{neuronCount, offsets, targets, weights}` or the toy edge
list (as v0). `seed` is the fly's brain seed, used only for `thresholdJitter`.

Thresholds: `vThreshold_i = vThreshold × (1 + thresholdJitter × u_i)`, with `u_i ∈ [−1, 1]` drawn once per neuron from
the seeded PRNG (`world/prng.js`) in index order. With `thresholdJitter = 0` no draws are made.

State: `v`, `refractory`, `input` (delivered next step), `spikes`, plus `syn` and `a` when the features are on.

`graph.outputNeurons` (an array of neuron indices; absent or empty treated identically as "no output neurons
declared") builds `outputMask`, a per-neuron membership flag sized to `graph.neuronCount`, once at `createNetwork`
time, alongside the threshold array (L6). No bounds-checking is performed on the indices — they are trusted, the
same way the rest of `graph` already is. A neuron index appearing more than once in `outputNeurons` still produces
exactly one membership entry.

**(BUG-002)** `graph.outputChannels` (an array of `{id, neurons}` in declared order; absent/empty ⇒ "no channels")
and the resolved `outputScale` together build two more per-neuron arrays, once, alongside `outputMask`:
`outputOverride` (`Uint8Array`, 1 where this neuron's incoming edges use the resolved per-neuron scale instead of
`synapticScale`) and `outputScaleOf` (`Float64Array`, the resolved scale, meaningful only where `outputOverride`
is set). For a plain-number `outputScale`, every neuron in `outputMask` gets `outputOverride = 1` and
`outputScaleOf` = that number — identical in effect to the pre-BUG-002 `outputMask`-only behavior. For an
object-valued `outputScale`, `graph.outputChannels` is walked in order; for each channel with an entry in
`outputScale`, each of its neurons not already resolved gets that entry's value, so **the first-declared channel
with an explicit entry wins** when a neuron belongs to more than one channel (FR-012) — a channel's entry is
skipped entirely for a neuron already resolved by an earlier channel, so a later, explicitly-scaled channel never
overrides an earlier one. A key of `outputScale` naming a channel id absent from `graph.outputChannels` throws
`` `LIF parameter "outputScale.${id}" names an unknown output channel` `` — this check lives here, not in
`resolveParams`, because only `createNetwork` has the real channel ids (`validate.js` never reads a snapshot's
`.brain` file for a snapshot brain, so it cannot make this check either).

**(L7)** When `noiseAmplitude > 0`, `createNetwork` constructs a **second**, independent `createPrng(seed)`
instance — not the one `thresholdJitter` constructs from the same `seed` — and stores its `next` function on the
returned network object as `noiseRand`. This instance exists, and is advanced, only when `noiseAmplitude > 0`; with
`noiseAmplitude === 0` no PRNG is constructed for noise and no draw is ever made, regardless of `thresholdJitter`'s
own setting. Unlike `thresholdJitter`'s one-time, per-neuron draw at `createNetwork` time, `noiseRand` is advanced
every step, once per neuron, in index order — the one piece of state that persists and advances across calls to
`step`.

## Step

`step(net, external)` runs one LIF step. The update order for the **off** case is exactly v0's:

```text
if refractory[i] > 0: refractory[i]--; continue
v[i] += (dt / tau)(vRest − v[i]) + input[i] + external[i]
if v[i] ≥ threshold_i: spike, v ← vReset, refractory ← refractorySteps, deliver weights × synapticScale to next input
```

For each delivered edge (L6), the scale depends on the edge's target: `appliedScale(target) = outputScaleOf[target]`
if `outputOverride[target]` is set, else `synapticScale`. **(BUG-002)** `outputOverride`/`outputScaleOf` are
resolved once at `createNetwork` time (above), so this stays a single branch per edge regardless of whether
`outputScale` is a plain number, an object, or `null` — no additional allocation, no change to iteration order,
spike timing, refractory handling, adaptation, or synaptic filtering.

For `tauSyn > 0` (L1), spikes arriving in a step are summed per target (`arrive[j]`), and
`syn[j] ← syn[j] × e^(−dt/tauSyn) + arrive[j] × (1 − e^(−dt/tauSyn))`; the membrane update adds `syn[j]` in place of
`input[j]`. `tauSyn = 0` uses `syn[j] = arrive[j]`, so the v0 path is recovered.

For `tauAdapt > 0` (L2): `a[j] ← a[j] × e^(−dt/tauAdapt)` each step, `a[j] += adaptStep` on a spike, and `−a[j]` is
added to the membrane update.

For `noiseAmplitude > 0` (L7): `noise[i] = noiseAmplitude × (2 × noiseRand() − 1)`, drawn for **every** neuron `i`
on every step, in index order, before the refractory check — regardless of whether `i` is in its refractory
period, so the stream's position after a step never depends on which neurons happened to be refractory. `noise[i]`
is added to the membrane update alongside `drive` and `external[i]`. With `noiseAmplitude === 0` this line is
skipped entirely (no draw, `noise[i]` implicitly 0), so the off-case update order is exactly v0's.

## Guarantees and tests

- **G1 bit-exact off**: with defaults, `lif-v1` produces the same spike trains and potentials as `lif-v0` for the golden
  drive in `tests/fixtures/toy-golden.json` and for the snapshot drive. Equality is `===` on every potential, not a tolerance.
- **G2 reproducible**: the same graph, parameters, drive and seed give the same spike sequence.
- **G3 spread**: with `tauSyn > 0` and a constant single spike input, the synaptic current decays with the factor in L1 and
  the steady level of a sustained input matches v0's at the same drive.
- **G4 adaptation**: with `tauAdapt > 0`, a neuron driven by a constant drive fires less often later in the run.
- **G5 jitter**: two networks built with the same seed have identical thresholds; a different seed gives different ones.
  With `thresholdJitter = 0` the thresholds equal `vThreshold`.
- **G6 output no-op**: with `outputScale: null` (the default), every spike train and every potential produced by
  `lif-v1.js` is identical (`===`) to the same network run with no `outputNeurons` supplied at all. This composes
  with G1 — `outputScale: null` is itself a default, so G1 is preserved unconditionally.
- **G7 output isolation**: with `outputScale` set to a value different from `synapticScale`, a presynaptic neuron
  driving two equal-weight targets — one declared an output neuron, one not — produces measurably different
  activity on the two targets, in the direction implied by the two scale values. With `outputScale: null`, the two
  targets are indistinguishable in expectation.
- **G8 validation**: `resolveParams` rejects a negative, non-numeric, or non-finite `outputScale` before any network
  is built or any step runs, naming the parameter in the thrown error, exactly as every other `lif-v1.js` parameter
  already does.
- **G9 per-channel isolation (BUG-002)**: with `outputScale` set to an object mapping distinct channels to distinct
  values, a presynaptic neuron driving one target per channel produces activity on each target that tracks that
  channel's own value, independently of the other channels' values; a channel absent from the object produces
  activity indistinguishable from a plain non-output target under the same `synapticScale`. A neuron shared
  between two channels resolves to the first-declared channel that carries an explicit entry (FR-012).
- **G10 per-channel/unknown-channel validation (BUG-002)**: `resolveParams` rejects a negative or non-numeric entry
  of an object-valued `outputScale`, naming the offending channel, before any network is built or any step runs;
  `createNetwork` rejects a key of `outputScale` naming a channel id absent from `graph.outputChannels`, also
  before any step runs. Neither case changes the pre-existing scalar `outputScale` error message (G8).

- **G11 noise no-op**: with `noiseAmplitude: 0` (the default), every spike train and every potential produced by
  `lif-v1.js` is identical (`===`) to the same network run with `noiseAmplitude` absent from the overrides
  entirely. This composes with G1 — `noiseAmplitude: 0` is itself a default, so G1 is preserved unconditionally.
- **G12 noise reproducibility**: the same seed, graph, parameters (including `noiseAmplitude > 0`), and drive give
  the same spike sequence on repeated runs.
- **G13 pool desynchrony**: a set of neurons receiving identical external drive and identical starting state does
  not spike in lockstep when `noiseAmplitude > 0`: the fraction of steps on which every neuron in the set spikes
  together is measurably lower than at `noiseAmplitude: 0`, where it is (subject to the drive actually crossing
  threshold) effectively 1.
- **G14 noise/jitter independence**: the sequence of values drawn from `noiseRand` is identical whether
  `thresholdJitter` is `0` or nonzero (and vice versa — the per-neuron thresholds set at `createNetwork` time are
  identical whether `noiseAmplitude` is `0` or nonzero), for the same `seed`. The two mechanisms' PRNG streams
  never interact.
- **G15 validation**: `resolveParams` rejects a negative, non-numeric, or non-finite `noiseAmplitude` before any
  network is built or any step runs, naming the parameter, exactly as every other `lif-v1.js` parameter already
  does.

These are the unit tests named in the plan (`tests/lif-v1.test.mjs`); G1 is also the golden test for v1; G11 is
also a golden-adjacent test for v1 (alongside G1/G6, the other declared no-ops).
