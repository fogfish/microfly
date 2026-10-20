# Contract Amendment: world config v3, learning additions

**Amends**: `specs/017-demo-forager/contracts/world-config-v3.md` (and spec 018's food additions). Every key is
optional. A world that sets none of them loads and behaves exactly as before, so there is no version bump. Owners:
`public/world/validate.js` (validation), `public/js/fly/fly-config.js` (defaults), `stimulus.js` /
`fly-world.js` (fields), `fly-host.js` (events), `body-layer.js` (W16).

## `edibles[i].scent`

`"fruit"` | `"floral"`. Optional. Any other value gives: `edibles[i].scent must be "fruit" or "floral"`.

## `flies.stimuli` additions

```json
"odour:food-a": { "from": "edibles", "scents": ["fruit"],  "scaleBy": "stock", "interpolate": true, "contrast": { "common": 0.5, "gain": 5 } },
"odour:food-b": { "from": "edibles", "scents": ["floral"], "scaleBy": "stock", "interpolate": true, "contrast": { "common": 0.5, "gain": 5 } },
"reinforcement:reward": { "from": "events", "events": ["eat"], "pulseTicks": 10 },
"reinforcement:punish": { "from": "events", "events": ["escape", "heatContact", "eat:floral"], "pulseTicks": 10 }
```

- `scents` (with `from: "edibles"`): the field is built only from flowers of those scents, and normalised to
  [0, 1] (W15).
- `from: "events"`: a world-event stimulus. Allowed events:
  - `eat`: the fly ate this tick;
  - `eat:<scent>`: it ate a flower of that scent;
  - `escape`: an escape sprint started this tick;
  - `heatContact`: the mean heat input ≥ 0.9.

  On an event both channels of the pair are set to 1 for `pulseTicks` ticks. Events are read from the fly's own
  body state and the food table, never from another fly.
- A stimulus key with no matching snapshot channel `sense`: the existing named error (Principle VI new-sense rule).
- An unknown event gives: `flies.stimuli["<sense>"].events: unknown event "<name>"`.

The panel shows each `from: "events"` channel with the tag **injected**.

## `flies.food.outcome`

`{ "<scent>": "punish" }`. Optional, documentation for the experiment. Punishment is delivered only through a
`reinforcement:punish` stimulus that lists `eat:<scent>`, and the validator warns when `outcome` names a scent
that no stimulus delivers.

## `flies.brain` additions (v3)

| Key                    | Meaning                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `learning`             | Path to a `learning-v1` sidecar. Required when `lif.plasticity` is set    |
| `lif.plasticity`       | L12 block (contracts/lif-v1-plasticity.md)                                |
| `lif.pathwayGain`      | L11 block                                                                 |

## `flies.body.learning` (W16, the fallback readout, off by default)

```json
"learning": { "feed": true, "stay": true }
```

- `feed`: eat when `drive(feed) · ℓ ≥ food.feedThreshold`, where ℓ is the learned valence of the dominant food pair.
- `stay`: within `food.reach` of a flower, the target walking speed is × `(2 − ℓ)`.

Both use only decoded values. Absent or `false`: `ℓ` is not used by the body. It is still used by W13 when
`lif.plasticity` is set.

## `experiment` additions

```json
"schedule": { "pretest": 3000, "train": 6000, "posttest": 3000, "forget": 6000, "decaytest": 3000 },
"training": "B-punished",
"arms": ["plastic", "frozen", "shuffled", "random"]
```

`training` ∈ `B-punished` | `A-punished` | `A-only`. During `train` the world:
- delivers punishment per `outcome`, and only during `train` (`B-punished`, `A-punished`);
- or for `A-only`, hides the scent-B flowers by setting their level to 0.

`experiment.seeds` / `experiment.heldOut` keep their meaning: calibration and verdict.

## Contract tests

Validator: each new error. Stimulus: a scent-filtered field is 0 at a flower of the other scent and normalised to
[0, 1]. Events: an `eat:floral` pulse lasts exactly `pulseTicks`. W16: with ℓ = 1 the body is identical to W16 off.
Old worlds: every shipped world loads and validates unchanged.
