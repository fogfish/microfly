# Contract Amendment: worker protocol 3, learning telemetry and init

**Amends**: `specs/008-hungry-forager-brain/contracts/worker-protocol-v3.md`. This is a **compatible addition**:
`v` stays 3. Owners: `public/js/brain/protocol-v3.js`, `worker-core.js`, `fly-brain-v1.js` (worker side) and
`public/js/fly/fly-host.js` (host side).

## `init.brain.learning` (host → worker)

The parsed `learning-v1` object, or absent. The worker resolves its groups against the snapshot manifest
(`learning.js`) and passes them to `createNetwork` as `graph.learning`. When `brain.lif.plasticity` is set and
`brain.learning` is absent, the worker replies with an `error`: `E-LEARN-MISSING: plasticity needs
flies.brain.learning`. A reader error (learning-v1 codes) also becomes an `error` reply with the code in the
message.

## `motor.learning` (worker → host)

`Float32Array(4)`, `[dReward, dPunish, wmodApproach, wmodAvoid]`, the values after the tick's last LIF step.
- It is present only when plasticity is on, and absent otherwise (not zeros), so the panel can show "learning off".
- It is listed in `transferables(msg)` when present.
- `validateMotorV3` accepts it when it is a `Float32Array` of length 4 and rejects anything else with
  `motor.learning must be a Float32Array of 4 entries`.

Readers that predate this amendment ignore the field.

## Contract tests

- Worker: an init with plasticity and no learning gives an error. A sense with plasticity on gives `motor.learning`
  of length 4; with it off, the key is absent.
- Host: `validateMotorV3` accepts and rejects as above. `fly-host.js` stores the latest `learning` per fly for the
  panel.
- Old flies: mock, v0, v1, v2 and v3 without plasticity produce byte-identical motor messages to before.
