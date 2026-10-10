# Contract Amendment: brain container, version 5

**Amends**: `specs/008-hungry-forager-brain/contracts/container-v4.md` — the canonical container contract, which
documents version 4's CSR layout, header and invariants. Version 5 (`FORMAT_VERSION_V5 = 5`) is a new, additive
container version; 3 and 4 keep their existing readers and files unchanged (`SUPPORTED_VERSIONS = (3, 4, 5)`).

## Header additions (beyond version 4)

| Field | Scope | Meaning |
|---|---|---|
| `channel.sense` | per input channel | Declared sense name (`odour:food`, `odour:danger`, `heat`, `taste:mouth`, `taste:leg`, `touch` — W6). |
| `channel.site` | per input channel | Declared body site (`antenna`, `mouth`, `front-leg` — W6/W7). |
| `drive` | output channels | Drive vocabulary extended to 6 values: `turnLeft`, `turnRight`, `forward`, `backward`, `feed`, `escape`. |
| `group` | per neuron | One of `input`, `output`, `al`, `vnc`, `dn`, `central` (L10's first-match rule). |
| `transmitterSource` | per neuron | Which column gave its sign: `ground_truth`, `consensus_nt`, or `predicted_nt` (D10). |
| `weightRule` | header | Accepts `"synapseCount"` (new) beside the existing `"postFraction"`/`"postFractionAbsolute"`. |
| `minSynapses` | header | Recorded for provenance (D13); not re-validated at load, same treatment as other provenance fields. |
| `anchors` | header | Recorded for provenance (D12); not re-validated at load. |

The CSR section table, offset/target/weight/synapse arrays and their invariants (offsets monotone, targets in
range, synapses ≥ 1, finite weights) are **unchanged** from version 4 — version 5 adds header/per-neuron fields
only, no new array layout.

## `_check_forager_v2` (Python, `container.py`)

Validates, beyond everything `_check_forager` (v4) already checks:

- every input channel declares a non-empty `sense` and `site`;
- every output channel's `drive` is one of the 6-value vocabulary, and `escape` appears exactly once;
- every neuron's `group` is one of the 6 named regions;
- every neuron's `transmitterSource` is one of the 3 named columns;
- `weightRule` is one of the 3 accepted values (was 2 for v4).

A violation of any of these is the same validation failure the writer already raises on a v4 invariant violation
(an assertion before the atomic write, not a new `ExtractError` code — this is an internal self-check, not a
dataset-input failure path).

## JS reader (`snapshot.js`)

`FORMAT_VERSIONS` gains `5`. `checkBrainVersion`'s map gains `v2: 5` (beside `{v0: 3, v1: 4}`). `parseSnapshot`'s
version dispatch gains a `version === 5` branch calling `checkForagerV2` (mirrors `checkForager`'s v4 checks, plus
the `group`/`transmitterSource`/`sense`/`site`/`escape` checks above) and `validateCapabilitiesV5` (see
`channel-declaration-v5.md`). The return shape (`{version, manifest, neuronCount, edgeCount, offsets, targets,
weights, synapses, capabilities}`) is unchanged; version-5 manifests additionally expose `group` and
`transmitterSource` per neuron and `sense`/`site` per input channel, read straight through from the header.

## Tests

`test_container_v5.py` (Python: write/read round-trip, every new invariant, one test per violation) and
`tests/snapshot-v5.test.mjs` (JS: parse, `checkBrainVersion`'s `v2: 5` mapping, the version-5 branch, CSR
invariants shared with v3/v4 still hold) are the contract tests on both sides.
