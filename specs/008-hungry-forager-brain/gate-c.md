# Gate C: behaviour on held-out seeds

- **Date:** 2026-10-05
- **World:** `public/world/world-forager.json` (brain `v1`, `synapticScale` 50, `tauAdapt` 20, `adaptStep` 0.05; see calibration.md)
- **Seeds:** `experiment.heldOut`, 101–130 (30 seeds, not used for calibration). Three start cohorts for v1 and random-matched: main (energy 0.3), hungry (0.1), sated (0.9).
- **Run record:** [gate-c.json](gate-c.json). Arms ran as three parallel processes (v1; random-matched; mock and baseline). The arms do not depend on each other, so the merged numbers equal a single run.
- **Command:** `node scripts/compare-baseline.mjs --world=world/world-forager.json --seeds=held-out --brains=<arm> --json=<file>`

## Table

```text
arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
v1               42.2 %   [35.0 %, 49.4 %]   1339      1/2               99.5 %   17.2 %      287       30
random-matched    3.9 %   [1.1 %, 7.2 %]     216       1/1               72.8 %   -1.7 %      96        30
mock              8.3 %   [4.4 %, 12.2 %]    198       n/a               0.0 %    n/a         0         30
baseline         27.2 %   [21.1 %, 33.9 %]   835       n/a               0.0 %    n/a         0         30
```

## Verdicts (ADR 003 Gate C)

| Metric | Expectation | Result |
|---|---|---|
| Find | v1 find rate exceeds the random walk | **PASS**: 42.2 % against 27.2 % |
| Eat | median bout longer for hungry starts than sated | **FAIL**: 1 tick hungry against 2 sated |
| Hunger dependence | find rate higher for hungry starts | **PASS**: +17.2 points |
| Approach | measured | median 1339 ticks, 11 flies included, 21 excluded (never reached a flower) |
| Leave | measured | 99.5 % of bouts end `walked` |

## Reading

- The forager brain finds flowers more often than the random walk, and hungry flies find more than sated ones. The
  find rate is measured, not gated, as the ADR specifies.
- Eating is not sustained. Bouts are one or two ticks, so the fly feeds briefly and walks off. The eat expectation fails.
  This is a finding about the calibrated network, not a hand-wired result. It is recorded, not adjusted. Whether the
  short bouts come from the feed output dropping (the feed EMA falls below threshold as soon as the fly stops) or from
  the speed gate is not yet tested.
- The random-matched null (same degrees and weight distribution, random targets) finds flowers at 3.9 %. Structure
  matters, not only the size and the weights.
- Contacts (287 for v1) are printed for information and do not decide the verdict (FR-028).
