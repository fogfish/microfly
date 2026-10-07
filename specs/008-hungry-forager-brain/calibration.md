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
