# Contract: Experiment and comparison

**Owner**: `scripts/compare-baseline.mjs` (the experiment, extended) and `public/js/fly/metrics.js` (pure metric functions,
Node-testable). **Amends**: the ADR 001 Stage 2 metric and ADR 002 R9 arms.

## Command

```text
node scripts/compare-baseline.mjs --world=world/world-forager.json [--brains=mock,v0,v1,random-matched,baseline]
                                  [--seeds=held-out] [--verbose] [--json=<file>]
```

- `--brains` picks the arms. Default: every arm whose inputs exist (`mock` always; `v0` and `v1` need their snapshot;
  `random-matched` needs `v1` or `v0`; `baseline` always).
- `--seeds=held-out` uses the held-out set from `experiment.heldOut` in the world's `experiment` section, not
  `experiment.seeds` (calibration). The held-out set is 30 seeds, as in ADR 002 A1, and must not overlap the
  calibration seeds. The script stops with an error if they overlap.
- `--json` writes the run record (per arm, per seed) for the report.

## Arms

| Arm | Brain | Notes |
|---|---|---|
| `mock` | Toy random graph (`flies.brain` shared settings, mock size) | As today. |
| `v0` | Small snapshot (version 3), `lif-v0.js` | As today. |
| `v1` | Forager snapshot (version 4), `lif-v1.js` | The brain under study. |
| `random-matched` | Random graph of the v1 size and out-degree, with v1 LIF and runner | Separates connectome structure from size. |
| `baseline` | Random walk, no brain | As today. |

## Metrics (ADR 003 Gate C)

Each metric is computed per arm, over the held-out seeds, from the run record. Pure functions in `metrics.js`.

1. **Find**: the share of flies that reach a flower (`stock > 0`, on its cell) within the run. Reported with a 95 % bootstrap
   interval over flies.
2. **Approach**: the median tick of the first flower contact, for flies that start more than one odour radius away from every
   flower. Flies that never reach one are excluded and counted.
3. **Eat**: the median length in ticks of eating bouts, reported for hungry starts (`energy 0.1`) and sated starts (`0.9`).
   Hungry should be longer (SC-007 is checked on this).
4. **Leave**: the share of eating bouts that end with `walked` (fly leaves before the flower is empty).
5. **Hunger dependence**: find rate for hungry starts minus find rate for sated starts.

**Contacts** are printed with the table and do not decide the verdict (spec FR-028).

**Verdict**: each metric is printed as its value and whether it meets the expectation stated in the spec (SC-008). A
failing metric is printed as failing, with the run and seeds. Nothing is adjusted to pass.

## Table

```text
arm              find [CI]        approach   eat hungry/sated   walked   hunger-dep   contacts   seeds
baseline         …
mock             …
v0               …
v1               …
random-matched   …
```

## Reproducibility

The run record stores the world file hash, the snapshot's `configHash`, the held-out seeds, and the LIF parameters
of each arm. The same inputs give the same record (Principle V).

## Timing

For the browser harness, `tickMs` (mean and p95 per arm) is recorded from the host clock when the run is made in the page. The Node run does
not record it, because the browser is the only place Gate B's timing applies.
