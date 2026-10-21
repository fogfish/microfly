# ADR 011: Mushroom-body valence learning

- **Status:** Proposed — regime gate passed on retry (D40, D41), 2026-10-20; Phase 4 (User Story 2, the learning
  mechanism) is complete and verified: L12 plasticity implemented and unit-tested, every teaching signal
  injected (D37), the MB output layer's silence found and fixed (D42-D44), the conditioning probe's shuffled
  control found and fixed (D45), **SC-002 passes on held-out seeds (D46)**. Phase 5 (regression) confirmed no
  change to the wide brain or existing tests. The C2 decoder build (`forager-brain-mb.decoder.json`) is done
  (D47): its 4 side-pool reproducibility failures were a measured shot-noise effect, not a bug, fixed with a
  declared opt-out rather than a loosened gate; Phase 6/7 (in-world behaviour) is now unblocked. History: the
  first gate run
  failed (D36) and so did its remedy (D38). The retry fixed the probe, attenuated the olfactory path and set the
  learning world's own LIF regime (D40). It then missed only the reliability target, by 0.004-0.006, and D41
  relaxed that target from 0.9 to 0.85.
- **Date:** 2026-10-19
- **Target:** `main`. Branch `019-mb-valence-learning`.
- **Supersedes:** nothing. Extends ADR 010 D34 (mushroom-body valence learning, "optional, not on the MUST path")
  from an outline into an implemented, gated feature.
- **Inputs:** [specs/019-mb-valence-learning/spec.md](../specs/019-mb-valence-learning/spec.md),
  [research.md](../specs/019-mb-valence-learning/research.md),
  [data-model.md](../specs/019-mb-valence-learning/data-model.md),
  [contracts/](../specs/019-mb-valence-learning/contracts/).
- **Numbering:** decisions continue from ADR 010's D34: D35–D38 below. LIF decisions L11 (`pathwayGain`) and L12
  (`plasticity`), per `contracts/lif-v1-plasticity.md`.

## Context

ADR 010 D34 named mushroom-body valence learning as optional and left it for its own feature. The 14.5K
connectome already contains the whole mushroom body (4,064 Kenyon cells, 97 MBONs across 37 types, 316 PAM and 16
PPL1 DANs, 33,496 KC→MBON edges — research.md §0), with no plasticity engaged. This ADR records the decisions this
feature makes to turn that into a learning circuit: two non-overlapping food odours, a regime gate on the KC code
before any learning code exists (FR-008, a hard stop), the plasticity rule itself, and the readout path into
behaviour.

## D35. Two non-overlapping food odours, extracted once

A new extraction config `extract/configs/forager-brain-mb.json` replaces the wide brain's single `odour-food`
input pair with `odour-food-a` (ORN_DM1/DM2/DM4) and `odour-food-b` (ORN_VA2/DP1m/VM5d), plus two teaching pairs
(`reinforcement-reward-*` on PAM, `reinforcement-punish-*` on PPL1), extracted up front so one extraction serves
both outcomes of the teaching-signal probe (research.md §1, §6). The wide brain and its decoder are untouched.

_Filled by Phase 2 (T003–T017)._

## D35a. MBON role coverage: 2 of 37 types, by necessity

The learning sidecar (`public/brains/forager-brain-mb.learning.json`) assigns a role to only 2 of the brain's 37
MBON types: MBON01 (glutamatergic, avoid; Owald et al. 2015 *Neuron* 86(2):417-427, the "M4/6" cluster built on
Aso et al. 2014's naming) and MBON11 (GABAergic, approach; Aso et al. 2014 eLife 3:e04580 Fig. 5-6,
MBON-γ1pedc>α/β "MVP2", corroborated by Perisse et al. 2016 *Neuron* 90(5):1086-1099). The other 35 types are
listed in the sidecar's `unverified` array, not because Aso et al. 2014 showed no behavioural effect for them,
but because this session could not retrieve the paper's actual Figure 5-6 content (elifesciences.org and its PMC
mirror both returned bot-check/loading-error pages to automated fetches) and found no independently-citable
secondary source for the remaining types after several targeted searches (diminishing returns on γ2α′1, α3,
α2sc and others).

**Consequence, stated plainly:** only 4 of 97 MBON neurons (2 approach, 2 avoid) are plastic. The `approach` and
`avoid` groups each resolve to ≥ 1 neuron (`E-LEARN-GROUP-EMPTY` passes), so the mechanism is not blocked, but the
conditioning probe (Phase 4) may show a weak or undetectable learned-valence shift for a reason that is about
coverage, not about whether the depression rule itself works. If Phase 4's SC-002 fails, this is the first place
to check before concluding the mechanism is wrong.

**Decision, confirmed with the user:** ship the 2-type sidecar now rather than block on further research or
fabricate unverified citations. A reviewer with primary-source access to Aso et al. 2014 Fig. 5-6 (or the Li et
al. 2020 hemibrain MBON01-35 crosswalk) can extend `mbon[]` later without touching any other contract.

## D35b. The decoder's own C1 regime check fails before Phase 3 even starts (deferred, not a blocker for D36)

`.claude/skills/microfly-calibrate`'s C1 regime check (ADR 010 Part H — a check on the decoder-candidate
population's rest activity and drive rise, distinct from Phase 3's KC-code gate below) found no passing point
for `forager-brain-mb`, over `synapticScale` ∈ {3,4,5,6,10,15,20,30,40} × `baselineCurrent` ∈ {0,0.02,0.04,0.06}
(measured 2026-10-19, profile `forager-mb.mjs`). Every drive rise stays under 0.5 Hz against the 3 Hz gate
through scale 20; at scale 30–40 some grid points instead fail on rest activity or ignition (activity does not
settle after the stimulus is released) — the up-state signature research.md §2/§3 names as the risk Phase 3's
gate and its `pathwayGain` remedy exist for.

**Why this doesn't block D36.** `scripts/mb-regime-probe.mjs` (T021) is brain-only and needs no decoder, so
Phase 3 runs regardless. T016 (the decoder, needed later for the behaviour experiments of Phase 6+) is deferred
until Phase 3 decides whether `pathwayGain` is used: if it is, the same remedy that raises the KC code's active
fraction should also raise C1's drive rises, and C1 should be re-run with it before any further manual grid
search.

## D36. The regime gate (FR-008 hard stop) — REJECTED

**Measured 2026-10-19** (`scripts/mb-regime-probe.mjs`, `forager-brain-mb.brain`, calibration seeds 6-10, the
world's own LIF block carried over from `world-forager-demo.json`: `synapticScale` 15, `inhibitoryScale` 1.5,
`noiseAmplitude` 0.2/`noiseBulkScale` 0, `tauAdapt` 100/`adaptStep` 0.1, `thresholdJitter` 0.1,
`baselineCurrent` 0.03, no `pathwayGain`):

| Measure | Odour A (fruit) | Odour B (floral) | Target |
| --- | --- | --- | --- |
| Active-KC fraction (mean) | 98.9% | 99.7% | 5-15% |
| Same-odour reliability | 0.454 | 0.492 | > 0.9 |
| A-B overlap (Pearson) | 0.470 | | < 0.7 |

**Verdict: FAIL, with an up-state signature** (active fraction far over 15% on both odours) — exactly the risk
research.md §2/§3 names: the KC population fires broadly for almost any input, not a sparse, distinct code per
odour. Continued to the one allowed remedy (D38).

**Final verdict (after D38's remedy): FAIL.** No grid point tried reaches the 5-15% active-fraction target; the
best found (D38) still sits at 55.6%/63.7%. Per FR-008, **no task in Phase 4 or later may be started.** Full
data: `specs/019-mb-valence-learning/regime-gate.json`, `regime-gate.md`.

## D37. Teaching signals: carried vs. injected — every signal injected

**Measured 2026-10-20** (`scripts/mb-teaching-probe.mjs`, `world-forager-learning.json`, calibration seeds 6-10;
400-tick warm-up, 5 blocks of 200 stimulus/200 rest ticks; `plasticity` default `threshold` 0.01, `etaReward =
etaPunish = 0` so D is read without ever depressing a synapse):

| Signal | Pool | Stimulus ticks D>0 | Rest ticks D>0 | Carried? |
| --- | --- | --- | --- | --- |
| mouth taste (hunger 1) | reward | 0.0% | 0.0% | injected |
| mouth taste (hunger 0) | reward | 0.0% | 0.0% | injected |
| heat | punish | 0.0% | 0.0% | injected |
| touch | punish | 0.0% | 0.0% | injected |
| danger odour | punish | 0.0% | 0.0% | injected |
| escape output driven | punish | 0.0% | 0.0% | injected |
| food odour A/B alone | reward, punish | 0.0% | 0.0% | injected (no spurious drive either) |

Full data: `specs/019-mb-valence-learning/teaching-signals.md`.

**Why 0% on both sides, not a probe bug.** A direct trace (threshold 0, same LIF block) shows the reward/punish
pools do fire — e.g. under maximum odour-A drive, 1,027 reward spikes and 66 punish spikes over 5,000 LIF steps —
but at a population mean rate near 0.0005-0.003 spikes/neuron/step, an order of magnitude below the 0.01
default `threshold`, and the rate rises just as often during rest ticks (pure sparse-pool noise: the punish group
is 16 neurons) as during stimulus ticks. D40/D41's calibration (`synapticScale` 5, heavy `pathwayGain`
suppression) deliberately keeps the whole network's population rates this low to pass the KC-code gate (D41); at
that scale, no `threshold` choice would separate "driven" from "noise" for these DAN pools — this is a structural
property of the regime the gate requires, not a measurement error. D41 predicted exactly this outcome ("DAN input
is weaker at synapticScale 5 ... may find that the connectome does not carry reward and punishment").

**Decision.** Every teaching signal is injected (FR-017), through the `reinforcement-reward-*` /
`reinforcement-punish-*` channels already in the `forager-brain-mb` extraction (D35) — no connectome-carried
exception. `reinforcement:reward` fires on `eat`; `reinforcement:punish` fires on `escape`, `heatContact` and
`eat:<punished scent>` (Phase 4 T028-T029, contracts/world-config-v3-learning.md). Food odour alone drives neither
pool spuriously, so no exclusion from the plasticity mechanism is needed on that account.

## D38. Pathway gain (L11) remedy — tried, insufficient

The one allowed remedy (research.md §3), a single 7-point grid starting from the user-specified routes
(`olfactory->ALPN` gain 5, `ALPN->Kenyon_Cell` gain 3, `otherExcitatoryInto: [ALPN, Kenyon_Cell]`, `otherGain`
0.3), varying `otherGain` down to 0.05 and the `ALPN->Kenyon_Cell` gain down to 2:

| KC gain | otherGain | A active | B active | A-B overlap |
| --- | --- | --- | --- | --- |
| 3 | 0.30 | 67.3% | 77.0% | 0.794 |
| 3 | 0.20 | 60.5% | 69.4% | 0.803 |
| 3 | 0.15 | 59.5% | 68.0% | 0.823 |
| 3 | 0.10 | 59.9% | 66.4% | 0.869 |
| 3 | 0.05 | 60.3% | 65.1% | 0.901 |
| 2 | 0.10 | 57.8% | 65.8% | 0.850 |
| **2** | **0.05** | **55.6%** | **63.7%** | 0.830 |

**Finding.** The remedy is real (99% -> 56-77%) but insufficient, and plateaus: `otherGain` below 0.3 buys
little further reduction while overlap gets *worse* (0.79 -> 0.90). `otherGain` only scales edges whose target
class is ALPN/Kenyon_Cell; it has no lever over `baselineCurrent` (added to every neuron every step,
independent of any edge), and the amplified primary route itself (10-15x on the real signal) recruits most KCs
alone once real input arrives. This grid cannot distinguish whether the ceiling comes from `baselineCurrent`,
from the primary-route gain itself being too strong for this brain, or from some other structural difference
from the wide brain's own (already-calibrated, un-split) odour-food pathway — that diagnosis is future work,
outside this one grid's budget (T024: "at most one grid").

**Decision: the remedy does not pass the gate.** Per T025, ADR 011's status is "Rejected — gate failed."

## D39. Network-vs-W16 readout decision — NOT REACHED

Phase 6 (T051-T052) is blocked by D36's rejection (FR-008). Not run.

## D40. Gate retry: root cause, probe fix, attenuating remedy, L11 type selectors — FAIL by a hair

**Root cause of D36/D38** (`regime-gate-retry.md` has the evidence). The probe left out `inputNeurons`, so it
measured a noise-free brain the fly never runs. Under `postFractionAbsolute` × `synapticScale` 15, one PN spike
fires 92.5% of KCs and ORN input spreads to ~90% of PNs. KC→KC edges spread the code further, and `baselineCurrent`
0.03 drives KCs at rest. D38's gains came from smallfly's raw-count weights; on normalised weights they amplified
instead of correcting.

**Changes.**
- `scripts/mb-regime-probe.mjs` builds the graph as `fly-brain-v1.js` does (`inputNeurons`, `neuronType`). It also
  takes `--lif` overrides for calibration and keeps the world's own `pathwayGain`.
- **L11 type selectors.** A route end may name a dataset `type` (`fromType`/`toType`) instead of a `class`. The
  first declared matching route wins. This reaches APL, which has no class. It is backward compatible and off unless
  used (contracts/lif-v1-plasticity.md, tests in `tests/lif-plasticity-golden.test.mjs`).

**Measured** (calibration seeds 6-10, full protocol, MB world LIF with `synapticScale` 5, `baselineCurrent` 0,
`tauSyn` 3, `pathwayGain` KC→KC 0, ALPN→KC 2.1, other excitation into ALPN/KC 0.3):

| Measure | Odour A | Odour B | Target |
| --- | --- | --- | --- |
| Active-KC fraction | 13.8% | 12.0% | 5-15% |
| Same-odour reliability | 0.896 | 0.894 | > 0.9 |
| A-B overlap | 0.144 | | < 0.7 |

The matched random graph stays silent (0% active), so the code depends on the connectome's structure.

**Finding.** Feedback from APL through the new type selector lowered reliability at every gain tried. A spiking
APL inhibits in large, randomly timed kicks instead of the graded normalisation of the non-spiking real neuron.
Across all levers, active fraction and reliability rise together and only touch the gate's corner.

**Decision: not passed against the 0.9 target**, so FR-008 still blocked Phase 4. Resolved by D41: the settings
above are now the learning world's LIF block (`world-forager-learning.json`), and the gate passes under D41's target.

## D41. Same-odour reliability target relaxed from 0.9 to 0.85 — gate PASSES

**Decision (user, 2026-10-20).** FR-006's same-odour reliability target is now **> 0.85** (was > 0.9). The other
two targets stay as they were (5-15% active, A-B overlap < 0.7).

**Stated plainly: this was decided after the measurement.** D40 missed the 0.9 target by 0.004-0.006, and every
lever tried moved active fraction and reliability together. The 0.9 value had no derivation in research.md §2; it
was set before any KC code had been measured. The reasons the lower bar still guards what learning needs:
- **Discrimination is what the plasticity rule depends on, and it has wide margin.** Same-odour correlation
  (0.89) is six times the A-B correlation (0.14). Depression on the KC→MBON edges of A's active KCs therefore
  lands mostly on edges B does not use.
- **The eligibility trace averages over trials.** Its time constant (`tauElig` 400 steps, 80 ticks) is close to
  one 100-tick trial window. The rule sees the KC code averaged over that window, not one binary snapshot, so
  trial-to-trial jitter in a few KCs is averaged out.
- **The bar still excludes the failure mode the gate exists for.** The up-state of D36 had reliability 0.45-0.49
  and D38's grid 0.84-0.93 at 56-77% active; the active-fraction and overlap targets reject those on their own.

**Measured** (`regime-gate-retry.md`/`.json`, calibration seeds 6-10, full protocol, the world's own LIF block):
active 13.8% / 12.0%, reliability 0.896 / 0.894, A-B overlap 0.144. **Verdict: PASS.** The matched random graph
stays silent (0% active).

**Consequences.**
- FR-008 is satisfied and Phase 4 (teaching-signal probe, then L12 plasticity) may start.
- **The learning world's behaviour will change.** `synapticScale` 5, `tauSyn` 3, `baselineCurrent` 0 and
  `pathwayGain` are global to this world, so its sensorimotor outputs need their own calibration (`outputScale`,
  decoder T016, C1 regime check, D35b) before any behaviour experiment. The wide brain and `world-forager-demo.json`
  are untouched.
- **DAN input is weaker at `synapticScale` 5**, so the teaching-signal probe (D37) may find that the connectome does
  not carry reward and punishment, and fall back to the declared injected channels (FR-017).
- The held-out seeds have not been used. Phase 4's verdicts run on them.

## D42. C1 (decoder regime check) at the gate-passing LIF block — FAIL, whole-network, not learning-specific

**Measured 2026-10-20** (`.claude/skills/microfly-calibrate`, profile `forager-mb`, `--stage=c1`, the single point
matching the shipped world LIF exactly — `synapticScale` 5, `baselineCurrent` 0, every other LIF key, including
`pathwayGain`, taken from `world-forager-learning.json` unchanged; seeds 1-2, 300 ticks, candidates "non-input"):

| Measure | Value | Gate |
| --- | --- | --- |
| Rest activity (network union fraction) | 0.0004 | 0.01-0.10 |
| Drive rise, odour-food-a / -b | 0.02 Hz / 0.02 Hz | ≥ 3 Hz |
| Drive rise, odour-danger / heat / touch | 0 Hz | ≥ 3 Hz |
| Drive rise, taste-mouth / taste-leg | 0.01 Hz / 0 Hz | ≥ 3 Hz |
| Drive rise, reinforcement-reward / -punish | 0 Hz / 0 Hz | ≥ 3 Hz |

**Verdict: FAIL**, on every row, by one to three orders of magnitude. The C1 grid was deliberately run at a
single point (`synapticScale`/`baselineCurrent` are no longer free parameters — D40/D41 fixed them to pass
Phase 3's KC-code gate; re-widening them would drift from the one regime the gate actually validated, per the
user's explicit decision this session).

**This is not a learning-specific finding — it is the same whole-network sparsity D37 already measured for the
DAN pools, now confirmed for every other candidate population C1 checks** (the non-input/descending pool C2
would pick decoder neurons from). The regime gate's own remedy (`pathwayGain`: `Kenyon_Cell→Kenyon_Cell` gain 0,
heavy suppression elsewhere) was tuned only against the KC active-fraction target; nothing in Phase 3 checked
whether the resulting network still carries enough signal for a *decoder* to read motor drive from. It
apparently does not, at this exact point.

**Consequence, stated plainly.** Without a C1 pass, C2 cannot select decoder pools, so no `forager-brain-mb.
decoder.json` exists. `scripts/mb-conditioning-probe.mjs` (T044, brain-only, reads MBON rates directly) is
unaffected. But Phase 6/7's behaviour experiments (`scripts/learning-arms.mjs`, the primary demo claim — stay/eat
change under punishment) need a working `v3` decoder + body layer to move a fly at all, and T042's network-path
probe (T051, "measure the change in decoded feed/forward drive") needs the same decode to exist. Both are
blocked by this finding, not by anything in the learning mechanism itself.

**Not decided here:** whether to widen C1's own gates (not the LIF search) for this specific brain, accept a
decoder built on a weaker signal with the risk that names, or treat this as a second gate requiring its own
"record and stop." Awaiting user direction before trying any remedy.

**Update, same day.** User decided to relax C1/C2's gates to this brain's measured noise floor (D43 below). That
unblocked C1 and most of C2, but exposed a deeper, separate problem (D43's last paragraph): the two plastic MBON
neurons never fire at all under this calibration, independent of C1/C2.

## D43. C1/C2 gates relaxed to the measured noise floor; a deeper problem found underneath

**Decision (user, 2026-10-20).** Rather than re-opening the LIF search D42 already closed, `forager-mb.mjs`'s C1
gates were set to the measured point itself (`restMin` 0.0001, `restMax` 0.001, `driveRiseHz` 0.00005) and C2's
`sideMinRiseHz`/`driveRiseHz` lowered the same way; C2's scale-free checks (`sideThreshold`, `driveSelectivityRatio`,
`reproductionFraction` on the held-back seed) were left unchanged, so a pool still has to show genuine,
reproducible selectivity to be written, not just exceed a tiny absolute number.

**C1 now passes** at the single gate-passing point (rest 0.0004, every rise above the relaxed floor).

**C2, first attempt (3-seed/400-tick, demo-v3's own sample size), failed reproduction on 4 pools**:
`side.odour-food-a.R`, `side.odour-food-b.R`, `side.taste-leg.R`, `drive.reinforcement-punish`. Widening to 5
seeds / 3,000 ticks (the same "more data, not a laxer standard" move that fixed C1's precision) was in progress
when a separate, more serious problem surfaced (next paragraph) and took priority; its result is not yet known.

**A deeper, separate problem: the plastic MBON neurons never fire.** Measured directly (not through C1/C2):
under maximal, continuous odour-A drive for 50,000 LIF steps (10,000 ticks) at the shipped LIF block, the KC
population fires 114,701 times — but `groups.approach` (MBON11, 1 neuron) and `groups.avoid` (MBON01, 1 neuron)
fire **zero** times, combined, over the entire window. This is not a sampling problem (more ticks will not
surface a spike that structurally never comes) and not a C1/C2 pool-selection problem (`mb-conditioning-probe.mjs`,
which reads these two neurons directly with no decoder/C1/C2 in the path, found the same thing: every `bal`
value across every arm/seed/stage of a smoke test was exactly 0/0). If the KC→MBON edges into these two specific
neurons do not deliver enough current to cross threshold at this suppression level, L12's whole mechanism has
nothing to act on or read from for Phase 4's conditioning probe, **independent of whether a decoder.json ever
gets built.**

**Follow-up measurement: it is the whole MBON layer, not these two neurons specifically.** Over the same
50,000-step window, only 12 of 97 MBONs fire at all (14 spikes total, population-wide), and APL (the KC→KC
feedback inhibitor, 2 neurons) never fires either — while KCs fire 114,701 times. MBON01/MBON11 (the only two
with an assigned role, D35a) happen not to be among the 12. This rules out "wrong two neurons picked" and points
at the regime-gate's own suppression (`pathwayGain`: `Kenyon_Cell→Kenyon_Cell` gain 0, `otherGain` 0.3 on
ALPN/KC) reaching far enough downstream to silence the MB's entire output layer, not just the DAN pools D37
already found silent. That remedy was tuned only against KC population code statistics (active fraction,
reliability, A-B overlap) and never checked against anything downstream.

**Not decided here:** any remedy that touches synaptic gain again needs re-checking against Phase 3's own gate,
not assumed clear. Awaiting user direction.

**Resolved by D44 below.**

## D44. A narrow `Kenyon_Cell→MBON` pathwayGain route fixes MBON silence without disturbing Phase 3's gate

**Decision (user, 2026-10-20): try one narrow, named remedy on the KC→MBON pathway, re-checked against the
regime gate.** `pathwayGain` gained one route: `{ "from": "Kenyon_Cell", "to": "MBON", "gain": 40 }`, added to
both `world-forager-learning.json` and `world-forager-learning-tilemap.json`; every other route and parameter is
unchanged. `otherExcitatoryInto`/`otherGain` still cover only `ALPN`/`Kenyon_Cell`, so APL's input is untouched —
deliberately: a first attempt that also gained `Kenyon_Cell→APL` (type selector) broke the regime gate
(reliability 0.83/0.77, below D41's 0.85 floor), reproducing D40's own documented finding that APL feedback is
the sensitive point. `Kenyon_Cell→MBON` has no path back into KC activity in this network (MBON has no outgoing
edges the KC population's code could depend on), so it was expected, and confirmed, not to touch Phase 3's gate
at all.

**Measured, direct (no decoder/C1/C2 in the path):** under maximal odour-A drive for 10,000 LIF steps, gain 40
gives MBON11 (approach) 195 spikes and MBON01 (avoid) 49 spikes (both zero before D44). A gain sweep (1/5/10/
20/40/80/150) showed both rise monotonically and smoothly with gain; 40 was chosen as comfortably above the
noise floor found at low gains without approaching saturation (both groups still fire well under 50% of steps).

**Regime gate re-verified against the shipped world file** (`scripts/mb-regime-probe.mjs`, calibration seeds,
unchanged protocol): active fraction 13.7%/12.0%, reliability 0.893/0.897, A-B overlap 0.143 — matching D40/D41's
own numbers (13.8%/12.0%, 0.896/0.894, 0.144) to within measurement noise. **The gate still passes.**

**Teaching-signal probe (D37) re-run, unaffected as expected** (`teaching-signals-retry.md`): every DAN pool
reading stays exactly 0.0%/0.0% — `Kenyon_Cell→MBON` does not touch the PAM/PPL1 pathway, so D37's "every signal
injected" finding is unchanged.

**Conditioning probe smoke test (frozen arm, the no-learning control), five calibration seeds:** `bal` now sits
at meaningful, stable values (≈0.35-0.40 for odour A, ≈0.20-0.27 for B, both approach-leaning, consistent with
MBON11 firing roughly 4x MBON01's rate) with `balPost`/`balDecay` tracking `balNaive` within noise — exactly
what a no-plasticity control should show. The mechanism now has real signal to read and act on.

## D45. The plastic arm shows textbook conditioning; the shuffled control was broken, found and fixed

**Full 4-arm run, calibration seeds, `scripts/mb-conditioning-probe.mjs` (D44's LIF block).** The **plastic**
arm shows a large, consistent, correctly-signed effect in every one of 5 seeds: reward gives `shiftPostA` ≈
+0.34 to +0.42 (more approach-biased) against `shiftPostB` ≈ 0.00 to +0.08 (unpaired, much smaller); punish
gives `shiftPostA` ≈ −0.41 to −0.50 against `shiftPostB` ≈ −0.08 to −0.12. `shiftDecayA` after `tauForget` falls
to roughly a fifth of `shiftPostA` in both directions — the shift decays toward naive without further pairing,
as Story 2 scenario 5 requires. The **frozen** arm (no plasticity, the control) shows no systematic shift at all
(≤ ±0.03, noise). The **random** arm (matched random graph) shows exactly zero MBON activity under this LIF
block — consistent with the regime gate's own prior finding that the random graph stays silent at this
calibration (`regime-gate-retry.md`), so it has nothing to show a shift in; reported, not hidden, per
research.md §8.

**The shuffled arm initially failed to act as a control** — it showed the *same* large effect as plastic in
every seed, which would fail SC-002 (shuffled must show the effect in ≤ 20% of seeds). Root cause, found by
direct measurement: `scripts/mb-conditioning-probe.mjs`'s first pairing protocol rested only 100 ticks (500
steps) between each of the 6 A-pairings. L12's shuffled mode (contracts/lif-v1-plasticity.md) reads the dopamine
ring at a lag drawn from [1000, 4000] steps (200-800 ticks) — but with pairings recurring every ~200 ticks and
a KC eligibility trace (`tauElig` 400 steps = 80 ticks) that never fully decays between them, *every* reachable
lag still lands inside the same "A was just presented" episode. The shuffle could reorder *when within the
episode* the teaching pulse is read, but never escape into genuinely odour-A-free history — jittering the rest
period (tried first) did not change this, since the whole 6-pairing episode was still shorter than the lag could
reach past. **Fix:** rest 1,000+ ticks (5,000+ steps, jittered) between pairings — safely past the 800-tick
maximum lag and long enough for `tauElig` to fully decay between pairings too, making each pairing independent.

This is a probe-protocol bug, not an L12 implementation bug — `tests/lif-plasticity-golden.test.mjs`'s own G7
determinism test for shuffled mode is unaffected (it does not test decorrelation, only that two runs with the
same seed agree).

## D46. SC-002 verdict on held-out seeds: PASS

**`scripts/mb-conditioning-probe.mjs --seeds=held-out --arms=plastic,frozen,shuffled`** (30 held-out seeds, the
D45-fixed pairing protocol, D44's LIF block). Full data: `specs/019-mb-valence-learning/conditioning.json`;
full writeup: `specs/019-mb-valence-learning/results.md`.

| Arm | Pass rate (sign + > noise floor + paired > unpaired) | Target | Verdict |
| --- | --- | --- | --- |
| plastic | 60/60 (100%) | ≥ 80% | PASS |
| frozen | 2/60 (3.3%) | ≤ 20% | PASS |
| shuffled | 9/60 (15.0%) | ≤ 20% | PASS |

Plastic's paired-odour shift (reward +0.334 ± 0.029, punish −0.305 ± 0.033, mean ± SD over 30 seeds) is 10-30×
its own SD and 4-11× the unpaired odour's shift; frozen and shuffled both sit within about one SD of zero.
**SC-002 passes.** Story 2 scenario 5 (decay without further pairing) holds: the shift loses 83-89% of its
magnitude by the post-`tauForget` decay test. Story 2 scenario 6 (no drift while nothing is paired) holds: the
frozen arm shows no systematic shift at all.

The pass-rate criterion uses a noise-floor magnitude threshold (0.05, ~2× the frozen arm's own largest observed
shift this run) alongside SC-002's literal sign-and-ranking text — a bare sign/ranking check lets pure noise
pass 50-70% of the time on this run's data, since near-zero numbers still have *some* sign and *some* ranking.
User-approved 2026-10-20; full reasoning in `results.md`.

**What this result does and does not show.** It is a brain-only measurement of the MBON approach/avoid balance,
with no decoder, no body layer, no world simulation. It demonstrates the L12 mechanism works as designed, on
the real connectome, once the connectome actually has signal to read (D44) and the control arm is actually
decorrelated (D45). As of D47, the decoder now exists, unblocking Phase 6.

## D47. The C2 decoder: root cause of the 4 reproducibility failures, and a fix

**Root cause, found 2026-10-21 by direct measurement** (not fixed by more ticks: 3,000 → 8,000, same result).
At this brain's activity level, the candidates C2's selection algorithm finds for `side.odour-food-a.R`,
`side.odour-food-b.R` and `side.taste-leg.{L,R}` are mostly single-spike-level events over the whole probe
window — e.g. a candidate's calibration-seed mean was 1 spike total across 15,000 steps, with the L side's
total spike count rock-steady across seeds (~1000-1023) while the R side varied 1.5-1.8× seed to seed
(6,424-11,747). At counts that small, whether a given neuron fires 0 or 1 times in a specific held-back seed is
dominated by shot noise, not tuning — more ticks scales the mean up proportionally but leaves the same relative
noise, which is exactly why widening ticks changed nothing.

**Fix: `noSidePairs`, a declared opt-out, not a loosened gate.** `decoder-engine.mjs`'s `runC2` gained a
`gates.noSidePairs` list; a pair named there skips side-pool *selection* entirely, landing in exactly the state
Part L's existing fallback already produces when too few candidates clear the bar ("too few a side -> no side
pool, klinotaxis alone") — this just names a different, measured reason for the same outcome. The general
`E-DECODE-<pool>` abort-on-reproduction-failure behaviour is **unchanged** for every other pool and every other
profile (`tests/decoder-engine.test.mjs`'s existing test for that path still passes unmodified; a new test
covers the opt-out itself). `forager-mb.mjs`'s `c2.gates.noSidePairs` is set to `['odour-food-a', 'odour-food-b',
'taste-leg']` — these three pairs decode via `drive` (weight/trend/klinotaxis) alone; every other pair
(`odour-danger`, `heat`, `taste-mouth`, `touch`) keeps its side pool.

**Also found and fixed along the way:** `scripts/forager-arms.mjs`'s `runV3Cohort` and `decoder-engine.mjs`'s
`runC3`/`calibrate.mjs`'s own `--stage=c3` `ctxFor` all built a v3 `brainConfig` from the raw world config
directly, leaving `flies.brain.learning` as the unparsed path string — the same class of bug T016/T043 already
hit and fixed for `calibrate.mjs`'s `c1`/`c2` stages, just in three more call sites that build a brain config
from raw world config. Fixed the same way: resolve-and-parse once in the context builder, substitute the
parsed object for the path string before it reaches `createFlyBrain`. `runForagerArms` gained a `learning`
parameter for this (mirrors the existing `decoders` parameter's per-arm-object pattern).

**Decoder built**: `public/brains/forager-brain-mb.decoder.json` — pools: `drive.odour-food-a`,
`drive.odour-food-b`, `drive.odour-danger`, `side.heat.{L,R}`, `drive.heat`, `side.taste-mouth.{L,R}`,
`drive.taste-mouth`, `drive.taste-leg`, `drive.touch`, `drive.reinforcement-punish`, `feed`, `forward`,
`backward`, `alarm`. `learning.naive` added (`scripts/mb-decoder-add-naive.mjs`, T043): `odour-food-a` 0.373,
`odour-food-b` 0.225 (calibration seeds), consistent with the conditioning probe's own naive-test measurement.

**Verified end to end**: the exact browser-facing fetch chain (`loadSnapshot` → `loadDecoderFile` →
`loadLearningFile` → `resolveLearningGroups`) run against a live local server with no exceptions; the full
sense→brain→decode→body-layer pipeline (`runC3`, `stepForagerFlyV3`) run on `world-forager-learning.json` for
3 seeds × 1,500 ticks with no exceptions, a fly walking (87.8%) and eating. `npm test`: 785 pass / 22 pre-existing
unrelated fails, unchanged.

**Not yet done**: `world-forager-learning-tilemap.json` shares this same brain/decoder/learning (T015), so it
should load too, but hasn't been separately smoke-tested. The C3 numbers above are a 3-seed/1,500-tick smoke
run, not a calibrated behaviour verdict — Phase 6's own `learning-arms.mjs` run (T059) is the real measurement.

## D48. Escape never triggers: `escape.tau`/`escape.threshold` inherited unchanged from the wide brain's dense regime

**User-reported, 2026-10-21**: flies drift to the world edge (the `forestEdge` danger zone) and stay there
motionless, with a strong touch signal and no reaction to danger odour at all, while the brain activity view
showed far fewer active neurons than the wide brain's own demo.

**Root cause, measured directly** (`stepBodyLayer`, the real production code, not a re-derivation): under
sustained maximum danger-odour drive, the decoded `alarm` pool's raw `drive` does peak at 0.23 — but
`escape.tau` (20 ticks, copied unchanged from `world-forager-demo.json`) EMA-smooths it before the threshold
check, and over 2,000 ticks of continuous maximal exposure the smoothed value never exceeds 0.063, against a
0.22 threshold. **Escape is structurally unreachable under the shipped settings, regardless of how much danger
the fly is in.** `tau` =20 made sense for the wide brain's dense, sustained firing; this brain's alarm signal is
sparse, brief spikes, which a 20-tick average washes out to near-nothing — the same category of problem as D42's
whole-network sparsity, now showing up in the escape reflex specifically, not the LIF core.

**Fix**: `flies.body.escape.tau` 20→3, `threshold` 0.22→0.05 in both `world-forager-learning.json` and
`world-forager-learning-tilemap.json` — measured, not guessed: rest alarm is exactly 0 (no false-positive
risk), danger's peak (0.23) and heat's peak (0.12) both clear 0.05 comfortably once `tau` is short enough not to
average them away. Verified via `stepBodyLayer` directly: escape triggers on the first tick of sustained danger
exposure (previously: never, over 2,000 ticks). Re-ran the C3 smoke (3 seeds, 1,500 ticks,
`world-forager-learning.json`): time in the danger/heat rings fell from 48.9%/6.3% to 15.5%/7.7% (baseline,
unaffected by any brain change, stayed at 57.0%/12.9%); find rate rose 61.1%→77.8%. `npm test`: 785/22 unchanged.

**Not addressed here**: `touch` has no `side` pool (too few reproducible candidates, Part L's existing
fallback — not `noSidePairs`, which doesn't name `touch`), so wall-avoidance relies on `touch`'s trend/klinotaxis
alone, not direct tropotaxis. This may still leave some residual "presses against a wall briefly before
escape/wander turns it away" behaviour; not measured separately from the escape fix above. If stuck-at-a-wall
(away from any declared danger zone) recurs after this fix, that is the next thing to check.
**Not yet re-tuned**: `backup.threshold` (0.5) and `food.feedThreshold` (0.12) were not checked against this
decoder's measured drive scale the way `escape` was — they may have the same inherited-threshold problem,
unconfirmed.

## D49. `touch`'s valence set to `none`: a confirmed artifact fixed, a separate stuck-at-wall case left open

**User-reported, 2026-10-21**: touch causes the fly to pause/slow down.

**Confirmed and fixed**: touch's decoded `drive` sits at the noise floor (essentially never above rest at this
brain's activity level), which makes D29's `trend` metric — `(drive−slow)/(slow+ε)` — swing to a near-extreme
value (−0.9954, measured directly) from pure numerical instability, not a real signal. With `valence: 'avoid'`,
that artifact got a large, spurious weight in `sumByValence`'s `signedTrend`, which clamps `cast` toward its
floor (less wander) and distorts the surge term — genuine steering noise from nothing. Set `touch`'s valence to
`'none'` in `forager-brain-mb.decoder.json` (and the `forager-mb` profile, for future regeneration) — the same
treatment `taste-mouth` already has: sensed, decoded, contributes zero steering weight. Constitution-clean (the
sense is still read and decoded; only its behavioural weight changes, declared in data).

**Tested further, and found NOT sufficient for the literal stuck-at-a-wall case.** A direct test — a fly placed
flush against a wall, touch driven exactly as real wall contact would drive it, 1,000 ticks, 3 seeds — showed
**no difference between `valence: 'avoid'` and `valence: 'none'`: the fly stays pinned at the wall either way.**
Root cause: `touch` has no `side` pool at all (too few reproducible candidates — Part L's existing "too few
members" fallback, not `noSidePairs`, which doesn't name `touch`), so there is no directed turn-away signal;
only weak, symmetric random wander, whose per-tick heading change is small enough that escaping a wall by pure
chance can take arbitrarily long regardless of valence.

**Decision (user, 2026-10-21): ship the valence fix alone; do not add a new escape-trigger or wander-amplitude
mechanism for touch specifically.** Real map edges carry `forestEdge` danger odour, which D48 now makes reliably
trigger escape — the literal stuck-at-a-wall scenario this test reproduces (touch with *no* co-occurring danger
odour) may not occur much in practice. Revisit if a fly gets stuck at a wall with no escape-triggering danger
nearby after this session's fixes.

**Superseded by D50**: the user reported the freeze persisted after reload, so the deeper fix was done anyway.

## D50. Touch's real pathway found and boosted: `mechanosensory_tactile -> AN03A008`, one hop, `side.touch` now exists

**User confirmed the freeze persisted** after D49 (expected — D49's own wall-test had already shown `valence`
alone makes no difference; the user asked to pursue the deeper fix).

**First attempt failed informatively.** Traced touch's downstream connectivity by BFS: output is reachable in
just 2 excitatory hops (not a long diffuse chain as initially feared), and the first hop is not weak at all —
725-fold more boosting of the top-10-by-edge-count first-hop types produced zero change in output-neuron firing.
That was the wrong target: those types don't connect to outputs at all. The CORRECT finding, from checking each
first-hop target's own direct edges: `mechanosensory_tactile` neurons connect **directly** (one hop) to
`turnLeft`/`turnRight`/`backward` output neurons through a handful of named ascending/descending-neuron types,
and one of them — `AN03A008` — carries the dominant weight (0.032, roughly 10-60x every other route found, into
both `turnLeft` and `turnRight`). (`turnLeft`/`turnRight` output-channel spikes themselves turned out to be a
red herring to optimize for — `grep` confirmed `decoder.js`/`body-layer.js` never read them; what matters is
that `AN03A008` sits in C2's broad "non-input candidate" pool, so boosting signal into it can make *it* (or
whatever a rebuilt C2 picks) show reliable, reproducible touch selectivity.)

**Fix**: `pathwayGain` gained one more route — `{ "from": "mechanosensory_tactile", "toType": "AN03A008", "gain":
50 }` — in both world files. Re-verified against Phase 3's regime gate first (same discipline as D44): numbers
match D40/41/44 exactly (13.7%/12.0% active, 0.89/0.90 reliability, 0.143 overlap) — a separate sensory modality
from olfactory, confirmed non-interacting.

**C1/C2 rebuilt with the new route.** C1 still passes. C2 now builds `side.touch.L` (12 members) and
`side.touch.R` (14 members) — these did not exist before. `touch`'s valence restored to `'avoid'` (real signal
now exists to act on; D49's `'none'` stopgap no longer applies). `learning.naive` reattached
(`mb-decoder-add-naive.mjs`).

**Verified, the real wall-stuck scenario, through the actual production pipeline**: same test as D49 (fly flush
against a wall, no danger odour present), 5 seeds. **All 5 now escape** (570-841 ticks) — versus 0/5 with either
touch valence setting, and 0/5-1/3 even at 8x wander amplitude, before this fix. C3 smoke (3 seeds, 1,500 ticks):
find rate 83.3% (up from 77.8%), walked 95.0% (up from 92.7%), danger/heat avoidance stable at 11.3%/10.9%.
`npm test`: 785/22 unchanged.

**Open**: escape still takes 570-841 ticks to resolve a dead-on wall encounter with zero other signal present —
slower than D48's danger-triggered sprint (immediate). Not addressed further this session; acceptable for now
since real stuck-at-a-wall-with-no-danger-nearby is the narrow case this test isolates, not the common one.

## D51. `flies.food.consumption`: a world-config toggle for unlimited resources, off by default

**User-requested, 2026-10-21**: a world-config toggle to disable resource consumption (unlimited food), off by
default, to simplify reviewing learning behaviour without flower depletion as a confound.

**Decision**: a new optional key, `flies.food.consumption` (boolean, default `false`). `food.js`'s `consume()`
becomes a no-op when it is not explicitly `true` — a flower (continuous-stock or capacity model alike) simply
never drains, so every flower reads as permanently full. Regrowth/recovery code paths need no change, since
they only ever raise stock and are harmless no-ops when stock never drops.

**Regression risk, handled explicitly**: defaulting a brand-new toggle to "off" changes behaviour for every
world that does not mention it — including every existing shipped world, which has always behaved as if
consumption were on. Added `"consumption": true` to every shipped world with a `flies.food` block except the
two learning worlds (`world-forager-demo.json`, `-11k.json`, `-food-feeding-demo.json`, `world-forager.json`,
`-wide.json`, `-wide-bad.json`) and to every test's inline food config that exercises depletion directly
(bypassing `resolveFlies`, so it gets no default at all) — `food-energy`, `food-capacity`, `food-field-live`,
`forager-behaviour`, `forager-step{,-v3,-wide}`, `forager-arms-v3`, `escape-integration`, `taste-timing`,
`fly-host-wide`, `body-layer` test files. `world-forager-learning.json`/`-tilemap.json` declare nothing, so they
get the new default (unlimited) as the user asked.

**Verified**: `npm test` back to the exact pre-existing baseline (789 pass / 22 pre-existing unrelated fails,
4 new tests added and green); `public/tests/*.test.js` unchanged (90/94, same 4 pre-existing ENOENT failures);
full pipeline smoke run on `world-forager-learning.json` unaffected (eating still works — it is gated on
decoded hunger/feed signals, never on stock availability).

## D52. Plasticity was never actually turned on, and the panel never shows it (T055/T062-64, done here)

**User asked, 2026-10-21, "how do I know if the fly has learned anything?"** — the honest answer at that point
was "it can't, yet": `flies.brain.lif.plasticity` was absent in both shipped learning worlds. Every other D-entry
this session (D37, D42-D47) verified the *mechanism* works, in isolated probes or via the decoder/body-layer
pipeline driven directly — none of it had been wired into the actual world a browser session loads. Phase 6's
own T055/T056 (which would have done this) was never reached this session.

**Fix**: `lif.plasticity: {}` (the exact defaults D46's SC-002 verification used) added to both
`world-forager-learning.json` and `world-forager-learning-tilemap.json`; `flies.food.outcome` added too
(`floral`/`fruit` respectively — documentation-only, but completes what T055/56 specified). This surfaced a
real, separate bug: `validate.js`'s generic LIF-key check had an exemption for `pathwayGain` (object or null)
but never one for `plasticity` (also object or null) — no shipped world had ever set it, so the gap was
invisible until now. Fixed; 3 new tests in `tests/world-learning.test.mjs`.

**Phase 8 (T062-64, the panel) built in the same turn**, since seeing it needs both pieces. New `learning`
section (`public/js/ui/panel/sections/learning.js`): dopamine drive and mean synapse weight per MBON group,
per-food-pair learned gain next to its declared valence, "learning off" when `motor.learning` is `null`
(absent, not zero), and an "injected" tag per world-event-driven reinforcement channel. Reuses `decoder.js`'s
already-computed `learnedGain` (T042) and `fly-host.js`'s already-tracked `r.learning` (T041) and
`injectedSenses` (T029, reshaped from bare strings to `{sense, events}` to show what drives each one) — no new
brain-side plumbing. 6 tests in `tests/panel-learning-section.test.mjs`.

**Not verified in-browser** (no automation tooling in this environment, established earlier) — verified instead
via the section's own unit tests and a full `stepForagerFlyV3`/`decodeTick` pipeline run with no exceptions.
`npm test`: 798 pass / 22 pre-existing unrelated fails, 9 new tests (3 + 6) added and green.

## Rationale

See research.md §1-§10 for the decision-by-decision rationale and rejected alternatives. This ADR records only
the results as they are measured; the reasoning lives in research.md so it isn't duplicated.

## What would need to change to retry this gate

_Superseded by D40 and D41; the gate now passes. Still open, if the KC code turns out too noisy for learning:
a graded (non-spiking) APL, which would be a new LIF mechanism, off by default, under its own decision._

_Original text (D38):_

Not prescribing a fix (that is a future change's job), but naming the levers this grid ruled out or left
untested, for whoever picks this up next:
- **Untested:** reducing the primary route gains themselves (below the user's specified 5/3 starting point),
  or reducing `baselineCurrent`/`synapticScale` together with `pathwayGain` rather than holding them at the
  wide brain's own calibrated values. Both are outside "at most one grid" from the *specified* starting point,
  so neither was tried here.
- **Ruled out by this grid:** suppressing non-primary-pathway excitation into ALPN/Kenyon_Cell alone, at any
  strength from 0.3 down to 0.05, and lowering the ALPN->Kenyon_Cell gain from 3 to 2 alongside it.

## Links

- `specs/019-mb-valence-learning/regime-gate.md`, `regime-gate.json` (D36)
- `specs/019-mb-valence-learning/regime-gate-retry.md`, `regime-gate-retry.json` (D40)
- `specs/019-mb-valence-learning/teaching-signals.md`, `teaching-signals-retry.md` (D37)
- `specs/019-mb-valence-learning/conditioning.json` (D45/D46, Phase 4 verification)
- `specs/019-mb-valence-learning/results.md` (D46; Phase 6-7 behaviour experiments to be appended here)
- `specs/019-mb-valence-learning/baseline-part-k.txt` (T017/T049, Phase 5 regression baseline)
