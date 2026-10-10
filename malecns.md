# Male CNS connectome (v1.0, minconf 0.5)

A description of the whole male *Drosophila* central nervous system connectome: the brain plus the ventral nerve cord (VNC). It covers what is in the files, what each neuron class is, how connectivity is stored, and the caveats to check before analysis.

Local copy: `/Users/kolesnik/Downloads/fly/flat-connectome/` (29 GB, 11 Feather files).

## 1. Overview

- **Organism:** adult male *Drosophila melanogaster*.
- **Scope:** central brain, optic lobes, and ventral nerve cord (VNC). The VNC is the fly's equivalent of a spinal cord and controls legs, wings and abdomen.
- **Release:** v1.0.
- **Synapse confidence:** the `minconf-0.5` suffix likely means synapses were kept at a detection confidence of at least 0.5. This is inferred from the file name, not from documentation.
- **Unit of analysis:** a *body* is one reconstructed neuron or glial cell, identified by `bodyId`. Synapses are directed from a presynaptic body to a postsynaptic body.

Headline numbers:

| Quantity | Value |
|---|---|
| Annotated bodies | 211,577 |
| Bodies with a cell type (`type`) | 164,506 (77.8%) |
| Bodies with `status = Traced` | 165,122 |
| Bodies with `status = Glia` | 11,864 |
| Synapses, full connectome | ~312M |
| Synapses, traced-only subset | ~124M |
| Body-level neurotransmitter predictions | 1.84M |

## 2. Files

| File | Rows | Contents |
|---|---|---|
| `body-annotations-male-cns-v1.0-minconf-0.5.feather` | 211,577 | One row per body: identity, class, side, nerve, status, and other labels (36 columns) |
| `body-neurotransmitters-male-cns-v1.0.feather` | 1,835,518 | One row per body: predicted neurotransmitter and confidence |
| `body-stats-male-cns-v1.0-minconf-0.5.feather` | 88,384,522 | Per-body statistics: `pre`, `post`, `downstream`, `synweight`, `rank`, plus labels |
| `connectome-weights-male-cns-v1.0-minconf-0.5.feather` | 151,856,684 | Body-to-body edges: `body_pre`, `body_post`, `weight` (all edges) |
| `connectome-weights-…-traced-only.feather` | 25,563,197 | Same, restricted to traced bodies; adds `type_pre`, `type_post` |
| `connectome-weights-…-significant-only.feather` | 25,568,639 | Same, restricted to significant edges; adds `type_pre`, `type_post` |
| `syn-partners-male-cns-v1.0-minconf-0.5.feather` | 311,833,243 | One row per synapse, with pre and post side |
| `syn-partners-…-traced-only.feather` | 124,025,046 | Synapse-level, traced bodies only |
| `syn-partners-…-significant-only.feather` | 124,039,080 | Synapse-level, significant edges only |
| `syn-points-male-cns-v1.0-minconf-0.5.feather` | 357,489,383 | One row per synapse site, with location and region labels |
| `tbar-neurotransmitters-male-cns-v1.0.feather` | 45,656,140 | Per presynaptic release site (T-bar): seven transmitter probabilities |

Notes on the three "variants" of each edge and synapse file:

- **Full:** every edge in the release.
- **Traced-only:** both ends are fully reconstructed bodies (`status = Traced`).
- **Significant-only:** a subset of edges that pass a significance criterion. The criterion is not documented here.

The subsets are not interchangeable. Choose the variant that matches your question and say which one you used.

## 3. Reading the data

- Format: Apache Arrow IPC in Feather files. Read with `pyarrow` or `pandas` (`pd.read_feather`).
- Several files are too large to load whole. Use column selection, `pyarrow.dataset` with a filter, or batched reads. `syn-points` (357M rows, 13 GB) should usually be sampled.
- Join key: `bodyId` in annotations corresponds to `body_pre`/`body_post` in the weights files and `body` in the statistics and neurotransmitter files.
- `type` is the most useful stable name for a neuron across files. Use `bodyId` when you need one specific cell.

Example, verified against the data: the strongest traced-only edge is body 10352 (`Li32`) → body 10351 (`Li33`), with `weight = 2591`. The synapse file has exactly 2,591 rows for that pair, all with `primary_post = LO(R)`. So `weight` is a count of synapses.

## 4. Annotation schema (`body-annotations`)

Each row describes one body. Columns:

| Column | Type | Meaning |
|---|---|---|
| `bodyId` | int64 | Unique body identifier |
| `superclass` | string | Coarse region and role, e.g. `cb_intrinsic`, `vnc_motor` (see §5) |
| `class` | string | Functional class, e.g. `Kenyon_Cell`, `MBON`, `visual` |
| `subclass` | string | Finer grouping within `class` |
| `type` | string | Cell type name (see §6) |
| `flywireType` | string | Name from the FlyWire naming system |
| `hemibrainType` | string | Name from the hemibrain naming system |
| `mancType` | string | Name from the MANC (male adult nerve cord) naming system |
| `vfbId` | string | Virtual Fly Brain identifier |
| `instance` | string | Instance label (free text) |
| `somaSide` | string | Side of the soma: `L`, `R`, `M` |
| `rootSide` | string | Side of the primary neurite root: `L`, `R`, `unknown` |
| `somaLocation`, `tosomaLocation` | list of int64 | Soma position coordinates |
| `somaNeuromere` | string | Neuromere of the soma (VNC) |
| `entryNerve`, `exitNerve` | string | Peripheral nerve(s) the neuron enters or leaves (VNC); see §7 |
| `status` | string | Reconstruction status (see §8) |
| `statusLabel` | category | Finer status label (see §8) |
| `birthtime` | string | Developmental birth time, where known |
| `dimorphism` | string | Sexual dimorphism flag: `male-specific`, `sexually dimorphic`, etc. |
| `matchingNotes` | string | Notes on how the body was matched across datasets |
| `serialMotif` | string | Serial-section segment motif (e.g. `cns tiling`, `cns convergent`) |
| `mancBodyid`, `mancGroup`, `mancSerial` | double | Corresponding identifiers in the MANC dataset |
| `mcnsSerial` | double | Serial number within this male CNS release |
| `assignedOlHex1`, `assignedOlHex2`, `group` | double | Optic lobe hexagonal-column assignment and group |
| `itoleeHl`, `trumanHl` | string | Higher-level labels from two naming systems |
| `fruDsx` | string | fruitless/doublesex expression label |
| `receptorType` | string | Receptor class for sensory neurons (e.g. `putative_ppk23`) |

Null counts (out of 211,577 rows):

| Column | Null | Non-null |
|---|---|---|
| `type` | 47,071 | 164,506 |
| `superclass` | 44,877 | 166,700 |
| `class` | 185,064 | 26,513 |
| `subclass` | 189,647 | 21,930 |
| `status` | 5,472 | 206,105 |
| `statusLabel` | 887 | 210,690 |
| `somaSide` | 60,851 | 150,726 |
| `rootSide` | 193,638 | 17,939 |
| `entryNerve` | 199,742 | 11,835 |
| `exitNerve` | 210,572 | 1,005 |

Filter on these before counting. A null means the body was not labelled in that system, not that it has no such property.

## 5. Superclass and region

The `superclass` prefix gives the region:

- `ol_*`: optic lobe (`ol_intrinsic`, `ol_sensory`)
- `cb_*`: central brain (`cb_intrinsic`, `cb_sensory`, `cb_motor`, `cb_efferent`, `cb_endocrine`, `cb_sensory_tbc`)
- `visual_*`: links between the optic lobe and the central brain (`visual_projection`, `visual_centrifugal`)
- `vnc_*`: ventral nerve cord (`vnc_intrinsic`, `vnc_sensory`, `vnc_motor`, `vnc_efferent`, `vnc_endocrine`, `vnc_tbc`)
- `ascending_neuron`, `descending_neuron`: pathway neurons between brain and VNC (`*_tbc` variants mark "to be checked")
- `sensory_ascending`, `sensory_descending`, `efferent_ascending`, `efferent_descending`: mixed-role groups
- `ENS`: enteric nervous system

Superclass values (27): `ENS`, `ascending_neuron`, `cb_efferent`, `cb_endocrine`, `cb_intrinsic`, `cb_motor`, `cb_sensory`, `cb_sensory_tbc`, `descending_neuron`, `descending_neuron_tbc`, `efferent_ascending`, `efferent_descending`, `ol_intrinsic`, `ol_sensory`, `sensory_ascending`, `sensory_ascending_tbc`, `sensory_descending`, `visual_centrifugal`, `visual_projection`, `visual_projection_tbc`, `vnc_efferent`, `vnc_endocrine`, `vnc_intrinsic`, `vnc_motor`, `vnc_sensory`, `vnc_sensory_tbc`, `vnc_tbc`.

Approximate region split by superclass prefix: brain about 142k bodies, VNC about 24k, other or unannotated about 45k.

## 6. Cell types and classes

### Class (21 values)

`ALIN`, `ALLN`, `ALON`, `ALPN`, `CX`, `DAN`, `Kenyon_Cell`, `MBON`, `SEZPN`, `chemosensory`, `gustatory`, `hygrosensory`, `mechanosensory`, `mechanosensory_proprioceptive`, `mechanosensory_tactile`, `mechanosensory_tbc`, `ol_bilateral`, `olfactory`, `thermosensory`, `unknown_sensory`, `visual`.

Counts: `visual` 6,091; `Kenyon_Cell` 4,064; `CX` 2,950; `olfactory` 2,639; `mechanosensory_tactile` 2,558; `mechanosensory` 1,733; `unknown_sensory` 1,712; `mechanosensory_proprioceptive` 1,454; `gustatory` 1,428; `ALPN` 686; `ALLN` 420; `DAN` 340; `ol_bilateral` 116; `MBON` 97; `hygrosensory` 66; `chemosensory` 58; `SEZPN` 27; `thermosensory` 25; `ALIN` 24; `ALON` 14; `mechanosensory_tbc` 11.

### Functional roles (general fly neuroscience; not derived from this dataset)

- **Visual (`visual`, optic lobe):** L1–L5 lamina cells; Tm and Mi medulla neurons; T4 and T5 direction-selective neurons (T4 for ON motion, T5 for OFF motion); LC and LPLC lobula columnar neurons for object and looming detection.
- **Olfactory (`olfactory`, `ALPN`, `ALLN`, `ALIN`, `ALON`):** olfactory receptor neurons send odour signals to the antennal lobe. Projection neurons (ALPN) relay them to the brain. Local neurons shape the code within the antennal lobe.
- **Mushroom body (`Kenyon_Cell`, `DAN`, `MBON`):** Kenyon cells encode odour memory in sparse patterns. Dopaminergic neurons (DAN) deliver reward or punishment teaching signals. Mushroom body output neurons (MBON) read out the learned signal.
- **Central complex (`CX`):** ring, fan-shaped, ellipsoid-body and protocerebral-bridge neurons that keep a heading estimate and drive steering and navigation.
- **Mechanosensory, gustatory, hygrosensory, thermosensory, chemosensory:** peripheral sensory neurons from the body surface and internal organs.
- **Descending neurons (DN, `descending_neuron`):** carry brain commands to the VNC for walking, turning, takeoff and grooming. About 1.3k in the annotated set.
- **Ascending neurons (AN, `ascending_neuron`):** carry sensory feedback from the body to the brain. About 1.8k.
- **Motor neurons (MN, `vnc_motor`):** drive muscles directly. About 354 in the annotated set by name. They receive input and produce almost no outgoing synapses.
- **Glia:** 11,864 bodies have `status = Glia`. They are annotated but excluded from the wiring diagram in most analyses.

Counts for MBON, DAN, Kenyon cells, and DN/AN/MN by name patterns are approximate. The `class` column gives the exact counts for the first group.

### Cell type (`type`)

- 11,751 distinct values; 47,071 bodies have no type.
- Names follow the naming conventions of the source datasets, for example `Tm9`, `KCg-m`, `DNg08`, `MNad02`, `L1`, `R1-R6`, `CB1365`, `AN01B011`, `PVLP008_c`.
- 781 entries contain several names separated by commas (e.g. `MNad18,MNad27`). Split on commas before matching.
- 399 entries contain spaces or slashes.
- The name is the most useful stable identity for a neuron class across files. It is not unique per body: many bodies share a type.

Other naming systems are carried in `flywireType`, `hemibrainType`, `mancType`, and `vfbId`. Use these to cross-reference other connectomes.

## 7. Nerves (VNC)

`entryNerve` and `exitNerve` record where a neuron's peripheral projections leave or enter the VNC.

`entryNerve` values (21): `ADMN`, `AN`, `AbN1`, `AbN2`, `AbN3`, `AbN4`, `AbNT`, `DMetaN`, `DProN`, `MesoLN`, `MetaLN`, `MxLbN`, `ON`, `PDMN`, `PhN`, `PrN`, `ProAN`, `ProCN`, `ProLN`, `VProN`, `aPhN`.

`exitNerve` values (28): the same nerve names, plus `CvN`, `NCC`, `PDMNa`, `PDMNp`, `TBD`, and comma-separated combinations (e.g. `ADMN,DMetaN`, `AbNT,AbN4`, `AbNT_L,AbNT`).

Nerve values are populated for only a small fraction of bodies (about 11.8k for `entryNerve`, about 1k for `exitNerve`). Most are brain neurons.

## 8. Status

`status` (6 values), with counts:

| Value | Count | Meaning (inferred from names) |
|---|---|---|
| `Traced` | 165,122 | Fully reconstructed body |
| `Orphan` | 15,925 | Reconstructed but not assigned a cell type |
| `Glia` | 11,864 | Glial cell |
| `Unimportant` | 10,751 | Excluded from analysis |
| `Assign` | 1,832 | Assigned a type by a later process |
| `Anchor` | 611 | Used as a reference point for other bodies |
| null | 5,472 | No status |

`statusLabel` (19 values) gives finer detail: `Reviewed` (54,066), `Roughly traced` (71,979), `Prelim Roughly traced` (36,387), `Orphan` (12,075), `Glia` (11,864), `Unimportant` (10,751), `Out of scope` (4,585), `Orphan-artifact` (2,318), `RT Hard to trace` (2,019), `0.5assign` (1,832), `Orphan hotknife` (1,428), `Leaves` (528), `Anchor` (283), `Soma Anchor` (201). The remaining labels (`Hard to trace`, `Partially traced`, `PRT Orphan`, `RT Orphan`, `Sensory Anchor`) appear in the data but have low counts. Interpretations of labels other than the counted ones are inferred from their names.

`Traced` and `Reviewed` bodies are the most reliable for analysis. `Roughly traced` bodies may have incomplete branches.

## 9. Sides

- `somaSide`: `L` (75,215), `R` (75,119), `M` (midline, 392), null (60,851).
- `rootSide`: `R` (9,723), `L` (7,802), `unknown` (414), null (193,638).

`somaSide` is populated for about 71% of bodies. `rootSide` is populated for about 8% and is only meaningful for neurons with a clear primary neurite.

## 10. Connectivity

### Edges (`connectome-weights`)

- `body_pre`: presynaptic body.
- `body_post`: postsynaptic body.
- `weight`: number of synapses from `body_pre` to `body_post`.
- `type_pre`, `type_post`: cell types of each side (traced-only and significant-only only).

Full edge set: 151,856,684 edges and 311,833,243 synapses. Traced-only: 25,563,197 edges, 124,025,046 synapses, touching about 163,500 presynaptic and 164,500 postsynaptic bodies.

Weight distribution (traced-only): median 2, mean 4.85, maximum 2,591, 25% quantile 1, 75% quantile 4. About 6.2M edges have weight ≥ 5.

Outgoing synapses by superclass (full connectome):

| Superclass | Outgoing synapses |
|---|---|
| `cb_intrinsic` | 108.6M |
| `ol_intrinsic` | 86.1M |
| `vnc_intrinsic` | 37.6M |
| `visual_projection` | 17.7M |
| unannotated | 16.8M |
| `ascending_neuron` | 14.5M |
| `descending_neuron` | 11.6M |
| `vnc_sensory` | 7.2M |
| `visual_centrifugal` | 4.7M |
| `cb_sensory` | 4.5M |
| `ol_sensory` | 1.3M |
| `sensory_ascending` | 1.1M |
| `cb_motor` | 0.09M |
| `vnc_motor` | 0.07M |

Motor neurons (`vnc_motor`) produce very few outgoing synapses (about 70k in total), so they act as sinks for command input.

The largest intra-region flows are within the optic lobe (`ol_intrinsic` → `ol_intrinsic`, about 36M) and within the central brain (`cb_intrinsic` → `cb_intrinsic`, about 34M). Many synapses land on unannotated bodies. Check annotation coverage before drawing conclusions about regions.

Most-connected cell types by outgoing traced-only synapses: `Mi1`, `Tm1`, `Tm3`, `L2`, `Tm2`, `Tm4`, `L5`, `Mi4`, `KCg-m`, `Mi9`, `T2a`, `TmY5a`, `T2`, `L3`, `L1`, `T3`, `T5c`, `Tm20`, `Y3`, `T5a`, `T4c`, `C3`, `T4a`, `LC17`, `T5b`.

### Synapses (`syn-partners`)

One row per synapse:

- Presynaptic side: `x_pre`, `y_pre`, `z_pre`, `body_pre`, `conf_pre`.
- Postsynaptic side: `x_post`, `y_post`, `z_post`, `body_post`, `conf_post`.
- `primary_post`: primary neuropil of the postsynaptic site (e.g. `LO(R)` for right lobula; other values include `AB(L)`, `AB(R)`, `AL(L)`).

Coordinates are integer voxel positions. The voxel size is not stated in the files; confirm it from the source release before converting to physical distances.

Synapse confidence is given per side, from 0 to 1.

### Synapse sites (`syn-points`)

One row per synapse site with `x`, `y`, `z`, `kind`, `conf`, `sv` (supervoxel), `body`, and a hierarchy of region labels: `compartment`, `major`, `primary`, `superprimary`, `subprimary`, plus optic-lobe column and layer labels (`medulla_*`, `lobula_*`, `lobula_plate_*` for both sides `_r_` and `_l_`). The `kind` column distinguishes pre and post sites. I did not check the allowed `kind` values.

### Neurotransmitters

- `body-neurotransmitters` (1,835,518 rows, one per body): `predicted_nt`, `predicted_nt_confidence`, `total_nt_predictions`, `ground_truth` (available for about 85k bodies), `consensus_nt`, and per-cell-type fields `celltype_*`.
- `tbar-neurotransmitters` (45.7M rows, one per presynaptic release site): seven probabilities (`nt_acetylcholine_prob`, `nt_dopamine_prob`, `nt_gaba_prob`, `nt_glutamate_prob`, `nt_histamine_prob`, `nt_octopamine_prob`, `nt_serotonin_prob`), the site's position (`x`, `y`, `z`, `conf`, `sv`, `body`), its neuropil (`major`, `primary`) and a `split` label.

Consensus transmitter counts across bodies:

| Transmitter | Bodies |
|---|---|
| `unclear` | 1,671,117 |
| acetylcholine | 104,193 |
| glutamate | 29,443 |
| GABA | 22,196 |
| histamine | 8,024 |
| dopamine | 396 |
| octopamine | 101 |
| serotonin | 48 |

Most bodies are `unclear`; the table includes many small fragments. Predictions describe the presynaptic neuron only.

#### Transmitter columns

| Column | Level | Meaning |
|---|---|---|
| `predicted_nt`, `predicted_nt_confidence` | body | Majority prediction over the body's own T-bars, with its confidence. |
| `celltype_predicted_nt`, `celltype_predicted_nt_confidence` | cell type | The same prediction pooled over every body of the type. |
| `consensus_nt` | body | Consensus label for the body. It equals `ground_truth` on all 85,484 bodies that have one (`predicted_nt` matches on 88.6 %), and is far less often `unclear` than `predicted_nt`. |
| `ground_truth` | body | Experimentally established transmitter, about 85k bodies (85,484), mostly by cell type. |

The columns disagree for whole populations, so the choice matters (see §12, Predicted transmitters).

#### The seven transmitters

Counts are for the 165,122 `Traced` bodies, per column. Roles are general fly neuroscience, not derived from this dataset.

| Transmitter | `predicted_nt` | `consensus_nt` | `ground_truth` | Action | Where it is in this dataset (by `consensus_nt`) |
|---|---:|---:|---:|---|---|
| acetylcholine | 94,946 | 103,718 | 52,778 | The main fast excitatory transmitter of the insect CNS (nicotinic receptors). | Most sensory neurons, projection neurons, Kenyon cells, most descending and ascending neurons. |
| glutamate | 28,055 | 29,296 | 14,395 | Fast. Inhibitory in the CNS through the glutamate-gated chloride channel (GluCl); excitatory at the neuromuscular junction. The sign depends on the receptor, which the dataset does not record. | Many local interneurons; motor neurons (at muscle, excitatory). |
| GABA | 20,218 | 22,055 | 13,149 | The main fast inhibitory transmitter (GABA-A, Rdl). | Local interneurons (for example antennal-lobe LNs), the APL neuron, many CX ring neurons. |
| histamine | 2,026 | 5,910 | 2,699 | Fast inhibitory through histamine-gated chloride channels. The photoreceptor transmitter. | Photoreceptors (`R1-R6` 1,394, `R7*`, `R8*`) and the optic-lobe type `T1` (1,777). |
| dopamine | 4,443 | 392 | 380 | Modulatory, through G-protein-coupled receptors (slow). Teaching signal of the mushroom body. | DANs (338, mostly `PAM*`), a few CX and central neurons. `predicted_nt` also labels 4,058 Kenyon cells dopamine, which `consensus_nt` corrects to acetylcholine. |
| octopamine | 102 | 101 | 51 | Modulatory; the insect counterpart of noradrenaline (arousal, flight, muscle modulation). | VNC efferent neurons (49), CX `EL` (18), visual centrifugal (16), `OA-*` types. |
| serotonin | 465 | 48 | 44 | Modulatory (feeding, sleep, aggression), through G-protein-coupled receptors. | Few bodies: `SNpp23` proprioceptors (16), `DNg28`, `FB4Y`, `5-HT*` types. `predicted_nt` calls 465 bodies serotonin; only 48 are confirmed by `consensus_nt`. |
| `unclear` | 14,365 | 3,100 | — | No confident call. | — |
| null | 502 | 502 | 81,626 | No row or no label. | — |

`celltype_predicted_nt` (traced): acetylcholine 98,511, glutamate 29,015, GABA 21,482, histamine 5,983, `unclear` 4,708,
dopamine 4,448, serotonin 386, octopamine 87, null 502.

**Use in microfly.** Brain snapshots give a fast sign to acetylcholine (+1), GABA (−1) and glutamate (−1), from
the config's `transmitterSign`. Histamine, dopamine, octopamine and serotonin have no fast sign, and their bodies are
left out of the fast graph. ADR 006 D10 reads `ground_truth`, then `consensus_nt`, then `predicted_nt`. ADR 007 D18 gives
dopamine a modulatory role.

### Body statistics (`body-stats`)

88.4M rows with `body`, `pre`, `post`, `status_fine`, `superclass`, `class`, `type`, `instance`, `downstream`, `synweight`, and `rank`. I inferred that `pre` and `post` are synapse counts per body, but did not verify the meaning of `downstream`, `synweight` or `rank`.

## 11. Allowed values reference

| Field | Allowed values |
|---|---|
| `class` | `ALIN`, `ALLN`, `ALON`, `ALPN`, `CX`, `DAN`, `Kenyon_Cell`, `MBON`, `SEZPN`, `chemosensory`, `gustatory`, `hygrosensory`, `mechanosensory`, `mechanosensory_proprioceptive`, `mechanosensory_tactile`, `mechanosensory_tbc`, `ol_bilateral`, `olfactory`, `thermosensory`, `unknown_sensory`, `visual` |
| `superclass` | See §5 (27 values) |
| `somaSide` | `L`, `R`, `M` |
| `rootSide` | `L`, `R`, `unknown` |
| `status` | `Traced`, `Orphan`, `Glia`, `Unimportant`, `Assign`, `Anchor` |
| `statusLabel` | `0.5assign`, `Anchor`, `Glia`, `Hard to trace`, `Leaves`, `Orphan`, `Orphan hotknife`, `Orphan-artifact`, `Out of scope`, `PRT Orphan`, `Partially traced`, `Prelim Roughly traced`, `Reviewed`, `Roughly traced`, `RT Hard to trace`, `RT Orphan`, `Sensory Anchor`, `Soma Anchor`, `Unimportant` |
| `entryNerve` | `ADMN`, `AN`, `AbN1`, `AbN2`, `AbN3`, `AbN4`, `AbNT`, `DMetaN`, `DProN`, `MesoLN`, `MetaLN`, `MxLbN`, `ON`, `PDMN`, `PhN`, `PrN`, `ProAN`, `ProCN`, `ProLN`, `VProN`, `aPhN` |
| `exitNerve` | Same as `entryNerve`, plus `CvN`, `NCC`, `PDMNa`, `PDMNp`, `TBD`, and comma-separated combinations |
| `type` | Open set: 11,751 distinct values (see §6) |
| `subclass` | 49 distinct values |

## 12. Caveats and pitfalls

- **Nulls are common.** `class`, `subclass`, `entryNerve`, `exitNerve`, and `rootSide` are populated for a small minority of bodies. Filter explicitly.
- **Mixed name systems.** `type`, `flywireType`, `hemibrainType`, and `mancType` come from different naming schemes and do not map one to one.
- **Subsets change the answer.** Traced-only, significant-only, and full edge files differ in size and in which edges they keep. Always state which one you used.
- **Confidence thresholds.** Synapses carry per-side confidence. The `minconf-0.5` threshold is from the file name only; check the release documentation for its exact definition.
- **Predicted transmitters.** Neurotransmitter identity is predicted from synapse appearance, not measured. `unclear` covers most bodies. Per-body `predicted_nt` can be wrong for whole populations: 4,058 of 4,064 Kenyon cells are predicted `dopamine`, while `consensus_nt` gives `acetylcholine` for all 4,064; of 707 traced VNC motor neurons, 672 are `unclear` in `predicted_nt`, while `consensus_nt` names 302 of them `glutamate`. Compare `predicted_nt`, `consensus_nt` and `ground_truth` before choosing one.
- **Unannotated bodies.** About 45k bodies have no superclass, and they carry a large share of synapses. Results that ignore them may be biased.
- **Approximate counts.** Counts of cell types defined by name pattern (Kenyon cells, DAN, MBON, DN, AN, MN, Tm, T4, T5 and others) are approximate. Use `class` or `type` exact matches when precision matters.
- **Coordinates.** Voxel units are not stated in the files. Verify the voxel size before converting to physical distance.
- **Inferred meanings.** The interpretations of `status`, `statusLabel`, `minconf`, `significant-only`, and the body-stats columns come from their names, not from documentation.

## 13. Roles of regions, superclasses and classes

Descriptions combine the literature (sources below) with general fly neuroscience. Where a role is inferred from a name, the text says so. Synapse totals are from the full connectome.

### Regions

| Region | Role |
|---|---|
| Optic lobe | Visual system: four neuropils (lamina, medulla, lobula, lobula plate) that turn photoreceptor input into motion, colour and object features. The direction-selective T4/T5 cells sit here, and visual projection neurons carry the output to the central brain. |
| Central brain | Higher-order processing: mushroom bodies (associative learning), central complex (heading, navigation, action selection), antennal lobe and lateral horn (olfaction), and the subesophageal zone (taste and feeding). Central neurons send commands to the VNC through descending neurons. |
| Ventral nerve cord | The fly's spinal-cord equivalent. It holds the motor circuits and motor neurons for legs, wings and abdomen, receives sensory input from the body, and returns feedback to the brain through ascending neurons. |
| Brain-VNC pathways | Long-range neurons that link the brain to the VNC and periphery: descending neurons (brain-to-VNC commands), ascending neurons (VNC-to-brain feedback), and sensory and efferent relay groups. This grouping is defined here by superclass name, not by the source paper. |
| ENS | Enteric (gut) nervous system. It is a single body in this dataset, so no circuit role can be inferred. |
| Unannotated | Bodies with no superclass assignment (about 45k). They carry a large share of synapses, so check them before drawing conclusions about any region. |

### Superclasses

| Superclass | Role |
|---|---|
| `ENS` | Enteric (gut) nervous system neurons. One body in this dataset. |
| `ascending_neuron` | Ascending neurons (AN): carry information from the VNC (limbs, wings, abdomen, sensory feedback) up to the brain. The MANC work describes them as returning information about ongoing circuit activity. |
| `cb_efferent` | Central-brain efferent neurons that send output from the brain toward the periphery or other ganglia. Few bodies; detailed role not verified. |
| `cb_endocrine` | Central-brain neurosecretory cells that release peptide hormones. Role inferred from the name. |
| `cb_intrinsic` | Central-brain interneurons: mushroom body, central complex, lateral horn and other central circuits. The largest central-brain outgoing group (about 109M synapses). |
| `cb_motor` | Central-brain neurons with motor-related output, mostly for head and mouthpart control. Role inferred, not verified. |
| `cb_sensory` | Head sensory neurons (antenna, maxillary palp, mouthparts) that project into the central brain: olfactory, gustatory and mechanosensory input. |
| `cb_sensory_tbc` | Head sensory neurons whose classification is still being checked (tbc = to be checked). |
| `descending_neuron` | Descending neurons (DN): brain-to-VNC command neurons for walking, turning, takeoff and grooming. |
| `descending_neuron_tbc` | Descending-type neurons whose classification is still being checked. |
| `efferent_ascending` | Mixed efferent and ascending group. Few bodies; role not verified. |
| `efferent_descending` | Mixed efferent and descending group. Few bodies; role not verified. |
| `ol_intrinsic` | Optic-lobe interneurons: lamina, medulla, lobula and lobula-plate circuits, including the T4/T5 motion detectors and Mi and Tm neurons. Largest optic-lobe group (about 86M outgoing synapses). |
| `ol_sensory` | Optic-lobe input neurons: photoreceptors (R1-R8) and their first targets. |
| `sensory_ascending` | Sensory neurons that enter the VNC and relay to the brain on ascending tracts. |
| `sensory_ascending_tbc` | Sensory-ascending neurons whose classification is still being checked. |
| `sensory_descending` | Sensory neurons with descending relay to the VNC. Role not verified. |
| `visual_centrifugal` | Centrifugal neurons: feedback from the central brain back into the optic lobe. |
| `visual_projection` | Visual projection neurons: carry processed optic-lobe output (motion, colour, object features) to the central brain. |
| `visual_projection_tbc` | Visual projection neurons whose classification is still being checked. |
| `vnc_efferent` | VNC efferent neurons: output from the VNC to the body or other ganglia. |
| `vnc_endocrine` | VNC neurosecretory cells. |
| `vnc_intrinsic` | VNC interneurons: local motor-circuit neurons that process descending input before it reaches motor neurons. Second-largest VNC outgoing group (about 38M synapses). |
| `vnc_motor` | Motor neurons (MN): drive leg, wing and abdominal muscles. They receive input and send almost no synapses within the connectome (about 70k outgoing). |
| `vnc_sensory` | VNC sensory neurons: proprioceptive, tactile and other input from legs, wings and abdomen. |
| `vnc_sensory_tbc` | VNC sensory neurons whose classification is still being checked. |
| `vnc_tbc` | VNC neurons whose classification is still being checked. |

### Classes

| Class | Role |
|---|---|
| `ALIN` | Antennal-lobe interneurons: local olfactory circuit neurons. Role inferred from the name. |
| `ALLN` | Antennal-lobe local neurons: shape the odour code inside the antennal lobe. |
| `ALON` | Antennal-lobe other neurons. Role not verified. |
| `ALPN` | Antennal-lobe projection neurons: relay odour information from the antennal lobe to the mushroom body and lateral horn. |
| `CX` | Central-complex neurons: ellipsoid body, fan-shaped body, protocerebral bridge and noduli. They keep a heading representation and drive steering and navigation. |
| `DAN` | Dopaminergic neurons: deliver reward and punishment teaching signals to mushroom-body compartments. Each DAN type projects to one or two compartments. |
| `Kenyon_Cell` | Kenyon cells: about 2,000 per mushroom body, with sparse odour codes that support associative memory. The data holds about 4,064 in total (both hemispheres). |
| `MBON` | Mushroom-body output neurons: read out the learned valence signal. Literature describes 21 types across 15 compartments. |
| `SEZPN` | Subesophageal-zone projection neurons: taste and feeding-related central neurons. Role from general knowledge. |
| `chemosensory` | Chemosensory neurons: peripheral chemical sensing. Role inferred from the name. |
| `gustatory` | Gustatory receptor neurons: taste sensing on the mouthparts, legs and wings. |
| `hygrosensory` | Humidity-sensing neurons. |
| `mechanosensory` | Mechanosensory neurons: bristle, hair and chordotonal input for touch and hearing. |
| `mechanosensory_proprioceptive` | Proprioceptive neurons: report joint and limb position. |
| `mechanosensory_tactile` | Touch neurons from bristle and hair receptors. |
| `mechanosensory_tbc` | Mechanosensory neurons still under classification. |
| `ol_bilateral` | Optic-lobe neurons that span both sides. Role not verified. |
| `olfactory` | Olfactory receptor neurons on the antennae and palps: odour input to the antennal lobe. |
| `thermosensory` | Temperature-sensing neurons. |
| `unknown_sensory` | Sensory neurons without an assigned modality. |
| `visual` | Visual-system neurons: photoreceptors, lamina, medulla, lobula and lobula-plate cells (L1-L5, Tm, Mi, T4, T5, LC, LPLC). |

Bodies with a superclass but no class are shown as `(no class) <superclass>` in the 3D view and use the superclass description.

### Sources

- [Male CNS paper coverage (sci.news)](https://www.sci.news/biology/complete-fruit-fly-connectome-15053.html)
- [FlyEM publications (Janelia)](https://www.janelia.org/project-team/flyem/publications)
- [Optic lobe connectome (Janelia)](https://www.janelia.org/project-team/flyem/optic-lobe)
- [ON motion detection connectome (eLife)](https://elifesciences.org/articles/24394)
- [Central complex anatomy (VFB)](https://flybrain-ndb.virtualflybrain.org/docs/anatomy-diagrams/anatomy-of-the-central-complex/)
- [Central complex heading review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6320682)
- [Mushroom body architecture (Aso et al., eLife/PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4273437/)
- [MANC VNC circuits (eLife)](https://elifesciences.org/articles/96084)

The 3D view is in [malecns-3d.html](malecns-3d.html).

## 14. Neuron types: catalogue and functions

The `type` column has 11,751 distinct names on 164,506 typed bodies (of 211,577 annotated). Names come from the source naming systems and are not unique per body. Multi-name entries such as `MNad18,MNad27` are matched on the first name.

The 3D viewer shows the 80 largest types as separate groups (level "Type"). Smaller types are merged into "Other typed". Bodies without a type are shown as "Untyped".

### Families

Families are assigned by name pattern, so they are a readable grouping rather than a formal classification. Functions are taken from the sources below and from general fly neuroscience, and are marked "not verified" where the sources do not cover them.

| Family | Typed bodies | Types | Function | Sources |
|---|---:|---:|---|---|
| Neuropil-named clusters | 29,645 | 4,849 | Clusters named after the neuropil where they arborise (e.g. SMP superior medial protocerebrum, SLP superior lateral protocerebrum, AVLP/PVLP anterior/posterior ventrolateral protocerebrum). Functions are region-level and not verified per type. | - |
| T1-T5 (direction selective) | 20,799 | 12 | T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions. | [ON motion detection connectome (eLife)](https://elifesciences.org/articles/24394) |
| Medulla Tm (transmedulla) | 19,861 | 29 | Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels. | [Medulla colour and motion pathways (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4245076); [ON motion detection connectome (eLife)](https://elifesciences.org/articles/24394) |
| IN VNC interneurons | 11,780 | 2,477 | VNC interneurons. Local circuit neurons between descending input and motor neurons. | [MANC VNC circuits (eLife)](https://elifesciences.org/articles/96084) |
| Medulla Mi (intrinsic) | 9,589 | 13 | Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here. | [ON motion detection connectome (eLife)](https://elifesciences.org/articles/24394) |
| Lamina L1-L5 | 8,884 | 5 | Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles. | [ON motion detection connectome (eLife)](https://elifesciences.org/articles/24394) |
| Medulla TmY (Y-shaped transmedulla) | 8,177 | 17 | Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources. | [Medulla colour and motion pathways (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4245076) |
| Dm distal medulla | 8,175 | 21 | Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels. | [Medulla colour and motion pathways (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4245076) |
| Cm / C-type medulla | 6,676 | 41 | C-type and Cm medulla neurons. Functional roles are not verified in these sources. | - |
| Photoreceptors R1-R8 | 6,091 | 10 | Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels). | [Medulla colour and motion pathways (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4245076) |
| Other | 5,787 | 1,189 | Not classified into a known family. | - |
| CB unnamed central-brain cluster | 5,369 | 1,256 | Unnamed central-brain clusters. No functional label is assigned. | - |
| Lobula columnar LC (visual projection) | 4,253 | 48 | Lobula columnar visual projection neurons. Each type projects to a distinct optic glomerulus. Some (e.g. looming-responsive LC6) drive avoidance or approach behaviour. | [Lobula visual projection neurons (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5293491/) |
| KC Kenyon cells (mushroom body) | 4,064 | 15 | Kenyon cells: alpha/beta (KCab), gamma (KCg) and alpha'/beta' (KCa'b') subtypes. They carry sparse odour codes for associative memory. | [Mushroom body architecture (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4273437/) |
| ORN olfactory receptor neurons | 2,635 | 53 | Olfactory receptor neurons. Each type is named for the antennal-lobe glomerulus it innervates; each ORN expresses one odorant receptor. | [Antennal-lobe wiring diagram (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4930330/) |
| Central complex (FB, EB, PB, PFN, FC, hDelta) | 2,408 | 241 | Central-complex neurons. Ellipsoid-body ring neurons compute heading and action selection. Protocerebral-bridge and fan-shaped-body neurons integrate heading with motor signals. | [Central complex review (Frontiers)](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.849142/pdf) |
| AN ascending neurons | 1,849 | 556 | Ascending neurons. They carry VNC sensory and motor-circuit feedback to the brain. | [MANC VNC circuits (eLife)](https://elifesciences.org/articles/96084) |
| Li lobula intrinsic | 1,558 | 31 | Lobula intrinsic neurons. Roles not verified in these sources. | - |
| Y-type visual neurons | 1,367 | 5 | Y-type visual neurons. Roles not verified in these sources. | - |
| Gustatory receptor neurons | 1,347 | 40 | Gustatory receptor neurons. Type prefixes follow the organ (checked against `subclass`): `LB` labellar bristle, `LgLG` and `LgAG` leg bristle, `WG` wing bristle, `PhG` pharyngeal sensillum. `LgLG` is leg taste, not labellar. | - |
| DN descending neurons | 1,342 | 484 | Descending neurons. They carry brain commands to the VNC for walking, turning, takeoff and grooming. | [MANC VNC circuits (eLife)](https://elifesciences.org/articles/96084) |
| BM bristle-associated | 932 | 8 | Bristle-associated neurons, including BM_Taste. Functions are not verified in these sources. | - |
| LPLC lobula-plate/lobula complex | 417 | 4 | Lobula-plate and lobula complex neurons. Visual projection neurons; individual roles not verified here. | - |
| LN antennal-lobe local neurons | 363 | 74 | Antennal-lobe local neurons. They connect glomeruli and implement gain control of odour signals. | [Antennal-lobe wiring diagram (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4930330/) |
| DAN dopaminergic (PAM/PPL) | 358 | 34 | Dopaminergic neurons. PAM types signal reward and PPL1 types signal punishment, each targeting specific mushroom-body compartments. | [PAM and PPL1 dopaminergic neurons (eLife)](https://elifesciences.org/reviewed-preprints/91387) |
| MN motor neurons | 354 | 116 | Motor neurons. They drive leg, wing and abdominal muscles. | [MANC VNC circuits (eLife)](https://elifesciences.org/articles/96084) |
| PN antennal-lobe projection neurons | 329 | 86 | Antennal-lobe projection neurons. They relay glomerular output to the mushroom body and lateral horn. | [Antennal-lobe wiring diagram (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4930330/) |
| MBON mushroom-body output | 97 | 37 | Mushroom-body output neurons. They read out the learned valence signal from Kenyon cells. | [Mushroom body architecture (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4273437/) |

### 80 largest types

| Type | Typed bodies | Family |
|---|---:|---|
| `R1-R6` | 3,377 | Photoreceptors R1-R8 |
| `Tm3` | 2,054 | Medulla Tm (transmedulla) |
| `T3` | 1,940 | T1-T5 (direction selective) |
| `T2a` | 1,872 | T1-T5 (direction selective) |
| `L5` | 1,787 | Lamina L1-L5 |
| `L2` | 1,779 | Lamina L1-L5 |
| `C3` | 1,779 | Cm / C-type medulla |
| `T4c` | 1,778 | T1-T5 (direction selective) |
| `T1` | 1,777 | T1-T5 (direction selective) |
| `Tm1` | 1,777 | Medulla Tm (transmedulla) |
| `L1` | 1,776 | Lamina L1-L5 |
| `Mi9` | 1,775 | Medulla Mi (intrinsic) |
| `Mi1` | 1,773 | Medulla Mi (intrinsic) |
| `L3` | 1,772 | Lamina L1-L5 |
| `Mi4` | 1,772 | Medulla Mi (intrinsic) |
| `Tm9` | 1,771 | Medulla Tm (transmedulla) |
| `L4` | 1,770 | Lamina L1-L5 |
| `Tm2` | 1,766 | Medulla Tm (transmedulla) |
| `Tm20` | 1,762 | Medulla Tm (transmedulla) |
| `C2` | 1,745 | Cm / C-type medulla |
| `T5c` | 1,720 | T1-T5 (direction selective) |
| `T5b` | 1,715 | T1-T5 (direction selective) |
| `T4d` | 1,709 | T1-T5 (direction selective) |
| `T4b` | 1,690 | T1-T5 (direction selective) |
| `T4a` | 1,684 | T1-T5 (direction selective) |
| `Tm4` | 1,670 | Medulla Tm (transmedulla) |
| `T5a` | 1,664 | T1-T5 (direction selective) |
| `T2` | 1,630 | T1-T5 (direction selective) |
| `T5d` | 1,620 | T1-T5 (direction selective) |
| `Tm6` | 1,526 | Medulla Tm (transmedulla) |
| `Dm2` | 1,452 | Dm distal medulla |
| `TmY18` | 1,367 | Medulla TmY (Y-shaped transmedulla) |
| `TmY5a` | 1,364 | Medulla TmY (Y-shaped transmedulla) |
| `KCg-m` | 1,342 | KC Kenyon cells (mushroom body) |
| `Dm3a` | 1,204 | Dm distal medulla |
| `Mi15` | 1,151 | Medulla Mi (intrinsic) |
| `Dm3b` | 1,137 | Dm distal medulla |
| `Mi2` | 986 | Medulla Mi (intrinsic) |
| `Tm12` | 967 | Medulla Tm (transmedulla) |
| `Mi13` | 910 | Medulla Mi (intrinsic) |
| `Tm5Y` | 898 | Medulla Tm (transmedulla) |
| `TmY3` | 824 | Medulla TmY (Y-shaped transmedulla) |
| `Dm3c` | 787 | Dm distal medulla |
| `Tm5c` | 750 | Medulla Tm (transmedulla) |
| `BM_InOm` | 745 | BM bristle-associated |
| `KCab-s` | 657 | KC Kenyon cells (mushroom body) |
| `Y3` | 627 | Y-type visual neurons |
| `Dm10` | 626 | Dm distal medulla |
| `Tm5a` | 624 | Medulla Tm (transmedulla) |
| `Dm8a` | 572 | Dm distal medulla |
| `TmY4` | 562 | Medulla TmY (Y-shaped transmedulla) |
| `Tm37` | 559 | Medulla Tm (transmedulla) |
| `TmY10` | 552 | Medulla TmY (Y-shaped transmedulla) |
| `Tm29` | 544 | Medulla Tm (transmedulla) |
| `KCab-m` | 536 | KC Kenyon cells (mushroom body) |
| `Dm8b` | 532 | Dm distal medulla |
| `Tm5b` | 522 | Medulla Tm (transmedulla) |
| `TmY9b` | 515 | Medulla TmY (Y-shaped transmedulla) |
| `LC12` | 498 | Lobula columnar LC (visual projection) |
| `KCab-c` | 488 | KC Kenyon cells (mushroom body) |
| `Dm15` | 485 | Dm distal medulla |
| `R7y` | 482 | Photoreceptors R1-R8 |
| `R8y` | 481 | Photoreceptors R1-R8 |
| `TmY14` | 477 | Medulla TmY (Y-shaped transmedulla) |
| `Cm1` | 472 | Cm / C-type medulla |
| `TmY9a` | 471 | Medulla TmY (Y-shaped transmedulla) |
| `Mi10` | 444 | Medulla Mi (intrinsic) |
| `R8_unclear` | 442 | Photoreceptors R1-R8 |
| `TmY13` | 432 | Medulla TmY (Y-shaped transmedulla) |
| `Tm39` | 426 | Medulla Tm (transmedulla) |
| `R7_unclear` | 404 | Photoreceptors R1-R8 |
| `Tm16` | 396 | Medulla Tm (transmedulla) |
| `TmY17` | 395 | Medulla TmY (Y-shaped transmedulla) |
| `Lawf2` | 383 | Neuropil-named clusters |
| `Cm2` | 383 | Cm / C-type medulla |
| `TmY21` | 372 | Medulla TmY (Y-shaped transmedulla) |
| `Lawf1` | 361 | Neuropil-named clusters |
| `LC17` | 353 | Lobula columnar LC (visual projection) |
| `TmY20` | 343 | Medulla TmY (Y-shaped transmedulla) |
| `R7p` | 332 | Photoreceptors R1-R8 |

Bodies in the other 11,671 types are visible in the viewer through the Type level's "Other typed" group and the data files.

