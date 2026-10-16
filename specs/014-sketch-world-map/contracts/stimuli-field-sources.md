# Contract: `flies.stimuli` — `water` and `forestEdge` Field Sources

**Amends**: [specs/013-wide-io-forager-brain/contracts/world-config-wide-io.md](../../013-wide-io-forager-brain/contracts/world-config-wide-io.md)
§`flies.stimuli`. `v2` worlds only. Additive: `edibles`/`dangers`/`blocked` and the existing `radius`/
`contact` sensing modes are unchanged and still supported.

## 1. `flies.stimuli[sense].from` — two new values

| Key | Type | Rule |
|---|---|---|
| `from` | `"edibles"` \| `"dangers"` \| `"blocked"` \| `"water"` \| `"forestEdge"` | Which world source this sense samples. `water`/`forestEdge` read the heat/danger field (contracts/world-format-sketch-map.md §3) at the channel's body-site cell, no falloff math at sense time — the field already encodes the falloff. |

`kinds`, `scaleBy` and `radius` are not meaningful for `from: "water"` or `from: "forestEdge"` and MUST be
absent (validator rule below) — the field's shape is fixed by contracts/world-format-sketch-map.md §3, not
configurable per-world.

Example (`world-forager-wide.json`, replacing the `dangers`-sourced entries):

```json
"stimuli": {
  "odour:food":   { "from": "edibles", "scaleBy": "stock" },
  "odour:danger": { "from": "forestEdge" },
  "heat":         { "from": "water" },
  "taste":        { "from": "edibles", "scaleBy": "stock", "contact": true },
  "touch":        { "from": "blocked", "contact": true }
}
```

## 2. Validator (`public/js/world/validate.js`)

- `STIMULUS_SOURCES` becomes `['edibles', 'dangers', 'blocked', 'water', 'forestEdge']`.
- New rule: when `spec.from` is `'water'` or `'forestEdge'`, `spec.kinds`, `spec.scaleBy` and `spec.radius`
  MUST be absent. Message: `flies.stimuli.${sense} must not set ${key} when from is "${spec.from}"`.
- `spec.contact`, if present, is still accepted but has no effect for these two sources (the field lookup
  is already a single-cell read, the same shape `contact: true` already describes) — a future cleanup MAY
  forbid it for clarity; this contract does not require that.

## 3. `public/js/fly/stimulus.js` — `senseDeclared`, new `field` mode

```js
export function senseDeclared(spec, at, sampler)
  // spec.contact        → sampler.contactAt(floor(at.x), floor(at.y))     // unchanged
  // spec.field           → sampler.fieldAt(floor(at.x), floor(at.y))      // NEW
  // else                 → senseDistance(at, sampler.points(), spec.radius)  // unchanged
```

- `spec.field` is not a world-config key — it is set internally by `samplerFor` (next section) based on
  `spec.from`, the same way today's code already branches internally on `spec.from` without a separate
  config flag for `contact` vs point-sum.
- `fieldAt(cx, cy)` MUST return a value already in `[0, 1]` — no further clamping or scaling at the call
  site, mirroring `contactAt`'s contract.

## 4. `public/js/fly/forager-step-wide.js` — `samplerFor`, two new branches

```js
function samplerFor(spec, world, flowers) {
  // existing: 'edibles', 'dangers', 'blocked' branches, unchanged
  if (spec.from === 'water') {
    return { points: () => [], contactAt: () => 0, fieldAt: (cx, cy) => world.heatField.intensity[cy * world.width + cx] ?? 0 };
  }
  if (spec.from === 'forestEdge') {
    return { points: () => [], contactAt: () => 0, fieldAt: (cx, cy) => world.dangerField.intensity[cy * world.width + cx] ?? 0 };
  }
  // unknown from: throw, unchanged
}
```

- `world.heatField`/`world.dangerField` are built once per world load (contracts/world-format-sketch-map.md
  §3) and passed through the same `env` object `forageEnvWide` already assembles, alongside the existing
  `world.walkable`/`world.isStimulusCell`.
- Out-of-bounds `(cx, cy)` (a body site projected outside the grid) returns `0`, the same safe default
  `contactAt` already implies for an off-grid query.

## 5. Failure messages (new, this contract)

- `flies.stimuli.${sense}.from must not set ${key} when from is "${spec.from}"` — world-load validation
  (§2).
- The existing "missing sense declared by a channel" and "unsupported from" failure paths
  (`world-config-wide-io.md`'s own Failure messages section) are unchanged and now simply also accept
  `water`/`forestEdge` as supported values.

## 6. Tests

- `tests/stimulus-declared.test.mjs` (extend): `senseDeclared` with `spec.field: true` and a stub
  `sampler.fieldAt` returns exactly the stub's value, untouched.
- `tests/world-compat-wide.test.mjs` (extend): a world declaring `odour:danger`/`heat` with
  `from: "forestEdge"`/`"water"` loads and starts a fly with no console error; one declaring `kinds`
  alongside `from: "water"` fails validation with the new message.
- `public/tests/validate-v2.test.js` (extend): the new `STIMULUS_SOURCES` entries and the
  kinds/scaleBy/radius-forbidden rule.
