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
- `requires.groups` is `true` (specs 013's ADR 006). The section is mounted only when the selected fly's
  declaration carries a non-empty `groups` list — one region name per neuron, populated only for
  container-version-5 (`v2`) brains, per `specs/008-hungry-forager-brain/contracts/container-v4.md`'s v5
  additions. `mock`/`v0`/`v1` declarations never set `groups`, so this requirement is unmet for them with no
  version check anywhere in the panel — the same capability-gating style `requires.channels`/`requires.signal`
  already use.
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
| `region-activity` (**v2**) | Region activity | `groups: true` | One row per declared region; see below. |

## Region activity (v2 only, ADR 006 L10)

- **Rows**: one per region named in the fly's declaration, in the fixed order `input`, `output`, `al`, `vnc`,
  `dn`, `central` (L10's taxonomy). Each row shows the region's label and its current activity: the fraction of
  that region's neurons that spiked within the same rolling window (`WINDOW_TICKS`) `counts.js`'s existing global
  `activeCount` already uses, computed per region instead of globally.
- **Update**: on each tick, only the changed rows' fraction and bar width are rewritten (no element
  created/removed), per the shared lifecycle contract above.
- **Registration**: `region-activity` (`public/js/ui/panel/sections/region-activity.js`) is registered in
  `SECTIONS` (`sections/index.js`) after `channels-output`, so a `v2` fly's panel reads action → neuron map →
  inputs → outputs → region activity.
- **Tests**: `tests/panel-region-activity.test.mjs` — the section mounts and renders one row per region for a fly
  declaration with `groups` present; it does not mount (and the shell shows no box for it) for a declaration
  without `groups` (`v0`/`v1`-shaped fixtures).

## Diagnostic and action-label amendments (v2 only, `model.js`/`action.js`)

Not panel sections themselves, but the model and action-label code the `action` section (and the model every
section receives) depend on:

- `model.js`'s diagnostic block reads `drives.escape` when the fly's declaration lists it (`v2` only); the
  existing `drives.feed`/`forward`/`backward` reads are unchanged, and the block omits the escape line entirely
  for `v1` flies (whose `drives` object has no `escape` key).
- `action.js`'s `forageAction` gains an `"escape"` label, shown on exactly the tick a jump occurred (the fly's
  per-tick telemetry carries an `escaped: boolean` flag written by `fly-host.js`, the same pattern `eating`
  already uses for the `feed` drive); on every other tick the existing turn/forward/backward labelling applies
  unchanged.
- `tests/panel-region-activity.test.mjs` also confirms `model.js`'s diagnostic and `action.js`'s label are
  unchanged for a `v1`-shaped declaration (no `escape` key, no `"escape"` label ever emitted).

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
