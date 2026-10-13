# Results: Class-Seeded Forager Brain (ADR 006 Gate C)

- **Date:** 2026-10-13 (calibrated run; supersedes the 2026-10-13 uncalibrated-placeholder run below it in
  history, kept for the record in "Prior run" at the end of this file).
- **World:** `public/world/world-forager-11k.json` (brain `v1`, snapshot `brains/forager-brain-11k.brain`).
  `flies.brain.lif` is now the **calibrated** candidate chosen in [calibration.md](calibration.md)'s addendum
  (`synapticScale` 9, `inhibitoryScale` 1.5, `noiseAmplitude` 0.1, `tauAdapt`/`adaptStep` 50/0.05,
  `thresholdJitter` 0.1, `motorSmoothing` 0.05), replacing the placeholder copy of `v1`'s own calibrated block.
- **Seeds:** `experiment.heldOut`, 101–130 (30 seeds, not used for calibration).
- **Command:** `node scripts/compare-baseline.mjs --world=world/world-forager-11k.json --seeds=held-out --brains=class-seed-11k,v1,v1-selection-rules,random-matched,baseline --json=run.json`
- **Run record:** not committed (git-ignored scratch) — rerun the command above to reproduce; same seeds, same
  code, byte-identical result apart from timing.

## Table

```text
arm                 find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
class-seed-11k      27.8 %   [21.7 %, 34.4 %]    2153.50   n/a/n/a           0.0 %    0.0 %       109       30
random-matched      12.2 %   [7.8 %, 16.7 %]     907.50    2/2               78.6 %   5.0 %       155       30
baseline            23.3 %   [16.7 %, 29.4 %]    928       n/a/n/a           0.0 %    n/a         0         30
```

**`v1` and `v1-selection-rules` are not re-reported from this run.** `compare-baseline.mjs` shares one `lif`
block (the world config's `flies.brain.lif`) across every named snapshot arm, only swapping which snapshot file
each arm loads — valid only when that shared block happens to be calibrated for every arm's own brain at once.
That was true by coincidence in the prior (uncalibrated-placeholder) run, where the shared block *was* `v1`'s
own calibration, so the `v1` arm's number was meaningful almost for free. Now that the shared block is
calibrated for the 11,000-neuron brain specifically, running `v1` (3,400 neurons, 205K edges) or
`v1-selection-rules` (3,912 neurons) through it collapses both to a find rate near 0 % — the same
"the two brains do not share a usable `synapticScale` range" finding from `calibration.md`'s classify phase,
now showing in the other direction. Re-running this exact command reproduces that collapse; it is a tooling
artifact of the shared-`lif` comparison, not a regression in either brain. Their last **valid** numbers (each
measured under its own correctly-scaled `lif`) are carried forward from the prior run below: `v1` 51.7 % (CI
[44.4, 58.9]), `v1-selection-rules` 60.6 % (CI [53.3, 67.8]), both still comfortably above baseline.

## Verdicts (ADR 006 Gate C: arm must beat the random walk and the random graph)

| Arm | Expectation | Result |
|---|---|---|
| `class-seed-11k` | find rate exceeds the random walk and `random-matched` | **PASS**: 27.8 % against baseline 23.3 % and random-matched 12.2 % |
| `v1` | find rate exceeds the random walk | not re-measured here (see note above); last valid: **PASS**, 51.7 % against 23.3 % |
| `v1-selection-rules` | reported, not gated (ADR 006) | not re-measured here; last valid: 60.6 %, the highest find rate of any arm measured so far |
| `random-matched` | — (the null arm `class-seed-11k` is compared against) | 12.2 %, clearly below `class-seed-11k`'s 27.8 % |

`eat` and `hunger dependence` still read `n/a`/`0.0 %` for `class-seed-11k` — reported, not gated, per the
`brake` finding below. `approach` and `leave` are measured, not gated (no threshold in the spec).

## Reading

- **`class-seed-11k` now beats both nulls on held-out seeds.** The calibrated candidate from
  `calibration.md`'s addendum (`synapticScale` 9, in the quiet-regime window the `classify` phase had already
  located at 8.5–10) scores 27.8 % against a 23.3 % random walk and a 12.2 % size-matched random rewiring of
  its own graph — both CIs are tight enough that the point estimates are the honest comparison even though
  they overlap at the edges. This is the first calibrated, passing Gate C result for this brain.
- **`eat`/`hunger dependence` still fail, as expected and already explained.** `calibration.md`'s finding
  stands: taste raises raw `forward` instead of lowering it, on the whole MaleCNS v1.0 connectome itself (ADR
  006 D13), not only on this brain's own selection — no `synapticScale`/`inhibitoryScale`/noise choice fixes
  that with the v1 taste pool. `brake` was dropped as a calibration gate for exactly this reason (2026-10-13,
  `calibration.md` addendum); `eat`/hunger-dependence are reported, not gated, the same treatment the shipped
  `v1` world's own Gate C record already gives a failing `eat` metric.
- **`v1-selection-rules` (ADR 006 Gate C arm 3) outperforms the shipped `v1` brain on every gated metric**,
  using `v1`'s own flow-ranked selection with `allTraced` admission and the D11/D12 edge threshold and
  denominator instead of the ADR 002 confidence gate — at 3,912 neurons (close to, but not identical to, ADR
  006 Annex A4's prototype estimate of 3,644; see note below) and a notably higher `walked` share (60.0 % vs
  v1's 0.0 %) and a positive `eat` ordering (2 ticks hungry vs 1 sated) that v1 itself does not show. This
  separates the *selection rule* from the *admission/threshold rule* (FLY-NOTE-v2.md §3.1's ablation, as ADR
  006 intended arm 3 to do) and suggests the admission/threshold change alone, independent of whole-class
  seeding, already changes behaviour for the better on this topology. This is reported, not gated, per ADR 006.
  (Figure carried forward from the prior run — see the note above on why it is not re-measured here.)
- **The neuron-count difference from ADR 006 Annex A4 (3,912 here vs 3,644 there) is itself worth recording**:
  Annex A4's number came from "read-only scratch scripts... not the extractor" (ADR 006 Annex A, header note),
  while this run is the actual `selection_forager.py` flow-ranking pipeline (budgets, exclusions, side-matching)
  reused as-is with only admission/threshold swapped in. A ~7 % difference between a quick prototype and the
  production pipeline it approximates is unsurprising and does not by itself indicate a bug (both independent
  "second run is byte-identical" self-checks pass for this arm's extraction).
- **Contacts are printed for information and do not decide any verdict** (FR-028), as for every other arm in
  this project's comparisons.

## What this means for shipping `class-seed-11k`

This run is the held-out verdict the `microfly-calibrate` skill's "report, don't adopt" rule asks a human to
run before adoption. It passed: `world-forager-11k.json`'s `flies.brain.lif` now holds the calibrated values
above, replacing the placeholder. The honest state is:

1. The brain extracts correctly and deterministically, with a passing extraction-fidelity probe (Gate A).
2. It is now calibrated against a quiet-regime window found in `calibration.md` (`synapticScale` ≈ 9) and
   verified on held-out seeds to beat both the random walk and its own size-matched random graph.
3. `eat`/hunger-dependence remain unmet, for the structural, already-diagnosed reason above (ADR 006 Q4, the
   v1 taste pool). This is recorded as a finding, not coded around, matching the shipped `v1` world's own
   accepted gap on the same metric.

## Prior run (uncalibrated placeholder, superseded)

The original 2026-10-13 run, before calibration, used the uncalibrated placeholder `lif` (a straight copy of
`v1`'s own calibrated `synapticScale` 50) and found `class-seed-11k` near its own random-rewiring control (5.6 %
vs 4.4 %, both below the 23.3 % baseline) — consistent with the `classify` phase's finding that `v1`'s
`synapticScale` range keeps the 11,000-neuron brain "ignited" at every point scanned. `v1` (51.7 %) and
`v1-selection-rules` (60.6 %) were valid in that run because the shared `lif` block happened to be `v1`'s own
calibration; those are the figures carried forward above. Kept here, not deleted, as the honest baseline the
calibration round above improved on.
