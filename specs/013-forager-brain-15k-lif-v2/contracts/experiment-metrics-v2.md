# Contract Amendment: experiment metrics, `v2` arm and the brake/avoid/touch/escape/rest metrics

**Amends**: `specs/008-hungry-forager-brain/contracts/experiment-metrics.md` — the canonical experiment-metrics
contract (arms, held-out seeds, the find/approach/eat/leave/hunger-dependence metrics). This amendment adds one
arm and five metrics; the existing metrics and arms are unchanged.

## Arms

`compare-baseline.mjs --brains` accepts `v2` beside `mock`, `v0`, `v1`. The size-matched random-graph arm and the
random-walk arm are generated/run against the `v2` brain's neuron/edge count exactly as they already are for `v1`.

## New metrics (`public/js/fly/metrics.js`)

| Metric | Definition | Reported as |
|---|---|---|
| Brake | median `forward` drive with mouth taste present (fly's mouth on a flower) ÷ median `forward` drive off any flower, hungry flies only | one ratio per arm; **must be < 1 and lower than the random-graph arm's** (SC-007) |
| Avoid | fraction of ticks within 1.5 tiles of a spider; fraction of ticks within 1.5 tiles of a lantern | two fractions per arm, signed against the random walk's, reported either way (not gated) |
| Touch | fraction of ticks with a blocked move | one fraction per arm, against the random walk |
| Escape | escape events per minute while within the danger radius; escape events per minute outside it | two rates per arm |
| Rest | activity (spike-rate fraction) per region (`input`, `output`, `al`, `vnc`, `dn`, `central`), no stimulus present | one fraction per region per arm |

All five are **measurements**, not gates (ADR 006 Gate C), except brake/eat (SC-007), which is a required pass.
A metric that does not pass its stated expectation is still printed, with the run that produced it — the
experiment script never substitutes a different brain or hand-tunes the selection to force a pass (FR-028).

## Report shape

One table per metric, one row per arm, columns: arm name, metric value(s), held-out seed count. The existing
find/approach/eat/leave/hunger-dependence table is unchanged and printed alongside these five.

## Tests

`tests/metrics-v2.test.mjs`: pure-function unit tests for each of the five metrics against small, hand-built tick
logs (no brain or worker involved) — the same style `tests/metrics.test.mjs` already uses for the five existing
metrics.
