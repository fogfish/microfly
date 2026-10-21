# Regime gate: world/world-forager-learning.json, calibration seeds

Snapshot: `forager-brain-mb.brain` (sha256 `b381ba8281bfe20a0d70b14f381c24762d4209e312eb1adf099599d70c5f7466`). Seeds: 6, 7, 8, 9, 10.
LIF: `{"synapticScale":5,"inhibitoryScale":1.5,"noiseAmplitude":0.2,"noiseBulkScale":0,"tauSyn":3,"tauAdapt":100,"adaptStep":0.1,"thresholdJitter":0.1,"baselineCurrent":0,"outputScale":null,"pathwayGain":{"routes":[{"from":"Kenyon_Cell","to":"Kenyon_Cell","gain":0},{"from":"ALPN","to":"Kenyon_Cell","gain":2.1},{"from":"Kenyon_Cell","to":"MBON","gain":40}],"otherExcitatoryInto":["ALPN","Kenyon_Cell"],"otherGain":0.3}}`.

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 13.7% [12.1%, 15.7%] | 0.893 |
| B (floral) | 12.0% [11.1%, 12.5%] | 0.897 |

A-B overlap (Pearson of mean vectors): 0.143 (target < 0.7)
Rate-vector correlation (secondary): 0.139

Targets (research.md §2, FR-006, ADR 011 D41): active fraction 5-15% per odour, same-odour reliability > 0.85, A-B overlap < 0.7.

**Verdict: PASS**


## Matched random graph (reported, not gated)

| Odour | Active fraction (mean [min, max]) | Same-odour reliability |
| --- | --- | --- |
| A (fruit) | 0.0% [0.0%, 0.0%] | 0.038 |
| B (floral) | 0.0% [0.0%, 0.0%] | 0.000 |

A-B overlap: 0.000. Rate-vector correlation: 0.079.
