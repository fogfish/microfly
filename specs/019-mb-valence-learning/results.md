# Results: Mushroom-Body Valence Learning

Phase 4 (User Story 2) conditioning-probe verdict, SC-002. Brain-only (`scripts/mb-conditioning-probe.mjs`), held-out
seeds (30), `world-forager-learning.json`'s shipped LIF block (ADR 011 D44: `pathwayGain` adds
`Kenyon_Cell→MBON` gain 40, the fix for the MBON/APL silence found this session; otherwise D40/D41's gate-passing
settings). Full data: `conditioning.json`.

## SC-002 verdict: PASS

**Pass criterion.** A seed passes when the paired odour's (A) learned-valence shift has the predicted sign,
exceeds a noise floor, and exceeds the unpaired odour's (B) shift in the same direction:
`sign·shiftA > 0.05` and `sign·shiftA > sign·shiftB`, `sign = +1` for reward, `−1` for punish.

**Why the noise floor.** SC-002's text ("predicted sign, larger than the unpaired odour's") does not state a
magnitude threshold. Applied literally, a bare sign-and-ranking check passes on pure noise roughly half the
time (a coin flip), because two near-zero numbers still have *some* sign and *some* ranking. The floor (0.05,
roughly 2× the frozen arm's own largest observed |shift| this run) distinguishes a real shift from a noise
wobble — the same "N above a measured reference" pattern `scripts/mb-regime-probe.mjs`'s active-KC criterion
already uses. User-approved 2026-10-20.

| Arm | Pass rate | Target | Verdict |
| --- | --- | --- | --- |
| plastic | 60/60 (100%) | ≥ 80% | PASS |
| frozen (`plasticity: null`) | 2/60 (3.3%) | ≤ 20% | PASS |
| shuffled (`dopamine: "shuffled"`) | 9/60 (15.0%) | ≤ 20% | PASS |

**Shift magnitudes (mean ± SD over 30 held-out seeds):**

| Arm | Reward: shift A | Reward: shift B | Punish: shift A | Punish: shift B |
| --- | --- | --- | --- | --- |
| plastic | +0.334 ± 0.029 | +0.030 ± 0.023 | −0.305 ± 0.033 | −0.077 ± 0.027 |
| frozen | −0.001 ± 0.027 | +0.001 ± 0.021 | −0.001 ± 0.027 | +0.001 ± 0.021 |
| shuffled | +0.015 ± 0.026 | +0.003 ± 0.022 | −0.026 ± 0.034 | −0.006 ± 0.024 |

Plastic's paired shift (A) is 10-30× its own SD and 4-11× the unpaired shift (B); frozen and shuffled both sit
within about one SD of zero. B shows a smaller shift in the same direction as A for punish (some generalisation
between the two food odours is expected — they share downstream MB machinery — but it stays well below A's).

## Story 2 scenario 5 (decay without further pairing): confirmed

After a `tauForget`-length rest with no further pairing, the shift decays toward naive: mean |decay/post| ratio
is 0.111 (reward) and 0.169 (punish) over 30 held-out seeds — the shift has lost 83-89% of its magnitude by the
decay test, without reversing sign or growing.

## Story 2 scenario 6 (no drift while nothing is paired): confirmed

The frozen arm (no plasticity at all) shows no systematic shift in either odour (|shift| ≤ 0.001 mean, within
one SD of zero) across 30 held-out seeds.

## A probe bug found and fixed along the way: the first shuffled control didn't control for anything

The first version of the pairing protocol rested only 100 ticks between the 6 A-pairings. L12's shuffled mode
reads the dopamine ring at a lag of 200-800 ticks — shorter than the gap between pairings, so *any* lag the
shuffle could draw still landed inside the same "A was just presented" episode (the KC eligibility trace never
fully decayed between pairings at that spacing). The shuffled arm showed the *same* large effect as plastic in
every seed (would have failed SC-002 outright). Fixed by resting 1,000+ ticks between pairings — past the
800-tick maximum lag and long enough for the eligibility trace to fully clear. See ADR 011 D45 for the full
diagnosis.

## Known gaps, not resolved by this result

- **Resolved 2026-10-21 (ADR 011 D47): the C2 decoder now exists.** `forager-brain-mb.decoder.json` was built
  after root-causing the 4 side-pool reproduction failures (shot-noise-level candidate spike counts, not a bug)
  and adding a declared `noSidePairs` opt-out for `odour-food-a`, `odour-food-b` and `taste-leg` — those three
  decode via `drive` alone; every other pair keeps its side pool. This unblocks Phase 6/7's in-world behaviour
  experiments (`learning-arms.mjs`) and T051's network-path probe, neither of which this conditioning result
  needed (it reads MBON rates directly, no decoder in the path).
- **Random arm:** the matched random graph shows zero MBON activity under this LIF block (confirmed by direct
  measurement, consistent with the regime gate's own prior finding that the random graph stays silent at this
  calibration). Not re-run on all 30 held-out seeds — the structural cause is seed-independent and already
  established on calibration seeds plus a direct check; reported here rather than hidden, per research.md §8,
  not presented as a held-out-seed measurement.
