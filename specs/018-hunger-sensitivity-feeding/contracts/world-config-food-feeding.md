# Contract: World config for hunger-sensitive feeding and food depletion

**Owner**: `public/js/world/validate.js` (checks) and `public/js/fly/fly-config.js` (defaults).

**Amends**: [world-config-forager.md](../../008-hungry-forager-brain/contracts/world-config-forager.md)'s
`flies.food` table (adds keys; does not change the meaning of `eatSpeed`, `feedThreshold`, `stock`,
`consumeRate`, `regrowth`, `sated`, `reach`). Also read by the v2/v3 sensing path documented in
[world-config-wide-io.md](../../013-wide-io-forager-brain/contracts/world-config-wide-io.md) and
[world-config-v3.md](../../017-demo-forager/contracts/world-config-v3.md), since `flies.food` is shared across
every brain version. No version bump: every key below is optional and off/no-op when absent, so every existing
world (`public/world/*.json`) keeps today's behavior byte-for-byte without changes.

**Explicitly distinct from**: `flies.modulators.hunger` (D32, `world-config-v3.md`) — that key is read inside
`public/js/brain/fly-brain-v1.js` and shapes gain for every gain-bearing brain channel. The keys in this contract
are read in world code, before any value reaches the brain, and apply only to food-odor sensing, feeding motion,
and the food resource model. The two are independent; a world may set either, both, or neither.

## `flies.food` (new keys, all optional)

| Key | Default | Rule |
|---|---|---|
| `hungerSensitivity.threshold` | *(absent = off)* | Number in `[0, 1)`. Hunger (`1 - energy`) at or above this makes the fly "hungry" for this feature. |
| `hungerSensitivity.gain` | *(required if `hungerSensitivity` set)* | Number ≥ 1. Multiplier on food-odor sensed inputs while hungry. |
| `feedMotion` | `"pause"` | `"pause"` or `"slow"`. Whether a feeding fly stops or moves at reduced speed. **v3 (`body-layer.js`) only**: v1/v2 keep their existing `eatSpeed`-gated behaviour, since `applyForagerMotor` determines `eating` only after that tick's move (see `research.md` for the sensor/motor placement rationale). |
| `feedSlowSpeed` | *(required if `feedMotion: "slow"`)* | Number ≥ 0, tiles/second. **v3 (`body-layer.js`) only**, as for `feedMotion`. |
| `capacity.small` | *(absent = legacy continuous model)* | Positive integer. Units of food a small flower holds: eating drains it continuously (`consumeRate × dt` per eating tick, as in the legacy model), it does not regrow while partly eaten, and at 0 it recovers after `recovery`. |
| `capacity.medium` | *(required if `capacity` set)* | Positive integer. |
| `capacity.large` | *(required if `capacity` set)* | Positive integer. |
| `recovery` | 30 | Number ≥ 0, seconds. Only meaningful when `capacity` is set. |

## Sensor-filter placement (not a brain change)

`flies.food.hungerSensitivity` is applied in `public/js/fly/forager-step.js`'s `senseForagerFly` and
`public/js/fly/forager-step-wide.js`'s `senseForagerFlyWide` — the two functions that build the `inputs`
Float32Array handed to `brain.step({ inputs, hunger })`. The worker message shape
(`public/js/brain/protocol-v3.js`) is unchanged: the same number of inputs, in the same order, just scaled before
the message is built. `public/js/brain/*.js` is not imported, read, or modified by this feature.

## Motor-control placement (not a brain change)

`flies.food.feedMotion`/`feedSlowSpeed` and the capacity/recovery bookkeeping are applied in
`public/js/fly/body-layer.js`'s `stepBodyLayer` (v3) and `public/js/fly/forager-step.js`'s `applyForagerMotor`
(v1/v2) — the existing functions that already turn the brain's decoded `feed` drive into body movement and a
`flowers.consume(...)` call. The brain's `eating`/`feed` decision (whether and when to feed) is read, never
overridden; only how the body moves and how much the resource depletes changes.

## Example

```json
"flies": {
  "food": {
    "eatSpeed": 0.5, "feedThreshold": 0.5, "stock": 1.0, "consumeRate": 0.2, "regrowth": 0.02, "sated": 0.9,
    "hungerSensitivity": { "threshold": 0.4, "gain": 1.8 },
    "feedMotion": "slow", "feedSlowSpeed": 0.1,
    "capacity": { "small": 1, "medium": 2, "large": 3 },
    "recovery": 30
  }
}
```

A world that omits `hungerSensitivity`, `feedMotion`/`feedSlowSpeed`, `capacity`, and `recovery` entirely behaves
exactly as it does today — this example shows every new key used together, not a required combination.

## Failure messages

- `flies.food.hungerSensitivity.threshold must be a number from 0 to less than 1`
- `flies.food.hungerSensitivity.gain must be a number of 1 or more`
- `flies.food.feedMotion must be "pause" or "slow"`
- `flies.food.feedSlowSpeed is required when flies.food.feedMotion is "slow"` / `… must be a number of 0 or more`
- `flies.food.capacity must have "small", "medium" and "large", each a positive integer`
- `flies.food.recovery must be a number of 0 or more` / `flies.food.recovery is only valid when flies.food.capacity is set`

## Contract tests (added alongside the implementation, not this plan)

- World-config validation: each failure message above, triggered by the matching malformed input, plus a
  round-trip test that every key in the Example above loads without error.
- `food.js` capacity model: small/medium/large deplete after exactly 1/2/3 bouts closing non-`'walked'`; a
  `'walked'` bout changes nothing; a depleted resource's `fraction()` is 0 and stays 0 until `recovery` seconds
  have passed, then returns to exactly 1.
- Sensor filter: `senseForagerFly`/`senseForagerFlyWide` produce the unscaled value below the hunger threshold and
  the `gain`-scaled value at/above it, with no change to array length or ordering (so `protocol-v3.js`'s existing
  input-shape checks keep passing unmodified).
- Motor control: with `feedMotion: "pause"`, a feeding fly's speed is 0 for the whole bout; with `"slow"`, it is
  `feedSlowSpeed` for the whole bout; in both cases it returns to normal movement the tick after the bout closes.
