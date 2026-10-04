# Contract: Fly Worker Protocol (version 1)

**Transport**: `postMessage` between the main thread and one module Worker per toy fly (`public/js/brain/fly.worker.js`). Bulk values use typed arrays and are transferred.

**Version**: every message carries `v: 1`. A message with a missing or different `v` is rejected by the receiver with an error. Changing a field or meaning needs a new version. Adding an optional field is allowed within version 1.

**Implementation**: builders and validators in `public/js/brain/protocol.js`. Handler in `public/js/brain/worker-core.js`. Both are pure and tested in Node (`tests/protocol.test.mjs`), which covers the host side (encode and validate) and the worker side (handler replies).

## Host → worker

### `init`

Sent once per fly, before any `sense`.

```js
{
  v: 1,
  type: 'init',
  flyId: 3,                    // integer, for logging only
  seed: 2834727945,            // brain seed (research R10)
  brain: {                     // validated by the host before sending
    neuronCount: 40,
    outDegree: 4,
    inhibitoryFraction: 0.2,
    motorSmoothing: 0.05,
    telemetry: [0, 1, 2],
    lif: { /* LifParams overrides */ }
  }
}
```

Reply: `ready` on success, or `error` if the network cannot be built (for example, invalid parameters that slipped past validation).

### `sense`

One per brain tick, after the previous `motor` has been received.

```js
{ v: 1, type: 'sense', tick: 42, sensory: 0.37 }
```

- `tick`: integer ≥ 0, the fly's own tick index. The worker requires `tick` to be exactly one more than the previous `sense`, otherwise it replies with `error`.
- `sensory`: finite number in `[0, max]`. The worker clamps to `[0, +∞)` but does not otherwise change it.

Reply: `motor` for the same `tick`.

### `stop`

```js
{ v: 1, type: 'stop' }
```

The worker releases its state and closes. No reply.

## Worker → host

### `ready`

```js
{ v: 1, type: 'ready', flyId: 3, neuronCount: 40 }
```

### `motor`

```js
{
  v: 1,
  type: 'motor',
  tick: 42,
  sensory: 0.37,               // the value applied at this tick
  left: 0.12,                  // EMA rate of neuron 1, in [0, 1]
  right: 0.08,                 // EMA rate of neuron 2, in [0, 1]
  selected: Uint8Array         // spikes this tick for brain.telemetry, same order; transferred
}
```

- `selected.length` equals `brain.telemetry.length`. Each entry is `0` or `1`.
- The host applies the movement step for `tick` once when this arrives.

### `error`

```js
{ v: 1, type: 'error', flyId: 3, tick: 42, message: 'sense tick 42 out of order (expected 41)' }
```

`tick` is present when the error relates to a tick, otherwise `null`. After an error the worker stops responding. The host marks the fly as `error` and does not send further messages to it.

## Invariants

- Per fly, the sequence of `sense` ticks is `0, 1, 2, …` with no gaps and at most one message in flight.
- For the same `seed`, `brain` and sequence of `sensory` values, the sequence of `motor` replies is identical (Principle V).
- Messages from one worker never reach another worker. A worker never reads or writes another fly's state (Principle II).
