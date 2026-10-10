# Contract Amendment: world config, `flies.brain.version: "v2"`

**Amends**: `specs/008-hungry-forager-brain/contracts/world-config-forager.md` — the canonical world-config
contract for `flies.brain`, `flies.body`, `flies.stimulus`. `flies.stimuli` (plural), `flies.body.sites` and
`flies.body.escape` are **net new** sections (confirmed absent from the codebase today); `flies.stimulus`
(singular, the v1 bilateral-odour-only shape) stays exactly as it is and is read only by `v1` worlds.

## `flies.brain` amendment

```jsonc
"brain": {
  "version": "v2",                         // new accepted value, beside "mock"/"v0"/"v1"
  "snapshot": "brains/forager-brain-15k.brain",
  "motorSmoothing": 0.02,
  "stepsPerTick": 10,
  "input": { "encoding": "poisson", "rate": [0.005, 0.15], "weight": 1.2 },   // new, L9; "current" = today's behaviour
  "lif": { /* lif-v1.js keys, incl. groupGain — lif-v1-groupgain.md */ }
}
```

`validate.js`'s `BRAIN_VERSIONS` gains `'v2'`. A `v2` brain is validated against `LIF_V1_DEFAULTS`, exactly as
`v1` already is (same core, `lif-v1.js`). `brain.input.encoding` defaults to `"current"` (today's constant-drive
behaviour, no change for any existing world); `"poisson"` requires `rate` (a `[r0, r1]` pair, `0 ≤ r0 ≤ r1 ≤ 1`)
and `weight` (a positive number).

## `flies.stimuli` (new)

```jsonc
"stimuli": {
  "odour:food":   { "from": "edibles", "reach": "byKind", "scaleBy": "stock" },
  "odour:danger": { "from": "dangers", "kinds": ["spider"], "radius": 4 },
  "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
  "taste":        { "from": "edibles", "scaleBy": "stock" },
  "touch":        { "from": "blocked" }
}
```

Declares, per sense name, which world objects produce it and how it falls off (`falloff()`, unchanged, reused for
every sense). A snapshot channel declaring a `sense` with no matching key here is a **world-start validation
error** naming the undeclared sense (FR-021) — not a silent zero. Only read for `v2` worlds; `v1` worlds keep
using `flies.stimulus` (singular) unchanged.

## `flies.body.sites` (new)

```jsonc
"body": { "sites": { "antenna": 0.5, "mouth": 0, "front-leg": 0.4 } }
```

Per-site forward offset (tiles ahead of the body centre; `front-leg` additionally offsets laterally per side, per
W7). Read by `resolveBodySites` (`body.js`) to place each input channel's sample point by its declared `site`.

## `flies.body.escape` (new)

```jsonc
"body": { "escape": { "threshold": 0.5, "distance": 1.5, "cooldown": 2 } }
```

`threshold`: the `escape` output level above which a jump triggers. `distance`: tiles moved in one tick (stops at
the first non-walkable cell). `cooldown`: seconds before another jump can trigger. Defaults match ADR 006 W8 when
the section is absent from a `v2` world; the section is meaningless (and unvalidated) for `mock`/`v0`/`v1`.

## Validation summary (`validate.js`)

| Check | Error |
|---|---|
| `brain.version` not one of `mock`/`v0`/`v1`/`v2` | named, listing all four |
| `v2` brain's snapshot container version ≠ 5 | mismatch error, same pattern as the existing `v1`-expects-4 check |
| A channel's declared `sense` absent from `flies.stimuli` | names the sense and the channel |
| `brain.input.encoding` not `"current"`/`"poisson"`, or `"poisson"` missing `rate`/`weight` | named |
| `body.escape.threshold`/`distance`/`cooldown` not a positive number | named |

## Tests

`tests/stimulus-declared.test.mjs` (declared sense/site resolution, undeclared-sense error),
`tests/body-escape.test.mjs` (jump distance, cooldown, stop-at-wall), and an extension of the existing
`fly-config-brain.test.mjs`-style suite (`fly-config-brain-v2.test.mjs`) for version/defaults/mismatch coverage.
