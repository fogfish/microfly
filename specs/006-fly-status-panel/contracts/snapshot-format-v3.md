# Contract: Brain Snapshot Container (version 3)

**Amends**: [specs/003-malecns-brain-extractor/contracts/snapshot-format.md](../../003-malecns-brain-extractor/contracts/snapshot-format.md)
and [specs/004-brain-point-cloud-inspector/contracts/snapshot-header-additions.md](../../004-brain-point-cloud-inspector/contracts/snapshot-header-additions.md).
Once this change lands, the 003 contract MUST reference this document as its current version.

**Writers**: `extract/malecns_brain/container.py` (fresh extractions) and `extract/malecns_brain/migrate.py`
(header-only migration). **Readers**: `public/js/brain/snapshot.js` and `container.py` (read-back in tests).

**Reason for the bump**: version 3 adds a required `capabilities` declaration that the panel acts on.
A version 2 reader would ignore it and mislabel channels without warning, so it must reject version 2.

## Layout

Unchanged from version 2, with `formatVersion` = 3:

```text
offset 0        magic            4 bytes ASCII "MFBR"
offset 4        formatVersion    uint32, = 3
offset 8        headerLength H   uint32, a multiple of 8
offset 12       header           H bytes, UTF-8 JSON, padded with 0x20 (space)
offset 12 + H   body             offsets, targets, weights, synapses (unchanged)
```

## Header

Version 2 fields are kept. Two changes:

```jsonc
{
  "provenance": { /* unchanged, plus configHash covers the capabilities block */ },
  "synapseCap": 5,
  "neuronCount": 11,
  "edgeCount": 78,
  "capabilities": {
    "signals": ["spikes"],
    "channels": {
      "inputs": [
        { "id": "food-odour", "label": "Food odour", "side": "both", "neuron": 0, "range": [0, 1] }
      ],
      "outputs": [
        { "id": "left-motor", "label": "Left motor", "side": "L", "neuron": 1, "range": [0, 1], "drive": "left" },
        { "id": "right-motor", "label": "Right motor", "side": "R", "neuron": 2, "range": [0, 1], "drive": "right" }
      ]
    }
  },
  "neurons": [ /* unchanged */ ],
  "sections": { /* unchanged */ }
}
```

`capabilities` is required in version 3. `signals` may be empty. `channels.inputs` and
`channels.outputs` may be empty lists, but then the brain drives no fly through its outputs and the
body rules below are violated, so the reader rejects that.

## Rules for readers

Rules 1–7 of the 003 contract apply with version 3 in place of 2, in the same order. The 004
rules 8 and 9 apply after rule 5. These rules come after them:

11. `capabilities` is present and an object. Else: `snapshot capabilities are missing`.
12. `capabilities.signals` is an array of unique strings. Else: `snapshot signals are malformed`.
13. Each channel (in `inputs`, then `outputs`) has an `id` matching `^[a-z][a-z0-9-]*$`, unique
    across both lists. Else: `snapshot channel <id> has a malformed id` (or `duplicate id <id>`).
14. Each channel has a non-empty `label` of at most 40 characters, a `side` in `L`, `R`, `both`, and
    a `range` of two finite numbers with `min < max`. Else: `snapshot channel <id> is malformed: <field>`.
15. Each input has `neuron` = 0 (the only neuron the world drives). Else:
    `snapshot input channel <id> must read neuron 0`.
16. Each output has an integer `neuron` in `[0, neuronCount)`. Else:
    `snapshot output channel <id> references neuron N outside neuronCount`.
17. Each output has `drive` absent, `"left"` or `"right"`. The outputs with `drive` set are exactly
    one `left` and one `right`. Else: `snapshot outputs must have exactly one left and one right drive`.
18. Unknown signal ids are allowed and kept. Unknown channel fields are an error. Else:
    `snapshot channel <id> has unknown field <field>`.

The Python reader applies the same rules with the same messages (`extract/malecns_brain/capabilities.py`).

## Migration (version 2 → version 3)

`extract/malecns_brain/migrate.py <in.brain> <config.json> <out.brain>`:

1. Reads the version 2 file with `read_container`.
2. Takes `capabilities` from the config's `capabilities` block (validated by rules 11–18).
3. Writes version 3 with `write_container`, passing the original offsets, targets, weights and
   synapses unchanged.

**Check**: the body bytes of the output equal the body bytes of the input. The header differs only
in `capabilities`, the version, and `sections` (which move because the header is longer). The
migration test compares body bytes and fails on any difference.

## Determinism

Unchanged: the same config and dataset give the same bytes except `provenance.createdAt`. The
`capabilities` block is part of the configuration, so it is part of `configHash`.

## Compatibility

- Version 2 files are rejected: `unsupported snapshot version 2; this build supports 3`. The
  reference brain is migrated and committed as version 3.
- Fresh extractions must include the `capabilities` block in their config. A config without it is
  an error (`E-CONFIG: capabilities is required`).
