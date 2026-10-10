# Contract Amendment: extraction config, `formatVersion: 4` (kind `forager`)

**Amends**: `specs/008-hungry-forager-brain/contracts/extract-config-forager.md` — the canonical extraction-config
contract, which today documents only `formatVersion: 3`. This document adds `formatVersion: 4` as a new, additive
schema recognised by `config.py`'s `format_of`; `formatVersion: 3` keeps its existing meaning and reader
unchanged. No existing format is renumbered (research.md R1).

## `format_of` amendment

`format_of(config)` gains a third branch: `config["formatVersion"] == 4 and config["kind"] == "forager"` resolves
to the format-4 schema below. An unrecognised `formatVersion` (not 2, 3 or 4) stays `E-CONFIG`, message updated to
name all three.

## Schema (format 4)

All format-3 keys (`datasetRelease`, `edgeVariant`, `expect`, `transmitterSign`, `minConfidence`, `inputs`,
`outputs`, `pathways`, `flowSteps`, `budget`, `modulators`, `neuronCountRange`) are present with the shapes below.

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
| `weightRule` | yes | `"synapseCount"` \| `"postFraction"` \| `"postFractionAbsolute"` | unknown value is `E-CONFIG` |
| `minSynapses` | optional, default `1` | positive integer | edges below it are dropped before weights are computed |

## New failure codes

| Code | Raised when |
|---|---|
| `E-POOL-OVERLAP` | A body matches two declared input or output pools (today folded into `E-CONFIG` for format 3; format 4 raises it distinctly). |
| `E-ANCHOR-EMPTY` | An `anchors` filter matches no admitted body. |
| `E-TRANSMITTER-SOURCE` | `transmitterSource` names a column `dataset.py` does not provide, or the list is empty. |
| `E-PAIR-EMPTY` | A `(pathway, outputGroup)` pair in D11's grid has no candidate interneuron with a positive score. |

Every code follows the existing `ExtractError(code, message)` contract (`str() == "CODE: message"`); no file is
written when any of these (or any existing code) is raised.

## Dispatch (`__main__.py`)

`extract()` calls `extract_forager_v2` (new, `selection_forager_v2.py`-backed) when `format_of(config) == 4`,
`extract_forager` (unchanged) when `== 3`, `extract` (unchanged) when `== 2`. `report_forager_v2` prints: per-pool
counts and side balance, per-pair budget fill (one row per `(pathway, outputGroup)` pair), admission-source counts
(how many bodies admitted by each `transmitterSource` column), each output's coverage of its real admitted input,
and the self-check result — the same report shape `report_forager` already uses, extended with the pair-fill and
admission-source breakdowns D11/D10 need.

## Tests

`test_config_forager_v2.py` (formatVersion-4 dispatch, schema key presence/shape, `E-TRANSMITTER-SOURCE`/
`E-CONFIG` messages) and `test_forager_v2_failures.py` (one test per new code plus every reused code, mutating a
copy of `forager-15k-synthetic.json`) are the contract tests on the Python side, per `AGENTS.md`'s "add contract
tests on both sides" rule — the JS side of this contract is `extract/configs/forager-brain-15k.json` itself being
read successfully by the shipped reader, checked transitively by `test_container_v5.py`.
