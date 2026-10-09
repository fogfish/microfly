# Contract amendment: `pathwayBias` (extract-config-forager, format 3)

**Amends in place**: [`specs/008-hungry-forager-brain/contracts/extract-config-forager.md`](../../008-hungry-forager-brain/contracts/extract-config-forager.md),
the living contract document. This file is the Phase 1 design artifact for `012-pathway-aware-selection`; its
content is merged into the document above during implementation, not kept as a second, competing contract.

**Not a dispatch change**: still `formatVersion: 3`, `kind: "forager"` → container version 4 (ADR 005 D4′
precedent: an additive key inside the existing format, not a new (`formatVersion`, `kind`) pair).

## New key

| Key | Type | Rule |
|---|---|---|
| `pathwayBias` | list of objects | Each object: `id` (string, `[a-z][a-z0-9-]*`, unique within the list), `pathway` (must be a key of `pathways`), `intoOutput` (must be a key of `outputs`). May be empty. |

**P1**: An empty `pathwayBias` list MUST produce selection output byte-identical (apart from
`provenance.createdAt`) to the same config with the key omitted conceptually — i.e. to this feature's own
pre-existence behaviour.

**P2**: For each declared rule, "inhibitory in-edge into `intoOutput`" means: an edge whose presynaptic body's
dataset-resolved `sign` (the same field `transmitterSign`/`minConfidence` already resolve for every admitted body)
is `-1`, and whose postsynaptic body is a member of the `intoOutput` pool.

**P3**: A rule's path strength MUST only ever raise, never lower, the ranking score its own `pathway`'s candidates
already have under the existing D3 rule — a candidate with zero forward reachability from `pathway`'s seeds MUST
NOT become admissible through `pathwayBias` alone.

**P4**: `pathwayBias` MUST NOT change `budget`, `weightRule`, `transmitterSign`, or `outputAdmission` behaviour,
and MUST NOT change the number of interneurons admitted per pathway budget — only which bodies occupy the ranked
slots.

**P5**: `pathway` or `intoOutput` naming an id absent from the config's own `pathways`/`outputs` keys is
`E-CONFIG`, naming the offending id — the same failure code `pathways.{pathway}` and `modulators[*].targets`
already use for this class of error, not a new code.

## Updated key table row (shipped config)

- `extract/configs/forager-brain.json` declares one rule: `{"id": "taste-forward-brake", "pathway": "taste",
  "intoOutput": "forward"}` — the taste-to-forward inhibitory brake (ADR 003 D3′; the "slow down and eat" circuit
  flagged as open future work in `010-output-pool-synaptic-scale`'s spec and ADR 004's open questions).

## Updated report (per run)

The extractor's printed report (`report_forager`, `__main__.py`) gains one line per declared `pathwayBias` rule:
how many admitted interneurons it boosted, and how many of those would not have been admitted by plain
reachability alone (data-model.md's `boosted`/`admittedOnlyByRule`).

## Failure codes

No new code. `E-CONFIG` now also covers an undeclared `pathway`/`intoOutput` id or a malformed/duplicate
`pathwayBias[*].id`, alongside its existing uses.
