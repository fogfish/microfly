# Contract: World config for brain version `"v3"` (demo forager: decoder + body layer)

**Owner**: `public/js/world/validate.js` (checks) and `public/js/fly/fly-config.js` (defaults). **Amends**:
[world-config-wide-io.md](../../013-wide-io-forager-brain/contracts/world-config-wide-io.md) (ADR 007), which
amends [world-config-forager.md](../../008-hungry-forager-brain/contracts/world-config-forager.md) (ADR 003).
Existing world files keep their meaning unchanged; every rule below applies only when `flies.brain.version` is
`"v3"`. `v0`/`v1`/`v2` keep every rule the two amended contracts already state.

## `flies.brain`

| Key | Rule |
|---|---|
| `version` | `"mock"`, `"v0"`, `"v1"`, `"v2"` or `"v3"` (was `"mock"`/`"v0"`/`"v1"`/`"v2"`). |
| `snapshot` | Required for `v3`; must be a `kind: "forager-wide"`, container version 4 file — the identical requirement as `v2` (ADR 010 D26: the demo brain is the ADR 009 wide brain, unchanged). |
| `decoder` | Required for `v3`. Path to a `decoder-v1` file (contracts/decoder-v1.md). Forbidden for every other version. |
| `lif`, `stepsPerTick` | As `v2` — `v3` runs the identical `lif-v1.js`/`fly-brain-v1.js` path. `lif.baselineCurrent` (L10) is newly available to every version but defaults to `0`, so `v0`/`v1`/`v2` are unaffected unless a world file sets it explicitly. |

**Version check** (at load, before any fly starts): `v3` needs a container version 4, kind `"forager-wide"`
snapshot — the identical check as `v2` — plus the `decoder` file's own `snapshot.sha256` cross-check
(contracts/decoder-v1.md).

## `flies.body.locomotion` (`v3` only, required)

| Key | Default | Rule |
|---|---|---|
| `baseSpeed` | > 0 | Tiles/sec the fly walks with zero brain drive (W12). |
| `speedGain` | ≥ 0 | Scales `r(forward) − rest(forward)` into added speed. |
| `maxSpeed` | > 0 | Clamp ceiling, same role as the existing `flies.body.maxSpeed`. |
| `surgeGain` | ≥ 0 | Multiplies speed by `1 + surgeGain · max(0, trend_approach)` (W12). |
| `wander` | ≥ 0 | Heading random-walk amplitude. |
| `turnGain` | ≥ 0 | Tropotaxis coefficient (W13). |
| `castGain` | ≥ 0 | Klinotaxis coefficient (W13). |
| `castMin`, `castMax` | 0 ≤ `castMin` ≤ `castMax` | Clamp range for the cast multiplier. |

## `flies.body.escape` (`v3`; same shape as `v2`, new default)

Same keys as `world-config-wide-io.md`'s `flies.body.escape`. **New for `v3`**: `enabled` defaults to `true` (W14 —
`v2` defaults to `false`). Still forbidden for `v0`/`v1`/`mock`.

## `flies.body.backup` (`v3` only, required)

| Key | Default | Rule |
|---|---|---|
| `threshold` | 0–1 | `r(backward) − rest(backward)` above this triggers backing up (W14). |
| `ticks` | positive integer | Duration of the reverse. |

## `flies.modulators.hunger` (`v3` only, optional)

| Key | Default | Rule |
|---|---|---|
| `threshold` | 0.4 | In `[0, 1)`. D32's ramp, applied at runtime in `fly-brain-v1.js` (research.md §6) — **not** a snapshot/container field; absent means the existing linear gain curve, unchanged for every version. Only on `hunger`. |
| `gain` | the snapshot's | `[gainMin, gainMax]`, numbers ≥ 0, `gainMin ≤ gainMax`. Replaces that snapshot modulator's gain at runtime (D32, BUG-001: `odour-food` needs `gainMin` 0, the wide snapshot ships 0.5). Allowed under any snapshot modulator id (`hunger`, `hunger-taste`); an id the snapshot does not declare is refused when the brain is built. |

**Units (BUG-001).** For `v3`, `food.feedThreshold`, `body.escape.threshold` and `body.backup.threshold` compare a
decoded drive, `r̄ − rest` in spikes per neuron per tick (D29), not the `v1`/`v2` 0–1 normalised output. They are
set from a recorded probe (calibration.md), not copied from a `v2` world. `food.eatSpeed` is not read by `v3`: D30
has no speed gate, and a feeding fly stands still for the tick instead.

**Sensory filters and water (BUG-003).** Optional, off by default:

| Key | Rule |
|---|---|
| `flies.stimuli[sense].interpolate` | `true`: a field sense is read bilinearly between cell centres, clamped at the grid edge |
| `flies.stimuli[sense].contrast` | `{ common, gain }`, numbers ≥ 0: each L/R pair of the sense at one site becomes `clamp(common·m ± gain·d, 0, 1)`, `m = (L+R)/2`, `d = (L−R)/2` |
| `flies.body.crossWater` | `v3` only, boolean: water cells are walkable for the body (solid objects are not); touch does not fire on water; flies spawn on dry land |
| `flies.body.motor` | `v3` only: `{ maxTurnRate, escapeTurnRate, maxAccel, sprintSpeed }`, each a number > 0 (rad/s, rad/s, tiles/s², tiles/s). The motor stage (ADR 010 A4, BUG-004): the body follows commanded heading and speed within these limits, and an escape becomes a turn-and-sprint over `escape.distance`. Absent: commands apply at once |
| `flies.body.escape.turn` | `{ min, max }` radians, `0 ≤ min ≤ max ≤ π`: when the threat's side is unknown, the escape turns by an angle drawn from this range, left or right at random (ADR 010 A5, BUG-005). Absent: reverse (π) |
| `flies.body.escape.tau` | number ≥ 1, default 1: ticks the decoded alarm is integrated over before `escape.threshold` |

**`flies.food.reach`** (optional, any version; default 0; whole number 0–3; BUG-002): the eating area, every cell
within this Chebyshev distance of a flower's cell. Taste contact, eating and the find metric all use it. 0 is the
flower's own cell (v1/v2 behaviour); the demo worlds use 1, the food odour field's 100 % core.

## Example: `public/world/world-forager-demo.json` (the `flies` section only)

```json
"flies": {
  "count": 6, "mode": "toy", "tickHz": 20, "sprite": "fly-female", "baselineSprite": "fly-female-baseline",
  "body": {
    "maxSpeed": 3, "turnRate": 4,
    "energy": { "initial": 0.3, "metabolism": 0.005, "intake": 0.2 },
    "sites": { "antenna": { "forward": 0, "lateral": 0.5 }, "mouth": { "forward": 0, "lateral": 0 },
               "front-leg": { "forward": 0.5, "lateral": 0.25 } },
    "locomotion": { "baseSpeed": 0.6, "speedGain": 2, "maxSpeed": 3, "surgeGain": 0.3, "wander": 0.4,
                     "turnGain": 1.5, "castGain": 1, "castMin": 0.3, "castMax": 1 },
    "escape": { "enabled": true, "threshold": 0.22, "tau": 20, "turn": { "min": 1.571, "max": 2.356 }, "distance": 1.5, "cooldown": 2 },
    "crossWater": true,
    "motor": { "maxTurnRate": 4, "escapeTurnRate": 15, "maxAccel": 12, "sprintSpeed": 3 },
    "backup": { "threshold": 0.5, "ticks": 10 }
  },
  "food": { "eatSpeed": 0.5, "feedThreshold": 0.12, "reach": 1, "stock": 1, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9 },
  "stimuli": {
    "odour:food": { "from": "edibles", "scaleBy": "stock", "interpolate": true, "contrast": { "common": 0.5, "gain": 5 } },
    "odour:danger": { "from": "forestEdge", "interpolate": true },
    "heat": { "from": "water", "interpolate": true },
    "taste": { "from": "edibles", "scaleBy": "stock", "contact": true },
    "touch": { "from": "blocked", "contact": true }
  },
  "modulators": { "hunger": { "threshold": 0.4, "gain": [0, 1.5] } },
  "brain": {
    "version": "v3", "snapshot": "brains/forager-brain-wide.brain",
    "decoder": "brains/forager-brain-wide.decoder.json",
    "motorSmoothing": 0.05, "stepsPerTick": 5,
    "lif": { "synapticScale": 15, "inhibitoryScale": 1.5, "noiseAmplitude": 0.2, "noiseBulkScale": 0,
              "tauSyn": 0, "tauAdapt": 100, "adaptStep": 0.1, "thresholdJitter": 0.1, "baselineCurrent": 0.03,
              "outputScale": { "feed": 128, "forward": 8192, "backward": 64, "turn-left": 2048, "turn-right": 8192, "escape": 2048 } }
  },
  "experiment": { "seeds": [6, 7, 8, 9, 10], "ticks": 3000, "heldOut": [101, "…", 130] }
}
```

LIF values above are the C1-regime starting point (ADR 010 L10's own worked example, `baseline 0.03` against
threshold 1); the real values ship from the C1/C2 calibration run, recorded in `calibration.md` like every prior
brain generation. `outputScale` is carried over unchanged from `v2`'s own shipped value (`world-forager-wide.json`,
ADR 007/009): it is a per-named-output-channel synaptic-weight gain (`lif-v1.js` L6), not something C1/C2's grid
discovers — without it, the output pool neurons (`feed`/`forward`/`backward`/`turn-left`/`turn-right`/`escape`)
receive only the bulk `synapticScale`, which is far too weak to make them responsive at all (found 2026-10-17,
see `calibration.md`: it visibly starved the panel's Outputs section, and widened which `drive.<pair>` pools C2
could reproduce on the held-back seed). Every `v3` world needs it for the same reason `v2` does.

## Failure messages

- `flies.brain.version must be "mock", "v0", "v1", "v2" or "v3"` for any other value.
- `flies.brain.decoder is required for version "v3"` and `… cannot be set for version "<other>"`.
- `flies.body.locomotion is required for version "v3"` (and per-key messages matching the existing
  `flies.body.sites`/`escape` pattern in `validate.js`).
- `flies.body.backup is required for version "v3"`.
- The decoder/snapshot hash-mismatch and pool/valence messages from contracts/decoder-v1.md.
