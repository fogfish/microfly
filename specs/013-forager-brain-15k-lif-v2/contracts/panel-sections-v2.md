# Contract Amendment: a `groups` requirement kind and the region-activity section

**Amends**: `specs/006-fly-status-panel/contracts/panel-sections.md` — the canonical panel-sections contract
(section definition, lifecycle, the `requires.channels`/`requires.signal` kinds, registry rules). This adds one
new `requires` kind and one new section; the existing `channels`/`signal` kinds, the lifecycle contract
(`mount`/`update`/`dispose`), and every existing section are unchanged.

## `requires.groups` (new requirement kind)

```js
requires: { groups: true }
```

`isRequirementMet` gains a third case: `requires.groups === true` is met only when the selected fly's declaration
carries a non-empty `groups` list (one region name per neuron — populated only for container-version-5 brains,
per `container-v5.md`). `mock`/`v0`/`v1` declarations never set `groups`, so this requirement is unmet for them
with no version check anywhere in the panel — the same capability-gating style `requires.channels`/
`requires.signal` already use.

## `region-activity` section (new)

```js
{
  id: 'region-activity',
  title: 'Region activity',
  requires: { groups: true },
  mount(container, model) { /* one row per declared region: input, output, al, vnc, dn, central */ },
}
```

- **Rows**: one per region named in the fly's declaration, in the fixed order `input`, `output`, `al`, `vnc`,
  `dn`, `central` (L10's taxonomy). Each row shows the region's label and its current activity: the fraction of
  that region's neurons that spiked within the same rolling window (`WINDOW_TICKS`) `counts.js`'s existing global
  `activeCount` already uses, computed per region instead of globally.
- **Update**: on each tick, only the changed rows' fraction and bar width are rewritten (no element
  created/removed), per the shared lifecycle contract.
- **Registration**: added to `SECTIONS` (`sections/index.js`) after `outputsSection`, so a v2 fly's panel reads
  action → neuron map → inputs → outputs → region activity.

## Diagnostic and action-label amendments (`model.js`, `action.js`)

- `model.js`'s diagnostic block reads `drives.escape` when the fly's declaration lists it (v2 only); the existing
  `drives.feed`/`forward`/`backward` reads are unchanged, and the block omits the escape line entirely for
  `v1` flies (whose `drives` object has no `escape` key).
- `action.js`'s `forageAction` gains an `"escape"` label, shown on exactly the tick a jump occurred (the fly's
  per-tick telemetry carries an `escaped: boolean` flag written by `fly-host.js`, the same pattern `eating`
  already uses for the `feed` drive); on every other tick the existing turn/forward/backward labelling applies
  unchanged.

## Tests

`tests/panel-region-activity.test.mjs`: the section mounts and renders one row per region for a fly declaration
with `groups` present; it does not mount (and the shell shows no box for it) for a declaration without `groups`
(`v0`/`v1`-shaped fixtures). A second test confirms `model.js`'s diagnostic and `action.js`'s label are unchanged
for a `v1`-shaped declaration (no `escape` key, no `"escape"` label ever emitted).
