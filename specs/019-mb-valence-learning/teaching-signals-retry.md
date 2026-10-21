# Teaching signals (ADR 011, research.md §6)

Snapshot: `brains/forager-brain-mb.brain` (sha256 `b381ba8281bfe20a0d70b14f381c24762d4209e312eb1adf099599d70c5f7466`). Seeds (calibration): 6, 7, 8, 9, 10.
Protocol: 400-tick warm-up, then 5 blocks of 200 stimulus-on / 200 rest ticks.
Carries when D>0 on >= 50% of stimulus ticks and <= 5% of rest ticks.

| Signal | Pool | Stimulus ticks with D>0 | Rest ticks with D>0 | Carried? |
| --- | --- | --- | --- | --- |
| mouth taste (hunger 1) | reward | 0.0% | 0.0% | injected |
| mouth taste (hunger 0) | reward | 0.0% | 0.0% | injected |
| heat | punish | 0.0% | 0.0% | injected |
| touch | punish | 0.0% | 0.0% | injected |
| danger odour | punish | 0.0% | 0.0% | injected |
| escape output driven | punish | 0.0% | 0.0% | injected |
| food odour A alone | reward | 0.0% | 0.0% | injected |
| food odour A alone | punish | 0.0% | 0.0% | injected |
| food odour B alone | reward | 0.0% | 0.0% | injected |
| food odour B alone | punish | 0.0% | 0.0% | injected |

