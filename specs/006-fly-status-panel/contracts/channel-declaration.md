# Contract: Channel and Signal Declaration

This is the developer guide for the declaration that drives the fly status panel. A brain or LIF
feature changes the declaration, and the panel shows it with no change to the panel code.

## Where a declaration lives

| Brain kind | Declared in | Written by |
|---|---|---|
| Snapshot (connectome) | `capabilities` in the snapshot header | the extract config (`"capabilities"` block) |
| Toy (random graph) | `TOY_CAPABILITIES` in `public/js/brain/capabilities.js`, or a `flies.brain.capabilities` override | the code |
| Baseline (no brain) | `BASELINE_CAPABILITIES` in the same module: outputs `left-motor` and `right-motor`, no signals | the code |

Snapshot-based and toy brains use the same shape. Rules are in `snapshot-format-v3.md` (rules 11–18).

## Adding an input channel

Example: a danger channel that senses fire.

1. Add it to the extract config (or `TOY_CAPABILITIES` for a toy brain):

   ```json
   "inputs": [
     { "id": "food-odour", "label": "Food odour", "side": "both", "neuron": 0, "range": [0, 1] },
     { "id": "danger", "label": "Danger", "side": "both", "neuron": 0, "range": [0, 1] }
   ]
   ```

2. The world must provide the value. Until it does, the channel shows the resting level.
3. No panel file changes. The channel appears as a row under its side.

Today the world drives one sensory neuron (0). A second input needs a world change that feeds it,
and that change is outside this declaration.

## Adding an output channel

Example: a second, display-only output for a neuron in the brain.

```json
"outputs": [
  { "id": "left-motor", "label": "Left motor", "side": "L", "neuron": 1, "range": [0, 1], "drive": "left" },
  { "id": "right-motor", "label": "Right motor", "side": "R", "neuron": 2, "range": [0, 1], "drive": "right" },
  { "id": "wing-motor", "label": "Wing motor", "side": "L", "neuron": 7, "range": [0, 1] }
]
```

`wing-motor` appears in the panel. It does not move the fly, because it has no `drive`.

## Adding a signal

A signal is telemetry the brain sends to the panel (for example `spikes`). To add one:

1. Add its id to `signals` in the declaration.
2. Have the worker send it in the motor message (see `worker-protocol-v2.md`), with a protocol
   version bump if the message shape changes.
3. Add a panel section that declares `requires: { signal: "<id>" }` (see `panel-sections.md`).

Until a section requires the signal, it is carried and ignored, so the declaration can be ahead of
the panel without breaking it.

## Validation

- The browser and the Python exporter apply the same rules and messages. A declaration that fails
  is an error for the snapshot (the error panel shows the id and the field, FR-009) and no fly starts
  with it.
- A toy declaration that fails is an error at boot, shown on the error panel, and the flies do not start.

## Panel behaviour for each declaration kind

| Declaration | Panel effect |
|---|---|
| Input channel | A row under its side in the Inputs group. |
| Output channel | A row under its side in the Outputs group. The row moves the fly only with `drive`. |
| Signal `spikes` | The neuron map section is shown, with brightness from spikes. |
| No `spikes` | The neuron map says that the brain exposes no spike signal. |
| `side: "both"` | The row appears under both L and R, with the same value (for example the fruit input). |
