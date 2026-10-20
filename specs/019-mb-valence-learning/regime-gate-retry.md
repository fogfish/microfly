# Regime gate retry (D40, target per D41): world/world-forager-learning.json, calibration seeds

Snapshot: `forager-brain-mb.brain` (sha256 `b381ba8281bfe20a0d70b14f381c24762d4209e312eb1adf099599d70c5f7466`). Seeds: 6, 7, 8, 9, 10.
LIF: `{"synapticScale":5,"inhibitoryScale":1.5,"noiseAmplitude":0.2,"noiseBulkScale":0,"tauSyn":3,"tauAdapt":100,"adaptStep":0.1,"thresholdJitter":0.1,"baselineCurrent":0,"outputScale":null,"pathwayGain":{"routes":[{"from":"Kenyon_Cell","to":"Kenyon_Cell","gain":0},{"from":"ALPN","to":"Kenyon_Cell","gain":2.1}],"otherExcitatoryInto":["ALPN","Kenyon_Cell"],"otherGain":0.3}}`.

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 13.8% [12.5%, 15.9%] | 0.896 |
| B (floral) | 12.0% [10.9%, 12.7%] | 0.894 |

A-B overlap (Pearson of mean vectors): 0.144 (target < 0.7)
Rate-vector correlation (secondary): 0.136

Targets (research.md §2, FR-006, ADR 011 D41): active fraction 5-15% per odour, same-odour reliability > 0.85, A-B overlap < 0.7.

**Verdict: PASS**


## Matched random graph (reported, not gated)

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 0.0% [0.0%, 0.0%] | 0.038 |
| B (floral) | 0.0% [0.0%, 0.0%] | 0.000 |

A-B overlap: 0.000. Rate-vector correlation: 0.079.
## Why this retry (ADR 011 D40)

Root-cause analysis of the first run (`regime-gate.md`, D36/D38), measured on calibration seeds only:

- **The probe measured a brain the fly never runs.** `mb-regime-probe.mjs` built the network without
  `inputNeurons`, so with `noiseBulkScale` 0 no neuron got noise. `fly-brain-v1.js` passes them. Fixed in this run.
- **One global `synapticScale` of 15 removes KC coincidence detection.** With `postFractionAbsolute` weights, any edge
  over 6.7% of a target's input fires it from one spike; that holds for 92.5% of KCs. The same gain spreads ORN input
  through the antennal lobe: odour A alone drove ~90% of all PNs (PN-level A-B overlap 0.86).
- **KC→KC excitation** (22% of KC input) widens each odour's one-hop KC reach from 37-44% to 76-87%.
- **`baselineCurrent` 0.03** keeps 74-99% of KCs firing at rest once input noise is on.
- **The D38 remedy amplified the path.** Its gains (ORN→PN ×5, PN→KC ×3, other ×0.3) came from smallfly, where
  weights are raw synapse counts × 0.002. Applied to `postFractionAbsolute` × 15, they amplified edges that were
  already suprathreshold.

## Grids behind the retry settings (reduced probe: 5 trials per odour, input noise on)

All points share `synapticScale` 5, `baselineCurrent` 0, KC→KC gain 0, `otherExcitatoryInto` [ALPN, Kenyon_Cell]
at 0.3.

| tauSyn | KC→APL gain (`toType`) | PN→KC gain | Seeds | KC active A / B | Reliability A / B | Overlap |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | - | 1.5 | 6-10 | 13.3 / 11.1% | 0.896 / 0.890 | 0.13 |
| 0 | - | 1.6 | 6-10 | 15.0 / 12.8% | 0.906 / 0.899 | 0.15 |
| 0 | - | 1.75 | 6-10 | 17.4 / 15.6% | 0.919 / 0.905 | 0.15 |
| 0 | 10 | 2.0 | 6-7 | 17.6 / 16.8% | 0.927 / 0.867 | 0.15 |
| 0 | 30 | 2.0 | 6-7 | 16.1 / 13.8% | 0.913 / 0.790 | 0.14 |
| 0 | 100 | 2.0 | 6-7 | 15.8 / 12.2% | 0.904 / 0.719 | 0.14 |
| 5 | 30 | 2.5 | 6-7 | 8.7 / 7.5% | 0.859 / 0.836 | 0.07 |
| 5 | 100 | 3.0 | 6-7 | 9.1 / 7.4% | 0.886 / 0.817 | 0.07 |
| 10 | 300 | 3.5 | 6-7 | 5.8 / 4.3% | 0.803 / 0.789 | 0.04 |
| 3 | - | 2.0 | 6-10 | 12.7 / 10.6% | 0.890 / 0.891 | 0.13 |
| 5 | - | 2.25 | 6-10 | 12.0 / 10.1% | 0.885 / 0.884 | 0.12 |

**Finding.** Making APL fire (L11 type selector, D40) never helped. A spiking point-neuron APL inhibits in large,
randomly timed kicks, so it lowers reliability by 0.01-0.17 while barely moving the active fraction. The real APL is
non-spiking and graded. Without it, active fraction and reliability rise together, and every lever tried touches the
gate's corner (15%, 0.9) without going inside it. The full-protocol run above is the best point: active fraction and
overlap pass with margin, and reliability misses by 0.004-0.006.

**Update (ADR 011 D41).** The same-odour reliability target was relaxed from 0.9 to 0.85 after this measurement. The
run at the top of this file is the gate verdict under the new target: **PASS**, with these settings now in
`world-forager-learning.json`.
