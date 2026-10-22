# Research: Social and Pheromone Senses

Phase 0 of [plan.md](plan.md). Every number in §0 was read from MaleCNS v1.0 on 2026-10-21
(`body-annotations-male-cns-v1.0-minconf-0.5.feather`, `connectome-weights-…-traced-only.feather`, edges with
`weight ≥ 5`) and from the shipped `public/brains/forager-brain-mb.brain`. Nothing here is a selection rule; the
extractor selects by the config in [contracts/extract-config-social.md](contracts/extract-config-social.md).

## 0. Dataset check of every named type

### 0.1 Sensory neurons

| Pool | Dataset filter | L | R | unknown side | Note |
|---|---|---|---|---|---|
| `ORN_DA1` (Or67d, cVA) | `class = olfactory`, type | 51 | 105 | 48 | |
| `ORN_VA1v` (Or47b) | ditto | 15 | 73 | 42 | |
| `ORN_VA1d` (Or88a) | ditto | 23 | 76 | 33 | |
| `ORN_VL2a` (Ir84a) | ditto | 23 | 50 | 25 | variant only (R2) |
| Front-leg ppk23 | `gustatory`, `leg bristle`, `ProLN`, `putative_ppk23` | 37 | 34 | 0 | |
| Front-leg ppk25 | ditto, `putative_ppk25` | 32 | 33 | 0 | |

- The front-leg ppk23/ppk25 total is **136**, as ADR 007 D16 measured. MesoLN (97), MetaLN (100) and wing ADMN (192)
  ppk23/ppk25 neurons exist too and stay out of scope (no body site for them).
- The left/right imbalance of the ORNs (DA1 51 / 105) is the dataset's side assignment, as for the food glomeruli.
  ORNs with unknown side are dropped from both channels, the same rule as the other odours.
- No conspecific glomerulus is in food A (DM1, DM2, DM4), food B (VA2, DP1m, VM5d) or danger (V).

### 0.2 Central social pathway

| Name in the request | In the annotations | Count | Superclass | In the 14.5K MB brain |
|---|---|---|---|---|
| PNs of the glomeruli | `DA1_lPN`, `DA1_vPN`, `VA1v_adPN`, `VA1v_vPN`, `VA1d_adPN`, `VA1d_vPN`, `VL2a_adPN`, `VL2a_vPN` | 43 | `ALPN` class | 43 (all, via the `ALPN` class seed) |
| P1 | **no type `P1*`**; no synonym hit. The male-specific pC1 cluster is `pC1_*` | — | — | — |
| pC1 | `pC1_1a` … `pC1_19` (49 types; 126 male-specific, 22 potentially male-specific, 8 dimorphic) | 156 | `cb_intrinsic` | 43 |
| vAB3 | **no type `vAB3`**; synonym "Yu 2010: vAB3" on `AN09B017e`, `AN09B017f`, `AN09B017g` | 6 | ascending | 2 |
| mAL | `mAL4A` … `mAL6`, `mAL_m1` … `mAL_m11` (29 types; 98 male-specific). The prefix `mAL` alone would also take `mALB1-5` and `mALD1/3/4` (18 non-dimorphic AL neurons), so the seed uses the four prefixes `mAL4`, `mAL5`, `mAL6`, `mAL_` | 141 | `cb_intrinsic` | 14 |
| pIP10 | `pIP10` | 2 | `descending_neuron` | 2 |
| vPR6 | `vPR6` | 8 | `vnc_intrinsic` | 0 |
| dPR1 | `dPR1` | 2 | `vnc_intrinsic` | 2 |

Synapse sums between the groups (whole graph, `weight ≥ 5`):

| From → to | Synapses | Reading |
|---|---|---|
| conspecific ORNs → their PNs | 69,537 | AL entry, intact in the cut |
| front-leg ppk → vAB3 | 3,892 | the canonical contact route |
| vAB3 → mAL | 11,299 | |
| vAB3 → pC1 | 1,112 | |
| mAL ↔ pC1 | 14,940 / 10,420 | |
| conspecific PNs → mAL | 595 | olfactory pheromone route |
| pC1 → pIP10 | 1,796 | courtship command onto the song DN |
| mAL → pIP10 | 113 | |
| pIP10 → dPR1 / vPR6 | 1,112 / 46 | VNC song premotor, downstream of the readout |

pIP10's largest inputs are `aIPg7` (1,280), `ICL008m`, `AVLP717m`, `AVLP710m`, `AVLP718m`, `VES024_a`, `AVLP256` and
`pC1_14a` (565).

## R1. Neuron selection for the two senses

**Decision**: Two new pairs in a new config `extract/configs/forager-brain-social.json`, copied from
`forager-brain-mb.json`:
- `contact-pheromone-left/right`: `class gustatory`, `subclasses ["leg bristle"]`, `entryNerves ["ProLN"]`, new
  include filter `receptorTypes ["putative_ppk23", "putative_ppk25"]`, `rootSide` L/R. Site `front-leg`, sense
  `contact:pheromone`.
- `odour-conspecific-left/right`: `class olfactory`, `types ["ORN_DA1", "ORN_VA1v", "ORN_VA1d"]`, `rootSide` L/R.
  Site `antenna`, sense `odour:conspecific`.
- Leg taste stays as it is, with the `excludeReceptorTypes` filter.

**Rationale**: The include filter is the exact complement of leg taste's exclude filter, so the two pools are
disjoint by construction and together cover all 300 front-leg GRNs (ADR 007 D16).

**Alternatives considered**: Dropping the exclude filter and splitting by `receptorType` in code was rejected because
selection must be config, not code (Principle IV). Including mid- and hind-leg ppk neurons was rejected because they
have no body site that touches another fly first.

## R2. VL2a

**Decision**: Not in the shipped pool. The fidelity probe (R6) runs once with VL2a added, and both results are
recorded in ADR 012.

**Rationale**: Ir84a responds to food odours (phenylacetic acid) as well as fly odours. Feeding it a fly-only stimulus
would repeat D16's mistake in the other direction. It enters only if the measurement shows the conspecific contrast
needs it, and that would be a recorded config change.

## R3. Pool overlap needs a neuron-level check

**Decision**: `E-POOL-OVERLAP` is extended. The declared-set check (types/subclasses/typePrefixes of two pairs of the
same class) is kept for the declared sets that have no `receptorTypes`/`excludeReceptorTypes` filter. For every
pair, after the pools are resolved, the extractor checks that no `bodyId` falls in two input pools, and raises
`E-POOL-OVERLAP` naming the pairs and the first shared `bodyId`.

**Rationale**: Today's check would reject the config, because `taste-leg` and `contact-pheromone` both declare
`subclass "leg bristle"`. They are disjoint only by receptor type. A resolved-set check is the real invariant
(spec FR-004), and it also covers the old configs, which pass it.

## R4. Seeding the social pathway

**Decision**: The seed filter gains `types` and `typePrefixes` (exactly one of `class`, `superclass`, `types`,
`typePrefixes` per filter). The social config adds two filters:

```json
{ "typePrefixes": ["pC1_", "mAL4", "mAL5", "mAL6", "mAL_"] },
{ "types": ["AN09B017e", "AN09B017f", "AN09B017g", "pIP10"] }
```

A filter that matches no admitted body
raises `E-SEED-EMPTY`, as class seeds do. A type of `types` that matches nothing raises the same error naming the type,
so a misspelt name cannot pass silently.

- **P1** is taken as the `pC1_*` cluster, because the release has no `P1` type or synonym. ADR 012 states this, and
  the panel's group labels say "pC1 (incl. P1)".
- **vAB3** is seeded by its dataset types `AN09B017e/f/g`, found through the `synonyms` column.
- **vPR6 and dPR1 are not seeded.** They are VNC song premotor neurons downstream of pIP10. pIP10 becomes an output
  (R5), and outputs are sinks, so these neurons would get no song drive in the brain. The body layer stands in for
  the VNC.

**Rationale**: Today's cut keeps only 43 of 156 pC1 and 14 of 141 mAL neurons (§0.2), because D9's fill ranks by
shared weight with KC- and DN-dominated seeds. Seeding by type is plain identity selection, like the class seeds. It
is not selection by objective (ADR 006 lesson 2).

**Alternatives considered**: Seeding by `dimorphism = male-specific` (1,258 bodies) was rejected as too broad.
Seeding by `fruDsx` was rejected because it is unlabelled for most bodies. Raising the fill size alone was rejected
because it does not target the pathway (ADR 009 A4: fidelity is flat past 14,500).

## R5. Neuron count and fill

**Decision**: `fill.neuronCount` = 14,500 plus the number of neurons the new seeds and pools add, so the fill stays the
same size as the MB brain's. The estimate is about 113 pC1 + 127 mAL + 4 vAB3 + 343 ORNs + 136 ppk, about 723
neurons, so `fill.neuronCount` is about 15,223, set to the extracted value. `neuronCountRange` moves to
[14,700, 15,800]. The extraction report lists how many of the MB brain's 14,500 neurons the new cut keeps.

**Rationale**: If the fill shrank, the brain would lose central neurons that the food and danger checks depend on.
Keeping the fill size limits the change to the new seeds and a small re-ranking of the fill. The food-regression check
(R11) measures that change.

## R6. Pathway fidelity (ADR 009 style)

**Decision**:
- Add two `contrast` checks to `fidelity.checks`, `odour-conspecific` and `contact-pheromone`, with `minFraction 0.1`.
  This is the threshold every other contrast check uses.
- Add `sign` rows to the fidelity table for each social pair against forward, backward, feed, escape and **song**.
- Run `scripts/connectivity-audit.py` with the `coverage`, `paths`, `bridges` and `readout` sections for both pairs.
- Record in ADR 012, as the D16/A5 tables do, what fraction of the whole graph's conspecific and contact contrast the
  cut keeps.

**Rationale**: This is the same linear probe and the same horizon (8 steps) as ADR 009, so the numbers compare
directly with food (92 %) and danger (54 %). It is a measurement. A low fraction is a finding, and it does not lead to
a hand-made bridge.

## R7. Approach or avoid is measured, not declared

**Decision**: Two probes, then the declaration.
1. **Linear claim table** (ADR 007 style, from the extractor's fidelity table). For each social pair, the turn
   contrast sign (toward or away) and the forward, backward and song signs.
2. **Spiking probe** (D27, the `microfly-calibrate` C2 stage, with the existing D27 gates unchanged):
   - Conditions: rest, then left-only, right-only and bilateral for each social pair.
   - Calibration seeds only, with the reproducibility check on the held-back seed.
   - It may pick `drive.odour-conspecific`, `drive.contact-pheromone`, `side.<pair>.L/R` if 5 or more side-selective
     neurons pass on each side, and reads the named `song` pool.
3. **Declaration.** A pair's `valence` in the decoder file is:
   - `approach` when the measured side response turns toward the stimulus, or the bilateral drive rises forward and
     falls backward;
   - `avoid` when it turns away, or rises backward or alarm;
   - `none` when the two probes disagree or neither passes its gate.

   The claim table, the C2 numbers and the chosen word go into ADR 012 and the panel.

**Rationale**: cVA in males is reported as aversive or aggression-related (Or67d→DA1→aSP-g; Wang & Anderson 2010;
Kurtovic et al. 2007), while ppk23 F cells promote courtship (Thistle et al. 2012; Toda et al. 2012). These are two
senses whose valence may differ, so declaring it in advance would let the data be overruled. With `none`, the sense
still feeds the brain, but the body layer gives it no steering term (`VALENCE_SIGN.none = 0`). That is the honest
outcome if the brain carries no consistent sign.

## R8. The conspecific field and contact, main thread

**Decision**: Add a new stimulus source `from: "flies"` in `forager-step-wide.js` `samplerFor`.
- **Per tick**, the host (live) and the lockstep runner (experiments) refresh one table, `env.conspecifics`, before
  any fly senses: `[{ id, x, y, heading, sex, alive }]`. That is 6 entries, so the cost is about 6 × 4 sites × 6
  sources = 144 distance evaluations a tick.
- **Odour** (`odour:conspecific`): `Σ_{j ≠ self, alive} falloff(d(site, fly_j), radius) × emit(sex_j)`, clamped to
  [0, 1]. This is the same linear `falloff` the flowers use (`stimulus.js`), so the moving source behaves like a
  static one. Optional `interpolate` does not apply because the field is analytic. Optional `contrast` applies
  unchanged.
- **Contact** (`contact:pheromone`): 1 × `emit(sex_j)` when the front-leg site lies within `bodyRadius` of fly
  `j ≠ self`. It is the maximum over j, so the value stays in [0, 1].
- **Self-exclusion**: `senseDeclared` passes the sensing fly's `id` to the sampler. Other samplers ignore it.
- **Overlay**: `odour-conspecific` is a fifth overlay. Its per-cell field is the same odour function sampled at cell
  centres (64 × 40 cells × 6 flies), with no self-exclusion because the viewer is not a fly. It is repainted on the
  food overlay's throttle.

**Rationale**: This is what the request asks for. It is cheap, needs no worker change (Principle II: no neural
computation moves), and one function feeds both the sense and its overlay, which is the odour-layer contract's rule.

**Alternatives considered**: A per-cell grid updated each tick was rejected because cells step once per tile. The
antennae sit 1 tile apart, so L and R would read the same cell, the problem BUG-003 solved with interpolation. The
analytic sum has no such step.

## R9. Sex tag and emission

**Decision**: `flies.sex[i]` (already in the world format) is the tag. `flies.sexes` declares the emission per sex:

```json
"sexes": {
  "default": "female",
  "female": { "emits": { "odour:conspecific": 1.0, "contact:pheromone": 1.0 } },
  "male":   { "emits": { "odour:conspecific": 1.0, "contact:pheromone": 0.0 } }
}
```

- A missing tag takes `default`. An unknown tag, or an `emits` key that names no declared `from: "flies"` stimulus,
  fails validation.
- The defaults follow the biology: ppk23/ppk25 F cells sense female cuticular hydrocarbons (7,11-HD). Both sexes
  carry fly odour, and males add cVA. Because this is a single conspecific channel, both sexes get strength 1, and
  calibration may change odour strength per sex (FR-016).

**Rationale**: The tag changes only what a fly emits. Brain, decoder and body layer are identical for both sexes
(FR-009), so "female" is honestly "a male brain wearing a name tag".

## R10. Solid bodies (optional)

**Decision**: `flies.body.solid` defaults to false. When it is true, a move that would bring two body centres closer
than `2 × bodyRadius` is refused, like a blocked cell. The touch sense (`from: "blocked"`) then also reports 1 when
the touch site lies inside another fly's body. Every arm shares the same world physics.

The demo world starts with `solid: false`. Whether to switch it on is a calibration-seed decision recorded in
`calibration.md`.

**Rationale**: With solid bodies, contact lasts longer and touch has a second meaning, so the result must not depend
on a hidden default.

## R11. Ablated arm

**Decision**: `lesion(snapshot, channelIds)` in the new lockstep runner, alongside `rewire`. It sets to zero the
outgoing edge weights of every neuron in the `odour-conspecific` and `contact-pheromone` input pools. Neuron indices,
pools and the decoder file stay the same. The input still arrives at the input neurons, but nothing downstream
hears it.

**Rationale**: This is "the same config minus the social pools" without re-extracting. If the pools were removed and
the brain re-extracted, D9's fill would re-rank and change the rest of the brain, and the C2 decoder would no longer
match. The lesion is labelled as a derived experimental arm, the same status as the random graph (Principle III).

## R12. The `song` output

**Decision**:
- **Output.** `outputs.song = { "types": ["pIP10"], "drive": "song" }` in the social config. The channel declaration
  becomes v6: it requires the six forager-wide drives and allows one optional `song` drive. The v5 reader is kept.
- **Decoder.** The decoder reads the named `song` pool like `feed`, with its rest from D33.
- **Body layer, W17.** `singing = (r(song) − rest(song)) integrated over songTau ≥ songThreshold`. When singing, the
  renderer draws the fly with one wing extended, on the side of the nearest neighbour, which comes from
  `side.contact-pheromone` if that exists and is otherwise drawn on the left. Song has no effect on movement.
- **Experiment.** A song bout is a run of singing ticks.

**Rationale**: pIP10 is the only song command DN in the brain, and the request asks for song read from a probed pool.
Making pIP10 a sink drops only its VNC edges (pIP10 → dPR1, vPR6), which the body layer stands in for. If `song`
never rises above rest under contact, the wing is never drawn, and ADR 012 records that.

## R13. Lockstep experiment runner

**Decision**: Add `scripts/social-arms.mjs`. In each seed's world, every fly steps one tick before any fly steps the
next. Each tick it:
1. refreshes `env.conspecifics`;
2. runs, for each fly, `stepForagerFlyV3`;
3. records the per-fly social telemetry.

It reuses `forager-arms.mjs`'s `rewire`, its spawn and its body-layer configuration object, and passes the same object
to every arm.

**Rationale**: `forager-arms.mjs` runs each fly to the end before starting the next (it was built for flies that do
not interact), so it cannot measure social behaviour. The browser host already steps flies against live positions.

## R14. Metrics (all in `metrics.js`, pure)

| Metric | Definition |
|---|---|
| NN distance | per tick, the distance to the nearest live other fly; the median per fly |
| Time near | the fraction of ticks with NN distance ≤ 2 tiles |
| Contact rate | contact-event onsets per fly per simulated minute; an event is a run of ticks with either front-leg site inside another body |
| Contact duration | mean event length in ticks |
| Following index | over ticks with NN distance ≤ 2 tiles, the mean of cos(heading_i − heading_nn) × (nn ahead of i ? 1 : 0); 0 for a random walk on average |
| Song per contact | song-bout onsets during contact events divided by contact events, against song-bout onsets per tick alone (NN > 2 tiles) |
| Sex split | each of the above computed for the other fly's tag (nearest neighbour, or the contacted fly) |

Confidence intervals come from `metrics.js` `bootstrapCI`, over seeds. The verdict (SC-004) uses **time near** and
**contact rate**: the social brain's must exceed both the random-graph arm's and the random-walk arm's, with 95 % CIs
that do not overlap. The ablated arm is reported next to these. If the ablated arm also passes, the effect is not
pheromonal, and the result says so.

## R15. Shared AL/LH circuitry and the regression risk

**Decision**: The food and danger regression check runs on held-out seeds, with the world's social stimuli removed
and then on.
- **With the stimuli removed:** the social brain's food-A and food-B turn contrasts (fidelity table), danger escape,
  find rate and feeding must stay within the MB brain's seed-to-seed spread (SC-005).
- **With the stimuli on:** any change is reported.
- The C2 food pools (`drive.odour-food-a/b`, 657/653 neurons in the MB decoder) are checked for being specific to
  their own odour. The D27 specificity gate (≥ 2× any other pair, now including the social pairs) enforces this, and
  a food pool member that responds to conspecific odour drops out.

**Rationale**: The conspecific PNs project into the same LH and MB calyx as the food PNs. A social sense that leaks
into the food readout would make a fly "forage" towards other flies. The D27 gate already catches this; the
behaviour check confirms it.

## R16. Calibration

**Decision**: Use the `microfly-calibrate` skill with a new profile `social-v3`. It starts from the MB world's shipped
`brain.lif` block.
- **C1 (rest regime)** is re-run only to confirm the block. If it fails, the C1 grid is searched on calibration seeds.
- **C2 (decoder)** always runs, because indices change.
- **Social world values**, calibrated on calibration seeds and each recorded with the run that motivated it in
  `calibration.md`:
  - conspecific `radius`, `contrast`;
  - emission strength per sex;
  - `bodyRadius`;
  - `songThreshold` and `songTau`;
  - `solid`.
- The forager and learning worlds' shipped values are not touched (FR-017). The hunger modulator does not target the
  social pairs (FR-018).

## R17. Literature for ADR 012

- Kurtovic, Widmer & Dickson 2007, *Nature* 446:542: Or67d/DA1 mediates cVA responses.
- Wang & Anderson 2010, *Nature* 463:227: cVA promotes male–male aggression via Or67d.
- Thistle et al. 2012, *Cell* 149:1140; Toda, Zhao & Dickson 2012, *Cell Rep* 1:599; Lu et al. 2012, *PLoS Genet*: ppk23
  foreleg neurons sense female pheromones and promote courtship.
- Clowney et al. 2015, *Neuron* 87:1036 (vAB3/PPN1 → P1 and mAL); Kallman et al. 2015, *eLife* 4:e11188 (vAB3 → P1).
- von Philipsborn et al. 2011, *Neuron* 69:509: P1, pIP10, vPR6, dPR1 in courtship song.
- Dweck et al. 2015, *eLife* 4:e10203 (Or47b, Or88a respond to fly odours); Grosjean et al. 2011, *Nature* 478:236
  (Ir84a, food and courtship).
