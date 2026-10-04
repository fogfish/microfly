# Comparison: toy, nature, random-matched, baseline

Commands (repository root):

```sh
npm run experiment                # default world: toy versus baseline
npm run experiment:connectome     # connectome world: all four arms
```

Setup, from `public/world/world.json` and `public/world/world-connectome.json` (the only difference is the brain block):

- Seeds: `flies.experiment.seeds` = 1, 2, 3, 4, 5. Each seed is a full `flies.seed`; the world terrain and objects stay fixed (world seed 1990).
- 6 flies per arm, 3000 ticks per fly, tickHz 20.
- Snapshot: `brains/smallest-functional-brain.brain` (11 neurons, 78 edges, male-cns-v1.0, created 2026-10-04T12:56:29Z).
- Shared brain settings: `motorSmoothing` 0.05, `telemetry` [0, 1, 2], `lif.synapticScale` 0.85 (unchanged from the toy).

## Default world (toy versus baseline)

```text
seed   toy            baseline
1      3              12
2      0              10
3      3              10
4      3              14
5      2              11
total  11             57

toy - baseline: -46
verdict: toy <= baseline
```

The per-seed numbers match the feature 002 script exactly (checked against `git show HEAD:scripts/compare-baseline.mjs`).

## Connectome world (four arms)

```text
seed   toy            nature         random-matched baseline
1      3              0              1              12
2      0              4              2              10
3      3              1              0              10
4      3              5              3              14
5      2              4              2              11
total  11             14             8              57

nature - random-matched: +6
nature - toy:            +3
toy - baseline:          -46
nature - baseline:       -43
random-matched - baseline: -49
verdict: toy <= baseline
```

Readout firing rate (spikes per fly-tick, all seeds):

| arm | LEFT | RIGHT |
|-----|------|-------|
| toy | 0.1269 | 0.1393 |
| nature | 0.0362 | 0.0726 |
| random-matched | 0.0903 | 0.0930 |

## Reading the result

- **Every brain is below the random-walk baseline.** Nature gets 14 contacts, toy 11, random-matched 8, baseline 57. This is ADR 002 Gate C: it is not met. The result is reported as it is. Gate C says the fix, if any, is a config value (`maxInterneurons`, `synapseCap`, `minConfidence`, or `lif`), not a change to the simulator, and no value was tuned for this report.
- **Nature is above the size-matched random control (+6) and above the toy (+3).** The sign and wiring of the connectome subgraph are the only difference between nature and random-matched, so this is the closest reading of "random versus nature". The sample is small (5 seeds × 6 flies, 8 to 14 contacts per arm), so this difference is not established as significant.
- **The readouts are asymmetric, as research R4 predicted.** The nature brain's LEFT rate is about half its RIGHT rate, consistent with LEFT receiving 31 two-hop synapses against RIGHT's 906. The brain is not silent: both readouts fire.
- **No calibration was applied.** `lif` and the extraction config are the values recorded above.
