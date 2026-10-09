# Contract: Extraction config, forager (format 3)

**Owner**: `extract/malecns_brain/config.py` validates; `extract/configs/forager-brain.json` is the shipped config.
**Amends**: `extract/configs/*.json` format 2 (ADR 002). A config without `kind` and with `formatVersion: 2` is an
ADR 002 config and is handled as today (small brain, container version 3).

## Dispatch

| `formatVersion` | `kind` | Brain | Container |
|---|---|---|---|
| 2 | absent | small (ADR 002) | version 3 |
| 3 | `"forager"` | forager (ADR 003) | version 4 |

Any other pair stops with `E-CONFIG` naming the key, and writes no file.

## Keys (format 3)

| Key | Type | Rule |
|---|---|---|
| `formatVersion` | `3` | Required. |
| `kind` | `"forager"` | Required. |
| `datasetRelease` | string | `"male-cns-v1.0"`. |
| `edgeVariant` | string | `"traced-only"`. |
| `expect` | object | `annotationRows`, `edgeRows`, `neurotransmitterRows`: integers ≥ 0, checked against the Feather batches. |
| `transmitterSign` | object | `acetylcholine: 1`, `gaba: -1`, `glutamate: -1`. Values ±1. |
| `minConfidence` | number in [0, 1] | As ADR 002. |
| `inputs` | object | Keys are input ids. Each: `class`, `rootSide` (`L` \| `R`), and one of `types` (list) or `subclasses` / `typePrefixes`. |
| `sideMatch` | `{odour: bool, taste: bool}` | Matching by type, first `min(\|L\|,\|R\|)` by ascending `bodyId`. |
| `outputs` | object | Keys are output ids. Each: `types` (list), `drive` (`turnLeft`, `turnRight`, `forward`, `backward`, `feed`), and `somaSide` for turns. |
| `pathways` | `{odour: [ids], taste: [ids]}` | Input ids per pathway. Every id exists in `inputs`. |
| `flowSteps` | integer 1–20 | Steps of the flow in D3. |
| `budget` | `{odour: int, taste: int}` | Non-negative. |
| `excludeInterneuronClasses` | list of strings | Default `["olfactory", "gustatory"]`. |
| `excludeInterneuronSuperclassSuffix` | string | Default `"_sensory"`. |
| `weightRule` | `"postFraction"` \| `"postFractionAbsolute"` | Required; exactly one. `"postFraction"` normalises each neuron's input weights over its selected presynaptic neurons only (ADR 003 D4). `"postFractionAbsolute"` normalises over every real, dataset-admitted presynaptic neuron with an edge into it, selected or not (ADR 005 D4′) — a backward-compatible addition, not a redefinition. |
| `modulators` | list | Rule M1–M3 of [container-v4.md](container-v4.md). |
| `capabilities` | object | Channel declaration v4. Ids and drives are checked against `inputs` and `outputs` (rule C1 below). |
| `expectedNeuronCount` | integer or null | Exact count, or null. |
| `neuronCountRange` | `[min, max]` | Default `[2000, 6000]`. Out of range is `E-NODE-RANGE`. |
| `outputAdmission` | `"low-confidence-sign-zero"` | Required value (ADR 003 D2). |

**C1**: each input and output id in `capabilities` is a key in `inputs` or `outputs`, with the same drive; each key in
`inputs` or `outputs` appears in `capabilities`. A mismatch is `E-CONFIG`.

## Output (per run)

The extractor prints a report with, per pool and per output: count, side balance (odour), edges into each output, weight
min and max, and the self-check result. Written as `extract/configs/`'s report style (ADR 002).

## Failure codes

| Code | Condition |
|---|---|
| `E-CONFIG` | Invalid key, value, dispatch pair or C1 mismatch. |
| `E-POOL-EMPTY` | An input or output pool matches no admitted body (no Traced body for outputs). |
| `E-SIDE-IMBALANCE` | After side matching, an L/R pair differs in size, or a side is empty. |
| `E-OUTPUT-UNREACHED` | An output pool receives no edge from the selected interneurons or inputs. |
| `E-NODE-RANGE` | The neuron count is outside `neuronCountRange`. |
| `E-MODULATOR` | A modulator targets an undeclared input, or its gain is invalid. |
| `E-DATASET-MISSING`, `E-DATASET-ROWS` | As ADR 002. |
| `E-DUP-BODY`, `E-DUP-EDGE` | As ADR 002. |
| `E-NONDETERMINISTIC` | The self-check of two runs differs. |

ADR 002's `E-SIGN`, `E-OVERFLOW` and `E-NO-PATH` apply where they make sense for non-output bodies.

## Shipped configs

- `extract/configs/forager-brain.json`: the ADR 003 D6 config for MaleCNS v1.0. Its output is
  `public/brains/forager-brain.brain`.
- The existing `smallest-functional-brain.json` and `antennal-lobe-brain.json` keep producing version 3 files
  byte-identically (spec SC-002).
