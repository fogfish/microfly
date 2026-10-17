# ADR 009: Output-partner seeds: the wide-I/O brain keeps every premotor input of its readout

- **Status:** Accepted for extraction. The wide brain is re-extracted at 14,500 neurons. Calibration is open.
- **Date:** 2026-10-16
- **Supersedes:** [ADR 007](007-wide-io-forager-brain.md) D18's size (11,000) for the wide brain only. Answers
  [ADR 008](008-steering-regime.md) Q4 with a seed rule, not with a larger fill.
- **Extends:** [ADR 006](006-class-seeded-forager-brain.md) D8 (seed classes) and D9 (fill). D10–D13 are unchanged.
- **Numbering:** decisions continue at **D24**. This ADR adds **no LIF mechanism, no runner mechanism, no channel**.
- **Inputs:** `scripts/connectivity-audit.py`, run on the 11K and wide snapshots against the whole allTraced graph
  at `minSynapses` 5 (Annex A).
- **Unchanged:** the 11K brain (`forager-brain-11k.json`, format 4) and every earlier config give byte-identical
  snapshots. The filter is format 5 only.

## Context

The wide brain did not turn reliably toward food or away from danger (ADR 008 A7). The audit (Annex A1) checked
the obvious explanation, that the cut severs the sensory streams before they reach the motor pools, and rejected
it:

- **Every sense reaches every motor pool** in the brain within the same number of hops as in the whole graph
  (mostly 3). Under 1.2 % of any pool's forward mass ends on neurons with no path to an output.
- **The MB and AL are whole** (D8). The lateral horn is cut to 9 % (194 of 2,026), but removing the whole LH, or
  the whole MB, from the *whole graph* moves the food turn contrast by under 10 %. Neither carries food's L/R
  turn signal to DNa01/DNa02 in this probe.

What the cut did drop is the layer **directly upstream of the readout**. D9's fill ranks candidates by shared
synapse weight with the seeds, and the seeds are dominated by 4,064 Kenyon cells and 1,314 descending neurons,
so fill goes to their partners. The premotor neurons that feed the six declared output pools are few and sit
outside both: the cut held 72 % of the turn pools' real input, 26 % of the forward pool's and 44 % of escape's.
The food turn contrast runs through exactly those neurons (SIP022, LAL030_a/b, CB0356, LAL035; Annex A2), and the
brain kept **14 %** of the whole graph's food contrast, against 62–98 % for the other senses.

## Decisions

### D24. Output partners are seeds

A new seed filter, `{ "partnersOf": "outputs" }`, adds **every admitted body with an edge of at least
`minSynapses` onto any output pool body** to the seed set, before fill:

```text
partners = { i : syn(i → o) ≥ minSynapses for some o ∈ output pools }
           − input and output pool bodies − D9's fill exclusions (sensory, motor)
seeds    = class seeds ∪ pools ∪ partners
```

- It is plain connectivity, like D9: one hop, no flow, no sign, no per-output weighting. ADR 006 lesson 2 (no
  selection by objective) holds. The audit's contrast ranking is a measurement and is **not** used to select.
- The input side was measured and **not adopted** (Annex A3). Seeding the input pools' direct targets as well
  raises touch to 97 % but flips leg taste's turn sign, because the leg-taste contrast in the whole graph is a
  small net of large opposing routes, part of which runs through ascending gustatory neurons D9 never admits.
- A class-seed tag wins where a body is both (`origin` stays `seed:<class>`). A neuron added only by this filter
  has `origin: "seed:outputPartner"`. The panel already draws every `seed:` origin as a seed, so no reader changes.
- `E-SEED-EMPTY` when the filter matches nothing, as for a class filter. Format 4 rejects the key.

### D25. The wide brain is 14,500 neurons

`fill.neuronCount` 14,500 (seeds 10,668 = 7,852 class seeds and pools + 2,816 partners; fill 3,832, about
D9's 2,873 plus the 11K brain's margin), `neuronCountRange` [14,000, 15,000]. Every fidelity value is flat
across 14,000–15,000 (Annex A4); 13,000 loses mouth-taste steering (23 %). 730,859 edges, 10.7 MB.

## Result (Annex A4, A5)

| Brain / whole graph | 11K wide (before) | 14.5K (D24, D25) |
|---|---|---|
| Food L/R turn contrast | 14 % | **92 %** |
| Danger-odour turn contrast | 62 % | 54 % |
| Heat turn contrast | 88 % | 92 % |
| Mouth-taste turn contrast | 98 % | 89 % |
| Touch turn contrast | 79 % | 80 % |
| Leg-taste turn contrast | 274 % | 352 % (sign kept) |
| Real input held: turn L / R, forward, backward, feed, escape | 72 / 72, 26, 80, 92, 44 % | **100 / 100, 100, 100, 97, 98 %** |

All six declared fidelity checks pass. Food and danger now reach the turn pools with the same order of magnitude
(8.0e-7 and 2.6e-7). The turn pools hold the same input on both sides.

## Consequences

- **Re-calibration is required.** Every wide-brain calibration result, and the world's `brain.lif` placeholder,
  were for the 11K snapshot. The ADR 008 D21/D22 protocol applies unchanged; the probe will run about 30 % slower.
- **Danger odour stays at about half** of the whole-graph contrast. Its missing carriers are diffuse (each under
  0.3 % of the contrast flow, Annex A2) and partly cancel; more fill (up to 19,668) does not change it (A4).
- **The readout carries little of the odour contrast, in the whole graph too** (Annex A5). Food's L/R contrast on
  DNa01 ranks 230th of 472 bilateral DN types (DNa02 18th); danger's ranks 401st. It lands mainly on DNp29, DNc01,
  DNp32 and DNb05, which are in the brain but not read out. No cut fixes that. It is Q1.
- **Leg-taste steering is overstated** (352 %). It is not a declared check; leg taste's declared role is
  `taste-leg → backward`, which passes.

## Open questions

- **Q1. Readout pools.** Should turning read more than DNa01/DNa02? A lateralised input to a DN is not evidence of
  a steering command. A change is a channel declaration and needs its own ADR with literature support.
- **Q2. Leg first-order VNC interneurons.** Touch and leg taste lose IN23B018, IN23B022, IN04B079 (first-order
  leg interneurons). A rule for them that keeps leg-taste's sign is open.

## Annex A: measurements

All from `scripts/connectivity-audit.py` (8-step linear probe, D12 weights, outputs as sinks) on MaleCNS v1.0
traced-only, allTraced, `minSynapses` 5: 165,122 neurons and 6,233,542 edges. "Contrast" is the fidelity probe's
L/R turn contrast; percentages are brain over whole graph.

### A1. 11K wide brain (before)

Shortest hops input → output are equal in brain and whole graph for 66 of 72 pairs; the other six are 4 against
3. Trapped forward mass ≤ 1.2 %. Category lesions of the food turn contrast, whole graph: none 8.76e-7, −LHN
8.12e-7, −KC/MBON 8.91e-7, −LAL/PS/VES 3.58e-7.

### A2. Who carries the contrast (whole graph, signed flow through each neuron)

Food: LAL/PS/VES 24 % of the |flow| (42 % of it in the 11K cut), other central 22 % (25 %), AL local 19 % and PNs
17 % (both 100 %), LH 5 %, KC 4 %, MBON 2 %. Top missing in the 11K cut: SIP022 (L, R), LAL030_a (×4), LAL030_b
(×3), CB0356/R, LAL035/L. All 20 are presynaptic partners of an output pool. Adding the top 10 / 25 missing
neurons to the 11K cut gives 69 % / 86 % (a measurement only, D24 does not rank).

### A3. Candidate rules (simulated selection, brain / whole graph)

| Rule | n | Food | Danger | Heat | Mouth | Leg | Touch |
|---|---|---|---|---|---|---|---|
| D9 only (shipped 11K) | 11,000 | 14 % | 62 % | 88 % | 98 % | 274 % | 79 % |
| + output partners, total 12,000 | 12,000 | 90 % | 13 % | 92 % | 61 % | 405 % | 78 % |
| + output partners, + 2,873 fill | 13,541 | 92 % | 54 % | 94 % | 51 % | 354 % | 81 % |
| + output and input partners, no fill | 11,745 | 84 % | **−62 %** | 84 % | 127 % | **−57 %** | 94 % |
| + output and input partners, + 2,873 fill | 14,618 | 92 % | 54 % | 93 % | 105 % | **−28 %** | 96 % |

### A4. Size scan with output partners

| n | Food | Danger | Heat | Mouth | Leg | Touch |
|---|---|---|---|---|---|---|
| 13,000 | 91 % | 54 % | 94 % | 23 % | 381 % | 81 % |
| 13,500 | 92 % | 54 % | 94 % | 50 % | 354 % | 81 % |
| 14,000 | 92 % | 55 % | 92 % | 76 % | 360 % | 81 % |
| **14,500** | **92 %** | **54 %** | **92 %** | **89 %** | **351 %** | **80 %** |
| 15,000 | 92 % | 51 % | 92 % | 84 % | 352 % | 81 % |
| 17,668 | 94 % | 58 % | 94 % | 80 % | 358 % | 81 % |
| 19,668 | 94 % | 57 % | 95 % | 80 % | 364 % | 81 % |

The shipped extraction reproduces the 14,500 row: food +8.04e-7 vs +8.76e-7, heat −2.46e-5 vs −2.67e-5, touch
+1.33e-5 vs +1.65e-5; taste-mouth → feed, taste-mouth → forward and taste-leg → backward keep their signs.

### A5. Readout scan (whole graph; bilateral DN types, ipsi minus contra)

| Sense | DNa01 rank | DNa02 rank | Largest |
|---|---|---|---|
| Food odour | 230 | 18 | DNp29, DNc01, DNp32 |
| Danger odour | 401 | 167 | DNp29, DNp32, DNb05 |
| Heat | 173 | 74 | DNc02, DNpe043, DNb05 |
| Touch | 170 | 30 | DNg48, DNg85, DNg83 |
