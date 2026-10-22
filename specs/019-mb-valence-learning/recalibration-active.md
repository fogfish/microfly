# Recalibration: active MB brain (candidate, 2026-10-22)

**Status:** candidate on calibration seeds only. Not adopted. Held-out validation not run.
**Files:** `public/world/world-forager-learning-active.json`, `public/world/world-forager-learning-tilemap-active.json`,
`public/brains/forager-brain-mb-active.decoder.json`, profile `forager-mb-active` (microfly-calibrate skill).
**Mechanism added:** L13 `noiseClassScale` (`contracts/lif-v1-noise-class.md`).

## Motivation

At the shipped point (`synapticScale` 5, D40/D41), only about 15% of non-input neurons ever spike, almost all of
them in the olfactory → KC → MBON chain. 88 of 4,534 central-brain neurons and 14 of 1,314 descending neurons spike.
The goal was brain-wide activity while keeping the regime gate (FR-006), learning, eating and danger avoidance.

## Findings from the sweep (reduced harness, seeds 6–7, matches the official probe on both reference points)

1. Breadth grows with global scale (15% at ss5, about 37% at ss15). The KC gate and breadth trade against each other
   through every feed-forward gain: at ss15, reliability > 0.85 only appears once KC density is about 20% or more.
2. ORN→PN carries 5.6% of PN input. Most PN drive is recurrent (PN→PN 36%, ALLN→PN 28%). In ss5 configs, ORN→PN was
   being scaled by `otherGain`, and that was the real lever on KC density.
3. Background activity outside the MB comes from noise. Sensory noise propagating through a high-gain network and
   bulk noise both reach the KCs and destroy reliability. The tipping point is bulk ≈ 0.15 absolute: breadth jumps
   from about 21% to about 90% and KC reliability drops from 0.8 to 0.65.
4. Silencing the noise only on KC, ALPN and ALLN (tested as a scratch override, then shipped as L13) gives both
   properties: gate pass with about 77% ever-active and 26–28% stimulus-evoked.

## Candidate point

```
synapticScale 15, inhibitoryScale 1.5, noiseAmplitude 0.05, noiseBulkScale 4 (bulk 0.2 absolute),
noiseClassScale {Kenyon_Cell: 0, ALPN: 0, ALLN: 0, MBON: 0}, tauSyn 3, tauAdapt 100, adaptStep 0.1,
thresholdJitter 0.1, baselineCurrent 0, outputScale unchanged,
pathwayGain: KC→KC 0, olfactory→ALPN 0.14, ALPN→KC 0.58, KC→MBON 13.333 (40×5/15), touch→AN03A008 16.667 (50×5/15),
otherExcitatoryInto [ALPN, Kenyon_Cell] × 0.04
```

## Results (calibration seeds)

| Measure | Shipped (HEAD) | Candidate |
|---|---|---|
| Non-input neurons ever spiking (mixed run) | 15.4% | 74.4% |
| Central brain / descending neurons ever spiking | 88 / 14 | 4445 / 1291 |
| Regime gate, KC active A / B | 13.8 / 12.0% | 13.7 / **15.0%** (at the ceiling) |
| Regime gate, reliability A / B, overlap | 0.896 / 0.894, 0.14 | 0.869 / 0.877, 0.18 — PASS |
| Conditioning, reward shift A / B | +0.33 / +0.03 | +0.32 / +0.11 (quiet-MBON variant) |
| Conditioning, punish shift A / B | −0.30 / −0.07 | −0.32 / −0.16 |
| Frozen / shuffled controls | ≈ 0 | ≈ 0 to 0.05 |
| C3 find rate, pond / tilemap | 77.8 / 77.8% | 88.9 / 94.4% |
| C3 eat ticks hungry / sated, pond | 83.5 / 5 | 18 / 12 |
| C3 eat ticks hungry / sated, tilemap | 82 / 10 | 29 / 29 |
| C3 time in danger / heat, pond | 13.5 / 16.5% | 22.8 / 9.7% (random walk 57 / 12.9) |
| C3 time in danger / heat, tilemap | 3.6 / 8.6% | 11.4 / 1.4% (random walk 66 / 7.4) |

## Gate choices made for this candidate (to review)

- **C1 rest gate:** 0.001–0.10 (measured 0.0038). The shipped D42 band (≤ 0.001) describes a silent brain, and
  demo-v3's floor (0.01) was not met.
- **C2 drive/side threshold:** 0.5 Hz. D42's 0.00005 Hz admitted noise: E-DECODE-drive failed for danger, heat,
  leg taste and reward. D27's 3 Hz excluded the KC odour code: no `drive.odour-food-a` and no side pools for heat
  or touch.
- The regime probe ran with `plasticity: null` (the probe predates L12 in the world config).

## Fix: flies never left a flower (2026-10-22)

Mouth taste is gated by the snapshot modulator `hunger-taste` (gain [0.1, 1.5]). The world only overrode `hunger`
(odours), so a sated fly still got 10% taste. On food that gives a feed drive of 0.034 in this brain, against
`feedThreshold` 0.015 (shipped brain: 0.004). The eating reflex therefore never ended. Fix, in declared data: both
candidate worlds set `flies.modulators["hunger-taste"].gain` to [0, 1.5]. A sated fly (hunger < 0.4) gets no taste
input, and its feed drive falls to rest (−0.001).

Calibration seeds 6–10, 3000 ticks, main cohort:

| | On flower | Eating | Longest stay, median / max (ticks) | Bouts ended sated / walked / empty |
|---|---|---|---|---|
| shipped | 10.2% | 3.1% | 175 / 234 | 30 / 17 / 1 |
| candidate before the fix | 67.0% | 66.8% | 2206 / 3000 | 0 / 12 / 1 |
| candidate with the fix | 13.6% | 7.3% | 185 / 295 | 83 / 21 / 5 |

## Open issues
- **Danger odour avoidance** is weaker than shipped, though still well above the random walk.
- **Learning specificity:** odour B takes up about a third of A's shift (shipped: about a tenth).
- KC B density is at the 15% ceiling. ALPN→KC 0.55 had more density margin but less reliability margin.
- Held-out validation (`experiment.heldOut`) has not been run.
