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
  unmet: 'Text shown when the requirement is not met',   // optional
  // BUG-002: a lifecycle replaces the single render(container, model).
  mount(container, model) {      // builds the section's elements once per selected fly
    return {
      update(model) { /* writes only values that changed; creates and removes no element */ },
      dispose() { /* frees what mount created (WebGL context, animation loop, observers) */ },
    };
  },
}
```

~~`render(container, model)` draws into container; sets text with textContent.~~ (BUG-002: one `render`
per refresh rebuilt the rows and lost track of the point cloud it replaced.)

## Lifecycle (BUG-002, FR-019, FR-020)

- `mount(container, model)` runs once per selected fly. It builds the section's elements and returns a
  handle with `update` and, when the section holds resources, `dispose`. Both are optional.
- `update(model)` runs on each value update (FR-012 refresh with a new tick of the selected fly) and on
  each structural render after the mount. It writes only values that changed: text, bar widths, point
  colours. It MUST NOT create, replace or remove elements.
- `dispose()` runs exactly once per mount, before the section's element is removed. The shell calls it
  on every removal path: another fly selected, the selection cleared, the fly status `error`, an error
  in `update`, and a section dropped from the shown set. A second call does nothing.
- A structural render runs only on a structural change: a fly selected or the selection cleared, a tab
  switched, a layer switched, the set of sections changed, or the selected fly's status changed.
- An error in `mount` or `update` shows `<title>: <message>` in that section's box and is logged with
  `console.error`. After an error in `update` the section is disposed and stays in the error state until
  another fly is selected. The other sections keep updating.

- `requires.channels` is `inputs` or `outputs`. The section is mounted only when the declaration has
  at least one channel of that kind.
- `requires.signal` is a signal id. The section is mounted only when the declaration lists it.
- `requires` may be empty for a section that always applies (the action).

## Registry rules

- The registry is an ordered list. Sections are mounted in that order.
- Mounting is decided once per fly, from the fly's declaration. When the selected fly changes, the
  mounted set is recomputed.
- Each section's `mount`, `update` and `dispose` run in their own try/catch. A thrown error shows
  `<title>: <message>` in that section's container, and the other sections keep drawing. The error is
  also logged with `console.error`.

## Model

`mount(container, model)` and `update(model)` receive the `FlyStatusModel` from `data-model.md`. It must not read the
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
- BUG-002: the point cloud is created in `mount` and freed in `dispose`, so at most one WebGL context is
  alive. Its animation loop is the only path that draws it. The loop stops while the Fly pane is hidden,
  and a resize observer on the canvas resizes the drawing buffer and redraws when the pane is shown again
  or the window is resized. `update` writes the counts and restarts the loop when a neuron is fading.

**Bugfix**: 2026-10-05 — BUG-002 Section lifecycle (`mount`, `update`, `dispose`) replaces `render`.
