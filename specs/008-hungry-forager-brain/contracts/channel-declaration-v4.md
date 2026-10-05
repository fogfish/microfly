# Contract: Channel declaration, version 4

**Owner**: `public/js/brain/capabilities.js` and `extract/malecns_brain/capabilities.py` apply the same rules with the same
messages. **Amends**: [channel-declaration.md](../../006-fly-status-panel/contracts/channel-declaration.md) for v4 brains.
The v3 rules (rules 11–18) stay for version 3 files and the toy declaration.

## Shape

```jsonc
{
  "signals": ["spikes"],
  "channels": {
    "inputs": [
      { "id": "odour-left", "label": "Odour left", "side": "L", "neurons": [ ... ], "range": [0, 1] }
    ],
    "outputs": [
      { "id": "turn-left", "label": "Turn left", "side": "L", "neurons": [ ... ], "range": [0, 1], "drive": "turnLeft" }
    ]
  }
}
```

A v4 channel has `neurons` (non-empty list of integers) in place of `neuron`. Inputs have no `drive`.

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
  `right`, each once. Message: `snapshot outputs must have exactly one of each forager drive`.
- **R8** No fields beyond the declaration. Inputs take `id, label, side, neurons, range`; outputs add `drive`.
  Message: `snapshot channel ${id} has unknown field ${key}`.

## Panel and body use

- Inputs: the panel shows one row per input, with value `inputs[k]` from the history entry. The row's side is the
  declared `side`; `both` shows on both sides.
- Outputs: the panel shows one row per output, with value `outputs[k]`. The turn pair and the forward, backward and feed
  drives map to the body through their `drive` (ADR 003 W4).
- A drive value is in [0, 1] as declared by `range`; the body clamps values outside it.
- Feed is shown as an output row. The action label `Eat` comes from `feed` above threshold on a flower
  (see [world-config-forager.md](world-config-forager.md) for the threshold).
