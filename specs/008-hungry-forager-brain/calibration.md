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
