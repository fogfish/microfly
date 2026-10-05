# Data Model: Fly Status Side Panel

Entities and their rules. The byte layout is in `contracts/snapshot-format-v3.md`, the message
layout in `contracts/worker-protocol-v2.md`, and the channel rules in `contracts/channel-declaration.md`.

## BrainCapabilities

The declaration a brain makes about what it exposes. Read from the snapshot header (version 3), or
produced in JavaScript for toy and baseline brains.

| Field | Type | Rule |
|---|---|---|
| `signals` | string[] | Telemetry the brain exposes. Known ids: `spikes`. Unknown ids are kept and ignored by the panel. Unique. |
| `channels.inputs` | Channel[] | Signals the world sends to the brain. In v3 each references neuron 0. |
| `channels.outputs` | Channel[] | Signals the brain sends out. Each references a neuron below `neuronCount`. |

## Channel

| Field | Type | Rule |
|---|---|---|
| `id` | string | Matches `^[a-z][a-z0-9-]*$`. Unique across inputs and outputs. |
| `label` | string | Non-empty, at most 40 characters. Shown as text. |
| `side` | `"L"` \| `"R"` \| `"both"` | Where the channel belongs in the panel. |
| `neuron` | integer | Index below `neuronCount`. Inputs must be `0`. |
| `range` | `[number, number]` | `min < max`. Values are clamped to it for the bar, and the number shows the true value. Defaults to `[0, 1]`. |
| `drive` | `"left"` \| `"right"` \| absent | Output only. Exactly one `left` and one `right` when the brain drives a fly. |

## Neuron

Already present in the header, unchanged. Used for the point cloud.

| Field | Used by | Rule |
|---|---|---|
| `index` | all | Equals the array position. |
| `role` | body drive | `sensory`, `left`, `right` for 0, 1, 2. |
| `soma` | point cloud | `[int, int, int]` or `null`. `null` gets a seeded position. |
| `superclass` | optional label | string or `null`. |

## ActivityState (per fly, main thread)

| Field | Type | Meaning |
|---|---|---|
| `lastSpikeAt` | Float64Array(neuronCount) | Wall-clock ms of each neuron's most recent spike, or `-Infinity`. |
| `window` | Uint32Array(neuronCount) | Spike count per neuron over the last 20 ticks. Recomputed from history. |
| `spikesNow` | Uint32Array | Spike indices of the latest tick. |

Brightness for neuron `n` at time `now`:

```text
t = now − lastSpikeAt[n]
brightness = base + (1 − base) × min(1, t / riseMs) × exp(−t / fallMs)     (0 when never spiked: base)
```

Defaults: `base = 0.12`, `riseMs = 120`, `fallMs = 600`.

## Action

Derived from the fly's current outputs `left` and `right`, both in `[0, 1]`:

| Condition | Label |
|---|---|
| `left + right < 0.1` | Idle |
| `|left − right| < 0.1` | Forward |
| `left > right` | Turn right |
| `right > left` | Turn left |

Turning toward the side with the lower drive matches the body's turn rule (`omega = turnRate × (right − left)`).
The thresholds are named constants in `public/js/fly/action.js`, not in the panel.

## FlyStatusModel (panel input, pure)

Built from one `FlyRecord` each tick.

| Field | Type |
|---|---|
| `flyId` | number |
| `brainLabel` | string |
| `action` | `Forward` \| `Turn left` \| `Turn right` \| `Idle` \| null |
| `neuronCount` | number |
| `activeCount` | number, neurons with `window > 0` |
| `coveredCount` | number, neurons drawn in the map |
| `inputs` | `{ channel, value }[]` |
| `outputs` | `{ channel, value }[]` |
| `brightness` | Float32Array(neuronCount), at `now` |

## MotorMessage v2 (worker → host)

| Field | Type | Rule |
|---|---|---|
| `v` | 2 | Protocol version. |
| `tick` | integer ≥ 0 | Must equal the host's expected tick. |
| `sensory` | number | The input value the brain received. |
| `left`, `right` | number in `[0, 1]` | Values of the outputs with `drive` set. |
| `outputs` | Float32Array | One value per declared output, in declaration order. |
| `spikes` | Uint32Array | Indices of neurons that spiked this tick, ascending. |

## FlyRecord changes

`telemetry` (the fixed neuron list) is removed. The record keeps `history` (last 200 ticks) of
`{ tick, sensory, left, right, outputs, spikes }`. The existing `HISTORY` bound stays.
