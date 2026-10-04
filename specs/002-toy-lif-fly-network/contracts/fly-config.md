# Contract: Fly Config (`flies` section of world config, version 1)

**File**: `public/world/world.json`, top-level field `flies`. Optional. Adds to the world config contract in `specs/001-arcade-world-setup/contracts/world-config.md`.

**Versioning**: Added as an optional field within `version: 1`, per the 001 versioning rule. The app ignores `flies` when it is absent, so existing configs keep working. No existing field changes meaning.

**Consumers**: the browser app (`fly-host.js`, `main.js`), `scripts/compare-baseline.mjs`. **Producers**: a human editing JSON.

## Shape

```jsonc
{
  "flies": {
    "seed": 1990,                        // optional, default config.seed
    "count": 6,                          // optional, 0..64, default 6
    "mode": "toy",                       // optional, "toy" | "baseline", default "toy"
    "tickHz": 20,                        // optional, 1..60, default 20
    "sprite": "fly",                     // required, sprite id
    "baselineSprite": "fly-baseline",    // optional, sprite id, default same as sprite

    "body": {
      "maxSpeed": 3,                     // required, tiles/s, > 0
      "turnRate": 4                      // required, rad/s, > 0
    },

    "stimulus": {
      "objects": ["apple", "cherry"],    // required, non-empty, rule ids with kind "edible"
      "radius": 3,                       // required, tiles, > 0
      "gain": 1.0,                       // required, >= 0
      "max": 1.0,                        // required, > 0
      "resting": 0.2                     // optional, 0..max, default 0. Sensory level with no fruit nearby
    },

    "brain": {                           // required when mode is "toy"; ignored in baseline
      "neuronCount": 40,                 // optional, 3..1000, default 40
      "outDegree": 4,                    // optional, 1..neuronCount-1, default 4
      "inhibitoryFraction": 0.2,         // optional, 0..1, default 0.2
      "motorSmoothing": 0.05,            // optional, 0 < x <= 1, default 0.05
      "telemetry": [0, 1, 2],            // optional, unique indices < neuronCount, default [0, 1, 2]
      "lif": {                           // optional, any subset of LIF parameter names
        "dt": 1.0,
        "tau": 20.0,
        "vRest": 0.0,
        "vReset": 0.0,
        "vThreshold": 1.0,
        "refractorySteps": 2,
        "synapticScale": 0.2
      }
    },

    "experiment": {                      // optional, used only by scripts/compare-baseline.mjs
      "seeds": [1, 2, 3, 4, 5],          // non-empty, integers 0..4294967295
      "ticks": 3000                      // integer 1..1000000
    }
  }
}
```

## Fixed conventions (not configurable)

- Neuron 0 is the sensory input. Neuron 1 is the LEFT motor. Neuron 2 is the RIGHT motor. The toy requires `neuronCount >= 3`.
- Sensory value is `clamp(resting + gain × intensity, 0, max)` with `intensity = Σ max(0, 1 − d / radius)` over the stimulus objects, `d` in tiles from fly position to object cell centre. `resting` keeps the fly moving with no fruit nearby (spec edge case).
- Wheel speeds: `v = maxSpeed × (L + R) / 2`, `ω = turnRate × (R − L)`.

## Sprites

The `flies` section needs sprites in the existing `sprites` map, in the pixels form from the 001 contract. The default world adds `fly` and `fly-baseline` (8×8 pixels).

## Errors

Validation uses the existing `{path, message}` form. Example:

```text
flies.brain.outDegree: must be an integer from 1 to 39 (neuronCount - 1)
flies.stimulus.objects[1]: "honey" is not an edible object rule
```

If any `flies` error is found, the app shows the error panel and does not start the world, the same as other config errors (001 FR-015).
