# Calibration (T096): the forager brain's LIF settings

- **Date:** 2026-10-05
- **Seeds:** `experiment.seeds` = 6, 7, 8, 9, 10 (calibration). The held-out seeds (101–130) were not used here.
- **Runs:** the main cohort of the v1 arm (6 flies per seed, 3,000 ticks), `scripts/calibrate-forager.mjs`, run in four shards.
- **Grid:** `synapticScale` ∈ {10, 20, 30, 50} × `tauSyn` ∈ {0, 5} × (`tauAdapt`, `adaptStep`) ∈ {(0, 0), (20, 0.05)}. Every other value is the world file's.

## Result

| synapticScale | tauSyn | tauAdapt | adaptStep | flies found | find | eat bouts | eat ticks |
|---|---|---|---|---|---|---|---|
| 10 | 0 | 0 | 0 | 21/30 | 70.0 % | 0 | 0 |
| 10 | 0 | 20 | 0.05 | 6/30 | 20.0 % | 0 | 0 |
| 10 | 5 | 0 | 0 | 20/30 | 66.7 % | 0 | 0 |
| 10 | 5 | 20 | 0.05 | 12/30 | 40.0 % | 0 | 0 |
| 20 | 0 | 0 | 0 | 23/30 | 76.7 % | 0 | 0 |
| 20 | 0 | 20 | 0.05 | 25/30 | 83.3 % | 0 | 0 |
| 20 | 5 | 0 | 0 | 25/30 | 83.3 % | 0 | 0 |
| 20 | 5 | 20 | 0.05 | 19/30 | 63.3 % | 0 | 0 |
| 30 | 0 | 0 | 0 | 3/30 | 10.0 % | 0 | 0 |
| 30 | 0 | 20 | 0.05 | 26/30 | 86.7 % | 0 | 0 |
| 30 | 5 | 0 | 0 | 10/30 | 33.3 % | 0 | 0 |
| 30 | 5 | 20 | 0.05 | 18/30 | 60.0 % | 0 | 0 |
| 50 | 0 | 0 | 0 | 0/30 | 0.0 % | 0 | 0 |
| 50 | 0 | 20 | 0.05 | 15/30 | 50.0 % | 348 | 447 |
| 50 | 5 | 0 | 0 | 7/30 | 23.3 % | 0 | 0 |
| 50 | 5 | 20 | 0.05 | 9/30 | 30.0 % | 0 | 0 |

## Choice

`synapticScale` 50, `tauSyn` 0, `tauAdapt` 20, `adaptStep` 0.05 (the only setting with eating).

**Reason.** The criterion was: the fly finds food and eats. Every setting finds food at some rate, but only one setting
eats (348 bouts, 447 eating ticks across 30 flies). It has a 50 % find rate. The highest find rates (83–87 % at scale 20–30)
never eat, so the fly walks through flowers without stopping. Choosing them would fail the Eat metric by construction.

## Not searched (recorded as out of scope for this pass)

- `thresholdJitter`, `stepsPerTick` (kept at 5), `consumeRate`, `regrowth`, `eatSpeed`, `antennaOffset`, the odour `gain`
  and `resting`, and the modulator gains. They keep their starting values in `world/world-forager.json`.
- The grid is coarse: four scales, two `tauSyn` values, two adaptation settings. Eating appears only at scale 50 with
  adaptation, so a finer search around 40–70 might find a setting with more eating and a higher find rate.

## Diagnosis that led to the grid

- Output drives were silent at the first placeholder scale (0.2). `postFraction` weights are about 1/in-degree, so a single
  spike contributes about 0.01 × scale. Readouts fire only at much larger scales.
- The runner did not scale output rates by the ceiling 1/(refractorySteps+1) (ADR 003 W4). That is fixed: with it, feed
  can reach its 0.5 threshold.
- The LIF core allocated an array on every step. That is removed, and G1 (bit-exact with defaults) still passes.

# 2026-10-07 — BUG-002: per-channel `outputScale.feed` sweep (ADR 004's Recalibration protocol, steps 2–5)

- **Date:** 2026-10-07
- **Seeds:** `experiment.seeds` = 6, 7, 8, 9, 10 (calibration). Held-out seeds were **not used** — see Verdict below.
- **Runs:** the main cohort of the v1 arm (6 flies per seed, 3,000 ticks), a one-off script adapted from
  `scripts/calibrate-forager.mjs`, not committed (ad hoc, kept for reproducibility: see the per-run parameters below).
- **Grid:** `outputScale.feed` ∈ {5, 10, 20, 30, 40}, holding `outputScale.forward` = `outputScale.backward` =
  `outputScale['turn-left']` = `outputScale['turn-right']` = 5 (the value already live in `world-forager.json`
  for navigation) and every other `brain.lif` value at the world file's own (`synapticScale` 50, `tauAdapt` 20,
  `adaptStep` 0.05).

## Result

| outputScale.feed | flies found | find | eat bouts | eat ticks | far-forward | far-feed |
|---|---|---|---|---|---|---|
| 5 (shipped, shared) | 16/30 | 53.3 % | 0 | 0 | 0.6923 | 0.3748 |
| 10 | 16/30 | 53.3 % | 0 | 0 | 0.6923 | 0.7710 |
| 20 | 16/30 | 53.3 % | 0 | 0 | 0.6923 | 0.9742 |
| 30 | 16/30 | 53.3 % | 0 | 0 | 0.6923 | 0.9855 |
| 40 | 16/30 | 53.3 % | 0 | 0 | 0.6923 | 0.9862 |

`far-forward`/`far-feed`: mean drive value sampled only on ticks where the fly is off every food source's
declared reach (ADR 004 Annex A.2's own diagnostic). Zero eating bouts at every tested value — the per-channel
mechanism itself works (`far-forward` stays exactly 0.6923 throughout, confirming `feed`'s scale no longer drags
`forward` with it), but `feed`-crossing alone never produces eating.

**Near-food diagnostic** (same seeds/ticks, sampled only on ticks where the fly stands on a stocked food cell;
`eatSpeed` = `feedThreshold` = 0.5, `maxSpeed` = 3):

| outputScale.feed | near-food ticks | mean forward | mean feed | mean speed | % speed < eatSpeed | % feed > feedThreshold | % both (= eating) |
|---|---|---|---|---|---|---|---|
| 5 | 352 | 0.6861 | 0.3660 | 2.0110 | 0.00 % | 3.98 % | 0.00 % |
| 10 | 352 | 0.6861 | 0.7808 | 2.0110 | 0.00 % | 91.76 % | 0.00 % |
| 20 | 352 | 0.6861 | 0.9791 | 2.0110 | 0.00 % | 100.00 % | 0.00 % |

## Verdict: no candidate passes the calibration-seed screen — held-out seeds were not used

Per ADR 004's Recalibration protocol step 4 ("validate every candidate on held-out seeds before adopting it"),
held-out validation is for a candidate that already passed calibration-seed screening. None did here — eating
requires `speed < eatSpeed` **and** `feed > feedThreshold` simultaneously (`energy.js`'s `canEat`), and `% speed <
eatSpeed` is 0.00 % near food at *every* tested `outputScale.feed`, so `% both` (the only column that matters for
eating) is 0.00 % throughout. Raising `feed` only ever moves the `% feed > feedThreshold` column — by `feed =
10` it is already at 91.76 %, recreating a feed-side saturation problem of its own (feed crosses its threshold
almost everywhere near food, not gradedly) — while the binding constraint, `speed`, never moves at all, because
`outputScale.forward` was (correctly, per this sweep's own design) held fixed at the value already validated for
navigation.

**Root cause**: `mean speed` near food is 2.011, independent of `outputScale.feed`, because `speed = maxSpeed ×
forward` (`body.js`) and `mean forward` near food (0.6861) is unaffected by `feed`'s scale — exactly the
per-channel isolation this feature was built to guarantee (BUG-002's own fix), confirmed working correctly. But
it also means **this feature's mechanism cannot by itself close BUG-002's original "never slows down to eat"
gap**: `forward` would need to drop under `eatSpeed / maxSpeed` ≈ 0.167 near food for eating to become reachable
at all, a roughly 4× cut from its current 0.69 — `outputScale.forward = 5` was validated only for *un-pinning*
`forward` from the pre-feature ~0.98 ceiling (ADR 004's own navigation goal), never for enabling eating. Lowering
`outputScale.forward` further is a real, additional trade-off against the find rate (53.3 % here) that this sweep
did not explore, since it was scoped to hold `forward` fixed — exactly the "joint sweep" ADR 004's own "Open
questions" section anticipated might be needed, and the fallback it names ("a smaller follow-on") if `feed`
cannot be satisfied independently of `forward`.

**Decision**: `world-forager.json`'s `flies.brain.lif.outputScale` is **not** changed by this sweep — it stays
the scalar `5` already shipped. Per this feature's Phase 5 (BUG-002) checkpoint ("if a held-out-valid value is
found, fixed" — none was), updating it would be tuning without a passing candidate, which this record exists to
avoid. A follow-on joint `(outputScale.forward, outputScale.feed)` sweep — or the separate connectome-search
"brake" question ADR 004 and `specs/008-hungry-forager-brain/bugs/BUG-002.md` both already flag as out of scope
here — is the next step, not a further `feed`-only search.

# 2026-10-09 — ADR 005 recalibration pass (`postFractionAbsolute`, `noiseAmplitude`, sensory resting): no candidate passes held-out

- **Date:** 2026-10-09
- **Seeds:** `experiment.seeds` = 6, 7, 8, 9, 10 (calibration, every sweep below). Held-out seeds (101–130) used
  **only** for the two final validation runs named below — never for grid search.
- **Runs:** `scripts/calibrate-forager.mjs` (extended with the `far-forward`/`far-feed`/`near-forward`/`near-feed`
  saturation columns, ADR 005 step 2(a); `{lif, stimulus}` overrides for the new `outputScale`/`noiseAmplitude`/
  `resting` dimensions) for every grid below; `scripts/dynamical-diagnostics.mjs` (new; pool-synchrony and
  sensory-gradient diagnostics, ADR 005 steps 2(b)/2(c)) for the diagnostics; `scripts/compare-baseline.mjs
  --seeds=held-out` for the two held-out validations.
- **Prerequisite (protocol step 1):** `forager-brain.brain` re-extracted under `weightRule: "postFractionAbsolute"`
  (`extract/configs/forager-brain.json`), confirmed byte-identical across two runs apart from `provenance.createdAt`,
  same neuron/edge counts as before (3408 neurons, 205129 edges — selection is untouched, only weight values moved).
  Mean per-neuron absolute inflow dropped from ≈1.0 (pinned near the budget ceiling under `postFraction`) to a
  **mean 0.478, median 0.460, p10 0.146 – p90 0.902** under `postFractionAbsolute` — confirming D4′'s predicted
  effect (truncated neurons' weights are no longer rescaled up) and that the drop is heterogeneous, not a uniform
  scale factor.

## "Before" measurement (protocol step 2, T034): the current, not-yet-recalibrated world on the new brain

Running the shipped `world-forager.json` values (`synapticScale: 50`, `outputScale` `{feed:30, forward:2,
backward:5, turn-left:5, turn-right:5}`, `resting: 0.2`, no `noiseAmplitude`) against the **re-extracted**
(`postFractionAbsolute`) brain, unchanged from their `postFraction`-tuned values:

| find | far-forward | far-feed | near-forward | near-feed |
|---|---|---|---|---|
| 0.0 % (0/30) | 0.029 | 0.339 | n/a (never near food) | n/a |

The weight-rule change alone, with no recalibration, breaks foraging completely — confirming the ADR's own
expectation that the shipped numbers are stale under the new weight distribution, and giving the sweep below a
"zero" to improve on. `dynamical-diagnostics.mjs --channel=odour-left` on this same world: pool-synchrony 0.0 %
lockstep even at `noiseAmplitude: 0` (the real connectome's own recurrent heterogeneity already desynchronizes
this pool — see "Pool-synchrony finding" below); sensory-gradient at `hunger: 0.5` collapses to ≈0.30–0.33
spikes/step/neuron for every intensity above zero (ADR 004's saturation pattern, reproduced).

## Sweep 1 (protocol step 3): `synapticScale` × `outputScale` (uniform multiplier) × `noiseAmplitude` × `resting`

**Coarse grid** (24 points, 3000 ticks): `synapticScale` ∈ {50, 100, 200} × `outputScale` multiplier ∈ {1, 3}
(scaling the shipped per-channel map `{feed:30, forward:2, backward:5, turn-left:5, turn-right:5}` uniformly) ×
`noiseAmplitude` ∈ {0, 0.2} × `resting` ∈ {0.05, 0.2}. Full table in `/tmp/sweep-coarse.json` (not committed — ad
hoc run). Finding: `synapticScale: 50` × multiplier `3` is the only region with substantial eating (49–97 bouts);
`synapticScale ≥ 100` saturates `far-feed` to ≈0.98 and eating collapses to near zero.

**Refinement** (54 points, 3000 ticks): `synapticScale` ∈ {40, 50, 60} × multiplier ∈ {2, 3, 4} × `noiseAmplitude`
∈ {0, 0.05, 0.1, 0.15, 0.2, 0.3} × `resting: 0.05`. Full table in `/tmp/sweep-refine.json`. Best-looking point:
`synapticScale: 50`, multiplier `3` (→ `outputScale` `{feed:90, forward:6, backward:15, turn-left:15,
turn-right:15}`), `noiseAmplitude: 0.2`, `resting: 0.05`: 57 bouts, 186 eat ticks, `far-forward` 0.145, `far-feed`
0.348, `near-feed` 0.734 — real headroom on both saturation columns, feed clearly separated near food.

**Held-out validation #1 — FAILED.** Written to `world-forager.json`, run with `compare-baseline.mjs
--seeds=held-out`:

| | v1 | baseline (random walk) |
|---|---|---|
| find | 14.4 % | **23.3 %** |
| eat (hungry/sated median) | 1 / 1 ticks — **FAIL** | n/a |
| hunger dependence | −2.8 % — **FAIL** | n/a |

`v1`'s find rate did not exceed the random walk, and both hunger-linked gates reversed. Reverted immediately
(`git checkout -- public/world/world-forager.json`), per ADR 004 Annex A.3's own precedent: a calibration-seed
win does not by itself justify shipping.

## Sweep 2: `synapticScale` × `outputScale.forward` alone (feed/backward/turn held at their original absolute values)

Sweep 1's uniform multiplier scaled `outputScale.feed` up alongside `forward`, but `far-feed` was already ≈0.985
under the **original**, pre-ADR-005 shipped settings (`specs/008-hungry-forager-brain/calibration.md`'s own
2026-10-07 entry, `outputScale.feed: 30` → `far-feed: 0.9855`) — `feed`'s saturation near 1.0 predates this
feature and is arguably the intended behaviour for a 2-neuron, concentrated-fan-in readout (ADR 004's own framing:
`feed` is *supposed* to reliably cross threshold near food). The real, ADR-005-relevant headroom target is
`forward` (the principal, larger navigation pathway) — so this sweep holds `feed`/`backward`/`turn-*` at their
original absolute values (BUG-002's per-channel independence) and varies `synapticScale` and `outputScale.forward`
alone.

**Targeted** (25 points, 1500 ticks for speed): `synapticScale` ∈ {100, 150, 200, 250, 300} × `forward` ∈
{1, 2, 3, 4, 6}, `noiseAmplitude: 0.2`, `resting: 0.05`. Full table in `/tmp/sweep-targeted.json`. `forward: 4` at
`synapticScale: 150` stood out: 48 bouts, 96 eat ticks, `far-forward` 0.178.

**Refinement** (9 points, 3000 ticks): `synapticScale` ∈ {125, 150, 175} × `forward` ∈ {3, 4, 5}. Full table in
`/tmp/sweep-refine2.json`. Best point: `synapticScale: 150`, `forward: 4`, `noiseAmplitude: 0.2`, `resting: 0.05`:
**106 bouts, 218 eat ticks, find 30.0 %, far-forward 0.176** (real headroom), `far-feed` 0.985 (saturated, same as
the pre-existing shipped behaviour — accepted, see above).

**Held-out validation #2 — FAILED.** Written to `world-forager.json`, run with `compare-baseline.mjs
--seeds=held-out`:

| | v1 | baseline (random walk) |
|---|---|---|
| find | 18.3 % | **23.3 %** |
| eat (hungry/sated median) | 1 / 1 ticks — **FAIL** | n/a |
| hunger dependence | −2.2 % — **FAIL** | n/a |

Better than #1 (18.3 % vs 14.4 %) but still below the random-walk baseline, and the eat/hunger-dependence gates
still fail. Reverted (`git checkout -- public/world/world-forager.json`).

## Diagnosis: short, flickering eat bouts — not caused by `noiseAmplitude`

Both held-out failures share the same symptom: `eat` bouts exist in large numbers on calibration seeds (up to 106)
but are very short (106 bouts / 218 ticks ≈ **2.1 ticks per bout**), giving a trivial held-out median of 1 tick for
both hungry and sated cohorts — too short and too similar to pass either eat-linked gate. A dedicated sweep at the
best point (`synapticScale: 150`, `forward: 4`, `resting: 0.05`, 3000 ticks) isolated the cause:

| noiseAmplitude | bouts | eat ticks | ticks/bout |
|---|---|---|---|
| 0 | 78 | 105 | 1.35 |
| 0.05 | 43 | 51 | 1.19 |
| 0.1 | 57 | 68 | 1.19 |
| 0.15 | 74 | 101 | 1.36 |
| 0.2 | 106 | 218 | **2.06** |

Bout length is short **even at `noiseAmplitude: 0`** — L7 noise is not the destabiliser; if anything, the highest
tested amplitude gave the longest average bout. The flickering tracks `postFractionAbsolute`'s own structural
effect instead: weights are no longer rescaled to a uniform ≈1 per neuron (mean dropped to 0.478, heterogeneous
from 0.146 to 0.902 — see above), so moment-to-moment network activity is itself more variable than under the old,
artificially-uniform weight regime, and `forward` does not stay below `eatSpeed` for many consecutive ticks the
way it used to. A quick `tauSyn` probe (synaptic low-pass filtering, already an existing L1 mechanism) at the same
point found `tauSyn: 3` improved ticks/bout to 2.73 but dropped find to 20.0 % — a real lead, but not pursued to a
third held-out validation within this pass's time budget.

## Pool-synchrony finding: the real connectome pool was never in perfect lockstep

`dynamical-diagnostics.mjs --channel=odour-left`, both before and after this sweep: the pool-synchrony fraction is
0.0 % at `noiseAmplitude: 0` on the **real, re-extracted brain** — the hypothesised failure mode (an
identically-driven, identically-initialized pool spiking in perfect lockstep every time) does not manifest on this
particular channel, because the real connectome's recurrent connectivity is already heterogeneous enough to
desynchronize it, independent of `postFractionAbsolute` or `noiseAmplitude`. This does **not** mean L7 is
unnecessary: `tests/lif-v1.test.mjs`'s L7(c) confirms the mechanism itself works correctly on a true synthetic
lockstep pool (no recurrent connections, identical drive) — `noiseAmplitude: 0.3` measurably desynchronizes it
where `0` does not. The real forager brain's `odour-left` channel simply was not exhibiting the hypothesised
failure mode in isolation; L7 remains available (and independently verified) for whichever population, if any,
does.

## Sensory-gradient finding: `resting: 0.05` meets D6's floor target cleanly, at `hunger: 0`

`dynamical-diagnostics.mjs --channel=odour-left --resting=0.05 --hunger=0`: **0, 0.216, 0.297, 0.332**
spikes/step/neuron at intensity none/low/mid/high — a clean, monotonic, four-level response with a genuinely
quiet floor (ADR 005 D6's target: `τ·resting·g0 ≤ vThreshold`, i.e. `20 × 0.05 × 0.5 = 0.5 ≤ 1`). At `hunger: 1`
(the hungriest a fly gets), the floor itself clears threshold (`20 × 0.05 × 1.5 = 1.5 > 1`) and the "none" level
saturates to the ceiling rate — matching D6's own stated target exactly (the formula is for `hunger: 0`, "the
lowest reachable drive," not every hunger level) but leaving the graded response confined to low-hunger flies,
an ADR-005-anticipated limitation ("Open questions": whether the hunger modulator's own `gain: [g0, g1]` needs to
move too).

## Verdict: no candidate passes held-out — `world-forager.json` and `extract/configs/forager-brain.json` are unchanged by this sweep

Per ADR 005's own protocol step 5 ("validate every candidate on held-out seeds... non-negotiable") and step 6
("only on a held-out pass, update `world-forager.json`'s values"), neither candidate is adopted. `extract/configs/
forager-brain.json`'s `weightRule: "postFractionAbsolute"` and the re-extracted `public/brains/forager-brain.brain`
**are** kept (User Story 2's own checkpoint — the weight-rule mechanism is correct, tested, and independent of
whether a recalibration is found), but **this leaves the shipped `world-forager.json` mismatched with the shipped
brain**: its `flies.brain.lif`/`flies.stimulus` values were tuned for `postFraction`'s now-superseded weight
distribution and, as the "before" measurement above shows, give 0 % find rate against the new brain — worse than
`specs/011-dynamical-regime/tasks.md`'s own anticipated "exactly as saturated as today" fallback. This mismatch is
a known, explicitly recorded consequence of shipping User Story 2 without a successful recalibration, not an
oversight; resolving it is the next recalibration pass's job (continuing from `tauSyn: 3`'s lead above, or
revisiting `tauAdapt`/`adaptStep`, both left at their shipped values throughout this pass per protocol step 3).

## Not searched (recorded as out of scope for this pass)

- `tauAdapt`/`adaptStep` (held at the shipped 20/0.05 throughout, per protocol step 3's "unless the saturation
  diagnostic shows they are still needed" — it did not clearly show this, though the short-bout finding above may
  implicate them too).
- A `tauSyn > 0` sweep combined with the `synapticScale`/`outputScale.forward` region (the one lead this pass
  found but did not validate on held-out seeds).
- A non-uniform hunger modulator `gain: [g0, g1]` (would require re-extracting the snapshot's `modulators` section,
  not just a world-config change).
