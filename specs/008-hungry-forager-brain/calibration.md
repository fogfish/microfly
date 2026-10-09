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

## Interim choice: silent at rest (held-out PASS, then rejected)

`synapticScale` 50, `inhibitoryScale` 1, `noiseAmplitude` 0, `tauSyn` 0, `tauAdapt` 20, `adaptStep` 0.05,
`outputScale` {feed 8, forward 32, backward 512, turn-left 128, turn-right 128}, `motorSmoothing` 0.02,
`stimulus.resting` 0.02, `stimulus.gain` 1. It tied for the best calibration find (43.3 %) with a passing hunger
dependence and the most consistent regime (all four readout variants beat the random walk). `backward` 512 and
`turn-*` 128 are where the A2 fit stopped short of its target (those pools are nearly silent at mid odour).

Held-out (`compare-baseline.mjs --seeds=held-out`, 30 seeds): v1 find **35.6 %** [28.9 %, 42.2 %], random-matched
2.2 % [0.6 %, 4.4 %], random walk 23.3 % [16.7 %, 29.4 %], mock 2.2 %; hunger dependence +0.6 % (PASS); eat FAIL.

**Rejected** after `tests/activity-counts.test.mjs` failed on it: with noise off and a sub-threshold floor, the brain is
exactly silent with no odour, so forward is 0 and a fly spawned out of odour range never moves, and the activity view
is blank there (BUG-002's activity requirement). A silent brain is not a resting fly.

## Spontaneous-activity gates (runs 3–5)

Two gates were added to A1: activity at rest ≥ 0.002 (`silent`) and raw forward input at rest > 0 (`still`). The rest
ceiling was raised from 0.05 to 0.1 (about 2 % of neurons per LIF step), because every spontaneously active point
failed 0.05 while the odour-gain gate already keeps rest well under the odour response. Spontaneous activity comes
from L7′: noise on the input pools only (`noiseBulkScale` 0).

| run | grid | pass | robust | outcome |
|---|---|---|---|---|
| 3 | scale {50…200}, input noise {0.1, 0.2, 0.3} | 0 | 0 | input noise ≥ 0.1 ignites the network: rest 0.11–0.48, as high as odour |
| 4 | scale {10…50}, input noise {0.1, 0.2, 0.3}, readout up to 8192 | 11 | 1 | graded regime exists at scale 10–20 (rest 0.06–0.08, odour 0.13–0.18, lateral 0.28–0.91), but the raw input to the DN pools is ≈1e-4: A2 saturated at 8192 on every channel, world find 6.7–10 % |
| 5 | scale {40, 50, 60} × inh {1, 1.5}, input noise {0.06…0.09} | 0 | 0 | a sharp ignition threshold between 0.07 (rest 0.000) and 0.08 (rest 0.12–0.27) |

**Finding.** In this subgraph, the recurrent gain needed to carry odour to the descending neurons makes the network
bistable: silent, or ignited by any sustained ORN activity. There is no spontaneously-active-but-quiet state at a
gain that also drives the DNs, so "quiet at rest" and "walks and steers" cannot both hold here. The trade-off was
put to the user, who chose the walking fly.

Ignited variant on calibration seeds (the interim choice + input noise 0.08, `noiseBulkScale` 0): find **56.7 %**
[40.0 %, 73.3 %] vs random walk 23.3 %; hunger dependence −6.7 % (FAIL); A1 rest 0.219, odour 0.330, lateral 0.093,
raw forward at rest +0.0048.

## Final choice (user decision): ignited rest

`synapticScale` 50, `inhibitoryScale` 1, `noiseAmplitude` 0.08, `noiseBulkScale` 0, `tauSyn` 0, `tauAdapt` 20,
`adaptStep` 0.05, `outputScale` {feed 8, forward 32, backward 512, turn-left 128, turn-right 128},
`motorSmoothing` 0.02, `stimulus.resting` 0.02, `stimulus.gain` 1.

**Reason.** The fly walks with no odour (spontaneous ORN firing via L7′ keeps forward above 0), steers on odour, and
the activity view is live everywhere. It costs a quiet rest (≈22 % of neurons active per tick without odour) and
calibration-seed hunger dependence. It does not eat, as accepted: the brake belongs to the next brain generation.

## Held-out validation of the final choice

`compare-baseline.mjs --seeds=held-out` (30 seeds, 6 flies per cohort, 3000 ticks):

| arm | find [95 % CI] | hunger dependence | eat hungry/sated (median ticks) |
|---|---|---|---|
| v1 | **51.7 %** [44.4 %, 58.9 %] | +2.2 % | n/a / 1 |
| random-matched | 3.3 % [1.1 %, 6.1 %] | −0.6 % | n/a |
| baseline (random walk) | 23.3 % [16.7 %, 29.4 %] | n/a | n/a |
| mock | 2.2 % [0.6 %, 4.4 %] | n/a | n/a |

PASS find (51.7 % > 23.3 %, the intervals do not overlap), PASS hunger dependence (+2.2 %), FAIL eat (no hungry
bout, one 1-tick sated bout), as accepted. Median approach 1604 ticks (42 flies included). The size-matched random
graph finds 3.3 %, so the find rate comes from the connectome's wiring. Better on held-out than the silent interim
choice (35.6 %): a fly that walks without odour reaches odour more often. Adopted: `public/world/world-forager.json`
carries the values above.

## Not searched

- A brake: the connectome subgraph has no taste → forward inhibition at any tested point (next brain generation).
- `stimulus.gain` below 1 reached A1 but not the robust top points; `tauSyn` 2 likewise.
- Input noise between 0.07 and 0.08, and `thresholdJitter` as a second source of spontaneous firing.
- `stepsPerTick` (held at 5): noise is drawn per LIF step, so its effect scales with `stepsPerTick`.
