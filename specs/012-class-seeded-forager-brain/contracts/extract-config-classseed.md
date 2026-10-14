# Contract: Extraction config, whole-class seed (format 4, `selection: "classSeed"`)

**Owner**: `extract/malecns_brain/config.py` validates; `extract/malecns_brain/selection_class_seed.py` runs it;
`extract/configs/forager-brain-11k.json` is the shipped config.
**Amends**: [extract-config-forager.md](../../008-hungry-forager-brain/contracts/extract-config-forager.md). This
is a sibling dispatch value, not a replacement — a format-3/`"forager"` config, or a format-4 config with no
`selection` key (or `selection: "forager"`), keeps extracting exactly as that contract describes.

**Amended by**: [extract-config-forager-wide.md](../../013-wide-io-forager-brain/contracts/extract-config-forager-wide.md)
(ADR 007) adds format 5 (`kind: "forager-wide"`), reusing this format's `selection: "classSeed"` rule verbatim
(D18: "ADR 006 D8–D12 unchanged; only the pools move") with a `pair`-keyed side match, two new optional input
filter keys (`entryNerves`, `excludeReceptorTypes`) and a declared `fidelity.checks` list in place of
`minContrastFraction`. A format-4 config is unaffected.

## Dispatch

| `formatVersion` | `kind` | `selection` | Brain | Container |
|---|---|---|---|---|
| 2 | absent | — | small (ADR 002) | version 3 |
| 3 | `"forager"` | absent | forager (ADR 003) | version 4 |
| 4 | `"forager"` | `"classSeed"` | class-seeded forager (ADR 006) | version 4 |

Any other combination stops with `E-CONFIG` naming the key, and writes no file (ADR 006 D14: `minConfidence`,
`pathways`, `flowSteps`, `budget`, `outputAdmission` do not apply to `classSeed` and are themselves `E-CONFIG` if
present, since they belong to the flow-ranked strategy).

## Keys (format 4, `selection: "classSeed"`)

All keys of format 3 that this strategy reuses verbatim: `datasetRelease`, `edgeVariant`, `expect`, `inputs`,
`sideMatch`, `outputs`, `modulators`, `capabilities`, `weightRule`, `neuronCountRange`. `pathways`/`flowSteps`/
`budget`/`outputAdmission`/`minConfidence` are **not** read by this strategy and are `E-CONFIG` if present.

| Key | Type | Rule |
|---|---|---|
| `selection` | `"classSeed"` | Required; the dispatch discriminator. |
| `admission` | `"allTraced"` | Required. |
| `transmitterColumn` | string | Must name a column of the neurotransmitter table (`E-TRANSMITTER-COLUMN` otherwise). |
| `transmitterSign` | object | Values ±1, e.g. `{ "gaba": -1, "glutamate": -1 }`. |
| `defaultSign` | `-1` \| `1` | Sign for every transmitter value not in `transmitterSign`. |
| `minSynapses` | integer ≥ 1 | Edges below this are dropped before scoring, selection and weights. Default `1`. |
| `seeds` | array | Each entry is `{ "class": [...] }` or `{ "superclass": [...] }` (data-model.md `SeedClassFilter`). A filter matching no traced body is `E-SEED-EMPTY`. |
| `fill` | object | `neuronCount` (integer, total brain size including seeds and pools), `excludeClasses`, `excludeSuperclassSuffix`, `excludeSuperclasses`. Seeds (+ pools) exceeding `neuronCount` is `E-SEED-OVERFLOW`. |
| `fidelity` | object | `require` (boolean), `steps` (integer, `8`), `minContrastFraction` (number). |

## Selection rule

```text
shared(i) = Σ_{s ∈ seeds ∪ pools} [ syn(i→s) + syn(s→i) ]     over edges with syn ≥ minSynapses
fill      = top (fill.neuronCount − |seeds ∪ pools|) non-seed, non-excluded candidates by shared(i),
            ties on ascending bodyId
brain     = induced subgraph on (seeds ∪ pools ∪ fill), outputs' outgoing edges dropped (ADR 003 D2)
```

No pathway, flow or per-output score is computed. `admission: "allTraced"` means every traced body not excluded
by `fill`'s exclusion rules is a fill candidate, regardless of transmitter-prediction confidence; its sign comes
from `transmitterSign`/`defaultSign` applied to the `transmitterColumn` value.

## Fidelity probe (`fidelity`)

Run after selection, before the container is written:

```text
A = signed, normalised weights (postFractionAbsolute) on graph G, outputs as sinks
x₀ = 1/|pool| on each declared input pool;  r = Σ_{t=1..fidelity.steps} Aᵗ x₀
value(pool → output) = mean of r over the output pool
G ∈ { the selected brain, the whole traced graph at ≥ minSynapses }
```

- **Steering check**: `(odour-L → turn-left − odour-L → turn-right) − (odour-R → turn-left − odour-R → turn-right)`
  has the sign of the whole-graph value and is ≥ `fidelity.minContrastFraction` of its magnitude.
- **Feeding check**: `taste → feed` has the sign of the whole-graph value.
- When `fidelity.require` is `true`, either check failing is `E-FIDELITY`, naming the check and both compared
  values, and no file is written. When `false`, the report (data-model.md `FidelityReport`) is still computed and
  stored, and a failing check is printed as a finding, not hidden.

## Output (per run)

As format 3, plus: the seed class sizes, the fill size, the synapse threshold's effect (edges before/after), and
the full fidelity table (both `value(pool → output)` numbers, per pair).

## Failure codes

| Code | Condition |
|---|---|
| `E-SEED-EMPTY` | A seed filter (`class` or `superclass`) matches no traced body. |
| `E-SEED-OVERFLOW` | The seeds, pools included, exceed `fill.neuronCount`. |
| `E-TRANSMITTER-COLUMN` | `transmitterColumn` is not a column of the neurotransmitter table. |
| `E-FIDELITY` | `fidelity.require` is true and the steering or feeding check fails. Names the check and both values. |
| `E-CONFIG` | Invalid key, value, dispatch combination, or a flow-strategy-only key present under `classSeed`. |

Every format-3 code that still applies under this strategy (`E-POOL-EMPTY`, `E-SIDE-IMBALANCE`,
`E-OUTPUT-UNREACHED`, `E-NODE-RANGE`, `E-MODULATOR`, `E-NONDETERMINISTIC`, `E-DATASET-MISSING`, `E-DATASET-ROWS`,
`E-DUP-BODY`, `E-DUP-EDGE`) is unchanged. `E-SIGN` does not occur under `allTraced` (every traced body gets a
sign).

## Shipped config

- `extract/configs/forager-brain-11k.json`: the ADR 006 D14 config for MaleCNS v1.0, `fill.neuronCount: 11000`,
  `minSynapses: 5`, `fidelity.require: true`. Its output is `public/brains/forager-brain-11k.brain`.
- `extract/configs/forager-brain.json` and the existing small-brain configs keep producing byte-identical output
  (spec SC-002) — this contract adds a dispatch branch, it does not touch the existing one.
