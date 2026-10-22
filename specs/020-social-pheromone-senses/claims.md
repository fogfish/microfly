# Claims: Social and Pheromone Senses

Phase 4 (US2), T021. A linear claim table (ADR 007 style) for `odour-conspecific` and `contact-pheromone`, read
from `forager-brain-social.brain`'s own fidelity `table` (turn contrast, computed as the shipped `contrast`
check does) plus a scratch extraction that added `sign` checks on `forward`/`backward`/`feed`/`escape`/`song`
for the merged L+R pool of each social pair (not shipped; `fidelity.require: false` so the run could complete
regardless of outcome). Research R7's approach/avoid predicate is:

> **approach** = (turn toward) OR (forward rises AND backward falls)
> **avoid** = (turn away) OR (backward rises) OR (alarm/escape rises)

Only `turn-contrast`, `forward`, `backward` and `escape` are terms of that predicate; `feed` and `song` are
reported as context (song gets its own declaration under R12, not an approach/avoid reading). "Holds" means
the measured sign (agreeing at brain and whole-graph level) matches the reading's prediction; "does not hold"
means it disagrees; "mixed" means brain and whole graph disagree with each other; "not tested" means R7's
predicate does not use that metric for that reading.

## `odour-conspecific`

| Row | Brain value | Whole-graph value | Agreement | Approach reading | Avoid reading |
|---|---|---|---|---|---|
| turn-contrast | +8.80e-07 | +1.06e-06 | toward | **holds** | does not hold |
| forward | -6.12e-08 | -1.74e-07 | falls | does not hold | not tested |
| backward | +4.13e-07 | +4.16e-07 | rises | does not hold | **holds** |
| escape (alarm) | -3.50e-07 | -5.67e-07 | falls | not tested | does not hold |
| feed (context) | +1.87e-07 | +3.79e-07 | rises | — | — |
| song (context, R12) | -7.04e-06 | -6.64e-06 | falls | — | — |

**Predicate verdict:** APPROACH = true (turn-toward clause alone satisfies it). AVOID = true (backward-rises
clause alone satisfies it). **The two probes disagree** — turning says approach, the bilateral backward/escape
readout says avoid. This is exactly the "none" case research R7 anticipates when the linear probe alone does
not give a consistent sign; the C2 spiking probe (T025) and the literature (R17: cVA is reported aversive in
males) are needed before ADR 012 declares a valence (T030).

## `contact-pheromone`

| Row | Brain value | Whole-graph value | Agreement | Approach reading | Avoid reading |
|---|---|---|---|---|---|
| turn-contrast | +4.41e-05 | +5.38e-05 | toward | **holds** | does not hold |
| forward | +1.75e-06 | -1.11e-06 | **mixed** | mixed | not tested |
| backward | +6.21e-06 | +6.98e-06 | rises | does not hold | **holds** |
| escape (alarm) | +9.37e-07 | +7.64e-07 | rises | not tested | **holds** |
| feed (context) | -4.28e-07 | -6.73e-07 | falls | — | — |
| song (context, R12) | +8.95e-06 | +9.29e-06 | rises | — | — |

**Predicate verdict:** APPROACH = true (turn-toward clause alone satisfies it, despite the mixed `forward` sign
making the compound forward-and-backward clause unusable). AVOID = true (backward-rises **and**
escape-rises both independently satisfy it). **The two probes disagree**, the same pattern as
`odour-conspecific`: turning toward says approach, while backward and escape both rising says avoid.

**Note on `song`:** contact-pheromone's rise in the song pool (brain +8.95e-06, whole +9.29e-06, agreeing sign)
is a biologically sensible result on its own terms — a courtship-command pathway (pIP10) rising when the
pheromone-sensing GRNs are stimulated — independent of the approach/avoid question above.

## C2 spiking probe (T025/T026/T029)

`microfly-calibrate` profile `social-v3`: C1 confirmed the MB world's shipped LIF block unchanged (rest activity
0.0005, within [0.0001, 0.001], 4.1 min). C2 (D27, calibration seeds [1,2,3,6,7], held-back seed 4, 3000 ticks,
`non-input` candidates) built `public/brains/forager-brain-social.decoder.json`.

**Finding:** `odour-conspecific`'s first C2 attempt failed `E-DECODE-side.odour-conspecific.R` — the held-back
seed's right-side candidates flipped sign, the same single-spike-level shot-noise reproduction failure the MB
brain's `odour-food-a`/`odour-food-b`/`taste-leg` already showed (`forager-mb.mjs`'s `noSidePairs`). Declared
there rather than retried with a looser threshold (AGENTS.md: a behaviour failure is a finding, not a bug to
code around); `odour-conspecific` joins `noSidePairs` in `social-v3.mjs`.

| Pool | Members | Rest (Hz) | Bilateral rise (Hz) |
|---|---|---|---|
| `drive.odour-conspecific` (no side pool — the finding above) | 138 | 0 | **0.243** |
| `drive.contact-pheromone` | 30 | 0.034 | **0.950** |
| `side.contact-pheromone.L` | 14 | — | — |
| `side.contact-pheromone.R` | 15 | — | — |
| `song` (rate under `contact-pheromone` bilateral) | 2 | 0 | **0** |

`contact-pheromone` is the only social pair — and one of only four pairs on this brain at all, with
`heat`/`taste-mouth`/`touch` — to get a genuine, reproducible side pool: 14 L / 15 R candidates whose selectivity
held on the held-back seed. `odour-conspecific` has a robust drive pool (138 members, a clear 0.243 Hz rise)
but, per the finding above, no side-selective population survives reproduction.

**`reinforcement-reward` lost its drive pool entirely** on this run (zero candidates cleared the specificity
gate) — a difference from the MB decoder, where it did. The most likely cause is research R15's own predicted
mechanism: the specificity gate now also compares each candidate's rise against the two new social pairs, and
on this run no reward-responsive candidate cleared 2x every other pair's rise, social pairs included. This is
recorded as a finding, not retried; `reinforcement-reward`'s absence does not gate this feature (it is not a
declared sense the body layer steers by).

**Song is silent under direct measurement.** The linear probe (above) found `contact-pheromone→song` positive
at both brain and whole-graph level (+8.95e-06 / +9.29e-06) — but a direct 5-seed, 3000-tick spiking probe of
pIP10 under full-strength bilateral `contact-pheromone` stimulation measured **zero rise over a zero rest
rate**: pIP10 did not spike at all in this probe, in either condition, on either the real brain or its
random-graph rewiring. This is the plan's flagged risk realised ("pIP10 is silent... that is a finding," plan.md
Risks): at this brain's calibrated operating point (rest activity ~0.0005, the deliberately sparse C1 regime),
a positive linear bias through the weighted graph does not translate into an observable spike-rate rise for a
2-neuron output pool over this probe window. The `song` named pool exists in the decoder (by construction,
T023: any `song` output gets one, whether or not it is ever observed to fire) but W17 (the wing-extension
reflex) will not trigger under the calibration seeds measured here unless Phase 7 calibration finds different
song parameters or seeds change the picture.

## Random-graph arm (T026, research R11/R13)

The same C2 rule against `rewire(forager-brain-social.brain, 0x52470001)` — `public/brains/
forager-brain-social.rg.decoder.json`. Side-pool selection was skipped for every pair on this arm (not just the
social ones): the first attempt failed `E-DECODE-side.reinforcement-reward.L`, a pair unrelated to either
social sense — expected of a true null model, where any apparent held-back-seed reproducibility is chance, not
signal. The comparison below is therefore on drive-pool size and rise only, which is what T026 asks for.

| Pool | Real brain members / rise (Hz) | Random graph members / rise (Hz) |
|---|---|---|
| `drive.odour-conspecific` | 138 / **0.243** | 58 / **0.523** |
| `drive.contact-pheromone` | 30 / **0.950** | 208 / **0.629** |
| `song` (under contact-pheromone bilateral) | 2 / 0 | 2 / 0 |

**`contact-pheromone` is the cleaner case for a real-connectome effect:** the real brain concentrates its
response onto a *small, strongly selective* population (30 members, 0.95 Hz, plus a genuine side pool) while
the size-matched random graph spreads a *weaker* response over nearly 7x as many candidates (208 members, 0.63
Hz) and gets no reproducible side pool at all. That is the qualitative signature a real, structured pathway
should leave against a degree-preserving null: fewer, more selective responders, not more diffuse ones.

**`odour-conspecific` does not show the same clean pattern.** The real brain's pool is larger (138 vs 58
members) but has a *lower* per-member rise (0.243 Hz vs 0.523 Hz) than the random graph's, and the random
graph's pool has a small nonzero rest rate (0.008 Hz) the real brain's pool does not. Interpreting "larger but
weaker" against "smaller but stronger" as evidence for or against a real effect is not something this probe
can settle alone — it is reported as an open question for the held-out behavioural verdict (social-arms.mjs,
Phase 7), not resolved here.

## Summary

Both social senses turn the fly **toward** their stimulated side in the linear probe (the turn-contrast row
holds for approach on both), but both also raise the `backward` and (for contact) `escape` readout — the avoid
signature. A linear 8-step probe cannot adjudicate that conflict by itself: it has no way to tell whether the
brain executes "turn toward, then back away" (not a contradiction behaviourally — consistent with an
orient-then-withdraw sequence) or whether the readout is simply noisy at this step count.

The C2 spiking probe adds real evidence but does not resolve the conflict either way:

- **`odour-conspecific`** gets no reproducible side pool at all (the `E-DECODE-side.odour-conspecific.R`
  finding) — the brain carries a robust, sense-specific drive signal (138 members, 0.243 Hz rise) but no
  measured lateral/steering information to test "turns toward" against. With no side response to read, and the
  linear probe's own two components disagreeing, there is no consistent sign here to declare.
- **`contact-pheromone`** gets a genuine, reproducible side pool (14 L / 15 R), concentrated more tightly and
  responding more strongly than the size-matched random graph's diffuse equivalent (research R11) — real
  evidence that the brain carries exploitable lateral information for this sense, unlike conspecific odour.
  But C2 confirms the sense is *steerable*, not *which way*: the linear probe's conflicting toward/backward
  signs are the only directional evidence available, and they still disagree. The `song` pathway the linear
  probe found positive (+8.95e-06/+9.29e-06) does not show up as an actual spike-rate rise in direct
  measurement (0 Hz, both brain and random graph) — pIP10 appears silent at this calibration, the plan's
  flagged risk realised (plan.md Risks).

**Declaration (R7): both pairs are `none`.** Neither probe gives a consistent, non-conflicting sign for either
pair. `odour-conspecific` does not come out aversive as the cVA literature (R17) would predict, nor does it
come out consistently approach-like either — the result is genuinely mixed, not a clean match to the
literature in either direction. `contact-pheromone`'s real, measured steering capacity (unlike conspecific's)
means the sense is not functionally mute, but this feature's probes do not yet pin down its sign; `none` keeps
it feeding the brain honestly rather than asserting a direction the data does not support (Principle VI). ADR
012 T030 records this as the formal declaration.
