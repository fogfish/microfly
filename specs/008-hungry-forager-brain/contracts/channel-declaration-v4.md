# Contract: Channel declaration, versions 4 and 5

**Owner**: `public/js/brain/capabilities.js` and `extract/malecns_brain/capabilities.py` apply the same rules with the same
messages. **Amends**: [channel-declaration.md](../../006-fly-status-panel/contracts/channel-declaration.md) for v4 and v5
brains. The v3 rules (rules 11–18) stay for version 3 files and the toy declaration. Version 5 (specs 013's ADR
006) reuses `kind: "forager"` (research.md R2) and adds R9–R11 plus a six-value drive tuple, marked **v5** below;
R1–R8 keep their version-4 meaning for container version 4.

## Shape

```jsonc
{
  "signals": ["spikes"],
  "channels": {
    "inputs": [
      { "id": "odour-left", "label": "Odour left", "side": "L", "neurons": [ ... ], "range": [0, 1],
        "sense": "odour:food", "site": "antenna" }
    ],
    "outputs": [
      { "id": "turn-left", "label": "Turn left", "side": "L", "neurons": [ ... ], "range": [0, 1], "drive": "turnLeft" }
    ]
  }
}
```

A v4 channel has `neurons` (non-empty list of integers) in place of `neuron`. Inputs have no `drive`. **(v5)**
each input channel additionally carries `sense` and `site` (R9, R10 below); v4 channels do not have these fields
and R8's unknown-field check still rejects them on a v4-declared channel.

## Rules

- **R1** Present and an object. Message: `snapshot capabilities are missing`.
- **R2** `signals` is a list of unique strings. `channels.inputs` and `channels.outputs` are lists.
- **R3** Ids match `^[a-z][a-z0-9-]*$` and are unique across inputs and outputs.
- **R4** `label` is 1–40 characters; `side` ∈ {`L`, `R`, `both`}; `neurons` is a non-empty list of distinct integers
  with no duplicates; `range` is two finite numbers with min < max (default `[0, 1]`).
- **R5** Every index in `neurons` is ≥ 0 and below `neuronCount`. Message:
  `snapshot channel ${id} references neuron ${n} outside neuronCount`.
- **R6** No two input channels share a neuron. Message: `snapshot input channels ${a} and ${b} share neuron ${n}`.
- **R7** Drives, by `kind` (header `kind`): for `forager`, the outputs carry exactly the five drives `turnLeft`,
  `turnRight`, `forward`, `backward`, `feed`, each once. For `tank` (not produced by v4 files; reserved), `left` and
  `right`, each once. Message: `snapshot outputs must have exactly one of each forager drive`. **(v5)** a
  version-5 container validates against `FORAGER_DRIVES_V2` instead (R11 below), not this five-value check.
- **R8** No fields beyond the declaration. Inputs take `id, label, side, neurons, range`; outputs add `drive`.
  Message: `snapshot channel ${id} has unknown field ${key}`. **(v5)** a version-5 input channel additionally
  takes `sense, site` (R9, R10).

## Version 5 additions (R9–R11, ADR 006)

```python
FORAGER_DRIVES_V2 = ("turnLeft", "turnRight", "forward", "backward", "feed", "escape")
```

Used only by `validate_capabilities_v5` (Python) / `validateCapabilitiesV5` (JS). `KIND_DRIVES["forager"]` (the
5-tuple R7 uses) is **not** mutated — `validate_capabilities_v4`/`validateCapabilitiesV4` keep using it for
container version 4. `KIND_DRIVES` itself gains no new key; the version-5 validators import `FORAGER_DRIVES_V2`
directly rather than looking it up by `kind`, since `kind` no longer determines drive count on its own
(research.md R2).

- **R9 (sense declared)**: every input channel's `sense` is a non-empty string naming one of the six declared
  senses (`odour:food`, `odour:danger`, `heat`, `taste:mouth`, `taste:leg`, `touch`). Any other value fails
  validation with a message naming the channel and the value.
- **R10 (site declared)**: every input channel's `site` is a non-empty string naming one of the declared body
  sites (`antenna`, `mouth`, `front-leg`). Any other value fails the same way.
- **R11 (escape drive present once)**: exactly one output channel declares `drive: "escape"`; zero or more than
  one fails validation naming the count found. (R7's existing per-drive-once rule already covers the other five
  drives; R11 extends the same check to the sixth.)

R1–R6 (declared `neurons` list per channel/pool, no empty channel, no duplicate neuron across channels, indices
in range — see above for the full text) apply unchanged to version 5, with "the kind's vocabulary" in R7's spirit
now meaning `FORAGER_DRIVES_V2` (6 values) rather than `FORAGER_DRIVES` (5 values) for this container version.

`test_capabilities_v5.py` (Python) and `tests/capabilities-v5.test.mjs` (JS) are R9–R11's contract tests, one per
rule, plus a regression test that `validate_capabilities_v4`/`validateCapabilitiesV4` are untouched (still
enforce exactly 5 drives, reject `escape`).

## Panel and body use

- Inputs: the panel shows one row per input, with value `inputs[k]` from the history entry. The row's side is the
  declared `side`; `both` shows on both sides.
- Outputs: the panel shows one row per output, with value `outputs[k]`. The turn pair and the forward, backward and feed
  drives map to the body through their `drive` (ADR 003 W4).
- A drive value is in [0, 1] as declared by `range`; the body clamps values outside it.
- Feed is shown as an output row. The action label `Eat` comes from `feed` above threshold on a flower
  (see [world-config-forager.md](world-config-forager.md) for the threshold).
