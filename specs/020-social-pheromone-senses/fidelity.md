# Fidelity: Social and Pheromone Senses

Phase 4 (US2), T020. From `forager-brain-social.brain`'s own header `fidelity` block and the connectivity audit
(`fidelity-audit.txt`, T019): `scripts/connectivity-audit.py --sections coverage,paths,bridges,readout` on the
shipped config/snapshot, and once more with `ORN_VL2a` added to a temporary copy (R2 variant, not shipped).

## Conspecific and contact L/R turn contrast: brain vs. whole graph

| Pair | Brain contrast | Whole-graph contrast | Fraction | Gate (≥0.1) |
|---|---|---|---|---|
| `odour-conspecific` | +8.80e-07 | +1.06e-06 | **83%** | pass |
| `contact-pheromone` | +4.41e-05 | +5.38e-05 | **82%** | pass |
| `odour-conspecific` + VL2a (R2 variant, not shipped) | +8.93e-07 | +1.07e-06 | **83%** | pass |

**R2 verdict:** adding `ORN_VL2a` to `odour-conspecific` makes no material difference (83% either way). The
measurement does not call for it, so it stays out of the shipped config (research R2 stands).

Both social pairs keep their turn contrast at essentially the same fidelity as the best-carried pre-existing
senses (food-a 98%, heat 93%) and well clear of the 0.1 `minFraction` gate — the opposite of the risk the plan
flagged (Risks: "No side pool for either social pair... likely"). The social pathway, seeded by type identity
rather than by weight-ranked fill (research R4), turns out to carry its own steering signal unusually cleanly.

## Every pre-existing check, MB brain vs. social brain

| Check | MB brain value | Social brain value | Change |
|---|---|---|---|
| `odour-food-a` contrast | 96% | 98% | +2 pp |
| `odour-food-b` contrast | 91% | 91% | 0 |
| `heat` contrast | 92% | 93% | +1 pp |
| `touch` contrast | 80% | 81% | +1 pp |
| `taste-mouth → feed` sign | +1.68e-05 (pass) | +1.73e-05 (pass) | holds |
| `taste-mouth → forward` sign | -3.38e-07 (pass) | -3.02e-07 (pass) | holds |
| `taste-leg → backward` sign | +8.04e-06 (pass) | +7.99e-06 (pass) | holds |

Every pre-existing check still passes, each within a point or two of the MB brain's own value. The small
upward drift (food-a, heat, touch) is the expected side-effect of R5's "same fill size, larger seed set" rule:
fill now competes for weight-shared slots against a bigger seed pool, the effect the risk section predicted,
and it did not cost any existing check its pass.

## `song` pool input coverage

From the audit's **coverage** section: `song` (pIP10) receives **100.0%** of the whole admitted graph's
presynaptic input to pIP10 — nothing is lost (pIP10 has only 2 bodies, both admitted and both now output
members, so the cut's induced subgraph keeps every real inflow edge by construction).

## Top missing bridges per social pair (audit **bridges** section)

**`odour-conspecific`** (93.1% of |contrast flow| kept on cut neurons): the small missing remainder is
diffuse — `LH007m`/R (+0.5%), a scatter of other LHN/central bodies and a few `ORN_DA1`/`ORN_VA1v` bodies with
unmatched/unknown sides (≤0.1% each). No single missing neuron matters.

**`contact-pheromone`** (86.0% kept): the largest missing pieces are `LgLG6`/`LgLG8` (sensory, OUT, +4.8%/+0.8%
— front-leg GRNs the pool itself could in principle widen to, but doing so is a config change, not a bridge)
and the VNC-intrinsic `IN04B079`/`IN01A040` (+2.0%/+0.6% — downstream of the ascending `AN03A008`/`AN09B017g`
carriers that are already in the brain).

**No bridge is added** (research R6/the plan's phase gate): both fractions already clear 0.1 by a wide margin,
so there is nothing here that would motivate one.

## Result

Both social senses clear the fidelity gate comfortably, every pre-existing check still passes, the `song` pool
has full input coverage, and the R2 (VL2a) variant confirms the shipped pool is already sufficient. **No
finding is recorded here** — the under-0.1 case the plan anticipated as a risk did not occur.
