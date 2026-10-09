# ADR 005: Dynamical regime — absolute weights, membrane noise, and sub-threshold sensory coding

- **Status:** Proposed
- **Date:** 2026-10-08
- **Supersedes:** [ADR 003](003-hungry-forager-brain.md) D4 (the `postFraction` weight rule, which this ADR amends
  with a new value rather than redefining the existing one in place).
- **Extends:** ADR 003's LIF-core numbering (L1–L5) and [ADR 004](004-output-pool-synaptic-scale.md)'s L6
  (`outputScale`). This ADR's mechanism is **L7**, the next slot; Annex B adds **L7′** (`noiseBulkScale`) and **L8**
  (`inhibitoryScale`).
- **Inputs:** `specs/011-dynamical-regime/spec.md`; `specs/008-hungry-forager-brain/calibration.md` (the
  `synapticScale`/`forward`/`feed` saturation this ADR fixes at its root, rather than by picking a different point
  on the same, structurally saturating curve); ADR 004 Annex A (the 0.985/0.986 ceiling measurements); this
  feature's own investigation into `selection_forager.py` and `lif-v1.js` (below).
- **Intended consumer:** whoever implements the extractor and LIF-core changes below, and whoever recalibrates the
  forager brain and world afterward.

## Context

`specs/008-hungry-forager-brain/calibration.md` and ADR 004 both found the same wall from two directions: no grid
search over `synapticScale`, `tauAdapt`/`adaptStep`, or (ADR 004) a second output-pool scale ever moved `forward`'s
far-from-food mean off 0.98–0.99. ADR 004 diagnosed *part* of why: one global `synapticScale` has to be pushed high
enough to drag a 2-neuron, concentrated-fan-in readout (`feed`) across threshold, and the same multiplier then
saturates the much larger recurrent interneuron bulk. This ADR's own investigation finds three more structural
reasons a parameter sweep alone cannot find an in-between setting, and fixes all of them together, because each one
masks whether the others are working:

**1. `postFraction` normalises over the *selected* subgraph, not the real one (ADR 003 D4 — a documented decision,
not a bug).** `selection_forager.py`'s `select_forager` computes `pre_i`, `post_i`, `syn` from every edge between
*admitted* bodies (`keep = isin(pre, ids) & isin(post, ids) & syn ≥ 1`, `ids` = every body that passed dataset
admission — thousands of bodies, not the few thousand finally selected). It then restricts to `inside` (both ends
also in the final selection `order`) and normalises each edge by `total_in = bincount(dst, weights=raw, …)` —
summed **only over the `inside`-filtered, already-selected presynaptic neurons**. A neuron whose selected inputs are
20 of its 1,000 real admitted inputs gets those 20 rescaled to sum to 1, identical to a neuron whose selection
happened to capture all 1,000. Excluding a real presynaptic neuron from the budget never weakens its target's total
drive — it only redistributes it onto whichever inputs did make the cut. Every selected neuron's total modeled
input is pinned near 1 regardless of how much of its real connectivity survived selection, which is precisely the
uniformity L6 found could not be fixed by scale alone: the weights going into the saturation are already uniform
before `synapticScale` ever multiplies them.

**2. No noise, no heterogeneity — a pool is one neuron wearing N bodies.** `fly-brain-v1.js`'s `step` writes the
same `drive` into `lastDrive[neuron]` for every neuron of a channel (`for (const neuron of ch.neurons) lastDrive[neuron]
= drive;`), and `createNetwork` initialises every neuron's state identically (`v: new Float64Array(n).fill(params.vRest)`,
`refractory` all zero). With issue 1 making every selected neuron's total input weight near-uniform too, a pool of,
for example, 131 same-side ORNs has 131 neurons that are *numerically* different bodies but *dynamically*
indistinguishable: same start state, same drive, same effective weight budget. They spike on the same step, every
time, deterministically. The network is then a cascade of giant, synchronized boolean gates, not a population
encoding anything graded — and a setting chosen on 5 calibration seeds has, in effect, only ever seen 5 independent
random draws (which seed), not one draw per neuron, which is the most direct explanation for why calibration-seed
wins (ADR 004 Annex A.3; `calibration.md`'s own `tauAdapt: 40` candidate) reverse on held-out seeds.

**3. Sensory coding is already saturated at the floor.** `stimulus.js`'s `sensoryValue` is `clamp(resting + gain ×
intensity, 0, max)`, with the shipped `resting = 0.2` and a hunger-modulated `gain` the contract puts at `g0 + (g1 −
g0) × hunger ∈ [0.5, 1.5]` (`fly-brain-v1.js`'s `channelGains`). The lowest value this can take with hunger ≥ 0 and
intensity = 0 is `0.2 × 0.5 = 0.1`; with the shipped forager world's hunger range this is typically `0.1`–`0.3` with
**no odour present at all**. `lif-v1.js`'s membrane equation at steady state gives `V∞ = τ · I` with the shipped
`tau = 20`, so `V∞ = 2`–`6` against `vThreshold = 1` — four to six times threshold, with no odour anywhere nearby.
The firing-rate ceiling (`1 / (refractorySteps + 1) = 1/3` at the shipped `refractorySteps = 2`) is reached once `V∞`
clears threshold by any margin and the refractory period becomes the only limit, which happens for every `intensity`
from 0 upward within the odour's working range — the entire gradient from "nothing" to "strong" collapses to
whichever of roughly three rate buckets the resting-plus-gain floor happens to land in, before the fly has sensed
anything at all.

**Why a scale sweep cannot fix any of this.** Issue 1 means every neuron's weight budget is already near the same
ceiling before `synapticScale` is chosen, so there is no scale at which "most neurons are near threshold, a few are
far above or below" — they move together. Issue 2 means that even if a scale were found that left genuine headroom,
every neuron in a pool would still cross it on the same step, so the network would still look like one flip-flop per
pool rather than a population code. Issue 3 means the sensory *input* is already pre-saturated regardless of what
the rest of the network does with it. `calibration.md`'s own words — "without noise and a baseline, there is no
in-between setting" — describe exactly this: a setting below the saturating scale lets signal die before reaching
the descending neurons (nothing survives the sparse, mostly-irrelevant selected-subgraph weights), and a setting at
or above it saturates everything uniformly (because the weights behind it are already uniform). There is no
parameter value in between because the space being searched does not contain one.

## Decision

All three structural issues are fixed together, plus the calibration that depends on them. Implementing one without
the others reproduces the same wall from a different angle (spec FR-008 / "Why this is one feature, not four").

### D4′. Weights: normalised per target neuron over its real admitted inputs, not its selected ones

New `weightRule` value, `"postFractionAbsolute"`, alongside the existing `"postFraction"` (kept, for any snapshot
that still declares it — a backward-compatible addition, not a redefinition of the existing documented value, per
`AGENTS.md`'s contract rule):

```text
weight(i→j) = sign(i) × synapses(i→j) / Σ_{k admitted, k→j real} synapses(k→j)   (sum over every admitted
                                                                                    presynaptic k with a real
                                                                                    edge into j, not only the
                                                                                    selected ones)
```

**Where this lives in `selection_forager.py`:** `select_forager` already computes `pre_i, post_i, syn` — dense
indices into the full *admitted*-body universe (`ids`, sized to every body that passed dataset admission, output-pool
outgoing edges already dropped per D3 step 5) — before `local` restricts anything to the final, budgeted selection.
Today's `total_in = np.bincount(dst, weights=raw, minlength=count)` sums only over `inside`-filtered (both ends
selected) edges. The fix sums over `post_i` alone (every real, admitted presynaptic edge into a selected post
neuron, regardless of whether its source survived selection): `total_in_full = np.bincount(post_i, weights=syn,
minlength=n)` (sized to the full admitted universe `n`, not `count`), then each `inside` edge divides by
`total_in_full[post_i[inside]]` instead of the selected-only `total_in[dst]`. Each selected neuron's total modeled
input weight is then the *true* fraction of its real connectivity the selection captured — at most 1 as before
(the selected total can only be ≤ the real total), but no longer pinned near 1 regardless of selection coverage.

Each neuron's total absolute input weight stays at most 1 in magnitude (D4's own invariant, `_check_inflow`,
unchanged); it is simply no longer rescaled *up* to approach that bound when the selection is a small slice of the
real graph.

**Config and container:** `extract/configs/forager-brain.json` sets `weightRule: "postFractionAbsolute"`.
`extract/malecns_brain/config.py` and `container.py` accept both `"postFraction"` and `"postFractionAbsolute"` as
legal values (a config/snapshot must still name exactly one). No `formatVersion` or container-version bump: the
binary layout, the CSR invariants, and the key's type are unchanged — only a new accepted value for an existing
key, the same shape of change as L6's `outputScale` gaining an object form (ADR 004) was to its own key.
`public/js/brain/snapshot.js`'s `_check_forager`-equivalent (`checkForager`/whatever the JS reader's matching
function is named) accepts the same two values.

### L7. Per-neuron membrane noise, default off, to desynchronize pools and seed sub-threshold firing

New `lif-v1.js` parameter, `noiseAmplitude` (default `0`). When nonzero, each step adds an independent,
per-neuron, uniformly distributed term in `[−noiseAmplitude, +noiseAmplitude]` to the membrane update, drawn from a
PRNG stream dedicated to noise and seeded, like `thresholdJitter`'s, from the network's own seed — but a **separate**
`createPrng(seed)` instance from the jitter one, so enabling or disabling `thresholdJitter` never shifts the noise
sequence and vice versa (G14 below). The stream is consumed once per neuron per step, in index order, for every
step the network runs (not only at `createNetwork` time, unlike `thresholdJitter`'s one-time draw) — this is the one
piece of per-step state `lif-v1.js` did not previously need:

```text
v[i] += (dt/tau)(vRest − v[i]) + input[i] + external[i] + noise[i]        // noise[i] = 0 when noiseAmplitude = 0
noise[i] = noiseAmplitude × (2 × rand() − 1)                              // drawn fresh every step, every neuron
```

`noiseAmplitude: 0` (the default) performs no draw at all — `rand()` is never called — so **G1** (bit-exact to
`lif-v0.js` with default parameters) is preserved unconditionally, the same discipline as every other L-mechanism.

This single mechanism does two jobs the spec treats as one requirement (FR-004/FR-006), because they are the same
mechanism applied to two populations that already exist in the network:

- **Pool desynchrony (FR-004).** A pool of neurons with identical drive and identical start state now has
  independent per-neuron noise, so they do not all cross threshold on the same step. The pool's activity becomes a
  graded fraction of active members instead of an all-or-nothing flip.
- **Sub-threshold, noise-driven sensory rest (FR-006).** Once `stimulus.resting`/`gain` are recalibrated (below) so
  that `V∞ = τ·I` sits *below* `vThreshold` at zero or low odour intensity, a sensory neuron's membrane sits under
  threshold on average, and only the noise term occasionally pushes it over — low, non-sustained firing instead of
  today's tonic firing. No odour means quiet-plus-noise, not silence and not saturation.

`noiseAmplitude` is a network-wide scalar, like `synapticScale` and `tauSyn`/`tauAdapt` — not a per-channel setting.
A world that wants sensory-only noise without interneuron-bulk noise is a smaller follow-on (an `outputScale`-style
per-role override), not required to satisfy this spec's four issues; the recalibration protocol below checks
whether one scalar value can satisfy both jobs before anyone reaches for that.

### D6. Sensory resting and gain: recalibrated so rest is sub-threshold, not a baseline rewrite

`stimulus.resting`, `stimulus.gain`, and the hunger modulator's `gain: [g0, g1]` are **world-config values**, not a
new mechanism — no contract change, only new calibrated numbers (`world-forager.json`'s `flies.stimulus` and the
snapshot's `modulators` section, per the existing `container-v4.md` M1–M3 rules). The target, from L7's own
derivation: pick `resting`/`gain`/`g0`/`g1` such that `τ · (resting × g0)` (the lowest reachable drive: no odour,
`hunger = 0`) sits at or below `vThreshold`, while `τ · (max_intensity × gain × g1)` (the highest reachable drive)
still clears it comfortably — leaving `V∞` graded across the odour's working range instead of saturating at both
ends. `tau` and `vThreshold` themselves are candidates too if `resting`/`gain` alone cannot cover the needed range
without also starving the interneuron bulk's own excitability; the recalibration protocol decides which knobs move.

### Recalibration protocol (extends ADR 004's)

All four changes interact, so this is one sweep, not four:

1. Re-extract `forager-brain.brain` under `weightRule: "postFractionAbsolute"` (D4′) before any LIF-level
   calibration — the weight distribution itself has changed, so every number in `specs/008-hungry-forager-brain/
   calibration.md` and ADR 004's Annex A is now stale and not a valid starting grid.
2. Extend the calibration script with: (a) ADR 004's `far-forward`/`far-feed` saturation diagnostic; (b) a
   **pool-synchrony diagnostic** — for a representative sensory pool (e.g. one side's odour-sensing channel), the
   fraction of steps where every neuron in the pool spikes together, at `noiseAmplitude = 0` vs. the candidate
   value; (c) a **sensory-gradient diagnostic** — mean firing rate of that same pool at several fixed, representative
   odour intensities (none, low, mid, high), checking for a monotonic, multi-level response rather than a
   three-level step function.
3. Sweep, on calibration seeds only: `synapticScale` and `outputScale` (now searched against a non-uniform weight
   distribution, so the prior 10–60 range is a starting point, not a bound), `noiseAmplitude`, and
   `stimulus.resting`/`gain` (or `tau`/`vThreshold` if those alone cannot cover the needed range, D6). Hold
   `tauAdapt`/`adaptStep` at their shipped values unless the saturation diagnostic shows they are still needed to
   reach `feed`'s threshold once the structural fixes land.
4. Selection order, extending ADR 004's: (a) `far-forward`/`far-feed` not pinned near 1.0; (b) the pool-synchrony
   diagnostic shows desynchronized firing under identical drive; (c) the sensory-gradient diagnostic shows more than
   three distinguishable rate levels; (d) `feed` still reliably crosses `feedThreshold` near food; (e) `find` rate
   stays above the random-walk and size-matched random-graph baselines (both re-run under the new weight rule, per
   spec Edge Cases).
5. **Validate every candidate on held-out seeds** before adopting it — non-negotiable, per ADR 004 Annex A.3's own
   cautionary example and spec FR-009/SC-005.
6. Record the sweep and its held-out verdict as a new dated entry in `specs/008-hungry-forager-brain/
   calibration.md`, same table format as the existing entries. Only on a held-out pass, update
   `world-forager.json`'s `flies.stimulus`/`flies.brain.lif` and `extract/configs/forager-brain.json`'s `weightRule`.

## Consequences

- Fixes the structural reason a parameter sweep could never find an in-between `synapticScale`: once truncated
  neurons stop being rescaled up to a full budget, the network's weight distribution is no longer uniform before
  scaling, so a single scale can leave real headroom for some neurons while still driving others across threshold.
- Pools stop acting as one neuron wearing N bodies; per-neuron variability is reproducible per seed (G12/G14 below),
  so this is not "add randomness and hope" — the same seed always gives the same desynchronized pattern.
- Widens the calibration search space considerably (two structural changes plus their own new parameters,
  `noiseAmplitude` and the sensory resting/gain pair, on top of `synapticScale`/`outputScale`); the recalibration
  protocol's three diagnostics (saturation, pool-synchrony, sensory-gradient) bound this the way ADR 004's single
  saturation diagnostic bounded its own, smaller search.
- Every existing `.brain` snapshot built under `weightRule: "postFraction"` keeps reading exactly as it does today
  (D4′ adds a value, it does not remove or redefine one); `mock`, `v0`, and any `v1` world that does not set
  `noiseAmplitude` are unaffected (L7 is off by default).
- Does not by itself manufacture a brake for `forward` on food (ADR 004's own caveat still applies) — it removes a
  different, lower-level obstacle (uniform saturation and lockstep firing) that would have defeated a brake
  mechanism's calibration just as it defeated everything before it.
- `lif-v0.js` is untouched.

## Open questions

- Is one scalar `noiseAmplitude` enough, or will the sensory pools and the interneuron bulk need independent noise
  levels (an `outputScale`-style per-role split) to hit both the pool-synchrony and the saturation targets at once?
  Step 3 of the recalibration protocol is where this would first show up as "no single value satisfies both
  diagnostics."
- `stimulus.resting`/`gain` recalibration interacts with the hunger modulator's own `gain: [g0, g1]` range; whether
  the needed sub-threshold-at-rest condition is reachable through `resting`/`gain` alone, or needs `tau`/`vThreshold`
  to move too, is left to the recalibration protocol rather than fixed here (D6).
- The connectome-search "brake" question (BUG-002's 10 candidate neurons, pathway-aware interneuron selection)
  remains a separate, likely-still-necessary follow-on, as ADR 004 already noted — this ADR does not attempt it.

## Related

- [ADR 003](003-hungry-forager-brain.md) — D4 (the weight rule this amends), L1–L5.
- [ADR 004](004-output-pool-synaptic-scale.md) — L6 (`outputScale`), the saturation measurements (Annex A) this
  ADR's context section builds on, and the recalibration protocol this one extends.
- `specs/008-hungry-forager-brain/calibration.md` — the original `synapticScale` grid and its "no in-between
  setting" finding this ADR explains structurally.
- `specs/011-dynamical-regime/spec.md` — the feature spec this ADR designs.

## Annex: implementation and recalibration measurements (2026-10-09)

Mirrors ADR 004 Annex A's own after-the-fact measurement record. Full sweep tables, grid definitions, and the
held-out verdicts are in `specs/008-hungry-forager-brain/calibration.md`'s 2026-10-09 entry; this Annex summarises
what was actually measured against what this ADR predicted.

### A.1 D4′ (weight rule): implemented and measured as predicted

Re-extracting `forager-brain.brain` under `weightRule: "postFractionAbsolute"` left neuron/edge counts unchanged
(3408 neurons, 205129 edges — selection untouched) and changed only weight *values*, exactly as D4′ specified.
Mean per-neuron absolute inflow dropped from ≈1.0 (under `postFraction`, every selected neuron rescaled up to near
the budget ceiling) to **mean 0.478, median 0.460, p10 0.146, p90 0.902** under `postFractionAbsolute` — confirming
the predicted effect (truncated neurons' weights are no longer inflated) and that the drop is heterogeneous across
neurons, not a uniform rescale. Determinism held: two extraction runs were byte-identical apart from
`provenance.createdAt`. `extract/tests/test_selection_forager.py`'s new test measures this directly on body 501 of
the synthetic fixture: inflow 1.0 (`postFraction`) vs. 5/14 ≈ 0.357 (`postFractionAbsolute`), the true fraction of
its real admitted inputs that selection captured.

### A.2 L7 (`noiseAmplitude`): mechanism verified; not the pool-synchrony fix this ADR expected

On a true synthetic lockstep pool (20 neurons, no recurrent connections, identical drive, identical start state —
`tests/lif-v1.test.mjs` L7(c)), `noiseAmplitude: 0.3` measurably desynchronizes it (lockstep fraction drops from
>0.9 to well below) where `noiseAmplitude: 0` does not — the mechanism itself works exactly as designed, and G11–
G15 (no-op, reproducibility, desynchrony, independence from `thresholdJitter`, validation) all pass.

But on the **real, re-extracted brain**, `scripts/dynamical-diagnostics.mjs --channel=odour-left` measured **0.0 %
lockstep at `noiseAmplitude: 0`**, before `noiseAmplitude` is even introduced — the real connectome's own
recurrent heterogeneity already desynchronizes this particular channel, independent of this ADR's changes. This
ADR's issue 2 ("a pool is one neuron wearing N bodies") does not manifest on `odour-left` in isolation. Whether any
other pool in the real brain *does* exhibit the hypothesised lockstep failure was not checked (only `odour-left`
and `odour-right` were sampled) — a gap for a future pass, not evidence the mechanism is unneeded, since the
diagnosis below (short eat bouts) independently implicates the *new weight heterogeneity itself* in destabilizing
network activity, a related but distinct effect from literal spike-timing lockstep.

### A.3 D6 (sensory resting/gain): the floor target is met, at `hunger: 0`

`resting: 0.05` (down from the shipped `0.2`) satisfies D6's derived target at the lowest reachable drive
(`τ · resting · g0 = 20 × 0.05 × 0.5 = 0.5 ≤ vThreshold = 1`) and produces a clean, monotonic four-level
sensory-gradient response at `hunger: 0`: **0, 0.216, 0.297, 0.332** spikes/step/neuron at intensity none/low/
mid/high. At `hunger: 1`, the floor itself clears threshold (`20 × 0.05 × 1.5 = 1.5 > 1`) and the "none" level
saturates — D6's formula is explicitly for `hunger: 0`, so this is the predicted edge of its coverage, not a
contradiction, but it means the graded response this ADR's L7+D6 combination targets is confined to low-hunger
flies today. `gain`/`tau`/`vThreshold` were not moved; `resting` alone reached the target.

### A.4 The recalibration protocol: did not converge to a held-out-passing candidate

112 grid points across four sweeps found candidates with real `far-forward` headroom (down to 0.145–0.184 from
the pre-feature ~0.981–0.986) and substantial eat-bout counts on calibration seeds (up to 106 bouts), satisfying
protocol step 4(a)–(c) reasonably well. Both candidates taken to held-out validation **failed** step 4(d)/(e) and
the eat/hunger-dependence gates: `v1` find rate (14.4 % and 18.3 %) stayed below the random-walk baseline (23.3 %)
both times, and eat bouts, while numerous, were too short (≈2 ticks average) to pass the hungry-vs-sated median
gate. The root cause traced to this ADR's own D4′ change: weights are no longer uniform (mean inflow 0.478,
heterogeneous from 0.146–0.902), so moment-to-moment network activity is itself more variable than the old,
artificially-uniform regime — `forward` does not stay below `eatSpeed` for enough consecutive ticks to sustain a
bout, even at `noiseAmplitude: 0` (ruling out L7 as the cause). A `tauSyn: 3` probe (existing L1 synaptic
filtering, not part of this ADR's own mechanism set) improved average bout length from 2.06 to 2.73 ticks but was
not carried to a third held-out validation within this pass.

**Consequence**: `extract/configs/forager-brain.json`'s `weightRule: "postFractionAbsolute"` and the re-extracted
`forager-brain.brain` are kept (D4′ and L7 are both independently correct and shipped), but
`public/world/world-forager.json` is **unchanged** from its pre-ADR-005 values — which this Annex's "before"
measurement shows gives **0 % find rate** against the new brain, a more severe mismatch than this ADR's own
"Consequences" section anticipated ("every existing `.brain` snapshot ... keeps reading exactly as it does
today" is true of the snapshot *format*, but the shipped *world config*'s numbers no longer match the shipped
brain's weight distribution). Resolving this mismatch — continuing from the `tauSyn` lead, or revisiting
`tauAdapt`/`adaptStep` — is the immediate next step for whoever picks up this ADR's open recalibration.

## Annex B: regime-gated recalibration, L7′ and L8 (2026-10-09, second pass)

Annex A's diagnosis ("weight heterogeneity makes activity flicker") did not survive direct measurement. This Annex
records what did, the two LIF mechanisms added because of it, and the calibration protocol that replaces step 3–4
of the one above. Full tables: `specs/008-hungry-forager-brain/calibration.md`, 2026-10-09 second-pass entry.
Contract: `specs/011-dynamical-regime/contracts/lif-v1-regime.md`, folded into the canonical `lif-v1.md`.

### B.1 What the first pass's best candidate actually did

Measured at `synapticScale` 150, `outputScale.forward` 4, `noiseAmplitude` 0.2, `resting` 0.05:

1. **No brake, a degenerate eat.** Net forward 0.175 far from food and 0.161 on food, against an eat threshold of
   `eatSpeed / maxSpeed` = 0.167; the fly sat under the threshold 42 % of all ticks, anywhere. Eating happened when
   readout noise (s.d. 0.045 on a 2-neuron DNp09 pool) dipped forward below threshold on a flower — hence ≈2-tick
   bouts and a find rate below the random walk (the fly was slow everywhere).
2. **Saturation that ignores input.** 55–66 % of the 3,408 neurons spiked every tick whatever the input; feed read
   ≈0.985 with no taste; taste moved forward by −0.015 to +0.01.
3. **Noise as the dominant input.** With no sensory input, `noiseAmplitude` 0.2 alone drove 15–55 % activity at
   scales ≥ 20 (0 % without noise), and erased the lateral steering signal (at scale 80: left-vs-right turn
   contrast 0.235 without noise, 0.011 with it).
4. **The `tauSyn` stall.** DNp09 is fluctuation-driven (mean input below threshold). L1's low-pass filter removes the
   fluctuations: at scale 40, `tauSyn` 3, odour-only forward fell from 0.205 to 0.004 — the stalled fly.
5. **The real driver: the sensory floor.** With `resting` 0.05 the no-odour floor reaches threshold from hunger 0.5
   up (τ · resting · gain(h) = 20 × 0.05 × 1.0 = 1.0). D6 was derived at hunger 0 only. The ORNs fire at rest, and
   the network amplifies that into the same activity it shows with odour.

### B.2 Decisions

- **L7′ `noiseBulkScale`** (default 1, a no-op). Noise for neurons outside the declared input pools is
  `noiseAmplitude × noiseBulkScale`; at 0, noise stays on the sensory pools, L7's own target. Answers this ADR's open
  question: one network-wide scalar is not enough, because the recurrent bulk amplifies it (B.1.3).
- **L8 `inhibitoryScale`** (default 1, a no-op). Multiplies every negative edge weight once at `createNetwork`. In a
  brain-only probe it was the strongest single lever found (×2 at scale 150: activity 0.58 → 0.30, first
  correct-sign brake, food-gated feed, lateral contrast 0.55). It scales the dataset's own inhibitory edges and adds
  or removes none (Principle III).
- **D6 corrected:** the floor must be sub-threshold at **every** hunger: τ · resting · g1 < vThreshold, i.e.
  `resting` < 1 / (20 × 1.5) ≈ 0.033 for the shipped modulator. `resting` 0.02 is adopted.
- **Calibration in stages** (`scripts/calibrate-forager.mjs`): **A1** brain-only regime gates (quiet at rest,
  responsive to odour, not saturated, lateralized raw input toward the odour side, positive raw forward drive) with
  a robustness rule (half of the grid neighbours must pass too); **A2** per-channel `outputScale` fitted to a target
  operating point — valid separately because output neurons have no outgoing edges (ADR 003 D3), so `outputScale`
  never changes the network; **B** world runs on calibration seeds for the robust top points only. `tauSyn` and
  `motorSmoothing` are swept as part of the grid, never alone (B.1.4). Brake and feed contrast are reported, not
  gated.

### B.3 Result: the subgraph is bistable, and the shipped point walks rather than rests quietly

- A1 passed 0 of 200 points at the shipped `resting` 0.05, and 74 of 360 with `resting` 0.02. The best of those
  (`synapticScale` 50, `inhibitoryScale` 1, noise off) **passed held-out find** (35.6 % vs random walk 23.3 %,
  size-matched random graph 2.2 %), but was exactly silent with no odour. Forward was 0, so a fly out of odour range
  never moved, and the activity view was blank (`tests/activity-counts.test.mjs`).
- Two gates were added, as spontaneous activity at rest: rest activity ≥ 0.002 and positive raw forward input at
  rest. The rest ceiling was relaxed to 0.1.
- Input-only noise (L7′) at any gain that drives the descending neurons **ignites** the network: rest jumps from
  0.000 at input noise 0.07 to 0.12–0.27 at 0.08. A graded, spontaneously active regime exists only at
  `synapticScale` 10–20, where the input reaching the 2-neuron DN pools (≈1e-4) is too small for any readout gain
  (world find 6.7–10 %).

**Consequence.** In this brain, "quiet at rest" and "walks and steers" cannot both hold. The user chose the walking
fly: the held-out candidate plus `noiseAmplitude` 0.08, `noiseBulkScale` 0 (calibration find 56.7 %; **held-out find 51.7 %** [44.4, 58.9] vs random walk 23.3 %, hunger dependence
+2.2 %, eat FAIL). L7′ is in use; L8 stayed at 1 for the shipped point, though it was decisive for the A1 pass set at
higher scales. A quiet, reactive rest likely needs more of the real circuit (for example, the inhibitory local interneurons that
stabilize the antennal lobe, if the current selection under-represents them; not checked here), which is the same
pathway-aware selection question the brake raises.

### B.4 Still open: the brake is structural

Across every tested point the best raw brake was a 10–15 % cut in forward input, and at most points taste *raises*
forward. Eating needs forward below 0.167 on a flower, roughly an 80 % cut. No LIF parameter creates a missing
taste → stop pathway; it needs the selection to include brake neurons (BUG-002's candidates, pathway-aware
selection). That is the next brain generation's job; this calibration accepts a brain that finds food and does not
stop to eat.
