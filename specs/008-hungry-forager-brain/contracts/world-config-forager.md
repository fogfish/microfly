# Contract: World config for the brain choice and the forager

**Owner**: `public/js/world/validate.js` (checks) and `public/js/fly/fly-config.js` (defaults). **Amends**:
`public/world/README.md` and the `flies` section of [specs/002 fly-config](../../002-toy-lif-fly-network/contracts/fly-config.md).
Existing world files keep their meaning (spec FR-002, FR-005).

## `flies.brain`

| Key | Rule |
|---|---|
| `version` | `"mock"`, `"v0"` or `"v1"`. Absent → inferred (no `snapshot` → `mock`; `snapshot` → `v0`). |
| `snapshot` | Required for `v0` and `v1`. Forbidden for `mock`. |
| `neuronCount`, `outDegree`, `inhibitoryFraction`, `capabilities` | Mock only. |
| `motorSmoothing` | `v0` and `mock`. |
| `lif` | Keys from `LIF_DEFAULTS` for `v0`, `LIF_V1_DEFAULTS` for `v1`. |
| `stepsPerTick` | `v1` only. Integer in [1, 20]. Default 1. |

**Version check** (at load, before any fly starts): the container version of `snapshot` must be 3 for `v0` and 4 for
`v1`. Otherwise the error is `flies.brain.version "v1" needs a version 4 snapshot; ${path} is version ${n}` (or the
`v0`/3 form). The mismatch case in the spec's FR-003 uses this text.

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
| `radius` | 3 (v0) | For v1 worlds, 8 by default. Same meaning as v0: the falloff radius in tiles. |

`flies.stimulus.resting` is the odour resting level for v1 as for v0. Taste has no resting level (0).

## Example: `public/world/world-forager.json` (the `flies` section only)

```json
"flies": {
  "count": 6, "mode": "toy", "tickHz": 20, "sprite": "fly", "baselineSprite": "fly-baseline",
  "body": { "maxSpeed": 3, "turnRate": 4, "energy": { "initial": 0.3, "metabolism": 0.005, "intake": 0.2 } },
  "food": { "eatSpeed": 0.5, "feedThreshold": 0.5, "stock": 1.0, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9 },
  "stimulus": { "objects": ["flower"], "radius": 8, "gain": 1.0, "max": 1.0, "resting": 0.2, "antennaOffset": 0.5 },
  "brain": { "version": "v1", "snapshot": "brains/forager-brain.brain", "motorSmoothing": 0.05, "stepsPerTick": 5,
             "lif": { "synapticScale": 0.2 } },
  "experiment": { "seeds": [6, 7, 8, 9, 10], "ticks": 3000 }
}
```

The `experiment.seeds` here are the calibration seeds. Held-out seeds are in the experiment config
([experiment-metrics.md](experiment-metrics.md)). The `synapticScale`, `tauSyn`, `tauAdapt`, `adaptStep`,
`thresholdJitter` and modulator gains above are placeholders until calibration.

## Failure messages

- `flies.brain.version must be "mock", "v0" or "v1"` for any other value.
- `flies.brain.snapshot is required for version "v1"` and `… cannot be set for version "mock"`.
- `flies.food.feedThreshold must be a number from 0 to 1`, and the same form for each key above.
- The version check message above.
