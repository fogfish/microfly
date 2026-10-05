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

`resolveParams(overrides)` throws naming the parameter for: an unknown key, `dt ≤ 0`, `tau ≤ 0`, `refractorySteps`
not a non-negative integer, `vThreshold ≤ vReset`, `tauSyn < 0`, `tauAdapt < 0`, `adaptStep < 0`, `thresholdJitter`
outside [0, 1), `stepsPerTick` not an integer in [1, 20].

## Create

`createNetwork(graph, overrides, seed)`. `graph` is the CSR form `{neuronCount, offsets, targets, weights}` or the toy edge
list (as v0). `seed` is the fly's brain seed, used only for `thresholdJitter`.

Thresholds: `vThreshold_i = vThreshold × (1 + thresholdJitter × u_i)`, with `u_i ∈ [−1, 1]` drawn once per neuron from
the seeded PRNG (`world/prng.js`) in index order. With `thresholdJitter = 0` no draws are made.

State: `v`, `refractory`, `input` (delivered next step), `spikes`, plus `syn` and `a` when the features are on.

## Step

`step(net, external)` runs one LIF step. The update order for the **off** case is exactly v0's:

```text
if refractory[i] > 0: refractory[i]--; continue
v[i] += (dt / tau)(vRest − v[i]) + input[i] + external[i]
if v[i] ≥ threshold_i: spike, v ← vReset, refractory ← refractorySteps, deliver weights × synapticScale to next input
```

For `tauSyn > 0` (L1), spikes arriving in a step are summed per target (`arrive[j]`), and
`syn[j] ← syn[j] × e^(−dt/tauSyn) + arrive[j] × (1 − e^(−dt/tauSyn))`; the membrane update adds `syn[j]` in place of
`input[j]`. `tauSyn = 0` uses `syn[j] = arrive[j]`, so the v0 path is recovered.

For `tauAdapt > 0` (L2): `a[j] ← a[j] × e^(−dt/tauAdapt)` each step, `a[j] += adaptStep` on a spike, and `−a[j]` is
added to the membrane update.

## Guarantees and tests

- **G1 bit-exact off**: with defaults, `lif-v1` produces the same spike trains and potentials as `lif-v0` for the golden
  drive in `tests/fixtures/toy-golden.json` and for the snapshot drive. Equality is `===` on every potential, not a tolerance.
- **G2 reproducible**: the same graph, parameters, drive and seed give the same spike sequence.
- **G3 spread**: with `tauSyn > 0` and a constant single spike input, the synaptic current decays with the factor in L1 and
  the steady level of a sustained input matches v0's at the same drive.
- **G4 adaptation**: with `tauAdapt > 0`, a neuron driven by a constant drive fires less often later in the run.
- **G5 jitter**: two networks built with the same seed have identical thresholds; a different seed gives different ones.
  With `thresholdJitter = 0` the thresholds equal `vThreshold`.

These are the unit tests named in the plan (`tests/lif-v1.test.mjs`); G1 is also the golden test for v1.
