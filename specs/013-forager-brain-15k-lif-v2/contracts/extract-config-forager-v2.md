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
| `ieDriftTolerance` | optional, default `{}` ([BUG-004](../bugs/BUG-004.md), FR-033) | object, L10 region name → number ≥ 0 | how far that region's selected inhibitory/excitatory synapse-count ratio may depart (absolute difference) from the same ratio over its real admitted input before `E-INHIBITION-DRIFT` stops extraction; keyed per region because the expected drift differs in kind by region (an anchored region like `al` carries a structural skew this check should not flag) — a region absent from the object is not checked. `forager-brain-15k.json` declares `{"central": 0.15, "dn": 0.15}`. |
| `inhibitoryClosure` | optional, default `{}` ([BUG-004](../bugs/BUG-004.md), FR-033) | object, L10 region name → non-negative integer budget | for that region, admits its own top-`budget` real-admitted inhibitory candidates — ranked by synapse weight already delivered into the region's *already-selected* targets, not a per-neuron or class-wide rule — unconditionally, the way D12 admits anchors. A region absent from the object gets no closure. `forager-brain-15k.json` declares `{"central": 250, "dn": 50}` (see Decision below for why, and why not `vnc`). |

## Decision: `inhibitoryClosure`'s shape and values ([BUG-004](../bugs/BUG-004.md))

Two designs were measured against the real dataset and rejected before this one:

- **A per-neuron budget** (every selected body admits its own top-k missing inhibitory inputs) was rejected:
  even `k = 1` admits ~11,000 new bodies, because almost every admitted neuron's strongest real inhibitory
  partner is a distinct body — the same fragmentation that already rules out anchoring by class for these
  regions (`al`'s dominant inhibitory class, ALLN, is 67.6% of its inhibitory weight; `central`'s is 2.7%, spread
  across hundreds of optic-lobe cell types).
- **A single global top-k hub budget** (one ranking across every region) was rejected: regions need wildly
  different budgets to reach their own real ratio — `vnc` overshoots past a 200-neuron global budget while
  `output` is still under-corrected at 500 — so one shared ranking over- and under-shoots different regions at
  once.

The shipped values (`{"central": 250, "dn": 50}`) were found by tuning each region's own budget against the real
dataset (selection only, no re-simulation needed per trial) until its selected ratio sat close to its real
baseline, then re-running the full extraction and `npm test`:

- **`vnc` gets no budget.** Measured with zero closure: selected `0.904` vs. real-admitted `0.735` — already on
  the *over*-inhibited side, unlike `central`/`dn`. `vnc`'s own pre/post-A4 comparison in BUG-004 was the
  smallest of the four scored regions (`0.92 → 0.90`); this measurement confirms it was never actually broken by
  A4, and closure only pushes it further from its real baseline (`0.904 → 1.034` at budget 50).
- **`central: 250`** lands at selected `0.633` vs. real `0.637` (drift `0.004`).
- **`dn: 50`** lands at selected `0.687` vs. real `0.665` (drift `0.022`). `dn: 100` was tried first (drift
  `0.008`, marginally tighter) but broke a real-brain wiring test
  (`tests/forager-v2-brake.test.mjs`: leg taste on one side very slightly lowered `backward` drive below its
  no-taste baseline) — `dn`'s closure candidates overlap the circuitry feeding `backward` (MDN) closely enough
  that a too-large budget there measurably changes it. `dn: 50` keeps that test passing with still-small drift.
- **`al`/`input`/`output` get no closure and no declared tolerance**: `al`'s gap is D12's anchor mechanism, not
  this bug; `output`'s own net sign is already guaranteed by `E-OUTPUT-SIGN`/FR-032, and its I/E-ratio gap, while
  real (reported in `inhibitionCoverage`), is out of this fix's declared scope.

## New failure codes

| Code | Raised when |
|---|---|
| `E-POOL-OVERLAP` | A body matches two declared input or output pools (today folded into `E-CONFIG` for format 3; format 4 raises it distinctly). |
| `E-ANCHOR-EMPTY` | An `anchors` filter matches no admitted body. |
| `E-TRANSMITTER-SOURCE` | `transmitterSource` names a column `dataset.py` does not provide, or the list is empty. |
| `E-PAIR-EMPTY` | A `(pathway, outputGroup)` pair in D11's grid has no candidate interneuron with a positive score. |
| `E-OUTPUT-SIGN` | [BUG-001](../bugs/BUG-001.md), FR-032: an output pool's net admitted synaptic weight per neuron (signed sum of D13's weights) is not positive. Documented here as part of this amendment; the code itself predates this document update. |
| `E-INHIBITION-DRIFT` | [BUG-004](../bugs/BUG-004.md), FR-033: an L10 region's selected inhibitory/excitatory synapse-count ratio departs from the same ratio over that region's real admitted input (computed before D11 narrows anything) by more than `ieDriftTolerance`. |

Every code follows the existing `ExtractError(code, message)` contract (`str() == "CODE: message"`); no file is
written when any of these (or any existing code) is raised.

## Dispatch (`__main__.py`)

`extract()` calls `extract_forager_v2` (new, `selection_forager_v2.py`-backed) when `format_of(config) == 4`,
`extract_forager` (unchanged) when `== 3`, `extract` (unchanged) when `== 2`. `report_forager_v2` prints: per-pool
counts and side balance, per-pair budget fill (one row per `(pathway, outputGroup)` pair), admission-source counts
(how many bodies admitted by each `transmitterSource` column), each output's coverage of its real admitted input,
each output pool's net admitted signed weight per neuron ([BUG-001](../bugs/BUG-001.md), FR-032), each L10
region's selected vs. real-admitted inhibitory/excitatory ratio ([BUG-004](../bugs/BUG-004.md), FR-033), and the
self-check result — the same report shape `report_forager` already uses, extended with the pair-fill and
admission-source breakdowns D11/D10 need.

## Tests

`test_config_forager_v2.py` (formatVersion-4 dispatch, schema key presence/shape, `E-TRANSMITTER-SOURCE`/
`E-CONFIG` messages, including `ieDriftTolerance`/`inhibitoryClosure`'s optional-default, per-region shape and
unknown-region/non-negative checks) and `test_forager_v2_failures.py` (one test per new code plus every reused
code, mutating a copy of `forager-15k-synthetic.json`, including `E-INHIBITION-DRIFT` at a zero per-region
tolerance, a regression that a looser one does not raise, and a regression that an undeclared region is not
checked at all) are the contract tests on the Python side, per `AGENTS.md`'s "add contract tests on both sides"
rule. `test_selection_forager_v2.py` additionally checks `inhibitoryClosure` itself re-admits a specific,
previously-excluded inhibitory candidate and measurably shrinks its region's real-vs-selected drift. The JS side
of this contract is `extract/configs/forager-brain-15k.json` itself being read successfully by the shipped
reader (checked transitively by `test_container_v5.py`) and the real-brain wiring tests
(`tests/forager-v2-brake.test.mjs` et al.) passing against the re-extracted file.
