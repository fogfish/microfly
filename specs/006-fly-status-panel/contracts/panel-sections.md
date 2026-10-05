# Contract: Fly Status Panel Sections

The panel is a shell that mounts sections. A section draws one part of the status (the action, the
neuron map, the channel rows). New sections are added to the registry, and existing ones do not change.

## Section definition

```js
// public/js/ui/panel/registry.js
{
  id: 'channels-input',          // unique, matches /^[a-z][a-z0-9-]*$/
  title: 'Inputs',               // shown as the heading
  requires: { channels: 'inputs' },   // or { signal: 'spikes' }, or {} for always
  render(container, model) { /* draws into container; sets text with textContent */ }
}
```

- `requires.channels` is `inputs` or `outputs`. The section is mounted only when the declaration has
  at least one channel of that kind.
- `requires.signal` is a signal id. The section is mounted only when the declaration lists it.
- `requires` may be empty for a section that always applies (the action).

## Registry rules

- The registry is an ordered list. Sections are mounted in that order.
- Mounting is decided once per fly, from the fly's declaration. When the selected fly changes, the
  mounted set is recomputed.
- Each section runs in its own try/catch. A thrown error shows
  `<title>: <message>` in that section's container, and the other sections keep drawing. The error is
  also logged with `console.error`.

## Model

`render(container, model)` receives the `FlyStatusModel` from `data-model.md`. It must not read the
fly record or the worker directly, so that a section can be tested with a plain model object.

## Initial sections

| id | title | requires | Content |
|---|---|---|---|
| `action` | Action | (none) | The action label. |
| `neuron-map` | Brain activity | `signal: spikes` | The three.js point cloud and the counts (neuron count, active count). |
| `channels-input` | Inputs | `channels: inputs` | One row per input, grouped under L and R (see below). |
| `channels-output` | Outputs | `channels: outputs` | One row per output, grouped under L and R. |

## Channel rows

Within a channel section, rows are grouped by side. A channel with `side: "both"` appears under both
L and R. Each row shows:

- the label (text),
- a bar, whose width is the value clamped to the declared range, as a fraction of it,
- the numeric value, to two decimal places, using the true value.

A new channel needs no code: it is a row generated from the declaration.

## Neuron map

- Mounted only with `signal: spikes`. Without it, the section shows
  `This brain exposes no spike signal` in place of the point cloud.
- Baseline flies (no brain) have no `spikes` signal, so the map shows that message and the Action and
  Outputs sections still work (FR-011).
- The point cloud is three.js. It shows every neuron of the selected brain. The brightness of each
  neuron follows the envelope in `data-model.md`. Silent neurons stay at the base brightness.
- The map updates on animation frames only while some neuron is still fading. When every neuron is at
  base brightness, it stops redrawing.
