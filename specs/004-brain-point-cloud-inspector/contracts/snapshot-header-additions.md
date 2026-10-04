# Contract: Snapshot Header Additions (position and superclass)

**Amends**: [specs/003-malecns-brain-extractor/contracts/snapshot-format.md](../../003-malecns-brain-extractor/contracts/snapshot-format.md). This document is the amendment that the constitution requires in the same change (Development Workflow, Documentation). Once the change lands, the 003 contract MUST reference this section in its Header part.

**Format version**: unchanged (2). The additions are optional header fields, allowed within version 2 by the 003 contract.

## Added fields

```jsonc
{
  "provenance": {
    // ...existing fields...
    "positionSource": "body-annotations-male-cns-v1.0-minconf-0.5.feather:somaLocation"   // optional
  },
  "neurons": [
    { "index": 0, "role": "sensory", "bodyId": 10084, "class": "ALPN", "type": "…",
      "somaSide": "R", "transmitter": "acetylcholine", "transmitterConfidence": 0.9, "sign": 1,
      "superclass": "ol_intrinsic",           // optional, string or null
      "soma": [40874, 34504, 14786] }         // optional, [int, int, int] or null
  ]
}
```

## Meaning

- `soma`: the body's soma position in the dataset's voxel coordinates. `null` when the dataset has no position for the body. Units are not physical.
- `superclass`: the body's dataset superclass. `null` when unassigned.
- `provenance.positionSource`: present when the extractor wrote `soma` values. Names the source file and column.

## Rules for readers

These extend rules 1–7 of the 003 contract. They run after rule 5 (neurons) and do not change the earlier checks.

8. If a neuron has a `soma` that is not `null` and is not an array of exactly three integers, reject with: `snapshot neuron N has a malformed soma position`, where N is the neuron index.
9. If a neuron has a `superclass` that is not `null` and not a string, reject with: `snapshot neuron N has a malformed superclass`.
10. Missing `soma` or `superclass` is allowed and means `null`. A file with no `soma` at all is a valid version 2 file, and the viewer then reports that no neuron has a position.

The Python reader (`container.py`) applies the same rules with the same messages.

## Writer rules

- The extractor writes `soma` and `superclass` for every neuron.
- A neuron with no dataset position gets `soma: null`. The extraction report counts them (`positions  N with soma, M without`).
- Determinism is unchanged: the same config and dataset give the same header, apart from `provenance.createdAt`.

## Compatibility

- The simulator's reader (`snapshot.js`) ignores fields it does not use, so it runs unchanged except for rules 8 and 9.
- Snapshots written before this change have no `soma`. They stay valid, and the inspector shows the "no position" message for them.
- The reference brain `public/brains/smallest-functional-brain.brain` is regenerated. Its body bytes must match the current file; only the header changes (checked in the quickstart).
