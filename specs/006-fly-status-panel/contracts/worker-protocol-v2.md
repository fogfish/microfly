# Contract: Worker Message Protocol (version 2)

**Amends**: [specs/002-toy-lif-fly-network/contracts/worker-protocol.md](../../002-toy-lif-fly-network/contracts/worker-protocol.md).
The protocol version constant moves from 1 to 2. Host and worker are built from the same files, so
no version negotiation is needed.

## Changes from version 1

- `init.brain.telemetry` is removed. The worker sends the full spike list instead of a selected
  subset.
- `motor` loses `selected` (a `Uint8Array` for telemetry neurons). It gains `outputs` (every declared
  output) and `spikes` (the neurons that spiked).
- `left` and `right` are kept. They are the values of the outputs that carry `drive`.

## Host → worker (unchanged except `init.brain`)

- `init`: `{ v: 2, type: "init", flyId, seed, brain }`. `brain` has `snapshot` (URL or parsed
  container) and optional `lif`, `motorSmoothing`. `telemetry` is no longer accepted: a value of
  `telemetry` in `brain` is an error (`init.brain.telemetry is removed in protocol 2`).
- `sense`: `{ v: 2, type: "sense", tick, sensory }`. Unchanged.
- `stop`: `{ v: 2, type: "stop" }`. Unchanged.

## Worker → host

- `ready`: `{ v: 2, type: "ready", flyId, neuronCount, capabilities }`. `capabilities` is the
  declaration the brain was built with (for the panel). Serialized as a plain object.
- `motor`:

  ```ts
  {
    v: 2,
    type: "motor",
    tick: number,            // integer ≥ 0, equals the sense tick
    sensory: number,         // the value the brain received
    left: number,            // [0, 1], value of the output with drive "left"
    right: number,           // [0, 1], value of the output with drive "right"
    outputs: Float32Array,   // one value per declared output, declaration order; transferred
    spikes: Uint32Array      // neuron indices that spiked this tick, ascending; transferred
  }
  ```

- `error`: unchanged.

## Validation (host and worker)

- `motor.outputs` is a `Float32Array` with length equal to the declared output count.
- `motor.spikes` is a `Uint32Array`, every index is below `neuronCount`, and the list is strictly
  ascending.
- `motor.left` and `motor.right` are the values of the outputs with `drive`, and the host checks that
  each, rounded to float32, equals the `outputs` entry at its drive position. (`outputs` is a
  `Float32Array`, so the exact double is not stored there.)
- A message that fails these checks makes the host mark the fly as failed, as the protocol already
  does for a wrong tick.

## Transferables

`transferables(msg)` returns `[msg.outputs.buffer, msg.spikes.buffer]` for `motor`. Nothing else is
transferred.

## Contract tests

- `tests/protocol-v2.test.mjs`: builders and validators for each message, including rejection of a
  `telemetry` key, of a wrong `outputs` length, of unsorted or out-of-range `spikes`, and of
  `left`/`right` that disagree with `outputs`.
- `tests/fly-brain.test.mjs` (updated): the runner's `outputs` and `spikes` agree with the LIF spike
  vector for a fixed seed.
