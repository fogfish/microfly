# Contract: Experiment and comparison

**Owner**: `scripts/compare-baseline.mjs` (the experiment, extended) and `public/js/fly/metrics.js` (pure metric functions,
Node-testable). **Amends**: the ADR 001 Stage 2 metric and ADR 002 R9 arms. `v2` (specs 013's ADR 006) adds one
arm and five metrics below, marked **v2**; the existing arms and metrics are unchanged.

## Command

```text
node scripts/compare-baseline.mjs --world=world/world-forager.json [--brains=mock,v0,v1,v2,random-matched,baseline]
                                  [--seeds=held-out] [--verbose] [--json=<file>]
```

- `--brains` picks the arms. Default: every arm whose inputs exist (`mock` always; `v0`, `v1` and `v2` need their
  snapshot; `random-matched` needs `v2`, `v1` or `v0`; `baseline` always).
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
| `v2` (**v2**) | Cautious forager snapshot (version 5), `lif-v1.js` via `fly-brain-v2.js`'s runner | ADR 006, 12 inputs/6 outputs, `forager-arms.mjs`'s `runV2Cohort`. |
| `random-matched` | Random graph of the arm-under-study's size and out-degree, with its LIF and runner | Separates connectome structure from size; rewires `v2`'s own edges (same neuron/edge count) when `v2` is the arm under study. |
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

## Metrics (ADR 006 Gate C, v2 only)

Five more metrics, printed in their own table alongside the one above; `n/a` for an arm whose ticks carry no `v2`
declaration (`mock`, `baseline`).

| Metric | Definition | Reported as |
|---|---|---|
| Brake | median `forward` drive with mouth taste present (fly's mouth on a flower) ÷ median `forward` drive off any flower, hungry flies only | one ratio per arm; **must be < 1 and lower than the random-graph arm's** (SC-007) |
| Avoid | fraction of ticks within 1.5 tiles of a spider; fraction of ticks within 1.5 tiles of a lantern | two fractions per arm, signed against the random walk's, reported either way (not gated); positional, so it prints for every arm including `mock`/`baseline` |
| Touch | fraction of ticks with a blocked move | one fraction per arm, against the random walk |
| Escape | escape events per minute while within the danger radius; escape events per minute outside it | two rates per arm |
| Rest | activity (spike-rate fraction) per region (`input`, `output`, `al`, `vnc`, `dn`, `central`), no stimulus present | one fraction per region per arm |

All five are **measurements**, not gates, except brake (SC-007), which is a required pass. A metric that does not
pass its stated expectation is still printed, with the run that produced it — the experiment script never
substitutes a different brain or hand-tunes the selection to force a pass (FR-028). Pure-function unit tests for
each of the five live in `tests/metrics-v2.test.mjs`, against small, hand-built tick logs (no brain or worker
involved) — the same style `tests/metrics.test.mjs` uses for the five v1 metrics above.

## Table

```text
arm              find [CI]        approach   eat hungry/sated   walked   hunger-dep   contacts   seeds
baseline         …
mock             …
v0               …
v1               …
v2               …
random-matched   …
```

**(v2)** a second table, same row set, columns: arm name, brake, avoid(spider), avoid(lantern), touch,
escape(near/away per min), rest (per region) — `n/a` where an arm has no `v2` declaration.

## Reproducibility

The run record stores the world file hash, the snapshot's `configHash`, the held-out seeds, and the LIF parameters
of each arm. The same inputs give the same record (Principle V).

## Timing

For the browser harness, `tickMs` (mean and p95 per arm) is recorded from the host clock when the run is made in the page. The Node run does
not record it, because the browser is the only place Gate B's timing applies.
