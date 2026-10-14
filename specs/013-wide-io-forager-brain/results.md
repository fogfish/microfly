# Results: Wide-I/O Forager Brain (ADR 007 Gate C)

- **Date:** 2026-10-13.
- **Status: pre-calibration baseline, not a verdict.** `world-forager-wide.json`'s `flies.brain.lif` is still the
  placeholder copied from the 11K world (see [calibration.md](calibration.md)) — calibration itself is a
  separate, human-reviewed `/microfly-calibrate` session that has not run yet. This run exists so the brain is
  measured and the finding is on record (AGENTS.md: "Behaviour failures are findings"), not hidden until
  calibration happens to produce a nicer number. **Re-run this comparison after calibration adopts a candidate**
  for the real Gate C verdict.
- **World:** `public/world/world-forager-wide.json` (brain `v2`, snapshot `brains/forager-brain-wide.brain`,
  94.6 % neuron overlap with the shipped 11K brain, ADR 007 D18).
- **Seeds:** `experiment.heldOut`, 101–130 (30 seeds, not used for calibration — none has been run yet either).
- **Command:** `node scripts/compare-baseline.mjs --world=world/world-forager-wide.json --seeds=held-out --json=run.json`
  (contracts/experiment-metrics-wide.md names `scripts/forager-arms.mjs`, which is the library this command's
  `v2` dispatch branch calls into — same pattern `compare-baseline.mjs` already uses for `class-seed-11k`).
- **Run record:** not committed (git-ignored scratch) — rerun the command above to reproduce; same seeds, same
  code, byte-identical result apart from timing.

## Table

```text
arm                   find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds   brake    stay   avoid(spider/lantern)   touch   escape(in/out)
wide                  41.1 %   [34.4 %, 48.3 %]      1694      n/a/n/a           0.0 %    12.8 %      489       30    1.54     n/a    1.8 %/0.8 %             0.17    0.00/0.00
v1-11k                0.6 %    [0.0 %, 1.7 %]        n/a       n/a/n/a           0.0 %    0.0 %       0         30    n/a      n/a    n/a/n/a                 n/a     n/a
random-matched-wide   10.0 %   [6.1 %, 14.4 %]       332       2/2               39.4 %   -5.0 %      160       30    5.3e+28¹ n/a    1.7 %/1.3 %             0.04    0.28/0.18
baseline              23.3 %   [16.7 %, 29.4 %]      928       n/a/n/a           0.0 %    n/a         0         30    n/a      n/a    0.4 %/0.4 %             n/a     n/a
```

¹ `random-matched-wide`'s brake ratio is a numerical artefact, not a real signal: its median off-flower
`forward` drive was extremely close to zero (not exactly 0) at this (uncalibrated) LIF point, so the on/off
ratio blew up. `brakeMedian` (`public/js/fly/metrics.js`) now returns `null` instead of a ratio when the
off-flower median is below `1e-6`, fixed after this run; a re-run would show `n/a` here, not this number. Not
hidden either way — see "Findings" below.

## Verdicts (ADR 007 Acceptance, Gate C)

| Metric | Expectation | Result |
|---|---|---|
| find | `wide` find rate exceeds the random walk | **PASS**: 41.1 % against baseline 23.3 % |
| hunger dependence | find rate is higher for hungry starts | **PASS**: +12.8 % |
| eat | median bout is longer for hungry starts than for sated starts | **FAIL**: no bouts closed in either cohort (both n/a) — the fly never stays on a flower long enough to close a bout at this LIF point |
| brake | on/off-flower forward ratio is < 1 and lower than `random-matched-wide` | **FAIL**: 1.54 (> 1: forward is *higher* on a flower, the opposite of a brake) |
| avoid heat | heat fraction of ticks is not higher than the random walk | **FAIL**: 0.8 % vs baseline 0.4 % (both small; 30 seeds may not resolve this) |
| avoid danger | measured only (ADR 007 Annex A5: sign depends on hop count) | 1.8 % vs baseline 0.4 %, reported only |
| touch | measured only (no threshold in the spec) | 0.17 |
| stay | measured only, against `v1-11k` | both n/a (no closed bouts for either arm this run) |
| escape | telemetry only, excluded from behaviour claims (ADR 007 D17) | 0.00 inside / 0.00 outside (escape essentially silent at this LIF point) |
| approach, leave | measured only (no threshold in the spec) | median 1694 ticks (20 included, 98 excluded); walked 0.0 % |

## Findings

- **Find and hunger-dependence pass even on the placeholder LIF**, which only shows the brain's strongest,
  most-connected route (food odour → steering) comes through regardless of fine-tuning — consistent with
  `calibration.md`'s own regime probe at this exact point, which already found the network too quiet
  (`silent:all`) for the feed/brake mechanism specifically.
- **Eat, brake and stay all fail together, and are linked:** with no bout ever closing, there is nothing for
  `stayMedian`/`eatMedian` to measure, and `brakeMedian`'s on-flower sample is thin and noisy. This is the exact
  brake-finding ADR 007 names as the reason for this feature ("Eat must pass for this arm. This is the metric
  neither v1 nor 11K could pass") — not yet demonstrated, because the mouth/leg taste pools have not been given
  a chance to drive the network at a calibrated gain.
- **`v1-11k`'s near-zero find rate (0.6 %) is the same pre-existing, acknowledged tooling limitation**
  `specs/012-class-seeded-forager-brain/results.md` already recorded for its own `v1`/`v1-selection-rules` arms:
  `compare-baseline.mjs` shares one `flies.brain.lif` block across every snapshot-named arm in one run, valid
  only when that block happens to be calibrated for every arm's own brain at once. Here the shared block is
  this feature's own placeholder (a copy of the 11K brain's calibration) with its `outputScale` additionally
  *scoped down* to the 11K brain's five known outputs (`scripts/forager-arms.mjs`'s `scopedLif`, added this
  feature, which stops the run from crashing on `v1-11k`'s unknown `outputScale.escape` key) — but scoping the
  key list does not fix the magnitude mismatch between an 11,000-neuron network calibrated at `synapticScale: 9`
  for *this* brain's edge count and the same scale applied to the differently-connected 11K brain. Not a
  regression in the 11K brain; its own last valid, correctly-scaled number is 27.8 % (specs/012's own results.md).
- **`random-matched-wide`'s negative hunger-dependence (-5.0 %) and non-zero `eat`/`walked` numbers** are plausible
  for a degree-preserving rewire at this LIF point — a random, same-size, same-weight-distribution graph can
  behave very differently from the real brain once recurrent dynamics are involved, which is exactly what this
  null arm is for.
- **Escape reads as silent (0.00/0.00) at this LIF point.** Expected: `outputScale.escape` has never been fit
  (no A2 run yet), so the readout has no calibrated range. This is telemetry only, no claim is made either way
  (ADR 007 D17).

**Next step:** run `/microfly-calibrate` with the `wide-io` profile (already written, see
[calibration.md](calibration.md)), adopt a reviewed candidate into `world-forager-wide.json`, and re-run this
exact command for the real Gate C verdict. A failing metric above is a finding to carry forward, not something
this run adjusted to pass.
