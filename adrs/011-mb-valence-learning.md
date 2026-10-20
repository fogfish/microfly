# ADR 011: Mushroom-body valence learning

- **Status:** Proposed — regime gate passed on retry (D40, D41), 2026-10-20. Phase 4 onward is unblocked and not
  yet implemented. History: the first gate run failed (D36) and so did its remedy (D38). The retry fixed the probe,
  attenuated the olfactory path and set the learning world's own LIF regime (D40). It then missed only the
  reliability target, by 0.004-0.006, and D41 relaxed that target from 0.9 to 0.85.
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

## D37. Teaching signals: carried vs. injected — NOT REACHED

Phase 4 (T026-T027) is blocked by D36's rejection (FR-008). Not run.

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
- `specs/019-mb-valence-learning/teaching-signals.md` (D37)
- `specs/019-mb-valence-learning/conditioning.json` (Phase 4 verification)
- `specs/019-mb-valence-learning/results.md`, `results.json` (Phase 6-7 behaviour experiments)
