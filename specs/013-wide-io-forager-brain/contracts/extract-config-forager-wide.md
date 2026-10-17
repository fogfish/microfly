# Contract: Extraction config, wide-I/O class seed (format 5, `kind: "forager-wide"`, `selection: "classSeed"`)

**Owner**: `extract/malecns_brain/config.py` validates; `extract/malecns_brain/selection_class_seed.py` runs it;
`extract/configs/forager-brain-wide.json` is the shipped config.
**Amends**: [extract-config-classseed.md](../../012-class-seeded-forager-brain/contracts/extract-config-classseed.md)
(format 4). This is a sibling dispatch value, not a replacement — a format-4 config keeps extracting exactly as
that contract describes, with no behaviour change.

## Dispatch

| `formatVersion` | `kind` | `selection` | Brain | Container header `kind` |
|---|---|---|---|---|
| 2 | absent | — | small (ADR 002) | — (version 3) |
| 3 | `"forager"` | absent | forager (ADR 003) | `"forager"` |
| 4 | `"forager"` | `"classSeed"` | class-seeded forager, 11K (ADR 006) | `"forager"` |
| 5 | `"forager-wide"` | `"classSeed"` | wide-I/O forager, brain v2 (ADR 007) | `"forager-wide"` |

Any other combination stops with `E-CONFIG` naming the key. `minConfidence`, `pathways`, `flowSteps`, `budget`,
`outputAdmission` do not apply to format 5 either (inherited from format 4's exclusion) and are themselves
`E-CONFIG` if present.

## Keys (format 5)

All keys of format 4 reused verbatim: `datasetRelease`, `edgeVariant`, `expect`, `admission`, `transmitterColumn`,
`transmitterSign`, `defaultSign`, `minSynapses`, `seeds`, `fill`, `weightRule`, `neuronCountRange`,
`modulators`, `capabilities`. Changed or new:

| Key | Type | Rule |
|---|---|---|
| `kind` | `"forager-wide"` | Required; selects this dispatch row together with `formatVersion: 5`. |
| `inputs` | object | Six bilateral channel pairs (twelve ids), each `{ class, rootSide, pair, types?/subclasses?/typePrefixes?, entryNerves?, excludeReceptorTypes? }` (D15). A filter matching no admitted body is `E-POOL-EMPTY`, as format 4. |
| `inputs[cid].pair` | string | Required in format 5. Groups the id with its L/R sibling for side matching and for `fidelity.checks`. One of `"odour-food"`, `"odour-danger"`, `"heat"`, `"taste-mouth"`, `"taste-leg"`, `"touch"`. |
| `inputs[cid].entryNerves` | string[] | Optional. A body matches only if its (newly carried) `entryNerve` column value is in this list. Absent means no filter. |
| `inputs[cid].excludeReceptorTypes` | string[] | Optional. A body is excluded from the pool if its `receptorType` is in this list. Absent means no filter. |
| `sideMatch` | `{ [pair]: boolean }` | Keyed by every declared `pair` (six keys), **not** by `class`/pathway as in format 4. A pair not declared `true` keeps both sides as filtered, unmatched. |
| `outputs` | object | ADR 006's five plus `escape`: `{ "types": ["DNp01"], "drive": "escape" }`. Declaring `DNp01` an output drops its outgoing edges, exactly as any other declared output (ADR 003 D2). |
| `fidelity` | object | `require` (boolean), `steps` (integer), `checks` (array, below) — **replaces** format 4's `minContrastFraction` with a declared check list. |
| `seeds[]` `{ "partnersOf": "outputs" }` | object | Optional, at most once (ADR 009 D24). Seeds every admitted body with an edge of at least `minSynapses` onto an output pool body, minus input/output pool bodies and `fill`'s exclusions. Any other value or extra key is `E-CONFIG`; matching no body is `E-SEED-EMPTY`. Format 4 rejects it (`needs exactly one of class or superclass`). |
| `fidelity.checks[]` | array | Each entry is `{ "kind": "contrast", "pair": <pair>, "minFraction": <number> }` or `{ "kind": "sign", "from": <pair>, "to": <outputId> }`. A `pair`/`from` naming an undeclared pair, or a `to` naming an undeclared output, is `E-CONFIG`. |

## Selection rule

Unchanged from format 4 (ADR 007 D18 — "ADR 006 D8–D12 unchanged; only the pools move"):

```text
partners  = { i : syn(i→o) ≥ minSynapses, o ∈ output pools } − pools − fill exclusions   (only with partnersOf, ADR 009)
seeds     = class seeds ∪ partners
shared(i) = Σ_{s ∈ seeds ∪ pools} [ syn(i→s) + syn(s→i) ]     over edges with syn ≥ minSynapses
fill      = top (fill.neuronCount − |seeds ∪ pools|) non-seed, non-excluded candidates by shared(i),
            ties on ascending bodyId
brain     = induced subgraph on (seeds ∪ pools ∪ fill), every output's outgoing edges dropped
```

`admission: "allTraced"` is required, exactly as format 4; `entryNerve` is read from the dataset's annotation
columns (new: `dataset.FORAGER_ANNOTATION_COLUMNS` gains `entryNerve`) wherever a declared filter needs it.

## Side matching (D15)

For each declared `pair` whose `sideMatch[pair]` is `true`: per shared `type`, keep the first
`min(|L body list|, |R body list|)` bodies on each side, by ascending `bodyId` — the same rule as format 4's
`_match_sides`, grouped by `pair` instead of by `class`. A pair that does not resolve to exactly one left and one
right channel id is `E-PAIR`. A pair whose `sideMatch` entry is `true` but ends up empty on either side after
matching is `E-SIDE-IMBALANCE`, as format 4.

`taste-mouth` and `taste-leg` are **not** side-matched (`sideMatch["taste-mouth"]: false`,
`sideMatch["taste-leg"]: false`): their populations are not drawn down to a matched size, since reconstruction bias
(ADR 003 D1) does not apply the same way to gustatory bristles as to olfactory receptor neurons (ADR 007 D15).

## Fidelity probe (`fidelity`)

Run after selection, before the container is written, over the whole admitted thresholded graph and over the
selected brain, outputs as sinks (D13's rule, unchanged):

```text
A = signed, normalised weights (postFractionAbsolute) on graph G
x₀(cid) = 1/|pool(cid)| on each individual declared input channel's own body list (not merged by pair)
r(cid) = Σ_{t=1..fidelity.steps} Aᵗ x₀(cid)
table[cid][outputId] = { brain: mean of r(cid) over outputId's pool on the brain graph,
                          wholeGraph: ... on the whole thresholded graph }
```

The **full table** (twelve input channel ids × six outputs, both graphs) is always computed, printed and stored —
nothing in it gates extraction by default.

Each declared `fidelity.checks[]` entry additionally computes, from the **pair**-level pools (the L/R split, or the
merged L+R pool):

- **`contrast`** (`pair`, `minFraction`): `(pairL→turn-left − pairL→turn-right) − (pairR→turn-left −
  pairR→turn-right)` must share the whole graph's sign and be ≥ `minFraction` of its magnitude. Generalises format
  4's single steering check to any declared pair.
- **`sign`** (`from`, `to`): the merged pool's mean value into output `to` must share the sign of the same value on
  the whole graph. Generalises format 4's single feeding check to any declared pair/output.

When `fidelity.require` is `true`, any failing check is `E-FIDELITY`, naming the check and both compared values,
and no file is written. When `false`, every check and the full table are still computed and stored; a failing
check is reported as a finding (ADR 007 D19: "Not gated, but reported: danger contrast ..., leg contrast ..., and
every pair → escape"), never hidden.

## Output (per run)

As format 4, plus: the full twelve-channel × six-output table, and one pass/fail/value result per declared
`fidelity.checks[]` entry (replacing the fixed two-check result).

## Failure codes

| Code | Condition |
|---|---|
| `E-PAIR` | A side-matched or probe-checked `pair` does not resolve to exactly one left and one right channel id. |
| `E-FIDELITY` | `fidelity.require` is true and any declared check fails. Names the check and both compared values. |
| `E-CONFIG` | Invalid key, value, dispatch combination, a flow-strategy-only key present, or a `fidelity.checks` entry naming an undeclared pair/output. |

Every format-4 code still applies unchanged: `E-SEED-EMPTY`, `E-SEED-OVERFLOW`, `E-TRANSMITTER-COLUMN`,
`E-POOL-EMPTY`, `E-SIDE-IMBALANCE`, `E-OUTPUT-UNREACHED`, `E-NODE-RANGE`, `E-MODULATOR`, `E-NONDETERMINISTIC`,
`E-DATASET-MISSING`, `E-DATASET-ROWS`, `E-DUP-BODY`, `E-DUP-EDGE`, `E-OVERFLOW`.

## Shipped config

- `extract/configs/forager-brain-wide.json`: the ADR 007 D20 config for MaleCNS v1.0 with ADR 009's
  `{ "partnersOf": "outputs" }` seed and `fill.neuronCount: 14500` (`neuronCountRange` [14000, 15000]; it was
  11000 before ADR 009), `minSynapses: 5`, `fidelity.require: true` on the six D19-listed checks. Its output is
  `public/brains/forager-brain-wide.brain`.
- `extract/configs/forager-brain-11k.json` and every earlier config keep producing byte-identical output (spec
  SC-002) — this contract adds a dispatch branch, it does not touch the existing ones.
