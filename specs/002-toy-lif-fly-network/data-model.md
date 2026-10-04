# Data Model: Toy LIF Fly Network

**Feature**: `002-toy-lif-fly-network` | **Date**: 2026-10-04

Entities are grouped by where they live. Pure entities live in modules that Node can import. Host entities live only in the browser.

## Configuration (from `world.json`, see contracts/fly-config.md)

### FliesConfig (optional top-level `flies`)

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `seed` | integer 0..2³²−1 | `config.seed` | Seeds spawn and all brain and baseline streams |
| `count` | integer 0..64 | 6 | Number of flies |
| `mode` | `"toy"` or `"baseline"` | `"toy"` | Selects brain or random-walk motor source |
| `tickHz` | integer 1..60 | 20 | Brain ticks per second of visible time |
| `sprite` | sprite id | — | Required. Must exist in `sprites` |
| `baselineSprite` | sprite id | `sprite` | Optional. Shown in baseline mode |
| `body` | Body | see below | Required |
| `stimulus` | Stimulus | see below | Required |
| `brain` | Brain | see below | Required when `mode` is `"toy"` |
| `experiment` | Experiment | see below | Optional, used only by `scripts/compare-baseline.mjs` |

### Body

| Field | Type | Rule |
|-------|------|------|
| `maxSpeed` | number > 0 | Tiles per second at full drive (both motors at 1) |
| `turnRate` | number > 0 | Radians per second at full differential (R = 1, L = 0) |

### Stimulus

| Field | Type | Rule |
|-------|------|------|
| `objects` | list of object rule ids, non-empty | Each id must be a rule with `kind: "edible"` |
| `radius` | number > 0 | Tiles. Falloff reaches 0 at this distance |
| `gain` | number ≥ 0 | Multiplies intensity before clamping |
| `max` | number > 0 | Upper clamp of the sensory value |

### Brain

| Field | Type | Default | Rule |
|-------|------|---------|------|
| `neuronCount` | integer 3..1000 | 40 | At least 3 (sensory, LEFT, RIGHT) |
| `outDegree` | integer 1..neuronCount−1 | 4 | Fixed out-degree per neuron |
| `inhibitoryFraction` | number 0..1 | 0.2 | Fraction of neurons with sign −1 |
| `motorSmoothing` | number 0 < x ≤ 1 | 0.05 | EMA factor for LEFT and RIGHT rates |
| `telemetry` | list of unique integers in 0..neuronCount−1 | `[0, 1, 2]` | Neurons whose spikes are sent each tick |
| `lif` | object of LifParams | `LIF_DEFAULTS` | Overrides; unknown keys are rejected |

### LifParams (ADR Stage 1, `brain/lif.js`)

| Name | Default | Meaning |
|------|---------|---------|
| `dt` | 1.0 | Simulation step per brain tick (time unit) |
| `tau` | 20.0 | Membrane time constant (time units) |
| `vRest` | 0.0 | Resting potential |
| `vReset` | 0.0 | Potential after a spike |
| `vThreshold` | 1.0 | Firing threshold |
| `refractorySteps` | 2 | Steps silent after a spike |
| `synapticScale` | 0.2 | Potential added per unit of edge weight |

### Experiment

| Field | Type | Rule |
|-------|------|------|
| `seeds` | non-empty list of integers 0..2³²−1 | Each seed is a complete `flies.seed` for one run |
| `ticks` | integer 1..1000000 | Brain ticks per fly per run |

## Pure runtime entities

### Network (`brain/lif.js`)

| Field | Type | Meaning |
|-------|------|---------|
| `params` | LifParams | Effective parameters |
| `n` | integer | Neuron count |
| `outgoing` | `Array<Array<{post, weight}>>` | Adjacency from the graph |
| `v` | `Float64Array(n)` | Membrane potentials |
| `refractory` | `Int32Array(n)` | Remaining refractory steps |
| `input` | `Float64Array(n)` | Synaptic input for the next step |
| `spikes` | `Uint8Array(n)` | Spikes emitted by the last step |

**Invariants**: `refractory[i] ≥ 0`. A neuron with `spikes[i] = 1` has `v[i] = vReset` and `refractory[i] = refractorySteps`.

### Graph (`brain/graph.js`)

`{ neuronCount, edges: [{pre, post, weight}] }`. Weight is `±1` (sign of `pre` by Dale's law). Each `pre` has exactly `outDegree` distinct `post` values, none equal to `pre`.

### FlyBrain (`brain/fly-brain.js`)

| Field | Type | Meaning |
|-------|------|---------|
| `net` | Network | The LIF network |
| `left`, `right` | number in [0, 1] | Motor EMA rates after the last tick |
| `tick` | integer | Ticks run so far |

Operation `step(sensoryValue) → { tick, sensory, left, right, selected }`. Neuron 0 is the sensory input. Neurons 1 and 2 are the LEFT and RIGHT motors.

### Body (`fly/body.js`)

| Field | Type | Meaning |
|-------|------|---------|
| `x`, `y` | number | Position in tiles (continuous) |
| `heading` | number | Radians |
| `cell` | `"x,y"` string | Last cell, used to detect entry into a stimulus cell |
| `contacts` | integer ≥ 0 | Count of entries into stimulus cells |

### Fly world (`fly/fly-world.js`)

| Field | Type | Meaning |
|-------|------|---------|
| `width`, `height` | integer | World size in tiles |
| `blocked` | `Uint8Array(width × height)` | 1 where a fly cannot enter |
| `stimulusCells` | `Map<number, object>` | Cell index → stimulus object, for contacts and intensity |
| `flies` | `Array<FlyState>` | One per fly |

### FlyState (pure, shared by host and experiment)

| Field | Type | Meaning |
|-------|------|---------|
| `id` | integer 0..count−1 | Stable index |
| `mode` | `"toy"` or `"baseline"` | As configured |
| `body` | Body | Position and contacts |
| `motor` | `{left, right}` | Last motor values applied |
| `sensory` | number | Last sensory value sent |
| `tick` | integer | Brain ticks applied (movement count) |

## Protocol and host entities (see contracts/worker-protocol.md)

### Message (protocol version 1)

Every message has `v: 1` and a `type`. Types: `init`, `sense`, `stop` (host → worker); `ready`, `motor`, `error` (worker → host).

### FlyRecord (host, browser only, `fly/fly-host.js`)

| Field | Type | Meaning |
|-------|------|---------|
| `state` | FlyState | Shared pure state |
| `worker` | `Worker` or `null` | `null` for baseline flies |
| `status` | one of `starting`, `running`, `error`, `stopped` | Shown in the panel |
| `error` | string or `null` | Set when `status` is `"error"` |
| `pending` | boolean | True while a `sense` is waiting for `motor` |
| `history` | ring buffer of 200 ticks | `{tick, sensory, left, right, selected}` for the readout |

## State transitions

- **Fly**: `starting` → `running` on `ready` (toy) or immediately (baseline). `running` → `error` on worker `error` or uncaught error. `running` → `stopped` when the world is unloaded. `error` and `stopped` are terminal.
- **Tick**: a fly is due when `status` is `running`, `pending` is false, and `tick` is below the wall-clock target. Each reply applies one movement step and increments `tick`.
- **Pause**: while `document.hidden`, no fly is due and the clock stops. On resume, the clock base is reset so no catch-up burst happens.

## Validation rules (`world/validate.js`, pure)

- `flies` is optional. When present it must be an object, and every field follows the table above.
- `flies.sprite` and `flies.baselineSprite` must exist in `sprites`.
- Each id in `stimulus.objects` must be a rule in `objects` with `kind: "edible"`.
- `brain.telemetry` values must be unique and below `neuronCount`.
- `brain.lif` keys must be among the LIF parameter names.
- Errors use the existing `{path, message}` form, for example `flies.brain.outDegree: must be an integer from 1 to 39 (neuronCount − 1)`.
