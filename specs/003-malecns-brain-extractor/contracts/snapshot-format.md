# Contract: Brain Snapshot Container (version 2)

**File**: `*.brain`, one file per brain. Reference: `public/brains/smallest-functional-brain.brain`.

**Writers**: `extract/malecns_brain/container.py`. **Readers**: `public/js/brain/snapshot.js` (browser and Node) and `extract/malecns_brain/container.py` (read-back in tests).

**Versioning**: `formatVersion` is in the binary prefix. A reader that does not support the version rejects the file with a clear error and does not start the brain. This document replaces the JSON format of ADR 002 D7, which was not implemented. A change to any field's meaning needs a new version. Adding an optional field to the header is allowed within version 2.

## Layout

All integers and floats are little-endian.

```text
offset 0        magic            4 bytes ASCII "MFBR"
offset 4        formatVersion    uint32, = 2
offset 8        headerLength H   uint32, a multiple of 8
offset 12       header           H bytes, UTF-8 JSON, padded with 0x20 (space)
offset 12 + H   body             sections below, in this order, each starting on a 4-byte boundary
                  offsets   uint32 × (neuronCount + 1)
                  targets   uint32 × edgeCount
                  weights   float32 × edgeCount
                  synapses  uint16 × edgeCount, followed by 0–2 zero bytes to reach a 4-byte boundary
```

The file length equals `12 + H + 4·(neuronCount+1) + 4·edgeCount + 4·edgeCount + pad(2·edgeCount, 4)`. Any other length is an error.

## Header (JSON)

```jsonc
{
  "provenance": {
    "datasetRelease": "male-cns-v1.0",
    "edgeVariant": "traced-only",
    "minConfidence": 0.5,
    "configHash": "sha256:…",
    "toolVersion": "0.1.0",
    "createdAt": "2026-10-04T00:00:00Z"
  },
  "synapseCap": 5,
  "neuronCount": 10,
  "edgeCount": 40,
  "neurons": [
    { "index": 0, "role": "sensory", "bodyId": 10084, "class": "ALPN", "type": "…",
      "somaSide": "…", "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1 }
  ],
  "sections": {
    "offsets":  { "byteOffset": 0, "byteLength": 0 },
    "targets":  { "byteOffset": 0, "byteLength": 0 },
    "weights":  { "byteOffset": 0, "byteLength": 0 },
    "synapses": { "byteOffset": 0, "byteLength": 0 }
  }
}
```

`sections.*.byteOffset` is absolute, from the start of the file. The header is written with sorted keys and no insignificant whitespace, then padded with spaces to a multiple of 8 bytes. `null` is used for an unknown `class`, `type` or `somaSide`.

## Rules for readers

The browser loader (`snapshot.js`) and the Python reader both check, in this order:

1. The file is at least 12 bytes and starts with `MFBR` (else: "not a brain snapshot").
2. `formatVersion` is `2` (else: "unsupported snapshot version N; this build supports 2").
3. `H` is a multiple of 8 and `12 + H` is within the file (else: "snapshot header is truncated").
4. The header is valid UTF-8 JSON (else: "snapshot header is not valid JSON").
5. `neurons.length == neuronCount`, `neurons[i].index == i`, and `neurons[0..2]` have roles `sensory`, `left`, `right` in that order (else: "snapshot roles out of order: expected sensory, left, right").
6. Every section lies inside the file, is aligned, and its length equals the length implied by `neuronCount` and `edgeCount` (else: "snapshot section X is out of bounds").
7. `offsets` is non-decreasing, starts at 0 and ends at `edgeCount`. Every `targets[k]` is less than `neuronCount`. Every `synapses[k]` is between 1 and 65,535. Every `weights[k]` is finite (else: "snapshot CSR is inconsistent: …").

A reader never guesses past these checks.

## Determinism

For the same config and dataset, the body bytes and the header bytes are identical except `provenance.createdAt`. The extractor's self-check compares them (E-NONDETERMINISTIC).

## Weight and sign

`weights[k] = sign(pre) × min(synapses[k], synapseCap) / synapseCap`, computed in float64 and rounded to float32. The sign comes from `neurons[pre].sign`. The raw count is kept in `synapses`, so the cap can change without re-reading the dataset (ADR D5).

## Examples

- **Reference brain** (committed): about 10 neurons, about 40 edges, about 1 KB.
- **Full admitted subgraph** (benchmark only, not committed): 143,219 neurons, 22,082,410 edges, body about 221 MB (10 bytes per edge plus 4 bytes per offset).
