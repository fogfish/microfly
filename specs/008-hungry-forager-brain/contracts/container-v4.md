# Contract: Brain container, version 4 (forager)

**Owner**: extractor (`extract/malecns_brain/container.py`) writes; browser (`public/js/brain/snapshot.js`) reads.
**Amends**: [snapshot-format-v3.md](../../006-fly-status-panel/contracts/snapshot-format-v3.md). Version 3 files stay
readable with their current rules.

## Binary layout

Unchanged from version 3: `"MFBR"` (4 bytes), `formatVersion` (uint32 LE, `4`), header length `H` (uint32 LE, multiple of 8),
UTF-8 JSON header padded with spaces to `H`, then four sections in order, each 4-byte aligned: `offsets` (uint32 × (N+1)),
`targets` (uint32 × E), `weights` (float32 × E), `synapses` (uint16 × E). The `sections` entry of the header gives each
section's `byteOffset` and `byteLength`, and the file ends after the last section.

## Header

| Key | Required | Rule |
|---|---|---|
| `provenance` | yes | `datasetRelease`, `edgeVariant`, `minConfidence`, `configHash` (sha256 of canonical config JSON), `toolVersion`, `createdAt`, `positionSource`. |
| `kind` | yes | `"forager"`. Any other value is rejected with `snapshot kind ... is not supported`. |
| `synapseCap` | yes | Integer 1–65535, recorded for reference. |
| `weightRule` | yes | `"postFraction"` or `"postFractionAbsolute"` (ADR 005 D4′, a backward-compatible addition). |
| `neuronCount`, `edgeCount` | yes | Equal to the array lengths. |
| `neurons` | yes | `neuronCount` entries, rule N1–N4 below. |
| `capabilities` | yes | Channel declaration v4 ([channel-declaration-v4.md](channel-declaration-v4.md)). |
| `modulators` | yes | Array, possibly empty. Rule M1–M3 below. |
| `sections` | yes | Byte table, as v3. |

## Neuron rules

- **N1** `index === position`.
- **N2** The first `n_in` entries have `role: "input"`, the next `n_out` have `role: "output"`, the rest `role: "interneuron"`,
  where `n_in` and `n_out` are the sizes of the pools in the declaration. Input and output pool neurons carry `channel`
  (the channel id); interneurons carry `channel: null`.
- **N3** `soma`, `superclass`: as v3 (`null` or valid, else `malformed` error).
- **N4** `sign` ∈ {−1, 0, 1}. An output neuron may have sign 0 (ADR 003 D2); every other neuron has sign ±1.

## Modulator rules

- **M1** Each modulator has `id` (pattern `^[a-z][a-z0-9-]*$`), a `label` (≤ 40 characters), and `targets`, a non-empty
  list of declared **input** ids.
- **M2** Either `range: [0, 1]` with `gain: [g0, g1]` (the hunger signal), or `source: <id of another modulator>` with
  `gain: [g0, g1]`. Both gain values are finite and ≥ 0.
- **M3** A modulator that targets an undeclared input, or a gain that is not two finite numbers ≥ 0, is `E-MODULATOR`
  at extraction and `modulator … ` at load.

## Sections and CSR rules

As v3: offsets start at 0, do not decrease, end at `edgeCount`; every target below `neuronCount`; every synapse count ≥ 1;
every weight finite. For version 4 the weights are, under `"postFraction"`, `sign(pre) × synapses / Σ synapses(into
post, over **selected** presynaptic neurons)` (ADR 003 D4); under `"postFractionAbsolute"`, `sign(pre) × synapses /
Σ synapses(into post, over every **admitted** presynaptic neuron with a real edge into it, selected or not)` (ADR 005
D4′). Under either rule, the absolute sum of input weights of a neuron is at most 1.

## Error messages

Messages are fixed text, so the browser and the extractor report the same problem the same way:

- `snapshot version ${v} ... this build supports 3 and 4` for an unknown version (v3 or v4 are accepted).
- `snapshot kind "${kind}" is not supported` for an unknown `kind`.
- `snapshot roles out of order: expected inputs, outputs, then interneurons` for N1/N2 violations.
- `snapshot modulator ${id} ... ` for M1–M3.
- The CSR messages of v3, unchanged.

## Version negotiation

- The reader dispatches on the version field: 3 → v3 rules, 4 → v4 rules. Both share the section code.
- A v4 file loaded by a browser build that only knows version 3 is refused with the version message (spec edge case),
  not read partly.
- A v3 file is never modified or re-labelled by the v4 code path.

## Determinism

The same config and dataset produce the same file apart from `provenance.createdAt`. Header keys are written with
sorted keys and compact separators, as v3 does.
