# Contract: Derived capability signals for provenance, fidelity and neuron origin

**Owner**: `public/js/brain/capabilities.js` derives; `public/js/ui/panel/registry.js` gates on (unchanged);
`public/js/ui/panel/provenance.js` (new section) and the brain activity view (`neuron-map` section, extended)
consume.
**Amends**: [panel-sections.md](../../006-fly-status-panel/contracts/panel-sections.md). No change to the section
lifecycle, the registry's rules, or `requires.channels`. This adds `requires.signal` values and one new section.

## Derived signals

Computed once, when a snapshot's capabilities are built from its header (after `container-v4-additions.md`'s
fields are parsed), and appended to the existing `capabilities.signals` array (rule: "Unknown ids are kept" —
this is additive, not a new array shape):

| Signal | Present when |
|---|---|
| `"provenance"` | The header has any of `minSynapses`, `selection`, `admission`. |
| `"fidelity"` | The header has `fidelity`. |
| `"origin"` | At least one neuron has a non-null `origin`. |

A brain with none of the new header/per-neuron fields (`mock`, `v0`, the shipped `v1` forager) derives none of
these three signals, so `capabilities.signals` is exactly what it is today for them (spec FR-023).

## New section: `provenance`

```js
// public/js/ui/panel/registry.js — one new entry, existing entries unchanged
{
  id: 'provenance',
  title: 'Brain provenance',
  requires: { signal: 'provenance' },   // mounted only when the derived signal is present
  mount(container, model) { /* selection strategy, admission rule, synapse threshold rows */ },
}
```

- Shown rows: `selection` (label: "Selection"), `admission` (label: "Admission"), `minSynapses` (label: "Synapse
  threshold"). A field absent from the model (because the snapshot omitted it) is not drawn as its own row —
  the section draws only the rows the model actually has, never a placeholder for a missing one.
- When `capabilities.signals` also includes `"fidelity"`, the same section shows the probe's pass/fail state
  (`fidelity.steering.pass && fidelity.fidelity.feeding.pass`) and a control that reveals the full `fidelity.table`
  (e.g. a toggle), per spec FR-021. When `"fidelity"` is absent, no fidelity row is drawn — the rest of the
  section (if `"provenance"` is present) is unaffected.
- Follows the existing lifecycle contract exactly: `mount`/`update`/`dispose`, each in its own try/catch, an
  error shown as `<title>: <message>` in the section's own box, other sections unaffected.

## Brain activity view extension (`neuron-map`, `requires: { signal: 'origin' }` unchanged gate for the view itself)

- The existing `neuron-map` section (mounted on `signal: 'spikes'`, unchanged) additionally reads each neuron's
  `origin`/`transmitter` **only when** `capabilities.signals` includes `"origin"`. When present:
  - Seed-class neurons (`origin` starting with `"seed:"`) and fill neurons (`origin === "fill"`) are visually
    distinguishable (e.g. a legend and a per-neuron colour/marker channel independent of the existing spike-
    brightness envelope, so the two encodings never collide).
  - A neuron's `transmitter`, when present, is shown on hover/selection alongside its existing identity fields
    (`bodyId`, `type`, `class`), never replacing them.
  - Pool neurons (no `origin` written, per `container-v4-additions.md`) are drawn exactly as they are drawn
    today — their existing `role`/`channel` identity already explains them.
- When `"origin"` is absent (every existing brain), the view draws exactly as it does today: no legend, no
  per-neuron origin colour, no behaviour change (spec FR-023).

## Model (`model.js`) additions

`FlyStatusModel` (from spec 006's `data-model.md`) gains, when present on the record's `capabilities`/snapshot
header:

```js
{
  provenance: { selection, admission, minSynapses } | undefined,
  fidelity: FidelityReport | undefined,
}
```

Per-neuron `origin`/`transmitter` are read directly from the snapshot's neuron table by the brain activity view
(as `soma`/`superclass` already are), not duplicated into `FlyStatusModel`.

## Rules

- A section or view extension MUST NOT read the snapshot header directly for a decision the derived signal
  already makes — always gate on `capabilities.signals`, not on "does the header have key X," so a snapshot that
  sets a field to an explicit default-equivalent value (e.g. `"admission": "allTraced"` written anyway) is
  treated identically to one that omits it, as long as the signal derivation rule above is followed consistently.
- Adding a fourth derived signal in a future brain generation needs no change to `registry.js` or the section
  lifecycle — only a new `requires.signal` value and, if needed, a new section, exactly as this contract adds
  three without touching either.

## Contract test

`tests/panel-provenance-signals.test.mjs`: given a fixture capabilities object built from (a) a header with all
three groups of fields, (b) one with none, and (c) one with only `fidelity`, asserts the exact derived
`signals` membership for each, and that `selectSections`/`unmetSections` (registry.js, unchanged) mount/skip the
`provenance` section accordingly.
