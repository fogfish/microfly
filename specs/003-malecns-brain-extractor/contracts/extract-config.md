# Contract: Extraction Config and CLI

**Config**: a JSON file, one per brain. Exactly the keys of ADR 002 D8. Unknown keys fail with E-CONFIG. The reference config is `extract/configs/smallest-functional-brain.json`.

**CLI**: `python -m malecns_brain extract --config <file> --dataset <dir> --out <file.brain>` run from `extract/`. `--dataset` may be replaced by the environment variable `MALECNS_DIR`. The dataset path is never read from the config (Constitution III).

**Output**: the `.brain` container (see [snapshot-format.md](snapshot-format.md)), written to a temporary file and renamed atomically. On any failure, nothing is written and an existing `--out` file is left unchanged.

## Config shape

```json
{
  "formatVersion": 2,
  "datasetRelease": "male-cns-v1.0",
  "edgeVariant": "traced-only",
  "expect": {
    "annotationRows": 211577,
    "edgeRows": 25563197,
    "neurotransmitterRows": 1835518
  },
  "sensory": { "class": "ALPN", "status": "Traced" },
  "readouts": { "superclass": "descending_neuron", "status": "Traced", "somaSides": ["L", "R"] },
  "transmitterSign": { "acetylcholine": 1, "gaba": -1, "glutamate": -1 },
  "minConfidence": 0.5,
  "synapseCap": 5,
  "minInterneurons": 2,
  "maxInterneurons": 8,
  "expectedNeuronCount": null
}
```

Notes:

- `formatVersion` in the config names the container version the tool writes (2). It is not the config's own version.
- `expect` values are the malecns.md §1–§2 counts for v1.0. A different release fails with E-DATASET-ROWS until the counts are updated.
- `expectedNeuronCount` is `null` until a real run has been reported; the validation step fills it in (quickstart).

## Validation of the config (E-CONFIG)

- Every key is known and every value is in range: `minConfidence` in [0, 1]; `synapseCap` integer in [1, 65535]; `0 ≤ minInterneurons ≤ maxInterneurons`; `somaSides` is exactly `["L", "R"]`; `transmitterSign` values are in {1, −1}; `expectedNeuronCount` is null or an integer ≥ 3.
- The message names the key, for example `E-CONFIG: maxInterneurons must be ≥ minInterneurons (2)`.

## Error codes

Stable codes, printed as `E-CODE: message` on stderr, exit status 1.

| Code | Condition |
|------|-----------|
| `E-CONFIG` | Unknown key, value out of range, or malformed JSON. |
| `E-DATASET-MISSING` | A required Feather file is absent in the dataset directory. |
| `E-DATASET-ROWS` | A row count differs from `expect`. |
| `E-DUP-BODY` | A `bodyId` appears more than once in annotations, or a `body` more than once in neurotransmitters. |
| `E-DUP-EDGE` | A `(body_pre, body_post)` pair appears more than once in the traced-only edges. *(added by this plan, R12)* |
| `E-SENSORY-NONE` | No admitted ALPN with Traced status and out-synapses to admitted bodies. |
| `E-READOUT-NONE` | No admitted Traced descending neuron on one side. |
| `E-NO-PATH` | No interneuron candidate reaches LEFT, or none reaches RIGHT. |
| `E-TOO-FEW` | Fewer than `minInterneurons` interneurons selected. |
| `E-NODE-COUNT` | Selected neuron count differs from `expectedNeuronCount`. |
| `E-SIGN` | A selected body has an unmapped or low-confidence transmitter. |
| `E-EMPTY-EDGES` | No edge leaves the sensory neuron, or no edge enters LEFT or RIGHT. |
| `E-OVERFLOW` | A selected raw synapse count exceeds 65,535. *(added by this plan, R12)* |
| `E-NONDETERMINISTIC` | The self-check run differs from the first run (body bytes or header except `createdAt`). |

## Report on success

Printed to stdout, one line per item, so the `expect` and `expectedNeuronCount` values can be set from a real run:

```text
dataset        male-cns-v1.0 (traced-only)
neurons        N   (sensory 1, left 1, right 1, interneurons K)
edges          E
transmitters   acetylcholine a, gaba b, glutamate c
weights        min w_min, max w_max, synapses min s_min, max s_max
readouts       LEFT body 10118 (two-hop input 31), RIGHT body 10065 (two-hop input 906)
reserved       LEFT via body X, RIGHT via body Y
output         <path> (<bytes> bytes)
self-check     identical
```

## Exit status

- `0`: container written and self-check identical.
- `1`: any E-code above.
- `2`: usage error (bad arguments, missing dataset path).
