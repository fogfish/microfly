# Regime gate: world/world-forager-learning.json, calibration seeds

Snapshot: `forager-brain-mb.brain` (sha256 `b381ba8281bfe20a0d70b14f381c24762d4209e312eb1adf099599d70c5f7466`). Seeds: 6, 7, 8, 9, 10.
LIF: `{"synapticScale":15,"inhibitoryScale":1.5,"noiseAmplitude":0.2,"noiseBulkScale":0,"tauSyn":0,"tauAdapt":100,"adaptStep":0.1,"thresholdJitter":0.1,"baselineCurrent":0.03,"outputScale":null,"pathwayGain":null}`.

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 98.9% [98.2%, 99.3%] | 0.454 |
| B (floral) | 99.7% [99.7%, 99.8%] | 0.492 |

A-B overlap (Pearson of mean vectors): 0.470 (target < 0.7)
Rate-vector correlation (secondary): 0.577

Targets (research.md §2, FR-006): active fraction 5-15% per odour, same-odour reliability > 0.9, A-B overlap < 0.7.

**Verdict: FAIL**

## Remedy tried (T024): pathwayGain, a 7-point grid from the user-specified starting routes

Starting point (research.md §3): `olfactory->ALPN` gain 5, `ALPN->Kenyon_Cell` gain 3, `otherExcitatoryInto:
[ALPN, Kenyon_Cell]`, `otherGain` 0.3. Grid: `otherGain` in {0.3, 0.2, 0.15, 0.1, 0.05} at KC gain 3, and
`otherGain` in {0.1, 0.05} at KC gain 2 (one combined grid, "at most one" per T024).

| KC gain | otherGain | A active % | B active % | rel A | rel B | overlap AB |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 0.30 | 67.3% | 77.0% | 0.852 | 0.841 | 0.794 |
| 3 | 0.20 | 60.5% | 69.4% | 0.852 | 0.903 | 0.803 |
| 3 | 0.15 | 59.5% | 68.0% | 0.873 | 0.903 | 0.823 |
| 3 | 0.10 | 59.9% | 66.4% | 0.876 | 0.924 | 0.869 |
| 3 | 0.05 | 60.3% | 65.1% | 0.881 | 0.934 | 0.901 |
| 2 | 0.10 | 57.8% | 65.8% | 0.885 | 0.935 | 0.850 |
| 2 | 0.05 | 55.6% | 63.7% | 0.859 | 0.931 | 0.830 |

Every point moves active fraction from ~99% to 56-77%, a real effect, but every point stays 4-10x over the
15% target, and overlapAB moves the *wrong* way (0.47 -> up to 0.90) as `otherGain` drops. `otherGain` only
scales edges whose target class is ALPN/Kenyon_Cell; it cannot touch `baselineCurrent` (0.03, added to every
neuron every step regardless of any edge), and the amplified primary route itself (10-15x on the real signal)
is enough alone to recruit most KCs once real input arrives. Lowering `otherGain` below 0.3 buys little further
reduction (a floor around 55-60%).

**Final verdict (T025): FAIL even after the one remedy.** Per FR-008, no Phase 4+ task may be started. See
ADR 011 D36 ("Rejected — gate failed").

## Matched random graph (reported, not gated)

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 93.8% [91.2%, 95.2%] | 0.656 |
| B (floral) | 95.5% [94.7%, 96.2%] | 0.625 |

A-B overlap: 0.641. Rate-vector correlation: 0.936.
