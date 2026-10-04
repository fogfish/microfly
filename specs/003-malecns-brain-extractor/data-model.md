# Data Model: MaleCNS Smallest Brain Extractor

**Feature**: `003-malecns-brain-extractor` | **Date**: 2026-10-04

Names follow malecns.md (`bodyId`, `class`, `superclass`, `somaSide`, `status`, `predicted_nt`). Where the Python tool and the browser hold the same entity, the field names match across both. Byte layout is in [contracts/snapshot-format.md](contracts/snapshot-format.md).

## ExtractionConfig

Input file, one per brain. Keys are exactly ADR 002 D8 (see [contracts/extract-config.md](contracts/extract-config.md)).

| Field | Type | Rule |
|-------|------|------|
| `formatVersion` | integer | Must be `2` (the container version, R1). |
| `datasetRelease` | string | Must be `male-cns-v1.0` for v1.0 files. |
| `edgeVariant` | string | Must be `traced-only`. |
| `expect.annotationRows`, `expect.edgeRows`, `expect.neurotransmitterRows` | integers | Must match the file row counts (E-DATASET-ROWS). |
| `sensory.class`, `sensory.status` | string | `ALPN`, `Traced` (D1). |
| `readouts.superclass`, `readouts.status`, `readouts.somaSides` | string, string, `["L","R"]` | `descending_neuron`, `Traced` (D2). |
| `transmitterSign` | map | `acetylcholine` → 1, `gaba` → −1, `glutamate` → −1 (D4, Q1). Other values are not admitted. |
| `minConfidence` | number, 0–1 | Default 0.5 (D4). |
| `synapseCap` | integer ≥ 1 | Default 5 (D5). Must be ≤ 65,535 (R12). |
| `minInterneurons`, `maxInterneurons` | integers | `0 ≤ min ≤ max`; defaults 2 and 8 (D3, D8). |
| `expectedNeuronCount` | integer or null | When set, checked (E-NODE-COUNT). |

## Dataset release (external)

| File | Columns read | Used for |
|------|--------------|----------|
| `body-annotations-…-minconf-0.5.feather` | `bodyId, class, superclass, somaSide, status` | Admission (Traced), sensory and readout selection |
| `body-neurotransmitters-….feather` | `body, predicted_nt, predicted_nt_confidence` | Sign (D4) and confidence |
| `connectome-weights-…-traced-only.feather` | `body_pre, body_post, weight` | Edges (streamed, restricted to admitted pairs) |

## AdmittedBody (in memory, extractor only)

A body that passes D1 traced status and D4 transmitter rules.

| Field | Type | Source |
|-------|------|--------|
| `bodyId` | int64 | annotations |
| `class`, `superclass`, `somaSide`, `type` | string | annotations (`type` is kept for the output) |
| `transmitter` | string | neurotransmitters `predicted_nt`, lower-cased |
| `transmitterConfidence` | float | neurotransmitters |
| `sign` | +1 or −1 | `transmitterSign` |

Invariant: no two AdmittedBody share a `bodyId` (E-DUP-BODY).

## RestrictedEdges (in memory, extractor only)

The traced-only edges whose both ends are admitted. Three parallel typed arrays `pre` (uint32), `post` (uint32), `synapses` (uint32, before the cap). Unique `(pre, post)` pairs (E-DUP-EDGE). Size: 22,082,410 rows for the full admitted set.

## SelectedBrain (in memory, extractor only)

| Field | Rule |
|-------|------|
| `sensory` | Admitted ALPN with the largest total outgoing synapses to admitted bodies. Ties → smallest `bodyId`. (D6 step 5) |
| `left`, `right` | Admitted Traced descending neurons on each side, maximising the two-hop sum from the sensory partners. Ties → smallest `bodyId`. (D6 step 6) |
| `interneurons` | D3 admitted candidates, scored `min(synapses from sensory, synapses to readouts)`, with **reserved slots** (R3): best LEFT-reacher and best RIGHT-reacher, the rest by score. Ties → ascending `bodyId`. Output ordered by ascending `bodyId`. |
| `neurons` | `[sensory, left, right, ...interneurons]` as in the container (roles fixed by position). |
| `edges` | Induced subgraph on `neurons`, from RestrictedEdges, `synapses ≥ 1`. |

Invariants: `left ≠ right`; neither readout nor sensory is repeated among interneurons; every edge has its pre and post in `neurons`; at least one interneuron reaches LEFT and one reaches RIGHT (otherwise E-NO-PATH).

## Neuron (container header entry)

| Field | Type | Notes |
|-------|------|-------|
| `index` | integer | 0 sensory, 1 left, 2 right, then interneurons by ascending `bodyId` |
| `role` | `sensory` \| `left` \| `right` \| `interneuron` | Browser checks roles 0–2 (D7) |
| `bodyId` | integer | malecns `bodyId` |
| `class`, `type`, `somaSide` | string or null | malecns labels (null when not annotated) |
| `transmitter` | string | lower-cased `predicted_nt` |
| `transmitterConfidence` | number | `predicted_nt_confidence` |
| `sign` | +1 or −1 | Dale's law sign for all outgoing edges |

## Edge (container body, per index)

Stored in CSR order (`offsets` → `targets`, `weights`, `synapses`). Logical fields:

| Field | Type | Notes |
|-------|------|-------|
| `pre` | integer | Implicit from `offsets` |
| `post` | integer | `targets[k]` |
| `synapses` | integer 1–65535 | `synapses[k]`, raw count |
| `weight` | float32 | `sign(pre) × min(synapses, synapseCap) ÷ synapseCap`, rounded to float32 |

## Snapshot header (provenance)

| Field | Type | Notes |
|-------|------|-------|
| `provenance.datasetRelease` | string | `male-cns-v1.0` |
| `provenance.edgeVariant` | string | `traced-only` |
| `provenance.minConfidence` | number | From config |
| `provenance.configHash` | string | `sha256:` of the canonical JSON of the config (sorted keys, no whitespace) |
| `provenance.toolVersion` | string | Version of `malecns_brain` |
| `provenance.createdAt` | string | RFC 3339, UTC. Excluded from the determinism check (E-NONDETERMINISTIC) |
| `synapseCap` | integer | From config (weights can be re-derived from `synapses` if the cap changes) |
| `neuronCount`, `edgeCount` | integers | Actual counts (reported on success) |
| `neurons` | array of Neuron | See above |
| `sections` | map | Byte offsets and lengths of `offsets`, `targets`, `weights`, `synapses` |

## WorldBrainConfig (browser, `flies.brain`)

| Field | Toy mode | Snapshot mode |
|-------|----------|---------------|
| `neuronCount`, `outDegree`, `inhibitoryFraction` | Used (defaults 40, 4, 0.2) | **Rejected** when `snapshot` is set |
| `snapshot` | Absent | URL of a `.brain` file, relative to the web root (required in snapshot mode) |
| `motorSmoothing` | Used | Used |
| `telemetry` | Checked against `neuronCount` | Checked against the snapshot's `neuronCount` (by the host, after the header is read) |
| `lif` | Used | Used |

## Comparison run (script output)

| Field | Notes |
|-------|-------|
| `arm` | `toy`, `nature`, `random-matched`, `baseline` |
| `seed` | From `experiment.seeds` |
| `fruitContacts` | Per fly, per seed |
| `totals` | Per arm |
| `differences` | nature − random-matched, nature − toy, and every arm − baseline |
| `readoutInput` | Two-hop input totals of each readout (from the extraction report, for context) |
