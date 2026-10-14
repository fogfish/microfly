# Contract: World config for brain version `"v2"` (wide-I/O forager)

**Owner**: `public/js/world/validate.js` (checks) and `public/js/fly/fly-config.js` (defaults). **Amends**:
[world-config-forager.md](../../008-hungry-forager-brain/contracts/world-config-forager.md). Existing world files
keep their meaning unchanged (spec FR-001–FR-005); every rule below applies only when `flies.brain.version` is
`"v2"`.

## `flies.brain`

| Key | Rule |
|---|---|
| `version` | `"mock"`, `"v0"`, `"v1"` or `"v2"` (was `"mock"`/`"v0"`/`"v1"`). |
| `snapshot` | Required for `v0`, `v1` and `v2`. Must be a `kind: "forager-wide"` container for `v2` (channel-declaration-v5.md's cross-check). |
| `lif`, `stepsPerTick`, `motorSmoothing` | As `v1` — `v2` runs the identical `lif-v1.js`/`fly-brain-v1.js` path (ADR 007, "Decisions: LIF core and runner"). No new LIF key is introduced. |

## `flies.stimuli` (`v2` only; required, one entry per `sense` the snapshot declares)

A map from a `sense` name (as declared on an input channel, channel-declaration-v5.md) to where that sense is
read in the world:

| Key | Type | Rule |
|---|---|---|
| `from` | `"edibles"` \| `"dangers"` | Which world object list this sense samples. |
| `kinds` | string[] (optional) | Restricts to object kinds of that list, e.g. `["spider"]` or `["lantern"]`. Absent means every kind in the list. |
| `scaleBy` | `"stock"` (optional) | For `from: "edibles"`: multiply the falloff contribution by the object's remaining stock fraction, as `senseBilateral` already does for food odour and taste. |
| `radius` | number (optional, > 0) | Falloff radius in tiles, for a distance sense (ADR 007 W8: `odour:food`, `odour:danger`, `heat`). |
| `contact` | boolean (optional) | `true` for a sense read only on the body site's own cell, with no falloff (`taste`, `touch`). Mutually exclusive with `radius` being meaningful — a `contact` sense ignores `radius` if both are present. |

Example (ADR 007 W8):

```json
"stimuli": {
  "odour:food":   { "from": "edibles", "scaleBy": "stock" },
  "odour:danger": { "from": "dangers", "kinds": ["spider"], "radius": 4 },
  "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
  "taste":        { "from": "edibles", "scaleBy": "stock", "contact": true },
  "touch":        { "from": "blocked", "contact": true }
}
```

`touch`'s `from: "blocked"` is a third source, read directly from world walkability (`env.isWalkable`), not from an
object list — it needs no `kinds`.

**Failure**: a snapshot declares an input channel whose `sense` has no matching key in `flies.stimuli` — world
load stops with `flies.stimuli is missing sense "${sense}", declared by channel "${channelId}"` (spec FR-018, edge
case). This is checked once, at world load, before any fly starts, the same timing as the existing version-mismatch
check.

## `flies.body.sites` (`v2` only; required, one entry per `site` the snapshot declares)

| Key | Type | Rule |
|---|---|---|
| `forward` | number | Offset ahead of the body centre along the heading, in tiles. May be `0`. |
| `lateral` | number | Offset across the heading, in tiles, before mirroring per the channel's declared `side`. May be `0` (ADR 007 W8: `mouth` has no lateral offset, so its left/right channels always read the same value — by design, not a bug). |

Example (ADR 007 W9):

```json
"sites": {
  "antenna":   { "forward": 0,   "lateral": 0.5 },
  "mouth":     { "forward": 0,   "lateral": 0 },
  "front-leg": { "forward": 0.5, "lateral": 0.25 }
}
```

A site's world position for side `L`/`R` is computed the same way `antennaPoints` already computes the two
antennae: rotate `(forward, ±lateral)` by the fly's heading and add it to the body centre. A `side: "both"` channel
(none declared by this brain, but the mechanism must not special-case it away) reads `lateral = 0`.

**Failure**: a snapshot declares an input channel whose `site` has no matching key in `flies.body.sites` — world
load stops with `flies.body.sites is missing site "${site}", declared by channel "${channelId}"`.

## `flies.body.escape` (`v2` only; optional, defaults below)

| Key | Default | Rule |
|---|---|---|
| `enabled` | `false` | Boolean. Escape physics moves nothing while `false`; the drive is still computed and shown (ADR 007 W10, D17). |
| `threshold` | `0.5` | Number in `[0, 1]`. The `escape` drive must exceed this to trigger a move. |
| `distance` | `1.5` | Number > 0. Tiles moved along the heading on a triggered escape, blocked at the first non-walkable cell like any other move (`pick`). |
| `cooldown` | `2` | Number > 0, seconds. Minimum time between two triggered escapes for one fly. |

**Failure**: any present key with the wrong type/range is `flies.body.escape.${key} must be ...`, in the existing
message style. `flies.body.escape` present under `v1`, `v0` or `mock` is `flies.body.escape is only for version
"v2"`.

## Brain-version values

`BRAIN_VERSIONS` in `validate.js` gains `"v2"` alongside `"mock"`, `"v0"`, `"v1"`. The failure message for an
unrecognised value becomes `flies.brain.version must be "mock", "v0", "v1" or "v2"`.

## Example: `public/world/world-forager-wide.json` (the `flies` section only)

```json
"flies": {
  "count": 6, "mode": "toy", "tickHz": 20, "sprite": "fly-female", "baselineSprite": "fly-female-baseline",
  "body": {
    "maxSpeed": 3, "turnRate": 4,
    "energy": { "initial": 0.3, "metabolism": 0.005, "intake": 0.2 },
    "sites": {
      "antenna": { "forward": 0, "lateral": 0.5 },
      "mouth": { "forward": 0, "lateral": 0 },
      "front-leg": { "forward": 0.5, "lateral": 0.25 }
    },
    "escape": { "enabled": false, "threshold": 0.5, "distance": 1.5, "cooldown": 2 }
  },
  "food": { "eatSpeed": 0.5, "feedThreshold": 0.5, "stock": 1.0, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9 },
  "stimuli": {
    "odour:food":   { "from": "edibles", "scaleBy": "stock" },
    "odour:danger": { "from": "dangers", "kinds": ["spider"], "radius": 4 },
    "heat":         { "from": "dangers", "kinds": ["lantern"], "radius": 3 },
    "taste":        { "from": "edibles", "scaleBy": "stock", "contact": true },
    "touch":        { "from": "blocked", "contact": true }
  },
  "brain": { "version": "v2", "snapshot": "brains/forager-brain-wide.brain", "motorSmoothing": 0.05,
             "stepsPerTick": 5, "lif": { "synapticScale": 9 } },
  "experiment": { "seeds": [6, 7, 8, 9, 10], "ticks": 3000, "heldOut": [ /* 30 seeds, ADR 002 A1 */ ] }
}
```

The `lif`/gain values above are placeholders until calibration (research.md R11), as the shipped 11K world's own
block was before its calibration session.

## Failure messages (new, this contract)

- `flies.brain.version must be "mock", "v0", "v1" or "v2"`.
- `flies.stimuli is missing sense "${sense}", declared by channel "${channelId}"`.
- `flies.body.sites is missing site "${site}", declared by channel "${channelId}"`.
- `flies.body.escape.${key} must be ...` (per key, as the table above).
- `flies.body.escape is only for version "v2"`.
- `flies.brain.version "${brainVersion}" needs a "${expectedKind}" snapshot; ${path} is kind "${kind}"` (channel-declaration-v5.md).
