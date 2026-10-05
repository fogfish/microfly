# Contract: Worker protocol, version 3 (forager)

**Owner**: `public/js/brain/protocol-v3.js` (builders and validators, pure). The worker shell `fly.worker.js` and the
pure core `worker-core.js` route by the message version. **Amends**: [worker-protocol-v2.md](../../006-fly-status-panel/contracts/worker-protocol-v2.md).
Protocol 2 (`protocol.js`) stays for mock and v0 flies, unchanged.

## Routing

- The host sends protocol 2 for `mock` and `v0` flies, and protocol 3 for `v1` flies.
- `worker-core` checks `msg.v`: 2 uses the v0 handler, 3 uses the v1 handler. The v0 handler never sees a v3 message.
- A v1 `init` names the brain version; a v2 `init` on a v1 snapshot is an error (`brain version does not match the message protocol`).

## Host → worker

| Type | Fields | Rule |
|---|---|---|
| `init` | `v: 3`, `flyId`, `seed`, `brain` | `brain` is `{version: "v1", snapshot, lif, stepsPerTick, ...}`. `snapshot` is a URL in the message and a parsed container in the worker. |
| `sense` | `v: 3`, `tick`, `inputs`, `state` | `inputs: Float32Array` with one value per declared input, in declaration order. `state: {hunger}`, `hunger` ∈ [0, 1]. |
| `stop` | `v: 3` | As v2. |

## Worker → host

| Type | Fields | Rule |
|---|---|---|
| `ready` | `v: 3`, `flyId`, `neuronCount`, `capabilities` | The v4 capabilities, after the header check. |
| `motor` | `v: 3`, `tick`, `inputs`, `outputs`, `spikes` | `outputs: Float32Array`, one per declared output, in declaration order. `spikes: Uint32Array`, ascending, below `neuronCount`. `inputs` is echoed for the panel. No `left`/`right` for forager brains. |
| `error` | `v: 3`, `flyId`, `tick`, `message` | As v2. After an error the worker is silent. |

## Validation

- `sense.inputs.length` equals the declared input count. Message: `sense.inputs must have ${n} entries, one per declared input`.
- `sense.state.hunger` is a finite number in [0, 1].
- `motor.outputs.length` equals the declared output count (as v2's `validateMotor`).
- `motor.spikes` ascending and below `neuronCount` (as v2).
- A v3 `motor` with `left` or `right` fields is rejected for a forager brain (`motor.left is not part of protocol 3 forager messages`).

## Transfer

Only `motor` carries typed arrays (`outputs`, `spikes`, `inputs`). The `inputs` array is copied on echo; it is small.

## Timing

One `sense` per fly per tick, as in v2. The worker runs `stepsPerTick` LIF steps per `sense` (ADR 003 L5) and sends one
`motor` at the end. The host keeps the tick accounting of v2.
