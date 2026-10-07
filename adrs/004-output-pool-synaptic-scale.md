# ADR 004: Output-pool synaptic scale (`outputScale`), to un-pin `forward` and `feed` from the firing ceiling

- **Status:** Proposed
- **Date:** 2026-10-07
- **Supersedes:** nothing. Extends [ADR 003](003-hungry-forager-brain.md) (continues its LIF-core numbering: this
  ADR's mechanism is **L6**, the next slot after ADR 003's L1–L5).
- **Inputs:** ADR 003 (D4 weight rule, L1–L5 LIF mechanisms); `specs/008-hungry-forager-brain/bugs/BUG-002.md`
  (the brake diagnosis); `specs/008-hungry-forager-brain/gate-a.md` (pool sizes); `specs/008-hungry-forager-brain/
  calibration.md` (the original `synapticScale` grid); the measurements in [Annex A](#annex-a-measurements), taken
  in this ADR's own investigation.
- **Intended consumer:** whoever implements `lif-v1.js`'s next mechanism, and anyone recalibrating the forager
  brain afterward.

## Context

BUG-002 already established that a hungry forager fly finds food but does not stop on it: `feed` crosses its
threshold on a flower, but `forward` stays near 1.0 at the same time, so `speed` never drops below `eatSpeed` and
`canEat` never holds. BUG-002's own fix attempt — a hand-wired feed→forward inhibitory bridge drawn from the
connectome — was reverted because it clamped `forward` to near-zero permanently instead of producing a graded
brake, and a hand-wired connection is disallowed by the constitution's "brains come from the dataset" rule.
BUG-002 left the question open for a later feature.

This ADR's investigation went one step further and found that the premise needs correcting: **`forward` is not
pinned only on a flower — it is pinned almost everywhere, for almost the whole run, independent of input.**
Measured over 30 held-out seeds × 6 flies × 3,000 ticks on the shipped brain: `forward` mean 0.985 (std 0.035),
`feed` mean 0.986 (std 0.037), sampled across the *entire* run, not only near food (Annex A.1). `turn-left`/
`turn-right` are not pinned the same way (mean 0.60/0.68, real spread down to 0), which rules out a generic
"everything saturates" story and points at something specific to `forward` and `feed`.

**Why these two pools specifically.** `gate-a.md` records `forward` (`DNp09`) as 2 neurons with 206 in-edges, and
`feed` (`MN9`) as 2 neurons with 193 in-edges from only **2 presynaptic bodies** — i.e. `feed`'s entire readout is
controlled by two upstream cells, with no population averaging to smooth their output. ADR 003's D4 weight rule
(`postFraction`, ≈ `1 / in-degree`) means a single incoming spike contributes very little potential
(`calibration.md`: "a single spike contributes about 0.01 × scale. Readouts fire only at much larger scales"), so
the shipped `synapticScale` had to be pushed to 50 — the top of the tested range — before `feed` would cross
threshold at all. But `synapticScale` in `lif-v1.js` is one global multiplier applied identically to **every** edge
in the 205,129-edge graph (`nextInput[targets[k]] += weights[k] * p.synapticScale`), including the 2,466-neuron,
densely recurrent interneuron bulk. A scale large enough to make a 2-neuron, concentrated-fan-in pool cross
threshold also pushes the much larger, mutually-excitatory interneuron population into sustained high activity,
and `forward`/`feed` inherit that saturation directly.

**This is a different problem from the missing brake, and a parameter sweep cannot fix it.** This ADR's own grid
— `synapticScale` ∈ {30, 40, 50, 60} × (`tauAdapt`, `adaptStep`) ∈ {(0,0), (20,0.05), (20,0.1), (40,0.05)}, 16
settings, calibration seeds — found `forward`'s far-from-food mean **invariant at 0.98–0.99 in every single row**
(Annex A.2). One candidate that looked promising on calibration seeds (`tauAdapt: 40`, 93 eating bouts against the
shipped setting's 7) was checked on held-out seeds and **failed**: it reversed the sign of two gates the shipped
setting currently passes — hungry flies ate in *shorter* bouts than sated flies, and found food *less* often when
hungry (Annex A.3). One global `synapticScale` structurally cannot both keep the recurrent bulk below saturation
and drive a 2-neuron, concentrated-fan-in readout across threshold; no amount of recalibrating `tauAdapt`/
`adaptStep` around it changes that.

**Taste, for the record, is not a confound here.** It was raised and ruled out during this investigation: unlike
`odour-left`/`odour-right` (which carry a non-zero `stimulus.resting` floor through `sensoryValue`, `stimulus.js`),
`taste-left`/`taste-right` are computed in `forager-step.js`'s `senseForagerFly` as a hard `0` whenever the fly is
not standing on a stimulus cell — no resting term. Taste is genuinely zero almost everywhere, confirmed against
the panel. The saturation is driven by the odour resting floor plus the weight-rule/scale interaction above, not
by a hidden taste baseline.

**Connectome search for a brake is a separate, parallel question.** BUG-002 found 10 real neurons that are both
feed-upstream (excitatory) and forward-upstream (inhibitory) — a plausible brake motif — but the extractor's
interneuron selection scores flow **per pathway independently** (`budget: {odour: 1500, taste: 1500}` in
`extract/configs/forager-brain.json`), with no term rewarding a neuron for bridging taste into forward's
inhibition, so these 10 neurons have no particular reason to be admitted. Bridging the pathways is a legitimate
follow-on (a "pathway-aware" extraction selection rule), but it is secondary to this ADR: adding an inhibitory
input to a pool whose baseline is already pinned by unrelated global over-excitation is liable to repeat BUG-002's
reverted all-or-nothing failure. This ADR's mechanism should land first, or at minimum be evaluated jointly.

## Decision

### L6. Output-pool synaptic scale (`outputScale`, default `null`)

Add a second LIF-core parameter that replaces `synapticScale` **only** for edges whose target is a declared
output-role neuron:

```text
scale(target) = (outputScale !== null && isOutput[target]) ? outputScale : synapticScale
```

`isOutput` is a per-neuron mask built once in `createNetwork` from a caller-supplied `outputNeurons` list (an
array of neuron indices) — the LIF core has no notion of "forward" or "feed"; it only knows "this neuron index is
in the alternate-scale set," which keeps `lif-v1.js` generic and reusable outside the forager brain. The caller
(`fly-brain-v1.js`) already has the information it needs: `capabilities.channels.outputs[*].neurons`, the same
list the snapshot's own `role: 'output'` classification produces (`container-v4`'s neuron-role rules).

`outputScale: null` (the default) is a no-op — every edge uses `synapticScale`, identical to today, so **G1**
(`lif-v1.js` bit-exact to `lif-v0.js` with default parameters, `tests/lif-golden.test.mjs`) is preserved
unconditionally. This mirrors ADR 003's own "off by default" discipline for L1–L3.

**`lif-v1.js` changes:**

1. `LIF_V1_DEFAULTS` gains `outputScale: null`.
2. `resolveParams` validates it: `null`, or a finite number ≥ 0; else `'LIF parameter "outputScale" must be null
   or a number of 0 or more'`.
3. `createNetwork(graph, overrides, seed)` builds `outputMask = new Uint8Array(n)` from `graph.outputNeurons`
   (absent/empty ⇒ all zero, i.e. no effect regardless of `outputScale`) and returns it on `net`. No bounds-
   checking on the indices — they are already validated upstream by `container-v4`'s `R5` before any network is
   built, the same trust boundary the rest of `lif-v1.js` already relies on.
4. `step(net, external)`'s single spike-delivery line
   `nextInput[targets[k]] += weights[k] * p.synapticScale;`
   becomes
   ```js
   const target = targets[k];
   const scale = (p.outputScale !== null && outputMask[target]) ? p.outputScale : p.synapticScale;
   nextInput[target] += weights[k] * scale;
   ```
   One extra branch per edge in the hot loop; no added allocation.

**`fly-brain-v1.js` change:** pass `outputNeurons: capabilities.channels.outputs.flatMap((ch) => ch.neurons)` into
the `graph` argument of `createNetwork`.

**World config:** `flies.brain.lif.outputScale` becomes a legal key automatically (`validate.js`'s LIF-key check
already derives its allow-list from `LIF_V1_DEFAULTS`). A world file must set it to an actual number or omit it —
never write `"outputScale": null` in JSON; `validate.js`'s generic `isNum` check on present keys would reject it,
and omission already yields the off-default.

**Contract:** `specs/008-hungry-forager-brain/contracts/lif-v1.md` gains the `outputScale` row and the no-op
guarantee, same shape as the existing `tauSyn`/`tauAdapt`/`thresholdJitter` rows.

### Tests (write first)

- `tests/lif-v1.test.mjs`, group `L6`: (a) default no-op — identical spike trains with `outputNeurons` present vs.
  absent when `outputScale` is `null`; (b) isolation — a small synthetic graph with one driven presynaptic neuron
  feeding two equal-weight targets, one declared output; at `{synapticScale: 10, outputScale: 2}` the output
  target's spike count is measurably lower than the non-output target's, and the two are equal when
  `outputScale: null`; (c) validation rejects a negative or non-numeric `outputScale` with the exact message.
- `tests/fly-brain-v1.test.mjs`: one integration test (skipped when `public/brains/forager-brain.brain` is absent)
  showing `createFlyBrain({ lif: { synapticScale: 50, outputScale: 5 } })` produces a lower mean spike rate on the
  `forward`/`feed` channels than the same run with `outputScale: null`, fixed seed, fixed nonzero input.
- Regression: `tests/lif-golden.test.mjs` must pass unmodified.

### Recalibration protocol

1. Extend the calibration script with a saturation diagnostic: per grid point, `far-forward`/`far-feed` mean,
   sampled only when the fly is outside every food source's declared reach (this ADR's own Annex A.2 script is a
   starting point).
2. Sweep `synapticScale` (now free to try lower values, e.g. 10–30, since the output pools no longer have to be
   dragged across threshold by the same multiplier) and `outputScale` (e.g. 5–50) independently, on calibration
   seeds only (`f.experiment.seeds`). Hold `tauAdapt`/`adaptStep` at the shipped 20/0.05 until a non-saturating
   `(synapticScale, outputScale)` pair is found.
3. Selection order: (a) `far-forward`/`far-feed` not pinned near 1.0 — real headroom; (b) `feed` still reliably
   crosses `feedThreshold` near food; (c) `find` rate stays above the random-walk baseline.
4. **Validate every candidate on held-out seeds** (`compare-baseline.mjs --seeds=held-out`) before adopting it —
   non-negotiable, given Annex A.3. Record the result whether it passes or fails.
5. Record the sweep and its held-out verdict as a new dated entry in `specs/008-hungry-forager-brain/
   calibration.md`, same table format as the existing entry.
6. Only on a held-out pass, update `world-forager.json`'s `flies.brain.lif` and the world-config contract.

## Consequences

- `forward`/`feed` gain a path to respond gradedly to input instead of sitting at the firing ceiling — a
  precondition for `canEat` ever triggering on anything but noise, and for the per-fly `turn-left`/`turn-right`
  skew (Annex A.1) to be diagnosable rather than confounded with blanket saturation.
- Two more parameters to calibrate (`outputScale` alongside `synapticScale`), widening the search space; the
  recalibration protocol above bounds this with an explicit saturation diagnostic the original grid lacked.
- Does **not** add a brake pathway. A fly whose `forward` is no longer pinned can still fail to slow down on a
  flower if nothing in the network drives it down there specifically — this ADR only removes the
  always-saturated floor, it does not manufacture a reason for `forward` to dip on food. The taste→forward bridge
  (BUG-002's 10 candidate neurons, pathway-aware selection) remains a separate, likely-still-necessary follow-on.
- Negligible runtime cost: one branch per edge in an already-hot loop, no new allocation.
- `lif-v0.js` is untouched; `mock` and `v0` brains are unaffected.

## Open questions

- Is per-role granularity (one scale for *all* output channels) enough, or will `forward` and `feed` eventually
  need independent scales? This ADR deliberately starts with the simplest shared knob; splitting further is a
  smaller follow-on if the joint sweep can't satisfy both pools at once.
- Does un-pinning `forward`/`feed` change the `turn-left`/`turn-right` skew measured in Annex A.1 (18% of flies
  have `turn-left` mean > 0.7), or is that an independent dynamic? Worth re-measuring after this change lands.
- Should the recalibration protocol's saturation diagnostic become a permanent fixture of `calibrate-forager.mjs`
  (checked into the repo) rather than a scratch script, given it would have caught the shipped setting's problem
  at the time of the original calibration?

## Related

- [ADR 003](003-hungry-forager-brain.md) — D4 (weight rule), L1–L5 (the LIF mechanisms this extends).
- `specs/008-hungry-forager-brain/bugs/BUG-002.md` — the brake diagnosis and the reverted hand-wired attempt.
- `specs/008-hungry-forager-brain/gate-a.md` — pool sizes and edge counts cited above.
- `specs/008-hungry-forager-brain/calibration.md` — the original `synapticScale` grid and its own saturation note.

## Annex A: measurements

### A.1 Output-channel distribution, shipped brain, held-out seeds

30 held-out seeds × 6 flies × 3,000 ticks (540,000 samples), shipped setting (`synapticScale: 50, tauAdapt: 20,
adaptStep: 0.05`):

```text
turnLeft   mean=0.6035 std=0.2258 min=0.0000 max=1.0000
turnRight  mean=0.6783 std=0.2242 min=0.0000 max=1.0000
forward    mean=0.9853 std=0.0349 min=0.0000 max=1.0000
backward   mean=0.2758 std=0.3480 min=0.0000 max=1.0000
feed       mean=0.9858 std=0.0365 min=0.0000 max=1.0000
```

Per-fly mean, 180 flies:

```text
turnLeft  buckets: <0.3: 4    0.3-0.7: 135   >0.7: 41
turnRight buckets: <0.3: 0    0.3-0.7: 96    >0.7: 84
flies with turnLeft-mean > turnRight-mean: 62 / 180
```

`forward`/`feed` sit within 0.035–0.037 std of the ceiling essentially everywhere; `turnLeft`/`turnRight` have real
spread and no comparable pinning.

### A.2 Saturation sweep, calibration seeds

5 calibration seeds × 6 flies × 3,000 ticks per row, `far-*` = mean when outside every food source's declared
reach, `near-*` = mean when inside at least one:

```text
scale  tauAdapt adaptStep | found/flies find%   bouts eatTk |  far-fwd far-feed | near-fwd near-feed
   30         0         0 |     5/30   16.7      0     0 | 0.989    0.984   |  0.984    0.982
   30        20      0.05 |    19/30   63.3      0     0 | 0.986    0.865   |  0.986    0.855
   30        20       0.1 |    22/30   73.3      0     0 | 0.985    0.626   |  0.984    0.665
   30        40      0.05 |    18/30   60.0      0     0 | 0.987    0.456   |  0.986    0.443
   40         0         0 |     5/30   16.7      0     0 | 0.986    0.985   |  0.987    0.984
   40        20      0.05 |     8/30   26.7      3    10 | 0.987    0.985   |  0.986    0.984
   40        20       0.1 |    21/30   70.0      0     0 | 0.988    0.921   |  0.987    0.887
   40        40      0.05 |    16/30   53.3      0     0 | 0.987    0.853   |  0.987    0.843
   50         0         0 |     2/30    6.7   1355  1481 | 0.990    0.983   |  0.986    0.985
   50        20      0.05 |    13/30   43.3      7    12 | 0.988    0.986   |  0.985    0.985   ← shipped
   50        20       0.1 |    21/30   70.0      0     0 | 0.985    0.982   |  0.984    0.982
   50        40      0.05 |    15/30   50.0     93   220 | 0.986    0.985   |  0.986    0.983   ← candidate (see A.3)
   60         0         0 |     1/30    3.3      0     0 | 0.982    0.981   |  0.982    0.981
   60        20      0.05 |     2/30    6.7      1     5 | 0.981    0.981   |  0.982    0.982
   60        20       0.1 |     4/30   13.3      1    14 | 0.986    0.985   |  0.983    0.983
   60        40      0.05 |     5/30   16.7      0     0 | 0.983    0.968   |  0.982    0.962
```

`far-fwd` does not move below 0.981 anywhere in this grid, at any scale from 30 to 60, with or without adaptation.

### A.3 Held-out validation of the `tauAdapt: 40` candidate — rejected

`synapticScale: 50, tauAdapt: 40, adaptStep: 0.05` (row above, 93 bouts / 220 eating ticks on calibration seeds,
against the shipped setting's 7/12) was checked on the 30 held-out seeds with `compare-baseline.mjs --seeds=
held-out`:

| | shipped (`tauAdapt 20`) | candidate (`tauAdapt 40`) |
|---|---|---|
| find | 36.1% | 48.3% (better) |
| eat | **PASS** — hungry 2 ticks > sated 1 | **FAIL** — hungry 1 tick < sated 2 (reversed) |
| hunger dependence | **PASS** — +21.7% | **FAIL** — −12.2% (reversed) |
| contacts | 433 | 322 |

The calibration-seed win did not generalise and reversed both hunger-linked gates on held-out seeds. Rejected;
not shipped. Recorded here as the evidence for this ADR's "no amount of recalibrating `tauAdapt`/`adaptStep`"
claim, and as a cautionary example for the recalibration protocol's held-out-validation step.
