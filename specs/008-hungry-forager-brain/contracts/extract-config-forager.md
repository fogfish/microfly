# Contract: Extraction config, forager (formats 3 and 4)

**Owner**: `extract/malecns_brain/config.py` validates; `extract/configs/forager-brain.json` (format 3) and
`extract/configs/forager-brain-15k.json` (format 4) are the shipped configs. **Amends**: `extract/configs/*.json`
format 2 (ADR 002). A config without `kind` and with `formatVersion: 2` is an ADR 002 config and is handled as
today (small brain, container version 3). Format 4 (specs 013's ADR 006) is a new, additive schema; format 3 keeps
its existing meaning and reader unchanged — no existing format is renumbered (research.md R1).

## Dispatch

| `formatVersion` | `kind` | Brain | Container |
|---|---|---|---|
| 2 | absent | small (ADR 002) | version 3 |
| 3 | `"forager"` | forager (ADR 003) | version 4 |
| 4 | `"forager"` | cautious forager, 15K (ADR 006) | version 5 |

Any other pair stops with `E-CONFIG` naming the key (all three formats), and writes no file. `format_of(config)`
dispatches on the `(formatVersion, kind)` pair; `__main__.py`'s `extract()` calls `extract_forager_v2`
(`selection_forager_v2.py`-backed) for format 4, `extract_forager` (unchanged) for format 3, `extract` (unchanged)
for format 2.

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

## Keys (format 4, beyond or replacing format 3)

All format-3 keys above are present with the shapes below (format 4 has no `capabilities`/`expectedNeuronCount`/
`outputAdmission` keys — the equivalent checks move into the rows below and into D11/D12's own validation).

| Key | Required | Shape | Validated by |
|---|---|---|---|
| `transmitterSource` | yes | non-empty list of column names | every name must be a column `dataset.py` can read (`ground_truth`, `consensus_nt`, `predicted_nt`); else `E-TRANSMITTER-SOURCE` |
| `inputs` | yes | 12 entries (D8): `odour-food-{left,right}`, `odour-danger-{left,right}`, `heat-{left,right}`, `taste-mouth-{left,right}`, `taste-leg-{left,right}`, `touch-{left,right}` | each a pool filter (`class`/`type`/`subclass`/`entryNerve`) |
| `sideMatch` | yes | boolean per channel-pair name (`odour-food`, `odour-danger`, `heat`, `taste-mouth`, `taste-leg`, `touch`) | `taste-mouth`/`taste-leg` are `false`; the rest `true` |
| `outputs` | yes | 6 entries (D9) incl. `escape: { "types": ["DNp01"], "drive": "escape" }` | an output with no admitted body is `E-POOL-EMPTY` |
| `pathways` | yes | maps 6 pathway names to their 2-channel (or N-channel) input lists | used as D11's grid rows |
| `outputGroups` | yes | maps 5 group names (`turn`, `forward`, `backward`, `feed`, `escape`) to their output-channel lists | used as D11's grid columns |
| `budget.perPair` | yes | positive integer | replaces format-3's flat `budget.odour`/`budget.taste` |
| `anchors` | yes, may be `[]` | list of `{class: "..."}` (or other whole-population filters) | a filter matching no body is `E-ANCHOR-EMPTY` |
| `excludeInterneuronClasses` | yes, may be `[]` | list of class names | applied whole-or-none |
| `excludeInterneuronSuperclassSuffix` | optional | string suffix | e.g. `"_sensory"` |
| `weightRule` | yes | `"synapseCount"` \| `"postFraction"` \| `"postFractionAbsolute"` | unknown value is `E-CONFIG`; format 4 adds `"synapseCount"` beyond format 3's two values |
| `minSynapses` | optional, default `1` | positive integer | edges below it are dropped before weights are computed |

## Output (per run)

The extractor prints a report with, per pool and per output: count, side balance (odour), edges into each output, weight
min and max, and the self-check result. Written as `extract/configs/`'s report style (ADR 002). **(format 4)**
`report_forager_v2` extends this with per-pair budget fill (one row per `(pathway, outputGroup)` pair) and
admission-source counts (how many bodies admitted by each `transmitterSource` column).

## Failure codes

| Code | Condition |
|---|---|
| `E-CONFIG` | Invalid key, value, dispatch pair or C1 mismatch (C1 applies to format 3 only). |
| `E-POOL-EMPTY` | An input or output pool matches no admitted body (no Traced body for outputs). |
| `E-SIDE-IMBALANCE` | After side matching, an L/R pair differs in size, or a side is empty. |
| `E-OUTPUT-UNREACHED` | An output pool receives no edge from the selected interneurons or inputs. |
| `E-NODE-RANGE` | The neuron count is outside `neuronCountRange`. |
| `E-MODULATOR` | A modulator targets an undeclared input, or its gain is invalid. |
| `E-DATASET-MISSING`, `E-DATASET-ROWS` | As ADR 002. |
| `E-DUP-BODY`, `E-DUP-EDGE` | As ADR 002. |
| `E-NONDETERMINISTIC` | The self-check of two runs differs. |
| `E-POOL-OVERLAP` (**format 4**) | A body matches two declared input or output pools (folded into `E-CONFIG` for format 3; format 4 raises it distinctly). |
| `E-ANCHOR-EMPTY` (**format 4**) | An `anchors` filter matches no admitted body. |
| `E-TRANSMITTER-SOURCE` (**format 4**) | `transmitterSource` names a column `dataset.py` does not provide, or the list is empty. |
| `E-PAIR-EMPTY` (**format 4**) | A `(pathway, outputGroup)` pair in D11's grid has no candidate interneuron with a positive score. |

ADR 002's `E-SIGN`, `E-OVERFLOW` and `E-NO-PATH` apply where they make sense for non-output bodies. Every code
follows the `ExtractError(code, message)` contract (`str() == "CODE: message"`); no file is written when any code
is raised.

## Shipped configs

- `extract/configs/forager-brain.json` (format 3): the ADR 003 D6 config for MaleCNS v1.0. Its output is
  `public/brains/forager-brain.brain`.
- `extract/configs/forager-brain-15k.json` (format 4): the ADR 006 L11 config for MaleCNS v1.0. Its output is
  `public/brains/forager-brain-15k.brain` (container version 5, ~15K neurons). `extract/tests/fixtures/forager-15k-synthetic.json`
  is the small, labelled synthetic fixture the format-4 unit tests run against.
- The existing `smallest-functional-brain.json` and `antennal-lobe-brain.json` keep producing version 3 files
  byte-identically (spec SC-002); `forager-brain.json` keeps producing a byte-identical version-4 file
  (apart from `provenance.createdAt`) across this feature (spec SC-002).

## Tests

`test_config_forager_v2.py` (format-4 dispatch, schema key presence/shape, `E-TRANSMITTER-SOURCE`/`E-CONFIG`
messages) and `test_forager_v2_failures.py` (one test per format-4-only code plus every reused code, mutating a
copy of `forager-15k-synthetic.json`) are format 4's contract tests on the Python side, per `AGENTS.md`'s "add
contract tests on both sides" rule — the JS side of this contract is `extract/configs/forager-brain-15k.json`
itself being read successfully by the shipped reader, checked transitively by `test_container_v5.py`.
