# Contract: World config for the brain choice and the forager

**Owner**: `public/js/world/validate.js` (checks) and `public/js/fly/fly-config.js` (defaults). **Amends**:
`public/world/README.md` and the `flies` section of [specs/002 fly-config](../../002-toy-lif-fly-network/contracts/fly-config.md).
Existing world files keep their meaning (spec FR-002, FR-005). Version `v2` (specs 013's ADR 006) adds `flies.brain.input`
below, and the net-new `flies.stimuli` (plural), `flies.body.sites` and `flies.body.escape` sections — marked
**v2** throughout; `flies.stimulus` (singular, the bilateral-odour-only shape below) stays exactly as it is and is
read only by `mock`/`v0`/`v1` worlds.

## `flies.brain`

| Key | Rule |
|---|---|
| `version` | `"mock"`, `"v0"`, `"v1"` or `"v2"`. Absent → inferred (no `snapshot` → `mock`; `snapshot` → `v0`). |
| `snapshot` | Required for `v0`, `v1` and `v2`. Forbidden for `mock`. |
| `neuronCount`, `outDegree`, `inhibitoryFraction`, `capabilities` | Mock only. |
| `motorSmoothing` | `v0`, `mock` and `v2`. |
| `lif` | Keys from `LIF_DEFAULTS` for `v0`, `LIF_V1_DEFAULTS` for `v1` and `v2` (both run on `lif-v1.js`; `v2` just gains `groupGain`, [lif-v1.md](lif-v1.md)). |
| `stepsPerTick` | `v1` and `v2` only. Integer in [1, 20]. Default 1. |
| `input` (**v2**) | `{ encoding: "current" \| "poisson", rate: [r0, r1], weight }`. Only for `v2`. `encoding` defaults to `"current"` (today's constant-drive behaviour, no change for any existing world); `"poisson"` requires `rate` (two finite numbers, `0 ≤ r0 ≤ r1 ≤ 1`) and `weight` (a positive number). |

**Version check** (at load, before any fly starts): the container version of `snapshot` must be 3 for `v0`, 4 for
`v1`, 5 for `v2`. Otherwise the error is `flies.brain.version "v1" needs a version 4 snapshot; ${path} is version
${n}` (or the `v0`/3, `v2`/5 form). The mismatch case in the spec's FR-003 uses this text.

## `flies.body`

Existing `maxSpeed`, `turnRate`. New for `v1`:

| Key | Default | Rule |
|---|---|---|
| `energy.initial` | 0.3 | Number in [0, 1]. |
| `energy.metabolism` | 0.005 | Energy lost per second (0.3 reaches 0 in about 60 s). ≥ 0. |
| `energy.intake` | 0.2 | Energy gained per second while eating. ≥ 0. |

## `flies.food` (v1 only)

| Key | Default | Rule |
|---|---|---|
| `eatSpeed` | 0.5 | Tiles per second. A fly eats only below this speed. |
| `feedThreshold` | 0.5 | Feeding output above this value allows eating. In [0, 1]. |
| `stock` | 1.0 | Full stock of each flower. > 0. |
| `consumeRate` | 0.2 | Stock per second while eating. Added beyond ADR 003; see research R6. |
| `regrowth` | 0.02 | Stock per second while not being eaten. ≥ 0. |
| `sated` | 0.9 | Energy at which a bout that ends with the feed output low is counted as `sated`, not `walked`. |

The defaults are starting values. Calibration (ADR 003 Q5) sets the final ones, recorded with the run.

## `flies.stimulus` (v1 extras)

| Key | Default | Rule |
|---|---|---|
| `antennaOffset` | 0.5 | Tiles from the fly's centre to each antenna, across the heading. ≥ 0. |
| `radius` | 3 (v0) | Version 2 worlds: the falloff radius in tiles. Version 3 (spec 009): reach **per tile of sprite size**; a food unit's reach is `radius × size` (6 in every shipped world). |

`flies.stimulus.resting` is the odour resting level for v1 as for v0. Taste has no resting level (0).
`flies.stimulus` is read only by `mock`/`v0`/`v1` worlds; a `v2` world uses `flies.stimuli` (plural) instead.

## `flies.stimuli` (v2 only, ADR 006 W6)

```jsonc
"stimuli": {
  "odour:food":   { "from": "edibles", "radius": 6 },
  "odour:danger": { "from": "dangers", "kinds": ["spider"], "radius": 4 },
  "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
  "taste:mouth":  { "from": "edibles", "radius": 0.3 },
  "taste:leg":    { "from": "edibles", "radius": 0.3 },
  "touch":        { "from": "blocked" }
}
```

An object mapping each of the six declared senses (`odour:food`, `odour:danger`, `heat`, `taste:mouth`,
`taste:leg`, `touch`) to its source: `from` is `"edibles"`, `"dangers"` or `"blocked"` (required); `kinds`, when
present, is a list of strings filtering which world objects of that source produce the sense (e.g. `dangers`
split into `spider`/`lantern` kinds, each a different sense); `radius` is the falloff radius in tiles (required
for every sense but `touch`, which is binary — 1 when its site's cell is not walkable, else 0 — and ignores
`radius`). A snapshot channel declaring a `sense` with no matching key here is a **world-start validation error**
naming the undeclared sense (FR-021) — not a silent zero. `resolveDeclaredStimulus` (`stimulus.js`) reads this
section; only meaningful (and validated) for a `v2` brain.

## `flies.body.sites` (v2 only, ADR 006 W7)

```jsonc
"body": { "sites": { "antenna": 0.5, "mouth": 0, "front-leg": 0.4 } }
```

Per-site forward offset (tiles ahead of the body centre, finite number; `front-leg`, and any other `L`/`R` site,
additionally offsets laterally by the fixed `SITE_LATERAL` half-spacing `stimulus.js` declares). Read by
`resolveBodySites`/`sitePoint` (`body.js`/`stimulus.js`) to place each input channel's sample point by its
declared `site` (`antenna`, `mouth` or `front-leg`).

## `flies.body.escape` (v2 only, ADR 006 W8)

```jsonc
"body": { "escape": { "threshold": 0.5, "distance": 1.5, "cooldown": 2 } }
```

Three positive numbers. `threshold`: the `escape` output level above which a jump triggers. `distance`: tiles
moved in one tick along the current heading, no turn (stops at the first non-walkable cell, `jumpForagerBody` in
`body.js`). `cooldown`: seconds before another jump can trigger. The section is meaningless (and unvalidated) for
`mock`/`v0`/`v1`; there is no world-config default when it is absent from a `v2` world — `applyForagerMotor`
treats `env.escapeConfig` as absent (no escape physics) rather than falling back to ADR 006 W8's suggested
numbers, so a `v2` world that wants escape must declare this section explicitly.

## Example: `public/world/world-forager.json` (the `flies` section only)

```json
"flies": {
  "count": 6, "mode": "toy", "tickHz": 20, "sprite": "fly", "baselineSprite": "fly-baseline",
  "body": { "maxSpeed": 3, "turnRate": 4, "energy": { "initial": 0.3, "metabolism": 0.005, "intake": 0.2 } },
  "food": { "eatSpeed": 0.5, "feedThreshold": 0.5, "stock": 1.0, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9 },
  "stimulus": { "objects": ["small", "medium", "large"], "radius": 6, "gain": 1.0, "max": 1.0, "resting": 0.2, "antennaOffset": 0.5 },
  "brain": { "version": "v1", "snapshot": "brains/forager-brain.brain", "motorSmoothing": 0.05, "stepsPerTick": 5,
             "lif": { "synapticScale": 0.2 } },
  "experiment": { "seeds": [6, 7, 8, 9, 10], "ticks": 3000 }
}
```

The `experiment.seeds` here are the calibration seeds. Held-out seeds are in the experiment config
([experiment-metrics.md](experiment-metrics.md)). The `synapticScale`, `tauSyn`, `tauAdapt`, `adaptStep`,
`thresholdJitter`, `outputScale` and modulator gains above are placeholders until calibration.

## Example: `public/world/world-forager-15k.json` (the `flies` section only, v2)

```json
"flies": {
  "count": 6, "mode": "toy", "tickHz": 20, "sprite": "fly-female", "baselineSprite": "fly-female-baseline",
  "body": {
    "maxSpeed": 3, "turnRate": 4,
    "energy": { "initial": 0.3, "metabolism": 0.005, "intake": 0.2 },
    "sites": { "antenna": 0.5, "mouth": 0, "front-leg": 0.4 },
    "escape": { "threshold": 0.5, "distance": 1.5, "cooldown": 2 }
  },
  "food": { "eatSpeed": 0.5, "feedThreshold": 0.5, "stock": 1, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9 },
  "brain": {
    "version": "v2", "snapshot": "brains/forager-brain-15k.brain", "motorSmoothing": 0.02, "stepsPerTick": 10,
    "input": { "encoding": "poisson", "rate": [0.005, 0.15], "weight": 1.2 },
    "lif": { "dt": 1, "tau": 20, "refractorySteps": 2, "tauSyn": 5, "synapticScale": 0.04 }
  },
  "stimuli": {
    "odour:food": { "from": "edibles", "radius": 6 },
    "odour:danger": { "from": "dangers", "kinds": ["spider"], "radius": 4 },
    "heat": { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
    "taste:mouth": { "from": "edibles", "radius": 0.3 },
    "taste:leg": { "from": "edibles", "radius": 0.3 },
    "touch": { "from": "blocked" }
  }
}
```

The `brain.lif`/`stepsPerTick`/`input.rate`/`input.weight` values here are ADR 006 L11's starting point (Shiu et
al. 2024), not a calibrated setting — `specs/013-forager-brain-15k-lif-v2/calibration.md` records the first
calibration-seed look and why the network runs ignited at these values (public/world/README.md's convention for
an uncalibrated brain).

## Failure messages

- `flies.brain.version must be "mock", "v0", "v1" or "v2"` for any other value.
- `flies.brain.snapshot is required for version "v1"` and `… cannot be set for version "mock"` (same form for `v2`).
- `flies.food.feedThreshold must be a number from 0 to 1`, and the same form for each key above.
- The version check message above.
- **(v2)** `flies.stimuli must be an object mapping each declared sense to its source`; per sense,
  `flies.stimuli.${sense}.from must be "edibles", "dangers" or "blocked"`, `.kinds must be a list of strings`,
  `.radius must be a number greater than 0`; an unknown sense key is
  `flies.stimuli.${sense} "${sense}" is not one of the six declared senses`.
- **(v2)** `flies.body.sites must be an object mapping each declared body site to a forward offset`; an unknown
  site or non-numeric offset is named per key.
- **(v2)** `flies.body.escape must be an object with threshold, distance and cooldown`; a non-positive value is
  named per key.
- **(v2)** `flies.brain.input is only for version "v2"`; `flies.brain.input must be an object with encoding`;
  `flies.brain.input.encoding must be "current" or "poisson"`; a `"poisson"` encoding missing a valid `rate` or
  `weight` is named per key.
