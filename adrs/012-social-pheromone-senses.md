# ADR 012: Social and pheromone senses

- **Status:** Accepted with findings. The feature is complete, tested and shipped; SC-004 (held-out social
  approach) is **not met** on either map, recorded as a finding, not a defect — see "Results" below and the
  summary at the end of this document.
- **Date:** 2026-10-21
- **Target:** `main`. Branch `020-social-pheromone-senses`.
- **Supersedes:** nothing. Gives the 136 front-leg ppk23/ppk25 GRNs that ADR 007 D16 excluded from `taste-leg`
  their own sense, `contact-pheromone`, rather than reversing D16. Extends ADR 009 D24 (output-partner seeds) and
  ADR 010 D27/D33 (the spiking probe and decoder homeostasis) to two new senses and a new output. Extends ADR 011
  by reusing its C1/C2 calibration protocol on a third brain generation.
- **Inputs:** [specs/020-social-pheromone-senses/spec.md](../specs/020-social-pheromone-senses/spec.md),
  [research.md](../specs/020-social-pheromone-senses/research.md),
  [data-model.md](../specs/020-social-pheromone-senses/data-model.md),
  [contracts/](../specs/020-social-pheromone-senses/contracts/).
- **Numbering:** decisions continue from ADR 011's D53: D54 onward below.

## Context

ADR 007 D16 measured the 136 front-leg ppk23/ppk25 GRNs and excluded them from `taste-leg`, because in a male CNS
they drive courtship, not food taste. That exclusion stands. This ADR gives those neurons their own sense,
`contact-pheromone`, instead of reversing D16, and adds a second new sense, `odour-conspecific`, from the
fly-odour receptor neurons (DA1, VA1v, VA1d). Only the male connectome exists in MaleCNS v1.0, so every fly in the
world — female or male — runs the same brain; the sex tag changes only what a fly emits, never what it senses or
how it decides (R9). "Female" in this feature means a male brain wearing a name tag.

## Neuron selection and seeds

### Type-name mapping (research.md §0.2)

The social pathway the request names does not always match MaleCNS v1.0's own type names one for one. Each name is
checked against the annotations before it is used as a seed:

| Name in the request | Dataset type(s) | Note |
|---|---|---|
| P1 | `pC1_*` | **No type `P1` or synonym exists in v1.0.** P1 is taken as the male-specific pC1 cluster for this
  release. ADR 012 states this; the panel labels the group "pC1 (incl. P1)" |
| vAB3 | `AN09B017e`, `AN09B017f`, `AN09B017g` | found through the `synonyms` column, "Yu 2010: vAB3" |
| mAL | prefixes `mAL4`, `mAL5`, `mAL6`, `mAL_` | the bare prefix `mAL` would also take the non-dimorphic
  `mALB1-5` and `mALD1/3/4` (18 AL neurons unrelated to courtship), so the seed uses the four prefixes instead |
| vPR6 | `vPR6` (8 bodies) | **not seeded.** VNC-intrinsic, downstream of the pIP10 sink (R4) |
| dPR1 | `dPR1` (2 bodies) | **not seeded.** Same reason |

vPR6 and dPR1 exist in the dataset but sit downstream of pIP10 in the VNC song premotor circuit. Because pIP10
becomes an output in this ADR (a sink that drops its outgoing edges), seeding vPR6/dPR1 would give them no song
drive in the brain — the body layer, not the brain, stands in for the VNC from that point on.

The seed filters added to `extract/configs/forager-brain-social.json`:

```json
{ "typePrefixes": ["pC1_", "mAL4", "mAL5", "mAL6", "mAL_"] },
{ "types": ["AN09B017e", "AN09B017f", "AN09B017g", "pIP10"] }
```

### Extraction counts (T016, full detail in `extraction-report.md`)

`forager-brain-social.brain`: 15,349 neurons (seeds 11,543, fill 3,806 — the same fill size as the MB brain's,
research R5), 786,427 edges. Self-check and a second full re-extraction both give byte-identical output apart
from `provenance.createdAt` (combined hash `d5d8451d9b77ef547997f130539f8b27aeda193b2eeed5a562b1455951f58fd4`).

| Pool | L | R | unknown side |
|---|---|---|---|
| `odour-conspecific` (raw, pre-side-match) | 89 | 254 | 123 |
| `contact-pheromone` (raw, pre-side-match) | 69 | 67 | 0 |
| `odour-conspecific-left/right` (shipped channel) | 89 | 89 | — |
| `contact-pheromone-left/right` (shipped channel) | 64 | 64 | — |

Seed filters added **295** bodies with origin `seed:type`: mAL **141/141** (full dataset coverage), vAB3
(`AN09B017e/f/g`) **6/6** (full coverage), pC1 **148/156** (the 8-body gap is admission attrition — not every
annotated pC1 body is `status=Traced` at `minConfidence`, not a selection choice). pIP10 (2/2) became the
`song` output, not a seed.

**SC-001 holds:** the `taste-leg` `bodyId` set (164 bodies, 80 L / 84 R) is **identical** to
`forager-brain-mb.brain`'s. No `putative_ppk23`/`putative_ppk25` body is in `taste-leg`, and no receptor type
other than those two is in `contact-pheromone`; the two pools are disjoint and together cover the same 300-body
front-leg GRN population D16 measured. The social cut keeps 14,308 of the MB brain's 14,500 `bodyId`s (98.7%).

**Fidelity (full table in `fidelity.md`):** both new contrast checks clear the 0.1 `minFraction` gate by a wide
margin — `odour-conspecific` 83%, `contact-pheromone` 82% — and every pre-existing check still passes at
essentially the same fraction as the MB brain's.

## Fidelity

T020, full detail and the audit's bridge/coverage breakdown in `fidelity.md`. The conspecific and contact L/R
turn contrast, brain over whole graph, both clear the 0.1 `minFraction` gate by a wide margin:

| Pair | Fraction (brain / whole graph) |
|---|---|
| `odour-conspecific` | **83%** |
| `contact-pheromone` | **82%** |
| `odour-conspecific` + `ORN_VL2a` (R2 variant, not shipped) | 83% (unchanged) |

This is the opposite of the plan's flagged risk ("no side pool... likely"): the social pathway, seeded by type
identity rather than weight-ranked fill, carries its own steering signal about as cleanly as food (98%/91%) and
heat (93%). **R2 verdict:** `ORN_VL2a` makes no material difference, so it stays out of the shipped config.

Every pre-existing check (food A/B, heat, touch, mouth and leg signs) still passes, within 1-2 points of the MB
brain's own value — the small drift is R5's expected "same fill size, larger seed set" effect. The `song` pool
(pIP10) keeps 100% of its whole-graph input. No bridge is added; no finding is recorded.

## Claims and valence

T030, full detail in `claims.md`. **Gate C clears here.**

### The linear probe disagrees with itself for both pairs

Both social senses turn the fly **toward** their stimulated side in the extraction's own 8-step linear probe
(turn contrast positive at both brain and whole-graph level), which is the approach signature. But both pairs
also raise the `backward` readout (and `contact-pheromone` also raises `escape`), which is the avoid
signature — the same linear table cannot tell whether the brain executes "turn toward, then back away" or is
simply noisy at this step count.

### The C2 spiking probe (`social-v3` profile, D27, calibration seeds) adds real evidence, not a tiebreaker

- **`odour-conspecific`** gets a robust, sense-specific `drive` pool (138 members, 0.243 Hz rise) but **no**
  reproducible side pool — its first C2 attempt failed `E-DECODE-side.odour-conspecific.R` on the held-back
  seed, the same single-spike shot-noise pattern the MB brain's `odour-food-a`/`-b`/`taste-leg` already showed.
  Declared via `noSidePairs`, not retried with a looser threshold. With no side response measured, there is
  nothing to test "turns toward" against beyond the linear probe's own internal conflict.
- **`contact-pheromone`** gets a genuine, held-back-seed-reproducible side pool (14 L / 15 R) — concentrated
  into fewer, more strongly responding neurons (30 members, 0.95 Hz) than the random-graph null's diffuse
  equivalent (208 members, 0.63 Hz, no side pool at all). The brain really does carry exploitable lateral
  information for this sense that a size-matched random graph does not. But C2 confirms the sense is
  *steerable*, not *which way*: deciding toward vs. away still rests on the linear probe's own unresolved
  conflict. The `song` pathway the linear probe found positive (+8.95e-06 brain / +9.29e-06 whole graph) did
  **not** show up as an actual spike-rate rise in a direct 5-seed, 3000-tick measurement of pIP10 under
  bilateral stimulation (0 Hz, both the real brain and the random graph) — **pIP10 is silent at this
  calibration**, the risk the plan flagged as a possible outcome, realised.
- **`reinforcement-reward` lost its own drive pool** on this run (zero candidates cleared the specificity
  gate against the enlarged pair set, research R15's predicted mechanism) — a difference from the MB decoder,
  recorded as a finding, not retried; it gates nothing in this feature.

### Declaration: `odour-conspecific` and `contact-pheromone` are both `valence: "none"`

Neither probe gives a consistent, non-conflicting sign for either pair (R7's own rule: "none when the two
probes disagree"). `odour-conspecific` does **not** come out aversive as the cVA literature predicts (R17:
Kurtovic et al. 2007, Wang & Anderson 2010) — nor does it come out consistently approach-like either; the
result is genuinely mixed. `contact-pheromone`'s measured steering capacity (unlike conspecific's) shows the
sense is not functionally mute, but this feature's probes do not pin down its sign, and courtship-promoting
ppk23 literature (R17: Thistle et al. 2012, Toda et al. 2012) is a prior to weigh in a future feature, not a
substitute for a measured sign here. `valenceSource` in `forager-brain-social.decoder.json` records
`claims.md#odour-conspecific` / `#contact-pheromone` for both. With `valence: "none"`, both senses still reach
and drive the brain (the measured `drive` pools above are real), but the body layer gives neither a klinotaxis
steering term (`VALENCE_SIGN.none = 0`, Principle VI) — the honest outcome when the brain carries no consistent
sign, rather than asserting a direction the data does not support.

World-code tasks (Phase 5 onward) may proceed.

## Calibration

T053, full detail in `calibration.md`. **There was nothing to tune, and the five placeholder values are kept.**

`body-layer.js`'s `sumByValence` multiplies every steering term (tropotaxis's side comparison and klinotaxis's
trend alike) by `VALENCE_SIGN[sense.valence]`, which is `0` for `"none"` — the sign this feature's own Gate C
measured for both social senses (above). So neither sense contributes any turn or speed term, by construction,
regardless of `odour:conspecific` `radius`/`contrast`, `flies.body.bodyRadius`, emission per sex, `solid`, or
`song.threshold`/`.tau`: those are world-geometry parameters shared identically by every experiment arm, and
only the brain differs between arms. No such parameter can change the one thing that differs (a steering
contribution that is zero by construction), so none can change the SC-004 comparison. Retuning world geometry
to chase a different verdict would be the AGENTS.md rule against adjusting code to make a number pass, applied
one level up, to world config.

What calibration did check: a baseline run (5 calibration seeds × 6 flies × 3000 ticks, every arm) confirms the
placeholders already give the senses real, non-zero exposure — social's time-near 3.4% [2.2%, 4.7%] and
contact rate 0.187/min [0.093, 0.307], several individual flies logging up to 19% time-near or 1.6 contacts/min
— not a geometry so sparse that "no effect" would be confounded with "no exposure". The social arm does not
separate from `random-graph` or `random-walk` on either verdict metric; `ablated` is, if anything, slightly
higher than `social` on time-near. `song` is `0` whenever a contact event occurs, consistent with pIP10's
measured silence above — `song.threshold`/`.tau` have nothing to calibrate against, since the pool they gate
never rises. Full numbers in `calibration.md` and `calibration-baseline-results.md`/`.json`.

The held-out verdict (T061) is still run in full: a structural non-effect at calibration time is itself worth
confirming on held-out seeds, independently of this reasoning.

## Results

T061/T062/T066, full detail and raw per-arm tables in `results.md`, `results-raw.md`,
`results-tilemap-raw.md`, `results-no-social-raw.md`.

**SC-004 (held-out verdict): not met, on either map.** 30 held-out seeds, both maps:

| Arm (main map) | Time near (≤2 tiles) | Contact rate (per fly/min) |
|---|---|---|
| social | 3.6% [2.7%, 4.3%] | 0.200 [0.138, 0.264] |
| ablated | 4.0% [3.1%, 5.0%] | 0.218 [0.167, 0.276] |
| random-graph | 2.7% [1.9%, 3.7%] | 0.100 [0.073, 0.129] |
| random-walk | 4.3% [2.9%, 5.8%] | 0.142 [0.096, 0.191] |

| Arm (tilemap) | Time near (≤2 tiles) | Contact rate (per fly/min) |
|---|---|---|
| social | 5.7% [4.7%, 6.8%] | 0.349 [0.269, 0.429] |
| ablated | 5.2% [4.2%, 6.4%] | 0.307 [0.247, 0.376] |
| random-graph | 2.9% [2.4%, 3.5%] | 0.313 [0.240, 0.391] |
| random-walk | 10.4% [9.0%, 11.8%] | 0.889 [0.776, 1.029] |

Of the four required comparisons (time-near and contact-rate, each against both null arms, non-overlapping
CIs), only one clears the bar: `social`'s contact rate beats `random-graph` on the main map. Every other
comparison fails to separate, and on the tilemap `random-walk` substantially **exceeds** `social` on both
metrics — flies taking a pure random walk on the smaller map cross paths with each other more than flies
running the real brain do, the opposite of SC-004's directional claim.

**Ablated comparison.** Lesioning the four social input neurons does not reduce time-near or contact-rate on
either map (`ablated` reads at or slightly above `social` throughout) — the one comparison that does separate
`social` from a null arm (contact-rate vs `random-graph`, main map) is therefore **not shown to be
pheromonal**.

**Why this is the expected result, not a new failure.** Both social senses measured `valence: "none"` at Gate
C, above. `body-layer.js` zeroes every steering contribution for a `"none"`-valence sense (`VALENCE_SIGN.none =
0`, `calibration.md` "T053"), on every arm and every map alike. The scattered, inconsistent arm-to-arm
differences above are the shape expected from shared body/topology effects with no steering mechanism behind
them, not evidence that a real pheromonal effect was missed by calibration or seed choice.

**Sex split.** Every metric splits near-evenly by the other fly's sex on both maps (e.g. main map `social`:
3.7% time-near for a female neighbour vs 3.2% for a male) — no sex-specific effect, consistent with the same
structural absence of steering.

**Song.** `songPerContact` and `songPerTickAlone` are `0` for every arm, both maps, across all 30 seeds — pIP10
stays silent in the closed-loop runs too, matching its direct spiking measurement above. No fly is ever drawn
singing in this feature's held-out runs.

**Following index** sits near 0 for every arm on both maps, with no consistent sign: no arm shows a
follower-like heading correlation, the expected consequence of no steering response to a sensed neighbour.

**SC-005 (regression, held-out): holds.** With the social stimuli silenced, find rate (95.6% vs 96.1% on),
feeding (49.0% vs 48.9%), food-A/B approach and danger escape are statistically indistinguishable from the
stimuli-on run, and all three sit in the same band as the MB brain's own held-out spread
(`world-forager-learning.json`, run through the same `scripts/social-arms.mjs` metric definitions: find 95.0%
[91.7%, 97.8%], feeding 43.5%, approach medians 980–1094 vs the social world's 834–1042, danger escape 19.4%).
Full table in `results.md`.

## Summary (T067)

| Criterion | Result | Where |
|---|---|---|
| SC-001 (byte-identical re-extraction, leg-taste/contact-pheromone pools) | Pass | `extraction-report.md` |
| SC-002 (probe results for both senses recorded before world code) | Pass | "Claims and valence" above |
| SC-003 (two-fly conspecific/contact side test, 100%) | Pass | `tests/slow/social-two-fly.test.mjs` |
| SC-004 (held-out social approach beats both null arms) | **Not met**, recorded as a finding | "Results" above, `results.md` |
| SC-005 (food/danger regression with social stimuli off) | Pass | "Results" above, `results.md` |
| SC-006 (test suites pass, old worlds load, old results unchanged) | Pass | `results.md` "Regression" |
| SC-007 (6 flies, no console errors, no frame-rate drop) | Pass, with a stated measurement caveat (no GPU in the sandbox that ran the check; a per-tick compute-cost proxy stood in) | `calibration.md` T045 |
| SC-008 (panel shows sex tag, male-brain wording, smelling/touching) | Pass | `calibration.md` T045, `tests/panel-inputs-v1.test.mjs` |

Six of eight criteria pass outright; SC-004 does not, and is the feature's own headline finding (both social
senses measured `valence: "none"`, so the network carries the pheromone senses but with no resolved steering
sign — a complete, negative answer to "does a declared social sense make a fly approach another fly", not an
unfinished one). SC-005 confirms the rest of the brain (food, danger) is unaffected by that finding.

## Literature

- Kurtovic, Widmer & Dickson 2007, *Nature* 446:542: Or67d/DA1 mediates cVA responses.
- Wang & Anderson 2010, *Nature* 463:227: cVA promotes male–male aggression via Or67d.
- Thistle et al. 2012, *Cell* 149:1140; Toda, Zhao & Dickson 2012, *Cell Rep* 1:599; Lu et al. 2012, *PLoS Genet*:
  ppk23 foreleg neurons sense female pheromones and promote courtship.
- Clowney et al. 2015, *Neuron* 87:1036 (vAB3/PPN1 → P1 and mAL); Kallman et al. 2015, *eLife* 4:e11188
  (vAB3 → P1).
- von Philipsborn et al. 2011, *Neuron* 69:509: P1, pIP10, vPR6, dPR1 in courtship song.
- Dweck et al. 2015, *eLife* 4:e10203 (Or47b, Or88a respond to fly odours); Grosjean et al. 2011, *Nature* 478:236
  (Ir84a, food and courtship).
