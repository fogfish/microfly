# Gate C: cross-generation comparison (ADR 006), infrastructure check

- **Date:** 2026-10-10
- **Status:** infrastructure verified end to end; **not** a held-out verdict. `calibration.md` records why: the
  shipped brain runs on the L11 starting values, not a calibrated setting, so a held-out run's numbers would not
  mean what Gate C needs them to mean. Running the full protocol (30 held-out seeds × every arm, ADR 006 Annex A6
  estimates 55-85 minutes for one arm at this scale) is deferred until after calibration, per AGENTS.md ("the fix
  is config or parameters, recorded with the run" — a held-out run before calibration would just be a second,
  more expensive version of the same uncalibrated finding).

## What was verified

`scripts/compare-baseline.mjs --world=world/world-forager-15k.json --brains=mock,v2,random-matched,baseline`
runs end to end: the `v2` arm (ADR 006, `forager-arms.mjs`'s `runV2Cohort`) and the `random-matched` arm (the v2
snapshot's edges rewired, same neuron/edge count) both run on the real extracted brain; `mock` and `baseline` are
unchanged. All five Gate C metrics (`public/js/fly/metrics.js`: `brakeMetric`, `avoidMetric`, `touchMetric`,
`escapeMetric`, `restMetric`) compute and print, including `n/a` correctly for arms whose ticks carry no v2
declaration (`mock`, `baseline` have no brake/touch/escape/rest; every arm's `avoid` is positional and prints for
all four).

Illustrative run (5 calibration seeds, 50 ticks — far too short for a verdict, long enough to prove the wiring):

```text
arm              find [95 % CI]              approach  eat hungry/sated  walked   hunger-dep  contacts  seeds
mock             0.0 %    [0.0 %, 0.0 %]        n/a       n/a/n/a           0.0 %    n/a         0         5
v2               0.0 %    [0.0 %, 0.0 %]        n/a       n/a/n/a           0.0 %    0.0 %       0         5
random-matched   3.3 %    [0.0 %, 10.0 %]       n/a       n/a/n/a           0.0 %    3.3 %       1         5
baseline         3.3 %    [0.0 %, 10.0 %]       n/a       n/a/n/a           0.0 %    n/a         0         5

ADR 006 Gate C (brake/avoid/touch/escape/rest; n/a where an arm has no v2 declaration):
arm              brake   avoid(spider) avoid(lantern)  touch   escape(near/away per min)  rest (per region)
mock             n/a     3.3 %          0.0 %           n/a     n/a                         n/a
v2               n/a     3.3 %          0.0 %           0.0 %   0.00/0.00                   input=0.048 output=0.113 al=0.673 vnc=0.105 dn=0.154 central=0.295
random-matched   n/a     2.5 %          0.3 %           2.3 %   27.91/19.77                 input=0.709 output=0.729 al=0.730 vnc=0.712 dn=0.701 central=0.720
baseline         n/a     3.2 %          2.6 %           n/a     n/a                         n/a

FAIL      brake              v2 brake ratio < 1 and lower than the random-graph arm (SC-007): v2 n/a, random-matched n/a
```

Brake reads `n/a` here because 50 ticks far from the flower never puts mouth taste on either side — expected,
not a defect. The `rest` numbers match calibration.md's own finding: `al` at ~0.67 and `random-matched` at
~0.70-0.73 across every region are both far above ADR 005's A1 target (0.002-0.1), the ignited regime
calibration.md describes. `random-matched`'s escape rate (near 28/min) also reflects the same ignited regime,
not a meaningful escape-near-danger signal.

## What is not done here

1. A real held-out run (30 seeds, `flies.experiment.ticks` or more, every arm including `v0`/`v1` for
   cross-generation comparison) — needs a calibrated `synapticScale`/`tauSyn`/`input.rate`/`stepsPerTick` first.
2. The SC-007 brake verdict, which depends on that run.
3. `random-matched`'s and `baseline`'s avoid/touch numbers above are not yet meaningful either, for the same
   reason — they are printed to prove the table renders correctly for every arm, not as a finding.

## Next step

Run `node scripts/compare-baseline.mjs --world=world/world-forager-15k.json --brains=mock,v0,v1,v2,random-matched,baseline --seeds=held-out`
once `calibration.md`'s staged protocol has landed on a setting, and record the result in this file in place of
the illustrative run above (the same way `specs/008-hungry-forager-brain/gate-c.md` records v1's).

## Update 2026-10-11 — [BUG-001](bugs/BUG-001.md) fixed, brain re-extracted

The illustrative run above used the **pre-fix** brain (12,996 neurons); its `find`/`walked` numbers for `v2` were
genuinely 0 because the `forward` output pool was structurally net-inhibitory, not because the run was too short.
`forward`'s selection (ADR 006 D11) is now sign-aware and `DNg100` has been dropped from the pool (Q2 resolved;
see `calibration.md`'s own 2026-10-11 update and the ADR 006 Amendment); the real brain was re-extracted
(16,127 neurons, every output pool's net weight/neuron now positive). The "What is not done here" list above is
unchanged in substance — a real held-out run still needs a calibrated setting first — but that calibration can
now actually succeed, which it structurally could not before this fix.
