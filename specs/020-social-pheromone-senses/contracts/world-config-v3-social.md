# Contract Amendment: world config v3, social additions

**Amends**: `specs/017-demo-forager/contracts/world-config-v3.md` and
[world-config-v3-learning.md](../../019-mb-valence-learning/contracts/world-config-v3-learning.md). Every key is
optional. A world that sets none of them loads and behaves exactly as before, so there is **no version bump**.
Owners: `public/world/validate.js`, `public/js/fly/fly-config.js` (defaults), `stimulus.js` and
`forager-step-wide.js` (sensing), `fly-host.js` (the per-tick table, solid bodies), `body-layer.js` (W17),
`main.js` (overlay).

## `flies.stimuli`: source `from: "flies"`

```json
"odour:conspecific": { "from": "flies", "radius": 3, "contrast": { "common": 0.5, "gain": 5 } },
"contact:pheromone": { "from": "flies", "contact": true }
```

- **Odour mode** (no `contact`): Σ over the live other flies of `falloff(d, radius) × emits`, clamped to [0, 1],
  sampled at the channel's site. `radius` is in tiles, a number > 0, default 3. `contrast` works as for other senses.
  `interpolate` and `scaleBy` are not allowed and fail with `flies.stimuli["<sense>"]: <key> does not apply to from
  "flies"`.
- **Contact mode** (`contact: true`): the maximum over the live other flies of `[d ≤ bodyRadius] × emits`, sampled at
  the channel's site.
- A fly never senses itself. A fly that is dead, or not yet spawned, emits nothing.
- A `from: "flies"` stimulus with no matching snapshot channel `sense` raises the existing named error (Principle VI).
  A snapshot channel with no matching stimulus raises the existing `flies.stimuli is missing sense` error.

## `flies.sexes`

```json
"sexes": {
  "default": "female",
  "female": { "emits": { "odour:conspecific": 1.0, "contact:pheromone": 1.0 } },
  "male":   { "emits": { "odour:conspecific": 1.0, "contact:pheromone": 0.0 } }
}
```

- If absent, every fly emits 1 for every `from: "flies"` stimulus.
- Allowed sexes are `female` and `male`.
- Every value of `flies.sex[i]` must be a declared sex, or validation fails with
  `flies.sex[<i>]: unknown sex "<v>"`.
- Each `emits` key must name a `from: "flies"` stimulus, and its value must be in [0, 1].
- The panel shows the tag as "female (male connectome)" or "male".

## `flies.body` additions

| Key | Type | Default | Meaning |
|---|---|---|---|
| `bodyRadius` | number > 0, tiles | 0.35 | contact radius of a fly's body |
| `solid` | boolean | false | bodies refuse to overlap; touch also fires inside another body (research R10) |
| `song` | `{ threshold, tau }` | absent (W17 off) | the wing-extension reflex on the decoded `song` pool |

`song` is allowed only when the snapshot declares a `song` output. Otherwise validation fails with
`flies.body.song needs a snapshot song output`.

## Overlay

There is a fifth overlay, `odour-conspecific`, with its own switch in the World tab. It is off on load and uses the CSS
token group `--odour-social-*`. It shows the odour-mode function at cell centres from the live fly positions, with no
self-exclusion, and is repainted on the food overlay's throttle. The overlay switch appears only when the world
declares `odour:conspecific`.

## Telemetry

Each fly record gains `{ sex, social: { conspecific: [L, R], contact: [L, R] }, contactWith: id | null, singing }`.
These are main-thread values that the panel and `social-arms.mjs` read. They add nothing to the worker protocol.

## Tests

- `validate.js`: each new key, valid and invalid.
- Sampler: the left/right gradient, self-exclusion, the cap, sex emission, contact on the touching side only.
- An old world (forager, demo, learning) loads unchanged.
