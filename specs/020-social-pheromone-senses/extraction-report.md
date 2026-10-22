# Extraction report: Social and Pheromone Senses

Phase 2 checkpoint (T012): the format-5 extractor additions (seed filters by `types`/`typePrefixes`,
`receptorTypes`, `song` output, channel declaration v6) are additive only. T012 re-extracted the existing
`forager-brain-mb.json` config, which sets none of the new keys, and checked that it still gives the same
bytes as the shipped `public/brains/forager-brain-mb.brain`.

## T012: byte-identical re-extraction of `forager-brain-mb.json`

```
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-mb.json --out /tmp/forager-brain-mb-reextract.brain
```

- Extractor self-check (two in-process selection runs): **identical**.
- Shipped file: 10,729,972 bytes. Re-extracted file: 10,729,972 bytes.
- CSR sections (offsets, targets, weights, synapses): byte-identical.
- Header JSON: identical apart from `provenance.createdAt` (shipped `2026-10-19T18:43:17Z`, re-extracted
  `2026-10-21T15:33:44Z`).
- Combined hash of (header minus `createdAt`) + CSR bytes: `0c6d370562fd2315baace75ccdcb52cda3d54d5f34556e68e6361b67cbdf4187`
  for both files.
- Fidelity table unchanged: contrast odour-food-a 96%, odour-food-b 90%, heat 92%, touch 80%; sign checks on
  taste-mouth and taste-leg all pass — identical to the shipped snapshot's own header.

**Result: PASS.** Format 5's new optional keys (research R4 seed types, R3 `receptorTypes`, R12 `song`) do not
change a config that declares none of them (Principle IV).

## T013–T015: `forager-brain-social.brain`

Config: `extract/configs/forager-brain-social.json`, a copy of `forager-brain-mb.json` plus the two social
senses, the social-pathway seeds and the `song` output (research R1, R4, R12).

```
cd extract && MALECNS_DIR=../data/malecns .venv/bin/python -m malecns_brain extract \
  --config configs/forager-brain-social.json --out ../public/brains/forager-brain-social.brain
```

- Extractor self-check (two in-process selection runs): **identical**.
- 15,349 neurons (seeds 11,543, fill 3,806 — the same fill size as the MB brain's, research R5), 786,427 edges,
  11,500,196 bytes.
- **Determinism (T015):** a second extraction to a temp path gives byte-identical CSR sections and an
  identical header apart from `provenance.createdAt`. Combined hash of (header minus `createdAt`) + CSR bytes:
  `d5d8451d9b77ef547997f130539f8b27aeda193b2eeed5a562b1455951f58fd4` for both runs.
- `fill.neuronCount` **15,349** = 11,543 (this config's seed+pool total) + 3,806 (the MB brain's fill size),
  bracketed by `neuronCountRange` `[14700, 15800]` (research R5).

### Per-pool counts and unknown-side drops (admission-level, before side matching)

| Pool | Dataset filter | L | R | unknown side |
|---|---|---|---|---|
| `odour-conspecific` (`ORN_DA1`) | `class=olfactory`, type | 51 | 105 | 48 |
| `odour-conspecific` (`ORN_VA1v`) | ditto | 15 | 73 | 42 |
| `odour-conspecific` (`ORN_VA1d`) | ditto | 23 | 76 | 33 |
| `odour-conspecific` total | — | **89** | **254** | 123 |
| `contact-pheromone` (`putative_ppk23`) | `class=gustatory`, `leg bristle`, `ProLN` | 37 | 34 | 0 |
| `contact-pheromone` (`putative_ppk25`) | ditto | 32 | 33 | 0 |
| `contact-pheromone` total | — | **69** | **67** | 0 |
| `taste-leg` (excludes ppk23/ppk25) | ditto, `excludeReceptorTypes` | 80 | 84 | 0 |

These raw counts match research.md §0.1 exactly (independently re-measured here with `admit_all_traced` on the
social config). Unknown-side bodies (ORNs only; the front-leg GRNs carry no unknown side) are dropped by the
existing side-matching rule (D1), the same rule every other odour pair already uses.

### Per-channel counts after side matching (the shipped pools)

| Channel | Neurons | Edges in |
|---|---|---|
| `odour-conspecific-left` | 89 | 302 |
| `odour-conspecific-right` | 89 | 649 |
| `contact-pheromone-left` | 64 | 464 |
| `contact-pheromone-right` | 64 | 503 |
| `song` (output, pIP10) | 2 | 734 |

Side matching (D1) pairs bodies **per dataset `type`**, not by the pool's raw L/R total, so the matched
`contact-pheromone` count (64+64=128) is below the naive `min(69,67)=67`-per-side estimate: a few of the many
distinct leg-bristle GRN types behind `putative_ppk23`/`putative_ppk25` have no partner on the other side and
are dropped, the same rule that already trims `taste-leg` and `touch`.

### Seed filters: bodies added (research R4)

The two new `seeds[]` filters add **295** bodies with origin `seed:type`:

| Filter | Dataset types matched | Bodies |
|---|---|---|
| `{"typePrefixes": ["pC1_","mAL4","mAL5","mAL6","mAL_"]}` | 70 pC1 types + 29 mAL types | 148 (pC1) + 141 (mAL) = 289 |
| `{"types": ["AN09B017e","AN09B017f","AN09B017g","pIP10"]}` | vAB3 (3 types) + pIP10 | 6 (vAB3) + 2 (pIP10, as the `song` output, not a seed) |

- **mAL: 141 of 141** dataset-annotated mAL bodies (research §0.2) — full coverage.
- **vAB3: 6 of 6** (`AN09B017e`/`f`/`g`) — full coverage.
- **pC1: 148 of 156** dataset-annotated pC1 bodies (research §0.2). The gap (8 bodies) is admission attrition
  (not every annotated pC1 body carries `status=Traced` at `minConfidence`), not a selection choice.
- **pIP10: 2 of 2**, both now output-pool (`song`) members, so they are not counted among `seed:type` origins
  (D2: declaring a type an output, not a seed, is this ADR's choice for the song DN, research R12).

### Share of the MB brain's neurons kept, and the `taste-leg` diff (SC-001)

- The social cut keeps **14,308 of the MB brain's 14,500 `bodyId`s (98.7%)**. The other 1.3% is displaced by
  the new seeds' claim on fill (D9 re-ranks by shared weight with a larger seed set), the expected effect of
  R5's "fill the same size, but on the larger seed set" rule.
- **`taste-leg` `bodyId` set diff against `forager-brain-mb.brain`: empty.** Both the left and right pools are
  identical, body for body, to the MB brain's (164 bodies total, 80 L / 84 R) — FR-004/FR-018 and D16 hold
  unchanged.
- **No `putative_ppk23`/`putative_ppk25` body is in `taste-leg`**, and **no receptor type other than
  `putative_ppk23`/`putative_ppk25` is in `contact-pheromone`** (guaranteed by construction: the two filters are
  exact complements on the same `leg bristle`/`ProLN` declared set, R1). The two pools are disjoint (zero
  shared `bodyId`s, checked by the resolved `E-POOL-OVERLAP` rule, R3) and together cover the same 300-body
  front-leg GRN population ADR 007 D16 measured.

### Fidelity (full detail in `fidelity.md`, T020)

Every pre-existing check still passes at essentially the same fraction as the MB brain (odour-food-a 98%,
odour-food-b 91%, heat 93%, touch 81%; the taste-mouth/taste-leg sign checks hold). The two new checks:

| Pair | Brain contrast | Whole-graph contrast | Fraction | Result |
|---|---|---|---|---|
| `odour-conspecific` | +8.80e-07 | +1.06e-06 | **83%** | pass |
| `contact-pheromone` | +4.41e-05 | +5.38e-05 | **82%** | pass |

Both clear the 0.1 (10%) `minFraction` gate by a wide margin — the social pathway, seeded by identity rather
than by weight-ranked fill, carries its own sensory contrast about as faithfully as food and heat do.
