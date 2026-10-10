# Calibration: the 15K cautious forager brain's LIF settings (ADR 006 L11)

- **Date:** 2026-10-10
- **Seeds:** exploratory only (7, 42). No `experiment.seeds`/held-out run was used for this pass; this is a
  first calibration-seed look, not a verdict (ADR 006's own Calibration protocol: "calibration seeds only for
  every stage; held-out seeds for the verdict").
- **Brain:** `public/brains/forager-brain-15k.brain`, extracted from the real dataset (12,996 neurons, 1,565,493
  edges at `minSynapses: 1`; see T023's commit message for the full report). `weightRule: synapseCount`.

## Starting point (L11)

`dt` 1, `tau` 20, `refractorySteps` 2, `tauSyn` 5, `synapticScale` 0.04, `stepsPerTick` 10 — the values ADR 006
L11 quotes from Shiu et al. 2024, shipped as-is in `world-forager-15k.json` (no tuning yet).

**Measured** (seed 7, 1,000 ticks, fly away from any flower, no stimulus): mean activity **26.5 %** of neurons
per LIF step. ADR 005's A1 rest gate wants 0.2–10 %. This is well above it — the network is ignited, not quiet,
at the starting `synapticScale`.

## Exploratory sweep (not a staged calibration)

A quick sweep of `synapticScale` alone (seed 42, fly 3.5 tiles from the large flower, 500–2,000 ticks per
point), everything else at the L11 starting values:

| `synapticScale` | mean activity | `forward` output | fly moves toward the flower? |
|---|---|---|---|
| 0.02 | ~23 % | 0 | no (turns in place) |
| 0.04 (shipped) | ~26–28 % | 0 | no |
| 0.05–0.07 | ~30–32 % | ≈ 0 | erratic (wanders toward the world edge on some seeds) |
| 0.08–0.16 | ~34–38 % | 0.1–0.4 | sometimes — one run reached and passed the flower; not reproduced cleanly across nearby scales |

**Finding.** As in ADR 005's own history with the v1 brain (Annex B), this subgraph does not show a clean
monotone path from "silent" to "a stable walking/foraging regime" as `synapticScale` rises — the measured
`forward`/`feed` outputs are noisy and not consistently responsive to distance-to-flower across this narrow
sweep. A real calibration needs the full staged protocol ADR 006 describes (per-group A1 gates — rest,
odour-above-rest in `al`/`central`, the brake and feed gates on a clamped input — then B on held-out seeds, and
the `synapseCount` vs `postFractionAbsolute` comparison), which was not run here: it is a multi-round search over
`synapticScale` × `tauSyn` × `input.rate[1]` × `stepsPerTick`, each round needing its own held-out verification,
the same shape of effort spec 008's own `calibration.md` records (five grid rounds for a brain 4.5× smaller and
far cheaper to step).

## What this means for the shipped world file

`world/world-forager-15k.json` ships the L11 starting values unmodified, labelled as a starting point, not a
calibrated setting (`public/world/README.md`'s convention for an uncalibrated brain). The wiring this feature
delivers — six senses reaching the network, the pair-grid-selected brake/feed/escape pathways, Poisson input
encoding, `groupGain`, the escape physics and cooldown, the panel's region-activity section, and the experiment
script's five new metrics — is all in place and exercised by the test suite (`npm test`) against the real
extracted brain. The *behavioural* acceptance criteria that depend on a calibrated network (SC-007's brake ratio,
US1's find-rate parity with v1, Gate C's held-out comparison) are not yet verified and are the next piece of
work, scoped the same way spec 008 scoped its own calibration pass: as follow-up work on top of a feature that is
otherwise complete, not a blocker folded into this implementation pass.

## Next steps (not done here)

1. Run ADR 006's A1 gates per group (`input`, `output`, `al`, `vnc`, `dn`, `central`) on a clamped input, across
   a `synapticScale` × `tauSyn` × `input.rate[1]` × `stepsPerTick` grid centred on the L11 values.
2. Compare the `synapseCount` and `postFractionAbsolute` weight rules through A1; take the more robust one to B.
3. Verify the brake (SC-007) and find-rate-parity (US1) criteria on held-out seeds, recording the run exactly as
   this document's "Interim choice" sections (`specs/008-hungry-forager-brain/calibration.md`) do for v1.
