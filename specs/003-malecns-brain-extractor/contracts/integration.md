# Contract: Simulator Integration (deltas to feature 002 contracts)

This file lists the changes to the feature 002 contracts that this feature makes. The contracts themselves are updated in the same change that implements them (Constitution Dev Workflow). All changes stay within version 1 of their contracts: each adds an optional field and changes no existing meaning.

## 1. World config: `flies.brain.snapshot` (contracts/fly-config.md, 002)

```jsonc
"brain": {
  "snapshot": "brains/smallest-functional-brain.brain",  // optional, URL relative to the web root
  "telemetry": [0, 1, 2],                                  // optional; checked against the snapshot's neuronCount
  "motorSmoothing": 0.05,                                  // optional; used in both modes
  "lif": { "synapticScale": 0.2 }                          // optional; used in both modes
}
```

Rules:

- With `snapshot` set, `neuronCount`, `outDegree` and `inhibitoryFraction` are **rejected** (error names both settings, for example `flies.brain: "snapshot" cannot be combined with "neuronCount"`). The world does not start (spec FR-020).
- Without `snapshot`, the toy rules are unchanged (default 40 neurons, out-degree 4). Existing configs behave exactly as before.
- `telemetry` is checked in two places: format (integers, unique) in `validate.js`, and bounds against the snapshot's `neuronCount` in `fly-host.js` after the header is read (spec FR-021).
- A snapshot that fails to load (missing file, bad format, bad roles) shows in the error panel. No fly starts (spec FR-019, SC-007).
- Snapshot flies are labelled in the UI as "connectome snapshot" with the release and creation date from the header (spec FR-023).

## 2. Worker protocol: `init` brain (contracts/worker-protocol.md, 002)

Protocol version stays 1. The `init` message's `brain` object gains one optional field:

```js
{ v: 1, type: 'init', flyId: 3, seed: 2834727945,
  brain: { snapshot: 'brains/smallest-functional-brain.brain', telemetry: [0, 1, 2], lif: {…} } }
```

- When `brain.snapshot` is present, the worker shell (`fly.worker.js`) fetches the URL, parses it with `snapshot.js`, and passes the resolved snapshot to `worker-core`. The worker replies `ready` with `neuronCount` from the snapshot, or `error` with the reason. The host sends no `sense` before `ready`, so no message needs queuing.
- `seed` is still required by the message format but is not used by a snapshot brain (the snapshot is deterministic). It is documented as such.
- The `sense` and `motor` messages do not change.

## 3. Browser module interfaces

- `public/js/brain/snapshot.js` (pure): `parseSnapshot(arrayBuffer) → { manifest, neuronCount, edgeCount, offsets, targets, weights, synapses }`, or throws an Error whose message follows the reader rules in snapshot-format.md. Node and the browser both use it.
- `public/js/brain/lif.js`: `createNetwork(graph, overrides)` accepts `{ neuronCount, edges }` (toy) or `{ neuronCount, offsets, targets, weights }` (snapshot). Behaviour for the toy is unchanged (golden trace).
- `public/js/brain/fly-brain.js`: `createFlyBrain(brainConfig, seed)` builds the snapshot graph when `brainConfig.snapshot` is an object (the parsed snapshot). It skips `addMotorDrive` (the connectome's sensory edges keep their weights). Sensory is neuron 0, LEFT 1, RIGHT 2, as the roles in the header state.
- `public/js/world/validate.js`: adds the conflict rules in section 1.

## 4. Experiment script (scripts/compare-baseline.mjs)

- Reads `flies.brain.snapshot` when set and parses it with `snapshot.js` (Node reads the file with `fs`).
- Runs the four arms of research R9 over `experiment.seeds`. The output follows data-model.md, "Comparison run".
- Exit status stays as today: 0 with a verdict, 1 only when `world.json` or the snapshot is invalid.

## 5. Not changed

- `lif.js` parameters and their names. `worker-core` message handling beyond the resolved snapshot. The renderer, body and stimulus modules. `world.json` (the default). The LIF golden trace must stay equal.
