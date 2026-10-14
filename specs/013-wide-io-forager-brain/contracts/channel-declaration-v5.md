# Contract: Channel declaration, version 5 (`kind: "forager-wide"` only)

**Owner**: `public/js/brain/capabilities.js` and `extract/malecns_brain/capabilities.py` apply the same rules with
the same messages. **Amends**: [channel-declaration-v4.md](../../008-hungry-forager-brain/contracts/channel-declaration-v4.md).
The v4 rules (R1–R8) stay unchanged and **keep applying unedited to `kind: "forager"` snapshots** (the shipped v1
forager and the 11K brain). This contract adds rules that apply only when the container header's `kind` is
`"forager-wide"`; it does not touch `validateCapabilitiesV4`/`validate_capabilities_v4`.

## Shape (`kind: "forager-wide"`)

```jsonc
{
  "signals": ["spikes"],
  "channels": {
    "inputs": [
      { "id": "odour-food-left", "label": "Food odour left", "side": "L", "neurons": [ ... ], "range": [0, 1],
        "sense": "odour:food", "site": "antenna" },
      { "id": "taste-mouth-left", "label": "Mouth taste left", "side": "L", "neurons": [ ... ], "range": [0, 1],
        "sense": "taste", "site": "mouth" }
      // ... ten more input channels
    ],
    "outputs": [
      { "id": "escape", "label": "Escape", "side": "both", "neurons": [ ... ], "range": [0, 1], "drive": "escape" }
      // ... the five existing forager outputs
    ]
  }
}
```

An input channel carries two new, required fields in place of v4's five: `sense` (what world stimulus it reads)
and `site` (which body point it reads from). Outputs are unchanged in shape; only the required drive set differs
(R10 below).

## Rules

Applies R1–R6 and R8 of channel-declaration-v4.md unchanged (presence, signal uniqueness, id pattern/uniqueness,
label/side/neurons/range, neuron-index bounds, no shared input neuron). New and changed:

- **R9** Every input channel carries `sense` (a non-empty string) and `site` (a non-empty string). Message:
  `snapshot channel ${id} is malformed: sense` / `... site`.
- **R10** Drives, for `kind: "forager-wide"`: the outputs carry exactly the six drives `turnLeft`, `turnRight`,
  `forward`, `backward`, `feed`, `escape`, each once (`KIND_DRIVES["forager-wide"]`). Message: `snapshot outputs
  must have exactly one of each forager-wide drive`. (R7's existing message/rule is unchanged and still exactly
  what a `kind: "forager"` declaration is checked against.)
- **R11** No fields beyond the declaration: inputs take `id, label, side, neurons, range, sense, site`; outputs add
  `drive` as in v4. Message as R8's, naming the offending field.

## Container header dispatch

`container.py`'s `write_container`/`read_container` and `snapshot.js`'s `parseSnapshot` choose the header check by
`header.kind`:

| `kind` | Check | Drives | Binary container version |
|---|---|---|---|
| (absent) | v3 toy/baseline (`validate_capabilities`/`validateCapabilities`) | n/a | 3 |
| `"forager"` | v4 (`validate_capabilities_v4`/`validateCapabilitiesV4`) | 5 forager drives | 4 |
| `"forager-wide"` | v5 (this contract) | 6 forager-wide drives | 4 |

The binary layout (magic, section table, CSR arrays) is identical for `"forager"` and `"forager-wide"` — only the
header's declared shape and the neuron-role/sign checks (N1, N2, N4 of container-v4.md) are re-run against the v5
declaration's input/output neuron counts instead of v4's. `_check_v4_additions`/`checkPositions` (optional
`transmitter`, `origin`, `soma`, `superclass` per neuron) and the fidelity-report shape check apply unchanged to
both kinds.

## Brain-version / kind cross-check

`checkBrainVersion(brainVersion, containerVersion, kind, path)` (extended from `snapshot.js`) additionally requires
the declared `kind` to match the brain version's expected kind:

| `flies.brain.version` | Expected container version | Expected `kind` |
|---|---|---|
| `v0` | 3 | — (not checked; v3 has no `kind`) |
| `v1` | 4 | `"forager"` |
| `v2` | 4 | `"forager-wide"` |

A mismatch (either the version number or, for `v1`/`v2`, the kind) fails with the existing message shape:
`flies.brain.version "${brainVersion}" needs a version ${expected} snapshot; ${path} is version ${containerVersion}`
for a version mismatch, or `flies.brain.version "${brainVersion}" needs a "${expectedKind}" snapshot; ${path} is
kind "${kind}"` for a kind mismatch at the same container version.

## Panel and body use

Unchanged from v4 (channel-declaration-v4.md's "Panel and body use" section applies verbatim): one row per input
and per output, `drive`-named outputs map to the body, a value is clamped to its declared `range`. The panel's
rendering code takes no `kind`-specific path — it reads whatever `capabilities.channels` the loaded snapshot
declares, at whatever length (research.md R10). The only behaviour specific to `"forager-wide"` is that `escape`'s
row shows a live value regardless of `flies.body.escape.enabled`, because the LIF runner always computes every
declared output (ADR 007 D17/W10) — the panel does not know or care whether escape physics is on.
