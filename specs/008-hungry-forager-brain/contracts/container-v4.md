# Contract: Brain container, versions 4 and 5 (forager)

**Owner**: extractor (`extract/malecns_brain/container.py`) writes; browser (`public/js/brain/snapshot.js`) reads.
**Amends**: [snapshot-format-v3.md](../../006-fly-status-panel/contracts/snapshot-format-v3.md). Version 3 files stay
readable with their current rules. Version 5 (`FORMAT_VERSION_V5 = 5`, specs 013's ADR 006) is a new, additive
container version documented inline below (marked **v5**); versions 3 and 4 keep their existing readers and files
unchanged (`SUPPORTED_VERSIONS = (3, 4, 5)`).

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
| `channel.sense` (**v5**) | per input channel | Declared sense name (`odour:food`, `odour:danger`, `heat`, `taste:mouth`, `taste:leg`, `touch` — ADR 006 W6). |
| `channel.site` (**v5**) | per input channel | Declared body site (`antenna`, `mouth`, `front-leg` — W6/W7). |
| `drive` (**v5**) | output channels | Drive vocabulary extended to 6 values: `turnLeft`, `turnRight`, `forward`, `backward`, `feed`, `escape` (v4's is the first 5 minus `escape`). |
| `group` (**v5**) | per neuron | One of `input`, `output`, `al`, `vnc`, `dn`, `central`, by L10's first-match rule. |
| `transmitterSource` (**v5**) | per neuron | Which column gave its sign: `ground_truth`, `consensus_nt`, or `predicted_nt` (D10). |
| `weightRule` (**v5**) | header | Accepts `"synapseCount"` (new) beside v4's `"postFraction"`/`"postFractionAbsolute"`. |
| `minSynapses` (**v5**) | header | Recorded for provenance (D13); not re-validated at load, same treatment as other provenance fields. |
| `anchors` (**v5**) | header | Recorded for provenance (D12); not re-validated at load. |

## Neuron rules

- **N1** `index === position`.
- **N2** The first `n_in` entries have `role: "input"`, the next `n_out` have `role: "output"`, the rest `role: "interneuron"`,
  where `n_in` and `n_out` are the sizes of the pools in the declaration. Input and output pool neurons carry `channel`
  (the channel id); interneurons carry `channel: null`.
- **N3** `soma`, `superclass`: as v3 (`null` or valid, else `malformed` error).
- **N4** `sign` ∈ {−1, 0, 1}. An output neuron may have sign 0 (ADR 003 D2); every other neuron has sign ±1.
- **N5 (v5)** every neuron's `group` is one of the 6 named regions, and every neuron's `transmitterSource` is one
  of the 3 named columns (`_check_forager_v2`, beyond everything N1–N4 already check).

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
D4′). Under either rule, the absolute sum of input weights of a neuron is at most 1. **(v5)** a third rule,
`"synapseCount"`, sets `weight(i→j) = sign(i) × synapses(i→j)` directly — no normalisation by any sum — per ADR
006 D13.

The CSR section table, offset/target/weight/synapse arrays and their invariants above are **unchanged** between
version 4 and version 5: v5 adds header/per-neuron fields only (above), no new array layout.

## Error messages

Messages are fixed text, so the browser and the extractor report the same problem the same way:

- `snapshot version ${v} ... this build supports 3, 4 and 5` for an unknown version.
- `snapshot kind "${kind}" is not supported` for an unknown `kind`.
- `snapshot roles out of order: expected inputs, outputs, then interneurons` for N1/N2 violations.
- `snapshot modulator ${id} ... ` for M1–M3.
- The CSR messages of v3, unchanged.
- **(v5)** the same validation-failure path (an assertion before the atomic write on the Python side, not a new
  `ExtractError` code) covers N5, the channel-level `sense`/`site`/`drive`/`escape` rules
  ([channel-declaration-v4.md](channel-declaration-v4.md)) and an unaccepted `weightRule`.

## Version negotiation

- The reader dispatches on the version field: 3 → v3 rules, 4 → v4 rules, 5 → v4 rules plus the v5 additions
  above (`checkForagerV2` on the JS side, `_check_forager_v2` on the Python side). All three share the section
  code.
- A v4 or v5 file loaded by a browser build that does not know its version is refused with the version message
  (spec edge case), not read partly. `checkBrainVersion`'s map is `{v0: 3, v1: 4, v2: 5}`: a `v2` world needs a
  version-5 snapshot and vice versa, named explicitly on a mismatch.
- A v3 or v4 file is never modified or re-labelled by a later version's code path.
- The reader's return shape (`{version, manifest, neuronCount, edgeCount, offsets, targets, weights, synapses,
  capabilities}`) is unchanged across all three versions; a version-5 manifest additionally exposes `group` and
  `transmitterSource` per neuron and `sense`/`site` per input channel, read straight through from the header.

## Determinism

The same config and dataset produce the same file apart from `provenance.createdAt`. Header keys are written with
sorted keys and compact separators, as v3 does. This holds for v5 exactly as for v3/v4.

## Tests

`test_container_v5.py` (Python: write/read round-trip, every new v5 invariant, one test per violation) and
`tests/snapshot-v5.test.mjs` (JS: parse, `checkBrainVersion`'s `v2: 5` mapping, the version-5 branch, CSR
invariants shared with v3/v4 still hold) are v5's contract tests on both sides, alongside v4's own
`test_container_v4.py`/`tests/snapshot-v4.test.mjs`-equivalent coverage.
