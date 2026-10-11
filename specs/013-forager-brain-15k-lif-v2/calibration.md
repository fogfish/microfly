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

## Update 2026-10-11 — [BUG-001](bugs/BUG-001.md) fixed, brain re-extracted

Everything above this line was measured against the **pre-fix** brain (12,996 neurons). `/microfly-calibrate`'s
own runs (`.claude/skills/microfly-calibrate/runs/v2-*-2026-10-10/`) found `find.rate: 0`/`walked: 0` at every
point in that brain's exploratory sweep, at both the calibrated-quiet end (`synapticScale` 0.011) and the
saturated end. The root cause was not a parameter: `forward`'s pair-grid selection (D11) was sign-blind, so the
induced subgraph it chose was net inhibitory (**−867 signed weight/neuron**) regardless of scale.

The fix (ADR 006 Amendment 2026-10-10; `specs/013-forager-brain-15k-lif-v2/tasks.md` T091–T094) makes D11's
score sign-aware and narrows `forward` to `DNp09` alone (dropping `DNg100`, itself measured net-inhibitory on the
full connectome). The brain was re-extracted: **16,127 neurons, 1,839,129 edges**, every output pool's net
weight/neuron now positive (`forward +3719`, `turn-left +9152`, `turn-right +9329`, `backward +2431`,
`feed +253`, `escape +7911`). `public/brains/forager-brain-15k.brain` was replaced with this new extraction.

**None of the numbers above (26.5% rest activity, the `synapticScale` sweep table) apply to the new brain** —
its neuron count, edge count and admitted interneuron population are all different now. A fresh
`/microfly-calibrate` pass on the new snapshot is still needed before SC-007 (brake) and US1 (find-rate parity)
can be verified; this document's "Next steps" above are otherwise still the right next actions, just against the
new file.

## Update 2026-10-11 — `/microfly-calibrate --stage=auto` on the post-BUG-001 brain: no A1 pass, one near-miss

Five `--stage=auto` runs against the re-extracted brain (16,127 neurons), all calibration-seed only, no held-out
seeds touched. **0 of 342 valid A1 grid points pass** (robust, >= 50% of axis-neighbours also passing). No
world-stage run was attempted — there is no A1-passing candidate to carry into it.

1. **Plain `synapticScale` grid** (`runs/v2-auto-20261011/auto.json`, 48 points, scale 0.002–0.02 ×
   `tauSyn` × `inputRateHigh` × `stepsPerTick`): a cliff, not a ramp. At 0.002 the network is silent
   (`output`/`vnc`/`central` quiet, only `al` flickers on at some `stepsPerTick`). At >= 0.005 everything —
   `output`, `al`, `vnc`, `dn`, `central` — is ignited together, with `gain:al`/`gain:central` also failing.
   0/48 pass.
2. **Narrowed scale grid** (`runs/v2-auto-narrow-20261011/auto.json`, 60 points, scale 0.0025–0.0045): same
   cliff at finer resolution. 0.0025 leaves `al` ignited alone while the rest stay silent; >= 0.003 ignites
   everything at once. 0/60 pass.
3. **Tooling bug found and fixed**: `calibrate.mjs`'s phase-2 axes merge applied
   `profile.groupGainAxisFor(stuck)` *after* `--axes`, and that function returns the truthy `[{}]` (not `null`)
   whenever classify finds no "stuck" region — silently discarding any `groupGain` the operator passed via
   `--axes`. `al` never satisfies classify's strict "ignited at every scanned scale" test, so this fired every
   time. Fixed in `.claude/skills/microfly-calibrate/scripts/calibrate.mjs` (explicit `--axes` override now wins).
   A `groupGain.al` run taken before this fix (`runs/v2-auto-algain-20261011/`) is invalid and is not used below.
4. **`groupGain.al` grid, post-fix** (`runs/v2-auto-algain-fixed-20261011/auto.json`, 144 points, scale
   {0.005, 0.01, 0.02} × `al` gain {0.1, 0.2, 0.3, 0.5}): suppressing `al`'s own gain does not decouple it from
   the rest of the network. At scale 0.005, `al` gain 0.1–0.3 leaves *everything* silent (`output`, `vnc`, `dn`,
   `central` included) — not just `al`. `al` gain 0.5 re-ignites everything together, same as before. Reading:
   `al` looks upstream of the rest of this circuit's activity rather than merely more excitable than it; there is
   no tested point where `al` is calm and downstream regions are still responsive. 0/144 pass.
5. **Fine grid around the transition** (`runs/v2-auto-algain-fine-20261011/auto.json`, 90 points, scale
   0.005–0.01 step 0.001 × `al` gain {0.3, 0.35, 0.4, 0.45, 0.5}, `tauSyn`=5, `stepsPerTick`=10 pinned,
   `inputRateHigh` kept at {0.08, 0.15, 0.3} to confirm robustness): **one consistent near-miss**. At
   `synapticScale=0.006, groupGain.al=0.4`, the only failing gate at *all three* `inputRateHigh` values is
   `ignited:output` — `al`, `vnc`, `dn` and `central` all sit inside the 0.2–10% rest band
   (`profiles/v2.mjs` `gates.restFloor`/`restCeiling`). Every neighbouring `al` gain (0.35 or 0.45) at the same
   scale fails on 3–4 regions at once; this point is a genuine local minimum, not noise. 0/90 pass, but this is
   the closest point found across all five runs.

**Finding.** A single global `synapticScale` cannot place `al` and the rest of the network in their quiet bands
at the same time — `al` drives the others rather than merely co-exciting with them. The best lead so far
(`synapticScale=0.006`, `groupGain.al=0.4`) leaves only `output`'s own rest activity slightly over the 0.1
ceiling; nothing else is close. The untried next lever is a `groupGain.output` axis (mirroring `groupGain.al`)
scanned near this point, to see whether `output` alone can be brought down without disturbing `al`/`vnc`/`dn`/
`central`. No shipped world config, extractor config, or this document's "shipped" status was changed by any of
these runs — `world/world-forager-15k.json` still ships the unmodified L11 starting values.
